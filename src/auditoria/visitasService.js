import { supabase } from '../supabaseClient';

// ═══════════════════════════════════════════════════════════════
// VISITAS SEDE — Service Layer v2
// Fuente: VLISE_Visitas → visitas_sede (Supabase)
// Métricas expandidas: OS, Responsable, Heatmap, Productividad
// ═══════════════════════════════════════════════════════════════

// ── MAPEO DE SECTORES OPERATIVOS ──
// Cada colaborador pertenece a un sector fijo
export const SECTOR_MAP = {
  // SECTOR 1
  'JACQUES VIRGINIA': 'SECTOR 1',
  'VIRGINIA JACQUES': 'SECTOR 1',
  'APARICIO EMILCE': 'SECTOR 1',
  'EMILCE APARICIO': 'SECTOR 1',
  'MORALES MALEN': 'SECTOR 1',
  'MALEN MORALES': 'SECTOR 1',
  // SECTOR 2
  'ATENCIO EVELYN': 'SECTOR 2',
  'EVELYN ATENCIO': 'SECTOR 2',
  'QUINTERO JULIETA': 'SECTOR 2',
  'JULIETA QUINTERO': 'SECTOR 2',
  'FIGUEROA ERICA': 'SECTOR 2',
  'FIGUEROA ÉRICA': 'SECTOR 2',
  'ERICA FIGUEROA': 'SECTOR 2',
  'ÉRICA FIGUEROA': 'SECTOR 2',
  // CITOLOGÍA
  'VEDIA ROMINA': 'CITOLOGÍA',
  'ROMINA VEDIA': 'CITOLOGÍA',
  'DI VIRGILIO MICAELA': 'CITOLOGÍA',
  'MICAELA DI VIRGILIO': 'CITOLOGÍA',
  'MESINA CARLA': 'CITOLOGÍA',
  'CARLA MESINA': 'CITOLOGÍA',
  // DIAGNÓSTICO (ecografías, mamografías, densitometrías)
  'PEREZ YANINA': 'DIAGNÓSTICO',
  'PÉREZ YANINA': 'DIAGNÓSTICO',
  'YANINA PEREZ': 'DIAGNÓSTICO',
  'YANINA PÉREZ': 'DIAGNÓSTICO',
  'DIAZ DANIELA': 'DIAGNÓSTICO',
  'DÍAZ DANIELA': 'DIAGNÓSTICO',
  'DANIELA DIAZ': 'DIAGNÓSTICO',
  'DANIELA DÍAZ': 'DIAGNÓSTICO',
  'GORDILLO MONICA': 'DIAGNÓSTICO',
  'GORDILLO MÓNICA': 'DIAGNÓSTICO',
  'MONICA GORDILLO': 'DIAGNÓSTICO',
  'MÓNICA GORDILLO': 'DIAGNÓSTICO',
  'ESPEJO CRISTINA': 'DIAGNÓSTICO',
  'CRISTINA ESPEJO': 'DIAGNÓSTICO',
  'RUARTE DAIANA': 'DIAGNÓSTICO',
  'DAIANA RUARTE': 'DIAGNÓSTICO',
};

// Especialidades que pertenecen al sector DIAGNÓSTICO
// (para agrupar ecografías, mamografías, densitometrías bajo un solo nombre)
export const DIAGNOSTICO_ESPECIALIDADES = [
  'ECOGRAFIA', 'ECOGRAFÍA', 'ECOGRAFIAS', 'ECOGRAFÍAS',
  'MAMOGRAFIA', 'MAMOGRAFÍA', 'MAMOGRAFIAS', 'MAMOGRAFÍAS',
  'MAMOGRAFÍA Y DENSITOGRAFÍA', 'MAMOGRAFIA Y DENSITOGRAFIA',
  'DENSITOMETRIA', 'DENSITOMETRÍA', 'DENSITOMETRIAS', 'DENSITOMETRÍAS',
  'DENSITOGRAFIA', 'DENSITOGRAFÍA',
  'DXI',
];

/**
 * Resuelve el sector de un colaborador por nombre
 */
export function resolverSector(nombreUsuario) {
  if (!nombreUsuario) return 'SIN SECTOR';
  const key = nombreUsuario.trim().toUpperCase();
  return SECTOR_MAP[key] || 'OTROS';
}

/**
 * Verifica si una especialidad pertenece a DIAGNÓSTICO
 */
export function esDiagnostico(especialidad) {
  if (!especialidad) return false;
  return DIAGNOSTICO_ESPECIALIDADES.includes(especialidad.trim().toUpperCase());
}

/**
 * Calcula métricas agrupadas por sector operativo
 */
export function calcularMetricasPorSector(datos) {
  const sectores = {};
  const SECTOR_COLORS = {
    'SECTOR 1': '#3b82f6',
    'SECTOR 2': '#10b981',
    'CITOLOGÍA': '#8b5cf6',
    'DIAGNÓSTICO': '#f59e0b',
    'OTROS': '#94a3b8',
    'SIN SECTOR': '#cbd5e1',
  };

  for (const row of datos) {
    const usuario = row.usuario_creacion || 'Sin usuario';
    const sector = resolverSector(usuario);

    if (!sectores[sector]) {
      sectores[sector] = {
        nombre: sector,
        color: SECTOR_COLORS[sector] || '#64748b',
        total: 0,
        pacientes: new Set(),
        por_usuario: {},
        por_especialidad: {},
        por_dia: {},
        por_cliente: {},
        dias_activos: new Set(),
      };
    }

    const s = sectores[sector];
    s.total += 1;
    if (row.id_paciente) s.pacientes.add(row.id_paciente);
    if (row.fecha) s.dias_activos.add(row.fecha);

    // Por usuario dentro del sector
    if (!s.por_usuario[usuario]) {
      s.por_usuario[usuario] = { cantidad: 0, por_dia: {}, por_especialidad: {} };
    }
    s.por_usuario[usuario].cantidad += 1;
    if (row.fecha) {
      s.por_usuario[usuario].por_dia[row.fecha] = (s.por_usuario[usuario].por_dia[row.fecha] || 0) + 1;
      s.por_dia[row.fecha] = (s.por_dia[row.fecha] || 0) + 1;
    }

    // Especialidad (normalizar diagnóstico)
    let esp = row.especialidad || 'Sin especialidad';
    if (esDiagnostico(esp)) esp = 'DIAGNÓSTICO POR IMAGEN';
    if (!s.por_especialidad[esp]) s.por_especialidad[esp] = 0;
    s.por_especialidad[esp] += 1;
    if (row.especialidad) {
      s.por_usuario[usuario].por_especialidad[esp] = (s.por_usuario[usuario].por_especialidad[esp] || 0) + 1;
    }

    // Cliente/OS
    const cli = row.cliente || 'Sin OS';
    if (!s.por_cliente[cli]) s.por_cliente[cli] = 0;
    s.por_cliente[cli] += 1;
  }

  // Convertir Sets y calcular promedios
  const result = Object.values(sectores).map(s => ({
    ...s,
    pacientes_unicos: s.pacientes.size,
    pacientes: undefined,
    dias_activos: s.dias_activos.size,
    promedio_diario: s.dias_activos.size > 0 ? Math.round(s.total / s.dias_activos.size) : 0,
    usuarios: Object.entries(s.por_usuario)
      .map(([nombre, data]) => ({
        nombre,
        cantidad: data.cantidad,
        dias_activos: Object.keys(data.por_dia).length,
        promedio_diario: Object.keys(data.por_dia).length > 0
          ? Math.round(data.cantidad / Object.keys(data.por_dia).length)
          : 0,
        por_especialidad: data.por_especialidad,
      }))
      .sort((a, b) => b.cantidad - a.cantidad),
    top_especialidades: Object.entries(s.por_especialidad)
      .sort((a, b) => b[1] - a[1]),
    top_clientes: Object.entries(s.por_cliente)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
  }));

  // Ordenar: Sectores fijos primero, OTROS al final
  const ORDER = ['SECTOR 1', 'SECTOR 2', 'CITOLOGÍA', 'DIAGNÓSTICO', 'OTROS', 'SIN SECTOR'];
  result.sort((a, b) => {
    const ia = ORDER.indexOf(a.nombre);
    const ib = ORDER.indexOf(b.nombre);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return result;
}

/**
 * Obtiene visitas para un rango de fechas
 */
export async function obtenerVisitas(fechaDesde, fechaHasta) {
  // Supabase limits to 1000 rows by default — PAGE_SIZE must be <= that limit
  const PAGE_SIZE = 1000;
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
