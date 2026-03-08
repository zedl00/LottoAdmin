// ═══════════════════════════════════════════════════════════════
// store.js — Estado global compartido entre todos los composables
// Importar desde aquí en lugar de recibir como parámetro
// ═══════════════════════════════════════════════════════════════
import { ref, computed, watch } from 'vue'
import { createClient } from '@supabase/supabase-js'

// ── Supabase (singletons) ──
let _sb      = null   // cliente anon/usuario (para todo lo normal)
let _sbAdmin = null   // cliente service_role (solo para crear/editar usuarios en Auth)

export const config = ref({ supabaseUrl: '', supabaseKey: '', serviceRoleKey: '' })
export const supabaseConfigured = ref(false)

export function initSupabase() {
  const url     = config.value.supabaseUrl
  const key     = config.value.supabaseKey
  const svcKey  = config.value.serviceRoleKey
  if (url && key) {
    _sb = createClient(url, key)
    supabaseConfigured.value = true
  }
  // Cliente admin — solo se crea si se proveyó la service role key
  if (url && svcKey) {
    _sbAdmin = createClient(url, svcKey, {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
        storageKey:       'lotto_admin_session',  // clave distinta para no chocar con el cliente normal
        detectSessionInUrl: false,
      }
    })
  } else {
    _sbAdmin = null
  }
}
export function getSb()      { return _sb }
export function getSbAdmin() { return _sbAdmin }

// ── UI state ──
export const view = ref('dashboard')
export const themeMode = ref(localStorage.getItem('themeMode') || 'auto')
export const toasts = ref([])

// ── Períodos / Grupos / Bancas / Categorías (shared read) ──
export const periodos = ref([])
export const selectedPeriodoId = ref(null)
export const activePeriodo = computed(() => periodos.value.find(p => p.activo) || periodos.value[0] || null)
export const grupos = ref([])
export const bancas = ref([])
export const categorias = ref([])

// ══════════════════════════════════════════════════════
// AUTH — Usuario actual y control de acceso
// ══════════════════════════════════════════════════════
export const currentUser   = ref(null)   // { id, email, nombre, apellido, perfil_id }
export const userPerfil    = ref(null)   // { id, nombre, es_admin }
export const userPermisos  = ref(new Set()) // Set de vistas que puede VER
export const userPermsMap  = ref({})        // { vista: { puede_ver, puede_editar, puede_eliminar } }
export const authReady     = ref(false)

/** Puede ver una vista */
export function canView(vista) {
  if (!currentUser.value) return false
  if (userPerfil.value?.es_admin) return true
  return userPermisos.value.has(vista)
}

/** Puede editar en una vista */
export function canEdit(vista) {
  if (!currentUser.value) return false
  if (userPerfil.value?.es_admin) return true
  return !!userPermsMap.value[vista]?.puede_editar
}

/** Puede eliminar en una vista */
export function canDelete(vista) {
  if (!currentUser.value) return false
  if (userPerfil.value?.es_admin) return true
  return !!userPermsMap.value[vista]?.puede_eliminar
}

/** Limpia sesión local (authReady lo maneja quien llama) */
export function clearSession() {
  currentUser.value  = null
  userPerfil.value   = null
  userPermisos.value = new Set()
  userPermsMap.value = {}
}

// ── Utilidades ──
export function fmt(n) {
  if (n === null || n === undefined) return '$0';
  const v = Number(n) || 0;
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function pct(a, b) { return b ? ((a/b)*100).toFixed(1) + '%' : '0%'; }

export function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex||'#5a6a80');
  return r ? parseInt(r[1],16)+','+parseInt(r[2],16)+','+parseInt(r[3],16) : '90,106,128';
}


// ── isDark (depende de themeMode) ──
export const isDark = computed(() => {
  if (themeMode.value === 'dark') return true;
  if (themeMode.value === 'light') return false;
  return new Date().getHours() >= 19 || new Date().getHours() < 7;
});


export function applyTheme() {
  const dark = isDark.value;
  const d = document.documentElement;
  const s = (k,v) => d.style.setProperty(k, v);

  // ── Fondos y superficies ──
  s('--bg',        dark ? '#0d1117'  : '#f0f2f5');   // dark: GitHub-dark / light: gris muy suave
  s('--surface',   dark ? '#161b22'  : '#ffffff');   // cards
  s('--surface2',  dark ? '#1c2331'  : '#f8f9fb');   // surface secundaria
  s('--border',    dark ? '#21262d'  : '#dde1e7');   // bordes sutiles
  s('--border2',   dark ? '#30363d'  : '#c1c7d0');   // bordes secundarios

  // ── Texto — mejorado para legibilidad ──
  s('--text',      dark ? '#e6edf3'  : '#1a2332');   // dark: casi blanco / light: azul oscuro
  s('--muted',     dark ? '#7d8590'  : '#5a6474');   // dark: gris medio visible / light: gris azulado

  // ── Colores funcionales ──
  s('--accent',    dark ? '#3fb950'  : '#2563eb');   // dark: verde GitHub / light: azul moderno
  s('--accent2',   dark ? '#2ea043'  : '#1d4ed8');
  s('--red',       dark ? '#f85149'  : '#dc2626');
  s('--yellow',    dark ? '#e3b341'  : '#d97706');
  s('--blue',      dark ? '#58a6ff'  : '#2563eb');

  // ── Glow y sombras ──
  s('--card-glow', dark
    ? '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(33,38,45,0.8)'
    : '0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(221,225,231,0.6)');

  // ── Input ──
  s('--input-bg',     dark ? '#0d1117' : '#ffffff');
  s('--input-text',   dark ? '#e6edf3' : '#1a2332');
  s('--input-border', dark ? '#30363d' : '#c1c7d0');

  // ── Fuentes — Inter + JetBrains Mono ──
  s('--font-h', "'Inter', -apple-system, sans-serif");
  s('--font-n', "'Inter', -apple-system, sans-serif");
  s('--font-mono', "'JetBrains Mono', 'Fira Code', monospace");

  d.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function toggleTheme() {
  const modes = ['auto','dark','light'];
  themeMode.value = modes[(modes.indexOf(themeMode.value)+1) % 3];
  localStorage.setItem('themeMode', themeMode.value);
  applyTheme();
}


// ── Toast / Confirm ──
export function toast(msg, type='success') {
  const icons = { success:'success', error:'error', warning:'warning', info:'info' };
  // Detectar si es un mensaje de guardado/edición para fuente más pequeña
  const isSaveMsg = /guard|edit|actualiz|registr|guarda|eliminad|borrad/i.test(msg);
  Swal.fire({
    toast: true, position: 'bottom-end',
    icon: icons[type] || 'info', title: msg,
    showConfirmButton: false,
    timer: isSaveMsg ? 1600 : 2200,
    timerProgressBar: true,
    customClass: isSaveMsg ? { title: 'swal-title-sm' } : {},
    didOpen: (t) => { t.addEventListener('mouseenter', Swal.stopTimer); t.addEventListener('mouseleave', Swal.resumeTimer); }
  });
}

export async function confirmDialog(title, text='Esta acción no se puede deshacer.', confirmText='Sí, eliminar', icon='warning') {
  const result = await Swal.fire({
    title, text, icon,
    showCancelButton: true,
    confirmButtonColor: '#e74c3c', cancelButtonColor: '#555',
    confirmButtonText: confirmText, cancelButtonText: 'Cancelar'
  });
  return result.isConfirmed;
}


// ── Watch theme ──
watch(isDark, applyTheme)
