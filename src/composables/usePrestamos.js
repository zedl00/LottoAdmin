import { ref, computed, watch } from 'vue'
import { bancas, confirmDialog, getSb, grupos, periodos, toast } from '../store.js'

export function usePrestamos() {
  const prestamos = ref([]);

  const loadingPrest = ref(false);

  const showPrestamoModal = ref(false);

  const prestFiltro = ref({ grupo_id: '', periodo_id: '' });

  const prestFrm = ref({ grupo_id:'', banca_id:'', periodo_id:'', tipo:'salida', monto:0, concepto:'', fecha: new Date().toISOString().split('T')[0] });

  const prestEditId = ref(null);

  const prestamosResumen = computed(() => {
    const map = {};
    grupos.value.forEach(g => { map[g.id] = { grupo_id: g.id, nombre: g.nombre, salidas: 0, entradas: 0 }; });
    prestamos.value.forEach(p => {
      if (!map[p.grupo_id]) return;
      if (p.tipo === 'salida') map[p.grupo_id].salidas += p.monto;
      else map[p.grupo_id].entradas += p.monto;
    });
    return Object.values(map).filter(g=>g.salidas>0||g.entradas>0).map(g=>({...g, saldo: g.salidas - g.entradas}));
  });

  function abrirNuevoPrestamo() {
    prestEditId.value = null;
    prestFrm.value = { grupo_id:'', periodo_id:'', tipo:'salida', monto:0, concepto:'', fecha: new Date().toISOString().split('T')[0] };
    showPrestamoModal.value = true;
  }

  function editarPrestamo(p) {
    prestEditId.value = p.id;
    prestFrm.value = {
      grupo_id: p.grupo_id||'', periodo_id: p.periodo_id||'',
      tipo: p.tipo||'salida', monto: p.monto||0,
      concepto: p.concepto||'', fecha: p.fecha||new Date().toISOString().split('T')[0]
    };
    showPrestamoModal.value = true;
  }

  async function loadPrestamos() {
    const sb = getSb()
    if (!sb) return
    if (!sb) return;
    loadingPrest.value = true;
    let q = sb.from('prestamos').select('*, grupos(nombre), periodos(descripcion, fecha_inicio), bancas(codigo, nombre)').order('fecha', { ascending: false });
    if (prestFiltro.value.grupo_id)  q = q.eq('grupo_id',  prestFiltro.value.grupo_id);
    if (prestFiltro.value.periodo_id) q = q.eq('periodo_id', prestFiltro.value.periodo_id);
    const { data } = await q;
    prestamos.value = data || [];
    loadingPrest.value = false;
  }

  async function savePrestamo() {
    const sb = getSb()
    if (!sb) return
    if (!sb) return;
    const p = {...prestFrm.value};
    if (!p.periodo_id) delete p.periodo_id;
    let error;
    if (prestEditId.value) {
      ({ error } = await sb.from('prestamos').update(p).eq('id', prestEditId.value));
    } else {
      ({ error } = await sb.from('prestamos').insert(p));
    }
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast(prestEditId.value ? 'Movimiento actualizado ✓' : 'Movimiento registrado ✓', 'success');
    showPrestamoModal.value = false;
    prestEditId.value = null;
    prestFrm.value = { grupo_id:'', banca_id:'', periodo_id:'', tipo:'salida', monto:0, concepto:'', fecha: new Date().toISOString().split('T')[0] };
    loadPrestamos();
  }

  async function deletePrestamo(id) {
    const sb = getSb()
    if (!sb) return
    if (!await confirmDialog('¿Eliminar movimiento?', 'Esta acción no se puede deshacer.')) return;
    await sb.from('prestamos').delete().eq('id', id);
    loadPrestamos();
  }

  return { prestamos, loadingPrest, showPrestamoModal, prestFiltro, prestFrm, prestEditId, prestamosResumen, abrirNuevoPrestamo, editarPrestamo, loadPrestamos, savePrestamo, deletePrestamo }
}
