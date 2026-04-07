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

// ─── ATTACHMENTS ───

/**
 * Obtener adjuntos de una efeméride
 */
export async function getAdjuntos(efemeride_id) {
  const { data, error } = await supabase
    .from('rrhh_efemerides_adjuntos')
    .select('*')
    .eq('efemeride_id', efemeride_id)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Subir archivo adjunto a una efeméride
 */
export async function uploadAdjunto(efemeride_id, file) {
  const filePath = `efemerides/${efemeride_id}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('efemerides-attachments')
    .upload(filePath, file);
  if (uploadError) throw uploadError;

  const { data: meta, error: metaError } = await supabase
    .from('rrhh_efemerides_adjuntos')
    .insert({
      efemeride_id,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: filePath,
    })
    .select()
    .single();
  if (metaError) throw metaError;
  return meta;
}

/**
 * Eliminar adjunto
 */
export async function deleteAdjunto(adjunto) {
  await supabase.storage
    .from('efemerides-attachments')
    .remove([adjunto.storage_path]);

  const { error } = await supabase
    .from('rrhh_efemerides_adjuntos')
    .delete()
    .eq('id', adjunto.id);
  if (error) throw error;
}

/**
 * URL pública de un adjunto
 */
export function getAdjuntoUrl(storagePath) {
  const { data } = supabase.storage
    .from('efemerides-attachments')
    .getPublicUrl(storagePath, { download: true });
  return data?.publicUrl;
}

/**
 * URL firmada para descarga con nombre original
 */
export async function getSignedDownloadUrl(storagePath, fileName) {
  const { data, error } = await supabase.storage
    .from('efemerides-attachments')
    .createSignedUrl(storagePath, 3600, { download: fileName || true });
  if (error) throw error;
  return data?.signedUrl;
}
