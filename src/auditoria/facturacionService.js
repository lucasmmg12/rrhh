import { supabase } from '../supabaseClient';

// ═══════════════════════════════════════════════════════════════
// FACTURACIÓN SEDE — Service Layer
// Queries para el Tablero Financiero y Métricas Operativas
// ═══════════════════════════════════════════════════════════════

/**
 * Obtiene toda la facturación de un rango de fechas
 */
export async function obtenerFacturacion(fechaDesde, fechaHasta, turno = null) {
  let query = supabase
    .from('facturacion_sede')
    .select('*')
    .gte('fecha', fechaDesde)
    .lte('fecha', fechaHasta)
    .order('fecha', { ascending: false });

  if (turno && turno !== 'todos') {
    query = query.eq('turno', turno);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Obtiene la lista de recepcionistas únicas
 */
export async function obtenerRecepcionistas() {
  const { data, error } = await supabase
    .from('facturacion_sede')
    .select('usuario_factura')
    .order('usuario_factura');

  if (error) throw error;

  // Distinct manual (Supabase no soporta DISTINCT directo en este caso)
  const unique = [...new Set((data || []).map(d => d.usuario_factura))];
  return unique.sort();
}

/**
 * Resumen financiero diario agrupado por recepcionista
 */
export function calcularResumenPorRecepcionista(datos) {
  const resumen = {};

  for (const row of datos) {
    const user = row.usuario_factura;
    if (!resumen[user]) {
      resumen[user] = {
        nombre: user,
        total_facturado: 0,
        total_cobrado: 0,
        cantidad_operaciones: 0,
        por_familia: {},
        por_servicio: {},
        dias_trabajados: new Set(),
      };
    }

    const r = resumen[user];
    r.total_facturado += Number(row.total_importe) || 0;
    r.total_cobrado += Number(row.cobrado_linea) || 0;
    r.cantidad_operaciones += 1;
    r.dias_trabajados.add(row.fecha);

    // Agrupar por familia
    const fam = row.familia || 'Sin familia';
    if (!r.por_familia[fam]) r.por_familia[fam] = { cantidad: 0, importe: 0 };
    r.por_familia[fam].cantidad += 1;
    r.por_familia[fam].importe += Number(row.total_importe) || 0;

    // Agrupar por servicio
    const srv = row.servicio || 'Sin servicio';
    if (!r.por_servicio[srv]) r.por_servicio[srv] = { cantidad: 0, importe: 0 };
    r.por_servicio[srv].cantidad += 1;
    r.por_servicio[srv].importe += Number(row.total_importe) || 0;
  }

  // Convertir Sets a count
  return Object.values(resumen).map(r => ({
    ...r,
    dias_trabajados: r.dias_trabajados.size,
  })).sort((a, b) => b.total_facturado - a.total_facturado);
}

/**
 * Métricas operativas: conteo de prácticas clave
 */
export function calcularMetricasOperativas(datos) {
  const metricas = {
    total_operaciones: datos.length,
    total_facturado: 0,
    total_cobrado: 0,
    pacientes_unicos: new Set(),
    por_familia: {},
    por_servicio: {},
    por_dia: {},
    por_turno: { mañana: { cantidad: 0, importe: 0 }, tarde: { cantidad: 0, importe: 0 } },
  };

  for (const row of datos) {
    metricas.total_facturado += Number(row.total_importe) || 0;
    metricas.total_cobrado += Number(row.cobrado_linea) || 0;

    if (row.paciente_nif) metricas.pacientes_unicos.add(row.paciente_nif);

    // Por familia
    const fam = row.familia || 'Sin familia';
    if (!metricas.por_familia[fam]) metricas.por_familia[fam] = { cantidad: 0, importe: 0 };
    metricas.por_familia[fam].cantidad += 1;
    metricas.por_familia[fam].importe += Number(row.total_importe) || 0;

    // Por servicio
    const srv = row.servicio || 'Sin servicio';
    if (!metricas.por_servicio[srv]) metricas.por_servicio[srv] = { cantidad: 0, importe: 0 };
    metricas.por_servicio[srv].cantidad += 1;
    metricas.por_servicio[srv].importe += Number(row.total_importe) || 0;

    // Por día
    if (!metricas.por_dia[row.fecha]) metricas.por_dia[row.fecha] = { cantidad: 0, importe: 0, pacientes: new Set() };
    metricas.por_dia[row.fecha].cantidad += 1;
    metricas.por_dia[row.fecha].importe += Number(row.total_importe) || 0;
    if (row.paciente_nif) metricas.por_dia[row.fecha].pacientes.add(row.paciente_nif);

    // Por turno
    const turno = row.turno || 'mañana';
    if (metricas.por_turno[turno]) {
      metricas.por_turno[turno].cantidad += 1;
      metricas.por_turno[turno].importe += Number(row.total_importe) || 0;
    }
  }

  // Convertir Sets
  metricas.pacientes_unicos = metricas.pacientes_unicos.size;
  for (const dia of Object.values(metricas.por_dia)) {
    dia.pacientes = dia.pacientes.size;
  }

  return metricas;
}

/**
 * Facturación de un día específico por recepcionista
 */
export async function obtenerFacturacionDiaria(fecha, turno = null) {
  const data = await obtenerFacturacion(fecha, fecha, turno);
  return calcularResumenPorRecepcionista(data);
}
