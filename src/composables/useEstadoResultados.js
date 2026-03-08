import { ref, computed, watch } from 'vue'
import { bancas, categorias, getSb, grupos, periodos, pct, toast } from '../store.js'

export function useEstadoResultados() {
  const erData = ref(null);

  const loadingER = ref(false);

  const erFiltro = ref({ periodo_id: '', grupo_id: '', mes: '', modo: 'periodo' }); // modo: 'periodo' | 'mes'

  async function loadEstadoResultados() {
    const sb = getSb()
    if (!sb) return
    const modo = erFiltro.value.modo || 'periodo'
    if (modo === 'periodo' && !erFiltro.value.periodo_id) { erData.value = null; return; }
    if (modo === 'mes' && !erFiltro.value.mes) { erData.value = null; return; }
    loadingER.value = true;

    // ── Helper: fecha efectiva de un período ──────────────────────────────────
    // Regla: fecha_fin → fecha_inicio → hoy  (misma lógica que el cuadre al escribir)
    function fechaEfectiva(p) {
      return p?.fecha_fin || p?.fecha_inicio || new Date().toISOString().split('T')[0]
    }

    // En modo mes: calcular rango y encontrar los periodo_ids que caen dentro
    let mesFiltroIds = []   // ids de períodos cuya fecha efectiva cae en el mes
    let mesD1 = '', mesD2 = ''
    if (modo === 'mes') {
      const [year, month] = erFiltro.value.mes.split('-')
      mesD1 = `${year}-${month}-01`
      mesD2 = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]
      // Un período pertenece al mes si su fecha efectiva (fecha_fin preferida) cae dentro del mes
      const { periodos: allPeriodos } = await sb.from('periodos')
        .select('id, fecha_inicio, fecha_fin')
        .then(r => ({ periodos: r.data || [] }))
      mesFiltroIds = allPeriodos
        .filter(p => {
          const fe = fechaEfectiva(p)
          return fe >= mesD1 && fe <= mesD2
        })
        .map(p => p.id)
    }

    // Cargar ventas_semana
    let qV = sb.from('ventas_semana')
      .select('*, bancas(id, porcentaje_comision, grupo_id, grupos(nombre, porcentaje_participacion))')
    if (modo === 'periodo') {
      qV = qV.eq('periodo_id', erFiltro.value.periodo_id)
    } else {
      if (mesFiltroIds.length) qV = qV.in('periodo_id', mesFiltroIds)
      else qV = qV.eq('periodo_id', '00000000-0000-0000-0000-000000000000') // sin resultados
    }
    if (erFiltro.value.grupo_id) qV = qV.eq('grupo_id', erFiltro.value.grupo_id);
    const { data: ventas } = await qV;

    // Cargar gastos
    let qG = sb.from('gastos').select('*, categorias(nombre, tipo, color), grupos(nombre)')
    if (modo === 'periodo') {
      qG = qG.eq('periodo_id', erFiltro.value.periodo_id)
    } else {
      // Gastos: filtra por fecha efectiva del período O por fecha directa si no tiene período
      // Los gastos con periodo_id: toma los que pertenecen a períodos del mes
      // Los gastos sin periodo_id: toma los que tienen fecha dentro del mes
      if (mesFiltroIds.length) {
        qG = qG.or(`periodo_id.in.(${mesFiltroIds.join(',')}),and(periodo_id.is.null,fecha.gte.${mesD1},fecha.lte.${mesD2})`)
      } else {
        qG = qG.is('periodo_id', null).gte('fecha', mesD1).lte('fecha', mesD2)
      }
    }
    if (erFiltro.value.grupo_id) qG = qG.eq('grupo_id', erFiltro.value.grupo_id);
    const { data: gastosData } = await qG;

    // Cargar cuadres
    let qC = sb.from('cuadres_grupo')
      .select('*, grupos(nombre, porcentaje_participacion)')
    if (modo === 'periodo') {
      qC = qC.eq('periodo_id', erFiltro.value.periodo_id)
    } else {
      if (mesFiltroIds.length) qC = qC.in('periodo_id', mesFiltroIds)
      else qC = qC.eq('periodo_id', '00000000-0000-0000-0000-000000000000')
    }
    if (erFiltro.value.grupo_id) qC = qC.eq('grupo_id', erFiltro.value.grupo_id);
    const { data: cuadresData } = await qC;

    // Cargar préstamos
    let qP = sb.from('prestamos').select('*')
    if (modo === 'periodo') {
      qP = qP.eq('periodo_id', erFiltro.value.periodo_id)
    } else {
      if (mesFiltroIds.length) qP = qP.in('periodo_id', mesFiltroIds)
      else qP = qP.eq('periodo_id', '00000000-0000-0000-0000-000000000000')
    }
    if (erFiltro.value.grupo_id) qP = qP.eq('grupo_id', erFiltro.value.grupo_id);
    const { data: prestamosData } = await qP;

    // ── CALCULAR ──
    const ventas_total = (ventas||[]).reduce((s,v)=>s+(v.ventas||0),0);
    const premios_total = (ventas||[]).reduce((s,v)=>s+(v.premios||0),0);
    const recargas_total = (ventas||[]).reduce((s,v)=>s+(v.recargas||0)+(v.servicios||0),0);

    // Comisiones calculadas sobre ventas
    const comisiones_total = (ventas||[]).reduce((s,v)=>{
      const pct = v.bancas?.porcentaje_comision || 0;
      return s + (v.ventas||0) * pct / 100;
    }, 0);

    const ingresos_brutos = ventas_total + recargas_total;
    const costo_ventas = premios_total + comisiones_total;
    const margen_bruto = ingresos_brutos - costo_ventas;
    const margen_pct = ventas_total > 0 ? Math.round(margen_bruto / ventas_total * 100) : 0;

    // Gastos (excluir participacion para sección separada)
    const gastosOp = (gastosData||[]).filter(g=>g.tipo!=='participacion');
    const gastos_total = gastosOp.reduce((s,g)=>s+g.monto,0);
    const gastos_x_categoria = Object.values(
      gastosOp.reduce((m,g)=>{
        const k = g.categorias?.nombre || g.tipo || 'Sin categoría';
        if (!m[k]) m[k] = { nombre: k, total: 0, color: g.categorias?.color || '#5a6a80' };
        m[k].total += g.monto;
        return m;
      }, {})
    ).sort((a,b)=>b.total-a.total);

    const ebitda = margen_bruto - gastos_total;

    // Participaciones
    const gastosPartic = (gastosData||[]).filter(g=>g.tipo==='participacion');
    const participaciones_total = gastosPartic.reduce((s,g)=>s+g.monto,0);
    const participaciones_x_grupo = Object.values(
      gastosPartic.reduce((m,g)=>{
        const gid = g.grupo_id;
        const gnombre = g.grupos?.nombre || 'Sin grupo';
        const gc = grupos.value.find(x=>x.id===gid);
        if (!m[gid]) m[gid] = { grupo: gnombre, pct: gc?.porcentaje_participacion||0, total: 0 };
        m[gid].total += g.monto;
        return m;
      }, {})
    );

    const resultado_neto = ebitda - participaciones_total;

    // Movimientos de efectivo
    const depositado_total = (cuadresData||[]).reduce((s,c)=>s+(c.depositado||0),0);
    const balance_pendiente_total = (cuadresData||[]).reduce((s,c)=>s+(c.balance_final||0),0);
    const prestamos_otorgados = (prestamosData||[]).filter(p=>p.tipo==='salida').reduce((s,p)=>s+p.monto,0);
    const prestamos_devueltos = (prestamosData||[]).filter(p=>p.tipo==='entrada').reduce((s,p)=>s+p.monto,0);

    // Detalle por grupo
    const gruposMap = {};
    for (const v of (ventas||[])) {
      const gid = v.bancas?.grupo_id;
      const gnombre = v.bancas?.grupos?.nombre || 'Sin grupo';
      if (!gid) continue;
      if (!gruposMap[gid]) gruposMap[gid] = { grupo_id: gid, nombre: gnombre, ventas:0, premios:0, comisiones:0, gastos:0, participacion:0, resultado:0, depositado:0, balance:0 };
      gruposMap[gid].ventas += v.ventas||0;
      gruposMap[gid].premios += v.premios||0;
      const pct = v.bancas?.porcentaje_comision||0;
      gruposMap[gid].comisiones += (v.ventas||0) * pct / 100;
    }
    for (const g of (gastosData||[])) {
      if (!gruposMap[g.grupo_id]) continue;
      if (g.tipo==='participacion') gruposMap[g.grupo_id].participacion += g.monto||0;
      else gruposMap[g.grupo_id].gastos += g.monto||0;
    }
    for (const c of (cuadresData||[])) {
      if (!gruposMap[c.grupo_id]) continue;
      gruposMap[c.grupo_id].depositado = c.depositado||0;
      gruposMap[c.grupo_id].balance = c.balance_final||0;
    }
    for (const g of Object.values(gruposMap)) {
      g.resultado = g.ventas - g.premios - g.comisiones - g.gastos - g.participacion;
    }

    erData.value = {
      ventas_total, premios_total, recargas_total, comisiones_total,
      ingresos_brutos, costo_ventas, margen_bruto, margen_pct,
      gastos_total, gastos_x_categoria, ebitda,
      participaciones_total, participaciones_x_grupo,
      resultado_neto,
      depositado_total, balance_pendiente_total,
      prestamos_otorgados, prestamos_devueltos,
      detalle_grupos: Object.values(gruposMap)
    };
    loadingER.value = false;
  }

  function printER() {
    const el = document.getElementById('erContent');
    if (!el) return;
    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Estado de Resultados</title>
      <style>
        body{font-family:'DM Mono',monospace;font-size:11px;color:#111;background:#fff;padding:20px}
        .kv-row{display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #eee}
        .kv-total{background:#f5f5f5;font-weight:700;padding:6px 8px}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th,td{padding:5px 8px;border:1px solid #ddd;text-align:left}
        thead{background:#f0f0f0}
        .card{border:1px solid #ddd;border-radius:4px;margin-bottom:10px}
        .card-header{padding:8px 12px;background:#f9f9f9;border-bottom:1px solid #ddd;font-weight:700}
        .card-body{padding:12px}
        .pos{color:#00854a} .neg{color:#cc0033}
        @media print{@page{margin:1cm}}
      </style>
    </head><body>${el.innerHTML}</body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
  }

  function exportToExcel(tableId, filename) {
    const el = document.getElementById(tableId);
    if (!el) { toast('Tabla no disponible', 'error'); return; }
    // Clonar para limpiar columnas de acciones (última th/td vacía o con botones)
    const clone = el.cloneNode(true);
    // Eliminar la última columna (acciones) si el header está vacío
    clone.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const last = cells[cells.length - 1];
      if (last && (last.textContent.trim() === '' || last.querySelector('button'))) {
        last.remove();
      }
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(clone);
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, filename + '.xlsx');
  }

  function exportToPDF(tableId, title, filename) {
    const el = document.getElementById(tableId);
    if (!el) { toast('Tabla no disponible', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    // Header del PDF
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LottoAdmin', 14, 14);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(title, 14, 20);
    doc.text('Generado: ' + new Date().toLocaleDateString('es-DO', { year:'numeric', month:'long', day:'numeric' }), 14, 26);
    // Extraer headers y filas — omitir columna de botones
    const headers = [];
    const rows = [];
    const ths = el.querySelectorAll('thead tr th');
    ths.forEach((th, i) => {
      if (th.textContent.trim() !== '' && !th.querySelector('button')) {
        headers.push({ dataKey: i, header: th.textContent.trim() });
      }
    });
    const validIdx = headers.map(h => h.dataKey);
    el.querySelectorAll('tbody tr').forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (!tds.length) return;
      const row = {};
      validIdx.forEach(i => {
        row[i] = tds[i] ? tds[i].textContent.trim() : '';
      });
      rows.push(row);
    });
    doc.autoTable({
      startY: 32,
      columns: headers,
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [17, 22, 32], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      styles: { overflow: 'linebreak', cellPadding: 2 },
    });
    doc.save(filename + '.pdf');
  }

  function exportERExcel() {
    const el = document.getElementById('erContent');
    if (!el) { toast('Sin datos', 'error'); return; }
    const tables = el.querySelectorAll('table');
    if (!tables.length) { toast('Sin tablas en el reporte', 'error'); return; }
    const wb = XLSX.utils.book_new();
    tables.forEach((t, i) => {
      const ws = XLSX.utils.table_to_sheet(t);
      XLSX.utils.book_append_sheet(wb, ws, 'Tabla' + (i + 1));
    });
    XLSX.writeFile(wb, 'estado_resultados.xlsx');
  }

  // ── Sección VII state ──
  const s7Data = ref(null)
  const loadingS7 = ref(false)
  const s7Filtro = ref({ periodo_id: '', grupo_id: '' })

  async function loadSeccionVII() {
    const sb = getSb()
    if (!sb || !s7Filtro.value.periodo_id) { s7Data.value = null; return }
    loadingS7.value = true

    // Cargar ventas
    let qV = sb.from('ventas_semana')
      .select('*, bancas(id, porcentaje_comision, grupo_id, grupos(nombre, porcentaje_participacion))')
      .eq('periodo_id', s7Filtro.value.periodo_id)
    if (s7Filtro.value.grupo_id) qV = qV.eq('grupo_id', s7Filtro.value.grupo_id)
    const { data: ventas } = await qV

    // Cargar gastos
    let qG = sb.from('gastos')
      .select('*, categorias(nombre, tipo, color), grupos(nombre)')
      .eq('periodo_id', s7Filtro.value.periodo_id)
    if (s7Filtro.value.grupo_id) qG = qG.eq('grupo_id', s7Filtro.value.grupo_id)
    const { data: gastosData } = await qG

    // Cargar cuadres (caja real)
    let qC = sb.from('cuadres_grupo')
      .select('*, grupos(nombre, porcentaje_participacion)')
      .eq('periodo_id', s7Filtro.value.periodo_id)
    if (s7Filtro.value.grupo_id) qC = qC.eq('grupo_id', s7Filtro.value.grupo_id)
    const { data: cuadresData } = await qC

    // Cargar préstamos
    let qP = sb.from('prestamos')
      .select('*')
      .eq('periodo_id', s7Filtro.value.periodo_id)
    if (s7Filtro.value.grupo_id) qP = qP.eq('grupo_id', s7Filtro.value.grupo_id)
    const { data: prestamosData } = await qP

    // Cargar movimientos bancarios del período
    const periodoObj = periodos.value.find(p => p.id == s7Filtro.value.periodo_id)
    let flujoMovs = []
    if (periodoObj) {
      let qF = sb.from('flujo_efectivo')
        .select('*, categorias(nombre, color, tipo), grupos(nombre)')
        .gte('fecha', periodoObj.fecha_inicio)
        .lte('fecha', periodoObj.fecha_fin)
        .order('fecha', { ascending: true })
      if (s7Filtro.value.grupo_id) qF = qF.eq('grupo_id', s7Filtro.value.grupo_id)
      const { data: flujoData } = await qF
      flujoMovs = flujoData || []
    }

    // ── CÁLCULOS P&L ──
    const ventas_total    = (ventas||[]).reduce((s,v)=>s+(v.ventas||0), 0)
    const premios_total   = (ventas||[]).reduce((s,v)=>s+(v.premios||0), 0)
    const comisiones_total = (ventas||[]).reduce((s,v)=> s + (v.ventas||0) * (v.bancas?.porcentaje_comision||0) / 100, 0)
    const recargas_total  = (ventas||[]).reduce((s,v)=>s+(v.recargas||0)+(v.servicios||0), 0)
    const ingresos_brutos = ventas_total + recargas_total
    const costo_ventas    = premios_total + comisiones_total
    const margen_bruto    = ingresos_brutos - costo_ventas

    const gastosOp        = (gastosData||[]).filter(g=>g.tipo!=='participacion')
    const gastosPartic    = (gastosData||[]).filter(g=>g.tipo==='participacion')
    const gastos_total    = gastosOp.reduce((s,g)=>s+g.monto, 0)
    const participaciones_total = gastosPartic.reduce((s,g)=>s+g.monto, 0)
    const ebitda          = margen_bruto - gastos_total
    const resultado_neto  = ebitda - participaciones_total

    // ── CÁLCULOS CAJA REAL ──
    const depositado_total       = (cuadresData||[]).reduce((s,c)=>s+(c.depositado||0), 0)
    const balance_mano_total     = (cuadresData||[]).reduce((s,c)=>s+(c.balance_final||0), 0)
    const prestamos_netos        = (prestamosData||[]).reduce((s,p)=> s + (p.tipo==='salida' ? p.monto : -p.monto), 0)
    const caja_total             = depositado_total + balance_mano_total
    const diferencia_pnl_vs_caja = resultado_neto - caja_total

    // ── CASCADA DEL DINERO (waterfall) ──
    const waterfall = [
      { label: 'Ventas Brutas',       valor: ingresos_brutos,    tipo: 'ingreso',  acum: ingresos_brutos },
      { label: 'Premios Pagados',     valor: -premios_total,     tipo: 'egreso',   acum: ingresos_brutos - premios_total },
      { label: 'Comisiones',          valor: -comisiones_total,  tipo: 'egreso',   acum: ingresos_brutos - premios_total - comisiones_total },
      { label: 'Margen Bruto',        valor: margen_bruto,       tipo: 'subtotal', acum: margen_bruto },
      { label: 'Gastos Operativos',   valor: -gastos_total,      tipo: 'egreso',   acum: ebitda },
      { label: 'EBITDA',              valor: ebitda,             tipo: 'subtotal', acum: ebitda },
      { label: 'Participaciones',     valor: -participaciones_total, tipo: 'egreso', acum: resultado_neto },
      { label: 'Resultado Neto',      valor: resultado_neto,     tipo: 'total',    acum: resultado_neto },
    ]

    // ── DESTINO DEL DINERO (breakdown) ──
    const destinos = []
    if (premios_total > 0)        destinos.push({ label: 'Premios Pagados', monto: premios_total,       pct: pct(premios_total, ingresos_brutos),       color: '#ff4d6d' })
    if (comisiones_total > 0)     destinos.push({ label: 'Comisiones',      monto: comisiones_total,    pct: pct(comisiones_total, ingresos_brutos),    color: '#f9a825' })
    if (participaciones_total > 0) destinos.push({ label: 'Participaciones', monto: participaciones_total, pct: pct(participaciones_total, ingresos_brutos), color: '#7c4dff' })
    // Gastos por categoría
    const gastoPorCat = Object.values(gastosOp.reduce((m,g)=>{
      const k = g.categorias?.nombre || 'Otros'
      const col = g.categorias?.color || '#5a6a80'
      if (!m[k]) m[k] = { label: k, monto: 0, color: col }
      m[k].monto += g.monto
      return m
    }, {}))
    gastoPorCat.forEach(g => destinos.push({ ...g, pct: pct(g.monto, ingresos_brutos) }))
    // Resultado (lo que queda)
    if (resultado_neto > 0) destinos.push({ label: '✅ Resultado Neto', monto: resultado_neto, pct: pct(resultado_neto, ingresos_brutos), color: '#00e5a0' })
    destinos.sort((a,b) => b.monto - a.monto)

    // ── FLUJO BANCARIO POR CATEGORÍA ──
    const flujoPorCat = Object.values(flujoMovs.reduce((m,f)=>{
      const k = f.categorias?.nombre || (f.tipo === 'ingreso' ? 'Ingresos varios' : 'Egresos varios')
      const col = f.categorias?.color || '#5a6a80'
      if (!m[k]) m[k] = { label: k, ingresos: 0, egresos: 0, color: col }
      if (f.tipo === 'ingreso') m[k].ingresos += f.monto
      else m[k].egresos += f.monto
      return m
    }, {})).sort((a,b) => (b.ingresos+b.egresos) - (a.ingresos+a.egresos))

    // ── RECONCILIACIÓN POR GRUPO ──
    const recon = {}
    for (const v of (ventas||[])) {
      const gid = v.bancas?.grupo_id
      const gnombre = v.bancas?.grupos?.nombre || 'Sin grupo'
      if (!gid) continue
      if (!recon[gid]) recon[gid] = { nombre: gnombre, resultado: 0, depositado: 0, balance: 0, prestamos: 0 }
      recon[gid].resultado += (v.ventas||0) - (v.premios||0) - (v.ventas||0) * (v.bancas?.porcentaje_comision||0) / 100
    }
    for (const g of (gastosData||[])) {
      if (recon[g.grupo_id]) recon[g.grupo_id].resultado -= g.monto || 0
    }
    for (const c of (cuadresData||[])) {
      if (recon[c.grupo_id]) {
        recon[c.grupo_id].depositado = c.depositado || 0
        recon[c.grupo_id].balance = c.balance_final || 0
      }
    }
    for (const p of (prestamosData||[])) {
      if (recon[p.grupo_id]) {
        recon[p.grupo_id].prestamos += p.tipo === 'salida' ? p.monto : -p.monto
      }
    }

    s7Data.value = {
      // P&L
      ventas_total, premios_total, comisiones_total, recargas_total,
      ingresos_brutos, costo_ventas, margen_bruto,
      gastos_total, participaciones_total, ebitda, resultado_neto,
      // Caja
      depositado_total, balance_mano_total, prestamos_netos, caja_total,
      diferencia_pnl_vs_caja,
      // Estructuras visuales
      waterfall,
      destinos,
      flujoPorCat,
      reconciliacion: Object.values(recon),
      // Periodo label
      periodo_label: periodoObj ? (periodoObj.descripcion || periodoObj.fecha_inicio) : ''
    }
    loadingS7.value = false
  }

  function renderS7Charts() {
    if (!s7Data.value) return
    const d = s7Data.value

    // Donut — Destino del dinero
    const donutCtx = document.getElementById('chartS7Destino')
    if (donutCtx && window.Chart) {
      if (donutCtx._chart) donutCtx._chart.destroy()
      donutCtx._chart = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: d.destinos.map(x=>x.label),
          datasets: [{ data: d.destinos.map(x=>x.monto), backgroundColor: d.destinos.map(x=>x.color), borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, color: 'var(--text-primary)' } } } }
      })
    }

    // Barras horizontales — Waterfall simplificado
    const barCtx = document.getElementById('chartS7Waterfall')
    if (barCtx && window.Chart) {
      if (barCtx._chart) barCtx._chart.destroy()
      const wfItems = d.waterfall.filter(x => x.tipo !== 'subtotal' && x.tipo !== 'total')
      barCtx._chart = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: wfItems.map(x=>x.label),
          datasets: [{
            data: wfItems.map(x=>Math.abs(x.valor)),
            backgroundColor: wfItems.map(x => x.tipo==='ingreso' ? 'rgba(0,229,160,0.7)' : 'rgba(255,77,109,0.7)'),
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: 'var(--text-muted)', callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(128,128,128,0.1)' } },
            y: { ticks: { color: 'var(--text-primary)', font: { size: 11 } }, grid: { display: false } }
          }
        }
      })
    }
  }


  return { erData, loadingER, erFiltro, loadEstadoResultados, printER, exportToExcel, exportToPDF, exportERExcel, s7Data, loadingS7, s7Filtro, loadSeccionVII, renderS7Charts }
}

// ══════════════════════════════════════════════════════════
// SECCIÓN VII — ¿A Dónde Va el Dinero?
// Reconcilia Estado de Resultados vs Flujo de Caja Real
// ══════════════════════════════════════════════════════════
