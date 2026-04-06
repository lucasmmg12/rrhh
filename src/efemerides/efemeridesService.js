import { supabase } from '../supabaseClient';

/**
 * Obtener efemérides para un rango de fechas
 */
export async function obtenerEfemerides(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from('rrhh_efemerides')
    .select('*, colaborador:fichadas_colaboradores(id, nombre_completo, area)')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Obtener efemérides de un mes/año específico
 */
export async function obtenerEfemerides_Mes(year, month) {
  const inicio = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const ultimoDia = new Date(year, month + 1, 0).getDate();
  const fin = `${year}-${String(month + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  return obtenerEfemerides(inicio, fin);
}

/**
 * Crear nueva efeméride
 */
export async function crearEfemeride(efemeride) {
  const { data, error } = await supabase
    .from('rrhh_efemerides')
    .insert([efemeride])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualizar efeméride
 */
export async function actualizarEfemeride(id, updates) {
  const { data, error } = await supabase
    .from('rrhh_efemerides')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Eliminar efeméride
 */
export async function eliminarEfemeride(id) {
  const { error } = await supabase
    .from('rrhh_efemerides')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Obtener cumpleaños del mes (de fichadas_colaboradores)
 */
export async function obtenerCumpleañosMes(month) {
  // Los cumpleaños se buscan por mes (sin importar el año)
  const { data, error } = await supabase
    .from('fichadas_colaboradores')
    .select('id, nombre_completo, area, fecha_nacimiento')
    .not('fecha_nacimiento', 'is', null);

  if (error) throw error;

  // Filtrar por mes en JavaScript (Supabase no soporta EXTRACT en .filter)
  return (data || []).filter(c => {
    if (!c.fecha_nacimiento) return false;
    const d = new Date(c.fecha_nacimiento + 'T00:00:00');
    return d.getMonth() === month;
  });
}

/**
 * Obtener próximos cumpleaños (para los próximos N días)
 */
export async function obtenerProximosCumpleaños(dias = 30) {
  const { data, error } = await supabase
    .from('fichadas_colaboradores')
    .select('id, nombre_completo, area, fecha_nacimiento')
    .not('fecha_nacimiento', 'is', null);

  if (error) throw error;

  const hoy = new Date();
  const limite = new Date();
  limite.setDate(hoy.getDate() + dias);

  return (data || []).filter(c => {
    if (!c.fecha_nacimiento) return false;
    const nacimiento = new Date(c.fecha_nacimiento + 'T00:00:00');
    // Crear fecha de cumpleaños este año
    const cumple = new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
    // Si ya pasó, verificar el próximo año
    if (cumple < hoy) cumple.setFullYear(cumple.getFullYear() + 1);
    return cumple >= hoy && cumple <= limite;
  }).sort((a, b) => {
    const da = new Date(a.fecha_nacimiento + 'T00:00:00');
    const db = new Date(b.fecha_nacimiento + 'T00:00:00');
    const ca = new Date(hoy.getFullYear(), da.getMonth(), da.getDate());
    const cb = new Date(hoy.getFullYear(), db.getMonth(), db.getDate());
    if (ca < hoy) ca.setFullYear(ca.getFullYear() + 1);
    if (cb < hoy) cb.setFullYear(cb.getFullYear() + 1);
    return ca - cb;
  });
}
