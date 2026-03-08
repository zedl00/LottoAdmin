import { ref, computed, watch } from 'vue'
import { bancas, categorias, fmt, getSb, grupos, periodos, selectedPeriodoId, toast, view } from '../store.js'

export function useCuadre() {
  const cuadreGrupoId = ref('');

  const cuadrePeriodoId = ref('');

  const cuadreBancaId = ref('');

  const cuadreData = ref(null);

  const cuadreFrm = ref({
    balance_anterior: 0, entregado_supervisor: 0, entregado_central: 0,
    depositado: 0, arrastre_participacion: 0, participacion_pagada: 0, notas: ''
  });

  const savingCuadre = ref(false);

  const balanceAnteriorManual = ref(false);

  const arrastrePartManual = ref(false);

  const showMovRapido = ref(false);

  const movRapidoFrm = ref({ fecha: new Date().toISOString().split('T')[0], tipo:'salida', monto:0, concepto:'' });

  const showReporte = ref(false);

  const calcTotalDepositar = computed(() => {
    if (!cuadreData.value) return 0;
    const acum = cuadreFrm.value.balance_anterior + cuadreData.value.totals.resultado_periodo;
    // entregado_supervisor = salidas mid-week (avances dados), entregado_central = entradas mid-week (pagos recibidos)
    return acum + cuadreFrm.value.entregado_supervisor - cuadreFrm.value.entregado_central;
  });

  const calcMontoEntregaSupervisor = computed(() => {
    if (!cuadreData.value) return 0;
    return calcTotalDepositar.value - calcParticipacion.value;
  });

  const calcBalanceFinal = computed(() => calcMontoEntregaSupervisor.value - cuadreFrm.value.depositado);

  const calcBaseParticipacion = computed(() => {
    if (!cuadreData.value) return 0;
    // Base = Ventas - Premios - Comisión (resultado_loteria) + arrastre
    // Los gastos operativos NO se descuentan para calcular la participación
    return cuadreFrm.value.arrastre_participacion + cuadreData.value.totals.resultado_loteria;
  });

  const calcParticipacion = computed(() => {
    if (!cuadreData.value) return 0;
    const base = calcBaseParticipacion.value;
    if (base <= 0) return 0;
    return base * (cuadreData.value.grupo?.porcentaje_participacion || 0) / 100;
  });

  async function loadCuadre() {
    const sb = getSb()
    if (!sb) return
    if (!sb || !cuadreGrupoId.value || !cuadrePeriodoId.value) return;
    // Para grupos individual_bancas, redirigir a loadCuadreBanca
    const grupoActual = grupos.value.find(g=>g.id===cuadreGrupoId.value);
    const grupoModoActual = grupoActual?.modo || 'estandar';
    if (grupoModoActual === 'individual_bancas') {
      if (!cuadreBancaId.value) return;
      return loadCuadreBanca();
    }
    cuadreData.value = null; // reset mientras carga

    const grupo = grupos.value.find(g=>g.id===cuadreGrupoId.value);
    const periodo = periodos.value.find(p=>p.id===cuadrePeriodoId.value);
    const bancasGrupo = bancas.value.filter(b=>b.grupo_id===cuadreGrupoId.value && b.activo);

    // Cargar ventas del período
    const { data: ventas } = await sb.from('ventas_semana')
      .select('*')
      .eq('periodo_id', cuadrePeriodoId.value)
      .in('banca_id', bancasGrupo.map(b=>b.id));

    // Cargar gastos del grupo en este período (con categoría para mostrar en panel)
    const { data: gastosGrupo } = await sb.from('gastos')
      .select('*, categorias(nombre,color)')
      .eq('periodo_id', cuadrePeriodoId.value)
      .eq('grupo_id', cuadreGrupoId.value);

    // Cargar cuadre existente para este período (modo editar si existe)
    const { data: cuadreExistente } = await sb.from('cuadres_grupo')
      .select('*')
      .eq('grupo_id', cuadreGrupoId.value)
      .eq('periodo_id', cuadrePeriodoId.value)
      .single();

    // ── AUTO-CARGAR BALANCE ANTERIOR Y ARRASTRE PARTICIPACIÓN ──
    let balanceAnteriorAuto = 0;
    let arrastrePartAuto = 0;
    if (!cuadreExistente) {
      // Balance de efectivo del último cuadre guardado
      const { data: ultimoCuadre } = await sb.from('cuadres_grupo')
        .select('balance_final, periodos(fecha_inicio)')
        .eq('grupo_id', cuadreGrupoId.value)
        .neq('periodo_id', cuadrePeriodoId.value)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (ultimoCuadre) {
        balanceAnteriorAuto = ultimoCuadre.balance_final || 0;
        balanceAnteriorManual.value = false; // viene del sistema → bloqueado
      } else {
        balanceAnteriorAuto = grupo?.balance_inicial || 0;
        balanceAnteriorManual.value = true;  // sin historial → editable
      }

      // Arrastre de participación del último período registrado
      const { data: ultimaPart } = await sb.from('participacion_acumulada')
        .select('arrastre_siguiente')
        .eq('grupo_id', cuadreGrupoId.value)
        .neq('periodo_id', cuadrePeriodoId.value)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (ultimaPart) {
        arrastrePartAuto = ultimaPart.arrastre_siguiente || 0;
        arrastrePartManual.value = false; // viene del sistema → bloqueado
      } else {
        arrastrePartAuto = grupo?.arrastre_part_inicial || 0;
        arrastrePartManual.value = true;  // sin historial → editable
      }
    }

    // ── MOVIMIENTOS DE SEMANA (prestamos del grupo en este período) ──
    const { data: movSemana } = await sb.from('prestamos')
      .select('*')
      .eq('grupo_id', cuadreGrupoId.value)
      .eq('periodo_id', cuadrePeriodoId.value)
      .order('fecha').order('created_at');

    const movSalidas  = (movSemana||[]).filter(p=>p.tipo==='salida').reduce((s,p)=>s+p.monto,0);
    const movEntradas = (movSemana||[]).filter(p=>p.tipo==='entrada').reduce((s,p)=>s+p.monto,0);
    const movNeto = movSalidas - movEntradas;

    // ── GASTOS OPERATIVOS (solo tipo='operativo' rebaja en cuadre del supervisor) ──
    const gastosOp    = (gastosGrupo||[]).filter(g => g.tipo==='operativo');
    // Gastos sin banca asignada → van al total del grupo (no a una banca específica)
    const gastosGrupoSinBanca = gastosOp.filter(g => !g.banca_id);
    const totalGastosGrupo    = gastosGrupoSinBanca.reduce((s,g)=>s+g.monto,0);

    // ── CALCULAR POR BANCA ──
    const bancasCalc = bancasGrupo.map(b => {
      const v = ventas?.find(v=>v.banca_id===b.id) || {};
      const vtas = v.ventas || 0;
      const prem = v.premios || 0;
      const result = vtas - prem;
      const com = vtas * (b.porcentaje_comision || 0) / 100;
      const resNeto = result - com;
      // Solo gastos operativos de esta banca específica
      const gastosOpBanca = gastosOp.filter(g=>g.banca_id===b.id).reduce((s,g)=>s+g.monto,0);
      return {
        ...b,
        ventas: vtas, premios: prem,
        resultado: result, comision: com, resultado_neto: resNeto,
        gastos_op: gastosOpBanca, total_gastos: gastosOpBanca,
        resultado_periodo: resNeto - gastosOpBanca
      };
    });

    const totals = bancasCalc.reduce((acc, b) => ({
      ventas: acc.ventas + b.ventas,
      premios: acc.premios + b.premios,
      resultado: acc.resultado + b.resultado,
      comisiones: acc.comisiones + b.comision,
      resultado_loteria: acc.resultado_loteria + b.resultado_neto,
      gastos_op: acc.gastos_op + b.gastos_op,
      total_gastos: acc.total_gastos + b.total_gastos,
      resultado_periodo: acc.resultado_periodo + b.resultado_periodo,
    }), { ventas:0, premios:0, resultado:0, comisiones:0, resultado_loteria:0, gastos_op:0, total_gastos:0, resultado_periodo:0 });
    // Agregar gastos de grupo sin banca al total
    totals.gastos_op         += totalGastosGrupo;
    totals.total_gastos      += totalGastosGrupo;
    totals.resultado_periodo -= totalGastosGrupo;

    const pctPart = grupo?.porcentaje_participacion || 0;
    totals.gasto_participacion = totals.resultado_periodo > 0 ? Math.round(totals.resultado_periodo * pctPart / 100) : 0;
    totals.resultado_neto_central = totals.resultado_periodo - totals.gasto_participacion;

    cuadreData.value = {
      grupo, periodo, bancas: bancasCalc, totals,
      movimientos: movSemana || [],
      movSalidas, movEntradas, movNeto,
      editando: !!cuadreExistente,
      // Gastos operativos visibles en el cuadre
      gastosOperativos: gastosOp.map(g=>({
        ...g,
        _bancaNombre: bancasGrupo.find(b=>b.id===g.banca_id)?.nombre || null,
        _bancaCodigo: bancasGrupo.find(b=>b.id===g.banca_id)?.codigo || null
      }))
    };

    // ── POBLAR FORMULARIO ──
    if (cuadreExistente) {
      // MODO EDITAR: cargar todos los valores guardados — no editable manualmente
      balanceAnteriorManual.value = false;
      arrastrePartManual.value = false;
      cuadreFrm.value = {
        balance_anterior:      cuadreExistente.balance_pendiente_anterior || 0,
        entregado_supervisor:  cuadreExistente.entregado_supervisor || movSalidas,
        entregado_central:     cuadreExistente.entregado_central || movEntradas,
        depositado:            cuadreExistente.depositado || 0,
        arrastre_participacion:cuadreExistente.arrastre_participacion || 0,
        participacion_pagada:  cuadreExistente.participacion_pagada || 0,
        notas:                 cuadreExistente.notas || ''
      };
    } else {
      // NUEVO CUADRE: balance anterior del último cuadre guardado
      cuadreFrm.value = {
        balance_anterior:      balanceAnteriorAuto,
        entregado_supervisor:  movSalidas,
        entregado_central:     movEntradas,
        depositado:            0,
        arrastre_participacion:arrastrePartAuto,
        participacion_pagada:  0,
        notas:                 ''
      };
    }
  }

  async function saveCuadre() {
    const sb = getSb()
    if (!sb) return
    if (!sb || !cuadreData.value) return;
    // Si es banca individual, usar saveCuadreBanca
    if (cuadreData.value.esBancaIndividual) return saveCuadreBanca();
    savingCuadre.value = true;
    const t = cuadreData.value.totals;
    const f = cuadreFrm.value;
    const record = {
      grupo_id: cuadreGrupoId.value,
      periodo_id: cuadrePeriodoId.value,
      total_ventas: t.ventas,
      total_premios: t.premios,
      total_comisiones: t.comisiones,
      total_gastos: t.total_gastos,
      resultado_loteria: t.resultado_periodo,
      balance_pendiente_anterior: f.balance_anterior,
      total_acumulado: f.balance_anterior + t.resultado_periodo,
      entregado_supervisor: f.entregado_supervisor,
      entregado_central: f.entregado_central,
      total_a_depositar: calcTotalDepositar.value,
      depositado: f.depositado,
      balance_final: calcBalanceFinal.value,
      arrastre_participacion: f.arrastre_participacion,
      base_participacion: calcBaseParticipacion.value,
      porcentaje_participacion: cuadreData.value.grupo?.porcentaje_participacion || 0,
      participacion_pagada: f.participacion_pagada,
      notas: f.notas
    };
    const { error } = await sb.from('cuadres_grupo').upsert(record, {
      onConflict: 'grupo_id,periodo_id'
    });
    if (error) { toast('Error al guardar: ' + error.message, 'error'); savingCuadre.value = false; return; }

    // Auto-registrar gasto de participación si corresponde
    // Usa calcParticipacion (reactivo, considera arrastre) no t.gasto_participacion (estático)
    if (calcParticipacion.value > 0) {
      // Eliminar el gasto anterior de participación para este grupo/período si existe
      await sb.from('gastos')
        .delete()
        .eq('grupo_id', cuadreGrupoId.value)
        .eq('periodo_id', cuadrePeriodoId.value)
        .eq('tipo', 'participacion');
      // Insertar el nuevo gasto de participación
      const catPart2 = categorias.value.find(c => c.tipo==='egreso' && c.nombre?.toLowerCase().includes('participac'));
      await sb.from('gastos').insert({
        grupo_id:     cuadreGrupoId.value,
        periodo_id:   cuadrePeriodoId.value,
        tipo:         'participacion',
        categoria_id: catPart2?.id || null,
        concepto:     `Participación ${cuadreData.value.grupo?.porcentaje_participacion || 0}% — ${cuadreData.value.grupo?.nombre} — ${cuadreData.value.periodo?.descripcion || ''}`,
        monto:        calcParticipacion.value,
        fecha:        cuadreData.value.periodo?.fecha_fin || cuadreData.value.periodo?.fecha_inicio || new Date().toISOString().split('T')[0]
      });
    }

    // Guardar participación
    // arrastre_siguiente = lo que queda pendiente para la próxima semana
    // Si base <= 0: arrastra el déficit (semana negativa)
    // Si base > 0 y pagó la participación: queda en 0 (limpio)
    // Si base > 0 y NO pagó (o pagó parcial): arrastra lo que falta
    let arrSig;
    if (calcBaseParticipacion.value <= 0) {
      arrSig = calcBaseParticipacion.value; // arrastra déficit
    } else {
      const pendiente = calcParticipacion.value - (f.participacion_pagada || 0);
      arrSig = pendiente > 0 ? pendiente : 0; // si pagó completo → 0
    }
    await sb.from('participacion_acumulada').upsert({
      grupo_id: cuadreGrupoId.value,
      periodo_id: cuadrePeriodoId.value,
      beneficio_semana: t.resultado_periodo,
      arrastre_anterior: f.arrastre_participacion,
      balance_participacion: calcBaseParticipacion.value,
      porcentaje: cuadreData.value.grupo?.porcentaje_participacion || 0,
      monto_a_pagar: calcParticipacion.value,
      pagado: f.participacion_pagada || 0,
      arrastre_siguiente: arrSig
    }, { onConflict: 'grupo_id,periodo_id' });
    // ── AUTO-REGISTRAR DEPÓSITO EN FLUJO DE EFECTIVO ──
    // Primero eliminar registros previos de este cuadre (evita duplicados al re-guardar)
    await sb.from('flujo_efectivo')
      .delete()
      .eq('grupo_id', cuadreGrupoId.value)
      .eq('periodo_id', cuadrePeriodoId.value)
      .eq('origen', 'cuadre');
    if (f.depositado > 0) {
      const catIngreso = categorias.value.find(c=>c.nombre?.includes('Depósito Supervisor') || (c.tipo==='ingreso' && c.nombre?.toLowerCase().includes('cuadre')));
      await sb.from('flujo_efectivo').insert({
        fecha: cuadreData.value.periodo?.fecha_fin || cuadreData.value.periodo?.fecha_inicio || new Date().toISOString().split('T')[0],
        tipo: 'ingreso',
        concepto: `Depósito cuadre — ${cuadreData.value.grupo?.nombre} — ${cuadreData.value.periodo?.descripcion || ''}`,
        monto: f.depositado,
        categoria_id: catIngreso?.id || null,
        grupo_id: cuadreGrupoId.value,
        periodo_id: cuadrePeriodoId.value,
        origen: 'cuadre'
      });
    } else if (f.depositado < 0) {
      // Grupo cerró en pérdida — central entrega dinero al supervisor → egreso
      let catPerdida = categorias.value.find(c => c.nombre === 'Perdida Cuadre');
      if (!catPerdida) {
        const { data: newCat } = await sb.from('categorias').insert({
          nombre: 'Perdida Cuadre', tipo: 'egreso', color: '#ff4d6d', activo: true
        }).select().single();
        if (newCat) { categorias.value.push(newCat); catPerdida = newCat; }
      }
      await sb.from('flujo_efectivo').insert({
        fecha: cuadreData.value.periodo?.fecha_fin || cuadreData.value.periodo?.fecha_inicio || new Date().toISOString().split('T')[0],
        tipo: 'egreso',
        concepto: `Perdida Cuadre — ${cuadreData.value.grupo?.nombre} — ${cuadreData.value.periodo?.descripcion || ''}`,
        monto: Math.abs(f.depositado),
        categoria_id: catPerdida?.id || null,
        grupo_id: cuadreGrupoId.value,
        periodo_id: cuadrePeriodoId.value,
        origen: 'cuadre'
      });
    }
    // Si se entregaron avances mid-week (salidas), registrar en flujo como egreso
    if (cuadreData.value.movNeto > 0) {
      const catEgreso = categorias.value.find(c=>c.nombre?.includes('Préstamo Otorgado') || (c.tipo==='egreso' && c.nombre?.toLowerCase().includes('préstamo')));
      // Solo registrar si el neto de salidas > 0 (se dio más de lo que se recibió)
      await sb.from('flujo_efectivo').upsert({
        fecha: cuadreData.value.periodo?.fecha_inicio || new Date().toISOString().split('T')[0],
        tipo: 'egreso',
        concepto: `Avances/movimientos semana — ${cuadreData.value.grupo?.nombre} — ${cuadreData.value.periodo?.descripcion || ''}`,
        monto: cuadreData.value.movNeto,
        categoria_id: catEgreso?.id || null,
        grupo_id: cuadreGrupoId.value,
        periodo_id: cuadrePeriodoId.value,
        origen: 'cuadre'
      });
    }

    toast('✅ Cuadre guardado correctamente', 'success');
    savingCuadre.value = false;
    // Recargar el cuadre para reflejar modo "editar"
    await loadCuadre();
  }

  function irACuadre(r) {
    cuadreGrupoId.value = r.grupo_id || r.grupos_id;
    cuadrePeriodoId.value = selectedPeriodoId.value;
    cuadreData.value = null;
    view.value = 'cuadre';
    // Auto-cargar después de render
    setTimeout(() => loadCuadre(), 200);
  }

  function irACuadreBanca(grupo_id, banca_id) {
    cuadreGrupoId.value = grupo_id;
    cuadreBancaId.value = banca_id;
    view.value = 'cuadre';
    setTimeout(() => loadCuadre(), 200);
  }

  async function loadCuadreBanca() {
    const sb = getSb()
    if (!sb) return
    if (!sb || !cuadreGrupoId.value || !cuadrePeriodoId.value || !cuadreBancaId.value) return;
    cuadreData.value = null;

    const grupo  = grupos.value.find(g=>g.id===cuadreGrupoId.value);
    const periodo = periodos.value.find(p=>p.id===cuadrePeriodoId.value);
    const banca  = bancas.value.find(b=>b.id===cuadreBancaId.value);

    // Cargar venta de esta banca en este período (maybeSingle: no falla si no hay fila)
    const { data: ventaBanca } = await sb.from('ventas_semana')
      .select('*')
      .eq('banca_id', cuadreBancaId.value)
      .eq('periodo_id', cuadrePeriodoId.value)
      .maybeSingle();

    // Cuadre guardado de esta banca (maybeSingle: no falla si aún no se guardó)
    const { data: cuadreExistente } = await sb.from('cuadres_banca')
      .select('*')
      .eq('banca_id', cuadreBancaId.value)
      .eq('periodo_id', cuadrePeriodoId.value)
      .maybeSingle();

    // Balance anterior: último cuadre_banca de esta banca
    let balanceAnteriorAuto = 0;
    let arrastrePartAuto = 0;
    if (!cuadreExistente) {
      const { data: ultimoCuadreBanca } = await sb.from('cuadres_banca')
        .select('balance_final')
        .eq('banca_id', cuadreBancaId.value)
        .neq('periodo_id', cuadrePeriodoId.value)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();
      if (ultimoCuadreBanca) {
        balanceAnteriorAuto = ultimoCuadreBanca.balance_final || 0;
        balanceAnteriorManual.value = false;
      } else {
        balanceAnteriorAuto = banca?.balance_inicial || 0;
        balanceAnteriorManual.value = true;
      }
      // Arrastre participación individual de esta banca
      const { data: ultimaPart } = await sb.from('participacion_acumulada')
        .select('arrastre_siguiente')
        .eq('grupo_id', cuadreGrupoId.value)
        .eq('banca_id', cuadreBancaId.value)
        .neq('periodo_id', cuadrePeriodoId.value)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();
      if (ultimaPart) {
        arrastrePartAuto = ultimaPart.arrastre_siguiente || 0;
        arrastrePartManual.value = false;
      } else {
        arrastrePartAuto = 0;
        arrastrePartManual.value = true;
      }
    }

    const vtas  = ventaBanca?.ventas  || 0;
    const prem  = ventaBanca?.premios || 0;
    const result = vtas - prem;
    const pctCom = banca?.porcentaje_comision || 0;
    const com    = vtas * pctCom / 100;
    const resNeto = result - com;

    // ── GASTOS OPERATIVOS de esta banca en este período ──
    const { data: gastosBanca } = await sb.from('gastos')
      .select('*, categorias(nombre,color)')
      .eq('periodo_id', cuadrePeriodoId.value)
      .eq('banca_id', cuadreBancaId.value)
      .eq('tipo', 'operativo');
    const totalGastosBanca = (gastosBanca||[]).reduce((s,g)=>s+g.monto,0);

    const totals = {
      ventas: vtas, premios: prem,
      resultado: result, comisiones: com,
      resultado_loteria: resNeto,
      gastos_op: totalGastosBanca, total_gastos: totalGastosBanca,
      resultado_periodo: resNeto - totalGastosBanca,
      gasto_participacion: 0,
      resultado_neto_central: resNeto - totalGastosBanca
    };

    // ── MOVIMIENTOS DE SEMANA de esta banca específica ──
    const { data: movSemana } = await sb.from('prestamos')
      .select('*')
      .eq('grupo_id', cuadreGrupoId.value)
      .eq('banca_id', cuadreBancaId.value)
      .eq('periodo_id', cuadrePeriodoId.value)
      .order('fecha').order('created_at');
    const movSalidas  = (movSemana||[]).filter(p=>p.tipo==='salida').reduce((s,p)=>s+p.monto,0);
    const movEntradas = (movSemana||[]).filter(p=>p.tipo==='entrada').reduce((s,p)=>s+p.monto,0);
    const movNeto = movSalidas - movEntradas;

    cuadreData.value = {
      grupo, periodo,
      banca,
      esBancaIndividual: true,
      bancas: banca ? [{ ...banca, ventas: vtas, premios: prem, resultado: result,
        comision: com, resultado_neto: resNeto,
        gastos_op: totalGastosBanca, total_gastos: totalGastosBanca,
        resultado_periodo: resNeto - totalGastosBanca }] : [],
      totals,
      movimientos: movSemana || [], movSalidas, movEntradas, movNeto,
      editando: !!cuadreExistente,
      gastosOperativos: (gastosBanca||[]).map(g=>({
        ...g,
        _bancaNombre: banca?.nombre || null,
        _bancaCodigo: banca?.codigo || null
      }))
    };

    if (cuadreExistente) {
      balanceAnteriorManual.value = false;
      arrastrePartManual.value = false;
      cuadreFrm.value = {
        balance_anterior:      cuadreExistente.balance_pendiente_anterior || 0,
        entregado_supervisor:  movSalidas,  // siempre desde movimientos reales
        entregado_central:     movEntradas, // siempre desde movimientos reales
        depositado:            cuadreExistente.depositado || 0,
        arrastre_participacion:cuadreExistente.arrastre_participacion || 0,
        participacion_pagada:  cuadreExistente.participacion_pagada || 0,
        notas:                 cuadreExistente.notas || ''
      };
      // Reconstruir totals desde campos del schema existente
      const vtas2  = cuadreExistente.ventas  || 0;
      const prem2  = cuadreExistente.premios || 0;
      const com2   = cuadreExistente.comision || 0;
      const resP2  = cuadreExistente.resultado_periodo || 0;
      cuadreData.value.totals.ventas = vtas2;
      cuadreData.value.totals.premios = prem2;
      cuadreData.value.totals.comisiones = com2;
      cuadreData.value.totals.resultado_periodo = resP2;
    } else {
      cuadreFrm.value = {
        balance_anterior:      balanceAnteriorAuto,
        entregado_supervisor:  movSalidas,
        entregado_central:     movEntradas,
        depositado:            0,
        arrastre_participacion:arrastrePartAuto,
        participacion_pagada:  0,
        notas:                 ''
      };
    }
  }

  async function saveCuadreBanca() {
    const sb = getSb()
    if (!sb) return
    if (!sb || !cuadreData.value) return;
    savingCuadre.value = true;
    const t = cuadreData.value.totals;
    const f = cuadreFrm.value;
    const banca = cuadreData.value.banca;
    const pctPart = banca?.porcentaje_participacion || 0;

    // Recalcular participación con arrastre
    const basePartic = (f.arrastre_participacion || 0) + t.resultado_periodo;
    const partCalc   = basePartic > 0 ? Math.round(basePartic * pctPart / 100) : 0;

    const totalAcum   = f.balance_anterior + t.resultado_periodo;
    const totalDep    = totalAcum + f.entregado_supervisor - f.entregado_central;
    const montoEnt    = totalDep - partCalc;
    const balanceFin  = montoEnt - f.depositado;

    const record = {
      grupo_id:   cuadreGrupoId.value,
      banca_id:   cuadreBancaId.value,
      periodo_id: cuadrePeriodoId.value,
      // Nombres según schema existente en Supabase
      ventas:           t.ventas,
      premios:          t.premios,
      comision:         t.comisiones,
      porcentaje_comision: banca?.porcentaje_comision || 0,
      resultado:        t.resultado,
      resultado_neto:   t.resultado_loteria,
      total_gastos:     partCalc,
      resultado_loteria: t.resultado_periodo,
      resultado_periodo: t.resultado_periodo,
      // Campos de cuadre/balance (añadidos via ALTER)
      balance_pendiente_anterior: f.balance_anterior,
      total_acumulado: totalAcum,
      entregado_supervisor: f.entregado_supervisor,
      entregado_central:    f.entregado_central,
      total_a_depositar: totalDep,
      depositado:    f.depositado,
      balance_final: balanceFin,
      arrastre_participacion: f.arrastre_participacion,
      porcentaje_participacion: pctPart,
      participacion_pagada: f.participacion_pagada,
      notas: f.notas
    };

    const { error } = await sb.from('cuadres_banca').upsert(record,
      { onConflict: 'banca_id,periodo_id' });
    if (error) { toast('Error: ' + error.message, 'error'); savingCuadre.value = false; return; }

    // Guardar participación individual de esta banca
    let arrSig;
    if (basePartic <= 0) {
      arrSig = basePartic;
    } else {
      const pendiente = partCalc - (f.participacion_pagada || 0);
      arrSig = pendiente > 0 ? pendiente : 0;
    }
    await sb.from('participacion_acumulada').upsert({
      grupo_id:   cuadreGrupoId.value,
      banca_id:   cuadreBancaId.value,
      periodo_id: cuadrePeriodoId.value,
      beneficio_semana: t.resultado_periodo,
      arrastre_anterior: f.arrastre_participacion,
      balance_participacion: basePartic,
      porcentaje: pctPart,
      monto_a_pagar: partCalc,
      pagado: f.participacion_pagada || 0,
      arrastre_siguiente: arrSig
    }, { onConflict: 'grupo_id,banca_id,periodo_id' });

    // ── REGISTRAR GASTO DE PARTICIPACIÓN EN TABLA GASTOS (banca individual) ──
    await sb.from('gastos')
      .delete()
      .eq('grupo_id', cuadreGrupoId.value)
      .eq('banca_id', cuadreBancaId.value)
      .eq('periodo_id', cuadrePeriodoId.value)
      .eq('tipo', 'participacion');
    if (partCalc > 0) {
      const catPart1 = categorias.value.find(c => c.tipo==='egreso' && c.nombre?.toLowerCase().includes('participac'));
      await sb.from('gastos').insert({
        grupo_id:     cuadreGrupoId.value,
        banca_id:     cuadreBancaId.value,
        periodo_id:   cuadrePeriodoId.value,
        tipo:         'participacion',
        categoria_id: catPart1?.id || null,
        concepto:     `Participación ${pctPart}% — ${cuadreData.value.banca?.codigo} ${cuadreData.value.banca?.nombre} — ${cuadreData.value.grupo?.nombre} — ${cuadreData.value.periodo?.descripcion || ''}`,
        monto:        partCalc,
        fecha:        cuadreData.value.periodo?.fecha_fin || cuadreData.value.periodo?.fecha_inicio || new Date().toISOString().split('T')[0]
      });
    }

    // ── AUTO-REGISTRAR DEPÓSITO EN FLUJO DE EFECTIVO (banca individual) ──
    await sb.from('flujo_efectivo')
      .delete()
      .eq('grupo_id', cuadreGrupoId.value)
      .eq('banca_id', cuadreBancaId.value)
      .eq('periodo_id', cuadrePeriodoId.value)
      .eq('origen', 'cuadre');
    if (f.depositado > 0) {
      // Banca entrega dinero → ingreso en flujo
      const catIngreso = categorias.value.find(c=>c.nombre?.includes('Depósito Supervisor') || (c.tipo==='ingreso' && c.nombre?.toLowerCase().includes('cuadre')));
      await sb.from('flujo_efectivo').insert({
        fecha: cuadreData.value.periodo?.fecha_fin || cuadreData.value.periodo?.fecha_inicio || new Date().toISOString().split('T')[0],
        tipo: 'ingreso',
        concepto: `Depósito cuadre — ${cuadreData.value.banca?.codigo} ${cuadreData.value.banca?.nombre} — ${cuadreData.value.grupo?.nombre} — ${cuadreData.value.periodo?.descripcion || ''}`,
        monto: f.depositado,
        categoria_id: catIngreso?.id || null,
        grupo_id: cuadreGrupoId.value,
        banca_id: cuadreBancaId.value,
        periodo_id: cuadrePeriodoId.value,
        origen: 'cuadre'
      });
    } else if (f.depositado < 0) {
      // Banca perdió → central entrega dinero → egreso en flujo
      // Buscar categoría "Pago Cuadre Perdida", crearla si no existe
      let catPerdida = categorias.value.find(c=>c.nombre === 'Perdida Cuadre');
      if (!catPerdida) {
        const { data: newCat } = await sb.from('categorias').insert({
          nombre: 'Perdida Cuadre', tipo: 'egreso', color: '#ff4d6d', activo: true
        }).select().single();
        if (newCat) { categorias.value.push(newCat); catPerdida = newCat; }
      }
      await sb.from('flujo_efectivo').insert({
        fecha: cuadreData.value.periodo?.fecha_fin || cuadreData.value.periodo?.fecha_inicio || new Date().toISOString().split('T')[0],
        tipo: 'egreso',
        concepto: `Perdida Cuadre — ${cuadreData.value.banca?.codigo} ${cuadreData.value.banca?.nombre} — ${cuadreData.value.grupo?.nombre} — ${cuadreData.value.periodo?.descripcion || ''}`,
        monto: Math.abs(f.depositado),
        categoria_id: catPerdida?.id || null,
        grupo_id: cuadreGrupoId.value,
        banca_id: cuadreBancaId.value,
        periodo_id: cuadrePeriodoId.value,
        origen: 'cuadre'
      });
    }

    toast('✅ Cuadre de banca guardado', 'success');
    savingCuadre.value = false;
    await loadCuadreBanca();
  }

  function abrirMovRapido() {
    movRapidoFrm.value = {
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'salida', monto: 0, concepto: ''
    };
    showMovRapido.value = true;
  }

  async function saveMovRapido() {
    const sb = getSb()
    if (!sb) return
    if (!sb || !cuadreData.value) return;
    if (!movRapidoFrm.value.monto || movRapidoFrm.value.monto <= 0) {
      toast('Ingresa un monto válido', 'error'); return;
    }
    const { error } = await sb.from('prestamos').insert({
      grupo_id:  cuadreGrupoId.value,
      periodo_id: cuadrePeriodoId.value,
      banca_id:  cuadreData.value.esBancaIndividual ? cuadreBancaId.value : null,
      tipo:      movRapidoFrm.value.tipo,
      monto:     movRapidoFrm.value.monto,
      concepto:  movRapidoFrm.value.concepto,
      fecha:     movRapidoFrm.value.fecha
    });
    if (error) { toast('Error: ' + error.message, 'error'); return; }

    // ── REGISTRAR EN FLUJO DE EFECTIVO ──
    const esSalida = movRapidoFrm.value.tipo === 'salida';
    const catFlujo = categorias.value.find(c =>
      esSalida
        ? (c.tipo==='egreso' && (c.nombre?.toLowerCase().includes('préstamo') || c.nombre?.toLowerCase().includes('avance')))
        : (c.tipo==='ingreso' && c.nombre?.toLowerCase().includes('devolución'))
    );
    const bancaNom = cuadreData.value.esBancaIndividual
      ? `${cuadreData.value.banca?.codigo} ${cuadreData.value.banca?.nombre} — `
      : '';
    await sb.from('flujo_efectivo').insert({
      fecha:        movRapidoFrm.value.fecha,
      tipo:         esSalida ? 'egreso' : 'ingreso',
      concepto:     `${esSalida ? 'Préstamo/Avance' : 'Devolución'} — ${bancaNom}${cuadreData.value.grupo?.nombre} — ${movRapidoFrm.value.concepto || ''}`,
      monto:        movRapidoFrm.value.monto,
      categoria_id: catFlujo?.id || null,
      grupo_id:     cuadreGrupoId.value,
      banca_id:     cuadreData.value.esBancaIndividual ? cuadreBancaId.value : null,
      periodo_id:   cuadrePeriodoId.value,
      origen:       'prestamo'
    });

    toast('Movimiento registrado ✓', 'success');
    showMovRapido.value = false;
    // Recargar el cuadre para reflejar el nuevo movimiento
    await loadCuadre();
  }

  function printReport() {
    if (!cuadreData.value) return;
    const d = cuadreData.value;
    const f = cuadreFrm.value;
    const t = d.totals;
    const fmtN = n => { const v = Number(n)||0; return (v<0?'-$':'$')+Math.abs(v).toLocaleString('es-DO',{minimumFractionDigits:0,maximumFractionDigits:0}); };
    const totalAcum = f.balance_anterior + t.resultado_periodo;
    const totalDep  = totalAcum + f.entregado_supervisor - f.entregado_central;
    // Recalcular participación considerando arrastre + balance anterior (igual que calcParticipacion)
    const basePartic = (f.arrastre_participacion || 0) + t.resultado_periodo;
    const partCalc   = basePartic > 0 ? Math.round(basePartic * (d.grupo?.porcentaje_participacion||0) / 100) : 0;
    const montoSup  = totalDep - partCalc;
    const balance   = montoSup - f.depositado;

    const bancaRows = d.bancas.map(b => `
      <tr>
        <td>${b.codigo||''}</td><td>${b.nombre||''}</td>
        <td class="r">${fmtN(b.ventas)}</td>
        <td class="r neg">${fmtN(b.premios)}</td>
        <td class="r ${b.resultado<0?'neg':'pos'}">${fmtN(b.resultado)}</td>
        <td class="r">${b.porcentaje_comision||0}%</td>
        <td class="r neg">${fmtN(b.comision)}</td>
        <td class="r ${b.resultado_neto<0?'neg':'pos'}">${fmtN(b.resultado_neto)}</td>
        <td class="r neg">${fmtN(b.total_gastos)}</td>
        <td class="r ${b.resultado_periodo<0?'neg':'pos'} bold">${fmtN(b.resultado_periodo)}</td>
      </tr>`).join('');

    const movRows = (d.movimientos||[]).map(m => `
      <tr>
        <td>${m.fecha||''}</td>
        <td>${m.tipo==='salida'?'↑ Préstamo Entregado':'↓ Pago Recibido'}</td>
        <td>${m.concepto||'-'}</td>
        <td class="r ${m.tipo==='salida'?'neg':'pos'}">${m.tipo==='salida'?'-':'+'} ${fmtN(m.monto)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="es"><head>
  <meta charset="UTF-8">
  <title>Cuadre — ${d.grupo?.nombre||''} — ${d.periodo?.descripcion||''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
    h1 { font-size: 16px; text-align: center; margin-bottom: 2px; }
    h2 { font-size: 13px; text-align: center; font-weight: normal; color: #444; margin-bottom: 4px; }
    .meta { text-align: center; font-size: 10px; color: #666; margin-bottom: 16px; }
    .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; background: #f0f0f0; padding: 5px 8px; margin: 12px 0 0; border-left: 3px solid #111; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { padding: 4px 7px; border: 1px solid #ddd; font-size: 10px; }
    thead { background: #f5f5f5; font-weight: bold; }
    tfoot { background: #f0f0f0; font-weight: bold; }
    .r { text-align: right; }
    .pos { color: #00854a; }
    .neg { color: #cc0033; }
    .bold { font-weight: bold; }
    .kv { display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
    .kv.total { background: #f0f0f0; font-weight: bold; padding: 6px 8px; }
    .kv.highlight { background: #e6f9f2; border: 1px solid #00854a; font-weight: bold; padding: 6px 8px; margin-top: 4px; }
    .kv.balance { background: #111; color: #fff; font-weight: bold; font-size: 13px; padding: 8px; margin-top: 6px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
    .box { border: 1px solid #ddd; border-radius: 3px; overflow: hidden; }
    .box-title { background: #333; color: #fff; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; padding: 4px 8px; }
    .footer { text-align: center; font-size: 9px; color: #999; margin-top: 20px; border-top: 1px solid #eee; padding-top: 6px; }
    @media print { @page { margin: 1cm; size: A4 landscape; } }
  </style>
  </head><body>
  <h1>CUADRE SEMANAL — GRUPO ${(d.grupo?.nombre||'').toUpperCase()}</h1>
  <h2>${d.periodo?.descripcion||''}</h2>
  <div class="meta">Generado: ${new Date().toLocaleDateString('es-DO',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>

  <div class="section-title">Detalle de Bancas</div>
  <table>
    <thead><tr>
  <th>Cód.</th><th>Banca</th>
  <th class="r">Ventas</th><th class="r">Premios</th><th class="r">Res. Venta</th>
  <th class="r">%Com</th><th class="r">Comisión</th><th class="r">Res. Bruto</th>
  <th class="r">Gastos</th><th class="r">Res. Final</th>
    </tr></thead>
    <tbody>${bancaRows}</tbody>
    <tfoot><tr>
  <td colspan="2">TOTAL</td>
  <td class="r">${fmtN(t.ventas)}</td>
  <td class="r neg">${fmtN(t.premios)}</td>
  <td class="r ${t.resultado<0?'neg':'pos'}">${fmtN(t.resultado)}</td>
  <td></td>
  <td class="r neg">${fmtN(t.comisiones)}</td>
  <td class="r ${t.resultado_loteria<0?'neg':'pos'}">${fmtN(t.resultado_loteria)}</td>
  <td class="r neg">${fmtN(t.total_gastos)}</td>
  <td class="r ${t.resultado_periodo<0?'neg':'pos'} bold">${fmtN(t.resultado_periodo)}</td>
    </tr></tfoot>
  </table>

  <div class="two-col">
    <div>
  <div class="section-title">P&amp;L del Período</div>
  <div class="box">
    <div class="box-title">Resultado</div>
    <div class="kv"><span>Ventas</span><span class="pos">${fmtN(t.ventas)}</span></div>
    <div class="kv"><span>(-) Premios</span><span class="neg">${fmtN(t.premios)}</span></div>
    <div class="kv total"><span>Resultado Venta</span><span class="${t.resultado<0?'neg':'pos'}">${fmtN(t.resultado)}</span></div>
    <div class="kv"><span>(-) Comisiones</span><span class="neg">${fmtN(t.comisiones)}</span></div>
    <div class="kv total"><span>Resultado Bruto</span><span class="${t.resultado_loteria<0?'neg':'pos'}">${fmtN(t.resultado_loteria)}</span></div>
    <div class="kv"><span>(-) Gastos Operativos</span><span class="neg">${fmtN(t.total_gastos)}</span></div>
    ${partCalc>0?`<div class="kv"><span>(-) Participación (${d.grupo?.porcentaje_participacion||0}%)</span><span class="neg">${fmtN(partCalc)}</span></div>`:''}
    <div class="kv total" style="background:#e6f9f2"><span><b>RESULTADO FINAL</b></span><span class="${t.resultado_periodo<0?'neg':'pos'} bold">${fmtN(t.resultado_periodo)}</span></div>
  </div>
  <div class="box-title" style="margin-top:8px;background:#555">Participación Supervisor (${d.grupo?.porcentaje_participacion||0}%)</div>
  <div class="box">
    <div class="kv"><span>Arrastre anterior</span><span class="${(f.arrastre_participacion||0)<0?'neg':''}">${fmtN(f.arrastre_participacion||0)}</span></div>
    <div class="kv"><span>(+) Resultado semana</span><span class="${t.resultado_periodo<0?'neg':'pos'}">${fmtN(t.resultado_periodo)}</span></div>
    <div class="kv total"><span><b>Base acumulada</b></span><span class="${basePartic<0?'neg':'pos'}">${fmtN(basePartic)}</span></div>
    ${partCalc>0
      ? `<div class="kv" style="background:#fffbe6"><span>Participación a pagar (${d.grupo?.porcentaje_participacion||0}%)</span><span class="neg">${fmtN(partCalc)}</span></div>
         <div class="kv total" style="background:#e6f9f2"><span><b>Arrastre próximo cuadre</b></span><span>$0</span></div>`
      : `<div style="font-size:10px;color:#888;padding:6px 8px">ℹ️ Base negativa — sin pago esta semana. Arrastre próximo cuadre: <b>${fmtN(basePartic)}</b></div>`
    }
  </div>
    </div>

    <div>
  <div class="section-title">Balance y Cierre</div>
  <div class="box">
    <div class="box-title">Movimientos de Efectivo</div>
    <div class="kv"><span>Balance Pendiente Anterior</span><span class="${f.balance_anterior<0?'neg':''}">${fmtN(f.balance_anterior)}</span></div>
    <div class="kv"><span>Resultado Final</span><span class="${t.resultado_periodo<0?'neg':'pos'}">${fmtN(t.resultado_periodo)}</span></div>
    <div class="kv total"><span>Total Acumulado</span><span class="${totalAcum<0?'neg':'pos'}">${fmtN(totalAcum)}</span></div>
    ${f.entregado_supervisor>0?`<div class="kv"><span>(+) Entregado Préstamo (a supervisor)</span><span class="neg">${fmtN(f.entregado_supervisor)}</span></div>`:''}
    ${f.entregado_central>0?`<div class="kv"><span>(-) Transferencia Admin (de supervisor)</span><span class="pos">${fmtN(f.entregado_central)}</span></div>`:''}
    <div class="kv total"><span>Total a Depositar / Transferir</span><span class="${totalDep<0?'neg':'pos'}">${fmtN(totalDep)}</span></div>
    ${partCalc>0?`<div class="kv"><span>(-) Participación Supervisor</span><span>${fmtN(partCalc)}</span></div>`:''}
    <div class="kv highlight"><span>MONTO ENTREGADO (por supervisor)</span><span class="${montoSup>=0?'pos':'neg'}">${fmtN(montoSup)}</span></div>
    <div class="kv"><span>(-) Depositado / Transferido</span><span class="pos">${fmtN(f.depositado)}</span></div>
    <div class="kv balance"><span>BALANCE (próximo cuadre)</span><span class="${balance<0?'neg':'pos'}">${fmtN(balance)}</span></div>
  </div>
    </div>
  </div>

  ${(d.movimientos||[]).length>0?`
  <div class="section-title" style="margin-top:12px">Movimientos Intra-Semana (Préstamos / Pagos)</div>
  <table>
    <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th class="r">Monto</th></tr></thead>
    <tbody>${movRows}</tbody>
  </table>`:''}

  ${f.notas?`<div style="margin-top:10px;padding:8px;background:#f9f9f9;border:1px solid #ddd;font-size:11px"><b>Notas:</b> ${f.notas}</div>`:''}

  <div class="footer">LottoAdmin — Cuadre Semanal | Grupo ${d.grupo?.nombre||''} | ${d.periodo?.descripcion||''}</div>
  </body></html>`;

    const w = window.open('','_blank','width=1100,height=700');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  }

  function copyWhatsapp() {
    if (!cuadreData.value) return;
    const d = cuadreData.value;
    const f = cuadreFrm.value;
    const t = d.totals;
    const lines = [
      `📊 *CUADRE SEMANAL — GRUPO ${d.grupo?.nombre?.toUpperCase()}*`,
      `📅 ${d.periodo?.descripcion || d.periodo?.fecha_inicio + ' al ' + d.periodo?.fecha_fin}`,
      ``,
      `*BANCAS:*`,
      ...d.bancas.filter(b=>b.ventas>0).map(b =>
        `  • ${b.codigo} ${b.nombre}: Vtas ${fmt(b.ventas)} | Prem ${fmt(b.premios)} | Com ${b.porcentaje_comision}% | Res ${fmt(b.resultado_periodo)}`
      ),
      ``,
      `*RESUMEN:*`,
      `  Ventas:       ${fmt(t.ventas)}`,
      `  Premios:      ${fmt(t.premios)}`,
      `  Comisiones:   ${fmt(t.comisiones)}`,
      `  Gastos:       ${fmt(t.total_gastos)}`,
      `  Resultado:    ${fmt(t.resultado_periodo)}`,
      t.gasto_participacion > 0 ? `  Participación (${d.grupo?.porcentaje_participacion}%): ${fmt(t.gasto_participacion)}` : `  Sin participación (resultado negativo)`,
      t.gasto_participacion > 0 ? `  Neto Central: ${fmt(t.resultado_neto_central)}` : '',
      ``,
      `*BALANCE:*`,
      `  Balance anterior:  ${fmt(f.balance_anterior)}`,
      `  Total acumulado:   ${fmt(f.balance_anterior + t.resultado_periodo)}`,
      f.entregado_supervisor ? `  Préstamo dado:     ${fmt(f.entregado_supervisor)}` : '',
      f.entregado_central ? `  Recibido de sup:   ${fmt(f.entregado_central)}` : '',
      `  Total a depositar: ${fmt(calcTotalDepositar.value)}`,
      `  Depositado:        ${fmt(f.depositado)}`,
      `  *BALANCE FINAL:    ${fmt(calcBalanceFinal.value)}*`,
      f.notas ? `\n📝 ${f.notas}` : '',
    ].filter(l => l !== '').join('\n');

    navigator.clipboard.writeText(lines).then(() => {
      toast('📋 Copiado al portapapeles — pega en WhatsApp', 'success');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = lines; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      toast('📋 Copiado al portapapeles', 'success');
    });
  }

  return { cuadreGrupoId, cuadrePeriodoId, cuadreBancaId, cuadreData, cuadreFrm, savingCuadre, balanceAnteriorManual, arrastrePartManual, showMovRapido, movRapidoFrm, showReporte, calcTotalDepositar, calcMontoEntregaSupervisor, calcBalanceFinal, calcBaseParticipacion, calcParticipacion, loadCuadre, saveCuadre, irACuadre, irACuadreBanca, loadCuadreBanca, saveCuadreBanca, abrirMovRapido, saveMovRapido, printReport, copyWhatsapp }
}
