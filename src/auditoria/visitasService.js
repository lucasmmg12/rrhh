import { supabase } from '../supabaseClient';

// ═══════════════════════════════════════════════════════════════
// VISITAS SEDE — Service Layer v2
// Fuente: VLISE_Visitas → visitas_sede (Supabase)
// Métricas expandidas: OS, Responsable, Heatmap, Productividad
// ═══════════════════════════════════════════════════════════════

/**
 * Obtiene visitas para un rango de fechas
 */
export async function obtenerVisitas(fechaDesde, fechaHasta) {
  // Supabase limits to 1000 rows by default, so we paginate to get ALL
  const PAGE_SIZE = 5000;
  let allData = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('visitas_sede')
      .select('*')
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)
      .order('fecha', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      from += PAGE_SIZE;
      if (data.length < PAGE_SIZE) hasMore = false;
    }
  }

  return allData;
}

/**
 * Calcula métricas analíticas de visitas — v2 expandido
 */
export function calcularMetricasVisitas(datos) {
  const metricas = {
    total_visitas: datos.length,
    pacientes_unicos: new Set(),
    por_usuario: {},
    por_especialidad: {},
    por_tipo_visita: {},
    por_dia: {},
    por_cliente: {},
    por_responsable: {},
    // ── v2: nuevas dimensiones ──
    por_dia_semana: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }, // dom-sab
    por_usuario_dia: {}, // { usuario: { fecha: count } }
    top_combos_usr_esp: {}, // { "usuario|especialidad": count }
    por_cliente_especialidad: {}, // { cliente: { especialidades } }
  };

  for (const row of datos) {
    if (row.id_paciente) metricas.pacientes_unicos.add(row.id_paciente);

    // Por usuario creación (colaborador)
    const usr = row.usuario_creacion || 'Sin usuario';
    if (!metricas.por_usuario[usr]) metricas.por_usuario[usr] = { cantidad: 0, por_dia: {}, por_especialidad: {}, por_cliente: {} };
    metricas.por_usuario[usr].cantidad += 1;
    if (row.fecha) {
      metricas.por_usuario[usr].por_dia[row.fecha] = (metricas.por_usuario[usr].por_dia[row.fecha] || 0) + 1;
    }
    if (row.especialidad) {
      metricas.por_usuario[usr].por_especialidad[row.especialidad] = 
        (metricas.por_usuario[usr].por_especialidad[row.especialidad] || 0) + 1;
    }
    // OS por usuario
    const cli = row.cliente || 'Sin OS';
    if (!metricas.por_usuario[usr].por_cliente) metricas.por_usuario[usr].por_cliente = {};
    metricas.por_usuario[usr].por_cliente[cli] = (metricas.por_usuario[usr].por_cliente[cli] || 0) + 1;

    // Por especialidad
    const esp = row.especialidad || 'Sin especialidad';
    if (!metricas.por_especialidad[esp]) metricas.por_especialidad[esp] = { cantidad: 0 };
    metricas.por_especialidad[esp].cantidad += 1;

    // Por tipo visita
    const tv = row.tipo_visita || 'Sin tipo';
    if (!metricas.por_tipo_visita[tv]) metricas.por_tipo_visita[tv] = { cantidad: 0 };
    metricas.por_tipo_visita[tv].cantidad += 1;

    // Por día
    if (row.fecha) {
      if (!metricas.por_dia[row.fecha]) metricas.por_dia[row.fecha] = { cantidad: 0, pacientes: new Set() };
      metricas.por_dia[row.fecha].cantidad += 1;
      if (row.id_paciente) metricas.por_dia[row.fecha].pacientes.add(row.id_paciente);

      // Día de la semana
      const dow = new Date(row.fecha + 'T12:00:00').getDay();
      metricas.por_dia_semana[dow] += 1;
    }

    // Por cliente (obra social)
    if (!metricas.por_cliente[cli]) metricas.por_cliente[cli] = { cantidad: 0, especialidades: {} };
    metricas.por_cliente[cli].cantidad += 1;
    if (row.especialidad) {
      metricas.por_cliente[cli].especialidades[row.especialidad] = 
        (metricas.por_cliente[cli].especialidades[row.especialidad] || 0) + 1;
    }

    // Por responsable (médico)
    const resp = row.responsable || 'Sin responsable';
    if (!metricas.por_responsable[resp]) metricas.por_responsable[resp] = { cantidad: 0, especialidades: {}, pacientes: new Set() };
    metricas.por_responsable[resp].cantidad += 1;
    if (row.especialidad) {
      metricas.por_responsable[resp].especialidades[row.especialidad] = 
        (metricas.por_responsable[resp].especialidades[row.especialidad] || 0) + 1;
    }
    if (row.id_paciente) metricas.por_responsable[resp].pacientes.add(row.id_paciente);

    // v2: Combo usuario-especialidad
    const comboKey = `${usr}|${esp}`;
    metricas.top_combos_usr_esp[comboKey] = (metricas.top_combos_usr_esp[comboKey] || 0) + 1;
  }

  // Convertir Sets
  metricas.pacientes_unicos = metricas.pacientes_unicos.size;
  for (const dia of Object.values(metricas.por_dia)) {
    dia.pacientes = dia.pacientes.size;
  }
  for (const resp of Object.values(metricas.por_responsable)) {
    resp.pacientes_unicos = resp.pacientes.size;
    delete resp.pacientes;
  }

  // Calcular promedios
  const diasConDatos = Object.keys(metricas.por_dia).length;
  metricas.promedio_diario = diasConDatos > 0 ? Math.round(metricas.total_visitas / diasConDatos) : 0;

  // Día pico
  let maxDia = { fecha: '-', cantidad: 0 };
  for (const [fecha, data] of Object.entries(metricas.por_dia)) {
    if (data.cantidad > maxDia.cantidad) maxDia = { fecha, cantidad: data.cantidad };
  }
  metricas.dia_pico = maxDia;

  return metricas;
}

/**
 * Trigger sync from the RRHH sync-server
 * @param {'visitas' | 'facturacion' | 'all'} type
 */
export async function triggerSync(type = 'visitas') {
  const SYNC_URL = 'http://localhost:3457';
  const endpoint = type === 'all' ? '/api/rrhh/sync-all'
    : type === 'facturacion' ? '/api/rrhh/sync/facturacion'
    : '/api/rrhh/sync/visitas';

  try {
    const res = await fetch(`${SYNC_URL}${endpoint}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Error triggering sync:', err);
    return { success: false, error: 'Sync server no disponible en localhost:3457' };
  }
}

/**
 * Check sync server health
 */
export async function checkSyncHealth() {
  try {
    const res = await fetch('http://localhost:3457/api/rrhh/health', { signal: AbortSignal.timeout(3000) });
    return await res.json();
  } catch {
    return { success: false, connected: false, error: 'Sync server offline' };
  }
}
