import { ref, computed } from 'vue'
import { confirmDialog, currentUser, fmt, getSb, grupos, periodos, toast } from '../store.js'

export function useCierre() {
  const cierrePeriodo   = ref(null)   // datos del cierre en construcción
  const cierresMes      = ref([])
  const loadingCierre   = ref(false)
  const showCierreModal = ref(false)
  const cierrePeriodoId = ref('')

  // Formulario de confirmación del cierre
  const cierreFrm = ref({
    saldo_banco_real: 0,
    notas: ''
  })

  // ── Preparar cierre de un período (calcular todo) ──
  async function prepararCierre(periodoId) {
    const sb = getSb(); if (!sb) return
    loadingCierre.value = true
    cierrePeriodoId.value = periodoId
    const periodo = periodos.value.find(p => p.id === periodoId)

    // 1. Cuadres del período
    const { data: cuadres } = await sb.from('cuadres_grupo')
      .select('*, grupos(nombre, porcentaje_participacion)')
      .eq('periodo_id', periodoId)
    const gruposConCuadre = new Set((cuadres||[]).map(c=>c.grupo_id))
    const totalGrupos = grupos.value.filter(g=>g.activo).length

    // 2. Totales de ventas del período
    const totalVentas     = (cuadres||[]).reduce((s,c)=>s+(c.total_ventas||0),0)
    const totalPremios    = (cuadres||[]).reduce((s,c)=>s+(c.total_premios||0),0)
    const totalComisiones = (cuadres||[]).reduce((s,c)=>s+(c.total_comisiones||0),0)
    const totalDepositado = (cuadres||[]).reduce((s,c)=>s+(c.depositado||0),0)
    const totalBalance    = (cuadres||[]).reduce((s,c)=>s+(c.balance_final||0),0)

    // Detalle de pendientes por grupo (balance_final > 0 = supervisor debe dinero)
    const pendientesPorGrupo = (cuadres||[])
      .filter(c => (c.balance_final||0) > 0)
      .map(c => ({
        grupo_id:   c.grupo_id,
        nombre:     c.grupos?.nombre || '—',
        depositado: c.depositado || 0,
        balance:    c.balance_final || 0,
        total_a_depositar: c.total_a_depositar || 0
      }))
      .sort((a,b) => b.balance - a.balance)

    // 3. Gastos del período
    const { data: gastosData } = await sb.from('gastos')
      .select('monto,tipo').eq('periodo_id', periodoId)
    const totalGastos = (gastosData||[]).reduce((s,g)=>s+g.monto,0)

    // 4. Participaciones del período
    const { data: partData } = await sb.from('participacion_acumulada')
      .select('monto_a_pagar,pagado').eq('periodo_id', periodoId)
    const totalPart    = (partData||[]).reduce((s,p)=>s+(p.monto_a_pagar||0),0)
    const totalPartPag = (partData||[]).reduce((s,p)=>s+(p.pagado||0),0)

    // 5. Movimientos del banco durante este período (por fecha)
    const { data: bancoData } = await sb.from('cuenta_banco')
      .select('tipo,monto').gte('fecha', periodo?.fecha_inicio).lte('fecha', periodo?.fecha_fin)
    const depositosBanco = (bancoData||[]).filter(b=>b.tipo==='ingreso').reduce((s,b)=>s+b.monto,0)
    const retirosBanco   = (bancoData||[]).filter(b=>b.tipo==='egreso').reduce((s,b)=>s+b.monto,0)

    // 6. Saldo de caja central actual (todos los movimientos)
    const { data: cajaData } = await sb.from('caja_central').select('tipo,monto,origen')
    const saldoCaja = (cajaData||[]).reduce((s,m)=>s+(m.tipo==='entrada'?m.monto:-m.monto),0)

    // 7. Saldo banco calculado (último saldo de cuenta_banco)
    const { data: ultimosBanco } = await sb.from('cuenta_banco')
      .select('tipo,monto').order('fecha').order('created_at')
    let saldoBancoCalc = 0
    ;(ultimosBanco||[]).forEach(b => { saldoBancoCalc += b.tipo==='ingreso' ? b.monto : -b.monto })

    // 8. Cierre anterior del banco (saldo inicio del período)
    const { data: cierreAnterior } = await sb.from('cierres_periodo')
      .select('saldo_banco_calculado').order('created_at', {ascending:false}).limit(1)
    const saldoBancoInicio = cierreAnterior?.[0]?.saldo_banco_calculado || 0

    // Resultado neto
    const resultadoBruto = totalVentas - totalPremios - totalComisiones
    const resultadoNeto  = resultadoBruto - totalGastos - totalPart

    // Grupos sin cuadre
    const gruposSinCuadre = grupos.value.filter(g=>g.activo && !gruposConCuadre.has(g.id))

    cierrePeriodo.value = {
      periodo,
      cuadres:            cuadres || [],
      gruposSinCuadre,
      totalGrupos,
      gruposCuadrados:    gruposConCuadre.size,
      // Operación
      totalVentas, totalPremios, totalComisiones, resultadoBruto,
      totalGastos, totalPart, totalPartPag, resultadoNeto,
      // Efectivo
      totalDepositado,
      totalBalance,       // lo que quedó pendiente en manos de supervisores
      pendientesPorGrupo, // detalle por grupo
      // Banco
      saldoBancoInicio, depositosBanco, retirosBanco,
      saldoBancoCalc,
      // Caja
      saldoCaja,
      // Estado
      listo: gruposSinCuadre.length === 0,
    }

    // Prellenar saldo real con el calculado como punto de partida
    cierreFrm.value.saldo_banco_real = saldoBancoCalc

    loadingCierre.value = false
    showCierreModal.value = true
  }

  async function confirmarCierre() {
    const sb = getSb(); if (!sb) return
    if (!cierrePeriodo.value) return

    const c = cierrePeriodo.value
    const periodoId = cierrePeriodoId.value
    const saldoReal = Number(cierreFrm.value.saldo_banco_real) || 0
    const diferencia = c.saldoBancoCalc - saldoReal

    // Si hay diferencia significativa, pedir confirmación extra
    if (Math.abs(diferencia) > 1) {
      const ok = await confirmDialog(
        `Diferencia bancaria: ${fmt(Math.abs(diferencia))}`,
        diferencia > 0
          ? `El sistema tiene ${fmt(diferencia)} MÁS que el saldo real del banco. ¿Deseas registrar esta diferencia y cerrar el período de todas formas?`
          : `El banco tiene ${fmt(Math.abs(diferencia))} MÁS que lo que el sistema calculó. ¿Deseas registrar esta diferencia y cerrar el período?`,
        'Sí, cerrar de todas formas', 'warning'
      )
      if (!ok) return
    }

    // Guardar cierre
    const cierre = {
      periodo_id:            periodoId,
      fecha_cierre:          new Date().toISOString().split('T')[0],
      total_ventas:          c.totalVentas,
      total_premios:         c.totalPremios,
      total_comisiones:      c.totalComisiones,
      resultado_bruto:       c.resultadoBruto,
      total_gastos:          c.totalGastos,
      total_participaciones: c.totalPart,
      resultado_neto:        c.resultadoNeto,
      total_depositado:      c.totalDepositado,
      total_recibido_caja:   c.saldoCaja > 0 ? c.saldoCaja : 0,
      saldo_caja_periodo:    c.saldoCaja,
      saldo_banco_inicio:    c.saldoBancoInicio,
      depositos_periodo:     c.depositosBanco,
      retiros_periodo:       c.retirosBanco,
      saldo_banco_calculado: c.saldoBancoCalc,
      saldo_banco_real:      saldoReal,
      diferencia_banco:      diferencia,
      grupos_cuadrados:      c.gruposCuadrados,
      grupos_total:          c.totalGrupos,
      estado:                'cerrado',
      notas:                 cierreFrm.value.notas,
      cerrado_por:           currentUser.value?.id || null
    }

    const { error } = await sb.from('cierres_periodo')
      .upsert(cierre, { onConflict: 'periodo_id' })
    if (error) { toast('Error al guardar cierre: ' + error.message, 'error'); return }

    // Marcar el período como cerrado
    await sb.from('periodos').update({
      estado:             'cerrado',
      saldo_banco_real:   saldoReal,
      diferencia_banco:   diferencia,
      notas_cierre:       cierreFrm.value.notas,
      cerrado_por:        currentUser.value?.id || null,
      fecha_cierre:       new Date().toISOString()
    }).eq('id', periodoId)

    // Si hay diferencia, crear ajuste automático en flujo
    if (Math.abs(diferencia) > 0.01) {
      await sb.from('flujo_efectivo').insert({
        fecha:    new Date().toISOString().split('T')[0],
        tipo:     diferencia > 0 ? 'egreso' : 'ingreso',
        concepto: `Ajuste de cierre de período — diferencia bancaria`,
        monto:    Math.abs(diferencia),
        origen:   'cierre',
        periodo_id: periodoId
      })
    }

    toast(`Período cerrado ✓. Diferencia bancaria: ${fmt(diferencia)}`, diferencia === 0 ? 'success' : 'warning')
    showCierreModal.value = false
    cierrePeriodo.value   = null
  }

  // ── Cierre mensual ──
  async function prepararCierreMes(mes) {
    const sb = getSb(); if (!sb) return
    loadingCierre.value = true

    const [year, month] = mes.split('-')
    const d1 = `${year}-${month}-01`
    const d2 = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]

    // Períodos que caen dentro del mes
    const periodosDelMes = periodos.value.filter(p =>
      (p.fecha_inicio >= d1 && p.fecha_inicio <= d2) ||
      (p.fecha_fin    >= d1 && p.fecha_fin    <= d2)
    )

    // Cierres de esos períodos
    const ids = periodosDelMes.map(p=>p.id)
    const { data: cierresData } = ids.length
      ? await sb.from('cierres_periodo').select('*').in('periodo_id', ids)
      : { data: [] }

    // Totales del mes
    const sumField = (field) => (cierresData||[]).reduce((s,c)=>s+(c[field]||0),0)

    const cierreMesData = {
      mes,
      periodos: periodosDelMes,
      cierres:  cierresData || [],
      periodosCount:   periodosDelMes.length,
      cerradosCount:   (cierresData||[]).length,
      totalVentas:     sumField('total_ventas'),
      totalPremios:    sumField('total_premios'),
      totalComisiones: sumField('total_comisiones'),
      totalGastos:     sumField('total_gastos'),
      totalPart:       sumField('total_participaciones'),
      resultadoNeto:   sumField('resultado_neto'),
      totalDepositado: sumField('total_depositado'),
      saldoBancoFin:   (cierresData||[]).length
        ? (cierresData||[]).sort((a,b)=>a.fecha_cierre?.localeCompare(b.fecha_cierre||'')||0).pop()?.saldo_banco_calculado || 0
        : 0,
      listo: (cierresData||[]).length === periodosDelMes.length && periodosDelMes.length > 0
    }

    loadingCierre.value = false
    return cierreMesData
  }

  return {
    cierrePeriodo, cierresMes, loadingCierre, showCierreModal,
    cierrePeriodoId, cierreFrm,
    prepararCierre, confirmarCierre, prepararCierreMes
  }
}
