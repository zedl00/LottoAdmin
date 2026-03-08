import { ref, computed, watch } from 'vue'
import { bancas, confirmDialog, getSb, periodos, toast } from '../store.js'

export function useImportar() {
  const importPeriodoId = ref('');

  const importPreview = ref([]);

  const importando = ref(false);

  const importDuplicado = ref(false);

  const importDuplicadoCount = ref(0);

  const importPeriodoTieneData = ref(false);

  const manualVenta = ref({ periodo_id:'', banca_id:'', ventas:0, premios:0 });

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = ev => {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        importPreview.value = rows.map(mapRow).filter(r => r !== null);
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete(results) {
          importPreview.value = results.data.map(mapRow).filter(r => r !== null);
        }
      });
    }
  }

  async function processImport() {
    const sb = getSb()
    if (!sb) return
    if (!sb || !importPeriodoId.value || !importPreview.value.length) return;
    const filas = importPreview.value.filter(r => r._banca && r._incluir);
    if (!filas.length) { toast('No hay filas válidas para importar', 'error'); return; }
    importando.value = true;
    let ok = 0; let err = 0;
    for (const row of filas) {
      const { error } = await sb.from('ventas_semana').upsert({
        banca_id:   row._banca.id,
        periodo_id: importPeriodoId.value,
        grupo_id:   row._banca.grupo_id || null,
        ventas:     row.ventas,
        premios:    row.premios,
      }, { onConflict: 'banca_id,periodo_id' });
      if (error) err++;
      else ok++;
    }
    importando.value = false;
    const noMapeadas = importPreview.value.filter(r=>!r._banca).length;
    toast(`✅ ${ok} bancas importadas${err?` | ⚠️ ${err} errores`:''}${noMapeadas?` | ℹ️ ${noMapeadas} sin mapear`:''}`, ok>0?'success':'error');
    if (ok > 0) {
      importPreview.value = [];
      await checkImportDuplicado();
    }
  }

  async function saveManualVenta() {
    const sb = getSb()
    if (!sb) return
    if (!sb) return;
    const b = bancas.value.find(b=>b.id===manualVenta.value.banca_id);
    const { error } = await sb.from('ventas_semana').upsert({
      banca_id:   manualVenta.value.banca_id,
      periodo_id: manualVenta.value.periodo_id,
      grupo_id:   b?.grupo_id || null,
      ventas:     manualVenta.value.ventas,
      premios:    manualVenta.value.premios,
    }, { onConflict: 'banca_id,periodo_id' });
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast('Venta guardada', 'success');
    manualVenta.value = { periodo_id:'', banca_id:'', ventas:0, premios:0 };
  }

  async function checkImportDuplicado() {
    const sb = getSb()
    if (!sb) return
    importDuplicado.value = false;
    importPeriodoTieneData.value = false;
    importDuplicadoCount.value = 0;
    importPreview.value = [];
    if (!sb || !importPeriodoId.value) return;
    const { count } = await sb.from('ventas_semana')
      .select('id', { count: 'exact', head: true })
      .eq('periodo_id', importPeriodoId.value);
    if (count > 0) {
      importDuplicado.value = true;
      importPeriodoTieneData.value = true;
      importDuplicadoCount.value = count;
    }
  }

  async function borrarImportacion() {
    const sb = getSb()
    if (!sb) return
    if (!sb || !importPeriodoId.value) return;
    const periodo = periodos.value.find(p=>p.id===importPeriodoId.value);
    const ok = await confirmDialog(
      '¿Borrar datos de este período?',
      `Se eliminarán TODOS los registros de ventas del período "${periodo?.descripcion||periodo?.fecha_inicio}". Esta acción no se puede deshacer.`,
      '🗑️ Sí, borrar', 'warning'
    );
    if (!ok) return;
    const { error } = await sb.from('ventas_semana').delete().eq('periodo_id', importPeriodoId.value);
    if (error) { toast('Error al borrar: ' + error.message, 'error'); return; }
    toast('Datos del período eliminados ✓', 'success');
    importDuplicado.value = false;
    importPeriodoTieneData.value = false;
    importDuplicadoCount.value = 0;
  }

  return { importPeriodoId, importPreview, importando, importDuplicado, importDuplicadoCount, importPeriodoTieneData, manualVenta, handleFile, processImport, saveManualVenta, checkImportDuplicado, borrarImportacion }
}
