<script setup>
import { ref, reactive, nextTick, onMounted, watch } from 'vue'
import {
  view, themeMode, toasts, fmt, pct, hexToRgb, toggleTheme, applyTheme, isDark,
  config, supabaseConfigured, initSupabase, getSb,
  periodos, selectedPeriodoId, activePeriodo,
  grupos, bancas, categorias,
  currentUser, userPerfil, authReady, canView
} from './store.js'

import { useCategorias }        from './composables/useCategorias.js'
import { usePeriodos }           from './composables/usePeriodos.js'
import { useGrupos }             from './composables/useGrupos.js'
import { useBancas }             from './composables/useBancas.js'
import { useDashboard }          from './composables/useDashboard.js'
import { useResumen }            from './composables/useResumen.js'
import { useCuadre }             from './composables/useCuadre.js'
import { useImportar }           from './composables/useImportar.js'
import { useGastos }             from './composables/useGastos.js'
import { usePrestamos }          from './composables/usePrestamos.js'
import { useParticipacion }      from './composables/useParticipacion.js'
import { useBanco }              from './composables/useBanco.js'
import { useFlujo }              from './composables/useFlujo.js'
import { useEstadoResultados }   from './composables/useEstadoResultados.js'
import { useAuth }               from './composables/useAuth.js'
import { useCajaCentral }       from './composables/useCajaCentral.js'
import { useCierre }            from './composables/useCierre.js'
import { useUsuarios, VISTAS_SISTEMA } from './composables/useUsuarios.js'

// ── Config helpers ──
function saveConfig() {
  localStorage.setItem('lotto_config', JSON.stringify(config.value))
  initSupabase()
}
function loadConfig() {
  const saved = localStorage.getItem('lotto_config')
  if (saved) {
    const parsed = JSON.parse(saved)
    // Merge para no perder campos nuevos que no estaban en versiones anteriores
    config.value = {
      supabaseUrl:     parsed.supabaseUrl     || '',
      supabaseKey:     parsed.supabaseKey     || '',
      serviceRoleKey:  parsed.serviceRoleKey  || '',
    }
    initSupabase()
  }
}

// ── Composables ──
const { showCategoriaModal, editCategoria, loadCategorias, editarCategoria, saveCategoria, deleteCategoria, categoriaTipo } = useCategorias()
const { loadingPeriodos, showPeriodoModal, editPeriodo, loadPeriodos, editarPeriodo, savePeriodo, deletePeriodo } = usePeriodos()
const { loadingGrupos, showGrupoModal, editGrupo, loadGrupos, editarGrupo, saveGrupo, deleteGrupo } = useGrupos()
const { loadingBancas, showBancaModal, editBanca, bancaFiltroGrupo, bancasFiltradas, loadBancas, editarBanca, saveBanca, deleteBanca } = useBancas()
const { dashStats, dashKpis, dashModo, dashMes, dashGastosCat, dashGruposBancas, dashExpandido, grupoCuadres, loadingDash, loadDashboard, renderDashCharts, renderFlujoKpiCharts, renderGastosCharts } = useDashboard()
const { resumenData, loadingResumen, resumenExpandido, loadResumen, printResumen, toggleResumenDrilldown } = useResumen()
const { cuadreGrupoId, cuadrePeriodoId, cuadreBancaId, cuadreData, cuadreFrm, savingCuadre, balanceAnteriorManual, arrastrePartManual, showMovRapido, movRapidoFrm, showReporte, calcTotalDepositar, calcMontoEntregaSupervisor, calcBalanceFinal, calcBaseParticipacion, calcParticipacion, loadCuadre, saveCuadre, irACuadre, irACuadreBanca, loadCuadreBanca, saveCuadreBanca, abrirMovRapido, saveMovRapido, printReport, copyWhatsapp } = useCuadre()
const { importPeriodoId, importPreview, importando, importDuplicado, importDuplicadoCount, importPeriodoTieneData, manualVenta, handleFile, processImport, saveManualVenta, checkImportDuplicado, borrarImportacion } = useImportar()
const { gastos, gastosTotal, gastoPage, totalPages, PAGE_SIZE, loadingGastos, showGastoModal, gastoFiltro, gastoFrm, gastoEditId, gastoPropagarBanco, gastoPropagarFlujo, gastoSincBanco, gastoSincFlujo, gastoTieneRefBanco, gastoTieneRefFlujo, gastosXCategoria, gastosTotalMonto, abrirNuevoGasto, editarGasto, loadGastos, saveGasto, deleteGasto, tipoGastoColor } = useGastos()
const { prestamos, loadingPrest, showPrestamoModal, prestFiltro, prestFrm, prestEditId, prestamosResumen, abrirNuevoPrestamo, editarPrestamo, loadPrestamos, savePrestamo, deletePrestamo } = usePrestamos()
const { participacion, participacionAgrupada, loadingPart, partFiltro, partExpandido, loadParticipacion } = useParticipacion()
const { bancoMovs, bancoSaldoInicial, loadingBanco, showBancoModal, bancoEditId, bancoFiltro, bancoFrm, bancoStats, bancoPropagarGasto, bancoPropagarFlujo, fmt2, loadBanco, editarBanco, abrirNuevoBanco, saveBanco, deleteBanco } = useBanco()
const { flujoMovs, loadingFlujo, showFlujoModal, flujoEditId, flujoFiltro, flujoFrm, flujoStats, flujoMeses, flujoMovsFiltrados, flujoXCategoria, loadFlujo, saveFlujo, deleteFlujo, editarFlujo, renderFlujoChart } = useFlujo()
const { erData, loadingER, erFiltro, loadEstadoResultados, printER, exportToExcel, exportToPDF, exportERExcel, s7Data, loadingS7, s7Filtro, loadSeccionVII, renderS7Charts } = useEstadoResultados()
const { authLoading, authError, sessionStart, initAuth, login, logout } = useAuth()
const { cajaMovs, loadingCaja, showCajaModal, cajaEditId, cajaFiltro, cajaFrm, cajaSaldo, cajaStats, ORIGENES, origenLabel, loadCaja, abrirNuevoCaja, editarCaja, onOrigenChange, saveCaja, deleteCaja } = useCajaCentral()
const { cierrePeriodo, loadingCierre, showCierreModal, cierrePeriodoId, cierreFrm, prepararCierre, confirmarCierre, prepararCierreMes } = useCierre()
const cierreMesData   = ref(null)
const cierreMesSel    = ref('')
const cierreMesLoading = ref(false)
async function cargarCierreMes() {
  if (!cierreMesSel.value) return
  cierreMesLoading.value = true
  cierreMesData.value = await prepararCierreMes(cierreMesSel.value)
  cierreMesLoading.value = false
}
// Login form state
const loginEmail = ref('')
const loginPass  = ref('')
const showPass   = ref(false)
const exportOpen  = ref('')  // nombre de la vista con dropdown abierto
async function doLogin() {
  if (!loginEmail.value || !loginPass.value) return
  const ok = await login(loginEmail.value, loginPass.value)
  if (ok) { loginEmail.value = ''; loginPass.value = '' }
}
const { usuarios, perfiles, loadingUsers, savingUser, savingPerfil, showUserDrawer, showPerfilDrawer, editUserId, editPerfilId, userDrawerTab, userFrm, perfilFrm, perfilPermisos, loadUsuarios, loadPerfiles, abrirNuevoUsuario, abrirEditarUsuario, saveUsuario, toggleActivo, resetPassword, abrirNuevoPerfil, abrirEditarPerfil, savePerfil, deletePerfil, togglePermiso, toggleGrupo, selectAllPermisos } = useUsuarios()

// ── viewTitles ──
const viewTitles = {
  dashboard: '📊 Dashboard', resumen: '📋 Resumen Semanal',
  cuadre: '⚖️ Cuadre Semanal', importar: '📥 Importar Ventas',
  gastos: '💸 Gastos', prestamos: '💰 Préstamos',
  participacion: '📈 Participación', banco: '🏦 Cuenta Bancaria',
  grupos: '👥 Grupos', bancas: '🏪 Bancas',
  periodos: '📅 Períodos', config: '⚙️ Configuración',
  categorias: '🏷️ Categorías', flujo: '💵 Flujo de Efectivo',
  estado_resultados: '📑 Estado de Resultados', seccion_vii: '💰 ¿A Dónde Va el Dinero?', caja_central: '🏧 Caja Central', cierre_periodo: '🔒 Cierre de Períodos', usuarios: '👤 Usuarios', perfiles: '🔐 Perfiles y Permisos', docs: '📚 Guía de Uso'
}

async function refreshAll() {
  await loadDashboard()
  await loadResumen()
  await loadBanco()
  await loadFlujo()
}

watch(view, async (v) => {
  if (v !== 'cuadre') showReporte.value = false
  const sb = getSb()
  if (!sb) return
  if (v === 'dashboard')       await loadDashboard()
  if (v === 'resumen')         loadResumen()
  if (v === 'gastos')          loadGastos()
  if (v === 'prestamos')       loadPrestamos()
  if (v === 'participacion')   loadParticipacion()
  if (v === 'banco')           loadBanco()
  if (v === 'flujo')           loadFlujo()
  if (v === 'categorias')      loadCategorias()
  if (v === 'usuarios')         { await loadUsuarios(); await loadPerfiles() }
  if (v === 'perfiles')         loadPerfiles()
  if (v === 'caja_central')    loadCaja()
  if (v === 'seccion_vii') {
    if (s7Filtro.value.periodo_id) { await loadSeccionVII(); await nextTick(); renderS7Charts() }
  }
})

onMounted(async () => {
  loadConfig()
  await initAuth()
  if (currentUser.value) {
    // Esperar 2 ticks: uno para que v-else monte el app, otro para los canvas de charts
    await nextTick()
    await nextTick()
    await loadPeriodos()
    await loadGrupos()
    await loadBancas()
    await loadCategorias()
    await loadDashboard()
    await loadBanco()
  }
})
</script>

<template>

  <!-- ══ SPLASH: esperando verificar sesión ══ -->
  <div v-if="!authReady" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0f1a2e">
    <div style="text-align:center">
      <div style="font-size:56px;margin-bottom:12px">🎲</div>
      <div style="font-size:24px;font-weight:800;color:#4fc3f7;margin-bottom:6px">LottoAdmin</div>
      <div style="font-size:13px;color:#aaa;margin-bottom:20px">Verificando sesión...</div>
      <div style="width:36px;height:36px;border:3px solid #333;border-top-color:#1a73e8;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto"></div>
    </div>
  </div>

  <!-- ══ LOGIN ══ -->
  <div v-else-if="!currentUser" class="login-bg">

    <!-- Panel izquierdo — branding -->
    <div class="login-left">
      <div class="login-brand">
        <div class="login-logo-wrap">
          <!-- SVG: bolo de lotería con número -->
          <svg width="110" height="130" viewBox="0 0 110 130" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Sombra base -->
            <ellipse cx="55" cy="122" rx="28" ry="6" fill="rgba(0,0,0,0.35)"/>
            <!-- Cuerpo del bolo -->
            <ellipse cx="55" cy="58" rx="38" ry="52" fill="url(#bolo_grad)"/>
            <!-- Reflejo superior -->
            <ellipse cx="42" cy="30" rx="10" ry="14" fill="rgba(255,255,255,0.18)" transform="rotate(-20 42 30)"/>
            <!-- Franja decorativa superior -->
            <path d="M20 42 Q55 35 90 42 Q87 52 55 54 Q23 52 20 42Z" fill="rgba(255,255,255,0.12)"/>
            <!-- Franja decorativa inferior -->
            <path d="M18 68 Q55 62 92 68 Q90 80 55 82 Q20 80 18 68Z" fill="rgba(0,0,0,0.15)"/>
            <!-- Círculo central del número -->
            <circle cx="55" cy="58" r="22" fill="white" opacity="0.95"/>
            <circle cx="55" cy="58" r="20" fill="url(#num_grad)"/>
            <!-- Número en el bolo -->
            <text x="55" y="65" text-anchor="middle" font-family="Arial Black, sans-serif"
                  font-size="20" font-weight="900" fill="white">7</text>
            <!-- Brillo en la esfera -->
            <ellipse cx="40" cy="35" rx="6" ry="9" fill="rgba(255,255,255,0.25)" transform="rotate(-15 40 35)"/>
            <defs>
              <radialGradient id="bolo_grad" cx="38%" cy="35%" r="65%">
                <stop offset="0%" stop-color="#4fc3f7"/>
                <stop offset="45%" stop-color="#1a73e8"/>
                <stop offset="100%" stop-color="#0d3a8a"/>
              </radialGradient>
              <radialGradient id="num_grad" cx="40%" cy="38%" r="60%">
                <stop offset="0%" stop-color="#f9a825"/>
                <stop offset="100%" stop-color="#e65100"/>
              </radialGradient>
            </defs>
          </svg>
        </div>
        <div class="login-brand-name">LottoAdmin</div>
        <div class="login-brand-sub">Sistema de Control de Apuestas</div>
      </div>

      <!-- Mini gráfico decorativo de finanzas -->
      <div class="login-chart-wrap">
        <svg width="100%" height="80" viewBox="0 0 280 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="chart_fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#4fc3f7" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="#4fc3f7" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <!-- Área rellena -->
          <path d="M0 65 L20 58 L45 62 L70 45 L95 50 L120 35 L145 40 L165 25 L190 30 L215 18 L240 22 L260 12 L280 8 L280 80 L0 80Z" fill="url(#chart_fill)"/>
          <!-- Línea del gráfico -->
          <path d="M0 65 L20 58 L45 62 L70 45 L95 50 L120 35 L145 40 L165 25 L190 30 L215 18 L240 22 L260 12 L280 8"
                stroke="#4fc3f7" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- Puntos clave -->
          <circle cx="70" cy="45" r="3.5" fill="#4fc3f7"/>
          <circle cx="165" cy="25" r="3.5" fill="#4fc3f7"/>
          <circle cx="280" cy="8" r="4" fill="#f9a825"/>
        </svg>
        <div class="login-chart-label">Rendimiento del período actual</div>
      </div>

      <!-- Stats decorativos -->
      <div class="login-stats">
        <div class="login-stat">
          <div class="login-stat-val">+12.4%</div>
          <div class="login-stat-lbl">Margen</div>
        </div>
        <div class="login-stat-divider"></div>
        <div class="login-stat">
          <div class="login-stat-val">98.2%</div>
          <div class="login-stat-lbl">Cobertura</div>
        </div>
        <div class="login-stat-divider"></div>
        <div class="login-stat">
          <div class="login-stat-val">↑ 7.8%</div>
          <div class="login-stat-lbl">vs anterior</div>
        </div>
      </div>
    </div>

    <!-- Panel derecho — formulario -->
    <div class="login-right">
      <div class="login-form-card">
        <div class="login-form-title">Bienvenido</div>
        <div class="login-form-sub">Ingresa tus credenciales para continuar</div>

        <!-- Sin configurar Supabase -->
        <div v-if="!supabaseConfigured" style="margin-top:20px">
          <div class="login-alert login-alert-warn">
            ⚙️ Sistema no configurado. Ingresa las credenciales de Supabase para comenzar.
          </div>
          <div class="login-field">
            <label class="login-label">Supabase URL</label>
            <input class="login-input" v-model="config.supabaseUrl" placeholder="https://xxxx.supabase.co"/>
          </div>
          <div class="login-field">
            <label class="login-label">API Key (anon public)</label>
            <input class="login-input" v-model="config.supabaseKey" placeholder="eyJhbGciOiJIUzI1NiIs..."/>
          </div>
          <button class="login-btn login-btn-secondary" @click="saveConfig(); initAuth()">
            💾 Guardar configuración
          </button>
        </div>

        <!-- Formulario login -->
        <div v-if="supabaseConfigured" style="margin-top:24px">
          <div class="login-field">
            <label class="login-label">Correo electrónico</label>
            <div class="login-input-wrap">
              <span class="login-input-icon">✉️</span>
              <input class="login-input login-input-icon-pad" type="email"
                     v-model="loginEmail" placeholder="usuario@empresa.com"
                     @keyup.enter="doLogin" autocomplete="email"/>
            </div>
          </div>
          <div class="login-field">
            <label class="login-label">Contraseña</label>
            <div class="login-input-wrap">
              <span class="login-input-icon">🔒</span>
              <input class="login-input login-input-icon-pad" :type="showPass?'text':'password'"
                     v-model="loginPass" placeholder="••••••••"
                     @keyup.enter="doLogin" autocomplete="current-password"/>
              <button class="login-eye" @click="showPass=!showPass" type="button">
                {{ showPass ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          <!-- Error -->
          <div v-if="authError" class="login-alert login-alert-error">
            ⚠️ {{ authError }}
          </div>

          <button class="login-btn login-btn-primary" :class="{loading: authLoading}" @click="doLogin" :disabled="authLoading">
            <span v-if="authLoading" class="login-spinner"></span>
            <span v-else>Ingresar al sistema →</span>
          </button>
        </div>

        <div class="login-footer">LottoAdmin v2.0 &nbsp;·&nbsp; Sistema seguro</div>
      </div>
    </div>
  </div>

  <!-- ══ APP PRINCIPAL (solo si hay usuario autenticado) ══ -->
  <div v-else id="app">

      <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-mark">L</div>
      <h1>LottoAdmin</h1>
      <p>Sistema de cuadre</p>
    </div>
    <div class="nav-section">Principal</div>
    <div class="nav-item" :class="{active:view==='dashboard'}" @click="view='dashboard'">
      <span class="nav-icon">📊</span> Dashboard
    </div>
    <div class="nav-item" :class="{active:view==='resumen'}" @click="view='resumen'">
      <span class="nav-icon">📋</span> Resumen Semanal
    </div>
    <div class="nav-section">Operaciones</div>
    <div class="nav-item" :class="{active:view==='cuadre'}" @click="view='cuadre'">
      <span class="nav-icon">⚖️</span> Cuadre Semanal
    </div>
    <div class="nav-item" :class="{active:view==='importar'}" @click="view='importar'">
      <span class="nav-icon">📥</span> Importar Ventas
    </div>
    <div class="nav-item" :class="{active:view==='gastos'}" @click="view='gastos'">
      <span class="nav-icon">💸</span> Gastos
    </div>
    <div class="nav-item" :class="{active:view==='prestamos'}" @click="view='prestamos'">
      <span class="nav-icon">💰</span> Préstamos
    </div>
    <div class="nav-section">Seguimiento</div>
    <div class="nav-item" :class="{active:view==='participacion'}" @click="view='participacion'">
      <span class="nav-icon">📈</span> Participación
    </div>
    <div class="nav-item" :class="{active:view==='banco'}" @click="view='banco'">
      <span class="nav-icon">🏦</span> Cuenta Banco
    </div>
    <div class="nav-item" :class="{active:view==='flujo'}" @click="view='flujo'">
      <span class="nav-icon">💵</span> Flujo de Efectivo
    </div>
    <div class="nav-item" :class="{active:view==='caja_central'}" @click="view='caja_central';loadCaja()">
      <span class="nav-icon">🏧</span> Caja Central
    </div>
    <div class="nav-item" :class="{active:view==='cierre_periodo'}" @click="view='cierre_periodo'">
      <span class="nav-icon">🔒</span> Cierre de Períodos
    </div>
    <div class="nav-item" :class="{active:view==='estado_resultados'}" @click="view='estado_resultados'">
      <span class="nav-icon">📑</span> Estado de Resultados
    </div>
    <div class="nav-item" :class="{active:view==='seccion_vii'}" @click="view='seccion_vii'">
      <span class="nav-icon">💰</span> ¿A Dónde Va el Dinero?
    </div>
    <div class="nav-section">Configuración</div>
    <div class="nav-item" :class="{active:view==='grupos'}" @click="view='grupos'">
      <span class="nav-icon">👥</span> Grupos
    </div>
    <div class="nav-item" :class="{active:view==='bancas'}" @click="view='bancas'">
      <span class="nav-icon">🏪</span> Bancas
    </div>
    <div class="nav-item" :class="{active:view==='periodos'}" @click="view='periodos'">
      <span class="nav-icon">📅</span> Periodos
    </div>
    <div class="nav-item" :class="{active:view==='categorias'}" @click="view='categorias'">
      <span class="nav-icon">🏷️</span> Categorías
    </div>
    <div class="nav-item" :class="{active:view==='config'}" @click="view='config'">
      <span class="nav-icon">⚙️</span> Configuración
    </div>
    <div class="nav-item" :class="{active:view==='docs'}" @click="view='docs'">
      <span class="nav-icon">📚</span> Guía de Uso
    </div>
    <div class="nav-section">Administración</div>
    <div class="nav-item" :class="{active:view==='usuarios'}" @click="view='usuarios'">
      <span class="nav-icon">👤</span> Usuarios
    </div>
    <div class="nav-item" :class="{active:view==='perfiles'}" @click="view='perfiles'">
      <span class="nav-icon">🔐</span> Perfiles y Permisos
    </div>
    <div class="sidebar-bottom">
      <div style="padding:8px 12px;border-top:1px solid var(--border);margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;flex-shrink:0">
            {{ ((currentUser?.nombre||'?')[0]+(currentUser?.apellido||'')[0]||'').toUpperCase() }}
          </div>
          <div>
            <div style="font-size:11px;font-weight:600;color:var(--text)">{{ currentUser?.nombre }} {{ currentUser?.apellido }}</div>
            <div style="font-size:10px;color:var(--muted)">{{ userPerfil?.nombre }}</div>
          </div>
        </div>
        <div v-if="sessionStart" style="font-size:9px;color:var(--muted);opacity:0.6;padding-left:2px">
          🟢 Sesión activa desde {{ new Date(sessionStart).toLocaleTimeString('es-DO',{hour:'2-digit',minute:'2-digit'}) }}
        </div>
      </div>
      <div class="nav-item" @click="logout()" style="color:var(--red);cursor:pointer">
        <span class="nav-icon">🚪</span> Cerrar sesión
      </div>
      <div class="version">v1.0.0 — LottoAdmin</div>
    </div>
  </aside>

    <main class="main">
          <div class="topbar">
      <div class="topbar-left">
        <div class="topbar-title">{{ viewTitles[view] }}</div>
        <div class="topbar-period" v-if="activePeriodo">
          📅 {{ activePeriodo.descripcion || (activePeriodo.fecha_inicio + ' → ' + activePeriodo.fecha_fin) }}
        </div>
      </div>
      <div class="topbar-right">
        <button class="btn btn-ghost btn-sm" @click="refreshAll">🔄 Actualizar</button>
        <button class="btn btn-primary btn-sm" @click="view='cuadre'">+ Nuevo Cuadre</button>
      </div>
    </div>

          <div class="content" @click="exportOpen=''">

      <!-- CONFIG ALERT (if not configured) -->
      <div v-if="!supabaseConfigured" class="config-box">
        <p>⚠️ <strong>Configura tu conexión a Supabase</strong> para activar todos los módulos. 
           Ve a <strong>Configuración</strong> e ingresa tu URL y API Key.</p>
      </div>

      <!-- ══ DASHBOARD ══ -->
      <div v-if="view==='dashboard'">
        <div class="section-header">
          <div>
            <div class="section-title">Dashboard</div>
            <div class="section-sub">Indicadores generales — período activo</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <!-- Toggle modo -->
            <div style="display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">
              <button :class="dashModo==='periodo'?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'" style="border-radius:0;border:none" @click="dashModo='periodo';loadDashboard()">Por Período</button>
              <button :class="dashModo==='mes'?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'" style="border-radius:0;border:none" @click="dashModo='mes';loadDashboard()">Por Mes</button>
            </div>
            <select v-if="dashModo==='periodo'" class="form-control" style="width:200px" v-model="selectedPeriodoId" @change="loadDashboard">
              <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
            </select>
            <input v-if="dashModo==='mes'" type="month" class="form-control" style="width:160px" v-model="dashMes" @change="loadDashboard"/>
            <div class="export-wrap" :class="{open: exportOpen==='dashboard'}" @click.stop>
              <button class="export-btn" @click="exportOpen = exportOpen==='dashboard' ? '' : 'dashboard'">
                ⬇ Exportar <span class="arrow">▼</span>
              </button>
              <div class="export-menu">
                <div class="export-menu-item" @click="exportOpen=''; exportToExcel('tbl-dashboard-kpis','dashboard')">
                  📊 Excel
                </div>
                <div class="export-menu-item" @click="exportOpen=''; exportToPDF('tbl-dashboard-kpis','Dashboard','dashboard')">
                  📄 PDF
                </div>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" @click="toggleTheme" :title="'Modo: '+themeMode" style="font-size:16px;padding:6px 10px">
              {{ themeMode==='dark' ? '🌙' : themeMode==='light' ? '☀️' : '🌓' }}
            </button>
          </div>
        </div>

        <!-- ── ROW 1: KPIs principales ── -->
        <div id="tbl-dashboard-kpis" class="metrics-grid" style="grid-template-columns:repeat(4,1fr)">
          <div class="metric-card blue">
            <div class="metric-icon">🎰</div>
            <div class="metric-label">Total Ventas</div>
            <div class="metric-value">{{ fmt(dashStats.ventas) }}</div>
            <div class="metric-sub">{{ dashStats.bancas_activas }} bancas activas</div>
          </div>
          <div class="metric-card red">
            <div class="metric-icon">🏆</div>
            <div class="metric-label">Total Premios</div>
            <div class="metric-value neg">{{ fmt(dashStats.premios) }}</div>
            <div class="metric-sub">{{ pct(dashStats.premios, dashStats.ventas) }} de ventas</div>
          </div>
          <div class="metric-card yellow">
            <div class="metric-icon">💼</div>
            <div class="metric-label">Comisiones</div>
            <div class="metric-value" style="color:var(--yellow)">{{ fmt(dashStats.comisiones) }}</div>
            <div class="metric-sub">{{ pct(dashStats.comisiones, dashStats.ventas) }} de ventas</div>
          </div>
          <div :class="['metric-card', dashStats.resultado >= 0 ? 'green' : 'red']">
            <div class="metric-icon">📊</div>
            <div class="metric-label">Resultado Neto</div>
            <div :class="['metric-value', dashStats.resultado >= 0 ? 'pos' : 'neg']">{{ fmt(dashStats.resultado) }}</div>
            <div class="metric-sub">Ventas − Premios − Comisiones</div>
          </div>
        </div>

        <div class="section-gap" style="height:12px"></div>

        <!-- ── ROW 2: KPIs secundarios ── -->
        <div class="metrics-grid" style="grid-template-columns:repeat(4,1fr)">
          <div class="metric-card" style="border-color:rgba(255,77,109,0.3)">
            <div class="metric-icon">📋</div>
            <div class="metric-label">Gastos del Período</div>
            <div class="metric-value neg">{{ fmt(dashKpis.gastos) }}</div>
            <div class="metric-sub">Operativos + Participación</div>
          </div>
          <div :class="['metric-card', dashKpis.flujoNeto >= 0 ? 'green' : 'red']">
            <div class="metric-icon">💵</div>
            <div class="metric-label">Flujo Neto (total)</div>
            <div :class="['metric-value', dashKpis.flujoNeto >= 0 ? 'pos' : 'neg']">{{ fmt(dashKpis.flujoNeto) }}</div>
            <div class="metric-sub">Ing {{ fmt(dashKpis.flujoIngresos) }} / Egr {{ fmt(dashKpis.flujoEgresos) }}</div>
          </div>
          <div class="metric-card blue">
            <div class="metric-icon">🏦</div>
            <div class="metric-label">Saldo Banco</div>
            <div :class="['metric-value', dashKpis.saldoBanco >= 0 ? 'pos' : 'neg']">{{ fmt(dashKpis.saldoBanco) }}</div>
            <div class="metric-sub">Cuenta bancaria acumulado</div>
          </div>
          <div class="metric-card yellow">
            <div class="metric-icon">📈</div>
            <div class="metric-label">Participación</div>
            <div class="metric-value" style="color:var(--yellow)">{{ fmt(dashKpis.participacionTotal) }}</div>
            <div class="metric-sub">Pagado: {{ fmt(dashKpis.participacionPagada) }}</div>
          </div>
        </div>

        <div class="section-gap" style="height:16px"></div>

        <!-- ── ROW 3: Tabla grupos + Donut ── -->
        <div class="grid-2">
          <div class="card">
            <div class="card-header">
              <div class="card-title">Resultado por Grupo</div>
              <div style="font-size:10px;color:var(--muted)">▼ = detalle de bancas</div>
            </div>
            <div class="card-body" style="padding:0">
              <div class="loading" v-if="loadingDash"><div class="spinner"></div></div>
              <div class="empty" v-else-if="!grupoCuadres.length">
                <div class="empty-icon">📋</div><p>Sin datos para este período</p>
              </div>
              <table v-else>
                <thead><tr>
                  <th>Grupo</th><th style="text-align:right">Ventas</th>
                  <th style="text-align:right">Premios</th><th style="text-align:right">Resultado</th><th>Estado</th>
                </tr></thead>
                <tbody>
                  <template v-for="g in grupoCuadres" :key="g.id">
                    <tr>
                      <td>
                        <strong>{{ g.grupos?.nombre }}</strong>
                        <span v-if="g.modo==='individual_bancas'" class="tag tag-yellow" style="font-size:9px;margin-left:4px">🏦</span>
                        <button v-if="g.modo==='individual_bancas' && (dashGruposBancas[g.id]||[]).length"
                          class="btn btn-ghost btn-xs" style="padding:1px 5px;margin-left:4px;font-size:10px"
                          @click="dashExpandido[g.id]=!dashExpandido[g.id]">
                          {{ dashExpandido[g.id] ? '▲' : '▼' }}
                        </button>
                      </td>
                      <td style="text-align:right" class="num-pos">{{ fmt(g.total_ventas) }}</td>
                      <td style="text-align:right" class="num-neg">{{ fmt(g.total_premios) }}</td>
                      <td style="text-align:right" :class="g.resultado_loteria >= 0 ? 'num-pos' : 'num-neg'">{{ fmt(g.resultado_loteria) }}</td>
                      <td><span :class="g.resultado_loteria >= 0 ? 'tag tag-green' : 'tag tag-red'">{{ g.resultado_loteria >= 0 ? 'Ganancia' : 'Pérdida' }}</span></td>
                    </tr>
                    <template v-if="g.modo==='individual_bancas' && dashExpandido[g.id]">
                      <tr v-for="b in (dashGruposBancas[g.id]||[])" :key="b.banca_id"
                          style="background:rgba(255,209,102,0.06);font-size:12px">
                        <td style="padding-left:26px;color:var(--muted)">
                          ↳ <span class="tag tag-yellow" style="font-size:9px">{{ b.codigo }}</span> {{ b.nombre }}
                        </td>
                        <td style="text-align:right;color:var(--blue)">{{ fmt(b.ventas) }}</td>
                        <td style="text-align:right;color:var(--red)">{{ fmt(b.premios) }}</td>
                        <td style="text-align:right" :class="b.resultado >= 0 ? 'num-pos' : 'num-neg'">{{ fmt(b.resultado) }}</td>
                        <td><span :class="b.resultado >= 0 ? 'tag tag-green' : 'tag tag-red'" style="font-size:9px">{{ b.resultado >= 0 ? '✓' : '✗' }}</span></td>
                      </tr>
                    


</template>
                  


</template>
                </tbody>
                <tfoot v-if="grupoCuadres.length">
                  <tr class="summary-row">
                    <td><strong>TOTAL</strong></td>
                    <td style="text-align:right" class="num-pos"><strong>{{ fmt(dashStats.ventas) }}</strong></td>
                    <td style="text-align:right" class="num-neg"><strong>{{ fmt(dashStats.premios) }}</strong></td>
                    <td style="text-align:right" :class="dashStats.resultado>=0?'num-pos':'num-neg'"><strong>{{ fmt(dashStats.resultado) }}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">Distribución del Período</div></div>
            <div class="card-body">
              <div class="chart-wrap"><canvas id="chartDonut"></canvas></div>
            </div>
          </div>
        </div>

        <div class="section-gap" style="height:16px"></div>

        <!-- ── ROW 4: Ventas vs Premios bar + Flujo línea ── -->
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div class="card-title">Ventas vs Premios vs Resultado</div></div>
            <div class="card-body"><div class="chart-wrap"><canvas id="chartBar"></canvas></div></div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">Saldo Flujo de Efectivo</div></div>
            <div class="card-body"><div class="chart-wrap"><canvas id="chartFlujoLine"></canvas></div></div>
          </div>
        </div>

        <div class="section-gap" style="height:16px"></div>

        <!-- ── ROW 5: Últimos movimientos banco ── -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Últimos Movimientos Bancarios</div>
            <button class="btn btn-ghost btn-sm" @click="view='banco'">Ver todos →</button>
          </div>
          <div class="card-body" style="padding:0">
            <div class="empty" v-if="!bancoMovs.length">
              <div class="empty-icon">🏦</div><p>Sin movimientos registrados</p>
            </div>
            <table v-else>
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Grupo</th><th>Tipo</th><th>Monto</th><th>Saldo</th></tr></thead>
              <tbody>
                <tr v-for="m in bancoMovs.slice(0,6)" :key="m.id">
                  <td>{{ m.fecha }}</td>
                  <td>
                    {{ m.concepto }}
                    <span v-if="m.ref_gasto_id" title="Registrado en Gastos" style="margin-left:4px;font-size:11px">🧾</span>
                    <span v-if="m.ref_flujo_id" title="Registrado en Flujo" style="margin-left:2px;font-size:11px">💸</span>
                  </td>
                  <td>{{ m.grupos?.nombre || '—' }}</td>
                  <td><span :class="m.tipo==='ingreso' ? 'tag tag-green' : 'tag tag-red'">{{ m.tipo }}</span></td>
                  <td :class="m.tipo==='ingreso' ? 'num-pos' : 'num-neg'">{{ m.tipo==='ingreso'?'+':'-' }}{{ fmt2(m.monto) }}</td>
                  <td :class="m.saldo_acumulado>=0?'num-pos':'num-neg'">{{ fmt2(m.saldo_acumulado) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="section-gap" style="height:16px"></div>

        <!-- ── ROW 6: Análisis de Gastos ── -->
        <div class="card" style="margin-bottom:0">
          <div class="card-header">
            <div>
              <div class="card-title">📋 Análisis de Gastos — Período</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">Desglose por categoría registrada</div>
            </div>
          </div>
          <div class="card-body">
            <div v-if="!dashGastosCat.length" style="text-align:center;color:var(--muted);padding:24px 0;font-size:12px">
              Sin gastos registrados para este período
            </div>
            <div v-else>
              <!-- KPIs rápidos de gastos -->
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
                <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
                  <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:4px">TOTAL GASTOS</div>
                  <div style="font-size:18px;font-weight:700;color:var(--red)">{{ fmt(dashKpis.gastos) }}</div>
                </div>
                <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
                  <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:4px">CATEGORÍAS</div>
                  <div style="font-size:18px;font-weight:700;color:var(--blue)">{{ dashGastosCat.length }}</div>
                </div>
                <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
                  <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:4px">% DEL RESULTADO</div>
                  <div style="font-size:18px;font-weight:700;color:var(--yellow)">
                    {{ dashStats.ventas > 0 ? (dashKpis.gastos/dashStats.ventas*100).toFixed(1)+'%' : '—' }}
                  </div>
                  <div style="font-size:9px;color:var(--muted)">sobre ventas</div>
                </div>
              </div>

              <!-- Top categorías tabla -->
              <div style="margin-bottom:18px">
                <div style="font-size:10px;letter-spacing:1px;color:var(--muted);margin-bottom:8px;text-transform:uppercase">Top Categorías</div>
                <div v-for="c in dashGastosCat.slice(0,6)" :key="c.nombre"
                     style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
                  <div
                       :style="'width:10px;height:10px;border-radius:50%;flex-shrink:0;' + ('background:' + (c.color||'#5a6a80'))"></div>
                  <div style="flex:1;font-size:11px">{{ c.nombre }}</div>
                  <div style="width:120px;background:var(--border);border-radius:3px;height:6px;overflow:hidden">
                    <div
                         :style="'height:100%;border-radius:3px;transition:width 0.4s;' + ('width:'+c.pct+'%;background:'+(c.color||'#5a6a80'))"></div>
                  </div>
                  <div style="width:52px;text-align:right;font-size:11px;color:var(--red)">{{ fmt(c.total) }}</div>
                  <div style="width:34px;text-align:right;font-size:10px;color:var(--muted)">{{ c.pct }}%</div>
                </div>
              </div>

              <!-- 3 gráficos -->
              <div style="display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:14px">
                <div>
                  <div style="font-size:10px;letter-spacing:1px;color:var(--muted);margin-bottom:8px;text-align:center">DISTRIBUCIÓN</div>
                  <div style="height:200px"><canvas id="chartGastoCat"></canvas></div>
                </div>
                <div>
                  <div style="font-size:10px;letter-spacing:1px;color:var(--muted);margin-bottom:8px;text-align:center">BARRAS POR CATEGORÍA</div>
                  <div style="height:200px"><canvas id="chartGastoBars"></canvas></div>
                </div>
                <div>
                  <div style="font-size:10px;letter-spacing:1px;color:var(--muted);margin-bottom:8px;text-align:center">OPERATIVO vs PARTICIPACIÓN</div>
                  <div style="height:200px"><canvas id="chartGastoTipo"></canvas></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="section-gap" style="height:16px"></div>

        <!-- ── ROW 7: Flujo de Efectivo — Análisis Gerencial ── -->
        <div class="card" style="margin-bottom:0">
          <div class="card-header">
            <div>
              <div class="card-title">💵 Flujo de Efectivo — Análisis del Período</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">Movimientos registrados en el período seleccionado</div>
            </div>
            <button class="btn btn-ghost btn-sm" @click="view='flujo'">Ver detalle →</button>
          </div>
          <div class="card-body">

            <!-- KPIs rápidos flujo -->
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px">
              <div style="background:rgba(0,229,160,0.07);border:1px solid rgba(0,229,160,0.2);border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:4px">INGRESOS</div>
                <div style="font-size:17px;font-weight:700;color:var(--accent)">{{ fmt(dashKpis.flujoIngresos||0) }}</div>
              </div>
              <div style="background:rgba(255,77,109,0.07);border:1px solid rgba(255,77,109,0.2);border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:4px">EGRESOS</div>
                <div style="font-size:17px;font-weight:700;color:var(--red)">{{ fmt(dashKpis.flujoEgresos||0) }}</div>
              </div>
              <div :style="'background:rgba('+(dashKpis.flujoNeto>=0?'0,229,160':'255,77,109')+',0.07);border:1px solid rgba('+(dashKpis.flujoNeto>=0?'0,229,160':'255,77,109')+',0.2);border-radius:8px;padding:12px;text-align:center'">
                <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:4px">NETO PERÍODO</div>
                <div :class="'font-size:17px;font-weight:700'" :style="'font-size:17px;font-weight:700;color:'+(dashKpis.flujoNeto>=0?'var(--accent)':'var(--red)')">{{ fmt(dashKpis.flujoNeto||0) }}</div>
              </div>
              <div style="background:rgba(76,201,240,0.07);border:1px solid rgba(76,201,240,0.2);border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:4px">DE CUADRES</div>
                <div :style="'font-size:17px;font-weight:700;color:var(--blue)'">{{ fmt(dashKpis.flujoCuadre||0) }}</div>
              </div>
              <div style="background:rgba(255,209,102,0.07);border:1px solid rgba(255,209,102,0.2);border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:4px">PRÉSTAMOS</div>
                <div style="font-size:17px;font-weight:700;color:var(--yellow)">{{ fmt(dashKpis.flujoPrestamo||0) }}</div>
              </div>
            </div>

            <!-- Fila de indicadores secundarios -->
            <div style="display:flex;gap:16px;margin-bottom:18px;font-size:11px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></div>
                <span style="color:var(--muted)">Cobertura gastos:</span>
                <strong :style="'color:'+(dashKpis.flujoIngresos>dashKpis.gastos?'var(--accent)':'var(--red)')">
                  {{ dashKpis.gastos>0 ? (dashKpis.flujoIngresos/dashKpis.gastos*100).toFixed(0)+'%' : '—' }}
                </strong>
              </div>
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:8px;height:8px;border-radius:50%;background:var(--blue)"></div>
                <span style="color:var(--muted)">Eficiencia flujo:</span>
                <strong :style="'color:'+(dashKpis.flujoNeto>=0?'var(--accent)':'var(--red)')">
                  {{ dashKpis.flujoIngresos>0 ? (dashKpis.flujoNeto/dashKpis.flujoIngresos*100).toFixed(1)+'%' : '—' }}
                </strong>
              </div>
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:8px;height:8px;border-radius:50%;background:var(--yellow)"></div>
                <span style="color:var(--muted)">Días con movimiento:</span>
                <strong style="color:var(--text)">{{ (dashKpis.flujoDias||[]).length }}</strong>
              </div>
            </div>

            <!-- 4 gráficos flujo -->
            <div style="display:grid;grid-template-columns:1.6fr 1.6fr 1fr 1fr;gap:14px">
              <div>
                <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:6px;text-transform:uppercase">Ingresos vs Egresos por Día</div>
                <div style="height:190px"><canvas id="chartFlujoIngEgr"></canvas></div>
              </div>
              <div>
                <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:6px;text-transform:uppercase">Saldo Acumulado</div>
                <div style="height:190px"><canvas id="chartFlujoAcum"></canvas></div>
              </div>
              <div>
                <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;text-align:center">Por Origen</div>
                <div style="height:190px"><canvas id="chartFlujoOrigen"></canvas></div>
              </div>
              <div>
                <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:6px;text-transform:uppercase">Egresos / Categoría</div>
                <div style="height:190px"><canvas id="chartFlujoCatEgr"></canvas></div>
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- ══ RESUMEN SEMANAL ══ -->
      <div v-if="view==='resumen'">
        <div class="section-header">
          <div>
            <div class="section-title">Resumen Semanal</div>
            <div class="section-sub">Estado de todos los grupos en el período</div>
          </div>
          <div style="display:flex;gap:10px">
            <select class="form-control" style="width:200px" v-model="selectedPeriodoId" @change="loadResumen">
              <option v-for="p in periodos" :key="p.id" :value="p.id">
                {{ p.descripcion || p.fecha_inicio }}
              </option>
            </select>
            <div class="export-group">
              <button class="btn btn-ghost btn-sm" @click="printResumen">🖨 Imprimir</button>
              <div class="export-wrap" :class="{open: exportOpen==='resumen'}" @click.stop>
              <button class="export-btn" @click="exportOpen = exportOpen==='resumen' ? '' : 'resumen'">
                ⬇ Exportar <span class="arrow">▼</span>
              </button>
              <div class="export-menu">
                <div class="export-menu-item" @click="exportOpen=''; exportToExcel('tbl-resumen','resumen_semanal')">
                  <span class="icon">📊</span> Excel (.xlsx)
                </div>
                <div class="export-menu-item" @click="exportOpen=''; exportToPDF('tbl-resumen','Resumen Semanal','resumen_semanal')">
                  <span class="icon">📄</span> PDF
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-body" style="padding:0">
            <div class="loading" v-if="loadingResumen"><div class="spinner"></div></div>
            <div class="empty" v-else-if="!resumenData.length">
              <div class="empty-icon">📋</div>
              <p>Sin datos — Ejecuta el cuadre primero</p>
            </div>
            <div class="table-wrap" v-else>
              <table id="tbl-resumen">
                <thead>
                  <tr>
                    <th>#</th><th>Grupo</th><th>Estado</th>
                    <th title="Ventas − Premios − Comisiones">Res. Lotería</th><th title="Solo gastos tipo Operativo">Gastos Op.</th><th title="Participación del supervisor">Participación</th><th title="Res. Lotería − Gastos − Participación">Res. Período</th>
                    <th>Pend. Anterior</th><th>Acumulado</th>
                    <th>Salidas</th><th>Entradas</th>
                    <th>T. Cierre</th><th>Depositado</th>
                    <th>Balance</th><th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="(r,i) in resumenData" :key="r.grupo_id||r.id">
                  <tr :style="r.modo==='individual_bancas'?'background:rgba(255,209,102,0.04)':''">
                    <td>{{ i+1 }}</td>
                    <td>
                      <strong>{{ r.grupos?.nombre }}</strong>
                      <span v-if="r.modo==='individual_bancas'" class="tag tag-yellow" style="font-size:9px;margin-left:4px">🏦</span>
                      <button v-if="r.modo==='individual_bancas'" class="btn btn-ghost btn-xs" style="padding:1px 6px;margin-left:4px;font-size:11px" @click="toggleResumenDrilldown(r.grupo_id)">
                        {{ resumenExpandido[r.grupo_id] ? '▲' : '▼' }}
                      </button>
                    </td>
                    <td>
                      <span :class="r.cuadre_guardado ? 'tag tag-green' : 'tag tag-gray'">
                        {{ r.cuadre_guardado ? '✓ Cuadrado' : '⏳ Pendiente' }}
                      </span>
                    </td>
                    <td :class="r.resultado_loteria>=0?'num-pos':'num-neg'">{{ fmt(r.resultado_loteria) }}</td>
                    <td class="num-neg">{{ fmt(r.total_gastos) }}</td>
                    <td :class="r.participacion_op>0?'num-neg':''">{{ r.participacion_op > 0 ? fmt(r.participacion_op) : '—' }}</td>
                    <td :class="(r.resultado_loteria-r.total_gastos-r.participacion_op)>=0?'num-pos':'num-neg'">
                      {{ fmt(r.resultado_loteria - r.total_gastos - (r.participacion_op||0)) }}
                    </td>
                    <td :class="r.balance_pendiente_anterior>=0?'':'num-neg'">{{ fmt(r.balance_pendiente_anterior) }}</td>
                    <td :class="r.total_acumulado>=0?'':'num-neg'">{{ fmt(r.total_acumulado) }}</td>
                    <td class="num-neg">{{ fmt(r.entregado_supervisor) }}</td>
                    <td class="num-pos">{{ fmt(r.entregado_central) }}</td>
                    <td>{{ fmt(r.total_a_depositar) }}</td>
                    <td class="num-pos">{{ fmt(r.depositado) }}</td>
                    <td :class="r.balance_final>=0?'num-pos':'num-neg'">
                      <strong>{{ fmt(r.balance_final) }}</strong>
                    </td>
                    <td>
                      <button v-if="r.modo!=='individual_bancas'" class="btn btn-ghost btn-xs" @click="irACuadre(r)">
                        {{ r.cuadre_guardado ? '✏️ Editar' : '⚖️ Cuadrar' }}
                      </button>
                      <button v-else class="btn btn-ghost btn-xs" @click="toggleResumenDrilldown(r.grupo_id)">
                        Ver Bancas
                      </button>
                    </td>
                  </tr>
                  <!-- DRILLDOWN: bancas individuales del grupo -->
                  <template v-if="r.modo==='individual_bancas' && resumenExpandido[r.grupo_id]">
                    <tr v-if="!(r.cuadres_bancas||[]).length">
                      <td colspan="14" style="text-align:center;color:var(--muted);font-size:12px;padding:8px 16px;background:rgba(255,209,102,0.04)">
                        ℹ️ Sin cuadres registrados para las bancas de este grupo en este período
                      </td>
                    </tr>
                    <tr v-for="cb in (r.cuadres_bancas||[])" :key="cb.id"
                        style="background:rgba(255,209,102,0.06);font-size:12px">
                      <td style="padding-left:28px;color:var(--muted)">↳</td>
                      <td style="color:var(--muted)">
                        <span style="font-size:10px">{{ cb.bancas?.codigo }}</span>
                        {{ cb.bancas?.nombre }}
                      </td>
                      <td><span class="tag tag-green" style="font-size:9px">✓</span></td>
                      <td :class="cb.resultado_periodo>=0?'num-pos':'num-neg'">{{ fmt(cb.resultado_periodo) }}</td>
                      <td class="num-neg">{{ fmt(cb.total_gastos||0) }}</td>
                      <td style="color:var(--muted)">—</td>
                      <td :class="(cb.resultado_periodo-(cb.total_gastos||0))>=0?'num-pos':'num-neg'">{{ fmt(cb.resultado_periodo-(cb.total_gastos||0)) }}</td>
                      <td :class="cb.balance_pendiente_anterior<0?'num-neg':''">{{ fmt(cb.balance_pendiente_anterior||0) }}</td>
                      <td>{{ fmt(cb.total_acumulado||0) }}</td>
                      <td class="num-neg">{{ fmt(cb.entregado_supervisor||0) }}</td>
                      <td class="num-pos">{{ fmt(cb.entregado_central||0) }}</td>
                      <td>{{ fmt(cb.total_a_depositar||0) }}</td>
                      <td class="num-pos">{{ fmt(cb.depositado||0) }}</td>
                      <td :class="cb.balance_final>=0?'num-pos':'num-neg'"><strong>{{ fmt(cb.balance_final||0) }}</strong></td>
                      <td>
                        <button class="btn btn-ghost btn-xs" @click="irACuadreBanca(r.grupo_id, cb.banca_id)">✏️</button>
                      </td>
                    </tr>
                  


</template>
                  


</template>
                </tbody>
                <tfoot>
                  <tr class="summary-row">
                    <td colspan="3"><strong>TOTALES</strong></td>
                    <td>{{ fmt(resumenData.reduce((s,r)=>s+r.resultado_loteria,0)) }}</td>
                    <td>{{ fmt(resumenData.reduce((s,r)=>s+r.total_gastos,0)) }}</td>
                    <td>{{ fmt(resumenData.reduce((s,r)=>s+(r.participacion_op||0),0)) }}</td>
                    <td>{{ fmt(resumenData.reduce((s,r)=>s+(r.resultado_loteria-r.total_gastos-(r.participacion_op||0)),0)) }}</td>
                    <td>{{ fmt(resumenData.reduce((s,r)=>s+r.balance_pendiente_anterior,0)) }}</td>
                    <td>{{ fmt(resumenData.reduce((s,r)=>s+r.total_acumulado,0)) }}</td>
                    <td>{{ fmt(resumenData.reduce((s,r)=>s+r.entregado_supervisor,0)) }}</td>
                    <td>{{ fmt(resumenData.reduce((s,r)=>s+r.entregado_central,0)) }}</td>
                    <td>{{ fmt(resumenData.reduce((s,r)=>s+r.total_a_depositar,0)) }}</td>
                    <td>{{ fmt(resumenData.reduce((s,r)=>s+r.depositado,0)) }}</td>
                    <td>{{ fmt(resumenData.reduce((s,r)=>s+r.balance_final,0)) }}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ CUADRE SEMANAL ══ -->
      <div v-if="view==='cuadre'">
        <div class="section-header">
          <div>
            <div class="section-title">Cuadre Semanal</div>
            <div class="section-sub">Cuadre individual por grupo/supervisor</div>
          </div>
          <div style="display:flex;gap:10px">
            <select class="form-control" style="width:180px" v-model="cuadreGrupoId">
              <option value="">— Seleccionar Grupo —</option>
              <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
            </select>
            <select class="form-control" style="width:180px" v-model="cuadrePeriodoId">
              <option value="">— Período —</option>
              <option v-for="p in periodos" :key="p.id" :value="p.id">
                {{ p.descripcion || p.fecha_inicio }}
              </option>
            </select>
            <!-- Selector de banca para grupos individual_bancas -->
            <select v-if="grupos.find(g=>g.id===cuadreGrupoId)?.modo==='individual_bancas'"
                    class="form-control" style="width:200px" v-model="cuadreBancaId">
              <option value="">— Selecciona Banca —</option>
              <option v-for="b in bancas.filter(b=>b.grupo_id===cuadreGrupoId)" :key="b.id" :value="b.id">
                {{ b.codigo }} — {{ b.nombre }}
              </option>
            </select>
            <button class="btn btn-ghost btn-sm" @click="abrirNuevoGasto(cuadreGrupoId, cuadrePeriodoId)" title="Registrar gasto sin salir del cuadre">
              📋 Registrar Gasto
            </button>
            <button class="btn btn-primary" @click="loadCuadre"
              :disabled="!cuadreGrupoId||!cuadrePeriodoId||(grupos.find(g=>g.id===cuadreGrupoId)?.modo==='individual_bancas'&&!cuadreBancaId)">
              Cargar Cuadre
            </button>
            <span v-if="cuadreData?.editando" class="topbar-period" style="background:rgba(255,209,102,0.15);border-color:rgba(255,209,102,0.4);color:var(--yellow)">
              ✏️ Editando cuadre guardado
            </span>
            <button v-if="cuadreData" class="btn btn-ghost" @click="showReporte=true">
              🖨 Reporte
            </button>
          </div>
        </div>

        <div v-if="cuadreData" class="grid-2">
          <!-- BANCAS DEL GRUPO -->
          <div style="grid-column:1/-1">
            <div class="card">
              <div class="card-header">
                <div class="card-title">Bancas — {{ cuadreData.grupo?.nombre }}</div>
                <div class="topbar-period">{{ cuadreData.periodo?.descripcion || cuadreData.periodo?.fecha_inicio + ' al ' + cuadreData.periodo?.fecha_fin }}</div>
                <div v-if="cuadreData.esBancaIndividual" class="topbar-period" style="background:rgba(255,209,102,0.12);border-color:rgba(255,209,102,0.4);color:var(--yellow)">
                  🏦 {{ cuadreData.banca?.codigo }} — {{ cuadreData.banca?.nombre }}
                </div>
              </div>
              <div class="card-body" style="padding:0">
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Banca</th><th>Agencia</th><th>Ventas</th><th>Premios</th>
                        <th>Resultado</th><th>%</th><th>Comisión</th><th>Res. Lotería</th>
                        <th>Gastos Op.</th><th>Total Gastos</th><th>Avance</th><th>Res. Período</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="b in cuadreData.bancas" :key="b.id">
                        <td><strong>{{ b.codigo }}</strong></td>
                        <td>{{ b.nombre }}</td>
                        <td>{{ fmt(b.ventas) }}</td>
                        <td class="num-neg">{{ fmt(b.premios) }}</td>
                        <td :class="b.resultado>=0?'num-pos':'num-neg'">{{ fmt(b.resultado) }}</td>
                        <td>{{ b.porcentaje_comision }}%</td>
                        <td class="num-neg">{{ fmt(b.comision) }}</td>
                        <td :class="b.resultado_neto>=0?'num-pos':'num-neg'">{{ fmt(b.resultado_neto) }}</td>
                        <td class="num-neg">{{ fmt(b.gastos_op) }}</td>
                        <td class="num-neg">{{ fmt(b.total_gastos) }}</td>
                        <td :style="b.avance>0?'color:var(--blue);font-weight:500':''">{{ b.avance > 0 ? fmt(b.avance) : '-' }}</td>
                        <td :class="b.resultado_periodo>=0?'num-pos':'num-neg'">
                          <strong>{{ fmt(b.resultado_periodo) }}</strong>
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr class="summary-row">
                        <td colspan="2"><strong>TOTAL {{ cuadreData.grupo?.nombre }}</strong></td>
                        <td>{{ fmt(cuadreData.totals.ventas) }}</td>
                        <td>{{ fmt(cuadreData.totals.premios) }}</td>
                        <td>{{ fmt(cuadreData.totals.resultado) }}</td>
                        <td></td>
                        <td>{{ fmt(cuadreData.totals.comisiones) }}</td>
                        <td>{{ fmt(cuadreData.totals.resultado_loteria) }}</td>
                        <td>{{ fmt(cuadreData.totals.gastos_op) }}</td>
                        <td>{{ fmt(cuadreData.totals.total_gastos) }}</td>
                        <td style="color:var(--blue)">{{ fmt(cuadreData.totals.avances) }}</td>
                        <td>{{ fmt(cuadreData.totals.resultado_periodo) }}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- ══ GASTOS OPERATIVOS ══ -->
          <div class="card" v-if="cuadreData.gastosOperativos && cuadreData.gastosOperativos.length"
               style="border-color:rgba(76,201,240,0.25)">
            <div class="card-header" style="background:rgba(76,201,240,0.04)">
              <div>
                <div class="card-title" style="color:var(--blue)">📋 Gastos Operativos del Período</div>
                <div style="font-size:10px;color:var(--muted);margin-top:2px">
                  Solo gastos tipo <strong>Operativo</strong> — se descuentan del resultado del supervisor
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:12px">
                <span style="font-size:12px;font-weight:600;color:var(--red)">
                  − {{ fmt(cuadreData.totals.gastos_op) }}
                </span>
                <button class="btn btn-ghost btn-xs" @click="abrirNuevoGasto(cuadreGrupoId, cuadrePeriodoId)">
                  + Agregar
                </button>
              </div>
            </div>
            <div class="card-body" style="padding:0">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th>Categoría</th>
                    <th>Banca</th>
                    <th style="text-align:right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="g in cuadreData.gastosOperativos" :key="g.id">
                    <td style="color:var(--muted);font-size:11px">{{ g.fecha }}</td>
                    <td>
                      <span style="font-size:12px">{{ g.concepto }}</span>
                    </td>
                    <td>
                      <span v-if="g.categorias" class="tag tag-blue" style="font-size:9px">{{ g.categorias?.nombre || '—' }}</span>
                      <span v-else style="font-size:10px;color:var(--muted)">Sin categoría</span>
                    </td>
                    <td>
                      <span v-if="g._bancaCodigo" class="tag tag-gray" style="font-size:9px">
                        {{ g._bancaCodigo }} — {{ g._bancaNombre }}
                      </span>
                      <span v-else class="tag tag-yellow" style="font-size:9px" title="Gasto a nivel de grupo, no asignado a banca específica">
                        🏢 Grupo general
                      </span>
                    </td>
                    <td style="text-align:right">
                      <strong class="num-neg">{{ fmt(g.monto) }}</strong>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="summary-row">
                    <td colspan="4"><strong>TOTAL GASTOS OPERATIVOS</strong></td>
                    <td style="text-align:right">
                      <strong class="num-neg">{{ fmt(cuadreData.totals.gastos_op) }}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- Aviso si no hay gastos -->
          <div v-else-if="cuadreData && (!cuadreData.gastosOperativos || !cuadreData.gastosOperativos.length)"
               style="background:rgba(255,255,255,0.02);border:1px dashed var(--border2);border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:0">
            <span style="font-size:11px;color:var(--muted)">
              📋 Sin gastos operativos registrados para este período
            </span>
            <button class="btn btn-ghost btn-xs" @click="abrirNuevoGasto(cuadreGrupoId, cuadrePeriodoId)">
              + Registrar gasto
            </button>
          </div>

          <!-- BALANCES -->
          <div class="card">
            <div class="card-header"><div class="card-title">💰 Balances y Movimientos</div></div>
            <div class="card-body">
              <div class="cuadre-block">
                <div class="cuadre-block-title">Resultados Lotería</div>
                <div class="kv-row"><span class="kv-label">Ventas</span>
                  <span class="kv-value num-pos">{{ fmt(cuadreData.totals.ventas) }}</span></div>
                <div class="kv-row"><span class="kv-label">(-) Premios</span>
                  <span class="kv-value num-neg">{{ fmt(cuadreData.totals.premios) }}</span></div>
                <div class="kv-row"><span class="kv-label">(-) Comisiones</span>
                  <span class="kv-value num-neg">{{ fmt(cuadreData.totals.comisiones) }}</span></div>
                <!-- Subtotal antes de gastos — base de participación -->
                <div class="kv-row kv-total" style="background:rgba(0,229,160,0.06);margin-bottom:8px">
                  <span class="kv-label">
                    <strong>Resultado Lotería</strong>
                    <span style="display:block;font-size:9px;font-weight:normal;color:var(--muted)">Base para cálculo de participación</span>
                  </span>
                  <span :class="['kv-value', cuadreData.totals.resultado_loteria>=0?'num-pos':'num-neg']">
                    <strong>{{ fmt(cuadreData.totals.resultado_loteria) }}</strong>
                  </span>
                </div>
                <!-- Gastos operativos solo si existen -->
                <div v-if="cuadreData.totals.total_gastos > 0">
                  <div class="kv-row"><span class="kv-label" style="color:var(--blue)">(-) Gastos Operativos</span>
                    <span class="kv-value num-neg">{{ fmt(cuadreData.totals.total_gastos) }}</span></div>
                  <div class="kv-row kv-total"><span class="kv-label"><strong>Resultado Período</strong></span>
                    <span :class="['kv-value', cuadreData.totals.resultado_periodo>=0?'num-pos':'num-neg']">
                      <strong>{{ fmt(cuadreData.totals.resultado_periodo) }}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Participación — con arrastre, no muestra cálculo si base negativa -->
              <div class="cuadre-block" :style="calcParticipacion>0 ? 'border-color:rgba(255,209,102,0.35)' : 'border-color:rgba(255,255,255,0.06)'">
                <div class="cuadre-block-title" style="color:var(--yellow)">Participación del Supervisor</div>

                <!-- Desglose de la base solo si hay arrastre -->
                <div v-if="cuadreFrm.arrastre_participacion !== 0">
                  <div class="kv-row">
                    <span class="kv-label">Resultado Lotería esta semana</span>
                    <span :class="['kv-value', cuadreData.totals.resultado_loteria>=0?'num-pos':'num-neg']">{{ fmt(cuadreData.totals.resultado_loteria) }}</span>
                  </div>
                  <div class="kv-row">
                    <span class="kv-label">{{ cuadreFrm.arrastre_participacion < 0 ? '(+/−) Arrastre período anterior (déficit)' : '(+) Arrastre período anterior' }}</span>
                    <span :class="['kv-value', cuadreFrm.arrastre_participacion>=0?'num-pos':'num-neg']">{{ fmt(cuadreFrm.arrastre_participacion) }}</span>
                  </div>
                </div>
                <div v-else class="kv-row">
                  <span class="kv-label">Resultado Lotería (base participación)</span>
                  <span :class="['kv-value', cuadreData.totals.resultado_loteria>=0?'num-pos':'num-neg']">{{ fmt(cuadreData.totals.resultado_loteria) }}</span>
                </div>

                <!-- Base acumulada con arrastre -->
                <div class="kv-row" style="margin-top:4px">
                  <span class="kv-label"><strong>Base acumulada</strong></span>
                  <span :class="['kv-value', calcBaseParticipacion>=0?'num-pos':'num-neg']"><strong>{{ fmt(calcBaseParticipacion) }}</strong></span>
                </div>

                <!-- SI BASE POSITIVA: mostrar cálculo y resultado -->
                <template v-if="calcBaseParticipacion > 0">
                  <div class="kv-row" style="margin-top:2px">
                    <span class="kv-label">% Participación acordado</span>
                    <span class="kv-value" style="color:var(--yellow)">{{ cuadreData.grupo?.porcentaje_participacion || 0 }}%</span>
                  </div>
                  <div class="kv-row kv-total" style="background:rgba(255,209,102,0.08);border:1px solid rgba(255,209,102,0.25);margin-top:6px">
                    <span class="kv-label">
                      <strong>Participación a Pagar</strong>
                      <span style="display:block;font-size:9px;font-weight:normal;color:var(--muted)">Supervisor retiene este monto</span>
                    </span>
                    <span class="kv-value" style="color:var(--yellow)"><strong>{{ fmt(calcParticipacion) }}</strong></span>
                  </div>
                  <div class="kv-row kv-total" style="margin-top:6px">
                    <span class="kv-label"><strong>Resultado Neto para Central</strong></span>
                    <span :class="['kv-value', (cuadreData.totals.resultado_periodo - calcParticipacion)>=0?'num-pos':'num-neg']">
                      <strong>{{ fmt(cuadreData.totals.resultado_periodo - calcParticipacion) }}</strong>
                    </span>
                  </div>
                


</template>

                <!-- SI BASE NEGATIVA/CERO: mensaje claro, sin cálculo -->
                <div v-else class="alert" style="margin-top:8px;margin-bottom:0;font-size:11px;background:rgba(255,77,109,0.07);border:1px solid rgba(255,77,109,0.2);color:var(--red)">
                  🔴 Base acumulada negativa — <strong>sin participación esta semana.</strong>
                  El déficit de <strong>{{ fmt(calcBaseParticipacion) }}</strong> se arrastrará al próximo período.
                </div>
              </div>

              <div class="cuadre-block">
                <div class="cuadre-block-title">Balance Acumulado</div>
                <div class="kv-row"><span class="kv-label">Balance Anterior</span>
                  <span class="kv-value">{{ fmt(cuadreFrm.balance_anterior) }}</span></div>
                <div class="kv-row"><span class="kv-label">Resultado Semana</span>
                  <span :class="['kv-value', cuadreData.totals.resultado_periodo>=0?'num-pos':'num-neg']">{{ fmt(cuadreData.totals.resultado_periodo) }}</span></div>
                <div class="kv-row kv-total"><span class="kv-label"><strong>Total Acumulado</strong></span>
                  <span :class="['kv-value', (cuadreFrm.balance_anterior+cuadreData.totals.resultado_periodo)>=0?'num-pos':'num-neg']"><strong>{{ fmt(cuadreFrm.balance_anterior + cuadreData.totals.resultado_periodo) }}</strong></span></div>
              </div>

              <!-- ── MOVIMIENTOS DE SEMANA (avances + pagos mid-week) ── -->
              <div class="cuadre-block" style="border-color:rgba(76,201,240,0.3)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                  <div class="cuadre-block-title" style="color:var(--blue);margin-bottom:0">💱 Movimientos de Semana</div>
                  <button class="btn btn-ghost btn-xs" @click="abrirMovRapido">+ Agregar</button>
                </div>

                <!-- Lista de movimientos registrados -->
                <div v-if="cuadreData.movimientos && cuadreData.movimientos.length > 0">
                  <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:8px">
                    <thead><tr style="background:rgba(255,255,255,0.03)">
                      <th style="padding:4px 8px;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:1px">Fecha</th>
                      <th style="padding:4px 8px;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:1px">Concepto</th>
                      <th style="padding:4px 8px;text-align:center;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:1px">Tipo</th>
                      <th style="padding:4px 8px;text-align:right;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:1px">Monto</th>
                    </tr></thead>
                    <tbody>
                      <tr v-for="m in cuadreData.movimientos" :key="m.id" style="border-bottom:1px solid rgba(255,255,255,0.03)">
                        <td style="padding:5px 8px;color:var(--muted)">{{ m.fecha }}</td>
                        <td style="padding:5px 8px">{{ m.concepto || (m.tipo==='salida' ? 'Avance entregado' : 'Pago recibido') }}</td>
                        <td style="padding:5px 8px;text-align:center">
                          <span :class="m.tipo==='salida'?'tag tag-red':'tag tag-green'" style="font-size:9px">
                            {{ m.tipo==='salida' ? '↑ Avance/Préstamo' : '↓ Pago Recibido' }}
                          </span>
                        </td>
                        <td
                            :style="'padding:5px 8px;text-align:right;font-weight:600;' + (m.tipo==='salida'?'color:var(--red)':'color:var(--accent)')">
                          {{ m.tipo==='salida' ? '-' : '+' }}{{ fmt(m.monto) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <!-- Totales de movimientos -->
                  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px">
                    <div style="background:rgba(255,77,109,0.08);border:1px solid rgba(255,77,109,0.2);border-radius:6px;padding:8px;text-align:center">
                      <div style="color:var(--muted);font-size:9px;letter-spacing:1px;margin-bottom:2px">ENTREGADO</div>
                      <div style="color:var(--red);font-weight:700">{{ fmt(cuadreData.movSalidas) }}</div>
                    </div>
                    <div style="background:rgba(0,229,160,0.08);border:1px solid rgba(0,229,160,0.2);border-radius:6px;padding:8px;text-align:center">
                      <div style="color:var(--muted);font-size:9px;letter-spacing:1px;margin-bottom:2px">RECIBIDO</div>
                      <div style="color:var(--accent);font-weight:700">{{ fmt(cuadreData.movEntradas) }}</div>
                    </div>
                    <div style="background:rgba(76,201,240,0.08);border:1px solid rgba(76,201,240,0.2);border-radius:6px;padding:8px;text-align:center">
                      <div style="color:var(--muted);font-size:9px;letter-spacing:1px;margin-bottom:2px">NETO</div>
                      <div :style="cuadreData.movNeto>0?'color:var(--red);font-weight:700':'color:var(--accent);font-weight:700'">
                        {{ cuadreData.movNeto > 0 ? '-' : '+' }}{{ fmt(Math.abs(cuadreData.movNeto)) }}
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else style="text-align:center;color:var(--muted);font-size:11px;padding:12px 0">
                  Sin movimientos registrados esta semana
                </div>

                <!-- Ajuste manual si hay diferencia -->
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
                  <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">
                    Valores auto-cargados desde movimientos (ajusta si hay diferencia)
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">Total Entregado (salidas)</label>
                      <input type="number" class="form-control" v-model.number="cuadreFrm.entregado_supervisor" placeholder="0"/>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Total Recibido (entradas)</label>
                      <input type="number" class="form-control" v-model.number="cuadreFrm.entregado_central" placeholder="0"/>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── RESUMEN DE BALANCE (según fórmula) ── -->
              <div class="cuadre-block" style="background:rgba(0,0,0,0.2)">
                <div class="cuadre-block-title">Resumen de Posición</div>

                <!-- Bloque 1: P&L -->
                <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin:0 0 4px 0">Resultado del Período</div>
                <div class="kv-row" style="align-items:center">
                  <span class="kv-label">Balance Pendiente Período Anterior
                    <span :style="'display:block;font-size:9px;font-weight:normal;' + (balanceAnteriorManual?'color:#f0a500':'color:var(--muted)')">
                      {{ balanceAnteriorManual ? '✏️ Editable — primer cuadre sin historial' : '🔒 Auto-cargado del cuadre anterior' }}
                    </span>
                  </span>
                  <input type="number" style="width:130px;text-align:right;font-weight:600;padding:4px 8px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-size:13px" v-model.number="cuadreFrm.balance_anterior" :disabled="!balanceAnteriorManual" :title="balanceAnteriorManual ? 'Editable: primer cuadre sin historial' : 'Auto-cargado del cuadre anterior'"/>
                </div>
                <div class="kv-row"><span class="kv-label">Resultado Final (P&L semana)</span>
                  <span :class="['kv-value', cuadreData.totals.resultado_periodo>=0?'num-pos':'num-neg']">{{ fmt(cuadreData.totals.resultado_periodo) }}</span></div>
                <div class="kv-row kv-total"><span class="kv-label"><strong>Total Acumulado</strong></span>
                  <span :class="['kv-value', (cuadreFrm.balance_anterior+cuadreData.totals.resultado_periodo)>=0?'num-pos':'num-neg']">
                    <strong>{{ fmt(cuadreFrm.balance_anterior + cuadreData.totals.resultado_periodo) }}</strong></span></div>

                <!-- Bloque 2: Movimientos -->
                <div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin:10px 0 4px 0">Movimientos de Efectivo</div>
                <div class="kv-row" v-if="cuadreFrm.entregado_supervisor > 0">
                  <span class="kv-label">(+) Entregado Préstamo (a supervisor)</span>
                  <span class="kv-value num-neg">{{ fmt(cuadreFrm.entregado_supervisor) }}</span>
                </div>
                <div class="kv-row" v-if="cuadreFrm.entregado_central > 0">
                  <span class="kv-label">(-) Transferencia Admin (de supervisor)</span>
                  <span class="kv-value num-pos">{{ fmt(cuadreFrm.entregado_central) }}</span>
                </div>
                <div class="kv-row kv-total">
                  <span class="kv-label"><strong>Total a Depositar / Transferir</strong></span>
                  <span :class="['kv-value', calcTotalDepositar>=0?'num-pos':'num-neg']"><strong>{{ fmt(calcTotalDepositar) }}</strong></span>
                </div>
                <div v-if="calcParticipacion > 0" class="kv-row" style="margin-top:4px">
                  <span class="kv-label" style="color:var(--yellow)">(-) Participación Supervisor ({{ cuadreData.grupo?.porcentaje_participacion }}%)</span>
                  <span class="kv-value" style="color:var(--yellow)">{{ fmt(calcParticipacion) }}</span>
                </div>
                <div class="kv-row kv-total" style="background:rgba(0,229,160,0.12);border:1px solid rgba(0,229,160,0.35);margin-top:6px">
                  <span class="kv-label">
                    <strong>💵 MONTO ENTREGADO</strong>
                    <span style="display:block;font-size:9px;font-weight:normal;color:var(--muted)">+ supervisor deposita | - admin paga al supervisor</span>
                  </span>
                  <span :class="['kv-value', calcMontoEntregaSupervisor>=0?'num-pos':'num-neg']"><strong>{{ fmt(calcMontoEntregaSupervisor) }}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <!-- CIERRE -->
          <div class="card">
            <div class="card-header"><div class="card-title">🔒 Cierre del Cuadre</div></div>
            <div class="card-body">
              <div class="cuadre-block">
                <div class="cuadre-block-title">Registro de Pago Final</div>
                <div class="kv-row" style="margin-bottom:8px;background:rgba(0,229,160,0.08);border-radius:4px;padding:8px">
                  <span class="kv-label">
                    <strong>MONTO ENTREGADO esperado</strong>
                    <span style="display:block;font-size:10px;font-weight:normal;color:var(--muted)">
                      {{ calcMontoEntregaSupervisor >= 0 ? '✅ Supervisor deposita este monto' : '🔴 Central paga este monto al supervisor' }}
                    </span>
                  </span>
                  <span :class="['kv-value', calcMontoEntregaSupervisor>=0?'num-pos':'num-neg']"><strong>{{ fmt(calcMontoEntregaSupervisor) }}</strong></span>
                </div>
                <div class="form-group" style="margin-bottom:12px">
                  <label class="form-label">Monto Real Depositado / Transferido</label>
                  <input type="number" class="form-control" v-model.number="cuadreFrm.depositado" placeholder="0"/>
                </div>
                <div class="kv-row kv-total" style="border:2px solid var(--accent);background:rgba(0,229,160,0.08)">
                  <span class="kv-label"><strong>BALANCE (próximo cuadre)</strong>
                    <span style="display:block;font-size:9px;font-weight:normal;color:var(--muted)">Total a Depositar - Monto Entregado</span>
                  </span>
                  <span :class="['kv-value', calcBalanceFinal>=0?'num-pos':'num-neg']">
                    <strong>{{ fmt(calcBalanceFinal) }}</strong>
                  </span>
                </div>
              </div>
              <div class="cuadre-block">
                <div class="cuadre-block-title">Participación de Beneficio</div>
                <div class="kv-row" style="align-items:center">
                  <span class="kv-label">Arrastre Anterior Participación
                    <span :style="'display:block;font-size:9px;font-weight:normal;' + (arrastrePartManual?'color:#f0a500':'color:var(--muted)')">
                      {{ arrastrePartManual ? '✏️ Editable — primer cuadre sin historial' : '🔒 Auto-cargado del período anterior' }}
                    </span>
                  </span>
                  <input type="number" style="width:130px;text-align:right;font-weight:600;padding:4px 8px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-size:13px" v-model.number="cuadreFrm.arrastre_participacion" :disabled="!arrastrePartManual" :title="arrastrePartManual ? 'Editable: primer cuadre sin historial' : 'Auto-cargado del período anterior'"/>
                </div>
                <div class="kv-row">
                  <span class="kv-label">Balance Participación</span>
                  <span :class="['kv-value', calcBaseParticipacion>=0?'num-pos':'num-neg']">{{ fmt(calcBaseParticipacion) }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-label">Porcentaje</span>
                  <span class="kv-value">{{ cuadreData.grupo?.porcentaje_participacion }}%</span>
                </div>
                <div class="kv-row kv-total">
                  <span class="kv-label"><strong>A Pagar Participación</strong></span>
                  <span :class="['kv-value', calcParticipacion>0?'num-pos':'']">
                    <strong>{{ fmt(calcParticipacion) }}</strong>
                  </span>
                </div>
                <div v-if="calcParticipacion<=0" class="alert alert-info" style="margin-top:12px;margin-bottom:0">
                  ℹ️ Arrastre negativo — sin pago esta semana
                </div>
                <div v-else style="margin-top:12px">
                  <div class="form-group">
                    <label class="form-label">Participación Pagada</label>
                    <input type="number" class="form-control" v-model.number="cuadreFrm.participacion_pagada" placeholder="0" :max="calcParticipacion"/>
                  </div>
                </div>
              </div>
              <div class="form-group" style="margin-bottom:16px">
                <label class="form-label">Notas del Cuadre</label>
                <input type="text" class="form-control" v-model="cuadreFrm.notas" placeholder="Observaciones..."/>
              </div>
              <button class="btn btn-primary" style="width:100%" @click="saveCuadre" :disabled="savingCuadre">
                {{ savingCuadre ? '⏳ Guardando...' : '💾 Guardar Cuadre' }}
              </button>
            </div>
          </div>
        </div>

        <div v-else class="empty">
          <div class="empty-icon">⚖️</div>
          <p>Selecciona un grupo y período para cargar el cuadre</p>
        </div>

        <!-- Modal: Agregar movimiento rápido desde el cuadre -->
        <div class="overlay" v-if="showMovRapido" @click.self="showMovRapido=false">
          <div class="modal" style="max-width:480px">
            <div class="modal-header">
              <div class="modal-title">💱 Registrar Movimiento de Semana</div>
              <button class="close-btn" @click="showMovRapido=false">✕</button>
            </div>
            <div class="modal-body">
              <div class="alert alert-info" style="font-size:11px;margin-bottom:14px">
                <strong>Avance/Préstamo:</strong> dinero que se le entregó al supervisor cuando una banca perdió.<br/>
                <strong>Pago Recibido:</strong> dinero que el supervisor entregó antes del cuadre porque las bancas generaron ganancias.
              </div>
              <div class="form-grid">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Fecha del Movimiento</label>
                    <input type="date" class="form-control" v-model="movRapidoFrm.fecha"/>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Tipo</label>
                    <select class="form-control" v-model="movRapidoFrm.tipo" style="font-size:13px">
                      <option value="salida">↑ Avance / Préstamo (salida)</option>
                      <option value="entrada">↓ Pago Recibido (entrada)</option>
                    </select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Monto</label>
                    <input type="number" class="form-control" v-model.number="movRapidoFrm.monto" placeholder="0" ref="movMontoInput"/>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Concepto</label>
                    <input type="text" class="form-control" v-model="movRapidoFrm.concepto" placeholder="Ej: Banca 01 perdió jueves"/>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showMovRapido=false">Cancelar</button>
              <button class="btn btn-primary" @click="saveMovRapido">💾 Guardar Movimiento</button>
            </div>
          </div>
        </div>
      </div>


    <div class="overlay" v-if="showReporte && cuadreData" @click.self="showReporte=false">
      <div class="modal report-modal">
        <div class="modal-header">
          <div class="modal-title">📄 Reporte de Cuadre Semanal</div>
          <button class="close-btn" @click="showReporte=false">✕</button>
        </div>

        <!-- Contenido del reporte -->
        <div id="printContent" class="report-wrap">
          <div class="report-header">
            <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:4px">CUADRE SEMANAL</div>
            <h2>GRUPO {{ cuadreData.grupo?.nombre?.toUpperCase() }}</h2>
            <h3>{{ cuadreData.periodo?.descripcion || (cuadreData.periodo?.fecha_inicio + ' al ' + cuadreData.periodo?.fecha_fin) }}</h3>
            <div class="report-meta">Generado: {{ new Date().toLocaleDateString('es-DO', {weekday:'long',year:'numeric',month:'long',day:'numeric'}) }}</div>
          </div>

          <!-- Tabla de Bancas -->
          <div class="report-section">
            <div class="report-section-title">Detalle de Bancas</div>
            <table class="report-table">
              <thead>
                <tr>
                  <th>Cód.</th><th>Banca / Agencia</th>
                  <th style="text-align:right">Ventas</th>
                  <th style="text-align:right">Premios</th>
                  <th style="text-align:right">Resultado</th>
                  <th style="text-align:center">%</th>
                  <th style="text-align:right">Comisión</th>
                  <th style="text-align:right">Res. Lotería</th>
                  <th style="text-align:right">Gastos Op.</th>
                  <th style="text-align:right">Res. Período</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in cuadreData.bancas" :key="b.id">
                  <td>{{ b.codigo }}</td>
                  <td>{{ b.nombre }}</td>
                  <td style="text-align:right">{{ fmt(b.ventas) }}</td>
                  <td style="text-align:right" :style="b.premios>0?'color:#cc0033':''">{{ fmt(b.premios) }}</td>
                  <td style="text-align:right" :style="b.resultado<0?'color:#cc0033':'color:#00854a'">{{ fmt(b.resultado) }}</td>
                  <td style="text-align:center">{{ b.porcentaje_comision }}%</td>
                  <td style="text-align:right;color:#cc0033">{{ fmt(b.comision) }}</td>
                  <td style="text-align:right" :style="b.resultado_neto<0?'color:#cc0033':'color:#00854a'">{{ fmt(b.resultado_neto) }}</td>
                  <td style="text-align:right;color:#cc0033">{{ fmt(b.total_gastos) }}</td>
                  <td style="text-align:right;font-weight:700" :style="b.resultado_periodo<0?'color:#cc0033':'color:#00854a'">{{ fmt(b.resultado_periodo) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2">TOTAL</td>
                  <td style="text-align:right">{{ fmt(cuadreData.totals.ventas) }}</td>
                  <td style="text-align:right">{{ fmt(cuadreData.totals.premios) }}</td>
                  <td style="text-align:right">{{ fmt(cuadreData.totals.resultado) }}</td>
                  <td></td>
                  <td style="text-align:right">{{ fmt(cuadreData.totals.comisiones) }}</td>
                  <td style="text-align:right">{{ fmt(cuadreData.totals.resultado_loteria) }}</td>
                  <td style="text-align:right">{{ fmt(cuadreData.totals.total_gastos) }}</td>
                  <td style="text-align:right">{{ fmt(cuadreData.totals.resultado_periodo) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Resumen financiero en 2 columnas -->
          <div class="report-two-col">
            <!-- Columna izquierda: Resultado y Participación -->
            <div>
              <div class="report-section-title">Resumen de Resultado</div>
              <div class="report-box">
                <div class="report-kv"><span class="lbl">Ventas totales</span><span class="val pos">{{ fmt(cuadreData.totals.ventas) }}</span></div>
                <div class="report-kv"><span class="lbl">(-) Premios pagados</span><span class="val neg">{{ fmt(cuadreData.totals.premios) }}</span></div>
                <div class="report-kv"><span class="lbl">(-) Comisiones vendedores</span><span class="val neg">{{ fmt(cuadreData.totals.comisiones) }}</span></div>
                <div class="report-kv total-row" style="background:#f0f7ff;border:1px solid #c8d8f0">
                  <span class="lbl"><strong>Resultado Lotería</strong><span style="font-weight:normal;font-size:9px;display:block;color:#555">Base para cálculo de participación</span></span>
                  <span :class="['val', cuadreData.totals.resultado_loteria>=0?'pos':'neg']"><strong>{{ fmt(cuadreData.totals.resultado_loteria) }}</strong></span>
                </div>
                <div v-if="cuadreData.totals.total_gastos > 0">
                  <div class="report-kv" style="margin-top:4px"><span class="lbl">(-) Gastos operativos</span><span class="val neg">{{ fmt(cuadreData.totals.total_gastos) }}</span></div>
                  <div class="report-kv total-row">
                    <span class="lbl"><strong>Resultado del Período</strong></span>
                    <span :class="['val', cuadreData.totals.resultado_periodo>=0?'pos':'neg']"><strong>{{ fmt(cuadreData.totals.resultado_periodo) }}</strong></span>
                  </div>
                </div>
              </div>

              <div class="report-section-title" style="margin-top:10px">Participación Supervisor</div>
              <div class="report-box">
                <!-- Base siempre visible -->
                <div v-if="cuadreFrm.arrastre_participacion !== 0">
                  <div class="report-kv">
                    <span class="lbl">Resultado Lotería esta semana</span>
                    <span :class="['val', cuadreData.totals.resultado_loteria>=0?'pos':'neg']">{{ fmt(cuadreData.totals.resultado_loteria) }}</span>
                  </div>
                  <div class="report-kv">
                    <span class="lbl">{{ cuadreFrm.arrastre_participacion < 0 ? '(+/−) Arrastre anterior (déficit)' : '(+) Arrastre período anterior' }}</span>
                    <span :class="['val', cuadreFrm.arrastre_participacion<0?'neg':'pos']">{{ fmt(cuadreFrm.arrastre_participacion) }}</span>
                  </div>
                </div>
                <div v-else class="report-kv">
                  <span class="lbl">Resultado Lotería (base participación)</span>
                  <span :class="['val', cuadreData.totals.resultado_loteria>=0?'pos':'neg']">{{ fmt(cuadreData.totals.resultado_loteria) }}</span>
                </div>
                <div class="report-kv" style="border-bottom:1px solid #ccc">
                  <span class="lbl"><strong>Base acumulada</strong></span>
                  <span :class="['val', calcBaseParticipacion>=0?'pos':'neg']"><strong>{{ fmt(calcBaseParticipacion) }}</strong></span>
                </div>
                <div class="report-kv"><span class="lbl">% Participación acordado</span><span class="val">{{ cuadreData.grupo?.porcentaje_participacion || 0 }}%</span></div>

                <!-- SI BASE POSITIVA: participación aplica -->
                <template v-if="calcBaseParticipacion > 0">
                  <div class="report-highlight" style="margin-top:6px">
                    <div class="report-kv" style="border:none;padding:0">
                      <span class="lbl">Participación a pagar (supervisor retiene)</span>
                      <span class="val">{{ fmt(calcParticipacion) }}</span>
                    </div>
                  </div>
                  <div class="report-kv total-row">
                    <span class="lbl"><strong>Neto para Central</strong></span>
                    <span :class="['val', (cuadreData.totals.resultado_periodo - calcParticipacion)>=0?'pos':'neg']">
                      <strong>{{ fmt(cuadreData.totals.resultado_periodo - calcParticipacion) }}</strong>
                    </span>
                  </div>
                


</template>

                <!-- SI BASE NEGATIVA: sin participación, claro y sin cálculo -->
                <div v-else style="margin-top:8px;padding:6px 8px;background:#fff3f3;border:1px solid #f5c6cb;border-radius:4px;font-size:11px;color:#a00">
                  🔴 Base acumulada negativa — <strong>sin participación esta semana.</strong><br/>
                  El déficit de <strong>{{ fmt(calcBaseParticipacion) }}</strong> se arrastra al próximo período.
                </div>
              </div>
            </div>

            <!-- Columna derecha: Balance y Cierre (fórmula imagen) -->
            <div>
              <div class="report-section-title">Balance y Cierre</div>
              <div class="report-box">
                <div class="report-kv"><span class="lbl">Balance Pendiente Período Anterior</span><span :class="['val', cuadreFrm.balance_anterior<0?'neg':'']">{{ fmt(cuadreFrm.balance_anterior) }}</span></div>
                <div class="report-kv">
                  <span class="lbl">Resultado Período<span style="font-weight:normal;font-size:9px;display:block;color:#888">después de gastos operativos</span></span>
                  <span :class="['val', cuadreData.totals.resultado_periodo>=0?'pos':'neg']">{{ fmt(cuadreData.totals.resultado_periodo) }}</span>
                </div>
                <div class="report-kv total-row"><span class="lbl"><strong>Total Acumulado</strong></span><span :class="['val', (cuadreFrm.balance_anterior+cuadreData.totals.resultado_periodo)>=0?'pos':'neg']"><strong>{{ fmt(cuadreFrm.balance_anterior + cuadreData.totals.resultado_periodo) }}</strong></span></div>
              </div>
              <div class="report-box" style="margin-top:8px">
                <div class="report-kv" v-if="cuadreFrm.entregado_supervisor>0">
                  <span class="lbl">(+) Entregado Préstamo (a supervisor)</span>
                  <span class="val neg">{{ fmt(cuadreFrm.entregado_supervisor) }}</span>
                </div>
                <div class="report-kv" v-if="cuadreFrm.entregado_central>0">
                  <span class="lbl">(-) Transferencia Administración (de supervisor)</span>
                  <span class="val pos">{{ fmt(cuadreFrm.entregado_central) }}</span>
                </div>
                <div class="report-kv total-row"><span class="lbl"><strong>Total a Depositar / Transferir</strong></span><span :class="['val', calcTotalDepositar>=0?'pos':'neg']"><strong>{{ fmt(calcTotalDepositar) }}</strong></span></div>
                <div v-if="calcParticipacion>0" class="report-kv"><span class="lbl" style="color:#996600">(-) Participación Supervisor ({{ cuadreData.grupo?.porcentaje_participacion }}%)</span><span class="val" style="color:#996600">{{ fmt(calcParticipacion) }}</span></div>
                <div class="report-kv" style="background:#e6f9f2;font-weight:700;border:1px solid #00854a;margin-top:4px">
                  <span class="lbl"><strong>MONTO ENTREGADO</strong><span style="font-weight:normal;font-size:9px;display:block;color:#444"> (+ supervisor deposita / - admin paga)</span></span>
                  <span :class="['val', calcMontoEntregaSupervisor>=0?'pos':'neg']"><strong>{{ fmt(calcMontoEntregaSupervisor) }}</strong></span>
                </div>
                <div class="report-kv" style="margin-top:6px"><span class="lbl">(-) Depositado / Transferido</span><span class="val pos">{{ fmt(cuadreFrm.depositado) }}</span></div>
                <div class="report-kv total-row" style="border:2px solid #111;background:#111;color:#fff">
                  <span class="lbl" style="color:#fff"><strong>BALANCE (próximo cuadre)</strong></span>
                  <span :class="['val', calcBalanceFinal>=0?'pos':'neg']"><strong>{{ fmt(calcBalanceFinal) }}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="cuadreFrm.notas" style="margin-top:12px;padding:10px 12px;background:#f9f9f9;border-radius:4px;border:1px solid #ddd;font-size:12px">
            <strong>Notas:</strong> {{ cuadreFrm.notas }}
          </div>

          <div class="report-footer">
            LottoAdmin — Cuadre Semanal | Grupo {{ cuadreData.grupo?.nombre }} | {{ cuadreData.periodo?.descripcion }}
          </div>
        </div>

        <!-- Acciones del reporte -->
        <div class="report-actions">
          <button class="btn btn-primary" @click="printReport">🖨 Imprimir / Guardar PDF</button>
          <button class="btn btn-ghost" @click="copyWhatsapp">📱 Copiar para WhatsApp</button>
          <button class="btn btn-ghost" @click="showReporte=false" style="margin-left:auto">Cerrar</button>
        </div>
      </div>
    </div>

      <!-- ══ IMPORTAR VENTAS ══ -->
      <div v-if="view==='importar'">
        <div class="section-header">
          <div>
            <div class="section-title">Importar Ventas</div>
            <div class="section-sub">Carga el archivo Excel exportado del sistema — solo se importan Ventas y Premios</div>
          </div>
        </div>

        <div class="grid-2" style="margin-bottom:20px">
          <!-- ── Cargar Archivo ── -->
          <div class="card">
            <div class="card-header"><div class="card-title">📥 Cargar Archivo Excel (.xlsx)</div></div>
            <div class="card-body">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">1. Seleccionar Período de destino</label>
                  <select class="form-control" v-model="importPeriodoId" @change="checkImportDuplicado">
                    <option value="">— Seleccionar Período —</option>
                    <option v-for="p in periodos" :key="p.id" :value="p.id">
                      {{ p.descripcion || p.fecha_inicio }}
                    </option>
                  </select>
                </div>

                <!-- Alerta duplicado -->
                <div v-if="importDuplicado" class="alert alert-error" style="font-size:11px">
                  ⚠️ <strong>Este período ya tiene {{ importDuplicadoCount }} registros importados.</strong><br/>
                  Para reimportar, primero borra los datos anteriores.
                  <button class="btn btn-danger btn-sm" style="margin-top:8px;width:100%" @click="borrarImportacion">
                    🗑️ Borrar importación anterior y cargar de nuevo
                  </button>
                </div>
                <!-- Botón borrar visible siempre que haya data (aunque no esté en flujo duplicado) -->
                <div v-if="importPeriodoId && !importDuplicado && importPeriodoTieneData">
                  <button class="btn btn-danger btn-sm" style="width:100%" @click="borrarImportacion">
                    🗑️ Borrar datos importados de este período
                  </button>
                </div>

                <div class="form-group">
                  <label class="form-label">2. Seleccionar archivo .xlsx</label>
                  <input type="file" class="form-control" accept=".xlsx,.xls,.csv" @change="handleFile" ref="fileInput"
                    :disabled="importDuplicado"/>
                  <div style="font-size:10px;color:var(--muted);margin-top:4px">
                    Columnas requeridas: <strong>Usuario, Ventas, Premios</strong>
                  </div>
                </div>

                <div v-if="importPreview.length" class="alert alert-info" style="font-size:11px">
                  ✅ <strong>{{ importPreview.length }} bancas detectadas</strong> —
                  {{ importPreview.filter(r=>r._banca).length }} mapeadas correctamente,
                  {{ importPreview.filter(r=>!r._banca).length }} sin mapear
                </div>

                <div style="display:flex;gap:8px">
                  <button class="btn btn-ghost btn-sm" v-if="importPreview.length" @click="importPreview=[];importDuplicado=false">
                    ✕ Limpiar
                  </button>
                  <button class="btn btn-primary" style="flex:1"
                    @click="processImport"
                    :disabled="!importPreview.length || !importPeriodoId || importando || importDuplicado || !importPreview.some(r=>r._banca && r._incluir)">
                    {{ importando ? '⏳ Importando...' : '✅ Confirmar e Importar' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Ingreso Manual ── -->
          <div class="card">
            <div class="card-header"><div class="card-title">📝 Ingreso Manual de Venta</div></div>
            <div class="card-body">
              <div class="form-grid">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Período</label>
                    <select class="form-control" v-model="manualVenta.periodo_id">
                      <option value="">— Período —</option>
                      <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Banca</label>
                    <select class="form-control" v-model="manualVenta.banca_id">
                      <option value="">— Banca —</option>
                      <option v-for="b in bancas" :key="b.id" :value="b.id">{{ b.codigo }} — {{ b.nombre }}</option>
                    </select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Ventas RD$</label>
                    <input type="number" class="form-control" v-model.number="manualVenta.ventas" placeholder="0"/>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Premios RD$</label>
                    <input type="number" class="form-control" v-model.number="manualVenta.premios" placeholder="0"/>
                  </div>
                </div>
                <div class="alert alert-info" style="font-size:11px;margin-top:4px">
                  💡 Recargas, servicios y avances se registran por <strong>Gastos</strong> o <strong>Movimientos de Semana</strong>
                </div>
                <button class="btn btn-primary" @click="saveManualVenta" :disabled="!manualVenta.banca_id||!manualVenta.periodo_id">
                  💾 Guardar Venta
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Preview editable ── -->
        <div v-if="importPreview.length" class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Vista Previa — Revisa y edita antes de confirmar</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">
                Puedes editar Ventas/Premios y excluir filas individualmente antes de importar
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <span style="font-size:11px;color:var(--muted)">
                Total ventas: <strong style="color:var(--accent)">{{ fmt(importPreview.filter(r=>r._incluir).reduce((s,r)=>s+r.ventas,0)) }}</strong>
              </span>
            </div>
          </div>
          <div class="card-body" style="padding:0;max-height:520px;overflow-y:auto">
            <table>
              <thead><tr style="position:sticky;top:0;z-index:2;background:var(--surface2)">
                <th style="width:36px;text-align:center">✓</th>
                <th>Usuario</th>
                <th>Agencia</th>
                <th>Banca mapeada</th>
                <th style="text-align:right">Ventas</th>
                <th style="text-align:right">Premios</th>
                <th>Estado</th>
              </tr></thead>
              <tbody>
                <tr v-for="(r,i) in importPreview" :key="i"
                    :style="!r._banca ? 'opacity:0.5;background:rgba(255,77,109,0.04)' : ''">
                  <td style="text-align:center">
                    <input type="checkbox" v-model="r._incluir" :disabled="!r._banca" style="accent-color:var(--accent)"/>
                  </td>
                  <td><code style="font-size:11px">{{ r.usuario }}</code></td>
                  <td style="font-size:11px;color:var(--muted)">{{ r.agencia }}</td>
                  <td>
                    <span v-if="r._banca" class="tag tag-green" style="font-size:10px">
                      {{ r._banca.codigo }} — {{ r._banca.nombre }}
                    </span>
                    <span v-else class="tag tag-red" style="font-size:10px">Sin mapear</span>
                  </td>
                  <td style="text-align:right">
                    <input type="number" v-model.number="r.ventas"
                      style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:5px;padding:3px 7px;width:90px;text-align:right;font-family:var(--font-n);font-size:12px;color:var(--input-text)"
                      :disabled="!r._banca || !r._incluir"/>
                  </td>
                  <td style="text-align:right">
                    <input type="number" v-model.number="r.premios"
                      style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:5px;padding:3px 7px;width:90px;text-align:right;font-family:var(--font-n);font-size:12px;color:var(--input-text)"
                      :disabled="!r._banca || !r._incluir"/>
                  </td>
                  <td>
                    <span v-if="!r._banca" class="tag tag-red" style="font-size:9px">⚠ No encontrada</span>
                    <span v-else-if="r._incluir" class="tag tag-green" style="font-size:9px">✓ Incluir</span>
                    <span v-else class="tag tag-gray" style="font-size:9px">— Excluir</span>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="summary-row">
                  <td colspan="4"><strong>TOTAL A IMPORTAR</strong></td>
                  <td style="text-align:right"><strong>{{ fmt(importPreview.filter(r=>r._incluir).reduce((s,r)=>s+r.ventas,0)) }}</strong></td>
                  <td style="text-align:right"><strong>{{ fmt(importPreview.filter(r=>r._incluir).reduce((s,r)=>s+r.premios,0)) }}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Bancas sin mapear -->
        <div v-if="importPreview.some(r=>!r._banca)" class="alert alert-error" style="margin-top:14px;font-size:11px">
          ⚠️ <strong>Bancas sin mapear:</strong>
          {{ importPreview.filter(r=>!r._banca).map(r=>r.usuario+' ('+r.agencia+')').join(', ') }}
          — Verifica que el campo <em>usuario_sistema</em> en la banca corresponda al código del archivo.
        </div>

      </div>

      <!-- ══ GASTOS ══ -->
      <div v-if="view==='gastos'">
        <div class="section-header">
          <div>
            <div class="section-title">Gastos</div>
            <div class="section-sub">Registro de gastos operativos y de central</div>
          </div>
          <div class="export-group">
            <div class="export-wrap" :class="{open: exportOpen==='gastos'}" @click.stop>
              <button class="export-btn" @click="exportOpen = exportOpen==='gastos' ? '' : 'gastos'">
                ⬇ Exportar <span class="arrow">▼</span>
              </button>
              <div class="export-menu">
                <div class="export-menu-item" @click="exportOpen=''; exportToExcel('tbl-gastos','gastos')">
                  <span class="icon">📊</span> Excel (.xlsx)
                </div>
                <div class="export-menu-item" @click="exportOpen=''; exportToPDF('tbl-gastos','Gastos','gastos')">
                  <span class="icon">📄</span> PDF
                </div>
              </div>
            </div>
            <button class="btn btn-primary" @click="abrirNuevoGasto">+ Registrar Gasto</button>
          </div>
        </div>

        <!-- Filtros gastos -->
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px">
          <!-- Modo -->
          <div style="display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">
            <button :class="gastoFiltro.modo==='periodo'?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'" style="border-radius:0;border:none"
              @click="gastoFiltro.modo='periodo';gastoFiltro.mes='';loadGastos(1)">Por Período</button>
            <button :class="gastoFiltro.modo==='mes'?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'" style="border-radius:0;border:none"
              @click="gastoFiltro.modo='mes';gastoFiltro.periodo_id='';loadGastos(1)">Por Mes</button>
            <button :class="gastoFiltro.modo==='todo'?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'" style="border-radius:0;border:none"
              @click="gastoFiltro.modo='todo';loadGastos(1)">Todo</button>
          </div>
          <!-- Período -->
          <select v-if="gastoFiltro.modo==='periodo'" class="form-control" style="width:200px"
            v-model="gastoFiltro.periodo_id" @change="loadGastos(1)">
            <option value="">— Todos los períodos —</option>
            <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
          </select>
          <!-- Mes -->
          <input v-if="gastoFiltro.modo==='mes'" type="month" class="form-control" style="width:160px"
            v-model="gastoFiltro.mes" @change="loadGastos(1)"/>
          <!-- Grupo -->
          <select class="form-control" style="width:160px" v-model="gastoFiltro.grupo_id" @change="loadGastos(1)">
            <option value="">Todos los grupos</option>
            <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
          </select>
          <!-- Total visible -->
          <div v-if="gastos.length" style="margin-left:auto;font-size:13px;color:var(--muted);align-self:center">
            {{ gastosTotal }} gastos · Total: <strong style="color:var(--red)">{{ fmt(gastosTotalMonto) }}</strong>
          </div>
        </div>

        <!-- Mini gráfico por categoría -->
        <div v-if="gastosXCategoria.length" class="card" style="margin-bottom:16px;padding:16px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">
            📊 Distribución por Categoría
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div v-for="cat in gastosXCategoria" :key="cat.nombre" style="display:flex;align-items:center;gap:10px">
              <div style="width:10px;height:10px;border-radius:50%;flex-shrink:0" :style="'background:' + cat.color"></div>
              <div style="font-size:12px;min-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ cat.nombre }}</div>
              <!-- Barra proporcional -->
              <div style="flex:1;background:var(--bg-hover);border-radius:4px;height:8px;overflow:hidden">
                <div :style="{
                  width: gastosTotalMonto > 0 ? ((cat.total / gastosTotalMonto) * 100).toFixed(1) + '%' : '0%',
                  background: cat.color,
                  height: '8px',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }"></div>
              </div>
              <div style="font-size:12px;font-weight:600;color:var(--red);min-width:80px;text-align:right">{{ fmt(cat.total) }}</div>
              <div style="font-size:11px;color:var(--muted);min-width:36px;text-align:right">
                {{ gastosTotalMonto > 0 ? ((cat.total / gastosTotalMonto) * 100).toFixed(0) + '%' : '0%' }}
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-body" style="padding:0">
            <div class="loading" v-if="loadingGastos"><div class="spinner"></div></div>
            <div class="empty" v-else-if="!gastos.length">
              <div class="empty-icon">💸</div><p>Sin gastos registrados</p>
            </div>
            <table v-else id="tbl-gastos">
              <thead><tr>
                <th>Fecha</th><th>Grupo</th><th>Banca</th><th>Tipo</th><th>Concepto</th><th>Monto</th><th></th>
              </tr></thead>
              <tbody>
                <tr v-for="g in gastos" :key="g.id">
                  <td>{{ g.fecha }}</td>
                  <td>{{ g.grupos?.nombre || '-' }}</td>
                  <td>{{ g.bancas?.nombre || 'General' }}</td>
                  <td><span :class="'tag tag-' + tipoGastoColor(g.tipo)">{{ g.tipo }}</span></td>
                  <td>
                    {{ g.concepto }}
                    <span v-if="g.ref_banco_id" title="También registrado en Banco" style="cursor:help">🏦</span>
                    <span v-if="g.ref_flujo_id" title="También registrado en Flujo" style="cursor:help">💸</span>
                  </td>
                  <td class="num-neg">{{ fmt(g.monto) }}</td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-ghost btn-xs" @click="editarGasto(g)" style="margin-right:4px">✏️</button>
                    <button class="btn btn-danger btn-xs" @click="deleteGasto(g.id)">✕</button>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="summary-row">
                  <td colspan="5"><strong>Total (página)</strong></td>
                  <td><strong>{{ fmt(gastos.reduce((s,g)=>s+g.monto,0)) }}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <!-- Paginación -->
            <div v-if="totalPages > 1" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;border-top:1px solid var(--border)">
              <button class="btn btn-ghost btn-sm" :disabled="gastoPage===1" @click="loadGastos(1)">«</button>
              <button class="btn btn-ghost btn-sm" :disabled="gastoPage===1" @click="loadGastos(gastoPage-1)">‹</button>
              <span style="font-size:13px;color:var(--muted)">Página {{ gastoPage }} de {{ totalPages }}</span>
              <button class="btn btn-ghost btn-sm" :disabled="gastoPage===totalPages" @click="loadGastos(gastoPage+1)">›</button>
              <button class="btn btn-ghost btn-sm" :disabled="gastoPage===totalPages" @click="loadGastos(totalPages)">»</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ PRÉSTAMOS ══ -->
      <div v-if="view==='prestamos'">
        <div class="section-header">
          <div>
            <div class="section-title">Préstamos a Supervisores</div>
            <div class="section-sub">Control de entregas y devoluciones intra-semana</div>
          </div>
          <div class="export-group">
            <div class="export-wrap" :class="{open: exportOpen==='prestamos'}" @click.stop>
              <button class="export-btn" @click="exportOpen = exportOpen==='prestamos' ? '' : 'prestamos'">
                ⬇ Exportar <span class="arrow">▼</span>
              </button>
              <div class="export-menu">
                <div class="export-menu-item" @click="exportOpen=''; exportToExcel('tbl-prestamos','prestamos')">
                  <span class="icon">📊</span> Excel (.xlsx)
                </div>
                <div class="export-menu-item" @click="exportOpen=''; exportToPDF('tbl-prestamos','Préstamos a Supervisores','prestamos')">
                  <span class="icon">📄</span> PDF
                </div>
              </div>
            </div>
            <button class="btn btn-primary" @click="abrirNuevoPrestamo">+ Registrar Movimiento</button>
          </div>
        </div>

        <!-- Explicación del flujo -->
        <div class="alert alert-info" style="margin-bottom:16px;font-size:12px;line-height:1.6">
          <strong>📋 ¿Cómo funcionan los Movimientos de Semana?</strong><br/>
          • <strong>Préstamo (Salida) ↑</strong> — Dinero que le ENTREGAS al supervisor porque la banca perdió y necesita efectivo para operar. Suma al "Total a Depositar" del cuadre.<br/>
          • <strong>Devolución (Entrada) ↓</strong> — Dinero que el supervisor te ENTREGA antes del cuadre porque sus bancas generaron ganancias. Resta del "Total a Depositar" del cuadre.<br/>
          • Todos los movimientos del período aparecen automáticamente en el cuadre del grupo correspondiente.
        </div>

        <div class="card" style="margin-bottom:20px">
          <div class="card-header"><div class="card-title">Resumen por Grupo</div></div>
          <div class="card-body" style="padding:0">
            <table>
              <thead><tr><th>Grupo</th><th>Total Prestado</th><th>Total Devuelto</th><th>Saldo Pendiente</th></tr></thead>
              <tbody>
                <tr v-for="g in prestamosResumen" :key="g.grupo_id">
                  <td><strong>{{ g.nombre }}</strong></td>
                  <td class="num-neg">{{ fmt(g.salidas) }}</td>
                  <td class="num-pos">{{ fmt(g.entradas) }}</td>
                  <td :class="g.saldo>0?'num-neg':'num-pos'">{{ fmt(g.saldo) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Historial de Movimientos</div>
            <div style="display:flex;gap:8px">
              <select class="form-control" style="width:180px" v-model="prestFiltro.periodo_id" @change="loadPrestamos">
                <option value="">— Todos los períodos —</option>
                <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
              </select>
              <select class="form-control" style="width:160px" v-model="prestFiltro.grupo_id" @change="loadPrestamos">
                <option value="">— Todos los grupos —</option>
                <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
              </select>
            </div>
          </div>
          <div class="card-body" style="padding:0">
            <div class="loading" v-if="loadingPrest"><div class="spinner"></div></div>
            <div class="empty" v-else-if="!prestamos.length">
              <div class="empty-icon">💰</div><p>Sin movimientos registrados</p>
            </div>
            <table v-else id="tbl-prestamos">
              <thead><tr><th>Fecha</th><th>Grupo</th><th>Banca</th><th>Período</th><th>Tipo</th><th>Concepto</th><th>Monto</th><th></th></tr></thead>
              <tbody>
                <tr v-for="p in prestamos" :key="p.id">
                  <td>{{ p.fecha }}</td>
                  <td>{{ p.grupos?.nombre }}</td>
                  <td>
                    <span v-if="p.bancas" class="tag tag-yellow" style="font-size:10px">{{ p.bancas?.codigo }}</span>
                    <span v-if="p.bancas" style="font-size:11px"> {{ p.bancas?.nombre }}</span>
                    <span v-else style="color:var(--muted);font-size:11px">—</span>
                  </td>
                  <td>{{ p.periodos?.descripcion || p.periodos?.fecha_inicio }}</td>
                  <td><span :class="p.tipo==='salida'?'tag tag-red':'tag tag-green'">{{ p.tipo==='salida'?'Préstamo':'Devolución' }}</span></td>
                  <td>{{ p.concepto || '-' }}</td>
                  <td :class="p.tipo==='salida'?'num-neg':'num-pos'">{{ fmt(p.monto) }}</td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-ghost btn-xs" @click="editarPrestamo(p)" style="margin-right:4px">✏️</button>
                    <button class="btn btn-danger btn-xs" @click="deletePrestamo(p.id)">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    <!-- PRÉSTAMO MODAL -->
    <div class="overlay" v-if="showPrestamoModal" @click.self="showPrestamoModal=false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">{{ prestEditId ? "✏️ Editar Movimiento" : "💰 Registrar Movimiento" }}</div>
          <button class="close-btn" @click="showPrestamoModal=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Grupo</label>
                <select class="form-control" v-model="prestFrm.grupo_id" @change="prestFrm.banca_id=''">
                  <option value="">— Grupo —</option>
                  <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Período</label>
                <select class="form-control" v-model="prestFrm.periodo_id">
                  <option value="">— Período —</option>
                  <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
                </select>
              </div>
            </div>
            <div class="form-row" v-if="grupos.find(g=>g.id===prestFrm.grupo_id)?.modo==='individual_bancas'">
              <div class="form-group">
                <label class="form-label">Banca
                  <span style="font-size:10px;color:var(--yellow);font-weight:normal"> — Grupo Capital: especifica la banca</span>
                </label>
                <select class="form-control" v-model="prestFrm.banca_id">
                  <option value="">— Selecciona Banca —</option>
                  <option v-for="b in bancas.filter(b=>b.grupo_id===prestFrm.grupo_id)" :key="b.id" :value="b.id">
                    {{ b.codigo }} — {{ b.nombre }}
                  </option>
                </select>
              </div>
              <div class="form-group"></div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Tipo</label>
                <select class="form-control" v-model="prestFrm.tipo">
                  <option value="salida">💸 Préstamo (Salida a supervisor)</option>
                  <option value="entrada">✅ Devolución (Entrada de supervisor)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Monto</label>
                <input type="number" class="form-control" v-model.number="prestFrm.monto" placeholder="0"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Fecha</label>
                <input type="date" class="form-control" v-model="prestFrm.fecha"/>
              </div>
              <div class="form-group">
                <label class="form-label">Concepto</label>
                <input type="text" class="form-control" v-model="prestFrm.concepto" placeholder="Descripción..."/>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showPrestamoModal=false">Cancelar</button>
          <button class="btn btn-primary" @click="savePrestamo" :disabled="!prestFrm.grupo_id||!prestFrm.monto">
            💾 Guardar
          </button>
        </div>
      </div>
    </div>


      <!-- ══ PARTICIPACIÓN ══ -->
      <div v-if="view==='participacion'">
        <div class="section-header">
          <div>
            <div class="section-title">Participación de Beneficios</div>
            <div class="section-sub">Seguimiento del arrastre de participación por grupo</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <select class="form-control" style="width:180px" v-model="partFiltro.periodo_id" @change="loadParticipacion">
              <option value="">— Todos los períodos —</option>
              <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
            </select>
            <select class="form-control" style="width:180px" v-model="partFiltro.grupo_id" @change="loadParticipacion">
              <option value="">— Todos los grupos —</option>
              <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
            </select>
            <div class="export-wrap" :class="{open: exportOpen==='participacion'}" @click.stop>
              <button class="export-btn" @click="exportOpen = exportOpen==='participacion' ? '' : 'participacion'">
                ⬇ Exportar <span class="arrow">▼</span>
              </button>
              <div class="export-menu">
                <div class="export-menu-item" @click="exportOpen=''; exportToExcel('tbl-participacion','participacion')">
                  <span class="icon">📊</span> Excel (.xlsx)
                </div>
                <div class="export-menu-item" @click="exportOpen=''; exportToPDF('tbl-participacion','Participación de Beneficios','participacion')">
                  <span class="icon">📄</span> PDF
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-body" style="padding:0">
            <div class="loading" v-if="loadingPart"><div class="spinner"></div></div>
            <div class="empty" v-else-if="!participacion.length">
              <div class="empty-icon">📈</div><p>Sin registros — guarda cuadres primero</p>
            </div>
            <table v-else id="tbl-participacion">
              <thead><tr>
                <th>Grupo</th><th>Período</th><th>Benef. Semana</th><th>Arrastre Ant.</th>
                <th>Balance Part.</th><th>%</th><th>A Pagar</th><th>Pagado</th><th>Arrastre Sig.</th>
              </tr></thead>
              <tbody>
                <template v-for="p in participacionAgrupada" :key="p._key||p.id">
                  <!-- Fila principal: grupo (total) o banca estándar -->
                  <tr :style="p.esGrupoAgrupado?'background:rgba(255,209,102,0.04)':''">
                    <td>
                      <strong>{{ p.grupos?.nombre }}</strong>
                      <span v-if="p.esGrupoAgrupado" class="tag tag-yellow" style="font-size:9px;margin-left:4px">🏦</span>
                      <button v-if="p.esGrupoAgrupado && p._bancas.length" class="btn btn-ghost btn-xs"
                        style="padding:1px 5px;margin-left:4px;font-size:10px"
                        @click="partExpandido[p._key]=!partExpandido[p._key]">
                        {{ partExpandido[p._key] ? '▲' : '▼' }}
                      </button>
                    </td>
                    <td>{{ p.periodos?.descripcion || p.periodos?.fecha_inicio }}</td>
                    <td :class="p.beneficio_semana>=0?'num-pos':'num-neg'">{{ fmt(p.beneficio_semana) }}</td>
                    <td :class="p.arrastre_anterior>=0?'':'num-neg'">{{ fmt(p.arrastre_anterior) }}</td>
                    <td :class="p.balance_participacion>=0?'num-pos':'num-neg'">{{ fmt(p.balance_participacion) }}</td>
                    <td>{{ p.esGrupoAgrupado ? '—' : p.porcentaje+'%' }}</td>
                    <td :class="p.monto_a_pagar>0?'num-pos':''">{{ fmt(p.monto_a_pagar) }}</td>
                    <td :class="p.pagado>0?'num-pos':''">{{ fmt(p.pagado) }}</td>
                    <td :class="p.arrastre_siguiente>=0?'':'num-neg'">{{ fmt(p.arrastre_siguiente) }}</td>
                  </tr>
                  <!-- Drilldown: solo bancas que tienen registro de participación -->
                  <template v-if="p.esGrupoAgrupado && partExpandido[p._key] && p._bancas.length">
                    <tr v-for="b in p._bancas" :key="b.id"
                        style="background:rgba(255,209,102,0.07);font-size:12px">
                      <td style="padding-left:28px;color:var(--muted)">
                        ↳ <span class="tag tag-yellow" style="font-size:9px">{{ b.bancas?.codigo }}</span>
                        {{ b.bancas?.nombre }}
                      </td>
                      <td>{{ b.periodos?.descripcion || b.periodos?.fecha_inicio }}</td>
                      <td :class="b.beneficio_semana>=0?'num-pos':'num-neg'">{{ fmt(b.beneficio_semana) }}</td>
                      <td :class="b.arrastre_anterior>=0?'':'num-neg'">{{ fmt(b.arrastre_anterior) }}</td>
                      <td :class="b.balance_participacion>=0?'num-pos':'num-neg'">{{ fmt(b.balance_participacion) }}</td>
                      <td>{{ b.porcentaje }}%</td>
                      <td :class="b.monto_a_pagar>0?'num-pos':''">{{ fmt(b.monto_a_pagar) }}</td>
                      <td :class="b.pagado>0?'num-pos':''">{{ fmt(b.pagado) }}</td>
                      <td :class="b.arrastre_siguiente>=0?'':'num-neg'">{{ fmt(b.arrastre_siguiente) }}</td>
                    </tr>
                  


</template>
                


</template>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ══ CUENTA BANCO ══ -->
      <div v-if="view==='banco'">
        <div class="section-header">
          <div>
            <div class="section-title">Cuenta Bancaria</div>
            <div class="section-sub">Control de movimientos y saldo</div>
          </div>
          <div class="export-group">
            <div class="export-wrap" :class="{open: exportOpen==='banco'}" @click.stop>
              <button class="export-btn" @click="exportOpen = exportOpen==='banco' ? '' : 'banco'">
                ⬇ Exportar <span class="arrow">▼</span>
              </button>
              <div class="export-menu">
                <div class="export-menu-item" @click="exportOpen=''; exportToExcel('tbl-banco','cuenta_bancaria')">
                  <span class="icon">📊</span> Excel (.xlsx)
                </div>
                <div class="export-menu-item" @click="exportOpen=''; exportToPDF('tbl-banco','Cuenta Bancaria','cuenta_bancaria')">
                  <span class="icon">📄</span> PDF
                </div>
              </div>
            </div>
            <button class="btn btn-primary" @click="abrirNuevoBanco()">+ Registrar Movimiento</button>
          </div>
        </div>

        <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="metric-card green">
            <div class="metric-label">Saldo Actual</div>
            <div :class="['metric-value', bancoStats.saldo>=0?'pos':'neg']">{{ fmt(bancoStats.saldo) }}</div>
          </div>
          <div class="metric-card blue">
            <div class="metric-label">Total Ingresos (mes)</div>
            <div class="metric-value pos">{{ fmt(bancoStats.ingresos) }}</div>
          </div>
          <div class="metric-card red">
            <div class="metric-label">Total Egresos (mes)</div>
            <div class="metric-value neg">{{ fmt(bancoStats.egresos) }}</div>
          </div>
        </div>

        <!-- Filtros -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">📅 Filtrar por mes</label>
                <input type="month" class="form-control" title="Selecciona un mes para llenar Desde/Hasta automáticamente"
                  @change="e => { if(!e.target.value) return; const [y,m]=e.target.value.split('-'); bancoFiltro.desde=y+'-'+m+'-01'; bancoFiltro.hasta=new Date(+y,+m,0).toISOString().split('T')[0]; loadBanco() }"/>
              </div>
              <div class="form-group">
                <label class="form-label">Desde</label>
                <input type="date" class="form-control" v-model="bancoFiltro.desde" @change="loadBanco"/>
              </div>
              <div class="form-group">
                <label class="form-label">Hasta</label>
                <input type="date" class="form-control" v-model="bancoFiltro.hasta" @change="loadBanco"/>
              </div>
              <div class="form-group">
                <label class="form-label">Tipo</label>
                <select class="form-control" v-model="bancoFiltro.tipo" @change="loadBanco">
                  <option value="">Todos</option>
                  <option>ingreso</option><option>egreso</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Grupo</label>
                <select class="form-control" v-model="bancoFiltro.grupo_id" @change="loadBanco">
                  <option value="">Todos</option>
                  <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-body" style="padding:0">
            <div class="loading" v-if="loadingBanco"><div class="spinner"></div></div>
            <div class="empty" v-else-if="!bancoMovs.length">
              <div class="empty-icon">🏦</div><p>Sin movimientos en el período</p>
            </div>
            <table v-else id="tbl-banco">
              <thead><tr>
                <th>Fecha</th><th>Concepto</th><th>Grupo</th><th>Categoría</th>
                <th>Referencia</th><th>Tipo</th><th>Monto</th><th>Saldo</th><th></th>
              </tr></thead>
              <tbody>
                <!-- Fila de balance inicial — solo cuando hay filtro "desde" -->
                <tr v-if="bancoFiltro.desde" style="background:rgba(26,115,232,0.07);font-weight:600">
                  <td>{{ bancoFiltro.desde }}</td>
                  <td colspan="6" style="color:var(--accent);font-style:italic">
                    📌 Balance inicial (antes del {{ bancoFiltro.desde }})
                  </td>
                  <td style="text-align:right;font-weight:700" :style="bancoSaldoInicial>=0?'color:var(--green)':'color:var(--red)'">
                    {{ fmt2(bancoSaldoInicial) }}
                  </td>
                  <td></td>
                </tr>
                <tr v-for="m in bancoMovs" :key="m.id">
                  <td>{{ m.fecha }}</td>
                  <td>
                    {{ m.concepto }}
                    <span v-if="m.ref_gasto_id" title="También registrado en Gastos" style="cursor:help">🧾</span>
                    <span v-if="m.ref_flujo_id" title="También registrado en Flujo de Efectivo" style="cursor:help">💸</span>
                  </td>
                  <td>{{ m.grupos?.nombre || '-' }}</td>
                  <td><span class="tag tag-gray">{{ m.categorias?.nombre || '-' }}</span></td>
                  <td>{{ m.referencia || '-' }}</td>
                  <td><span :class="m.tipo==='ingreso'?'tag tag-green':'tag tag-red'">{{ m.tipo }}</span></td>
                  <td :class="m.tipo==='ingreso'?'num-pos':'num-neg'">
                    {{ m.tipo==='ingreso'?'+':'-' }}{{ fmt2(m.monto) }}
                  </td>
                  <td :class="m.saldo_acumulado>=0?'num-pos':'num-neg'">{{ fmt2(m.saldo_acumulado) }}</td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-ghost btn-xs" @click="editarBanco(m)" style="margin-right:4px">✏️</button>
                    <button class="btn btn-danger btn-xs" @click="deleteBanco(m.id)">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    <!-- BANCO MODAL -->
    <div class="overlay" v-if="showBancoModal" @click.self="showBancoModal=false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">{{ bancoEditId ? "✏️ Editar Movimiento Bancario" : "🏦 Registrar Movimiento Bancario" }}</div>
          <button class="close-btn" @click="showBancoModal=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Fecha</label>
                <input type="date" class="form-control" v-model="bancoFrm.fecha"/>
              </div>
              <div class="form-group">
                <label class="form-label">Tipo</label>
                <select class="form-control" v-model="bancoFrm.tipo">
                  <option value="ingreso">📈 Ingreso</option>
                  <option value="egreso">📉 Egreso</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Categoría <span style="color:var(--accent)">(filtrada por tipo)</span></label>
              <select class="form-control" v-model="bancoFrm.categoria_id">
                <option value="">— Seleccionar categoría —</option>
                <optgroup :label="bancoFrm.tipo === 'ingreso' ? '📈 Ingresos' : '📉 Egresos'">
                  <option v-for="c in categorias.filter(c=>c.tipo===bancoFrm.tipo&&c.activo)" :key="c.id" :value="c.id">
                    {{ c.nombre }}
                  </option>
                </optgroup>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Concepto</label>
              <input type="text" class="form-control" v-model="bancoFrm.concepto" placeholder="Descripción del movimiento"/>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Monto</label>
                <input type="number" class="form-control" v-model.number="bancoFrm.monto" placeholder="0"/>
              </div>
              <div class="form-group">
                <label class="form-label">Referencia</label>
                <input type="text" class="form-control" v-model="bancoFrm.referencia" placeholder="Nro. transacción..."/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Grupo (opcional)</label>
                <select class="form-control" v-model="bancoFrm.grupo_id">
                  <option value="">— Ninguno —</option>
                  <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Período (opcional)</label>
                <select class="form-control" v-model="bancoFrm.periodo_id">
                  <option value="">— Ninguno —</option>
                  <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <!-- Propagación cruzada — solo al crear -->
        <div v-if="!bancoEditId" style="padding:0 24px 16px;border-top:1px solid var(--border);margin-top:0">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:10px;margin-top:12px;text-transform:uppercase;letter-spacing:0.5px">
            🔗 Registrar también en:
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 12px;border-radius:8px;border:1px solid var(--border);" :style="bancoPropagarGasto&&bancoFrm.tipo==='egreso'?'border-color:rgba(249,168,37,0.4);background:rgba(249,168,37,0.05)':''" >
              <input type="checkbox" v-model="bancoPropagarGasto" :disabled="bancoFrm.tipo==='ingreso'" style="margin-top:2px;width:16px;height:16px;accent-color:#f9a825;flex-shrink:0"/>
              <div>
                <div style="font-weight:600;font-size:13px">🧾 Gastos <span v-if="bancoFrm.tipo==='ingreso'" style="font-weight:400;color:var(--text-muted);font-size:11px">(solo para egresos)</span></div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Mismo monto, concepto, fecha y categoría. Sin grupo ni período.</div>
              </div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 12px;border-radius:8px;border:1px solid var(--border);" :style="bancoPropagarFlujo?'border-color:rgba(26,115,232,0.4);background:rgba(26,115,232,0.05)':''">
              <input type="checkbox" v-model="bancoPropagarFlujo" style="margin-top:2px;width:16px;height:16px;accent-color:var(--accent);flex-shrink:0"/>
              <div>
                <div style="font-weight:600;font-size:13px">💸 Flujo de Efectivo</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Mismo tipo, monto, concepto, fecha y categoría.</div>
              </div>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showBancoModal=false;bancoEditId=null">Cancelar</button>
          <button class="btn btn-primary" @click="saveBanco">
            {{ bancoEditId ? '💾 Actualizar' : '💾 Guardar' }}
          </button>
        </div>
      </div>
    </div>


      <!-- ══ GRUPOS ══ -->
      <div v-if="view==='grupos'">
        <div class="section-header">
          <div>
            <div class="section-title">Grupos / Supervisores</div>
            <div class="section-sub">Administración de grupos de ventas</div>
          </div>
          <div class="export-group">
            <div class="export-wrap" :class="{open: exportOpen==='grupos'}" @click.stop>
              <button class="export-btn" @click="exportOpen = exportOpen==='grupos' ? '' : 'grupos'">
                ⬇ Exportar <span class="arrow">▼</span>
              </button>
              <div class="export-menu">
                <div class="export-menu-item" @click="exportOpen=''; exportToExcel('tbl-grupos','grupos')">
                  <span class="icon">📊</span> Excel (.xlsx)
                </div>
                <div class="export-menu-item" @click="exportOpen=''; exportToPDF('tbl-grupos','Grupos / Supervisores','grupos')">
                  <span class="icon">📄</span> PDF
                </div>
              </div>
            </div>
            <button class="btn btn-primary" @click="showGrupoModal=true;editGrupo={}">+ Nuevo Grupo</button>
          </div>
        </div>
        <div class="card">
          <div class="card-body" style="padding:0">
            <div class="loading" v-if="loadingGrupos"><div class="spinner"></div></div>
            <div class="empty" v-else-if="!grupos.length">
              <div class="empty-icon">👥</div><p>Sin grupos registrados</p>
            </div>
            <table v-else id="tbl-grupos">
              <thead><tr><th>#</th><th>Código</th><th>Nombre</th><th>% Participación</th><th>Bancas</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                <tr v-for="(g,i) in grupos" :key="g.id">
                  <td>{{ i+1 }}</td>
                  <td><strong>{{ g.codigo }}</strong></td>
                  <td>{{ g.nombre }}</td>
                  <td>
                    <span v-if="g.modo==='individual_bancas'" class="tag tag-yellow" style="font-size:9px">🏦 Individual</span>
                    <span v-else class="tag tag-blue">{{ g.porcentaje_participacion }}%</span>
                  </td>
                  <td><span class="counter-badge">{{ bancas.filter(b=>b.grupo_id===g.id).length }}</span></td>
                  <td><span :class="g.activo?'tag tag-green':'tag tag-gray'">{{ g.activo?'Activo':'Inactivo' }}</span></td>
                  <td style="display:flex;gap:6px">
                    <button class="btn btn-ghost btn-xs" @click="editarGrupo(g)">✏️</button>
                    <button class="btn btn-danger btn-xs" @click="deleteGrupo(g.id)">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>


      <div class="overlay" v-if="showGrupoModal" @click.self="showGrupoModal=false">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">{{ editGrupo.id ? '✏️ Editar Grupo' : '+ Nuevo Grupo' }}</div>
            <button class="close-btn" @click="showGrupoModal=false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Código</label>
                  <input type="text" class="form-control" v-model="editGrupo.codigo" placeholder="Ej: VV"/>
                </div>
                <div class="form-group">
                  <label class="form-label">Nombre</label>
                  <input type="text" class="form-control" v-model="editGrupo.nombre" placeholder="Nombre del grupo"/>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">% Participación en Beneficio
                    <span style="font-size:10px;color:var(--muted);font-weight:normal;display:block">Para grupos estándar. En modo individual, cada banca tiene su %</span>
                  </label>
                  <input type="number" class="form-control" v-model.number="editGrupo.porcentaje_participacion" placeholder="0" min="0" max="100" :disabled="editGrupo.modo==='individual_bancas'"/>
                </div>
                <div class="form-group">
                  <label class="form-label">Estado</label>
                  <select class="form-control" v-model="editGrupo.activo">
                    <option :value="true">Activo</option>
                    <option :value="false">Inactivo</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Modo de Cuadre
                  <span style="font-size:10px;color:var(--muted);font-weight:normal;display:block">Individual: cada banca tiene su propio cuadre y participación separada</span>
                </label>
                <select class="form-control" v-model="editGrupo.modo">
                  <option value="estandar">Estándar — cuadre global del grupo</option>
                  <option value="individual_bancas">Individual por Banca — cuadre separado por banca (ej: Capital)</option>
                </select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Balance Inicial de Cuadre
                    <span style="font-size:10px;color:var(--muted);font-weight:normal;display:block">
                      Saldo pendiente antes de empezar a registrar en este sistema
                    </span>
                  </label>
                  <input type="number" class="form-control" v-model.number="editGrupo.balance_inicial" placeholder="0"/>
                </div>
                <div class="form-group">
                  <label class="form-label">Arrastre Inicial de Participación
                    <span style="font-size:10px;color:var(--muted);font-weight:normal;display:block">
                      Participación pendiente de pago antes de registrar
                    </span>
                  </label>
                  <input type="number" class="form-control" v-model.number="editGrupo.arrastre_part_inicial" placeholder="0"/>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Notas</label>
                <input type="text" class="form-control" v-model="editGrupo.notas" placeholder="Observaciones..."/>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="showGrupoModal=false">Cancelar</button>
            <button class="btn btn-primary" @click="saveGrupo" :disabled="!editGrupo.nombre">💾 Guardar</button>
          </div>
        </div>
      </div>

      <!-- ══ BANCAS ══ -->
      <div v-if="view==='bancas'">
        <div class="section-header">
          <div>
            <div class="section-title">Bancas / Vendedores</div>
            <div class="section-sub">Registro de agencias y verifones</div>
          </div>
          <div style="display:flex;gap:10px">
            <select class="form-control" style="width:180px" v-model="bancaFiltroGrupo">
              <option value="">Todos los grupos</option>
              <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
            </select>
            <div class="export-wrap" :class="{open: exportOpen==='bancas'}" @click.stop>
              <button class="export-btn" @click="exportOpen = exportOpen==='bancas' ? '' : 'bancas'">
                ⬇ Exportar <span class="arrow">▼</span>
              </button>
              <div class="export-menu">
                <div class="export-menu-item" @click="exportOpen=''; exportToExcel('tbl-bancas','bancas')">
                  <span class="icon">📊</span> Excel (.xlsx)
                </div>
                <div class="export-menu-item" @click="exportOpen=''; exportToPDF('tbl-bancas','Bancas / Vendedores','bancas')">
                  <span class="icon">📄</span> PDF
                </div>
              </div>
            </div>
            <button class="btn btn-primary" @click="showBancaModal=true;editBanca={}">+ Nueva Banca</button>
          </div>
        </div>
        <div class="card">
          <div class="card-body" style="padding:0">
            <div class="loading" v-if="loadingBancas"><div class="spinner"></div></div>
            <div class="empty" v-else-if="!bancasFiltradas.length">
              <div class="empty-icon">🏪</div><p>Sin bancas registradas</p>
            </div>
            <table v-else id="tbl-bancas">
              <thead><tr><th>Código</th><th>Nombre</th><th>Agencia</th><th>Grupo</th><th>% Comisión</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                <tr v-for="b in bancasFiltradas" :key="b.id">
                  <td><strong>{{ b.codigo }}</strong></td>
                  <td>{{ b.nombre }}</td>
                  <td>{{ b.agencia || '-' }}</td>
                  <td>{{ grupos.find(g=>g.id===b.grupo_id)?.nombre || '-' }}</td>
                  <td><span class="tag tag-yellow">{{ b.porcentaje_comision }}%</span></td>
                  <td><span :class="b.activo?'tag tag-green':'tag tag-gray'">{{ b.activo?'Activo':'Inactivo' }}</span></td>
                  <td style="display:flex;gap:6px">
                    <button class="btn btn-ghost btn-xs" @click="editarBanca(b)">✏️</button>
                    <button class="btn btn-danger btn-xs" @click="deleteBanca(b.id)">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>


      <div class="overlay" v-if="showBancaModal" @click.self="showBancaModal=false">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">{{ editBanca.id ? '✏️ Editar Banca' : '+ Nueva Banca' }}</div>
            <button class="close-btn" @click="showBancaModal=false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Código</label>
                  <input type="text" class="form-control" v-model="editBanca.codigo" placeholder="Ej: 3005"/>
                </div>
                <div class="form-group">
                  <label class="form-label">Nombre / Vendedor</label>
                  <input type="text" class="form-control" v-model="editBanca.nombre" placeholder="Nombre"/>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Agencia</label>
                  <input type="text" class="form-control" v-model="editBanca.agencia" placeholder="Nombre agencia"/>
                </div>
                <div class="form-group">
                  <label class="form-label">Usuario Sistema</label>
                  <input type="text" class="form-control" v-model="editBanca.usuario_sistema" placeholder="Código sistema"/>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Grupo</label>
                  <select class="form-control" v-model="editBanca.grupo_id">
                    <option value="">— Sin grupo —</option>
                    <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">% Comisión</label>
                  <input type="number" class="form-control" v-model.number="editBanca.porcentaje_comision" placeholder="0" min="0" max="100"/>
                </div>
              </div>
              <div class="form-row" v-if="grupos.find(g=>g.id===editBanca.grupo_id)?.modo==='individual_bancas'">
                <div class="form-group">
                  <label class="form-label">% Participación de esta Banca
                    <span style="font-size:10px;color:var(--muted);font-weight:normal;display:block">Porcentaje que retiene esta banca individualmente</span>
                  </label>
                  <input type="number" class="form-control" v-model.number="editBanca.porcentaje_participacion" placeholder="0" min="0" max="100"/>
                </div>
                <div class="form-group">
                  <label class="form-label">Balance Inicial Banca
                    <span style="font-size:10px;color:var(--muted);font-weight:normal;display:block">Saldo pendiente antes del primer cuadre</span>
                  </label>
                  <input type="number" class="form-control" v-model.number="editBanca.balance_inicial" placeholder="0"/>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="showBancaModal=false">Cancelar</button>
            <button class="btn btn-primary" @click="saveBanca" :disabled="!editBanca.codigo||!editBanca.nombre">💾 Guardar</button>
          </div>
        </div>
      </div>

      <!-- ══ PERIODOS ══ -->
      <div v-if="view==='periodos'">
        <div class="section-header">
          <div>
            <div class="section-title">Períodos Semanales</div>
            <div class="section-sub">Gestión de semanas de cuadre</div>
          </div>
          <div class="export-group">
            <div class="export-wrap" :class="{open: exportOpen==='periodos'}" @click.stop>
              <button class="export-btn" @click="exportOpen = exportOpen==='periodos' ? '' : 'periodos'">
                ⬇ Exportar <span class="arrow">▼</span>
              </button>
              <div class="export-menu">
                <div class="export-menu-item" @click="exportOpen=''; exportToExcel('tbl-periodos','periodos')">
                  <span class="icon">📊</span> Excel (.xlsx)
                </div>
                <div class="export-menu-item" @click="exportOpen=''; exportToPDF('tbl-periodos','Períodos Semanales','periodos')">
                  <span class="icon">📄</span> PDF
                </div>
              </div>
            </div>
            <button class="btn btn-primary" @click="showPeriodoModal=true;editPeriodo={}">+ Nuevo Período</button>
          </div>
        </div>
        <div class="card">
          <div class="card-body" style="padding:0">
            <div class="loading" v-if="loadingPeriodos"><div class="spinner"></div></div>
            <div class="empty" v-else-if="!periodos.length">
              <div class="empty-icon">📅</div><p>Sin períodos registrados</p>
            </div>
            <table v-else id="tbl-periodos">
              <thead><tr><th>Descripción</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                <tr v-for="p in periodos" :key="p.id">
                  <td><strong>{{ p.descripcion }}</strong></td>
                  <td>{{ p.fecha_inicio }}</td>
                  <td>{{ p.fecha_fin }}</td>
                  <td><span :class="p.cerrado?'tag tag-gray':'tag tag-green'">{{ p.cerrado?'Cerrado':'Activo' }}</span></td>
                  <td style="display:flex;gap:6px">
                    <button class="btn btn-ghost btn-xs" @click="editarPeriodo(p)">✏️</button>
                    <button class="btn btn-danger btn-xs" @click="deletePeriodo(p.id)">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>


      <div class="overlay" v-if="showPeriodoModal" @click.self="showPeriodoModal=false">
        <div class="modal" style="max-width:440px">
          <div class="modal-header">
            <div class="modal-title">{{ editPeriodo.id ? '✏️ Editar Período' : '+ Nuevo Período' }}</div>
            <button class="close-btn" @click="showPeriodoModal=false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Descripción (ej: Semana 16 al 22 Febrero)</label>
                <input type="text" class="form-control" v-model="editPeriodo.descripcion" placeholder="Semana XX al XX Mes"/>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Fecha Inicio</label>
                  <input type="date" class="form-control" v-model="editPeriodo.fecha_inicio"/>
                </div>
                <div class="form-group">
                  <label class="form-label">Fecha Fin</label>
                  <input type="date" class="form-control" v-model="editPeriodo.fecha_fin"/>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="showPeriodoModal=false">Cancelar</button>
            <button class="btn btn-primary" @click="savePeriodo" :disabled="!editPeriodo.fecha_inicio||!editPeriodo.fecha_fin">💾 Guardar</button>
          </div>
        </div>
      </div>

      <!-- ══ GUÍA DE USO / TABLAS ══ -->
      <div v-if="view==='docs'">
        <div class="section-header">
          <div>
            <div class="section-title">📚 Guía de Uso y Estructura de Datos</div>
            <div class="section-sub">Explicación de cada tabla y el flujo de información</div>
          </div>
        </div>

        <!-- FLUJO GENERAL -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-header"><div class="card-title">🔄 Flujo Semanal de Operación</div></div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;text-align:center">
              <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px">
                <div style="font-size:24px;margin-bottom:6px">1️⃣</div>
                <div style="font-size:11px;font-weight:700;color:var(--accent)">CREAR PERÍODO</div>
                <div style="font-size:10px;color:var(--muted);margin-top:4px">Lunes — crear semana lunes a domingo</div>
              </div>
              <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px">
                <div style="font-size:24px;margin-bottom:6px">2️⃣</div>
                <div style="font-size:11px;font-weight:700;color:var(--blue)">IMPORTAR VENTAS</div>
                <div style="font-size:10px;color:var(--muted);margin-top:4px">CSV del sistema o ingreso manual</div>
              </div>
              <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px">
                <div style="font-size:24px;margin-bottom:6px">3️⃣</div>
                <div style="font-size:11px;font-weight:700;color:var(--yellow)">REGISTRAR GASTOS</div>
                <div style="font-size:10px;color:var(--muted);margin-top:4px">Operativos, internet, equipos, etc.</div>
              </div>
              <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px">
                <div style="font-size:24px;margin-bottom:6px">4️⃣</div>
                <div style="font-size:11px;font-weight:700;color:var(--yellow)">AVANCES MID-WEEK</div>
                <div style="font-size:10px;color:var(--muted);margin-top:4px">Vienen del CSV como "Avances" — automático</div>
              </div>
              <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px">
                <div style="font-size:24px;margin-bottom:6px">5️⃣</div>
                <div style="font-size:11px;font-weight:700;color:var(--accent)">EJECUTAR CUADRE</div>
                <div style="font-size:10px;color:var(--muted);margin-top:4px">Por grupo — calcular y guardar</div>
              </div>
              <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px">
                <div style="font-size:24px;margin-bottom:6px">6️⃣</div>
                <div style="font-size:11px;font-weight:700;color:var(--blue)">RESUMEN + REPORTE</div>
                <div style="font-size:10px;color:var(--muted);margin-top:4px">Vista general + PDF/WhatsApp</div>
              </div>
            </div>
          </div>
        </div>

        <!-- FÓRMULA DEL CUADRE -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-header"><div class="card-title">🧮 Fórmula del Cuadre — Paso a Paso</div></div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
              <div>
                <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">P&L LOTERÍA (por banca)</div>
                <div class="kv-row"><span class="kv-label">Ventas</span><span class="kv-value num-pos">= datos sistema</span></div>
                <div class="kv-row"><span class="kv-label">(-) Premios</span><span class="kv-value num-neg">= datos sistema</span></div>
                <div class="kv-row"><span class="kv-label">= Resultado Bruto</span><span class="kv-value">Ventas - Premios</span></div>
                <div class="kv-row"><span class="kv-label">(-) Comisión vendedor</span><span class="kv-value num-neg">Ventas × % comisión</span></div>
                <div class="kv-row"><span class="kv-label">= Resultado Lotería</span><span class="kv-value">Resultado - Comisión</span></div>
                <div class="kv-row"><span class="kv-label">(-) Gastos Operativos</span><span class="kv-value num-neg">registros en Gastos</span></div>
                <div class="kv-row" style="background:rgba(0,229,160,0.05);padding:6px"><span class="kv-label"><strong>= Resultado Período</strong></span><span class="kv-value num-pos"><strong>Total del grupo</strong></span></div>
              </div>
              <div>
                <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">BALANCE DE EFECTIVO</div>
                <div class="kv-row"><span class="kv-label">Balance Anterior</span><span class="kv-value">del cuadre previo</span></div>
                <div class="kv-row"><span class="kv-label">(+) Resultado Período</span><span class="kv-value">calculado arriba</span></div>
                <div class="kv-row"><span class="kv-label">= Total Acumulado</span><span class="kv-value">suma de ambos</span></div>
                <div class="kv-row"><span class="kv-label">(+) Avances entregados</span><span class="kv-value" style="color:var(--blue)">del CSV (préstamos)</span></div>
                <div class="kv-row"><span class="kv-label">(+) Otros préstamos</span><span class="kv-value">entrada manual</span></div>
                <div class="kv-row"><span class="kv-label">(-) Pagos ya recibidos</span><span class="kv-value">antes del cuadre</span></div>
                <div class="kv-row"><span class="kv-label">= Total a Depositar</span><span class="kv-value">lo que deben</span></div>
                <div class="kv-row"><span class="kv-label">(-) Gasto Participación</span><span class="kv-value" style="color:var(--yellow)">retiene supervisor</span></div>
                <div class="kv-row" style="background:rgba(0,229,160,0.05);padding:6px"><span class="kv-label"><strong>= Entrega al Central</strong></span><span class="kv-value num-pos"><strong>lo que depositan</strong></span></div>
                <div class="kv-row"><span class="kv-label">(-) Depositado real</span><span class="kv-value">lo que entregaron</span></div>
                <div class="kv-row" style="background:rgba(255,77,109,0.05);padding:6px"><span class="kv-label"><strong>= Balance Final</strong></span><span class="kv-value num-neg"><strong>→ próximo cuadre</strong></span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- TABLAS -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="card">
            <div class="card-header"><div class="card-title">📋 grupos</div></div>
            <div class="card-body" style="font-size:12px">
              <p style="color:var(--muted);margin-bottom:10px">Supervisores o grupos de ventas. Cada grupo agrupa varias bancas.</p>
              <div class="kv-row"><span class="kv-label">nombre, codigo</span><span class="kv-value">identificación</span></div>
              <div class="kv-row"><span class="kv-label">porcentaje_participacion</span><span class="kv-value" style="color:var(--yellow)">% de ganancias que retiene el supervisor</span></div>
              <div class="kv-row"><span class="kv-label">activo</span><span class="kv-value">si aparece en cuadres</span></div>
              <div class="alert alert-info" style="margin-top:10px;margin-bottom:0;font-size:11px">
                📝 <strong>Qué registrar primero:</strong> Crea todos los grupos/supervisores antes de crear bancas.
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">🏪 bancas</div></div>
            <div class="card-body" style="font-size:12px">
              <p style="color:var(--muted);margin-bottom:10px">Vendedores, agencias o verifones. Pertenecen a un grupo.</p>
              <div class="kv-row"><span class="kv-label">codigo, nombre, agencia</span><span class="kv-value">identificación</span></div>
              <div class="kv-row"><span class="kv-label">usuario_sistema</span><span class="kv-value" style="color:var(--accent)">⚠️ CLAVE para mapeo CSV</span></div>
              <div class="kv-row"><span class="kv-label">porcentaje_comision</span><span class="kv-value">% sobre ventas que gana el vendedor</span></div>
              <div class="kv-row"><span class="kv-label">grupo_id</span><span class="kv-value">a qué grupo pertenece</span></div>
              <div class="alert alert-info" style="margin-top:10px;margin-bottom:0;font-size:11px">
                📝 <strong>Importante:</strong> El campo <code>usuario_sistema</code> debe coincidir con la columna <code>Usuario</code> del CSV exportado.
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">📅 periodos</div></div>
            <div class="card-body" style="font-size:12px">
              <p style="color:var(--muted);margin-bottom:10px">Una semana de cuadre (lunes a domingo). Todo se filtra por período.</p>
              <div class="kv-row"><span class="kv-label">fecha_inicio, fecha_fin</span><span class="kv-value">rango de la semana</span></div>
              <div class="kv-row"><span class="kv-label">descripcion</span><span class="kv-value">ej: "Semana 16 al 22 Febrero"</span></div>
              <div class="kv-row"><span class="kv-label">cerrado</span><span class="kv-value">marca semana como finalizada</span></div>
              <div class="alert alert-info" style="margin-top:10px;margin-bottom:0;font-size:11px">
                📝 <strong>Cuándo crear:</strong> Cada lunes, crea el nuevo período antes de importar ventas.
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">💰 ventas_semana</div></div>
            <div class="card-body" style="font-size:12px">
              <p style="color:var(--muted);margin-bottom:10px">Datos del sistema de gestión: ventas, premios y avances por banca/semana.</p>
              <div class="kv-row"><span class="kv-label">ventas, premios</span><span class="kv-value">datos del sistema de lotería</span></div>
              <div class="kv-row"><span class="kv-label" style="color:var(--blue)">avances</span><span class="kv-value" style="color:var(--blue)">préstamos entregados mid-week (se recuperan en cuadre)</span></div>
              <div class="kv-row"><span class="kv-label">recargas, servicios</span><span class="kv-value">otros ingresos del sistema</span></div>
              <div class="alert alert-success" style="margin-top:10px;margin-bottom:0;font-size:11px">
                📥 <strong>Cómo se llena:</strong> Via importación CSV o ingreso manual. Una vez cargado, el Dashboard y Resumen se actualizan en tiempo real.
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">💸 gastos</div></div>
            <div class="card-body" style="font-size:12px">
              <p style="color:var(--muted);margin-bottom:10px">Gastos operativos por banca o grupo. Se descuentan del resultado.</p>
              <div class="kv-row"><span class="kv-label">operativo</span><span class="kv-value">internet, materiales, etc.</span></div>
              <div class="kv-row"><span class="kv-label">central</span><span class="kv-value">gastos que paga la central</span></div>
              <div class="kv-row"><span class="kv-label" style="color:var(--yellow)">participacion</span><span class="kv-value" style="color:var(--yellow)">se crea automáticamente al guardar cuadre</span></div>
              <div class="kv-row"><span class="kv-label">sistema, equipo, otro</span><span class="kv-value">otros tipos</span></div>
              <div class="alert alert-info" style="margin-top:10px;margin-bottom:0;font-size:11px">
                📝 <strong>Cuándo registrar:</strong> Antes de ejecutar el cuadre. Si hay un gasto de internet de una banca específica, asignarlo a esa banca.
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">⚖️ cuadres_grupo</div></div>
            <div class="card-body" style="font-size:12px">
              <p style="color:var(--muted);margin-bottom:10px">El resultado final del cuadre semanal por grupo. Se crea al hacer clic en "Guardar Cuadre".</p>
              <div class="kv-row"><span class="kv-label">resultado_loteria</span><span class="kv-value">resultado total del grupo</span></div>
              <div class="kv-row"><span class="kv-label">balance_pendiente_anterior</span><span class="kv-value">del cuadre previo</span></div>
              <div class="kv-row"><span class="kv-label">total_a_depositar</span><span class="kv-value">lo que debe dar el supervisor</span></div>
              <div class="kv-row"><span class="kv-label">balance_final</span><span class="kv-value">→ se usa como balance_anterior del próximo cuadre</span></div>
              <div class="alert alert-success" style="margin-top:10px;margin-bottom:0;font-size:11px">
                ✅ <strong>Flujo:</strong> balance_final de esta semana → balance_anterior de la próxima semana (ingresar manualmente).
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">💰 prestamos</div></div>
            <div class="card-body" style="font-size:12px">
              <p style="color:var(--muted);margin-bottom:10px">Préstamos/avances adicionales manuales durante la semana que no vienen del CSV.</p>
              <div class="kv-row"><span class="kv-label">tipo: salida</span><span class="kv-value">dinero entregado al supervisor</span></div>
              <div class="kv-row"><span class="kv-label">tipo: entrada</span><span class="kv-value">devolución del supervisor</span></div>
              <div class="alert alert-info" style="margin-top:10px;margin-bottom:0;font-size:11px">
                📝 <strong>Diferencia con avances:</strong> Los <em>avances</em> del CSV son automáticos (por banca). Los <em>préstamos</em> aquí son movimientos manuales por grupo durante la semana.
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">📈 participacion_acumulada</div></div>
            <div class="card-body" style="font-size:12px">
              <p style="color:var(--muted);margin-bottom:10px">Seguimiento del arrastre de participación de beneficios por grupo.</p>
              <div class="kv-row"><span class="kv-label">beneficio_semana</span><span class="kv-value">resultado del período</span></div>
              <div class="kv-row"><span class="kv-label">arrastre_anterior</span><span class="kv-value">balance negativo de semanas previas</span></div>
              <div class="kv-row"><span class="kv-label">monto_a_pagar</span><span class="kv-value">solo si balance > 0</span></div>
              <div class="kv-row"><span class="kv-label">arrastre_siguiente</span><span class="kv-value">→ usarlo como arrastre del próximo cuadre</span></div>
              <div class="alert alert-success" style="margin-top:10px;margin-bottom:0;font-size:11px">
                ✅ <strong>Se actualiza automáticamente</strong> al guardar el cuadre. El campo "Arrastre Anterior Participación" en el cuadre = arrastre_siguiente del período anterior.
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">🏦 cuenta_banco</div></div>
            <div class="card-body" style="font-size:12px">
              <p style="color:var(--muted);margin-bottom:10px">Registro de todos los movimientos de la cuenta bancaria de la central.</p>
              <div class="kv-row"><span class="kv-label">tipo: ingreso</span><span class="kv-value">dinero recibido (de supervisores, etc.)</span></div>
              <div class="kv-row"><span class="kv-label">tipo: egreso</span><span class="kv-value">dinero salido (gastos, préstamos, etc.)</span></div>
              <div class="kv-row"><span class="kv-label">saldo_acumulado</span><span class="kv-value">calculado automáticamente al cargar</span></div>
              <div class="kv-row"><span class="kv-label">categoria</span><span class="kv-value">cuadre, gasto_operativo, nomina, participacion, otro</span></div>
              <div class="alert alert-info" style="margin-top:10px;margin-bottom:0;font-size:11px">
                📝 <strong>Cuándo registrar:</strong> Cada vez que haya un movimiento real en la cuenta bancaria. Registrar los depósitos que hacen los supervisores aquí.
              </div>
            </div>
          </div>
        </div>
      </div>


      <!-- ══ CATEGORÍAS ══ -->
      <div v-if="view==='categorias'">
        <div class="section-header">
          <div>
            <div class="section-title">🏷️ Categorías de Movimientos</div>
            <div class="section-sub">Define los tipos de ingresos y egresos del negocio</div>
          </div>
          <div class="export-group">
            <div class="export-wrap" :class="{open: exportOpen==='categorias'}" @click.stop>
              <button class="export-btn" @click="exportOpen = exportOpen==='categorias' ? '' : 'categorias'">
                ⬇ Exportar <span class="arrow">▼</span>
              </button>
              <div class="export-menu">
                <div class="export-menu-item" @click="exportOpen=''; exportToExcel('tbl-cat-ing','categorias_ingreso')">
                  <span class="icon">📊</span> Excel (.xlsx)
                </div>
                <div class="export-menu-item" @click="exportOpen=''; exportToPDF('tbl-cat-egr','Categorías','categorias')">
                  <span class="icon">📄</span> PDF
                </div>
              </div>
            </div>
            <button class="btn btn-primary" @click="editarCategoria({tipo:'egreso',activo:true,orden:0})">+ Nueva Categoría</button>
          </div>
        </div>
        <div class="grid-2">
          <!-- INGRESOS -->
          <div class="card">
            <div class="card-header">
              <div class="card-title" style="color:var(--accent)">📈 Categorías de Ingreso</div>
              <span class="tag tag-green">{{ categorias.filter(c=>c.tipo==='ingreso').length }}</span>
            </div>
            <div class="card-body" style="padding:0">
              <table id="tbl-cat-ing"><thead><tr><th>Nombre</th><th>Descripción</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="c in categorias.filter(c=>c.tipo==='ingreso').sort((a,b)=>a.orden-b.orden)" :key="c.id">
                    <td>
                      <span :style="'display:inline-block;width:8px;height:8px;border-radius:50%;background:'+c.color+';margin-right:6px'"></span>
                      {{ c.nombre }}
                      <span v-if="!c.activo" class="tag tag-gray" style="font-size:9px;margin-left:4px">Inactivo</span>
                    </td>
                    <td style="color:var(--muted)">{{ c.descripcion }}</td>
                    <td style="text-align:right;white-space:nowrap">
                      <button class="btn btn-ghost btn-xs" @click="editarCategoria(c)">Editar</button>
                      <button class="btn btn-danger btn-xs" @click="deleteCategoria(c.id)" style="margin-left:4px">✕</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <!-- EGRESOS -->
          <div class="card">
            <div class="card-header">
              <div class="card-title" style="color:var(--red)">📉 Categorías de Egreso</div>
              <span class="tag tag-red">{{ categorias.filter(c=>c.tipo==='egreso').length }}</span>
            </div>
            <div class="card-body" style="padding:0">
              <table id="tbl-cat-egr"><thead><tr><th>Nombre</th><th>Descripción</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="c in categorias.filter(c=>c.tipo==='egreso').sort((a,b)=>a.orden-b.orden)" :key="c.id">
                    <td>
                      <span :style="'display:inline-block;width:8px;height:8px;border-radius:50%;background:'+c.color+';margin-right:6px'"></span>
                      {{ c.nombre }}
                      <span v-if="!c.activo" class="tag tag-gray" style="font-size:9px;margin-left:4px">Inactivo</span>
                    </td>
                    <td style="color:var(--muted)">{{ c.descripcion }}</td>
                    <td style="text-align:right;white-space:nowrap">
                      <button class="btn btn-ghost btn-xs" @click="editarCategoria(c)">Editar</button>
                      <button class="btn btn-danger btn-xs" @click="deleteCategoria(c.id)" style="margin-left:4px">✕</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <!-- Modal -->
        <div class="overlay" v-if="showCategoriaModal" @click.self="showCategoriaModal=false">
          <div class="modal">
            <div class="modal-header">
              <div class="modal-title">{{ editCategoria.id ? 'Editar' : 'Nueva' }} Categoría</div>
              <button class="close-btn" @click="showCategoriaModal=false">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-grid">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Tipo</label>
                    <select class="form-control" v-model="editCategoria.tipo">
                      <option value="ingreso">📈 Ingreso</option>
                      <option value="egreso">📉 Egreso</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Orden</label>
                    <input type="number" class="form-control" v-model.number="editCategoria.orden" placeholder="0"/>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Nombre</label>
                  <input type="text" class="form-control" v-model="editCategoria.nombre" placeholder="Ej: Internet / Conectividad"/>
                </div>
                <div class="form-group">
                  <label class="form-label">Descripción</label>
                  <input type="text" class="form-control" v-model="editCategoria.descripcion" placeholder="Descripción opcional"/>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Color indicador</label>
                    <input type="color" class="form-control" v-model="editCategoria.color" style="height:40px;padding:4px"/>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Activo</label>
                    <select class="form-control" v-model="editCategoria.activo">
                      <option :value="true">Sí</option>
                      <option :value="false">No</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showCategoriaModal=false">Cancelar</button>
              <button class="btn btn-primary" @click="saveCategoria">Guardar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ FLUJO DE EFECTIVO ══ -->
      <div v-if="view==='flujo'">
        <div class="section-header">
          <div>
            <div class="section-title">💵 Flujo de Efectivo Real</div>
            <div class="section-sub">Dinero real que entra y sale — seguimiento semanal y mensual del dueño</div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <select class="form-control" style="width:180px" v-model="flujoFiltro.periodo_id" @change="loadFlujo">
              <option value="">— Todos los períodos —</option>
              <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
            </select>
            <select class="form-control" style="width:130px" v-model="flujoFiltro.mes">
              <option value="">— Todos los meses —</option>
              <option v-for="m in flujoMeses" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
            <select class="form-control" style="width:110px" v-model="flujoFiltro.tipo">
              <option value="">Todos</option>
              <option value="ingreso">📈 Ingresos</option>
              <option value="egreso">📉 Egresos</option>
            </select>
            <button class="btn btn-primary" @click="showFlujoModal=true">+ Registrar</button>
            <button class="btn btn-ghost" @click="loadFlujo">↺</button>
            <div class="export-wrap" :class="{open: exportOpen==='flujo'}" @click.stop>
              <button class="export-btn" @click="exportOpen = exportOpen==='flujo' ? '' : 'flujo'">
                ⬇ Exportar <span class="arrow">▼</span>
              </button>
              <div class="export-menu">
                <div class="export-menu-item" @click="exportOpen=''; exportToExcel('tbl-flujo','flujo_efectivo')">
                  <span class="icon">📊</span> Excel (.xlsx)
                </div>
                <div class="export-menu-item" @click="exportOpen=''; exportToPDF('tbl-flujo','Flujo de Efectivo','flujo')">
                  <span class="icon">📄</span> PDF
                </div>
              </div>
            </div>
            <button class="btn-export pdf"   @click="exportToPDF('tbl-flujo','Flujo de Efectivo Real','flujo_efectivo')">⬇ PDF</button>
          </div>
        </div>

        <!-- Explicación del flujo -->
        <div class="alert alert-info" style="margin-bottom:16px;font-size:12px;line-height:1.6">
          <strong>💵 ¿Qué es el Flujo de Efectivo Real?</strong><br/>
          Es el registro del dinero real que <strong>sale e ingresa al negocio del dueño</strong> — no el P&L contable, sino el efectivo físico.<br/>
          • Se auto-registra cuando guardas un cuadre con depósito (ingreso) o con avances/préstamos (egreso).<br/>
          • Puedes registrar movimientos manuales adicionales (gastos directos, ingresos externos, etc.).<br/>
          • Úsalo para saber exactamente cuánto efectivo tienes disponible semana a semana.
        </div>

        <!-- KPI Cards -->
        <div class="metrics-grid" style="margin-bottom:20px">
          <div class="metric-card green">
            <div class="metric-label">Ingresos del Período</div>
            <div class="metric-value pos">{{ fmt(flujoStats.ingresos) }}</div>
            <div class="metric-sub">💰 Efectivo recibido</div>
            <span class="metric-icon">📈</span>
          </div>
          <div class="metric-card red">
            <div class="metric-label">Egresos del Período</div>
            <div class="metric-value neg">{{ fmt(flujoStats.egresos) }}</div>
            <div class="metric-sub">💸 Efectivo pagado</div>
            <span class="metric-icon">📉</span>
          </div>
          <div class="metric-card" :class="flujoStats.neto>=0?'green':'red'">
            <div class="metric-label">Flujo Neto</div>
            <div class="metric-value" :class="flujoStats.neto>=0?'pos':'neg'">{{ fmt(flujoStats.neto) }}</div>
            <div class="metric-sub">Balance del período</div>
            <span class="metric-icon">⚖️</span>
          </div>
          <div class="metric-card blue">
            <div class="metric-label">Saldo Acumulado</div>
            <div class="metric-value">{{ fmt(flujoStats.saldo) }}</div>
            <div class="metric-sub">Total acumulado en caja</div>
            <span class="metric-icon">🏦</span>
          </div>
        </div>

        <!-- Gráfico de barras semanales -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-header">
            <div class="card-title">📊 Ingresos vs Egresos por Semana</div>
            <select class="form-control" style="width:150px" v-model="flujoFiltro.mes" @change="loadFlujo">
              <option value="">Todos los meses</option>
              <option v-for="m in flujoMeses" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>
          <div class="card-body"><div class="chart-wrap"><canvas id="chartFlujo"></canvas></div></div>
        </div>

        <div class="grid-2">
          <!-- Tabla de movimientos -->
          <div class="card" style="grid-column:1/-1">
            <div class="card-header">
              <div class="card-title">Registro de Movimientos</div>
              <div style="font-size:11px;color:var(--muted)">{{ flujoMovs.length }} registros</div>
            </div>
            <div class="card-body" style="padding:0">
              <div class="table-wrap">
                <table id="tbl-flujo">
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Grupo</th>
                      <th style="text-align:right">Ingreso</th><th style="text-align:right">Egreso</th>
                      <th style="text-align:right">Saldo</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="loadingFlujo"><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">Cargando...</td></tr>
                    <tr v-else-if="!flujoMovs.length"><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">Sin movimientos</td></tr>
                    <tr v-for="m in flujoMovs" :key="m.id">
                      <td>{{ m.fecha }}</td>
                      <td>
                        {{ m.concepto }}
                        <span v-if="m.ref_gasto_id" title="Originado desde Gastos" style="cursor:help;font-size:12px">🧾</span>
                        <span v-if="m.ref_banco_id" title="Originado desde Banco" style="cursor:help;font-size:12px">🏦</span>
                      </td>
                      <td>
                        <span class="tag" :style="'background:rgba('+hexToRgb(m.categorias?.color||'#5a6a80')+',0.15);color:'+(m.categorias?.color||'#5a6a80')+';border:1px solid rgba('+hexToRgb(m.categorias?.color||'#5a6a80')+',0.3)'">
                          {{ m.categorias?.nombre || '—' }}
                        </span>
                      </td>
                      <td>
                        {{ m.grupos?.nombre || '—' }}
                        <span v-if="m.bancas" style="display:block;font-size:10px;color:var(--yellow)">
                          🏦 {{ m.bancas?.codigo }} {{ m.bancas?.nombre }}
                        </span>
                      </td>
                      <td style="text-align:right" :class="m.tipo==='ingreso'?'num-pos':''">
                        {{ m.tipo==='ingreso' ? fmt(m.monto) : '' }}
                      </td>
                      <td style="text-align:right" :class="m.tipo==='egreso'?'num-neg':''">
                        {{ m.tipo==='egreso' ? fmt(m.monto) : '' }}
                      </td>
                      <td style="text-align:right" :class="m.saldo_acumulado>=0?'num-pos':'num-neg'">{{ fmt(m.saldo_acumulado) }}</td>
                      <td style="white-space:nowrap">
                        <button class="btn btn-ghost btn-xs" @click="editarFlujo(m)" style="margin-right:4px">✏️</button>
                        <button class="btn btn-danger btn-xs" @click="deleteFlujo(m.id)">✕</button>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot v-if="flujoMovs.length">
                    <tr class="summary-row">
                      <td colspan="4"><strong>TOTAL</strong></td>
                      <td style="text-align:right" class="num-pos"><strong>{{ fmt(flujoStats.ingresos) }}</strong></td>
                      <td style="text-align:right" class="num-neg"><strong>{{ fmt(flujoStats.egresos) }}</strong></td>
                      <td style="text-align:right" :class="flujoStats.neto>=0?'num-pos':'num-neg'"><strong>{{ fmt(flujoStats.neto) }}</strong></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <!-- Por Categoría -->
          <div class="card">
            <div class="card-header"><div class="card-title">📊 Por Categoría de Ingreso</div></div>
            <div class="card-body" style="padding:0">
              <table><thead><tr><th>Categoría</th><th style="text-align:right">Total</th><th style="text-align:right">%</th></tr></thead>
                <tbody>
                  <tr v-for="c in flujoXCategoria.filter(x=>x.tipo==='ingreso')" :key="c.id">
                    <td>
                      <span :style="'display:inline-block;width:8px;height:8px;border-radius:50%;background:'+c.color+';margin-right:6px'"></span>
                      {{ c.nombre }}
                    </td>
                    <td style="text-align:right" class="num-pos">{{ fmt(c.total) }}</td>
                    <td style="text-align:right;color:var(--muted)">{{ c.pct }}%</td>
                  </tr>
                  <tr v-if="!flujoXCategoria.filter(x=>x.tipo==='ingreso').length"><td colspan="3" style="color:var(--muted);text-align:center;padding:12px">Sin datos</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">📊 Por Categoría de Egreso</div></div>
            <div class="card-body" style="padding:0">
              <table><thead><tr><th>Categoría</th><th style="text-align:right">Total</th><th style="text-align:right">%</th></tr></thead>
                <tbody>
                  <tr v-for="c in flujoXCategoria.filter(x=>x.tipo==='egreso')" :key="c.id">
                    <td>
                      <span :style="'display:inline-block;width:8px;height:8px;border-radius:50%;background:'+c.color+';margin-right:6px'"></span>
                      {{ c.nombre }}
                    </td>
                    <td style="text-align:right" class="num-neg">{{ fmt(c.total) }}</td>
                    <td style="text-align:right;color:var(--muted)">{{ c.pct }}%</td>
                  </tr>
                  <tr v-if="!flujoXCategoria.filter(x=>x.tipo==='egreso').length"><td colspan="3" style="color:var(--muted);text-align:center;padding:12px">Sin datos</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Modal flujo -->
        <div class="overlay" v-if="showFlujoModal" @click.self="showFlujoModal=false">
          <div class="modal">
            <div class="modal-header">
              <div class="modal-title">{{ flujoEditId ? "✏️ Editar Movimiento" : "💵 Registrar Movimiento de Efectivo" }}</div>
              <button class="close-btn" @click="showFlujoModal=false">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-grid">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Fecha</label>
                    <input type="date" class="form-control" v-model="flujoFrm.fecha"/>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Tipo</label>
                    <select class="form-control" v-model="flujoFrm.tipo">
                      <option value="ingreso">📈 Ingreso</option>
                      <option value="egreso">📉 Egreso</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Categoría <span style="color:var(--accent)">(filtrada por tipo)</span></label>
                  <select class="form-control" v-model="flujoFrm.categoria_id">
                    <option value="">— Seleccionar —</option>
                    <option v-for="c in categorias.filter(c=>c.tipo===flujoFrm.tipo&&c.activo)" :key="c.id" :value="c.id">
                      {{ c.nombre }}
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Concepto</label>
                  <input type="text" class="form-control" v-model="flujoFrm.concepto" placeholder="Descripción del movimiento"/>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Monto</label>
                    <input type="number" class="form-control" v-model.number="flujoFrm.monto" placeholder="0"/>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Grupo (opcional)</label>
                    <select class="form-control" v-model="flujoFrm.grupo_id">
                      <option value="">— Ninguno —</option>
                      <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
                    </select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Período (opcional)</label>
                    <select class="form-control" v-model="flujoFrm.periodo_id">
                      <option value="">— Ninguno —</option>
                      <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Referencia</label>
                    <input type="text" class="form-control" v-model="flujoFrm.referencia" placeholder="Nro. transacción..."/>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Notas</label>
                  <input type="text" class="form-control" v-model="flujoFrm.notas" placeholder="Observaciones..."/>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showFlujoModal=false;flujoEditId=null">Cancelar</button>
              <button class="btn btn-primary" @click="saveFlujo">{{ flujoEditId ? 'Actualizar' : 'Guardar' }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ ESTADO DE RESULTADOS ══ -->
      <div v-if="view==='estado_resultados'">
        <div class="section-header">
          <div>
            <div class="section-title">📑 Estado de Resultados (P&L)</div>
            <div class="section-sub">Reporte de ganancias y pérdidas — por período, mes o banca</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <!-- Toggle modo -->
            <div style="display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">
              <button :class="erFiltro.modo==='periodo'?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'" style="border-radius:0;border:none" @click="erFiltro.modo='periodo';erFiltro.mes='';loadEstadoResultados()">Por Período</button>
              <button :class="erFiltro.modo==='mes'?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'" style="border-radius:0;border:none" @click="erFiltro.modo='mes';erFiltro.periodo_id='';loadEstadoResultados()">Por Mes</button>
            </div>
            <!-- Período -->
            <select v-if="erFiltro.modo==='periodo'" class="form-control" style="width:200px" v-model="erFiltro.periodo_id" @change="loadEstadoResultados">
              <option value="">— Seleccionar período —</option>
              <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
            </select>
            <!-- Mes -->
            <input v-if="erFiltro.modo==='mes'" type="month" class="form-control" style="width:160px" v-model="erFiltro.mes" @change="loadEstadoResultados"/>
            <!-- Grupo -->
            <select class="form-control" style="width:160px" v-model="erFiltro.grupo_id" @change="loadEstadoResultados">
              <option value="">Todos los grupos</option>
              <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
            </select>
            <button class="btn btn-ghost btn-sm" @click="loadEstadoResultados">↺</button>
            <button class="btn-export excel" @click="exportERExcel()">⬇ Excel</button>
            <button class="btn-export pdf"   @click="printER()">⬇ PDF</button>
          </div>
        </div>

        <div v-if="loadingER" style="text-align:center;padding:40px;color:var(--muted)">Calculando...</div>
        <div v-else-if="!erData">
          <div class="empty"><div class="empty-icon">📑</div><p>Selecciona un período o mes para generar el estado de resultados</p></div>
        </div>
        <div v-else id="erContent">
          <!-- Título del reporte -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-body" style="text-align:center;padding:20px">
              <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted)">Estado de Resultados</div>
              <div style="font-family:var(--font-h);font-size:20px;font-weight:800;margin:6px 0">
                {{ erFiltro.grupo_id ? grupos.find(g=>g.id===erFiltro.grupo_id)?.nombre : 'GLOBAL — TODOS LOS GRUPOS' }}
              </div>
              <div style="font-size:13px;color:var(--accent)">
                {{ erFiltro.periodo_id ? periodos.find(p=>p.id===erFiltro.periodo_id)?.descripcion : 'Todos los períodos' }}
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px">Generado: {{ new Date().toLocaleDateString('es-DO',{weekday:'long',year:'numeric',month:'long',day:'numeric'}) }}</div>
            </div>
          </div>

          <!-- SECCIÓN I: INGRESOS BRUTOS -->
          <div class="card" style="margin-bottom:12px">
            <div class="card-header" style="background:rgba(0,229,160,0.07)">
              <div class="card-title" style="color:var(--accent)">I. INGRESOS BRUTOS DE LOTERÍA</div>
            </div>
            <div class="card-body">
              <div class="kv-row"><span class="kv-label">Total Ventas de Lotería</span><span class="kv-value num-pos">{{ fmt(erData.ventas_total) }}</span></div>
              <div class="kv-row" v-if="erData.recargas_total"><span class="kv-label">Recargas y Servicios</span><span class="kv-value num-pos">{{ fmt(erData.recargas_total) }}</span></div>
              <div class="kv-row kv-total"><span class="kv-label"><strong>TOTAL INGRESOS BRUTOS</strong></span><span class="kv-value num-pos"><strong>{{ fmt(erData.ingresos_brutos) }}</strong></span></div>
            </div>
          </div>

          <!-- SECCIÓN II: COSTO DE VENTAS -->
          <div class="card" style="margin-bottom:12px">
            <div class="card-header" style="background:rgba(255,77,109,0.05)">
              <div class="card-title" style="color:var(--red)">II. COSTO DE VENTAS (PREMIOS Y COMISIONES)</div>
            </div>
            <div class="card-body">
              <div class="kv-row"><span class="kv-label">(-) Premios Pagados a Apostadores</span><span class="kv-value num-neg">{{ fmt(erData.premios_total) }}</span></div>
              <div class="kv-row"><span class="kv-label">(-) Comisiones a Vendedores</span><span class="kv-value num-neg">{{ fmt(erData.comisiones_total) }}</span></div>
              <div class="kv-row kv-total"><span class="kv-label"><strong>TOTAL COSTO DE VENTAS</strong></span><span class="kv-value num-neg"><strong>{{ fmt(erData.costo_ventas) }}</strong></span></div>
              <div class="divider"></div>
              <div class="kv-row kv-total" style="background:rgba(0,229,160,0.07)">
                <span class="kv-label"><strong>MARGEN BRUTO DE LOTERÍA</strong></span>
                <span :class="['kv-value', erData.margen_bruto>=0?'num-pos':'num-neg']"><strong>{{ fmt(erData.margen_bruto) }}</strong></span>
              </div>
              <div class="kv-row"><span class="kv-label">Margen % sobre ventas</span><span class="kv-value" style="color:var(--yellow)">{{ erData.margen_pct }}%</span></div>
            </div>
          </div>

          <!-- SECCIÓN III: GASTOS OPERATIVOS -->
          <div class="card" style="margin-bottom:12px">
            <div class="card-header" style="background:rgba(255,209,102,0.05)">
              <div class="card-title" style="color:var(--yellow)">III. GASTOS OPERATIVOS</div>
            </div>
            <div class="card-body">
              <div class="kv-row" v-for="g in erData.gastos_x_categoria" :key="g.nombre">
                <span class="kv-label">(-) {{ g.nombre }}</span>
                <span class="kv-value num-neg">{{ fmt(g.total) }}</span>
              </div>
              <div v-if="!erData.gastos_x_categoria.length" style="color:var(--muted);font-size:11px;padding:8px 0">Sin gastos registrados</div>
              <div class="kv-row kv-total"><span class="kv-label"><strong>TOTAL GASTOS OPERATIVOS</strong></span><span class="kv-value num-neg"><strong>{{ fmt(erData.gastos_total) }}</strong></span></div>
              <div class="divider"></div>
              <div class="kv-row kv-total" style="background:rgba(0,229,160,0.07)">
                <span class="kv-label"><strong>RESULTADO OPERATIVO (EBITDA)</strong></span>
                <span :class="['kv-value', erData.ebitda>=0?'num-pos':'num-neg']"><strong>{{ fmt(erData.ebitda) }}</strong></span>
              </div>
            </div>
          </div>

          <!-- SECCIÓN IV: PARTICIPACIONES -->
          <div class="card" style="margin-bottom:12px">
            <div class="card-header" style="background:rgba(255,209,102,0.05)">
              <div class="card-title" style="color:var(--yellow)">IV. PARTICIPACIONES PAGADAS A SUPERVISORES</div>
            </div>
            <div class="card-body">
              <div class="kv-row" v-for="g in erData.participaciones_x_grupo" :key="g.grupo">
                <span class="kv-label">(-) {{ g.grupo }} ({{ g.pct }}%)</span>
                <span class="kv-value num-neg">{{ fmt(g.total) }}</span>
              </div>
              <div v-if="!erData.participaciones_x_grupo.length" style="color:var(--muted);font-size:11px;padding:8px 0">Sin participaciones</div>
              <div class="kv-row kv-total"><span class="kv-label"><strong>TOTAL PARTICIPACIONES</strong></span><span class="kv-value num-neg"><strong>{{ fmt(erData.participaciones_total) }}</strong></span></div>
              <div class="divider"></div>
              <div class="kv-row kv-total" style="background:rgba(0,229,160,0.1);border:1px solid rgba(0,229,160,0.2)">
                <span class="kv-label"><strong>RESULTADO NETO ANTES DE BALANCES PENDIENTES</strong></span>
                <span :class="['kv-value', erData.resultado_neto>=0?'num-pos':'num-neg']"><strong>{{ fmt(erData.resultado_neto) }}</strong></span>
              </div>
            </div>
          </div>

          <!-- SECCIÓN V: BALANCES Y EFECTIVO -->
          <div class="card" style="margin-bottom:12px">
            <div class="card-header" style="background:rgba(76,201,240,0.05)">
              <div class="card-title" style="color:var(--blue)">V. MOVIMIENTOS DE EFECTIVO</div>
            </div>
            <div class="card-body">
              <div class="kv-row"><span class="kv-label">Total depositado/entregado a central</span><span class="kv-value num-pos">{{ fmt(erData.depositado_total) }}</span></div>
              <div class="kv-row"><span class="kv-label">Balance pendiente (suma todos los grupos)</span><span :class="['kv-value', erData.balance_pendiente_total>=0?'':'num-neg']">{{ fmt(erData.balance_pendiente_total) }}</span></div>
              <div class="kv-row"><span class="kv-label">Préstamos otorgados en el período</span><span class="kv-value num-neg">{{ fmt(erData.prestamos_otorgados) }}</span></div>
              <div class="kv-row"><span class="kv-label">Devoluciones de préstamos</span><span class="kv-value num-pos">{{ fmt(erData.prestamos_devueltos) }}</span></div>
            </div>
          </div>

          <!-- SECCIÓN VI: RESUMEN POR GRUPO -->
          <div class="card" style="margin-bottom:12px">
            <div class="card-header">
              <div class="card-title">VI. DETALLE POR GRUPO</div>
            </div>
            <div class="card-body" style="padding:0">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Grupo</th><th style="text-align:right">Ventas</th><th style="text-align:right">Premios</th>
                      <th style="text-align:right">Comisión</th><th style="text-align:right">Gastos</th>
                      <th style="text-align:right">Participación</th><th style="text-align:right">Resultado</th>
                      <th style="text-align:right">Depositado</th><th style="text-align:right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="g in erData.detalle_grupos" :key="g.grupo_id">
                      <td><strong>{{ g.nombre }}</strong></td>
                      <td style="text-align:right" class="num-pos">{{ fmt(g.ventas) }}</td>
                      <td style="text-align:right" class="num-neg">{{ fmt(g.premios) }}</td>
                      <td style="text-align:right" class="num-neg">{{ fmt(g.comisiones) }}</td>
                      <td style="text-align:right" class="num-neg">{{ fmt(g.gastos) }}</td>
                      <td style="text-align:right; color:var(--yellow)">{{ fmt(g.participacion) }}</td>
                      <td style="text-align:right" :class="g.resultado>=0?'num-pos':'num-neg'"><strong>{{ fmt(g.resultado) }}</strong></td>
                      <td style="text-align:right" class="num-pos">{{ fmt(g.depositado) }}</td>
                      <td style="text-align:right" :class="g.balance>=0?'num-pos':'num-neg'">{{ fmt(g.balance) }}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr class="summary-row">
                      <td><strong>TOTAL</strong></td>
                      <td style="text-align:right">{{ fmt(erData.ventas_total) }}</td>
                      <td style="text-align:right">{{ fmt(erData.premios_total) }}</td>
                      <td style="text-align:right">{{ fmt(erData.comisiones_total) }}</td>
                      <td style="text-align:right">{{ fmt(erData.gastos_total) }}</td>
                      <td style="text-align:right">{{ fmt(erData.participaciones_total) }}</td>
                      <td style="text-align:right">{{ fmt(erData.resultado_neto) }}</td>
                      <td style="text-align:right">{{ fmt(erData.depositado_total) }}</td>
                      <td style="text-align:right">{{ fmt(erData.balance_pendiente_total) }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <!-- RESUMEN FINAL -->
          <div class="card" style="border:2px solid var(--accent)">
            <div class="card-header" style="background:rgba(0,229,160,0.1)">
              <div class="card-title" style="color:var(--accent);font-size:16px">✅ RESUMEN EJECUTIVO</div>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;text-align:center">
                <div>
                  <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Ingresos Brutos</div>
                  <div style="font-size:18px;font-weight:700;color:var(--accent)">{{ fmt(erData.ingresos_brutos) }}</div>
                </div>
                <div>
                  <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Costo de Ventas</div>
                  <div style="font-size:18px;font-weight:700;color:var(--red)">{{ fmt(erData.costo_ventas) }}</div>
                </div>
                <div>
                  <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Gastos Oper.</div>
                  <div style="font-size:18px;font-weight:700;color:var(--yellow)">{{ fmt(erData.gastos_total) }}</div>
                </div>
                <div>
                  <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Participaciones</div>
                  <div style="font-size:18px;font-weight:700;color:var(--yellow)">{{ fmt(erData.participaciones_total) }}</div>
                </div>
                <div style="background:rgba(0,229,160,0.1);border:1px solid rgba(0,229,160,0.3);border-radius:8px;padding:12px">
                  <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">RESULTADO NETO</div>
                  <div style="font-size:22px;font-weight:800" :style="erData.resultado_neto>=0?'color:var(--accent)':'color:var(--red)'">{{ fmt(erData.resultado_neto) }}</div>
                  <div style="font-size:10px;color:var(--muted)">{{ erData.margen_pct }}% margen</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ SECCIÓN VII — ¿A Dónde Va el Dinero? ══ -->
      <div v-if="view==='seccion_vii'">

        <div class="section-header">
          <div>
            <div class="section-title">💰 ¿A Dónde Va el Dinero?</div>
            <div class="section-sub">Reconciliación P&amp;L vs Flujo de Caja — análisis para alta dirección</div>
          </div>
        </div>

        <!-- FILTROS -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-body" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
            <div class="form-group" style="min-width:200px;margin:0">
              <label class="form-label">Período</label>
              <select class="form-control" v-model="s7Filtro.periodo_id"
                      @change="loadSeccionVII().then(()=>$nextTick(renderS7Charts))">
                <option value="">— Seleccionar período —</option>
                <option v-for="p in periodos" :key="p.id" :value="p.id">
                  {{ p.descripcion || p.fecha_inicio }}
                </option>
              </select>
            </div>
            <div class="form-group" style="min-width:180px;margin:0">
              <label class="form-label">Grupo (opcional)</label>
              <select class="form-control" v-model="s7Filtro.grupo_id"
                      @change="loadSeccionVII().then(()=>$nextTick(renderS7Charts))">
                <option value="">Todos los grupos</option>
                <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- LOADING -->
        <div v-if="loadingS7" style="text-align:center;padding:40px;color:var(--muted)">
          ⏳ Calculando reconciliación...
        </div>

        <!-- SIN DATOS -->
        <div v-else-if="!s7Data" class="alert alert-info">
          Selecciona un período para ver el análisis de ¿A Dónde Va el Dinero?
        </div>

        <template v-else>

          <!-- ── KPIs PRINCIPALES ── -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:20px">

            <div class="metric-card">
              <div class="metric-label">💵 INGRESOS BRUTOS</div>
              <div class="metric-value">{{ fmt(s7Data.ingresos_brutos) }}</div>
            </div>

            <div :class="['metric-card', s7Data.margen_bruto>=0?'green':'red']">
              <div class="metric-label">📊 MARGEN BRUTO</div>
              <div :class="['metric-value', s7Data.margen_bruto>=0?'pos':'neg']">{{ fmt(s7Data.margen_bruto) }}</div>
              <div class="metric-sub">{{ pct(s7Data.margen_bruto, s7Data.ingresos_brutos) }} del ingreso</div>
            </div>

            <div :class="['metric-card', s7Data.ebitda>=0?'green':'red']">
              <div class="metric-label">⚙️ EBITDA</div>
              <div :class="['metric-value', s7Data.ebitda>=0?'pos':'neg']">{{ fmt(s7Data.ebitda) }}</div>
            </div>

            <div :class="['metric-card', s7Data.resultado_neto>=0?'green':'red']">
              <div class="metric-label">🏁 RESULTADO NETO</div>
              <div :class="['metric-value', s7Data.resultado_neto>=0?'pos':'neg']">{{ fmt(s7Data.resultado_neto) }}</div>
            </div>

            <div class="metric-card">
              <div class="metric-label">🏦 DEPOSITADO</div>
              <div class="metric-value" style="color:var(--accent)">{{ fmt(s7Data.depositado_total) }}</div>
            </div>

            <div :class="['metric-card', Math.abs(s7Data.diferencia_pnl_vs_caja)<1?'green':'']">
              <div class="metric-label">⚖️ DIFERENCIA P&amp;L vs CAJA</div>
              <div :class="['metric-value', s7Data.diferencia_pnl_vs_caja===0?'pos':Math.abs(s7Data.diferencia_pnl_vs_caja)>0?'neg':'pos']">
                {{ fmt(s7Data.diferencia_pnl_vs_caja) }}
              </div>
              <div class="metric-sub" style="font-size:9px">{{ s7Data.diferencia_pnl_vs_caja===0?'✅ Cuadrado':'⚠️ Revisar reconciliación' }}</div>
            </div>

          </div>

          <!-- ── CASCADA DEL DINERO + DONUT ── -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">

            <!-- Waterfall — ¿Cómo se distribuye? -->
            <div class="card">
              <div class="card-header">
                <div class="card-title">📉 Cascada del Dinero</div>
                <div class="card-sub">De ingresos brutos a resultado neto</div>
              </div>
              <div class="card-body" style="padding:0">
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                  <tbody>
                    <tr v-for="(row, idx) in s7Data.waterfall" :key="idx"
                        :style="row.tipo==='total'?'background:rgba(0,229,160,0.08);font-weight:700':
                                row.tipo==='subtotal'?'background:rgba(var(--accent-rgb,26,115,232),0.06);font-weight:600':
                                'border-bottom:1px solid var(--border)'">
                      <td style="padding:10px 16px">
                        <span v-if="row.tipo==='total'" style="color:var(--accent)">▶</span>
                        <span v-else-if="row.tipo==='subtotal'" style="color:var(--text-muted)">→</span>
                        <span v-else-if="row.valor<0" style="color:var(--red)">▼</span>
                        <span v-else style="color:var(--green)">▲</span>
                        {{ row.label }}
                      </td>
                      <td style="padding:10px 16px;text-align:right"
                          :class="row.tipo==='total'?'pos':row.valor<0?'neg':row.tipo==='subtotal'?'':'pos'">
                        {{ fmt(row.valor) }}
                      </td>
                      <td style="padding:10px 16px;text-align:right;color:var(--muted);font-size:11px">
                        {{ pct(Math.abs(row.valor), s7Data.ingresos_brutos) }}
                      </td>
                      <td style="padding:10px 8px;width:100px">
                        <div v-if="row.tipo!=='subtotal' && row.tipo!=='total'"
                             style="height:6px;border-radius:3px;background:var(--border)">
                          <div :style="'height:100%;border-radius:3px;width:'+pct(Math.abs(row.valor), s7Data.ingresos_brutos)+';background:'+(row.valor<0?'var(--red)':'var(--green)')"></div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Donut — Destino visual -->
            <div class="card">
              <div class="card-header">
                <div class="card-title">🎯 Destino del Dinero</div>
                <div class="card-sub">Cómo se distribuyó cada peso ingresado</div>
              </div>
              <div class="card-body">
                <div style="height:200px;position:relative">
                  <canvas id="chartS7Destino"></canvas>
                </div>
                <div style="margin-top:12px">
                  <div v-for="d in s7Data.destinos" :key="d.label"
                       style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:11px">
                    <div :style="'width:10px;height:10px;border-radius:50%;flex-shrink:0;background:'+d.color"></div>
                    <div style="flex:1">{{ d.label }}</div>
                    <div style="width:80px;background:var(--border);border-radius:3px;height:5px">
                      <div :style="'height:100%;border-radius:3px;background:'+d.color+';width:'+d.pct"></div>
                    </div>
                    <div style="width:60px;text-align:right;font-weight:600">{{ fmt(d.monto) }}</div>
                    <div style="width:40px;text-align:right;color:var(--muted)">{{ d.pct }}</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- ── RECONCILIACIÓN P&L vs CAJA ── -->
          <div class="card" style="margin-bottom:20px">
            <div class="card-header">
              <div class="card-title">⚖️ Reconciliación Contable vs Caja Real</div>
              <div class="card-sub">Por qué el resultado contable puede diferir del dinero depositado</div>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">

                <div>
                  <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--muted);margin-bottom:12px;text-transform:uppercase">📋 Estado de Resultados</div>
                  <div class="kv-row"><span>Ingresos brutos</span><span style="color:var(--green)">{{ fmt(s7Data.ingresos_brutos) }}</span></div>
                  <div class="kv-row"><span>– Premios pagados</span><span style="color:var(--red)">–{{ fmt(s7Data.premios_total) }}</span></div>
                  <div class="kv-row"><span>– Comisiones</span><span style="color:var(--red)">–{{ fmt(s7Data.comisiones_total) }}</span></div>
                  <div class="kv-row"><span>= Margen bruto</span><span :class="s7Data.margen_bruto>=0?'pos':'neg'">{{ fmt(s7Data.margen_bruto) }}</span></div>
                  <div class="kv-row"><span>– Gastos operativos</span><span style="color:var(--red)">–{{ fmt(s7Data.gastos_total) }}</span></div>
                  <div class="kv-row"><span>= EBITDA</span><span :class="s7Data.ebitda>=0?'pos':'neg'">{{ fmt(s7Data.ebitda) }}</span></div>
                  <div class="kv-row"><span>– Participaciones</span><span style="color:var(--red)">–{{ fmt(s7Data.participaciones_total) }}</span></div>
                  <div class="kv-row kv-total"><span>= RESULTADO NETO</span><span :class="s7Data.resultado_neto>=0?'pos':'neg'">{{ fmt(s7Data.resultado_neto) }}</span></div>
                </div>

                <div>
                  <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--muted);margin-bottom:12px;text-transform:uppercase">🏦 Movimiento de Caja</div>
                  <div class="kv-row"><span>Depositado al banco</span><span style="color:var(--accent)">{{ fmt(s7Data.depositado_total) }}</span></div>
                  <div class="kv-row"><span>Balance en mano (supervisores)</span><span style="color:var(--yellow)">{{ fmt(s7Data.balance_mano_total) }}</span></div>
                  <div class="kv-row kv-total"><span>= Total caja gestionada</span><span style="color:var(--accent)">{{ fmt(s7Data.caja_total) }}</span></div>
                  <div style="margin-top:16px;padding:12px;border-radius:8px;border:1px solid var(--border)"
                       :style="Math.abs(s7Data.diferencia_pnl_vs_caja)<1?'background:rgba(0,229,160,0.06)':'background:rgba(255,77,109,0.06)'">
                    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">DIFERENCIA P&amp;L vs CAJA</div>
                    <div style="font-size:22px;font-weight:700"
                         :class="Math.abs(s7Data.diferencia_pnl_vs_caja)<1?'pos':'neg'">
                      {{ fmt(s7Data.diferencia_pnl_vs_caja) }}
                    </div>
                    <div style="font-size:11px;color:var(--muted);margin-top:4px">
                      <span v-if="Math.abs(s7Data.diferencia_pnl_vs_caja)<1">✅ Cuadrado — resultado contable y caja coinciden</span>
                      <span v-else>⚠️ Diferencia pendiente de reconciliar — puede incluir créditos o ajustes no registrados</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- ── TABLA DE RECONCILIACIÓN POR GRUPO ── -->
          <div class="card" style="margin-bottom:20px">
            <div class="card-header">
              <div class="card-title">🏪 Reconciliación por Grupo</div>
              <div class="card-sub">Resultado calculado vs dinero realmente gestionado</div>
            </div>
            <div class="card-body" style="padding:0">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th style="text-align:right">Resultado</th>
                    <th style="text-align:right">Depositado</th>
                    <th style="text-align:right">Balance mano</th>
                    <th style="text-align:right">Préstamos netos</th>
                    <th style="text-align:right">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in s7Data.reconciliacion" :key="r.nombre">
                    <td><strong>{{ r.nombre }}</strong></td>
                    <td style="text-align:right" :class="r.resultado>=0?'num-pos':'num-neg'">{{ fmt(r.resultado) }}</td>
                    <td style="text-align:right;color:var(--accent)">{{ fmt(r.depositado) }}</td>
                    <td style="text-align:right;color:var(--yellow)">{{ fmt(r.balance) }}</td>
                    <td style="text-align:right">{{ fmt(r.prestamos) }}</td>
                    <td style="text-align:right"
                        :class="Math.abs(r.resultado-(r.depositado+r.balance))<1?'num-pos':'num-neg'">
                      {{ fmt(r.resultado - r.depositado - r.balance) }}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style="font-weight:700;background:var(--bg-hover)">
                    <td>TOTAL</td>
                    <td style="text-align:right" :class="s7Data.resultado_neto>=0?'num-pos':'num-neg'">{{ fmt(s7Data.resultado_neto) }}</td>
                    <td style="text-align:right;color:var(--accent)">{{ fmt(s7Data.depositado_total) }}</td>
                    <td style="text-align:right;color:var(--yellow)">{{ fmt(s7Data.balance_mano_total) }}</td>
                    <td style="text-align:right">{{ fmt(s7Data.prestamos_netos) }}</td>
                    <td style="text-align:right" :class="Math.abs(s7Data.diferencia_pnl_vs_caja)<1?'num-pos':'num-neg'">
                      {{ fmt(s7Data.diferencia_pnl_vs_caja) }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- ── FLUJO BANCARIO POR CATEGORÍA ── -->
          <div class="card" v-if="s7Data.flujoPorCat.length">
            <div class="card-header">
              <div class="card-title">🏦 Movimientos Bancarios por Categoría</div>
              <div class="card-sub">Trazabilidad del dinero en cuenta bancaria</div>
            </div>
            <div class="card-body" style="padding:0">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th style="text-align:right">Ingresos</th>
                    <th style="text-align:right">Egresos</th>
                    <th style="text-align:right">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="f in s7Data.flujoPorCat" :key="f.label">
                    <td>
                      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px"
                            :style="'background:'+f.color"></span>
                      {{ f.label }}
                    </td>
                    <td style="text-align:right" class="num-pos">{{ fmt(f.ingresos) }}</td>
                    <td style="text-align:right" class="num-neg">{{ f.egresos > 0 ? '–'+fmt(f.egresos) : '—' }}</td>
                    <td style="text-align:right" :class="(f.ingresos-f.egresos)>=0?'num-pos':'num-neg'">
                      {{ fmt(f.ingresos - f.egresos) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        


</template>
      </div>
      <!-- /SECCIÓN VII -->


      <!-- ══ USUARIOS ══ -->
      <!-- ══ USUARIOS ══ -->
      <div v-if="view==='usuarios'">
        <div class="section-header">
          <div>
            <div class="section-title">👤 Usuarios del Sistema</div>
            <div class="section-sub">Gestión de acceso, cuentas y permisos</div>
          </div>
          <button class="btn btn-primary" @click="abrirNuevoUsuario">+ Nuevo Usuario</button>
        </div>

        <!-- Tarjetas de usuarios -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
          <div v-if="loadingUsers" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">⏳ Cargando usuarios...</div>
          <div v-else-if="!usuarios.length" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">
            <div style="font-size:36px;margin-bottom:8px">👤</div>No hay usuarios registrados
          </div>
          <div v-for="u in usuarios" :key="u.id" class="card"
               :style="!u.activo?'opacity:0.6;border-left:3px solid var(--red)':'border-left:3px solid var(--accent)'">
            <div class="card-body" style="padding:16px">
              <div style="display:flex;align-items:flex-start;gap:12px">
                <!-- Avatar -->
                <div style="width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;flex-shrink:0;color:#fff"
                     :style="'background:' + (u.app_perfiles?.es_admin ? 'linear-gradient(135deg,#f9a825,#e65100)' : 'linear-gradient(135deg,#1a73e8,#0d3a8a)')">
                  {{ (u.nombre||'?')[0].toUpperCase() }}{{ (u.apellido||'')[0]?.toUpperCase()||'' }}
                </div>
                <!-- Info -->
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                    {{ u.nombre }} {{ u.apellido }}
                    <span v-if="u.app_perfiles?.es_admin" style="font-size:11px;color:#f9a825;margin-left:4px">⭐ Admin</span>
                  </div>
                  <div style="font-size:12px;color:var(--muted);margin-top:2px">{{ u.email }}</div>
                  <div style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:rgba(26,115,232,0.12);color:var(--accent)">
                      {{ u.app_perfiles?.nombre || '—' }}
                    </span>
                    <span :style="'padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:'+(u.activo?'rgba(0,200,100,0.12)':'rgba(255,77,109,0.12)')+';color:'+(u.activo?'#00a870':'var(--red)')">
                      {{ u.activo ? '● Activo' : '● Inactivo' }}
                    </span>
                  </div>
                </div>
                <!-- Acciones -->
                <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
                  <button class="btn btn-sm btn-ghost" @click="abrirEditarUsuario(u)" title="Editar usuario" style="padding:4px 8px">✏️</button>
                  <button class="btn btn-sm btn-ghost" @click="toggleActivo(u)" :title="u.activo?'Desactivar':'Activar'" style="padding:4px 8px">
                    {{ u.activo ? '🔴' : '✅' }}
                  </button>
                  <button class="btn btn-sm btn-ghost" @click="resetPassword(u)" title="Restablecer contraseña" style="padding:4px 8px">🔑</button>
                </div>
              </div>
              <!-- Último login -->
              <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                <div style="font-size:11px;color:var(--muted)">
                  <span style="opacity:0.7">Último acceso:</span>
                  <span v-if="u.ultimo_login" style="margin-left:4px;font-weight:600;color:var(--text)">
                    {{ new Date(u.ultimo_login).toLocaleDateString('es-DO',{day:'2-digit',month:'short',year:'numeric'}) }}
                    · {{ new Date(u.ultimo_login).toLocaleTimeString('es-DO',{hour:'2-digit',minute:'2-digit'}) }}
                  </span>
                  <span v-else style="margin-left:4px;font-style:italic;opacity:0.5">Nunca</span>
                </div>
                <div style="font-size:10px;color:var(--muted);opacity:0.5">{{ u.id.slice(0,8) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- DRAWER: Crear / Editar Usuario -->
        <teleport to="body">
          <transition name="drawer-fade">
            <div v-if="showUserDrawer" style="position:fixed;inset:0;z-index:1100;display:flex">
              <!-- Overlay -->
              <div style="flex:1;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px)" @click="showUserDrawer=false"></div>
              <!-- Panel derecho -->
              <div style="width:420px;max-width:95vw;background:var(--bg-card);height:100%;display:flex;flex-direction:column;box-shadow:-6px 0 32px rgba(0,0,0,0.25);overflow:hidden">

                <!-- Header del drawer -->
                <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--accent);color:#fff">
                  <div>
                    <div style="font-weight:800;font-size:17px">
                      {{ editUserId ? '✏️ Editar Usuario' : '+ Crear Usuario' }}
                    </div>
                    <div style="font-size:12px;opacity:0.8;margin-top:2px">
                      {{ editUserId ? 'Modifica los datos del usuario' : 'Nuevo acceso al sistema' }}
                    </div>
                  </div>
                  <button @click="showUserDrawer=false" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">✕</button>
                </div>

                <!-- Tabs (solo en edición) -->
                <div v-if="editUserId" style="display:flex;border-bottom:2px solid var(--border)">
                  <button @click="userDrawerTab='datos'"
                    :style="userDrawerTab==='datos'?'border-bottom:2px solid var(--accent);color:var(--accent);margin-bottom:-2px':'color:var(--muted)'"
                    style="flex:1;padding:12px;background:none;border:none;cursor:pointer;font-weight:600;font-size:13px;transition:all 0.2s">
                    📋 Datos
                  </button>
                  <button @click="userDrawerTab='seguridad'"
                    :style="userDrawerTab==='seguridad'?'border-bottom:2px solid var(--accent);color:var(--accent);margin-bottom:-2px':'color:var(--muted)'"
                    style="flex:1;padding:12px;background:none;border:none;cursor:pointer;font-weight:600;font-size:13px;transition:all 0.2s">
                    🔐 Seguridad
                  </button>
                </div>

                <!-- Cuerpo scrollable -->
                <div style="flex:1;overflow-y:auto;padding:24px">

                  <!-- Tab Datos -->
                  <div v-if="userDrawerTab==='datos'">

                    <!-- Avatar preview -->
                    <div style="text-align:center;margin-bottom:20px">
                      <div style="width:64px;height:64px;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;color:#fff;background:linear-gradient(135deg,#1a73e8,#0d3a8a)">
                        {{ ((userFrm.nombre||'?')[0]+(userFrm.apellido||'')[0]||'').toUpperCase() || '?' }}
                      </div>
                      <div style="font-size:12px;color:var(--muted);margin-top:6px">Vista previa del avatar</div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                      <div class="form-group" style="margin:0">
                        <label class="form-label">Nombre *</label>
                        <input class="form-control" v-model="userFrm.nombre" placeholder="Juan"/>
                      </div>
                      <div class="form-group" style="margin:0">
                        <label class="form-label">Apellido</label>
                        <input class="form-control" v-model="userFrm.apellido" placeholder="Pérez"/>
                      </div>
                    </div>

                    <div class="form-group" v-if="!editUserId" style="margin-top:12px">
                      <label class="form-label">Email *</label>
                      <input class="form-control" type="email" v-model="userFrm.email" placeholder="usuario@empresa.com"/>
                    </div>
                    <div v-else style="margin-top:12px;padding:10px 12px;background:var(--bg-hover);border-radius:6px;font-size:12px;color:var(--muted)">
                      📧 <strong>{{ userFrm.email }}</strong> — el email no se puede cambiar
                    </div>

                    <div v-if="!editUserId" class="form-group" style="margin-top:12px">
                      <label class="form-label">Contraseña *</label>
                      <input class="form-control" type="password" v-model="userFrm.password" placeholder="Mínimo 6 caracteres"/>
                    </div>

                    <div class="form-group" style="margin-top:12px">
                      <label class="form-label">Perfil de acceso *</label>
                      <select class="form-control" v-model="userFrm.perfil_id">
                        <option value="">— Seleccionar perfil —</option>
                        <option v-for="p in perfiles" :key="p.id" :value="p.id">
                          {{ p.es_admin ? '⭐ ' : '🔐 ' }}{{ p.nombre }}
                        </option>
                      </select>
                    </div>

                    <div class="form-group" style="margin-top:12px">
                      <label class="form-label">Teléfono</label>
                      <input class="form-control" v-model="userFrm.telefono" placeholder="Opcional"/>
                    </div>

                    <div class="form-group" style="margin-top:12px">
                      <label class="form-label">Notas internas</label>
                      <textarea class="form-control" v-model="userFrm.notas" rows="2" placeholder="Observaciones sobre este usuario..."></textarea>
                    </div>

                    <div style="margin-top:16px;padding:12px;border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
                      <div>
                        <div style="font-weight:600;font-size:13px">Estado de la cuenta</div>
                        <div style="font-size:11px;color:var(--muted)">{{ userFrm.activo ? 'Puede iniciar sesión' : 'Sin acceso al sistema' }}</div>
                      </div>
                      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                        <input type="checkbox" v-model="userFrm.activo" style="width:18px;height:18px;cursor:pointer;accent-color:var(--accent)"/>
                        <span :style="'font-weight:700;font-size:12px;color:'+(userFrm.activo?'var(--green)':'var(--red)')">
                          {{ userFrm.activo ? 'Activo' : 'Inactivo' }}
                        </span>
                      </label>
                    </div>
                  </div>

                  <!-- Tab Seguridad (solo edición) -->
                  <div v-if="userDrawerTab==='seguridad' && editUserId">
                    <!-- Con service role key: cambio directo -->
                    <div v-if="config.serviceRoleKey" style="padding:16px;background:rgba(0,200,100,0.06);border-radius:8px;border:1px solid rgba(0,200,100,0.2);margin-bottom:16px">
                      <div style="font-weight:700;font-size:13px;margin-bottom:6px">🔐 Cambiar contraseña directamente</div>
                      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Ingresa la nueva contraseña para <strong>{{ userFrm.nombre }}</strong>. No se enviará ningún email.</div>
                      <input type="password" class="form-control" v-model="userFrm.password" placeholder="Nueva contraseña (mín. 6 caracteres)"/>
                      <button class="btn btn-primary" style="margin-top:10px;width:100%"
                        @click="resetPassword({ id: editUserId, email: userFrm.email, nombre: userFrm.nombre })">
                        🔐 Cambiar contraseña
                      </button>
                    </div>
                    <!-- Sin service role key: reset por email -->
                    <div v-else style="padding:16px;background:rgba(26,115,232,0.06);border-radius:8px;border:1px solid rgba(26,115,232,0.2);margin-bottom:16px">
                      <div style="font-weight:700;font-size:13px;margin-bottom:6px">📧 Restablecer por email</div>
                      <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px">
                        Para cambiar contraseñas directamente sin email, agrega la <strong>Service Role Key</strong> en Configuración del sistema.
                      </div>
                      <button class="btn btn-secondary" style="width:100%" @click="resetPassword({ id: editUserId, email: userFrm.email, nombre: userFrm.nombre })">
                        📧 Enviar enlace de restablecimiento
                      </button>
                    </div>
                    <div style="padding:10px 12px;background:var(--bg-hover);border-radius:6px;font-size:11px;color:var(--muted)">
                      ID Auth: <code style="font-size:10px">{{ editUserId }}</code>
                    </div>
                  </div>

                </div>

                <!-- Footer fijo -->
                <div style="padding:16px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;background:var(--bg-card)">
                  <button class="btn btn-secondary" @click="showUserDrawer=false">Cancelar</button>
                  <button class="btn btn-primary" @click="saveUsuario" :disabled="savingUser" style="min-width:120px">
                    <span v-if="savingUser">⏳ Guardando...</span>
                    <span v-else>💾 {{ editUserId ? 'Actualizar' : 'Crear usuario' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </transition>
        </teleport>
      </div>
      <!-- /USUARIOS -->

      <!-- ══ PERFILES Y PERMISOS ══ -->
      <div v-if="view==='perfiles'">
        <div class="section-header">
          <div>
            <div class="section-title">🔐 Perfiles y Permisos</div>
            <div class="section-sub">Define qué puede ver y hacer cada tipo de usuario en el sistema</div>
          </div>
          <button class="btn btn-primary" @click="abrirNuevoPerfil">+ Nuevo Perfil</button>
        </div>

        <!-- Tarjetas de perfiles -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:20px">
          <div v-for="p in perfiles" :key="p.id" class="card"
               :style="p.es_admin?'border-left:3px solid #f9a825':'border-left:3px solid var(--accent)'">
            <div class="card-body" style="padding:16px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <div style="font-weight:700;font-size:15px;display:flex;align-items:center;gap:6px">
                    <span :style="p.es_admin?'color:#f9a825':'color:var(--accent)'">{{ p.es_admin ? '⭐' : '🔐' }}</span>
                    {{ p.nombre }}
                  </div>
                  <div style="font-size:12px;color:var(--muted);margin-top:4px">{{ p.descripcion || 'Sin descripción' }}</div>
                  <div v-if="p.es_admin" style="margin-top:8px;font-size:11px;background:rgba(249,168,37,0.12);color:#e65100;padding:3px 8px;border-radius:6px;display:inline-block;font-weight:700">
                    Acceso total al sistema
                  </div>
                </div>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-sm btn-ghost" @click="abrirEditarPerfil(p)" title="Editar permisos">✏️</button>
                  <button class="btn btn-sm btn-ghost" @click="deletePerfil(p)" title="Eliminar" style="color:var(--red)">🗑️</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- DRAWER: Crear / Editar Perfil -->
        <teleport to="body">
          <transition name="drawer-fade">
            <div v-if="showPerfilDrawer" style="position:fixed;inset:0;z-index:1100;display:flex">
              <div style="flex:1;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px)" @click="showPerfilDrawer=false"></div>
              <!-- Panel — más ancho para tabla de permisos -->
              <div style="width:580px;max-width:96vw;background:var(--bg-card);height:100%;display:flex;flex-direction:column;box-shadow:-6px 0 32px rgba(0,0,0,0.25)">

                <!-- Header -->
                <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border);background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:space-between">
                  <div>
                    <div style="font-weight:800;font-size:17px">{{ editPerfilId ? '✏️ Editar Perfil' : '+ Crear Perfil' }}</div>
                    <div style="font-size:12px;opacity:0.8;margin-top:2px">Asigna nombre y permisos por módulo</div>
                  </div>
                  <button @click="showPerfilDrawer=false" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">✕</button>
                </div>

                <!-- Body scrollable -->
                <div style="flex:1;overflow-y:auto;padding:24px">

                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
                    <div class="form-group" style="margin:0">
                      <label class="form-label">Nombre del perfil *</label>
                      <input class="form-control" v-model="perfilFrm.nombre" placeholder="Ej: Supervisor, Operador..."/>
                    </div>
                    <div class="form-group" style="margin:0">
                      <label class="form-label">Descripción</label>
                      <input class="form-control" v-model="perfilFrm.descripcion" placeholder="Descripción breve"/>
                    </div>
                  </div>

                  <div style="padding:12px;border-radius:8px;border:1px solid rgba(249,168,37,0.3);background:rgba(249,168,37,0.06);margin-bottom:20px;display:flex;align-items:center;gap:12px">
                    <input type="checkbox" v-model="perfilFrm.es_admin" style="width:18px;height:18px;cursor:pointer;accent-color:#f9a825"/>
                    <div>
                      <div style="font-weight:700;font-size:13px;color:#e65100">⭐ Administrador — Acceso total</div>
                      <div style="font-size:11px;color:var(--muted)">Si activas esto, el usuario ignora la tabla de permisos abajo</div>
                    </div>
                  </div>

                  <!-- Tabla de permisos -->
                  <div v-if="!perfilFrm.es_admin">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                      <div style="font-weight:700;font-size:13px">🔒 Permisos por módulo</div>
                      <div style="display:flex;gap:6px">
                        <button class="btn btn-sm btn-ghost" style="font-size:11px;padding:3px 8px" @click="selectAllPermisos(true)">✅ Todos</button>
                        <button class="btn btn-sm btn-ghost" style="font-size:11px;padding:3px 8px" @click="selectAllPermisos(false)">🚫 Limpiar</button>
                      </div>
                    </div>

                    <!-- Encabezado columnas -->
                    <div style="display:grid;grid-template-columns:1fr 52px 52px 62px;gap:4px;padding:6px 10px;background:var(--bg-hover);border-radius:6px;margin-bottom:8px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">
                      <div>Módulo</div>
                      <div style="text-align:center">Ver</div>
                      <div style="text-align:center">Editar</div>
                      <div style="text-align:center">Eliminar</div>
                    </div>

                    <template v-for="grupo in ['Principal','Operaciones','Análisis','Configuración','Administración']" :key="grupo">
                      <div style="margin:12px 0 4px;display:flex;align-items:center;gap:8px">
                        <div style="font-size:10px;font-weight:800;letter-spacing:1.2px;color:var(--accent);text-transform:uppercase">{{ grupo }}</div>
                        <div style="flex:1;height:1px;background:var(--border)"></div>
                        <button class="btn btn-sm btn-ghost" style="font-size:9px;padding:2px 6px" @click="toggleGrupo(grupo,'puede_ver',true)">Todo ver</button>
                        <button class="btn btn-sm btn-ghost" style="font-size:9px;padding:2px 6px" @click="toggleGrupo(grupo,'puede_ver',false)">Limpiar</button>
                      </div>

                      <div v-for="item in VISTAS_SISTEMA.filter(v=>v.grupo===grupo)" :key="item.vista"
                           style="display:grid;grid-template-columns:1fr 52px 52px 62px;gap:4px;align-items:center;padding:7px 10px;border-radius:5px;margin-bottom:2px;transition:background 0.15s"
                           :style="perfilPermisos[item.vista]?.puede_ver?'background:rgba(26,115,232,0.05);border:1px solid rgba(26,115,232,0.12)':'border:1px solid transparent'">
                        <div style="display:flex;align-items:center;gap:7px">
                          <span>{{ item.icono }}</span>
                          <span style="font-size:12px;font-weight:500">{{ item.nombre }}</span>
                        </div>
                        <div style="text-align:center">
                          <input type="checkbox" style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent)"
                                 :checked="perfilPermisos[item.vista]?.puede_ver"
                                 @change="togglePermiso(item.vista,'puede_ver')"/>
                        </div>
                        <div style="text-align:center">
                          <input type="checkbox" style="width:15px;height:15px;accent-color:var(--accent)"
                                 :checked="perfilPermisos[item.vista]?.puede_editar"
                                 :disabled="!perfilPermisos[item.vista]?.puede_ver"
                                 :style="!perfilPermisos[item.vista]?.puede_ver?'opacity:0.3;cursor:not-allowed':'cursor:pointer'"
                                 @change="togglePermiso(item.vista,'puede_editar')"/>
                        </div>
                        <div style="text-align:center">
                          <input type="checkbox" style="width:15px;height:15px;accent-color:var(--red)"
                                 :checked="perfilPermisos[item.vista]?.puede_eliminar"
                                 :disabled="!perfilPermisos[item.vista]?.puede_ver"
                                 :style="!perfilPermisos[item.vista]?.puede_ver?'opacity:0.3;cursor:not-allowed':'cursor:pointer'"
                                 @change="togglePermiso(item.vista,'puede_eliminar')"/>
                        </div>
                      </div>
                    


</template>
                  </div>

                  <div v-else style="padding:20px;text-align:center;color:var(--muted);font-size:13px;background:rgba(249,168,37,0.05);border-radius:8px;border:1px dashed rgba(249,168,37,0.3)">
                    ⭐ Perfil administrador — tiene acceso a todos los módulos sin restricciones
                  </div>

                </div>

                <!-- Footer -->
                <div style="padding:16px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;background:var(--bg-card)">
                  <button class="btn btn-secondary" @click="showPerfilDrawer=false">Cancelar</button>
                  <button class="btn btn-primary" @click="savePerfil" :disabled="savingPerfil" style="min-width:130px">
                    <span v-if="savingPerfil">⏳ Guardando...</span>
                    <span v-else>💾 {{ editPerfilId ? 'Actualizar perfil' : 'Crear perfil' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </transition>
        </teleport>
      </div>
      <!-- /PERFILES -->


      <!-- ══ CONFIGURACIÓN ══ -->
      <div v-if="view==='config'">
        <div class="section-header">
          <div><div class="section-title">Configuración</div></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">🔗 Conexión Supabase</div></div>
          <div class="card-body">
            <div class="alert alert-info" style="margin-bottom:16px">
              ℹ️ Obtén tus claves en <strong>supabase.com</strong> → Tu proyecto → Settings → API
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Supabase URL</label>
                <input type="text" class="form-control" v-model="config.supabaseUrl" placeholder="https://xxxx.supabase.co"/>
              </div>
              <div class="form-group">
                <label class="form-label">API Key — anon public</label>
                <input type="text" class="form-control" v-model="config.supabaseKey" placeholder="eyJ..."/>
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label class="form-label" style="display:flex;align-items:center;gap:8px">
                  🔑 Service Role Key
                  <span style="font-size:10px;background:rgba(249,168,37,0.15);color:#e65100;padding:2px 7px;border-radius:6px;font-weight:700">RECOMENDADO</span>
                </label>
                <input type="password" class="form-control" v-model="config.serviceRoleKey" placeholder="eyJ... (secret — no compartir)"/>
                <div style="font-size:11px;color:var(--muted);margin-top:4px">
                  Con esta clave puedes crear usuarios y cambiar contraseñas directamente sin depender de los settings de Supabase.
                  Encuéntrala en Supabase → Settings → API → <strong>service_role secret</strong>. Solo se guarda en tu navegador (localStorage).
                </div>
              </div>
              <button class="btn btn-primary" @click="saveConfig" style="width:fit-content">
                💾 Guardar y Conectar
              </button>
            </div>
            <div class="divider"></div>
            <div v-if="supabaseConfigured" class="alert alert-success" style="display:flex;align-items:center;justify-content:space-between">
              <span>✅ Conectado a Supabase — {{ config.supabaseUrl }}</span>
              <span v-if="config.serviceRoleKey" style="font-size:11px;background:rgba(0,200,100,0.12);color:#00a870;padding:3px 8px;border-radius:6px;font-weight:700">🔑 Admin API activa</span>
              <span v-else style="font-size:11px;background:rgba(255,165,0,0.12);color:#e65100;padding:3px 8px;border-radius:6px;font-weight:700">⚠️ Sin Service Role Key</span>
            </div>
          </div>
        </div>
      </div>

    </div><!-- /content -->
    </main>

      <!-- ══ MODALS ══ -->

  <!-- GASTO MODAL -->
  <div class="overlay" v-if="showGastoModal" @click.self="showGastoModal=false">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">{{ gastoEditId ? "✏️ Editar Gasto" : "💸 Registrar Gasto" }}</div>
        <button class="close-btn" @click="showGastoModal=false">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Período</label>
              <select class="form-control" v-model="gastoFrm.periodo_id">
                <option value="">— Período —</option>
                <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Fecha</label>
              <input type="date" class="form-control" v-model="gastoFrm.fecha"/>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Grupo</label>
              <select class="form-control" v-model="gastoFrm.grupo_id" @change="gastoFrm.banca_id=''">
                <option value="">— Grupo (opcional) —</option>
                <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">
                Banca
                <span v-if="gastoFrm.tipo==='operativo'" style="color:var(--blue);font-size:9px;margin-left:4px">
                  ★ asigna al cuadre
                </span>
              </label>
              <select class="form-control"
                :style="gastoFrm.tipo==='operativo' && !gastoFrm.banca_id ? 'border-color:rgba(76,201,240,0.6)' : ''"
                v-model="gastoFrm.banca_id">
                <option value="">{{ gastoFrm.tipo==='operativo' ? '— Sin banca (va a total del grupo) —' : '— Banca (opcional) —' }}</option>
                <option v-for="b in (gastoFrm.grupo_id ? bancas.filter(b=>b.grupo_id===gastoFrm.grupo_id) : bancas)"
                        :key="b.id" :value="b.id">{{ b.codigo }} — {{ b.nombre }}</option>
              </select>
            </div>
          </div>
          <!-- Tip contextual según tipo -->
          <div v-if="gastoFrm.tipo==='operativo'" class="alert alert-info" style="font-size:11px;padding:8px 12px">
            💡 <strong>Operativo</strong> — Este gasto <strong>aparecerá en el cuadre</strong> del supervisor y se descontará del resultado.
            <span v-if="!gastoFrm.banca_id"> Sin banca: se descuenta del total del grupo.</span>
            <span v-else> Se asignará a la banca seleccionada.</span>
          </div>
          <div v-else-if="gastoFrm.tipo==='central'" class="alert" style="font-size:11px;padding:8px 12px;background:rgba(255,209,102,0.08);border:1px solid rgba(255,209,102,0.25);color:var(--yellow)">
            🏢 <strong>Central</strong> — Gasto de administración central. <strong>No aparece en cuadres de supervisores.</strong>
          </div>
          <div class="form-row">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Categoría de Gasto</label>
              <select class="form-control" v-model="gastoFrm.categoria_id">
                <option value="">— Seleccionar categoría —</option>
                <option v-for="c in categorias.filter(c=>c.tipo==='egreso'&&c.activo)" :key="c.id" :value="c.id">
                  {{ c.nombre }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de Gasto</label>
              <select class="form-control" v-model="gastoFrm.tipo">
                <option value="operativo">Operativo</option>
                <option value="central">Central</option>
                <option value="sistema">Sistema</option>
                <option value="equipo">Equipo</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Monto</label>
              <input type="number" class="form-control" v-model.number="gastoFrm.monto" placeholder="0"/>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Concepto / Descripción</label>
            <input type="text" class="form-control" v-model="gastoFrm.concepto" placeholder="Ej: Pago internet banca 3005"/>
          </div>
        </div>
      </div>
      <!-- Propagación cruzada -->
      <div style="padding:0 24px 16px;border-top:1px solid var(--border)">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:10px;margin-top:12px;text-transform:uppercase;letter-spacing:0.5px">
          🔗 {{ gastoEditId ? 'Sincronizar registros vinculados' : 'Registrar también en:' }}
        </div>

        <!-- CREAR: checkboxes para propagar -->
        <div v-if="!gastoEditId" style="display:flex;flex-direction:column;gap:10px">
          <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 12px;border-radius:8px;border:1px solid var(--border);" :style="gastoPropagarBanco?'border-color:rgba(26,115,232,0.4);background:rgba(26,115,232,0.05)':''">
            <input type="checkbox" v-model="gastoPropagarBanco" style="margin-top:2px;width:16px;height:16px;accent-color:var(--accent);flex-shrink:0"/>
            <div>
              <div style="font-weight:600;font-size:13px">🏦 Cuenta Bancaria</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Se registra como egreso en Banco. Copia grupo, período, categoría.</div>
            </div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 12px;border-radius:8px;border:1px solid var(--border);" :style="gastoPropagarFlujo?'border-color:rgba(26,115,232,0.4);background:rgba(26,115,232,0.05)':''">
            <input type="checkbox" v-model="gastoPropagarFlujo" style="margin-top:2px;width:16px;height:16px;accent-color:var(--accent);flex-shrink:0"/>
            <div>
              <div style="font-weight:600;font-size:13px">💸 Flujo de Efectivo</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Se registra como egreso en Flujo. Copia grupo, período, categoría.</div>
            </div>
          </label>
        </div>

        <!-- EDITAR: sincronizar cambios a registros vinculados existentes -->
        <div v-else style="display:flex;flex-direction:column;gap:10px">
          <label v-if="gastoTieneRefBanco" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 12px;border-radius:8px;border:1px solid var(--border);" :style="gastoSincBanco?'border-color:rgba(26,115,232,0.4);background:rgba(26,115,232,0.05)':''">
            <input type="checkbox" v-model="gastoSincBanco" style="margin-top:2px;width:16px;height:16px;accent-color:var(--accent);flex-shrink:0"/>
            <div>
              <div style="font-weight:600;font-size:13px">🏦 Actualizar registro en Banco</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Sincroniza monto, concepto, fecha y categoría al registro vinculado en Banco.</div>
            </div>
          </label>
          <label v-if="gastoTieneRefFlujo" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 12px;border-radius:8px;border:1px solid var(--border);" :style="gastoSincFlujo?'border-color:rgba(26,115,232,0.4);background:rgba(26,115,232,0.05)':''">
            <input type="checkbox" v-model="gastoSincFlujo" style="margin-top:2px;width:16px;height:16px;accent-color:var(--accent);flex-shrink:0"/>
            <div>
              <div style="font-weight:600;font-size:13px">💸 Actualizar registro en Flujo</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Sincroniza monto, concepto, fecha, grupo, período y categoría al registro vinculado en Flujo.</div>
            </div>
          </label>
          <div v-if="!gastoTieneRefBanco && !gastoTieneRefFlujo" style="font-size:12px;color:var(--text-muted);padding:8px 12px;background:var(--bg-hover);border-radius:8px">
            Este gasto no tiene registros vinculados en Banco ni en Flujo.
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" @click="showGastoModal=false">Cancelar</button>
        <button class="btn btn-primary" @click="saveGasto" :disabled="!gastoFrm.concepto||!gastoFrm.monto">
          💾 Guardar Gasto
        </button>
      </div>
    </div>
  </div>
  </div>


  <!-- GRUPO MODAL -->

  <!-- BANCA MODAL -->

  <!-- PERÍODO MODAL -->

  <!-- REPORTE IMPRIMIBLE -->

  <div class="toast-container">
    <div v-for="t in toasts" :key="t.id" :class="['toast', 'toast-' + t.type]">
      {{ t.msg }}
    </div>
  </div>

  </div>

      <!-- ═══════════════════════════════════════════════
           CAJA CENTRAL
      ════════════════════════════════════════════════ -->
      <div v-if="view==='caja_central'">
        <div class="section-header">
          <div>
            <div class="section-title">🏧 Caja Central</div>
            <div class="section-sub">Fondo físico en oficina — rastro de cada peso entre supervisores, oficina y banco</div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <button class="btn btn-primary" @click="abrirNuevoCaja()">+ Nuevo Movimiento</button>
          </div>
        </div>

        <!-- KPIs caja -->
        <div class="kpis-row" style="margin-bottom:16px">
          <div class="metric-card green">
            <div class="metric-label">💰 Saldo en Caja</div>
            <div class="metric-value pos">{{ fmt2(cajaStats.saldo) }}</div>
            <div class="metric-sub">Efectivo disponible en oficina</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">📥 Total Entradas</div>
            <div class="metric-value pos">{{ fmt2(cajaStats.entradas) }}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">📤 Total Salidas</div>
            <div class="metric-value neg">{{ fmt2(cajaStats.salidas) }}</div>
          </div>
        </div>

        <!-- Acciones rápidas -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-header"><div class="card-title">⚡ Registrar rápido</div></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;padding:16px">
            <button class="btn btn-ghost" @click="abrirNuevoCaja('entrega_supervisor')">👤 Entrega de Supervisor</button>
            <button class="btn btn-ghost" @click="abrirNuevoCaja('deposito_banco')">🏦 Llevar al Banco</button>
            <button class="btn btn-ghost" @click="abrirNuevoCaja('retiro_banco')">🏦 Traer del Banco</button>
            <button class="btn btn-ghost" @click="abrirNuevoCaja('pago_premio')">🎯 Pagar Premio Efectivo</button>
            <button class="btn btn-ghost" @click="abrirNuevoCaja('gasto_efectivo')">🧾 Gasto en Efectivo</button>
            <button class="btn btn-ghost" @click="abrirNuevoCaja('ajuste')">⚖️ Ajuste</button>
          </div>
        </div>

        <!-- Filtros -->
        <div class="filter-row" style="margin-bottom:16px">
          <input type="date" class="form-control" style="width:140px" v-model="cajaFiltro.desde" @change="loadCaja" placeholder="Desde"/>
          <input type="date" class="form-control" style="width:140px" v-model="cajaFiltro.hasta" @change="loadCaja" placeholder="Hasta"/>
          <select class="form-control" style="width:200px" v-model="cajaFiltro.origen" @change="loadCaja">
            <option value="">Todos los orígenes</option>
            <option v-for="o in ORIGENES" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <select class="form-control" style="width:180px" v-model="cajaFiltro.periodo_id" @change="loadCaja">
            <option value="">Todos los períodos</option>
            <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
          </select>
          <button class="btn btn-ghost" @click="cajaFiltro={desde:'',hasta:'',origen:'',periodo_id:''};loadCaja()">✕ Limpiar</button>
        </div>

        <!-- Tabla movimientos caja -->
        <div class="card">
          <div v-if="loadingCaja" style="text-align:center;padding:40px;color:var(--muted)">Cargando...</div>
          <div v-else-if="!cajaMovs.length" class="empty">
            <div class="empty-icon">🏧</div>
            <p>No hay movimientos de caja. Registra la primera entrega de un supervisor.</p>
          </div>
          <table v-else>
            <thead>
              <tr>
                <th>Fecha</th><th>Tipo</th><th>Origen</th><th>Concepto</th>
                <th>Grupo</th><th>Período</th>
                <th style="text-align:right">Entrada</th>
                <th style="text-align:right">Salida</th>
                <th style="text-align:right">Saldo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in cajaMovs" :key="m.id" :style="m.tipo==='entrada'?'':'background:rgba(255,77,109,0.04)'">
                <td style="white-space:nowrap">{{ m.fecha }}</td>
                <td>
                  <span class="tag" :style="m.tipo==='entrada'?'background:rgba(0,229,160,0.15);color:var(--green)':'background:rgba(255,77,109,0.15);color:var(--red)'">
                    {{ m.tipo === 'entrada' ? '📥 Entrada' : '📤 Salida' }}
                  </span>
                </td>
                <td style="font-size:12px">{{ origenLabel(m.origen) }}</td>
                <td>
                  {{ m.concepto }}
                  <span v-if="m.ref_banco_id" title="Movimiento generado en Banco" style="font-size:11px;cursor:help">🏦</span>
                  <span v-if="m.ref_flujo_id" title="Movimiento generado en Flujo" style="font-size:11px;cursor:help">💸</span>
                </td>
                <td style="font-size:12px">{{ m.grupos?.nombre || '—' }}</td>
                <td style="font-size:11px;color:var(--muted)">
                  {{ m.periodos?.descripcion || (m.periodos?.fecha_inicio ? m.periodos.fecha_inicio : '—') }}
                </td>
                <td style="text-align:right;color:var(--green);font-weight:600">
                  {{ m.tipo==='entrada' ? fmt2(m.monto) : '' }}
                </td>
                <td style="text-align:right;color:var(--red);font-weight:600">
                  {{ m.tipo==='salida' ? fmt2(m.monto) : '' }}
                </td>
                <td style="text-align:right;font-weight:700" :style="(m.saldo_acumulado||0)>=0?'color:var(--green)':'color:var(--red)'">
                  {{ fmt2(m.saldo_acumulado||0) }}
                </td>
                <td>
                  <button class="btn-icon" @click="editarCaja(m)" title="Editar">✏️</button>
                  <button class="btn-icon danger" @click="deleteCaja(m.id)" title="Eliminar">🗑</button>
                </td>
              </tr>
            </tbody>
            <tfoot v-if="cajaMovs.length">
              <tr style="font-weight:700;border-top:2px solid var(--border)">
                <td colspan="6">SALDO ACTUAL EN CAJA</td>
                <td style="text-align:right;color:var(--green)">{{ fmt2(cajaStats.entradas) }}</td>
                <td style="text-align:right;color:var(--red)">{{ fmt2(cajaStats.salidas) }}</td>
                <td style="text-align:right" :style="cajaStats.saldo>=0?'color:var(--green)':'color:var(--red)'">{{ fmt2(cajaStats.saldo) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- MODAL nuevo movimiento caja -->
        <div v-if="showCajaModal" class="modal-overlay" @click.self="showCajaModal=false">
          <div class="modal" style="max-width:500px">
            <div class="modal-header">
              <div class="modal-title">{{ cajaEditId ? '✏️ Editar Movimiento' : '+ Nuevo Movimiento de Caja' }}</div>
              <button class="modal-close" @click="showCajaModal=false">✕</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">

              <!-- Origen -->
              <div>
                <label class="form-label">Tipo de movimiento</label>
                <select class="form-control" v-model="cajaFrm.origen" @change="onOrigenChange">
                  <option v-for="o in ORIGENES" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
                <!-- Info contextual -->
                <div v-if="cajaFrm.origen==='deposito_banco'" style="margin-top:6px;padding:8px 12px;background:rgba(26,115,232,0.08);border-radius:8px;font-size:12px;color:var(--accent)">
                  🏦 Se registra el ingreso en <strong>Cuenta Banco</strong>. El Flujo de Efectivo NO se toca — ese ingreso ya existía desde el cuadre del supervisor.
                </div>
                <div v-if="cajaFrm.origen==='retiro_banco'" style="margin-top:6px;padding:8px 12px;background:rgba(255,165,0,0.08);border-radius:8px;font-size:12px;color:var(--yellow)">
                  🏦 Se registra el egreso en <strong>Cuenta Banco</strong>. Es una reubicación de dinero — no afecta el Flujo de Efectivo.
                </div>
                <div v-if="cajaFrm.origen==='pago_premio'" style="margin-top:6px;padding:8px 12px;background:rgba(255,165,0,0.08);border-radius:8px;font-size:12px;color:var(--yellow)">
                  🎯 Se registra un egreso en <strong>Flujo de Efectivo</strong> — dinero que salió del negocio.
                </div>
                <div v-if="cajaFrm.origen==='gasto_efectivo'" style="margin-top:6px;padding:8px 12px;background:rgba(255,77,109,0.08);border-radius:8px;font-size:12px;color:var(--red)">
                  🧾 Se registra en <strong>Gastos</strong> y en <strong>Flujo de Efectivo</strong> — dinero que salió del negocio.
                </div>
                <div v-if="cajaFrm.origen==='entrega_supervisor'" style="margin-top:6px;padding:8px 12px;background:rgba(0,229,160,0.08);border-radius:8px;font-size:12px;color:var(--green)">
                  👤 Solo se registra en Caja Central. El ingreso al negocio ya existe desde el cuadre semanal.
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                  <label class="form-label">Fecha</label>
                  <input type="date" class="form-control" v-model="cajaFrm.fecha"/>
                </div>
                <div>
                  <label class="form-label">Monto (RD$)</label>
                  <input type="number" class="form-control" v-model="cajaFrm.monto" min="0" step="0.01"/>
                </div>
              </div>

              <div>
                <label class="form-label">Concepto *</label>
                <input type="text" class="form-control" v-model="cajaFrm.concepto" placeholder="Ej: Entrega supervisor Grupo Norte — Semana 12"/>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                  <label class="form-label">Grupo (opcional)</label>
                  <select class="form-control" v-model="cajaFrm.grupo_id">
                    <option value="">— Sin grupo —</option>
                    <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
                  </select>
                </div>
                <div>
                  <label class="form-label">Período (opcional)</label>
                  <select class="form-control" v-model="cajaFrm.periodo_id">
                    <option value="">— Sin período —</option>
                    <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.descripcion || p.fecha_inicio }}</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="form-label">Notas (opcional)</label>
                <textarea class="form-control" v-model="cajaFrm.notas" rows="2" placeholder="Observaciones..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showCajaModal=false">Cancelar</button>
              <button class="btn btn-primary" @click="saveCaja" :disabled="!cajaFrm.monto||!cajaFrm.concepto">
                {{ cajaEditId ? 'Actualizar' : 'Registrar Movimiento' }}
              </button>
            </div>
          </div>
        </div>

      </div><!-- /caja_central -->


      <!-- ═══════════════════════════════════════════════
           CIERRE DE PERÍODOS
      ════════════════════════════════════════════════ -->
      <div v-if="view==='cierre_periodo'">
        <div class="section-header">
          <div>
            <div class="section-title">🔒 Cierre de Períodos y Cuadre Mensual</div>
            <div class="section-sub">Verifica, cuadra y cierra cada período. Concilia el saldo banco al final.</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

          <!-- PANEL IZQUIERDO: Cierre por período -->
          <div>
            <div class="card">
              <div class="card-header"><div class="card-title">🔒 Cerrar un Período</div></div>
              <div style="padding:16px;display:flex;flex-direction:column;gap:16px">
                <div>
                  <label class="form-label">Seleccionar período a cerrar</label>
                  <select class="form-control" v-model="cierrePeriodoId">
                    <option value="">— Seleccionar —</option>
                    <option v-for="p in periodos" :key="p.id" :value="p.id"
                      :style="p.estado==='cerrado'?'color:var(--muted)':''">
                      {{ p.descripcion || p.fecha_inicio }}
                      {{ p.estado === 'cerrado' ? ' ✅ Cerrado' : '' }}
                    </option>
                  </select>
                </div>
                <button class="btn btn-primary" :disabled="!cierrePeriodoId||loadingCierre" @click="prepararCierre(cierrePeriodoId)">
                  {{ loadingCierre ? 'Calculando...' : '🔍 Preparar Cierre' }}
                </button>
              </div>
            </div>

            <!-- Lista de períodos con estado -->
            <div class="card" style="margin-top:16px">
              <div class="card-header"><div class="card-title">📋 Estado de Períodos</div></div>
              <div v-if="!periodos.length" class="empty"><p>No hay períodos registrados.</p></div>
              <div v-else>
                <div v-for="p in periodos" :key="p.id" style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border)">
                  <div>
                    <div style="font-weight:600;font-size:13px">{{ p.descripcion || p.fecha_inicio }}</div>
                    <div style="font-size:11px;color:var(--muted)">{{ p.fecha_inicio }} → {{ p.fecha_fin }}</div>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span v-if="p.estado==='cerrado'" class="tag" style="background:rgba(0,229,160,0.15);color:var(--green)">✅ Cerrado</span>
                    <span v-else class="tag" style="background:rgba(255,165,0,0.15);color:var(--yellow)">⏳ Abierto</span>
                    <button v-if="p.estado!=='cerrado'" class="btn-icon" title="Preparar cierre" @click="cierrePeriodoId=p.id;prepararCierre(p.id)">🔒</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PANEL DERECHO: Cierre mensual -->
          <div>
            <div class="card">
              <div class="card-header"><div class="card-title">📅 Cuadre Mensual</div></div>
              <div style="padding:16px;display:flex;flex-direction:column;gap:16px">
                <div>
                  <label class="form-label">Seleccionar mes</label>
                  <input type="month" class="form-control" v-model="cierreMesSel" @change="cargarCierreMes"/>
                </div>
                <div v-if="cierreMesLoading" style="text-align:center;color:var(--muted);padding:20px">Calculando...</div>
                <div v-else-if="cierreMesData">
                  <!-- Resumen del mes -->
                  <div style="display:flex;flex-direction:column;gap:8px">
                    <div style="background:var(--bg-hover);border-radius:10px;padding:12px">
                      <div style="font-size:12px;color:var(--muted);margin-bottom:8px">PERÍODOS DEL MES</div>
                      <div v-for="p in cierreMesData.periodos" :key="p.id" style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;border-bottom:1px solid var(--border)">
                        <span>{{ p.descripcion || p.fecha_inicio }}</span>
                        <span v-if="cierreMesData.cierres.find(c=>c.periodo_id===p.id)" style="color:var(--green)">✅</span>
                        <span v-else style="color:var(--yellow)">⏳ Pendiente</span>
                      </div>
                      <div style="margin-top:8px;font-size:12px;color:var(--muted)">
                        {{ cierreMesData.cerradosCount }} / {{ cierreMesData.periodosCount }} períodos cerrados
                      </div>
                    </div>

                    <div class="kv-row"><span>📦 Ventas totales</span><span class="pos">{{ fmt(cierreMesData.totalVentas) }}</span></div>
                    <div class="kv-row"><span>🎯 Premios</span><span class="neg">{{ fmt(cierreMesData.totalPremios) }}</span></div>
                    <div class="kv-row"><span>🏪 Comisiones</span><span class="neg">{{ fmt(cierreMesData.totalComisiones) }}</span></div>
                    <div class="kv-row"><span>💸 Gastos</span><span class="neg">{{ fmt(cierreMesData.totalGastos) }}</span></div>
                    <div class="kv-row"><span>📈 Participaciones</span><span class="neg">{{ fmt(cierreMesData.totalPart) }}</span></div>
                    <div class="kv-row kv-total">
                      <span>= Resultado Neto del Mes</span>
                      <span :class="cierreMesData.resultadoNeto>=0?'pos':'neg'">{{ fmt(cierreMesData.resultadoNeto) }}</span>
                    </div>
                    <hr style="border-color:var(--border);margin:4px 0"/>
                    <div class="kv-row"><span>💰 Total depositado al banco</span><span class="pos">{{ fmt(cierreMesData.totalDepositado) }}</span></div>
                    <div class="kv-row kv-total">
                      <span>🏦 Saldo banco fin de mes (calc.)</span>
                      <span class="pos">{{ fmt(cierreMesData.saldoBancoFin) }}</span>
                    </div>
                    <div v-if="!cierreMesData.listo" style="padding:10px;background:rgba(255,165,0,0.1);border-radius:8px;font-size:12px;color:var(--yellow)">
                      ⚠️ Hay períodos sin cerrar. Cierra todos los períodos del mes antes de cuadrar el mes.
                    </div>
                    <div v-else style="padding:10px;background:rgba(0,229,160,0.1);border-radius:8px;font-size:12px;color:var(--green)">
                      ✅ Todos los períodos del mes están cerrados. El mes está cuadrado.
                    </div>
                  </div>
                </div>
                <div v-else style="text-align:center;color:var(--muted);font-size:13px;padding:20px 0">
                  Selecciona un mes para ver el resumen
                </div>
              </div>
            </div>

            <!-- Instrucciones del proceso -->
            <div class="card" style="margin-top:16px">
              <div class="card-header"><div class="card-title">📋 Proceso de Cierre Recomendado</div></div>
              <div style="padding:16px;font-size:13px;line-height:1.8;color:var(--text-muted)">
                <div style="margin-bottom:12px"><strong style="color:var(--text)">① Registrar entregas en Caja Central</strong><br>
                Cada vez que un supervisor entregue, ir a Caja Central y registrar "Entrega de supervisor" con el grupo y período correspondiente.</div>
                <div style="margin-bottom:12px"><strong style="color:var(--text)">② Registrar depósito al banco</strong><br>
                Cuando lleves dinero al banco, usar "Llevar al Banco" en Caja Central — se crea automáticamente el ingreso en Cuenta Banco.</div>
                <div style="margin-bottom:12px"><strong style="color:var(--text)">③ Cuadre de período (semanal)</strong><br>
                En "Cuadre Semanal", cerrar cada grupo del período. Al finalizar, usar el botón 🔒 aquí para preparar el cierre.</div>
                <div style="margin-bottom:12px"><strong style="color:var(--text)">④ Confirmar saldo real del banco</strong><br>
                Al cerrar el período, el sistema te pedirá el saldo real del banco. Si hay diferencia, se registra automáticamente como ajuste.</div>
                <div><strong style="color:var(--text)">⑤ Cierre mensual</strong><br>
                Con todos los períodos del mes cerrados, el resumen mensual aparece aquí para una vista completa del mes.</div>
              </div>
            </div>
          </div>
        </div>

        <!-- MODAL CIERRE DE PERÍODO -->
        <div v-if="showCierreModal && cierrePeriodo" class="modal-overlay" @click.self="showCierreModal=false">
          <div class="modal" style="max-width:600px">
            <div class="modal-header">
              <div class="modal-title">🔒 Cierre de Período — {{ cierrePeriodo.periodo?.descripcion || cierrePeriodo.periodo?.fecha_inicio }}</div>
              <button class="modal-close" @click="showCierreModal=false">✕</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">

              <!-- Alerta si hay grupos sin cuadrar -->
              <div v-if="cierrePeriodo.gruposSinCuadre.length" style="padding:12px 16px;background:rgba(255,77,109,0.1);border-radius:10px;border:1px solid rgba(255,77,109,0.3)">
                <div style="font-weight:700;color:var(--red);margin-bottom:6px">⚠️ Grupos sin cuadrar ({{ cierrePeriodo.gruposSinCuadre.length }})</div>
                <div v-for="g in cierrePeriodo.gruposSinCuadre" :key="g.id" style="font-size:13px;color:var(--red)">• {{ g.nombre }}</div>
                <div style="font-size:12px;color:var(--muted);margin-top:8px">Puedes cerrar de todas formas, pero lo recomendado es cuadrar todos los grupos primero.</div>
              </div>

              <!-- Resumen del período -->
              <div style="background:var(--bg-hover);border-radius:10px;padding:14px">
                <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px;text-transform:uppercase">RESUMEN OPERACIONAL</div>
                <div class="kv-row"><span>📦 Ventas</span><span class="pos">{{ fmt(cierrePeriodo.totalVentas) }}</span></div>
                <div class="kv-row"><span>🎯 Premios</span><span class="neg">{{ fmt(cierrePeriodo.totalPremios) }}</span></div>
                <div class="kv-row"><span>🏪 Comisiones</span><span class="neg">{{ fmt(cierrePeriodo.totalComisiones) }}</span></div>
                <div class="kv-row"><span>💸 Gastos del período</span><span class="neg">{{ fmt(cierrePeriodo.totalGastos) }}</span></div>
                <div class="kv-row"><span>📈 Participaciones</span><span class="neg">{{ fmt(cierrePeriodo.totalPart) }}</span></div>
                <div class="kv-row kv-total"><span>= Resultado neto</span><span :class="cierrePeriodo.resultadoNeto>=0?'pos':'neg'">{{ fmt(cierrePeriodo.resultadoNeto) }}</span></div>
              </div>

              <!-- Efectivo -->
              <div style="background:var(--bg-hover);border-radius:10px;padding:14px">
                <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px;text-transform:uppercase">MOVIMIENTO DE EFECTIVO</div>
                <div class="kv-row"><span>💰 Total depositado (cuadres)</span><span class="pos">{{ fmt(cierrePeriodo.totalDepositado) }}</span></div>
                <div class="kv-row">
                  <span>🏧 Efectivo en caja (oficina)</span>
                  <span :class="cierrePeriodo.saldoCaja>=0?'pos':'neg'">{{ fmt(cierrePeriodo.saldoCaja) }}</span>
                </div>
                <div style="font-size:11px;color:var(--muted);padding:2px 0 4px 0">
                  Efectivo físico en la oficina — ya es del negocio, pendiente de depositar al banco.
                </div>
                <div class="kv-row"><span>📤 Balance pendiente supervisores</span><span :class="cierrePeriodo.totalBalance<=0?'pos':'neg'">{{ fmt(cierrePeriodo.totalBalance) }}</span></div>
                <!-- Detalle de pendientes por grupo -->
                <div v-if="cierrePeriodo.pendientesPorGrupo?.length" style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
                  <div style="font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Detalle pendiente por grupo</div>
                  <div v-for="pg in cierrePeriodo.pendientesPorGrupo" :key="pg.grupo_id"
                    style="display:flex;justify-content:space-between;font-size:12px;padding:4px 8px;margin-bottom:3px;border-radius:6px;background:rgba(255,165,0,0.08)">
                    <span style="color:var(--text)">{{ pg.nombre }}</span>
                    <span style="color:var(--yellow);font-weight:600">{{ fmt(pg.balance) }} pendiente</span>
                  </div>
                </div>
                <div v-else-if="cierrePeriodo.totalBalance === 0" style="margin-top:6px;font-size:12px;color:var(--green);padding:4px 8px">
                  ✅ Todos los supervisores entregaron completo
                </div>
              </div>

              <!-- Cuadre bancario -->
              <div style="background:rgba(26,115,232,0.06);border-radius:10px;padding:14px;border:1px solid rgba(26,115,232,0.2)">
                <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:10px;text-transform:uppercase">🏦 CUADRE BANCARIO</div>
                <div class="kv-row"><span>Saldo banco inicio del período</span><span>{{ fmt(cierrePeriodo.saldoBancoInicio) }}</span></div>
                <div class="kv-row"><span>+ Depósitos durante el período</span><span class="pos">{{ fmt(cierrePeriodo.depositosBanco) }}</span></div>
                <div class="kv-row"><span>− Retiros durante el período</span><span class="neg">{{ fmt(cierrePeriodo.retirosBanco) }}</span></div>
                <div class="kv-row kv-total"><span>= Saldo banco calculado</span><span class="pos">{{ fmt(cierrePeriodo.saldoBancoCalc) }}</span></div>
                <hr style="border-color:rgba(26,115,232,0.2);margin:10px 0"/>
                <div style="font-weight:600;font-size:13px;margin-bottom:8px">Ingresar saldo REAL del banco ahora mismo:</div>
                <input type="number" class="form-control" v-model="cierreFrm.saldo_banco_real" step="0.01"/>
                <div v-if="cierreFrm.saldo_banco_real" style="margin-top:8px;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:700"
                  :style="Math.abs(cierreFrm.saldo_banco_real - cierrePeriodo.saldoBancoCalc) < 1 ? 'background:rgba(0,229,160,0.1);color:var(--green)' : 'background:rgba(255,77,109,0.1);color:var(--red)'">
                  {{ Math.abs(cierreFrm.saldo_banco_real - cierrePeriodo.saldoBancoCalc) < 1 ? '✅ Cuadrado — no hay diferencia' :
                     (cierreFrm.saldo_banco_real - cierrePeriodo.saldoBancoCalc > 0 ?
                       '⚠️ El banco tiene ' + fmt(cierreFrm.saldo_banco_real - cierrePeriodo.saldoBancoCalc) + ' más de lo esperado' :
                       '⚠️ Diferencia: ' + fmt(cierrePeriodo.saldoBancoCalc - cierreFrm.saldo_banco_real) + ' — el sistema esperaba más') }}
                </div>
              </div>

              <!-- Notas cierre -->
              <div>
                <label class="form-label">Notas del cierre (opcional)</label>
                <textarea class="form-control" v-model="cierreFrm.notas" rows="2" placeholder="Observaciones, justificación de diferencias..."></textarea>
              </div>

              <div style="font-size:12px;color:var(--muted);padding:8px 12px;background:var(--bg-hover);border-radius:8px">
                📌 Al confirmar, el período quedará marcado como <strong>Cerrado</strong>. Si hay diferencia bancaria, se registra automáticamente un ajuste en Flujo de Efectivo.
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showCierreModal=false">Cancelar</button>
              <button class="btn btn-primary" @click="confirmarCierre" :disabled="!cierreFrm.saldo_banco_real">
                ✅ Confirmar y Cerrar Período
              </button>
            </div>
          </div>
        </div>

      </div><!-- /cierre_periodo -->

    <!-- /APP PRINCIPAL -->




</template>

<style scoped>
/* ── Drawer slide-in animation ── */
.drawer-fade-enter-active { transition: opacity 0.22s ease; }
.drawer-fade-leave-active { transition: opacity 0.18s ease; }
.drawer-fade-enter-from   { opacity: 0; }
.drawer-fade-leave-to     { opacity: 0; }
.drawer-fade-enter-active :deep(div:last-child),
.drawer-fade-leave-active :deep(div:last-child) {
  transition: transform 0.28s cubic-bezier(0.32,0,0.15,1);
}
.drawer-fade-enter-from :deep(div:last-child),
.drawer-fade-leave-to   :deep(div:last-child) {
  transform: translateX(100%);
}
</style>
