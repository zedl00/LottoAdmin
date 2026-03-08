import { computed, nextTick, reactive, ref, watch } from 'vue'
import { bancas, categorias, getSb, grupos, isDark, pct, selectedPeriodoId } from '../store.js'

export function useDashboard() {
  // ── Chart instances (module-level, persist between renders) ──
  let barChart = null
  let donutChart = null
  let flujoLineChart = null
  let flujoIngEgrChart = null
  let flujoAcumChart = null
  let flujoOrigenChart = null
  let flujoCatEgrChart = null
  let gastoCatChart = null
  let gastoBarsChart = null
  let gastoTipoChart = null

  const dashStats = ref({ ventas: 0, premios: 0, comisiones: 0, resultado: 0, bancas_activas: 0 });
  const dashModo  = ref('periodo')   // 'periodo' | 'mes'
  const dashMes   = ref('')          // 'YYYY-MM'

  const dashKpis = ref({ gastos: 0, flujoIngresos: 0, flujoEgresos: 0, flujoNeto: 0, saldoBanco: 0, participacionTotal: 0, participacionPagada: 0 });

  const dashGastosCat = ref([]);

  const dashGruposBancas = ref({});

  const dashExpandido = reactive({});

  const grupoCuadres = ref([]);

  const loadingDash = ref(false);

  async function loadDashboard() {
    const sb = getSb()
    if (!sb) return
    if (!sb) return;
    if (dashModo.value === 'periodo' && !selectedPeriodoId.value) return;
    if (dashModo.value === 'mes'     && !dashMes.value) return;
    loadingDash.value = true;

    // ── Ventas_semana agrupadas por grupo ──
    const { data: ventasData } = await sb.from('ventas_semana')
      .select('*, bancas(id, codigo, nombre, porcentaje_comision, grupo_id)')
      .eq('periodo_id', selectedPeriodoId.value);

    const groupMap = {};
    const bancasDetalle = {}; // grupo_id → array of banca rows
    for (const v of (ventasData || [])) {
      const gid = v.bancas?.grupo_id || 'sin_grupo';
      const g = grupos.value.find(g => g.id === gid);
      const modo = g?.modo || 'estandar';
      if (!groupMap[gid]) groupMap[gid] = {
        id: gid, grupos: { nombre: g?.nombre || 'Sin Grupo' },
        modo, total_ventas: 0, total_premios: 0, total_comisiones: 0, resultado_loteria: 0
      };
      const vtas = v.ventas || 0;
      const prem = v.premios || 0;
      const com  = vtas * (v.bancas?.porcentaje_comision || 0) / 100;
      groupMap[gid].total_ventas     += vtas;
      groupMap[gid].total_premios    += prem;
      groupMap[gid].total_comisiones += com;
      groupMap[gid].resultado_loteria+= (vtas - prem) - com;
      // Guardar detalle de banca para drilldown de grupos Capital
      if (modo === 'individual_bancas') {
        if (!bancasDetalle[gid]) bancasDetalle[gid] = [];
        const existing = bancasDetalle[gid].find(b => b.banca_id === v.banca_id);
        if (!existing) bancasDetalle[gid].push({
          banca_id: v.banca_id, codigo: v.bancas?.codigo, nombre: v.bancas?.nombre,
          ventas: vtas, premios: prem, comision: com, resultado: (vtas - prem) - com
        });
        else {
          existing.ventas += vtas; existing.premios += prem;
          existing.comision += com; existing.resultado += (vtas - prem) - com;
        }
      }
    }

    // Cuadres guardados (grupos estándar) — no aplica a Capital que usa cuadres_banca
    const { data: cuadres } = await sb.from('cuadres_grupo')
      .select('*, grupos(nombre)').eq('periodo_id', selectedPeriodoId.value);
    for (const c of (cuadres || [])) {
      // Solo reemplazar si NO es individual_bancas (esos se calculan desde ventas)
      const modo = grupos.value.find(g=>g.id===c.grupo_id)?.modo || 'estandar';
      if (modo !== 'individual_bancas') groupMap[c.grupo_id] = { ...c, modo };
    }

    // Para Capital: complementar detalle desde cuadres_banca si existen
    for (const gid of Object.keys(bancasDetalle)) {
      const { data: cb } = await sb.from('cuadres_banca')
        .select('*, bancas(codigo, nombre)')
        .eq('grupo_id', gid).eq('periodo_id', selectedPeriodoId.value);
      if (cb && cb.length) {
        bancasDetalle[gid] = cb.map(c => ({
          banca_id: c.banca_id, codigo: c.bancas?.codigo, nombre: c.bancas?.nombre,
          ventas: c.ventas, premios: c.premios, comision: c.comision, resultado: c.resultado_periodo
        }));
      }
    }
    dashGruposBancas.value = bancasDetalle;

    grupoCuadres.value = Object.values(groupMap)
      .filter(g => g.total_ventas > 0 || g.resultado_loteria !== 0)
      .sort((a,b) => (a.grupos?.nombre||'').localeCompare(b.grupos?.nombre||''));

    dashStats.value = {
      ventas:        grupoCuadres.value.reduce((s,g)=>s+(g.total_ventas||0), 0),
      premios:       grupoCuadres.value.reduce((s,g)=>s+(g.total_premios||0), 0),
      comisiones:    grupoCuadres.value.reduce((s,g)=>s+(g.total_comisiones||0), 0),
      resultado:     grupoCuadres.value.reduce((s,g)=>s+(g.resultado_loteria||0), 0),
      bancas_activas: bancas.value.filter(b=>b.activo).length
    };

    // ── KPIs adicionales: gastos, flujo, participación ──
    const [gastosRes, flujoRes, partRes, bancoRes] = await Promise.all([
      (() => {
        let qg = sb.from('gastos').select('monto,tipo,categoria_id,categorias(nombre,color)')
        if (dashModo.value === 'mes' && dashMes.value) {
          const [y,m] = dashMes.value.split('-')
          qg = qg.gte('fecha',`${y}-${m}-01`).lte('fecha', new Date(+y,+m,0).toISOString().split('T')[0])
        } else { qg = qg.eq('periodo_id', selectedPeriodoId.value) }
        return qg
      })(),
      (() => {
        let qf = sb.from('flujo_efectivo').select('tipo,monto,fecha,origen,categoria_id,categorias(nombre,color)')
        if (dashModo.value === 'mes' && dashMes.value) {
          const [y,m] = dashMes.value.split('-')
          qf = qf.gte('fecha',`${y}-${m}-01`).lte('fecha', new Date(+y,+m,0).toISOString().split('T')[0])
        } else { qf = qf.eq('periodo_id', selectedPeriodoId.value) }
        return qf
      })(),
      (() => {
        let qp = sb.from('participacion_acumulada').select('monto_a_pagar,pagado')
        if (dashModo.value === 'periodo') qp = qp.eq('periodo_id', selectedPeriodoId.value)
        return qp
      })(),
      sb.from('cuenta_banco').select('tipo,monto').order('fecha').order('created_at')
    ]);
    const gastos = (gastosRes.data||[]);
    const flujo  = (flujoRes.data||[]);
    const part   = (partRes.data||[]);
    const banco  = (bancoRes.data||[]);
    let saldoB = 0; banco.forEach(m => saldoB += m.tipo==='ingreso' ? m.monto : -m.monto);
    const totalGastos = gastos.reduce((s,g)=>s+(g.monto||0), 0);
    const flujoIng   = flujo.filter(m=>m.tipo==='ingreso');
    const flujoEgr   = flujo.filter(m=>m.tipo==='egreso');
    const flujoIngTotal = flujoIng.reduce((s,m)=>s+m.monto,0);
    const flujoEgrTotal = flujoEgr.reduce((s,m)=>s+m.monto,0);
    const flujoNeto  = flujoIngTotal - flujoEgrTotal;
    // Flujo por origen
    const flujoCuadre  = flujo.filter(m=>m.origen==='cuadre').reduce((s,m)=>s+(m.tipo==='ingreso'?m.monto:-m.monto),0);
    const flujoPrestamo= flujo.filter(m=>m.origen==='prestamo').reduce((s,m)=>s+(m.tipo==='ingreso'?m.monto:-m.monto),0);
    const flujoManual  = flujo.filter(m=>!m.origen||m.origen==='manual').reduce((s,m)=>s+(m.tipo==='ingreso'?m.monto:-m.monto),0);
    // Flujo por categoría (top 5 egresos)
    const flujoCatMap  = {};
    for (const m of flujoEgr) {
      const k = m.categoria_id || '__sin__';
      const n = m.categorias?.nombre || 'Sin Categoría';
      const c = m.categorias?.color || '#5a6a80';
      if (!flujoCatMap[k]) flujoCatMap[k] = { nombre: n, color: c, total: 0 };
      flujoCatMap[k].total += m.monto;
    }
    // Flujo por día (para línea)
    const flujoDiaMap = {};
    for (const m of flujo) {
      const d = m.fecha || '?';
      if (!flujoDiaMap[d]) flujoDiaMap[d] = { ing: 0, egr: 0 };
      m.tipo==='ingreso' ? (flujoDiaMap[d].ing += m.monto) : (flujoDiaMap[d].egr += m.monto);
    }
    const flujoDias  = Object.keys(flujoDiaMap).sort();
    let acum = 0;
    const flujoAcumLine = flujoDias.map(d => { acum += flujoDiaMap[d].ing - flujoDiaMap[d].egr; return acum; });
    dashKpis.value = {
      gastos:              totalGastos,
      flujoIngresos:       flujoIngTotal,
      flujoEgresos:        flujoEgrTotal,
      flujoNeto,
      flujoCuadre, flujoPrestamo, flujoManual,
      flujoCatEgr:         Object.values(flujoCatMap).sort((a,b)=>b.total-a.total).slice(0,6),
      flujoDias, flujoIngDia: flujoDias.map(d=>flujoDiaMap[d].ing),
      flujoEgrDia: flujoDias.map(d=>flujoDiaMap[d].egr),
      flujoAcumLine,
      saldoBanco:          saldoB,
      participacionTotal:  part.reduce((s,p)=>s+(p.monto_a_pagar||0),0),
      participacionPagada: part.reduce((s,p)=>s+(p.pagado||0),0),
    };

    // ── Backfill DB: asignar categoria_id a gastos viejos sin ella ──
    const catPartMatch = categorias.value.find(c => c.tipo==='egreso' && c.nombre?.toLowerCase().includes('participac'));
    const gastosOrfanos = gastos.filter(g => !g.categoria_id && g.tipo==='participacion');
    if (catPartMatch && gastosOrfanos.length) {
      // Actualizar en DB todos los gastos participacion sin categoria (fire-and-forget)
      sb.from('gastos').update({ categoria_id: catPartMatch.id })
        .eq('tipo', 'participacion').is('categoria_id', null)
        .then(() => {}); // no bloquear el render
      // Actualizar en memoria para este render
      gastosOrfanos.forEach(g => {
        g.categoria_id = catPartMatch.id;
        g.categorias = { nombre: catPartMatch.nombre, color: catPartMatch.color };
      });
    }

    // ── Gastos por categoría ──
    // Fallback: si no hay categoria_id, inferir por tipo
    const catFallback = (g) => {
      if (g.tipo === 'participacion') {
        const c = catPartMatch || categorias.value.find(c=>c.nombre?.toLowerCase().includes('participac'));
        return c ? { id: c.id, nombre: c.nombre, color: c.color } : { nombre: 'Participación', color: '#ffd166' };
      }
      return { nombre: 'Sin Categoría', color: '#5a6a80' };
    };
    const catMap = {};
    for (const g of gastos) {
      const cat   = g.categorias || catFallback(g);
      const key   = g.categoria_id || ('__tipo_' + g.tipo);
      const label = cat.nombre;
      const color = cat.color || '#5a6a80';
      if (!catMap[key]) catMap[key] = { nombre: label, color, total: 0 };
      catMap[key].total += g.monto || 0;
    }
    // También bucket manual: operativo vs participación
    const opTotal   = gastos.filter(g=>g.tipo!=='participacion').reduce((s,g)=>s+(g.monto||0),0);
    const partGasto = gastos.filter(g=>g.tipo==='participacion').reduce((s,g)=>s+(g.monto||0),0);
    dashGastosCat.value = Object.values(catMap)
      .sort((a,b) => b.total - a.total)
      .map(c => ({ ...c, pct: totalGastos > 0 ? Math.round(c.total/totalGastos*100) : 0 }));
    // Add tipo summary as last two entries (used for stacked chart)
    dashGastosCat.value._opTotal   = opTotal;
    dashGastosCat.value._partGasto = partGasto;

    loadingDash.value = false;
    await nextTick();
    renderDashCharts();
    renderGastosCharts();
    renderFlujoKpiCharts();
  }

  function renderDashCharts() {
    const isDarkMode = isDark.value;
    const gridColor = isDarkMode ? '#1e2a3a' : '#e8ecf2';
    const tickColor = isDarkMode ? '#5a6a80' : '#7a8a9a';
    const font = { family: 'DM Mono', size: 11 };

    // Chart 1: Ventas vs Premios por grupo
    const c1 = document.getElementById('chartBar');
    if (c1) {
      if (barChart) barChart.destroy();
      const labels = grupoCuadres.value.map(g => g.grupos?.nombre || '?');
      barChart = new Chart(c1, {
        type: 'bar',
        data: { labels, datasets: [
          { label: 'Ventas',   data: grupoCuadres.value.map(g=>g.total_ventas||0),   backgroundColor: 'rgba(76,201,240,0.75)', borderRadius: 5 },
          { label: 'Premios',  data: grupoCuadres.value.map(g=>g.total_premios||0),  backgroundColor: 'rgba(255,77,109,0.75)', borderRadius: 5 },
          { label: 'Resultado',data: grupoCuadres.value.map(g=>g.resultado_loteria||0), backgroundColor: grupoCuadres.value.map(g=>g.resultado_loteria>=0?'rgba(0,229,160,0.75)':'rgba(255,77,109,0.5)'), borderRadius: 5 },
        ]},
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: tickColor, font } } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: tickColor, font } },
            y: { grid: { color: gridColor }, ticks: { color: tickColor, font, callback: v => '$'+(v/1000).toFixed(0)+'K' } }
          }
        }
      });
    }

    // Chart 2: Donut distribución gastos vs comisiones vs resultado
    const c2 = document.getElementById('chartDonut');
    if (c2) {
      if (donutChart) donutChart.destroy();
      const ds = dashStats.value;
      donutChart = new Chart(c2, {
        type: 'doughnut',
        data: { labels: ['Premios','Comisiones','Gastos','Resultado'],
          datasets: [{ data: [ds.premios, ds.comisiones, dashKpis.value.gastos, Math.max(ds.resultado,0)],
            backgroundColor: ['rgba(255,77,109,0.8)','rgba(255,209,102,0.8)','rgba(76,201,240,0.6)','rgba(0,229,160,0.8)'],
            borderWidth: 0, hoverOffset: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%',
          plugins: { legend: { position: 'bottom', labels: { color: tickColor, font, padding: 12 } } }
        }
      });
    }

    // Chart 3: Flujo de efectivo acumulado (línea) — un punto por día
    const c3 = document.getElementById('chartFlujoLine');
    if (c3 && (dashKpis.value.flujoDias||[]).length) {
      if (flujoLineChart) flujoLineChart.destroy();
      const lineLabels = dashKpis.value.flujoDias.map(d => d.substring(5));
      const lineSaldo  = dashKpis.value.flujoAcumLine || [];
      const lastSaldo  = lineSaldo.slice(-1)[0] || 0;
      const lColor  = lastSaldo >= 0 ? 'rgba(0,229,160,0.95)' : 'rgba(255,77,109,0.95)';
      const bgColor = lastSaldo >= 0 ? 'rgba(0,229,160,0.10)' : 'rgba(255,77,109,0.08)';
      const ptColor = lineSaldo.map(v => v >= 0 ? 'rgba(0,229,160,1)' : 'rgba(255,77,109,1)');
      flujoLineChart = new Chart(c3, {
        type: 'line',
        data: { labels: lineLabels, datasets: [{
          label: 'Saldo del Día',
          data: lineSaldo,
          borderColor: lColor,
          backgroundColor: bgColor,
          pointBackgroundColor: ptColor,
          pointBorderColor: ptColor,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2,
          fill: true,
          tension: 0.25
        }]},
        options: { responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: tickColor, font } },
            tooltip: {
              callbacks: {
                label: ctx => ' Saldo: $' + ctx.parsed.y.toLocaleString('es-DO')
              }
            }
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: tickColor, font, maxTicksLimit: 10 } },
            y: { grid: { color: gridColor }, ticks: { color: tickColor, font, callback: v => '$'+(v/1000).toFixed(0)+'K' },
              afterDataLimits(scale) { scale.max = scale.max * 1.08; } }
          }
        }
      });
    }
  }

  function renderFlujoKpiCharts() {
    const k         = dashKpis.value;
    const isDarkMode= isDark.value;
    const grid      = isDarkMode ? '#1e2a3a' : '#e8ecf2';
    const tick      = isDarkMode ? '#5a6a80' : '#7a8a9a';
    const font      = { family: 'DM Mono', size: 10 };
    const dias      = k.flujoDias  || [];
    const labDias   = dias.map(d => d.substring(5)); // MM-DD

    // Chart 1: Barras Ingresos vs Egresos por día
    const c1 = document.getElementById('chartFlujoIngEgr');
    if (c1) {
      if (flujoIngEgrChart) flujoIngEgrChart.destroy();
      flujoIngEgrChart = new Chart(c1, {
        type: 'bar',
        data: { labels: labDias, datasets: [
          { label: 'Ingresos', data: k.flujoIngDia||[], backgroundColor: 'rgba(0,229,160,0.75)', borderRadius: 3 },
          { label: 'Egresos',  data: k.flujoEgrDia||[], backgroundColor: 'rgba(255,77,109,0.75)', borderRadius: 3 },
        ]},
        options: { responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ labels:{ color:tick, font, padding:10 } } },
          scales:{
            x:{ stacked:false, grid:{color:grid}, ticks:{color:tick,font,maxTicksLimit:10} },
            y:{ grid:{color:grid}, ticks:{color:tick,font,callback:v=>'$'+(v/1000).toFixed(0)+'K'} }
          }
        }
      });
    }

    // Chart 2: Línea saldo acumulado
    const c2 = document.getElementById('chartFlujoAcum');
    if (c2) {
      if (flujoAcumChart) flujoAcumChart.destroy();
      const lineColor = (k.flujoAcumLine||[]).slice(-1)[0] >= 0 ? 'rgba(0,229,160,0.9)' : 'rgba(255,77,109,0.9)';
      const fillColor = (k.flujoAcumLine||[]).slice(-1)[0] >= 0 ? 'rgba(0,229,160,0.07)' : 'rgba(255,77,109,0.07)';
      flujoAcumChart = new Chart(c2, {
        type: 'line',
        data: { labels: labDias, datasets: [{
          label: 'Saldo Acumulado', data: k.flujoAcumLine||[],
          borderColor: lineColor, backgroundColor: fillColor,
          borderWidth: 2, pointRadius: 2, fill: true, tension: 0.3
        }]},
        options: { responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ labels:{ color:tick, font } } },
          scales:{
            x:{ grid:{color:grid}, ticks:{color:tick,font,maxTicksLimit:10} },
            y:{ grid:{color:grid}, ticks:{color:tick,font,callback:v=>'$'+(v/1000).toFixed(0)+'K'} }
          }
        }
      });
    }

    // Chart 3: Donut por origen (cuadre / préstamo / manual)
    const c3 = document.getElementById('chartFlujoOrigen');
    if (c3) {
      if (flujoOrigenChart) flujoOrigenChart.destroy();
      flujoOrigenChart = new Chart(c3, {
        type: 'doughnut',
        data: { labels: ['Cuadres','Préstamos','Manual'],
          datasets:[{ data:[Math.abs(k.flujoCuadre||0), Math.abs(k.flujoPrestamo||0), Math.abs(k.flujoManual||0)],
            backgroundColor:['rgba(0,229,160,0.8)','rgba(76,201,240,0.8)','rgba(255,209,102,0.8)'],
            borderWidth:0, hoverOffset:6
          }]
        },
        options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
          plugins:{ legend:{ position:'bottom', labels:{ color:tick, font, padding:10, boxWidth:10 } } }
        }
      });
    }

    // Chart 4: Barras horizontales egresos por categoría
    const c4 = document.getElementById('chartFlujoCatEgr');
    if (c4 && (k.flujoCatEgr||[]).length) {
      if (flujoCatEgrChart) flujoCatEgrChart.destroy();
      const cats = k.flujoCatEgr;
      flujoCatEgrChart = new Chart(c4, {
        type: 'bar',
        data: { labels: cats.map(c=>c.nombre), datasets:[{
          label:'Egresos RD$', data: cats.map(c=>c.total),
          backgroundColor: cats.map(c=>(c.color||'#5a6a80')+'bb'),
          borderRadius:4
        }]},
        options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
          plugins:{ legend:{ display:false } },
          scales:{
            x:{ grid:{color:grid}, ticks:{color:tick,font,callback:v=>'$'+(v/1000).toFixed(0)+'K'} },
            y:{ grid:{display:false}, ticks:{color:tick,font} }
          }
        }
      });
    }
  }

  function renderGastosCharts() {
    const isDarkMode = isDark.value;
    const gridColor  = isDarkMode ? '#1e2a3a' : '#e8ecf2';
    const tickColor  = isDarkMode ? '#5a6a80' : '#7a8a9a';
    const font       = { family: 'DM Mono', size: 11 };
    const cats       = dashGastosCat.value;
    if (!cats || !cats.length) return;

    const labels = cats.map(c => c.nombre);
    const totals = cats.map(c => c.total);
    const colors = cats.map(c => c.color || '#5a6a80');
    const bgColors = colors.map(c => c + 'cc');

    // Chart A: Donut por categoría
    const cA = document.getElementById('chartGastoCat');
    if (cA) {
      if (gastoCatChart) gastoCatChart.destroy();
      gastoCatChart = new Chart(cA, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: totals, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%',
          plugins: { legend: { position: 'right', labels: { color: tickColor, font, padding: 10, boxWidth: 12,
            generateLabels: chart => chart.data.labels.map((l,i) => ({
              text: l + '  $' + (chart.data.datasets[0].data[i]/1000).toFixed(1) + 'K',
              fillStyle: chart.data.datasets[0].backgroundColor[i],
              strokeStyle: 'transparent', index: i
            }))
          }}}
        }
      });
    }

    // Chart B: Barras horizontales top categorías
    const cB = document.getElementById('chartGastoBars');
    if (cB) {
      if (gastoBarsChart) gastoBarsChart.destroy();
      const top = cats.slice(0, 8);
      gastoBarsChart = new Chart(cB, {
        type: 'bar',
        data: { labels: top.map(c=>c.nombre), datasets: [{
          label: 'Gasto RD$',
          data: top.map(c=>c.total),
          backgroundColor: top.map(c=>(c.color||'#5a6a80')+'bb'),
          borderRadius: 4
        }]},
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: tickColor, font, callback: v=>'$'+(v/1000).toFixed(0)+'K' } },
            y: { grid: { display: false }, ticks: { color: tickColor, font } }
          }
        }
      });
    }

    // Chart C: Barras apiladas Operativo vs Participación vs Resultado
    const cC = document.getElementById('chartGastoTipo');
    if (cC) {
      if (gastoTipoChart) gastoTipoChart.destroy();
      const opT   = cats._opTotal   || 0;
      const parT  = cats._partGasto || 0;
      const resN  = Math.max(dashStats.value.resultado, 0);
      gastoTipoChart = new Chart(cC, {
        type: 'bar',
        data: {
          labels: ['Período Actual'],
          datasets: [
            { label: 'Gastos Operativos', data: [opT],  backgroundColor: 'rgba(76,201,240,0.75)', borderRadius: 4 },
            { label: 'Participación',      data: [parT], backgroundColor: 'rgba(255,209,102,0.75)', borderRadius: 4 },
            { label: 'Resultado Neto',     data: [resN], backgroundColor: 'rgba(0,229,160,0.75)',   borderRadius: 4 },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: tickColor, font, padding: 14 } } },
          scales: {
            x: { stacked: true, grid: { color: gridColor }, ticks: { color: tickColor, font } },
            y: { stacked: true, grid: { color: gridColor }, ticks: { color: tickColor, font, callback: v=>'$'+(v/1000).toFixed(0)+'K' } }
          }
        }
      });
    }
  }

  return { dashStats, dashKpis, dashModo, dashMes, dashGastosCat, dashGruposBancas, dashExpandido, grupoCuadres, loadingDash, loadDashboard, renderDashCharts, renderFlujoKpiCharts, renderGastosCharts }
}
