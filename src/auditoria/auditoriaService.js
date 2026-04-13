/**
 * Auditoría Service — Supabase CRUD
 * Handles all database operations for the audit module
 */
import { supabase } from '../supabaseClient';

// ─── SECTORS ────────────────────────────────────────────────────
export const SECTORES = [
  { value: 'santa_fe_sector_1', label: 'Sede Santa Fe - Sector 1' },
  { value: 'santa_fe_sector_2', label: 'Sede Santa Fe - Sector 2' },
  { value: 'dxi', label: 'DXI (Mamografía, Densitometría, Ecografías y RX)' },
  { value: 'citologia', label: 'Citología' },
  { value: 'seguridad_patrimonial', label: 'Seguridad Patrimonial' },
];

// ─── CHECKLIST TEMPLATE ─────────────────────────────────────────
export const CHECKLIST_TEMPLATE = [
  {
    categoria: 'presentacion',
    label: 'Presentación y Personal',
    icon: '👤',
    items: [
      { key: 'uniforme', label: 'Uniforme: Completo, limpio e identificado' },
      { key: 'presentacion', label: 'Presentación: Higiene adecuada' },
      { key: 'trato', label: 'Trato al paciente: Amable y respetuoso' },
    ],
  },
  {
    categoria: 'operativo',
    label: 'Funcionamiento Operativo',
    icon: '⚙️',
    items: [
      { key: 'sistemas', label: 'Sistemas: Sin caídas en la jornada' },
      { key: 'equipamiento', label: 'Equipamiento: Operativo y disponible' },
      { key: 'turnos_wa', label: 'Turnos/WhatsApp: Respuesta en tiempo adecuado' },
    ],
  },
  {
    categoria: 'organizacion',
    label: 'Organización del Servicio',
    icon: '📋',
    items: [
      { key: 'dotacion', label: 'Dotación: Adecuada a la demanda' },
      { key: 'tiempo_espera', label: 'Tiempo de espera: < 20 minutos' },
      { key: 'distribucion', label: 'Distribución: Cobertura completa' },
    ],
  },
  {
    categoria: 'infraestructura',
    label: 'Infraestructura',
    icon: '🏗️',
    items: [
      { key: 'limpieza', label: 'Limpieza: Espacios limpios y ordenados' },
      { key: 'mantenimiento', label: 'Mantenimiento: Sin fallas visibles' },
      { key: 'carteleria', label: 'Cartelería: Visible y actualizada' },
    ],
  },
  {
    categoria: 'hoteleria',
    label: 'Auxiliares de Hotelería',
    icon: '🧹',
    items: [
      { key: 'hot_presencia', label: 'Presencia de auxiliar en el sector' },
      { key: 'hot_limpieza_sala', label: 'Limpieza de salas de espera' },
      { key: 'hot_limpieza_consultorios', label: 'Limpieza de consultorios' },
      { key: 'hot_limpieza_banios', label: 'Limpieza de baños' },
      { key: 'hot_reposicion', label: 'Reposición de insumos (papel, jabón, alcohol)' },
      { key: 'hot_residuos', label: 'Retiro de residuos en tiempo y forma' },
      { key: 'hot_uniforme', label: 'Uniforme: Completo e identificado' },
      { key: 'hot_actitud', label: 'Actitud proactiva y disposición al servicio' },
    ],
  },
];

// ─── AUXILIARES DE HOTELERÍA (rotativas entre sectores) ─────────
export const AUXILIARES_HOTELERIA = [
  'Aguirre, María L.',
  'Álvarez, Lucía',
  'Benítez, Carolina',
  'Cabrera, Romina',
  'Castro, Natalia',
  'Díaz, Paola',
  'Fernández, Analía',
  'García, Cintia',
  'Gómez, Laura',
  'González, Silvia',
  'Gutiérrez, Valeria',
  'Hernández, Mónica',
  'López, Andrea',
  'Martínez, Gabriela',
  'Medina, Florencia',
  'Molina, Yanina',
  'Morales, Patricia',
  'Núñez, Daniela',
  'Pérez, Marcela',
  'Ramírez, Sandra',
  'Rodríguez, Mariela',
  'Romero, Claudia',
  'Ruiz, Cecilia',
  'Sánchez, Verónica',
  'Torres, Alejandra',
];

// 12 items originales (4 categorías × 3 items) + 8 items hotelería = 20 items × 2 pts = 40
export const MAX_PUNTOS = 40;

// ─── SCORING ────────────────────────────────────────────────────
export function calcularResultado(items) {
  const total = Object.values(items).reduce((sum, item) => sum + (item.puntuacion ?? 0), 0);
  const porcentaje = Math.round((total / MAX_PUNTOS) * 100 * 100) / 100;
  let evaluacion = 'critico';
  if (porcentaje >= 85) evaluacion = 'bueno';
  else if (porcentaje >= 60) evaluacion = 'regular';
  return { total, porcentaje, evaluacion };
}

// ─── CRUD: AUDITORÍAS ───────────────────────────────────────────
export async function crearAuditoria(auditoria, items, planes) {
  // 1. Insert main audit record
  const { data: audit, error: auditError } = await supabase
    .from('auditorias')
    .insert({
      fecha: auditoria.fecha,
      turno: auditoria.turno,
      sede: auditoria.sede,
      sector: auditoria.sector,
      responsable_presente: auditoria.responsable_presente,
      auxiliar_hoteleria: auditoria.auxiliar_hoteleria || null,
      auditor_nombre: auditoria.auditor_nombre,
      total_puntos: auditoria.total_puntos,
      max_puntos: MAX_PUNTOS,
      porcentaje: auditoria.porcentaje,
      evaluacion: auditoria.evaluacion,
      no_conformidades: auditoria.no_conformidades,
      oportunidades_mejora: auditoria.oportunidades_mejora,
    })
    .select()
    .single();

  if (auditError) throw auditError;

  // 2. Insert checklist items
  const itemRows = Object.entries(items).map(([key, item]) => ({
    auditoria_id: audit.id,
    categoria: item.categoria,
    item_key: key,
    item_label: item.label,
    puntuacion: item.puntuacion ?? 0,
    observaciones: item.observaciones || null,
  }));

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase
      .from('auditoria_items')
      .insert(itemRows);
    if (itemsError) throw itemsError;
  }

  // 3. Insert action plans
  if (planes && planes.length > 0) {
    const planRows = planes.map(plan => ({
      auditoria_id: audit.id,
      hallazgo: plan.hallazgo,
      prioridad: plan.prioridad,
      accion: plan.accion,
      responsable: plan.responsable,
      fecha_limite: plan.fecha_limite || null,
      estado: 'pendiente',
    }));

    const { error: planesError } = await supabase
      .from('auditoria_planes_accion')
      .insert(planRows);
    if (planesError) throw planesError;
  }

  return audit;
}

export async function obtenerAuditorias(filtros = {}) {
  let query = supabase
    .from('auditorias')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  if (filtros.sector) query = query.eq('sector', filtros.sector);
  if (filtros.fechaDesde) query = query.gte('fecha', filtros.fechaDesde);
  if (filtros.fechaHasta) query = query.lte('fecha', filtros.fechaHasta);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function obtenerAuditoriaCompleta(id) {
  const [auditRes, itemsRes, planesRes] = await Promise.all([
    supabase.from('auditorias').select('*').eq('id', id).single(),
    supabase.from('auditoria_items').select('*').eq('auditoria_id', id).order('created_at'),
    supabase.from('auditoria_planes_accion').select('*').eq('auditoria_id', id).order('created_at'),
  ]);

  if (auditRes.error) throw auditRes.error;
  return {
    ...auditRes.data,
    items: itemsRes.data || [],
    planes: planesRes.data || [],
  };
}

// ─── SEGUIMIENTO: Planes de acción anteriores ───────────────────
export async function obtenerPlanesAnteriores(sector, auditoriaActualId = null) {
  // Get the most recent audit for this sector (excluding current one)
  let query = supabase
    .from('auditorias')
    .select('id, fecha')
    .eq('sector', sector)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);

  if (auditoriaActualId) {
    query = query.neq('id', auditoriaActualId);
  }

  const { data: prevAudits, error: prevError } = await query;
  if (prevError) throw prevError;
  if (!prevAudits || prevAudits.length === 0) return [];

  const prevAuditId = prevAudits[0].id;

  // Get action plans from that audit that are NOT resolved
  const { data: planes, error: planesError } = await supabase
    .from('auditoria_planes_accion')
    .select('*')
    .eq('auditoria_id', prevAuditId)
    .in('estado', ['pendiente', 'en_proceso', 'no_resuelto'])
    .order('created_at');

  if (planesError) throw planesError;
  return planes || [];
}

export async function actualizarEstadoPlan(planId, estado, auditoriaSegId) {
  const { error } = await supabase
    .from('auditoria_planes_accion')
    .update({
      estado,
      auditoria_seguimiento_id: auditoriaSegId || null,
      fecha_actualizacion: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId);

  if (error) throw error;
}

// ─── RESPONSABLES: Autocompletar desde Fichadas ─────────────────
export async function obtenerColaboradoresPorArea(area) {
  if (!area) return [];
  const { data, error } = await supabase
    .from('fichadas_colaboradores')
    .select('id, nombre_completo, area')
    .eq('activo', true)
    .order('nombre_completo');

  if (error) throw error;
  return data || [];
}

export async function obtenerTodosColaboradores() {
  const { data, error } = await supabase
    .from('fichadas_colaboradores')
    .select('id, nombre_completo, area')
    .eq('activo', true)
    .order('nombre_completo');

  if (error) throw error;
  return data || [];
}

// ─── EDITAR AUDITORÍA ───────────────────────────────────────────
export async function editarAuditoria(id, auditoria, items, planes) {
  // 1. Update main audit record
  const { error: auditError } = await supabase
    .from('auditorias')
    .update({
      fecha: auditoria.fecha,
      turno: auditoria.turno,
      sede: auditoria.sede,
      sector: auditoria.sector,
      responsable_presente: auditoria.responsable_presente,
      auxiliar_hoteleria: auditoria.auxiliar_hoteleria || null,
      auditor_nombre: auditoria.auditor_nombre,
      total_puntos: auditoria.total_puntos,
      max_puntos: MAX_PUNTOS,
      porcentaje: auditoria.porcentaje,
      evaluacion: auditoria.evaluacion,
      no_conformidades: auditoria.no_conformidades,
      oportunidades_mejora: auditoria.oportunidades_mejora,
    })
    .eq('id', id);

  if (auditError) throw auditError;

  // 2. Replace items: delete old + insert new
  const { error: delItemsErr } = await supabase
    .from('auditoria_items')
    .delete()
    .eq('auditoria_id', id);
  if (delItemsErr) throw delItemsErr;

  const itemRows = Object.entries(items).map(([key, item]) => ({
    auditoria_id: id,
    categoria: item.categoria,
    item_key: key,
    item_label: item.label,
    puntuacion: item.puntuacion ?? 0,
    observaciones: item.observaciones || null,
  }));

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase
      .from('auditoria_items')
      .insert(itemRows);
    if (itemsError) throw itemsError;
  }

  // 3. Replace plans: delete old + insert new
  const { error: delPlansErr } = await supabase
    .from('auditoria_planes_accion')
    .delete()
    .eq('auditoria_id', id);
  if (delPlansErr) throw delPlansErr;

  if (planes && planes.length > 0) {
    const planRows = planes.map(plan => ({
      auditoria_id: id,
      hallazgo: plan.hallazgo,
      prioridad: plan.prioridad,
      accion: plan.accion,
      responsable: plan.responsable,
      fecha_limite: plan.fecha_limite || null,
      estado: plan.estado || 'pendiente',
    }));

    const { error: planesError } = await supabase
      .from('auditoria_planes_accion')
      .insert(planRows);
    if (planesError) throw planesError;
  }

  return { id };
}

// ─── ELIMINAR AUDITORÍA ─────────────────────────────────────────
export async function eliminarAuditoria(id) {
  // Cascade: items → planes → audit
  const { error: delItems } = await supabase
    .from('auditoria_items')
    .delete()
    .eq('auditoria_id', id);
  if (delItems) throw delItems;

  const { error: delPlans } = await supabase
    .from('auditoria_planes_accion')
    .delete()
    .eq('auditoria_id', id);
  if (delPlans) throw delPlans;

  const { error: delAudit } = await supabase
    .from('auditorias')
    .delete()
    .eq('id', id);
  if (delAudit) throw delAudit;

  return true;
}
