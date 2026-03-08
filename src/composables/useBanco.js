import { ref, computed } from 'vue'
import { categorias, confirmDialog, getSb, grupos, periodos, toast } from '../store.js'

export function useBanco() {
  const bancoMovs    = ref([])
  const loadingBanco = ref(false)
  const showBancoModal = ref(false)
  const bancoEditId    = ref(null)
  const bancoFiltro    = ref({ desde: '', hasta: '', tipo: '', grupo_id: '' })
  const bancoFrm       = ref({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'ingreso', concepto: '', monto: 0,
    referencia: '', grupo_id: '', periodo_id: '', categoria_id: ''
  })

  // ── Propagación cruzada (solo al crear, no al editar)
  const bancoPropagarGasto  = ref(true)   // default ON
  const bancoPropagarFlujo  = ref(true)   // default ON

  const fmt2 = n => {
    const num = Number(n) || 0
    return num.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const bancoStats = computed(() => {
    // saldo = último saldo acumulado (calculado cronológicamente ASC internamente)
    const sorted = [...bancoMovs.value].sort((a,b)=> a.fecha.localeCompare(b.fecha) || (a.created_at||'').localeCompare(b.created_at||''))
    let saldo = 0
    sorted.forEach(m => { saldo += m.tipo === 'ingreso' ? m.monto : -m.monto })
    return {
      saldo,
      ingresos: bancoMovs.value.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0),
      egresos:  bancoMovs.value.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0),
    }
  })

  // Saldo antes del rango filtrado (balance inicial para el período/mes seleccionado)
  const bancoSaldoInicial = ref(0)

  async function loadBanco() {
    const sb = getSb(); if (!sb) return
    loadingBanco.value = true

    // Si hay filtro de fecha "desde", calcular el saldo de todos los movimientos ANTERIORES
    // a esa fecha para mostrar como balance inicial de la vista
    if (bancoFiltro.value.desde) {
      let qPrev = sb.from('cuenta_banco').select('tipo,monto').lt('fecha', bancoFiltro.value.desde)
      const { data: prev } = await qPrev
      bancoSaldoInicial.value = (prev||[]).reduce((s,m) => s + (m.tipo==='ingreso' ? m.monto : -m.monto), 0)
    } else {
      bancoSaldoInicial.value = 0
    }

    let q = sb.from('cuenta_banco')
      .select('*, grupos(nombre), categorias(nombre), ref_gasto_id, ref_flujo_id')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (bancoFiltro.value.desde)    q = q.gte('fecha', bancoFiltro.value.desde)
    if (bancoFiltro.value.hasta)    q = q.lte('fecha', bancoFiltro.value.hasta)
    if (bancoFiltro.value.tipo)     q = q.eq('tipo', bancoFiltro.value.tipo)
    if (bancoFiltro.value.grupo_id) q = q.eq('grupo_id', bancoFiltro.value.grupo_id)
    const { data } = await q

    // Saldo acumulado: parte del saldo inicial (lo que había antes del filtro)
    const asc = [...(data||[])].reverse()
    let saldo = bancoSaldoInicial.value
    const withSaldo = {}
    asc.forEach(m => {
      saldo += m.tipo === 'ingreso' ? m.monto : -m.monto
      withSaldo[m.id] = saldo
    })
    bancoMovs.value = (data||[]).map(m => ({ ...m, saldo_acumulado: withSaldo[m.id] }))
    loadingBanco.value = false
  }

  function editarBanco(m) {
    bancoEditId.value = m.id
    bancoFrm.value = {
      fecha:        m.fecha        || new Date().toISOString().split('T')[0],
      tipo:         m.tipo         || 'ingreso',
      concepto:     m.concepto     || '',
      monto:        m.monto        || 0,
      referencia:   m.referencia   || '',
      grupo_id:     m.grupo_id     || '',
      periodo_id:   m.periodo_id   || '',
      categoria_id: m.categoria_id || ''
    }
    // Al editar no propagar (solo al crear)
    bancoPropagarGasto.value = false
    bancoPropagarFlujo.value = false
    showBancoModal.value = true
  }

  function abrirNuevoBanco() {
    bancoEditId.value = null
    bancoFrm.value = {
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'egreso', concepto: '', monto: 0,
      referencia: '', grupo_id: '', periodo_id: '', categoria_id: ''
    }
    bancoPropagarGasto.value = true   // default ON al crear
    bancoPropagarFlujo.value = true   // default ON al crear
    showBancoModal.value = true
  }

  async function saveBanco() {
    const sb = getSb(); if (!sb) return
    if (!bancoFrm.value.concepto || !bancoFrm.value.monto) {
      toast('Completa el concepto y el monto', 'error'); return
    }
    const m = { ...bancoFrm.value }
    if (!m.grupo_id)     delete m.grupo_id
    if (!m.periodo_id)   delete m.periodo_id
    if (!m.categoria_id) delete m.categoria_id

    let bancoId = bancoEditId.value
    let errorMsg

    if (bancoId) {
      const { error } = await sb.from('cuenta_banco').update(m).eq('id', bancoId)
      errorMsg = error?.message
    } else {
      // CREAR — primero el banco, luego propagar si aplica
      let gastoId  = null
      let flujoId  = null

      // Propagar a Gastos (solo si es egreso y checkbox activo)
      if (!bancoId && bancoPropagarGasto.value && m.tipo === 'egreso') {
        const gastoData = {
          concepto:     m.concepto,
          monto:        m.monto,
          fecha:        m.fecha,
          tipo:         'central',
          categoria_id: m.categoria_id || undefined,
          origen:       'banco'
        }
        Object.keys(gastoData).forEach(k => gastoData[k] === undefined && delete gastoData[k])
        const { data: gd } = await sb.from('gastos').insert(gastoData).select('id').single()
        gastoId = gd?.id || null
      }

      // Propagar a Flujo de Efectivo
      if (!bancoId && bancoPropagarFlujo.value) {
        const flujoData = {
          concepto:     m.concepto,
          monto:        m.monto,
          fecha:        m.fecha,
          tipo:         m.tipo,
          categoria_id: m.categoria_id || undefined,
          referencia:   m.referencia   || undefined,
          origen:       'banco'
        }
        Object.keys(flujoData).forEach(k => flujoData[k] === undefined && delete flujoData[k])
        const { data: fd } = await sb.from('flujo_efectivo').insert(flujoData).select('id').single()
        flujoId = fd?.id || null
      }

      // Guardar banco con referencias
      const bancoInsert = { ...m }
      if (gastoId) bancoInsert.ref_gasto_id = gastoId
      if (flujoId) bancoInsert.ref_flujo_id = flujoId

      const { error } = await sb.from('cuenta_banco').insert(bancoInsert)
      errorMsg = error?.message
    }

    if (errorMsg) { toast('Error: ' + errorMsg, 'error'); return }

    let msg = bancoEditId.value ? 'Movimiento actualizado ✓' : 'Movimiento bancario guardado ✓'
    if (!bancoEditId.value) {
      if (bancoPropagarGasto.value && bancoFrm.value.tipo === 'egreso') msg += ' · también en Gastos'
      if (bancoPropagarFlujo.value) msg += ' · también en Flujo'
    }
    toast(msg, 'success')
    showBancoModal.value = false
    bancoEditId.value = null
    bancoFrm.value = { fecha: new Date().toISOString().split('T')[0], tipo:'egreso', concepto:'', monto:0, referencia:'', grupo_id:'', periodo_id:'', categoria_id:'' }
    bancoPropagarGasto.value = true
    bancoPropagarFlujo.value = true
    loadBanco()
  }

  async function deleteBanco(id) {
    const sb = getSb(); if (!sb) return
    const { data: b } = await sb.from('cuenta_banco').select('ref_gasto_id, ref_flujo_id, concepto').eq('id', id).single()
    const tieneVinculos = b?.ref_gasto_id || b?.ref_flujo_id
    let texto = 'Esta acción no se puede deshacer.'
    if (tieneVinculos) {
      const donde = [b.ref_gasto_id && 'Gastos', b.ref_flujo_id && 'Flujo de Efectivo'].filter(Boolean).join(' y ')
      texto = `⚠️ Este movimiento está vinculado en ${donde}. ¿Eliminar también esos registros vinculados?`
    }
    if (!await confirmDialog(`¿Eliminar movimiento "${b?.concepto||''}"?`, texto)) return
    if (b?.ref_gasto_id) await sb.from('gastos').delete().eq('id', b.ref_gasto_id)
    if (b?.ref_flujo_id) await sb.from('flujo_efectivo').delete().eq('id', b.ref_flujo_id)
    await sb.from('cuenta_banco').delete().eq('id', id)
    toast('Movimiento eliminado y registros vinculados borrados')
    loadBanco()
  }

  return {
    bancoMovs, bancoSaldoInicial, loadingBanco, showBancoModal, bancoEditId, bancoFiltro, bancoFrm,
    bancoStats, bancoPropagarGasto, bancoPropagarFlujo, fmt2,
    loadBanco, editarBanco, abrirNuevoBanco, saveBanco, deleteBanco
  }
}
