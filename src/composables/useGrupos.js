import { ref, computed, watch } from 'vue'
import { bancas, confirmDialog, getSb, grupos, toast } from '../store.js'

export function useGrupos() {
  const loadingGrupos = ref(false);

  const showGrupoModal = ref(false);

  const editGrupo = ref({});

  async function loadGrupos() {
    const sb = getSb()
    if (!sb) return
    if (!sb) return;
    loadingGrupos.value = true;
    const { data } = await sb.from('grupos').select('*').order('nombre');
    grupos.value = data || [];
    loadingGrupos.value = false;
  }

  function editarGrupo(g) { editGrupo.value = {...g}; showGrupoModal.value = true; }

  async function saveGrupo() {
    const sb = getSb()
    if (!sb) return
    if (!sb) { toast('Configura Supabase primero','error'); return; }
    const g = {...editGrupo.value};
    if (!g.balance_inicial) g.balance_inicial = 0;
    if (!g.arrastre_part_inicial) g.arrastre_part_inicial = 0;
    if (g.activo === undefined) g.activo = true;
    if (!g.modo) g.modo = 'estandar';
    const { error } = g.id
      ? await sb.from('grupos').update(g).eq('id', g.id)
      : await sb.from('grupos').insert(g);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast('Grupo guardado', 'success');
    showGrupoModal.value = false;
    loadGrupos();
  }

  async function deleteGrupo(id) {
    const sb = getSb()
    if (!sb) return
    if (!await confirmDialog('¿Eliminar grupo?', 'Se perderán todas las bancas asociadas.')) return;
    await sb.from('grupos').delete().eq('id', id);
    loadGrupos();
  }

  return { loadingGrupos, showGrupoModal, editGrupo, loadGrupos, editarGrupo, saveGrupo, deleteGrupo }
}
