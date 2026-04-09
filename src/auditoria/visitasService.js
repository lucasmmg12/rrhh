import { supabase } from '../supabaseClient';

// ═══════════════════════════════════════════════════════════════
// VISITAS SEDE — Service Layer
// Fuente: VLISE_Visitas → visitas_sede (Supabase)
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
 * Calcula métricas analíticas de visitas
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
  };

  for (const row of datos) {
    if (row.id_paciente) metricas.pacientes_unicos.add(row.id_paciente);

    // Por usuario creación (colaborador)
    const usr = row.usuario_creacion || 'Sin usuario';
    if (!metricas.por_usuario[usr]) metricas.por_usuario[usr] = { cantidad: 0, por_dia: {}, por_especialidad: {} };
    metricas.por_usuario[usr].cantidad += 1;
    if (row.fecha) {
      metricas.por_usuario[usr].por_dia[row.fecha] = (metricas.por_usuario[usr].por_dia[row.fecha] || 0) + 1;
    }
    if (row.especialidad) {
      metricas.por_usuario[usr].por_especialidad[row.especialidad] = 
        (metricas.por_usuario[usr].por_especialidad[row.especialidad] || 0) + 1;
    }

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
    }

    // Por cliente (obra social)
    const cli = row.cliente || 'Sin OS';
    if (!metricas.por_cliente[cli]) metricas.por_cliente[cli] = { cantidad: 0 };
    metricas.por_cliente[cli].cantidad += 1;

    // Por responsable (médico)
    const resp = row.responsable || 'Sin responsable';
    if (!metricas.por_responsable[resp]) metricas.por_responsable[resp] = { cantidad: 0 };
    metricas.por_responsable[resp].cantidad += 1;
  }

  // Convertir Sets
  metricas.pacientes_unicos = metricas.pacientes_unicos.size;
  for (const dia of Object.values(metricas.por_dia)) {
    dia.pacientes = dia.pacientes.size;
  }

  return metricas;
}
