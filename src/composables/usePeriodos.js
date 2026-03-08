import { ref, computed, watch } from 'vue'
import { confirmDialog, getSb, periodos, selectedPeriodoId, toast } from '../store.js'

export function usePeriodos() {
  const loadingPeriodos = ref(false);

  const showPeriodoModal = ref(false);

  const editPeriodo = ref({});

  async function loadPeriodos() {
    const sb = getSb()
    if (!sb) return
    if (!sb) return;
    loadingPeriodos.value = true;
    const { data } = await sb.from('periodos').select('*').order('fecha_inicio', { ascending: false });
    periodos.value = data || [];
    if (!selectedPeriodoId.value && periodos.value.length) selectedPeriodoId.value = periodos.value[0].id;
    loadingPeriodos.value = false;
  }

  function editarPeriodo(p) { editPeriodo.value = {...p}; showPeriodoModal.value = true; }

  async function savePeriodo() {
    const sb = getSb()
    if (!sb) return
    if (!sb) { toast('Configura Supabase primero','error'); return; }
    const p = editPeriodo.value;
    if (!p.descripcion) p.descripcion = `Semana ${p.fecha_inicio} al ${p.fecha_fin}`;
    const { error } = p.id
      ? await sb.from('periodos').update(p).eq('id', p.id)
      : await sb.from('periodos').insert(p);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast('Período guardado', 'success');
    showPeriodoModal.value = false;
    loadPeriodos();
  }

  async function deletePeriodo(id) {
    const sb = getSb()
    if (!sb) return
    if (!await confirmDialog('¿Eliminar período?', 'Se eliminarán todos los cuadres y ventas del período.')) return;
    await sb.from('periodos').delete().eq('id', id);
    loadPeriodos();
  }

  return { loadingPeriodos, showPeriodoModal, editPeriodo, loadPeriodos, editarPeriodo, savePeriodo, deletePeriodo }
}
