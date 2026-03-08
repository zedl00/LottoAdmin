import { ref, computed, watch, reactive } from 'vue'
import { bancas, getSb, grupos, pct, periodos, selectedPeriodoId } from '../store.js'

export function useResumen() {
  const resumenData = ref([]);

  const loadingResumen = ref(false);

  const resumenExpandido = reactive({});

  async function loadResumen() {
    const sb = getSb()
    if (!sb) return
    if (!sb || !selectedPeriodoId.value) return;
    loadingResumen.value = true;

    // Cargar ventas_semana en tiempo real para todos los grupos
    const { data: ventasData } = await sb.from('ventas_semana')
      .select('*, bancas(id, porcentaje_comision, grupo_id, grupos(nombre))')
      .eq('periodo_id', selectedPeriodoId.value);

    // Cargar cuadres guardados para el período
    const { data: cuadresData } = await sb.from('cuadres_grupo')
      .select('*, grupos(nombre), periodos(descripcion, fecha_inicio, fecha_fin)')
      .eq('periodo_id', selectedPeriodoId.value);

    // Cargar gastos operativos del período por grupo
    const { data: gastosResumen } = await sb.from('gastos')
      .select('grupo_id, monto, tipo')
      .eq('periodo_id', selectedPeriodoId.value);
    // Suma de gastos operativos y de participación por grupo
    const gastosPorGrupo = {};
    const partGastoPorGrupo = {};
    for (const g of (gastosResumen || [])) {
      if (g.tipo === 'participacion') {
        partGastoPorGrupo[g.grupo_id] = (partGastoPorGrupo[g.grupo_id] || 0) + (g.monto || 0);
      } else if (g.tipo === 'operativo') {
        gastosPorGrupo[g.grupo_id] = (gastosPorGrupo[g.grupo_id] || 0) + (g.monto || 0);
      }
    }
    // Cargar participación desde participacion_acumulada (dato oficial al guardar cuadre)
    const { data: partAcumData } = await sb.from('participacion_acumulada')
      .select('grupo_id, monto_a_pagar')
      .eq('periodo_id', selectedPeriodoId.value);
    const partAcumPorGrupo = {};
    for (const p of (partAcumData || [])) {
      partAcumPorGrupo[p.grupo_id] = (p.monto_a_pagar || 0);
    }

    // Construir mapa: primero con datos vivos de ventas
    const periodoObj = periodos.value.find(p=>p.id===selectedPeriodoId.value);
    const groupMap = {};
    for (const v of (ventasData || [])) {
      const gid = v.bancas?.grupo_id;
      if (!gid) continue;
      const g = grupos.value.find(g=>g.id===gid);
      if (!groupMap[gid]) groupMap[gid] = {
        id: null, grupo_id: gid,
        grupos: { nombre: g?.nombre || 'Sin Grupo' },
        periodos: periodoObj,
        total_ventas: 0, total_premios: 0, total_comisiones: 0,
        total_gastos: 0, participacion_op: 0, resultado_loteria: 0,
        // campos de cuadre (vacíos hasta que se guarde)
        balance_pendiente_anterior: 0, total_acumulado: 0,
        entregado_supervisor: 0, entregado_central: 0,
        total_a_depositar: 0, depositado: 0, balance_final: 0,
        cuadre_guardado: false
      };
      const vtas = v.ventas || 0;
      const prem = v.premios || 0;
      const pct = v.bancas?.porcentaje_comision || 0;
      const com = vtas * pct / 100;
      const resNeto = (vtas - prem) - com;
      groupMap[gid].total_ventas += vtas;
      groupMap[gid].total_premios += prem;
      groupMap[gid].total_comisiones += com;
      groupMap[gid].resultado_loteria += resNeto;
    }

    // Aplicar gastos y participación a todos los grupos
    for (const gid of Object.keys(groupMap)) {
      if (!groupMap[gid].cuadre_guardado) {
        groupMap[gid].total_gastos   = gastosPorGrupo[gid]    || 0;
      }
      // Participación: preferir dato oficial de participacion_acumulada, si no usar gasto tipo=participacion
      groupMap[gid].participacion_op = partAcumPorGrupo[gid] || partGastoPorGrupo[gid] || 0;
    }

    // Sobreescribir con cuadres guardados donde existan (datos más completos)
    for (const c of (cuadresData || [])) {
      const grupoModo = grupos.value.find(g=>g.id===c.grupo_id)?.modo || 'estandar'; // null → estandar
      if (groupMap[c.grupo_id]) {
        groupMap[c.grupo_id] = { ...groupMap[c.grupo_id], ...c, cuadre_guardado: true, modo: grupoModo };
      } else {
        groupMap[c.grupo_id] = { ...c, cuadre_guardado: true, modo: grupoModo };
      }
    }
    // Asegurar que grupos individual_bancas aparecen aunque no tengan cuadre guardado aún
    for (const g of grupos.value.filter(g=>(g.modo||'estandar')==='individual_bancas' && g.activo !== false)) {
      if (!groupMap[g.id]) {
        groupMap[g.id] = {
          id: null, grupo_id: g.id,
          grupos: { nombre: g.nombre },
          periodos: periodos.value.find(p=>p.id===selectedPeriodoId.value),
          total_ventas: 0, total_premios: 0, total_comisiones: 0,
          total_gastos: 0, resultado_loteria: 0,
          balance_pendiente_anterior: 0, total_acumulado: 0,
          entregado_supervisor: 0, entregado_central: 0,
          total_a_depositar: 0, depositado: 0, balance_final: 0,
          cuadre_guardado: false, modo: 'individual_bancas'
        };
      } else {
        groupMap[g.id].modo = 'individual_bancas';
      }
    }

    // Para grupos individual_bancas, añadir detalle de bancas
    for (const gid of Object.keys(groupMap)) {
      const grupoObj = grupos.value.find(g=>g.id===gid);
      if ((grupoObj?.modo || 'estandar') === 'individual_bancas') {
        groupMap[gid].modo = 'individual_bancas';
        // Cargar cuadres individuales de bancas para este grupo+período
        const { data: cuadresBanca } = await sb.from('cuadres_banca')
          .select('*, bancas(id, codigo, nombre, porcentaje_participacion, porcentaje_comision)')
          .eq('grupo_id', gid)
          .eq('periodo_id', selectedPeriodoId.value);
        groupMap[gid].cuadres_bancas = cuadresBanca || [];
        // Sumar todos los campos de cuadres_banca para totales del grupo
        if ((cuadresBanca||[]).length > 0) {
          groupMap[gid].cuadre_guardado = true;
          const sum = (field) => (cuadresBanca||[]).reduce((s,c)=>s+(c[field]||0),0);
          groupMap[gid].resultado_loteria        = sum('resultado_periodo');
          groupMap[gid].total_ventas             = sum('ventas');
          groupMap[gid].total_premios            = sum('premios');
          groupMap[gid].total_comisiones         = sum('comision');
          groupMap[gid].total_gastos             = sum('total_gastos');
          groupMap[gid].balance_pendiente_anterior = sum('balance_pendiente_anterior');
          groupMap[gid].total_acumulado          = sum('total_acumulado');
          groupMap[gid].entregado_supervisor     = sum('entregado_supervisor');
          groupMap[gid].entregado_central        = sum('entregado_central');
          groupMap[gid].total_a_depositar        = sum('total_a_depositar');
          groupMap[gid].depositado               = sum('depositado');
          groupMap[gid].balance_final            = sum('balance_final');
        }
      }
    }

    resumenData.value = Object.values(groupMap)
      .filter(g => g.total_ventas > 0 || g.resultado_loteria !== 0 || g.cuadre_guardado || g.modo === 'individual_bancas')
      .sort((a,b) => (a.grupos?.nombre||'').localeCompare(b.grupos?.nombre||''));
    loadingResumen.value = false;
  }

  function printResumen() { window.print(); }

  function toggleResumenDrilldown(gid) {
    resumenExpandido[gid] = !resumenExpandido[gid];
  }

  return { resumenData, loadingResumen, resumenExpandido, loadResumen, printResumen, toggleResumenDrilldown }
}
