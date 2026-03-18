/**
 * Fichadas Database Service
 * Handles all Supabase operations for the fichadas module
 */
import { supabase } from '../supabaseClient';

// ─── IMPORTACIONES ───────────────────────────────────────────────
export async function crearImportacion({ nombre_archivo, area, periodo_mes, periodo_anio, total_colaboradores, total_registros }) {
  const { data, error } = await supabase
    .from('fichadas_importaciones')
    .insert({
      nombre_archivo,
      area,
      periodo_mes,
      periodo_anio,
      total_colaboradores,
      total_registros,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listarImportaciones() {
  const { data, error } = await supabase
    .from('fichadas_importaciones')
    .select('*')
    .order('fecha_importacion', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function eliminarImportacion(id) {
  // First delete totales linked to this import
  await supabase.from('fichadas_totales_mensuales').delete().eq('importacion_id', id);
  // Then delete registros
  await supabase.from('fichadas_registros').delete().eq('importacion_id', id);
  // Finally delete the import itself
  const { error } = await supabase.from('fichadas_importaciones').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Delete ALL previous imports for the same area+period to avoid conflicts
 */
async function limpiarImportacionesPrevias(area, periodo_mes, periodo_anio) {
  // Find previous imports for this area/period
  const { data: prevImports } = await supabase
    .from('fichadas_importaciones')
    .select('id')
    .eq('area', area)
    .eq('periodo_mes', periodo_mes)
    .eq('periodo_anio', periodo_anio);

  if (prevImports && prevImports.length > 0) {
    const ids = prevImports.map(i => i.id);
    console.log(`[Service] Cleaning ${ids.length} previous imports for ${area} ${periodo_mes}/${periodo_anio}`);

    // Delete totales for these imports
    for (const id of ids) {
      await supabase.from('fichadas_totales_mensuales').delete().eq('importacion_id', id);
      await supabase.from('fichadas_registros').delete().eq('importacion_id', id);
      await supabase.from('fichadas_importaciones').delete().eq('id', id);
    }
  }
}

// ─── COLABORADORES ───────────────────────────────────────────────
export async function upsertColaborador({ nombre_completo, area, sector, carga_horaria_default }) {
  // Try to find existing
  const { data: existing } = await supabase
    .from('fichadas_colaboradores')
    .select('id')
    .eq('nombre_completo', nombre_completo)
    .maybeSingle();

  if (existing) {
    const updates = { updated_at: new Date().toISOString() };
    if (area) updates.area = area;
    if (sector) updates.sector = sector;
    if (carga_horaria_default) updates.carga_horaria_default = carga_horaria_default;

    await supabase
      .from('fichadas_colaboradores')
      .update(updates)
      .eq('id', existing.id);

    return existing.id;
  }

  const { data, error } = await supabase
    .from('fichadas_colaboradores')
    .insert({
      nombre_completo,
      area: area || null,
      sector: sector || null,
      carga_horaria_default: carga_horaria_default || '07:00',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function listarColaboradores(filtros = {}) {
  let query = supabase
    .from('fichadas_colaboradores')
    .select('*')
    .eq('activo', true)
    .order('nombre_completo');

  if (filtros.area) query = query.eq('area', filtros.area);
  if (filtros.sector) query = query.eq('sector', filtros.sector);
  if (filtros.nombre) query = query.ilike('nombre_completo', `%${filtros.nombre}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function obtenerAreas() {
  const { data, error } = await supabase
    .from('fichadas_colaboradores')
    .select('area')
    .eq('activo', true)
    .not('area', 'is', null);

  if (error) throw error;
  const unique = [...new Set((data || []).map(d => d.area).filter(Boolean))];
  return unique.sort();
}

// ─── REGISTROS ───────────────────────────────────────────────────
export async function guardarRegistros(importacion_id, colaborador_id, registros) {
  const rows = registros.map(reg => ({
    importacion_id,
    colaborador_id,
    fecha: reg.fecha,
    fichada_entrada: reg.fichada_entrada || null,
    fichada_salida: reg.fichada_salida || null,
    horas_trabajadas_min: reg.horas_trabajadas_min || 0,
    horas_redondeadas_min: reg.horas_redondeadas_min || 0,
    horario_entrada: reg.horario_asignado || null,
    carga_horaria: reg.carga_horaria || '00:00',
    datos_raw: reg.datos_raw || {},
  }));

  // Insert in batches of 50 to avoid payload limits
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from('fichadas_registros').insert(batch);
    if (error) {
      console.error(`[Service] Error inserting batch ${i}-${i + batch.length}:`, error);
      // Continue with other batches
    }
  }
}

export async function obtenerRegistros(filtros = {}) {
  let query = supabase
    .from('fichadas_registros')
    .select(`
      *,
      colaborador:fichadas_colaboradores(id, nombre_completo, area, sector),
      importacion:fichadas_importaciones(area, periodo_mes, periodo_anio)
    `)
    .order('fecha', { ascending: true });

  if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id);
  if (filtros.importacion_id) query = query.eq('importacion_id', filtros.importacion_id);
  if (filtros.fecha_desde) query = query.gte('fecha', filtros.fecha_desde);
  if (filtros.fecha_hasta) query = query.lte('fecha', filtros.fecha_hasta);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─── TOTALES MENSUALES ───────────────────────────────────────────
export async function guardarTotalMensual(importacion_id, colaborador_id, totales, periodo_mes, periodo_anio, area) {
  // Delete any existing total for this collaborator+period first (avoids upsert conflict)
  await supabase
    .from('fichadas_totales_mensuales')
    .delete()
    .eq('colaborador_id', colaborador_id)
    .eq('periodo_mes', periodo_mes)
    .eq('periodo_anio', periodo_anio);

  const { error } = await supabase
    .from('fichadas_totales_mensuales')
    .insert({
      importacion_id,
      colaborador_id,
      periodo_mes,
      periodo_anio,
      area,
      total_horas_trabajadas_min: totales.horas_trabajadas_min || 0,
      total_horas_redondeadas_min: totales.horas_redondeadas_min || 0,
      dias_trabajados: totales.dias_trabajados || 0,
      dias_tarde: totales.dias_tarde || 0,
      total_hora_extra_min: totales.horas_extra_min || 0,
    });

  if (error) {
    console.error(`[Service] Error saving total for ${colaborador_id}:`, error);
    // Don't throw — continue with other collaborators
  }
}

export async function obtenerTotalesMensuales(filtros = {}) {
  let query = supabase
    .from('fichadas_totales_mensuales')
    .select(`
      *,
      colaborador:fichadas_colaboradores(id, nombre_completo, area, sector, dni),
      importacion:fichadas_importaciones(nombre_archivo, area)
    `)
    .order('periodo_anio', { ascending: false })
    .order('periodo_mes', { ascending: false });

  if (filtros.periodo_mes) query = query.eq('periodo_mes', filtros.periodo_mes);
  if (filtros.periodo_anio) query = query.eq('periodo_anio', filtros.periodo_anio);
  if (filtros.area) query = query.eq('area', filtros.area);
  if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─── PROCESO COMPLETO: Parse + Save ─────────────────────────────
export async function procesarYGuardarFichadas(parsedData, nombreArchivo, onProgress) {
  const emit = (event) => { if (onProgress) onProgress(event); };

  console.log(`[Service] Processing ${parsedData.colaboradores.length} collaborators for ${parsedData.area} ${parsedData.mes}/${parsedData.anio}`);

  // 0. Clean previous imports for same area+period
  if (parsedData.area && parsedData.mes && parsedData.anio) {
    emit({ type: 'cleaning', area: parsedData.area, periodo: `${parsedData.mes}/${parsedData.anio}` });
    await limpiarImportacionesPrevias(parsedData.area, parsedData.mes, parsedData.anio);
  }

  // 1. Create importation record
  const importacion = await crearImportacion({
    nombre_archivo: nombreArchivo,
    area: parsedData.area,
    periodo_mes: parsedData.mes,
    periodo_anio: parsedData.anio,
    total_colaboradores: parsedData.colaboradores.length,
    total_registros: parsedData.colaboradores.reduce((acc, c) => acc + c.registros.length, 0),
  });
  emit({ type: 'import_created' });

  const resultados = [];
  let errores = 0;
  const total = parsedData.colaboradores.length;

  // 2. Process each collaborator
  for (let i = 0; i < parsedData.colaboradores.length; i++) {
    const colab = parsedData.colaboradores[i];
    emit({ type: 'colaborador_start', nombre: colab.nombre, index: i, total });

    try {
      // Upsert collaborator
      const colaborador_id = await upsertColaborador({
        nombre_completo: colab.nombre,
        area: parsedData.area,
      });

      // Save daily records
      if (colab.registros.length > 0) {
        await guardarRegistros(importacion.id, colaborador_id, colab.registros);
      }

      // Save monthly totals
      await guardarTotalMensual(
        importacion.id,
        colaborador_id,
        colab.totales,
        parsedData.mes,
        parsedData.anio,
        parsedData.area,
      );

      resultados.push({
        nombre: colab.nombre,
        colaborador_id,
        registros: colab.registros.length,
        totalHoras: colab.totales.horas_redondeadas_min,
        diasTrabajados: colab.totales.dias_trabajados,
      });

      emit({ type: 'colaborador_done', nombre: colab.nombre, registros: colab.registros.length, dias: colab.totales.dias_trabajados });
      console.log(`  ✓ ${colab.nombre}: ${colab.registros.length} registros, ${colab.totales.dias_trabajados} días`);
    } catch (err) {
      console.error(`  ✗ Error processing ${colab.nombre}:`, err.message);
      emit({ type: 'colaborador_error', nombre: colab.nombre, error: err.message });
      errores++;
    }
  }

  emit({ type: 'done', ok: resultados.length, errores });
  console.log(`[Service] Done: ${resultados.length} OK, ${errores} errors`);

  return {
    importacion_id: importacion.id,
    area: parsedData.area,
    periodo: `${parsedData.mes}/${parsedData.anio}`,
    resultados,
    errores,
  };
}
