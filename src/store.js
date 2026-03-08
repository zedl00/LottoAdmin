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
export const userPermisos  = ref(new Set()) // Set de vistas permitidas: 'dashboard','cuadre'...
export const authReady     = ref(false)  // true cuando ya se verificó la sesión

/** Devuelve true si el usuario puede ver una vista */
export function canView(vista) {
  if (!currentUser.value) return false
  if (userPerfil.value?.es_admin) return true
  return userPermisos.value.has(vista)
}

/** Limpia sesión local (authReady lo maneja quien llama) */
export function clearSession() {
  currentUser.value  = null
  userPerfil.value   = null
  userPermisos.value = new Set()
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
  s('--bg',        dark ? '#0a0d12'  : '#eef2f8');
  s('--surface',   dark ? '#111620'  : '#ffffff');
  s('--surface2',  dark ? '#161d2b'  : '#f4f7fb');
  s('--border',    dark ? '#1e2a3a'  : '#c5d1e8');
  s('--border2',   dark ? '#253347'  : '#a8b9d0');

  // ── Texto ──
  s('--text',      dark ? '#e8edf5'  : '#0f1f3d');
  s('--muted',     dark ? '#5a6a80'  : '#4a5e7a');

  // ── Colores funcionales — Royal Blue en claro ──
  s('--accent',    dark ? '#00e5a0'  : '#3b7dd8');   // verde neón / Azul medio suave
  s('--accent2',   dark ? '#00b87a'  : '#2563c0');   // verde2  / azul profundo
  s('--red',       dark ? '#ff4d6d'  : '#c0152d');   // rojo neón / rojo sólido
  s('--yellow',    dark ? '#ffd166'  : '#b45309');   // amarillo / ámbar oscuro
  s('--blue',      dark ? '#4cc9f0'  : '#1e7bb8');   // celeste neón / azul cielo

  // ── Glow y sombras ──
  s('--card-glow', dark
    ? '0 0 30px rgba(0,229,160,0.04)'
    : '0 2px 12px rgba(26,86,219,0.07)');

  // ── Input (siempre amarillo identificador) ──
  s('--input-bg',     '#FDFFEF');
  s('--input-text',   '#0f1f3d');
  s('--input-border', dark ? '#2a3f55' : '#c8d2a0');

  // ── Tags y badges con accent actual ──
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
