import { ref } from 'vue'
import { getSb, getSbAdmin, toast, confirmDialog } from '../store.js'

// ── Catálogo completo de vistas — incluye módulos nuevos ──
export const VISTAS_SISTEMA = [
  { vista: 'dashboard',         nombre: 'Dashboard',              icono: '📊', grupo: 'Principal' },
  { vista: 'cuadre',            nombre: 'Cuadre Semanal',         icono: '⚖️', grupo: 'Operaciones' },
  { vista: 'resumen',           nombre: 'Resumen Semanal',        icono: '📋', grupo: 'Operaciones' },
  { vista: 'importar',          nombre: 'Importar Ventas',        icono: '📥', grupo: 'Operaciones' },
  { vista: 'gastos',            nombre: 'Gastos',                 icono: '🧾', grupo: 'Operaciones' },
  { vista: 'prestamos',         nombre: 'Préstamos',              icono: '🤝', grupo: 'Operaciones' },
  { vista: 'caja_central',      nombre: 'Caja Central',           icono: '🏧', grupo: 'Operaciones' },
  { vista: 'participacion',     nombre: 'Participación',          icono: '📈', grupo: 'Análisis' },
  { vista: 'banco',             nombre: 'Banco',                  icono: '🏦', grupo: 'Análisis' },
  { vista: 'flujo',             nombre: 'Flujo de Efectivo',      icono: '💸', grupo: 'Análisis' },
  { vista: 'estado_resultados', nombre: 'Estado de Resultados',   icono: '📑', grupo: 'Análisis' },
  { vista: 'seccion_vii',       nombre: '¿A Dónde Va el Dinero?', icono: '💹', grupo: 'Análisis' },
  { vista: 'cierre_periodo',    nombre: 'Cierre de Períodos',     icono: '🔒', grupo: 'Análisis' },
  { vista: 'grupos',            nombre: 'Grupos',                 icono: '👥', grupo: 'Configuración' },
  { vista: 'bancas',            nombre: 'Bancas',                 icono: '🏪', grupo: 'Configuración' },
  { vista: 'periodos',          nombre: 'Períodos',               icono: '📅', grupo: 'Configuración' },
  { vista: 'categorias',        nombre: 'Categorías',             icono: '🏷️', grupo: 'Configuración' },
  { vista: 'usuarios',          nombre: 'Usuarios',               icono: '👤', grupo: 'Administración' },
  { vista: 'perfiles',          nombre: 'Perfiles y Permisos',    icono: '🔐', grupo: 'Administración' },
  { vista: 'config',            nombre: 'Configuración Sistema',  icono: '⚙️', grupo: 'Administración' },
  { vista: 'docs',              nombre: 'Guía de Uso',            icono: '📚', grupo: 'Administración' },
]

export function useUsuarios() {
  const usuarios     = ref([])
  const perfiles     = ref([])
  const loadingUsers = ref(false)
  const savingUser   = ref(false)
  const savingPerfil = ref(false)

  const showUserDrawer   = ref(false)  // drawer lateral
  const showPerfilDrawer = ref(false)
  const editUserId       = ref(null)
  const editPerfilId     = ref(null)

  // Pestaña activa en el drawer de usuario
  const userDrawerTab = ref('datos') // 'datos' | 'seguridad'

  const userFrm = ref({
    email: '', password: '', nombre: '', apellido: '',
    perfil_id: '', activo: true, telefono: '', notas: ''
  })
  const perfilFrm = ref({ nombre: '', descripcion: '', es_admin: false, activo: true })
  const perfilPermisos = ref({})

  // ── CARGAR ──────────────────────────────────────────────────────
  async function loadUsuarios() {
    const sb = getSb(); if (!sb) return
    loadingUsers.value = true
    const { data } = await sb
      .from('app_users')
      .select('*, app_perfiles(id, nombre, es_admin)')
      .order('nombre')
    usuarios.value = data || []
    loadingUsers.value = false
  }

  async function loadPerfiles() {
    const sb = getSb(); if (!sb) return
    const { data } = await sb
      .from('app_perfiles')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    perfiles.value = data || []
  }

  // ── ABRIR DRAWERS ────────────────────────────────────────────────
  function abrirNuevoUsuario() {
    editUserId.value = null
    userDrawerTab.value = 'datos'
    userFrm.value = {
      email: '', password: '', nombre: '', apellido: '',
      perfil_id: '', activo: true, telefono: '', notas: ''
    }
    showUserDrawer.value = true
  }

  function abrirEditarUsuario(u) {
    editUserId.value = u.id
    userDrawerTab.value = 'datos'
    userFrm.value = {
      email:     u.email      || '',
      password:  '',
      nombre:    u.nombre     || '',
      apellido:  u.apellido   || '',
      perfil_id: u.perfil_id  || '',
      activo:    u.activo,
      telefono:  u.telefono   || '',
      notas:     u.notas      || ''
    }
    showUserDrawer.value = true
  }

  // ── GUARDAR USUARIO ──────────────────────────────────────────────
  async function saveUsuario() {
    const sb = getSb(); if (!sb) return
    const f = userFrm.value
    if (!f.nombre.trim() || !f.perfil_id) {
      toast('Nombre y perfil son obligatorios', 'error'); return
    }
    savingUser.value = true

    if (!editUserId.value) {
      // ── CREAR ──
      if (!f.email.trim() || !f.password) {
        toast('Email y contraseña son obligatorios', 'error')
        savingUser.value = false; return
      }
      if (f.password.length < 6) {
        toast('La contraseña debe tener al menos 6 caracteres', 'error')
        savingUser.value = false; return
      }

      const sbAdmin = getSbAdmin()

      let authUserId = null

      if (sbAdmin) {
        // ── Ruta preferida: admin API (service role key configurada) ──
        // Crea el usuario directamente, confirmado, sin emails, sin restricciones
        const { data: adminData, error: adminErr } = await sbAdmin.auth.admin.createUser({
          email:            f.email.trim(),
          password:         f.password,
          email_confirm:    true,   // marcarlo como confirmado directamente
        })
        if (adminErr) {
          const msg = adminErr.message || ''
          if (msg.includes('already registered') || msg.includes('already exists')) {
            toast('Este email ya existe en el sistema.', 'error')
          } else {
            toast('Error al crear usuario: ' + msg, 'error')
          }
          savingUser.value = false; return
        }
        authUserId = adminData.user?.id
      } else {
        // ── Ruta alternativa: signUp normal (requiere settings de Supabase) ──
        // Funciona si: "Allow signups" ON + "Email" provider ON + "Confirm email" OFF
        const { data: authData, error: authErr } = await sb.auth.signUp({
          email:    f.email.trim(),
          password: f.password,
          options:  { emailRedirectTo: window.location.origin }
        })
        if (authErr) {
          const msg = authErr.message || ''
          if (msg.includes('not allowed') || msg.includes('disabled') || msg.includes('signup') || msg.includes('422')) {
            toast(
              'No se pudo crear el usuario. Para solucionar: ' +
              'agrega la Service Role Key en Configuración del sistema, ' +
              'o en Supabase → Auth → Sign In/Providers → activa "Allow signups" + Email provider + desactiva "Confirm email".',
              'error'
            )
          } else {
            toast('Error Auth: ' + msg, 'error')
          }
          savingUser.value = false; return
        }
        authUserId = authData?.user?.id
      }

      if (!authUserId) {
        toast('No se pudo obtener el ID del usuario creado.', 'error')
        savingUser.value = false; return
      }

      const ins = {
        id:        authUserId,
        email:     f.email.trim(),
        nombre:    f.nombre.trim(),
        apellido:  f.apellido.trim(),
        perfil_id: f.perfil_id,
        activo:    f.activo,
      }
      if (f.telefono) ins.telefono = f.telefono.trim()
      if (f.notas)    ins.notas    = f.notas.trim()

      const { error: insertErr } = await sb
        .from('app_users')
        .upsert(ins, { onConflict: 'id' })

      if (insertErr) {
        toast('Error al guardar perfil: ' + insertErr.message, 'error')
        savingUser.value = false; return
      }
      toast('✅ Usuario creado correctamente', 'success')

    } else {
      // ── EDITAR ──
      const upd = {
        nombre:    f.nombre.trim(),
        apellido:  f.apellido.trim(),
        perfil_id: f.perfil_id,
        activo:    f.activo,
      }
      if (f.telefono !== undefined) upd.telefono = f.telefono.trim()
      if (f.notas    !== undefined) upd.notas    = f.notas.trim()

      const { error: updErr } = await sb
        .from('app_users').update(upd).eq('id', editUserId.value)
      if (updErr) {
        toast('Error al actualizar: ' + updErr.message, 'error')
        savingUser.value = false; return
      }

      // Cambio de contraseña solo si se escribió algo
      if (f.password && f.password.length >= 6) {
        // Usamos updateUser del propio usuario autenticado (solo funciona si el usuario logueado es el mismo)
        // Para cambiar la clave de OTRO usuario se necesita service_role.
        // Aquí se envía reset email como alternativa honesta.
        const { error: passErr } = await sb.auth.resetPasswordForEmail(f.email, {
          redirectTo: window.location.origin + '?reset=1'
        })
        if (passErr) {
          toast('Datos actualizados. No se pudo enviar reset de clave: ' + passErr.message, 'warning')
        } else {
          toast('✅ Datos actualizados. Se envió email de reset de contraseña a ' + f.email, 'success')
        }
        savingUser.value = false
        showUserDrawer.value = false
        await loadUsuarios()
        return
      }

      toast('✅ Usuario actualizado correctamente', 'success')
    }

    savingUser.value = false
    showUserDrawer.value = false
    editUserId.value = null
    await loadUsuarios()
  }

  // ── TOGGLE ACTIVO / RESET PASS ───────────────────────────────────
  async function toggleActivo(u) {
    const sb = getSb(); if (!sb) return
    const nuevo = !u.activo
    const ok = await confirmDialog(
      `¿${nuevo ? 'Activar' : 'Desactivar'} a ${u.nombre}?`,
      nuevo ? 'El usuario podrá ingresar al sistema.' : 'El usuario no podrá iniciar sesión.',
      nuevo ? 'Sí, activar' : 'Sí, desactivar', 'question'
    )
    if (!ok) return
    const { error } = await sb.from('app_users').update({ activo: nuevo }).eq('id', u.id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast(`Usuario ${nuevo ? 'activado ✅' : 'desactivado 🔴'}`)
    await loadUsuarios()
  }

  async function resetPassword(u) {
    const sb = getSb(); if (!sb) return
    const sbAdmin = getSbAdmin()

    if (sbAdmin) {
      // ── Con service role: cambio directo sin email ──
      // Pedir la nueva contraseña al admin
      const { value: newPass } = await Swal.fire({
        title: `Cambiar contraseña de ${u.nombre || u.email}`,
        html: `<input id="swal-pass" type="password" class="swal2-input" placeholder="Nueva contraseña (mín. 6 caracteres)" autocomplete="new-password"/>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '🔐 Cambiar contraseña',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
          const val = document.getElementById('swal-pass').value
          if (!val || val.length < 6) {
            Swal.showValidationMessage('La contraseña debe tener al menos 6 caracteres')
            return false
          }
          return val
        }
      })
      if (!newPass) return

      const { error } = await sbAdmin.auth.admin.updateUserById(u.id, { password: newPass })
      if (error) { toast('Error: ' + error.message, 'error'); return }
      toast('✅ Contraseña actualizada correctamente', 'success')

    } else {
      // ── Sin service role: enviar reset email ──
      const ok = await confirmDialog(
        'Restablecer contraseña',
        `Se enviará un enlace de restablecimiento al correo: ${u.email}. ` +
        'Para cambio directo sin email, configura la Service Role Key en Configuración.',
        'Enviar enlace', 'question'
      )
      if (!ok) return
      const { error } = await sb.auth.resetPasswordForEmail(u.email, {
        redirectTo: window.location.origin
      })
      if (error) { toast('Error: ' + error.message, 'error'); return }
      toast('📧 Enlace enviado a ' + u.email)
    }
  }

  // ── PERFILES ─────────────────────────────────────────────────────
  function _initPermisosMapa() {
    const m = {}
    VISTAS_SISTEMA.forEach(v => { m[v.vista] = { puede_ver: false, puede_editar: false, puede_eliminar: false } })
    return m
  }

  async function abrirNuevoPerfil() {
    editPerfilId.value = null
    perfilFrm.value = { nombre: '', descripcion: '', es_admin: false, activo: true }
    perfilPermisos.value = _initPermisosMapa()
    showPerfilDrawer.value = true
  }

  async function abrirEditarPerfil(p) {
    const sb = getSb(); if (!sb) return
    editPerfilId.value = p.id
    perfilFrm.value = {
      nombre:      p.nombre      || '',
      descripcion: p.descripcion || '',
      es_admin:    p.es_admin,
      activo:      p.activo
    }
    const mapa = _initPermisosMapa()
    const { data: pp } = await sb
      .from('app_perfil_permisos')
      .select('*, app_permisos(vista)')
      .eq('perfil_id', p.id)
    ;(pp || []).forEach(x => {
      const vista = x.app_permisos?.vista
      if (vista && mapa[vista]) {
        mapa[vista] = {
          puede_ver:      x.puede_ver,
          puede_editar:   x.puede_editar,
          puede_eliminar: x.puede_eliminar
        }
      }
    })
    perfilPermisos.value = mapa
    showPerfilDrawer.value = true
  }

  async function savePerfil() {
    const sb = getSb(); if (!sb) return
    const f = perfilFrm.value
    if (!f.nombre.trim()) { toast('El nombre del perfil es obligatorio', 'error'); return }
    savingPerfil.value = true

    let perfilId = editPerfilId.value
    if (!perfilId) {
      const { data, error } = await sb.from('app_perfiles')
        .insert({ nombre: f.nombre.trim(), descripcion: f.descripcion.trim(), es_admin: f.es_admin, activo: f.activo })
        .select().single()
      if (error) { toast('Error al crear perfil: ' + error.message, 'error'); savingPerfil.value = false; return }
      perfilId = data.id
    } else {
      const { error } = await sb.from('app_perfiles')
        .update({ nombre: f.nombre.trim(), descripcion: f.descripcion.trim(), es_admin: f.es_admin, activo: f.activo })
        .eq('id', perfilId)
      if (error) { toast('Error al actualizar: ' + error.message, 'error'); savingPerfil.value = false; return }
    }

    // Sincronizar permisos: borrar todos y reinsertar los marcados
    await sb.from('app_perfil_permisos').delete().eq('perfil_id', perfilId)

    const { data: permisosDb } = await sb.from('app_permisos').select('id, vista')
    const rows = []
    for (const [vista, vals] of Object.entries(perfilPermisos.value)) {
      if (!vals.puede_ver) continue
      const permiso = (permisosDb || []).find(p => p.vista === vista)
      if (permiso) rows.push({
        perfil_id:      perfilId,
        permiso_id:     permiso.id,
        puede_ver:      true,
        puede_editar:   vals.puede_editar,
        puede_eliminar: vals.puede_eliminar
      })
    }
    if (rows.length) {
      const { error: rowsErr } = await sb.from('app_perfil_permisos').insert(rows)
      if (rowsErr) { toast('Error guardando permisos: ' + rowsErr.message, 'error'); savingPerfil.value = false; return }
    }

    toast(editPerfilId.value ? '✅ Perfil actualizado' : '✅ Perfil creado', 'success')
    savingPerfil.value = false
    showPerfilDrawer.value = false
    await loadPerfiles()
  }

  async function deletePerfil(p) {
    const sb = getSb(); if (!sb) return
    // Verificar si hay usuarios con este perfil
    const { data: ucon } = await sb.from('app_users').select('id').eq('perfil_id', p.id).limit(1)
    if (ucon?.length) {
      toast('No se puede eliminar: hay usuarios asignados a este perfil.', 'error'); return
    }
    const ok = await confirmDialog(
      `¿Eliminar perfil "${p.nombre}"?`,
      'Se eliminarán todos los permisos asociados. Esta acción no se puede deshacer.'
    )
    if (!ok) return
    await sb.from('app_perfil_permisos').delete().eq('perfil_id', p.id)
    await sb.from('app_perfiles').delete().eq('id', p.id)
    toast('Perfil eliminado')
    await loadPerfiles()
  }

  // ── HELPERS PERMISOS ─────────────────────────────────────────────
  function togglePermiso(vista, campo) {
    if (!perfilPermisos.value[vista]) return
    const actual = perfilPermisos.value[vista][campo]
    perfilPermisos.value[vista][campo] = !actual
    if ((campo === 'puede_editar' || campo === 'puede_eliminar') && !actual) {
      perfilPermisos.value[vista].puede_ver = true
    }
    if (campo === 'puede_ver' && actual) {
      perfilPermisos.value[vista].puede_editar   = false
      perfilPermisos.value[vista].puede_eliminar = false
    }
  }

  function toggleGrupo(grupo, campo, valor) {
    VISTAS_SISTEMA.filter(v => v.grupo === grupo).forEach(v => {
      if (!perfilPermisos.value[v.vista]) return
      perfilPermisos.value[v.vista][campo] = valor
      if (campo === 'puede_ver' && !valor) {
        perfilPermisos.value[v.vista].puede_editar   = false
        perfilPermisos.value[v.vista].puede_eliminar = false
      }
      if ((campo === 'puede_editar' || campo === 'puede_eliminar') && valor) {
        perfilPermisos.value[v.vista].puede_ver = true
      }
    })
  }

  function selectAllPermisos(valor) {
    Object.keys(perfilPermisos.value).forEach(vista => {
      perfilPermisos.value[vista].puede_ver      = valor
      perfilPermisos.value[vista].puede_editar   = valor
      perfilPermisos.value[vista].puede_eliminar = valor
    })
  }

  return {
    usuarios, perfiles, loadingUsers, savingUser, savingPerfil,
    showUserDrawer, showPerfilDrawer,
    editUserId, editPerfilId, userDrawerTab,
    userFrm, perfilFrm, perfilPermisos,
    loadUsuarios, loadPerfiles,
    abrirNuevoUsuario, abrirEditarUsuario, saveUsuario,
    toggleActivo, resetPassword,
    abrirNuevoPerfil, abrirEditarPerfil, savePerfil, deletePerfil,
    togglePermiso, toggleGrupo, selectAllPermisos,
  }
}
