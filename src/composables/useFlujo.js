import { computed, nextTick, ref, watch } from 'vue'
import { bancas, categorias, confirmDialog, getSb, grupos, pct, toast } from '../store.js'

export function useFlujo() {
  // ── Chart instance ──
  let flujoChart = null

  const flujoMovs = ref([]);

  const loadingFlujo = ref(false);

  const showFlujoModal = ref(false);

  const flujoEditId    = ref(null);

  const flujoFiltro = ref({ mes: '', tipo: '', periodo_id: '' });

  const flujoFrm = ref({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'ingreso', concepto: '', monto: 0,
    categoria_id: '', grupo_id: '', periodo_id: '',
    referencia: '', notas: '', origen: 'manual'
  });

  const flujoStats = computed(() => {
    const filtered = flujoMovsFiltrados.value;
    const ingresos = filtered.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
    const egresos  = filtered.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);
    const saldo = flujoMovs.value.length ? (flujoMovs.value[flujoMovs.value.length-1]?.saldo_acumulado||0) : 0;
    return { ingresos, egresos, neto: ingresos - egresos, saldo };
  });

  const flujoMeses = computed(() => {
    const meses = new Set();
    flujoMovs.value.forEach(m => {
      const d = m.fecha?.substring(0, 7);
      if (d) meses.add(d);
    });
    return [...meses].sort().reverse().map(v => ({
      value: v,
      label: new Date(v + '-01').toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
    }));
  });

  const flujoMovsFiltrados = computed(() => {
    return flujoMovs.value.filter(m => {
      if (flujoFiltro.value.tipo     && m.tipo !== flujoFiltro.value.tipo)            return false;
      if (flujoFiltro.value.mes      && !m.fecha?.startsWith(flujoFiltro.value.mes))   return false;
      if (flujoFiltro.value.periodo_id && m.periodo_id !== flujoFiltro.value.periodo_id) return false;
      return true;
    });
  });

  const flujoXCategoria = computed(() => {
    const map = {};
    flujoMovsFiltrados.value.forEach(m => {
      const k = m.categoria_id || '__sin__';
      if (!map[k]) map[k] = {
        id: k,
        nombre: m.categorias?.nombre || 'Sin categoría',
        tipo: m.tipo,
        color: m.categorias?.color || '#5a6a80',
        total: 0
      };
      map[k].total += m.monto;
    });
    const arr = Object.values(map);
    const totIngresos = arr.filter(x=>x.tipo==='ingreso').reduce((s,x)=>s+x.total,0)||1;
    const totEgresos  = arr.filter(x=>x.tipo==='egreso').reduce((s,x)=>s+x.total,0)||1;
    return arr.map(x => ({
      ...x,
      pct: x.tipo==='ingreso'
        ? Math.round(x.total/totIngresos*100)
        : Math.round(x.total/totEgresos*100)
    })).sort((a,b)=>b.total-a.total);
  });

  async function loadFlujo() {
    const sb = getSb()
    if (!sb) return
    if (!sb) return;
    loadingFlujo.value = true;
    let q = sb.from('flujo_efectivo')
      .select('*, categorias(nombre,color,tipo), grupos(nombre), bancas(codigo, nombre), ref_gasto_id, ref_banco_id')
      .order('fecha').order('created_at');
    const { data } = await q;
    let saldo = 0;
    flujoMovs.value = (data || []).map(m => {
      saldo += m.tipo === 'ingreso' ? m.monto : -m.monto;
      return { ...m, saldo_acumulado: saldo };
    });
    loadingFlujo.value = false;
    await nextTick();
    renderFlujoChart();
  }

  async function saveFlujo() {
    const sb = getSb()
    if (!sb) return
    if (!sb) return;
    const m = {...flujoFrm.value};
    if (!m.grupo_id) delete m.grupo_id;
    if (!m.periodo_id) delete m.periodo_id;
    if (!m.categoria_id) delete m.categoria_id;
    let error;
    if (flujoEditId.value) {
      ({ error } = await sb.from('flujo_efectivo').update(m).eq('id', flujoEditId.value));
    } else {
      ({ error } = await sb.from('flujo_efectivo').insert(m));
    }
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast(flujoEditId.value ? 'Movimiento actualizado ✓' : 'Movimiento registrado ✓', 'success');
    showFlujoModal.value = false;
    flujoEditId.value = null;
    flujoFrm.value = { fecha: new Date().toISOString().split('T')[0], tipo:'ingreso', concepto:'', monto:0, categoria_id:'', grupo_id:'', periodo_id:'', referencia:'', notas:'', origen:'manual' };
    loadFlujo();
  }

  async function deleteFlujo(id) {
    const sb = getSb()
    if (!sb) return
    if (!await confirmDialog('¿Eliminar movimiento?', 'Esta acción no se puede deshacer.')) return;
    await sb.from('flujo_efectivo').delete().eq('id', id);
    loadFlujo();
  }

  function editarFlujo(m) {
    flujoEditId.value = m.id;
    flujoFrm.value = {
      fecha:        m.fecha        || new Date().toISOString().split('T')[0],
      tipo:         m.tipo         || 'ingreso',
      concepto:     m.concepto     || '',
      monto:        m.monto        || 0,
      categoria_id: m.categoria_id || '',
      grupo_id:     m.grupo_id     || '',
      periodo_id:   m.periodo_id   || '',
      referencia:   m.referencia   || '',
      notas:        m.notas        || '',
      origen:       m.origen       || 'manual'
    };
    showFlujoModal.value = true;
  }

  function renderFlujoChart() {
    const canvas = document.getElementById('chartFlujo');
    if (!canvas) return;
    if (flujoChart) flujoChart.destroy();
    // Agrupar por semana
    const semanas = {};
    flujoMovsFiltrados.value.forEach(m => {
      const d = new Date(m.fecha);
      const lunes = new Date(d);
      lunes.setDate(d.getDate() - d.getDay() + 1);
      const key = lunes.toISOString().split('T')[0];
      if (!semanas[key]) semanas[key] = { ing: 0, egr: 0 };
      if (m.tipo === 'ingreso') semanas[key].ing += m.monto;
      else semanas[key].egr += m.monto;
    });
    const sorted = Object.keys(semanas).sort();
    flujoChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sorted.map(d => 'Sem ' + d.substring(5)),
        datasets: [
          { label: 'Ingresos', data: sorted.map(k=>semanas[k].ing), backgroundColor: 'rgba(0,229,160,0.7)', borderRadius: 4 },
          { label: 'Egresos',  data: sorted.map(k=>semanas[k].egr), backgroundColor: 'rgba(255,77,109,0.7)',  borderRadius: 4 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#5a6a80', font: { family: 'DM Mono', size: 11 } } } },
        scales: {
          x: { grid: { color: '#1e2a3a' }, ticks: { color: '#5a6a80', font: { family: 'DM Mono' } } },
          y: { grid: { color: '#1e2a3a' }, ticks: { color: '#5a6a80', font: { family: 'DM Mono' },
            callback: v => '$' + (v/1000).toFixed(0) + 'K' } }
        }
      }
    });
  }

  return { flujoMovs, loadingFlujo, showFlujoModal, flujoEditId, flujoFiltro, flujoFrm, flujoStats, flujoMeses, flujoMovsFiltrados, flujoXCategoria, loadFlujo, saveFlujo, deleteFlujo, editarFlujo, renderFlujoChart }
}
