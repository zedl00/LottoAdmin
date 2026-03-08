import { ref } from 'vue'
import { getSb, currentUser, userPerfil, userPermisos, authReady, clearSession, toast } from '../store.js'

export function useAuth() {

  const authLoading    = ref(false)
  const authError      = ref('')
  const sessionStart   = ref(null)   // timestamp del login actual

  async function loadUserSession(supabaseUser) {
    const sb = getSb()
    if (!sb || !supabaseUser) return false

    // Intentar cargar el registro en app_users
    const { data: appUser, error: userErr } = await sb
      .from('app_users')
      .select('*, app_perfiles(id, nombre, descripcion, es_admin, activo)')
      .eq('id', supabaseUser.id)
      .single()

    // Si no existe en app_users (aún no registrado en la tabla)
    if (userErr || !appUser) {
      authError.value = 'Tu usuario no tiene acceso configurado en el sistema. Contacta al administrador para completar el registro.'
      authReady.value = true
      return false
    }

    // Si existe pero está desactivado
    if (!appUser.activo) {
      authError.value = 'Tu cuenta está desactivada. Contacta al administrador.'
      authReady.value = true
      return false
    }

    // Si el perfil está desactivado
    if (appUser.app_perfiles && !appUser.app_perfiles.activo) {
      authError.value = 'El perfil asignado a tu cuenta está desactivado. Contacta al administrador.'
      authReady.value = true
      return false
    }

    sessionStart.value = Date.now()
    currentUser.value = {
      id:           appUser.id,
      email:        appUser.email,
      nombre:       appUser.nombre,
      apellido:     appUser.apellido,
      perfil_id:    appUser.perfil_id,
      ultimo_login: appUser.ultimo_login,
    }
    userPerfil.value = appUser.app_perfiles

    // Registrar ultimo_login — awaited para que la policy RLS esté activa con el JWT correcto
    const { error: loginErr } = await sb
      .from('app_users')
      .update({ ultimo_login: new Date().toISOString() })
      .eq('id', appUser.id)
    if (loginErr) console.warn('ultimo_login update failed:', loginErr.message)

    if (appUser.app_perfiles?.es_admin) {
      userPermisos.value = new Set(['*'])
      authReady.value = true
      return true
    }

    const { data: permisos } = await sb
      .from('app_perfil_permisos')
      .select('app_permisos(vista)')
      .eq('perfil_id', appUser.perfil_id)
      .eq('puede_ver', true)

    userPermisos.value = new Set(
      (permisos || []).map(p => p.app_permisos?.vista).filter(Boolean)
    )
    authReady.value = true
    return true
  }

  async function initAuth() {
    const sb = getSb()
    if (!sb) { authReady.value = true; return }

    authLoading.value = true
    try {
      const { data: { session } } = await sb.auth.getSession()
      if (session?.user) {
        const ok = await loadUserSession(session.user)
        // Si falla (usuario no en app_users), hacer signOut silencioso para limpiar sesión de Supabase
        if (!ok) {
          await sb.auth.signOut()
          clearSession()
          authReady.value = true
        }
      } else {
        authReady.value = true
      }
    } catch (e) {
      console.error('initAuth error:', e)
      authReady.value = true
    }
    authLoading.value = false
  }

  async function login(email, password) {
    const sb = getSb()
    if (!sb) { authError.value = 'Sistema no configurado'; return false }

    authLoading.value = true
    authError.value   = ''
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message?.includes('Invalid login')) authError.value = 'Email o contraseña incorrectos'
        else authError.value = error.message || 'Error al iniciar sesión'
        return false
      }
      const ok = await loadUserSession(data.user)
      if (!ok) {
        // Ya tiene el mensaje en authError, hacer signOut para que pueda reintentar
        await sb.auth.signOut()
      }
      return ok
    } catch (e) {
      authError.value = 'Error de conexión. Verifica tu internet.'
      return false
    } finally {
      authLoading.value = false
    }
  }

  async function logout() {
    const sb = getSb()
    if (sb) await sb.auth.signOut()
    clearSession()
    authError.value   = ''
    authReady.value   = true
    sessionStart.value = null
  }

  return { authLoading, authError, sessionStart, initAuth, login, logout, loadUserSession }
}
