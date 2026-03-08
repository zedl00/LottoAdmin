import { ref, computed } from 'vue'
import { bancas, categorias, confirmDialog, getSb, grupos, toast } from '../store.js'

const PAGE_SIZE = 50

export function useGastos() {
  const gastos         = ref([])
  const gastosTotal    = ref(0)          // total sin paginar (para paginación)
  const gastoPage      = ref(1)
  const loadingGastos  = ref(false)
  const showGastoModal = ref(false)
  const gastoFiltro    = ref({
    modo:       'periodo',   // 'periodo' | 'mes' | 'todo'
    periodo_id: '',
    mes:        '',
    grupo_id:   ''
  })
  const gastoFrm = ref({
    periodo_id:'', grupo_id:'', banca_id:'', tipo:'operativo',
    concepto:'', monto:0, fecha: new Date().toISOString().split('T')[0], categoria_id:''
  })
  const gastoEditId = ref(null)

  // Propagación cruzada
  const gastoPropagarBanco = ref(false)
  const gastoPropagarFlujo = ref(false)
  const gastoSincBanco     = ref(false)
  const gastoSincFlujo     = ref(false)
  const gastoTieneRefBanco = ref(false)
  const gastoTieneRefFlujo = ref(false)

  // ── Gráfico por categoría (calculado sobre los gastos cargados) ──
  const gastosXCategoria = computed(() => {
    const map = {}
    gastos.value.forEach(g => {
      const k = g.categoria_id || '__sin__'
      if (!map[k]) map[k] = {
        nombre: g.categorias?.nombre || 'Sin categoría',
        color:  g.categorias?.color  || '#5a6a80',
        total:  0, count: 0
      }
      map[k].total += g.monto || 0
      map[k].count++
    })
    return Object.values(map).sort((a,b) => b.total - a.total)
  })

  const gastosTotalMonto = computed(() =>
    gastos.value.reduce((s,g) => s + (g.monto||0), 0)
  )

  // ── Paginación ──
  const totalPages = computed(() => Math.ceil(gastosTotal.value / PAGE_SIZE) || 1)

  function abrirNuevoGasto(preGrupoId='', prePeriodoId='') {
    gastoEditId.value        = null
    gastoTieneRefBanco.value = false
    gastoTieneRefFlujo.value = false
    gastoFrm.value = {
      periodo_id: prePeriodoId||'', grupo_id: preGrupoId||'', banca_id: '',
      tipo:'operativo', concepto:'', monto:0,
      fecha: new Date().toISOString().split('T')[0], categoria_id:''
    }
    gastoPropagarBanco.value = false
    gastoPropagarFlujo.value = false
    gastoSincBanco.value     = false
    gastoSincFlujo.value     = false
    showGastoModal.value     = true
  }

  function editarGasto(g) {
    gastoEditId.value = g.id
    gastoFrm.value = {
      periodo_id:   g.periodo_id   || '',
      grupo_id:     g.grupo_id     || '',
      banca_id:     g.banca_id     || '',
      tipo:         g.tipo         || 'operativo',
      concepto:     g.concepto     || '',
      monto:        g.monto        || 0,
      fecha:        g.fecha        || new Date().toISOString().split('T')[0],
      categoria_id: g.categoria_id || ''
    }
    gastoTieneRefBanco.value = !!g.ref_banco_id
    gastoTieneRefFlujo.value = !!g.ref_flujo_id
    gastoPropagarBanco.value = false
    gastoPropagarFlujo.value = false
    gastoSincBanco.value     = false
    gastoSincFlujo.value     = false
    showGastoModal.value     = true
  }

  function _applyFiltro(q, contar = false) {
    const f = gastoFiltro.value
    if (f.modo === 'periodo' && f.periodo_id) {
      q = q.eq('periodo_id', f.periodo_id)
    } else if (f.modo === 'mes' && f.mes) {
      const [y, m] = f.mes.split('-')
      const d1 = `${y}-${m}-01`
      const d2 = new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0]
      q = q.gte('fecha', d1).lte('fecha', d2)
    }
    // 'todo' → sin filtro de período/mes
    if (f.grupo_id) q = q.eq('grupo_id', f.grupo_id)
    return q
  }

  async function loadGastos(page = 1) {
    const sb = getSb(); if (!sb) return
    loadingGastos.value = true
    gastoPage.value = page

    const from = (page - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    let q = sb.from('gastos')
      .select('*, grupos(nombre), bancas(nombre), categorias(nombre,color), ref_banco_id, ref_flujo_id', { count: 'exact' })
      .order('fecha', { ascending: false })
      .range(from, to)
    q = _applyFiltro(q)

    const { data, count } = await q
    gastos.value      = data   || []
    gastosTotal.value = count  || 0
    loadingGastos.value = false
  }

  async function saveGasto() {
    const sb = getSb(); if (!sb) return
    if (!gastoFrm.value.concepto || !gastoFrm.value.monto) {
      toast('Completa el concepto y el monto', 'error'); return
    }
    const g = { ...gastoFrm.value }
    if (!g.grupo_id)     delete g.grupo_id
    if (!g.banca_id)     delete g.banca_id
    if (!g.periodo_id)   delete g.periodo_id
    if (!g.categoria_id) delete g.categoria_id

    let errorMsg

    if (gastoEditId.value) {
      const { error } = await sb.from('gastos').update(g).eq('id', gastoEditId.value)
      errorMsg = error?.message
      if (!errorMsg) {
        if (gastoSincBanco.value && gastoTieneRefBanco.value) {
          const { data: row } = await sb.from('gastos').select('ref_banco_id').eq('id', gastoEditId.value).single()
          if (row?.ref_banco_id) {
            const s = { concepto: g.concepto, monto: g.monto, fecha: g.fecha }
            if (g.categoria_id) s.categoria_id = g.categoria_id
            await sb.from('cuenta_banco').update(s).eq('id', row.ref_banco_id)
          }
        }
        if (gastoSincFlujo.value && gastoTieneRefFlujo.value) {
          const { data: row } = await sb.from('gastos').select('ref_flujo_id').eq('id', gastoEditId.value).single()
          if (row?.ref_flujo_id) {
            const s = { concepto: g.concepto, monto: g.monto, fecha: g.fecha }
            if (g.grupo_id)     s.grupo_id     = g.grupo_id
            if (g.periodo_id)   s.periodo_id   = g.periodo_id
            if (g.categoria_id) s.categoria_id = g.categoria_id
            await sb.from('flujo_efectivo').update(s).eq('id', row.ref_flujo_id)
          }
        }
      }
    } else {
      let bancoId = null, flujoId = null
      if (gastoPropagarBanco.value) {
        const bd = { concepto: g.concepto, monto: g.monto, fecha: g.fecha, tipo: 'egreso', origen: 'gasto' }
        if (g.grupo_id)     bd.grupo_id     = g.grupo_id
        if (g.periodo_id)   bd.periodo_id   = g.periodo_id
        if (g.categoria_id) bd.categoria_id = g.categoria_id
        const { data: b, error: be } = await sb.from('cuenta_banco').insert(bd).select('id').single()
        if (!be) bancoId = b?.id || null
      }
      if (gastoPropagarFlujo.value) {
        const fd = { concepto: g.concepto, monto: g.monto, fecha: g.fecha, tipo: 'egreso', origen: 'gasto' }
        if (g.grupo_id)     fd.grupo_id     = g.grupo_id
        if (g.periodo_id)   fd.periodo_id   = g.periodo_id
        if (g.categoria_id) fd.categoria_id = g.categoria_id
        const { data: f, error: fe } = await sb.from('flujo_efectivo').insert(fd).select('id').single()
        if (!fe) flujoId = f?.id || null
      }
      const ins = { ...g }
      if (bancoId) ins.ref_banco_id = bancoId
      if (flujoId) ins.ref_flujo_id = flujoId
      const { error } = await sb.from('gastos').insert(ins)
      errorMsg = error?.message
    }

    if (errorMsg) { toast('Error: ' + errorMsg, 'error'); return }

    let msg = gastoEditId.value ? 'Gasto actualizado ✓' : 'Gasto registrado ✓'
    if (!gastoEditId.value) {
      if (gastoPropagarBanco.value) msg += ' · también en Banco'
      if (gastoPropagarFlujo.value) msg += ' · también en Flujo'
    } else {
      if (gastoSincBanco.value && gastoTieneRefBanco.value) msg += ' · Banco sincronizado'
      if (gastoSincFlujo.value && gastoTieneRefFlujo.value) msg += ' · Flujo sincronizado'
    }
    toast(msg, 'success')
    showGastoModal.value     = false
    gastoEditId.value        = null
    gastoTieneRefBanco.value = false
    gastoTieneRefFlujo.value = false
    gastoPropagarBanco.value = false
    gastoPropagarFlujo.value = false
    gastoSincBanco.value     = false
    gastoSincFlujo.value     = false
    gastoFrm.value = { periodo_id:'', grupo_id:'', banca_id:'', tipo:'operativo', concepto:'', monto:0, fecha: new Date().toISOString().split('T')[0], categoria_id:'' }
    loadGastos(gastoPage.value)
  }

  async function deleteGasto(id) {
    const sb = getSb(); if (!sb) return
    const { data: g } = await sb.from('gastos').select('ref_banco_id, ref_flujo_id, concepto').eq('id', id).single()
    const tieneVinculos = g?.ref_banco_id || g?.ref_flujo_id
    let texto = 'Esta acción no se puede deshacer.'
    if (tieneVinculos) {
      const donde = [g.ref_banco_id && 'Banco', g.ref_flujo_id && 'Flujo de Efectivo'].filter(Boolean).join(' y ')
      texto = `⚠️ Este gasto está vinculado en ${donde}. Se eliminará también de ahí.`
    }
    if (!await confirmDialog(`¿Eliminar gasto "${g?.concepto||''}"?`, texto)) return
    if (g?.ref_banco_id) await sb.from('cuenta_banco').delete().eq('id', g.ref_banco_id)
    if (g?.ref_flujo_id) await sb.from('flujo_efectivo').delete().eq('id', g.ref_flujo_id)
    await sb.from('gastos').delete().eq('id', id)
    toast('Gasto eliminado')
    loadGastos(gastoPage.value)
  }

  function tipoGastoColor(t) {
    const m = { operativo:'blue', central:'yellow', sistema:'green', equipo:'gray', otro:'gray', participacion:'red' }
    return m[t] || 'gray'
  }

  return {
    gastos, gastosTotal, gastoPage, totalPages, PAGE_SIZE,
    loadingGastos, showGastoModal, gastoFiltro, gastoFrm, gastoEditId,
    gastoPropagarBanco, gastoPropagarFlujo, gastoSincBanco, gastoSincFlujo,
    gastoTieneRefBanco, gastoTieneRefFlujo,
    gastosXCategoria, gastosTotalMonto,
    abrirNuevoGasto, editarGasto, loadGastos, saveGasto, deleteGasto, tipoGastoColor
  }
}
