import { ref, computed, watch } from 'vue'
import { bancas, confirmDialog, getSb, toast } from '../store.js'

export function useBancas() {
  const loadingBancas = ref(false);

  const showBancaModal = ref(false);

  const editBanca = ref({});

  const bancaFiltroGrupo = ref('');

  const bancasFiltradas = computed(() =>
    bancaFiltroGrupo.value ? bancas.value.filter(b=>b.grupo_id===bancaFiltroGrupo.value) : bancas.value
  );

  async function loadBancas() {
    const sb = getSb()
    if (!sb) return
    if (!sb) return;
    loadingBancas.value = true;
    const { data } = await sb.from('bancas').select('*').order('codigo');
    bancas.value = data || [];
    loadingBancas.value = false;
  }

  function editarBanca(b) { editBanca.value = {...b}; showBancaModal.value = true; }

  async function saveBanca() {
    const sb = getSb()
    if (!sb) return
    if (!sb) { toast('Configura Supabase primero','error'); return; }
    const b = {...editBanca.value};
    if (b.activo === undefined) b.activo = true;
    const { error } = b.id
      ? await sb.from('bancas').update(b).eq('id', b.id)
      : await sb.from('bancas').insert(b);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast('Banca guardada', 'success');
    showBancaModal.value = false;
    loadBancas();
  }

  async function deleteBanca(id) {
    const sb = getSb()
    if (!sb) return
    if (!await confirmDialog('¿Eliminar banca?', 'Se perderán todos los datos de esta banca.')) return;
    await sb.from('bancas').delete().eq('id', id);
    loadBancas();
  }

  return { loadingBancas, showBancaModal, editBanca, bancaFiltroGrupo, bancasFiltradas, loadBancas, editarBanca, saveBanca, deleteBanca }
}
