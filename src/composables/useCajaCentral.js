import { ref, computed } from 'vue'
import { confirmDialog, currentUser, getSb, grupos, periodos, toast } from '../store.js'

export function useCajaCentral() {
  const cajaMovs       = ref([])
  const loadingCaja    = ref(false)
  const showCajaModal  = ref(false)
  const cajaEditId     = ref(null)
  const cajaFiltro     = ref({ desde: '', hasta: '', origen: '', periodo_id: '' })

  const cajaFrm = ref({
    fecha:      new Date().toISOString().split('T')[0],
    tipo:       'entrada',
    origen:     'entrega_supervisor',
    monto:      0,
    concepto:   '',
    grupo_id:   '',
    periodo_id: '',
    notas:      ''
  })

  const cajaSaldo = computed(() => {
    const sorted = [...cajaMovs.value].sort((a,b) =>
      a.fecha.localeCompare(b.fecha) || (a.created_at||'').localeCompare(b.created_at||''))
    let s = 0
    sorted.forEach(m => { s += m.tipo === 'entrada' ? m.monto : -m.monto })
    return s
  })

  const cajaStats = computed(() => ({
    saldo:    cajaSaldo.value,
    entradas: cajaMovs.value.filter(m=>m.tipo==='entrada').reduce((s,m)=>s+m.monto,0),
    salidas:  cajaMovs.value.filter(m=>m.tipo==='salida').reduce((s,m)=>s+m.monto,0),
  }))

  // Reglas por origen:
  // entrega_supervisor → entrada caja SOLO. El ingreso al negocio ya existe en flujo desde el cuadre.
  // deposito_banco     → salida caja + ingreso en cuenta_banco. NO flujo (ya ingresó con el cuadre).
  // retiro_banco       → entrada caja + egreso en cuenta_banco. NO flujo (el banco ya lo tenía).
  // pago_premio        → salida caja + egreso en flujo (dinero salió del negocio).
  // gasto_efectivo     → salida caja + egreso en flujo + registro en gastos.
  // ajuste / otro      → solo caja.
  const ORIGENES = [
    { value: 'entrega_supervisor', label: '👤 Entrega de supervisor',     tipo: 'entrada' },
    { value: 'deposito_banco',     label: '🏦 Depositar al banco',         tipo: 'salida'  },
    { value: 'retiro_banco',       label: '🏦 Traer del banco',            tipo: 'entrada' },
    { value: 'pago_premio',        label: '🎯 Pagar premio en efectivo',   tipo: 'salida'  },
    { value: 'gasto_efectivo',     label: '🧾 Pagar gasto en efectivo',    tipo: 'salida'  },
    { value: 'ajuste',             label: '⚖️ Ajuste de diferencia',       tipo: 'entrada' },
    { value: 'otro',               label: '📋 Otro',                       tipo: 'entrada' },
  ]

  function origenLabel(o) { return ORIGENES.find(x=>x.value===o)?.label || o }

  async function loadCaja() {
    const sb = getSb(); if (!sb) return
    loadingCaja.value = true
    let q = sb.from('caja_central')
      .select('*, grupos(nombre), periodos(descripcion,fecha_inicio,fecha_fin)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (cajaFiltro.value.desde)      q = q.gte('fecha', cajaFiltro.value.desde)
    if (cajaFiltro.value.hasta)      q = q.lte('fecha', cajaFiltro.value.hasta)
    if (cajaFiltro.value.origen)     q = q.eq('origen', cajaFiltro.value.origen)
    if (cajaFiltro.value.periodo_id) q = q.eq('periodo_id', cajaFiltro.value.periodo_id)
    const { data } = await q
    // Saldo acumulado en orden cronológico (ASC), mostrar en DESC
    const asc = [...(data||[])].reverse()
    let saldo = 0; const withSaldo = {}
    asc.forEach(m => {
      saldo += m.tipo === 'entrada' ? m.monto : -m.monto
      withSaldo[m.id] = saldo
    })
    cajaMovs.value = (data||[]).map(m => ({ ...m, saldo_acumulado: withSaldo[m.id] }))
    loadingCaja.value = false
  }

  function abrirNuevoCaja(preOrigen = 'entrega_supervisor', preGrupoId = '', prePeriodoId = '') {
    cajaEditId.value = null
    const origen = ORIGENES.find(o => o.value === preOrigen) || ORIGENES[0]
    cajaFrm.value = {
      fecha:      new Date().toISOString().split('T')[0],
      tipo:       origen.tipo,
      origen:     preOrigen,
      monto:      0,
      concepto:   '',
      grupo_id:   preGrupoId   || '',
      periodo_id: prePeriodoId || '',
      notas:      ''
    }
    showCajaModal.value = true
  }

  function editarCaja(m) {
    cajaEditId.value = m.id
    cajaFrm.value = {
      fecha:      m.fecha,
      tipo:       m.tipo,
      origen:     m.origen,
      monto:      m.monto,
      concepto:   m.concepto   || '',
      grupo_id:   m.grupo_id   || '',
      periodo_id: m.periodo_id || '',
      notas:      m.notas      || ''
    }
    showCajaModal.value = true
  }

  function onOrigenChange() {
    const def = ORIGENES.find(o => o.value === cajaFrm.value.origen)
    if (def) cajaFrm.value.tipo = def.tipo
  }

  async function saveCaja() {
    const sb = getSb(); if (!sb) return
    if (!cajaFrm.value.monto || cajaFrm.value.monto <= 0) {
      toast('El monto debe ser mayor a 0', 'error'); return
    }
    if (!cajaFrm.value.concepto) {
      toast('Ingresa un concepto', 'error'); return
    }

    const rec = { ...cajaFrm.value }
    if (!rec.grupo_id)   delete rec.grupo_id
    if (!rec.periodo_id) delete rec.periodo_id
    if (currentUser.value?.id) rec.registrado_por = currentUser.value.id

    // Referencias a registros creados en otras tablas
    let refBancoId = null
    let refFlujoId = null
    let toastExtra = ''

    if (!cajaEditId.value) {
      const origen = rec.origen

      // ── DEPÓSITO AL BANCO ──────────────────────────────────────────────────
      // Dinero sale de la caja física y entra al banco.
      // NO crea flujo — el ingreso al negocio ya existía desde el cuadre del supervisor.
      if (origen === 'deposito_banco') {
        const { data: bd, error: be } = await sb.from('cuenta_banco').insert({
          fecha:      rec.fecha,
          tipo:       'ingreso',
          concepto:   rec.concepto,
          monto:      rec.monto,
          grupo_id:   rec.grupo_id   || undefined,
          periodo_id: rec.periodo_id || undefined,
          origen:     'caja_central'
        }).select('id').single()
        if (!be && bd?.id) { refBancoId = bd.id; rec.ref_banco_id = bd.id }
        toastExtra = ' · Ingreso registrado en Banco'
      }

      // ── RETIRO DEL BANCO ───────────────────────────────────────────────────
      // Dinero sale del banco y entra a la caja física.
      // NO crea flujo — no es un ingreso nuevo del negocio, es reubicación.
      if (origen === 'retiro_banco') {
        const { data: bd, error: be } = await sb.from('cuenta_banco').insert({
          fecha:    rec.fecha,
          tipo:     'egreso',
          concepto: rec.concepto,
          monto:    rec.monto,
          origen:   'caja_central'
        }).select('id').single()
        if (!be && bd?.id) { refBancoId = bd.id; rec.ref_banco_id = bd.id }
        toastExtra = ' · Egreso registrado en Banco'
      }

      // ── PAGO DE PREMIO EN EFECTIVO ─────────────────────────────────────────
      // Dinero salió del negocio. Crea egreso en flujo.
      if (origen === 'pago_premio') {
        const { data: fd, error: fe } = await sb.from('flujo_efectivo').insert({
          fecha:      rec.fecha,
          tipo:       'egreso',
          concepto:   rec.concepto,
          monto:      rec.monto,
          grupo_id:   rec.grupo_id   || undefined,
          periodo_id: rec.periodo_id || undefined,
          origen:     'caja_central'
        }).select('id').single()
        if (!fe && fd?.id) { refFlujoId = fd.id; rec.ref_flujo_id = fd.id }
        toastExtra = ' · Egreso registrado en Flujo'
      }

      // ── GASTO EN EFECTIVO ──────────────────────────────────────────────────
      // Dinero salió del negocio pagando un gasto. Crea en gastos + flujo.
      if (origen === 'gasto_efectivo') {
        const { data: gd, error: ge } = await sb.from('gastos').insert({
          fecha:      rec.fecha,
          tipo:       'central',
          concepto:   rec.concepto,
          monto:      rec.monto,
          grupo_id:   rec.grupo_id   || undefined,
          periodo_id: rec.periodo_id || undefined,
          origen:     'caja_central'
        }).select('id').single()

        const { data: fd, error: fe } = await sb.from('flujo_efectivo').insert({
          fecha:      rec.fecha,
          tipo:       'egreso',
          concepto:   rec.concepto,
          monto:      rec.monto,
          grupo_id:   rec.grupo_id   || undefined,
          periodo_id: rec.periodo_id || undefined,
          origen:     'caja_central'
        }).select('id').single()

        if (!ge && gd?.id) rec.ref_banco_id = gd.id  // reuso campo para ref al gasto
        if (!fe && fd?.id) { refFlujoId = fd.id; rec.ref_flujo_id = fd.id }
        toastExtra = ' · Registrado en Gastos y Flujo'
      }

      // ajuste / otro / entrega_supervisor → solo caja, sin registros externos
    }

    let err
    if (cajaEditId.value) {
      ;({ error: err } = await sb.from('caja_central').update(rec).eq('id', cajaEditId.value))
    } else {
      ;({ error: err } = await sb.from('caja_central').insert(rec))
    }
    if (err) { toast('Error: ' + err.message, 'error'); return }

    toast((cajaEditId.value ? 'Movimiento actualizado ✓' : 'Registrado ✓') + toastExtra, 'success')
    showCajaModal.value = false
    cajaEditId.value    = null
    cajaFrm.value = {
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'entrada', origen: 'entrega_supervisor',
      monto: 0, concepto: '', grupo_id: '', periodo_id: '', notas: ''
    }
    loadCaja()
  }

  async function deleteCaja(id) {
    const sb = getSb(); if (!sb) return
    const { data: m } = await sb.from('caja_central')
      .select('concepto, ref_banco_id, ref_flujo_id, origen').eq('id', id).single()
    if (!await confirmDialog(
      `¿Eliminar "${m?.concepto||''}"?`,
      'Se eliminará también cualquier registro vinculado en Banco o Flujo.'
    )) return
    if (m?.ref_banco_id) await sb.from('cuenta_banco').delete().eq('id', m.ref_banco_id)
    if (m?.ref_flujo_id) await sb.from('flujo_efectivo').delete().eq('id', m.ref_flujo_id)
    await sb.from('caja_central').delete().eq('id', id)
    toast('Movimiento eliminado')
    loadCaja()
  }

  return {
    cajaMovs, loadingCaja, showCajaModal, cajaEditId, cajaFiltro, cajaFrm,
    cajaSaldo, cajaStats, ORIGENES,
    origenLabel, loadCaja, abrirNuevoCaja, editarCaja, onOrigenChange, saveCaja, deleteCaja
  }
}
