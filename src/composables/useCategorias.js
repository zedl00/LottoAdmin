import { ref, computed, watch } from 'vue'
import { categorias, confirmDialog, getSb, toast } from '../store.js'

export function useCategorias() {
  const showCategoriaModal = ref(false);

  const editCategoria = ref({});

  async function loadCategorias() {
    const sb = getSb()
    if (!sb) return
    if (!sb) return;
    const { data } = await sb.from('categorias').select('*').order('tipo').order('orden');
    categorias.value = data || [];
  }

  function editarCategoria(c) { editCategoria.value = {...c}; showCategoriaModal.value = true; }

  async function saveCategoria() {
    const sb = getSb()
    if (!sb) return
    if (!sb) return;
    const c = {...editCategoria.value};
    if (c.activo === undefined) c.activo = true;
    const { error } = c.id
      ? await sb.from('categorias').update(c).eq('id', c.id)
      : await sb.from('categorias').insert(c);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast('Categoría guardada', 'success');
    showCategoriaModal.value = false;
    loadCategorias();
  }

  async function deleteCategoria(id) {
    const sb = getSb()
    if (!sb) return
    if (!await confirmDialog('¿Eliminar categoría?', 'Esta acción no se puede deshacer.')) return;
    await sb.from('categorias').delete().eq('id', id);
    loadCategorias();
  }

  function categoriaTipo(id) {
    // Esta función ya no modifica gastoFrm.tipo — el tipo del gasto
    // es independiente del tipo de la categoría ('egreso'/'ingreso')
    const c = categorias.value.find(c=>c.id===id);
    return c?.tipo || 'egreso'; // solo para uso interno de categorias, no para gastos.tipo
  }

  return { showCategoriaModal, editCategoria, loadCategorias, editarCategoria, saveCategoria, deleteCategoria, categoriaTipo }
}
