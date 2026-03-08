import { ref, computed, watch, reactive } from 'vue'
import { bancas, getSb, grupos, periodos } from '../store.js'

export function useParticipacion() {
  const participacion = ref([]);

  const participacionAgrupada = computed(() => {
    const map = {};
    for (const p of participacion.value) {
      const key = (p.grupo_id || '') + '|' + (p.periodo_id || '');
      const grupoModo = grupos.value.find(g=>g.id===p.grupo_id)?.modo || 'estandar';
      if (grupoModo === 'individual_bancas') {
        // Grupo Capital — siempre agrupar en una sola fila resumen
        if (!map[key]) {
          map[key] = {
            _key: key, grupo_id: p.grupo_id, periodo_id: p.periodo_id,
            grupos: p.grupos, periodos: p.periodos, bancas: null,
            esGrupoAgrupado: true,
            beneficio_semana: 0, arrastre_anterior: 0, balance_participacion: 0,
            porcentaje: 0, monto_a_pagar: 0, pagado: 0, arrastre_siguiente: 0,
            _bancas: []
          };
        }
        map[key].beneficio_semana      += p.beneficio_semana || 0;
        map[key].arrastre_anterior     += p.arrastre_anterior || 0;
        map[key].balance_participacion += p.balance_participacion || 0;
        map[key].monto_a_pagar         += p.monto_a_pagar || 0;
        map[key].pagado                += p.pagado || 0;
        map[key].arrastre_siguiente    += p.arrastre_siguiente || 0;
        // Agregar al drilldown si tiene banca identificada
        if (p.banca_id) map[key]._bancas.push(p);
        // Guardar grupo_id para fallback de bancas desde bancas.value
        map[key]._grupoId = p.grupo_id;
      } else {
        // Grupo estándar — mostrar directo sin agrupación
        map[key] = { ...p, esGrupoAgrupado: false, _bancas: [] };
      }
    }
    return Object.values(map).sort((a,b) => {
      const na = a.grupos?.nombre || '';
      const nb = b.grupos?.nombre || '';
      return na.localeCompare(nb) || (b.periodo_id||'').localeCompare(a.periodo_id||'');
    });
  });

  const loadingPart = ref(false);

  const partFiltro = ref({ grupo_id: '', periodo_id: '' });

  const partExpandido = reactive({});

  async function loadParticipacion() {
    const sb = getSb()
    if (!sb) return
    if (!sb) return;
    loadingPart.value = true;
    let q = sb.from('participacion_acumulada')
      .select('*, grupos(nombre), periodos(descripcion, fecha_inicio), bancas(codigo, nombre)')
      .order('created_at', { ascending: false });
    if (partFiltro.value.grupo_id)  q = q.eq('grupo_id',  partFiltro.value.grupo_id);
    if (partFiltro.value.periodo_id) q = q.eq('periodo_id', partFiltro.value.periodo_id);
    const { data } = await q;
    participacion.value = data || [];
    loadingPart.value = false;
  }

  return { participacion, participacionAgrupada, loadingPart, partFiltro, partExpandido, loadParticipacion }
}
