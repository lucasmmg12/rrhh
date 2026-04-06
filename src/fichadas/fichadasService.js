/**
 * Fichadas Database Service
 * Handles all Supabase operations for the fichadas module
 */
import { supabase } from '../supabaseClient';

// ─── GENERAL IMPORT DETECTION ────────────────────────────────────
// Keywords that indicate a PDF is a "general" company-wide import
// (not sector-specific). General imports must NOT overwrite sectoral data.
const GENERAL_AREA_KEYWORDS = [
  'SANATORIO ARGENTINO',
  'SANATORIO',
  'GENERAL',
  'TODOS',
  'COMPLETO',
];

/**
 * Detect if a parsed area string indicates a "general" (company-wide) import.
 * General imports contain all employees across sectors and should not
 * overwrite existing sectoral assignments.
 */
export function isGeneralImport(area) {
  if (!area || area.trim() === '') return true; // No area = general
  const upper = area.toUpperCase().trim();
  return GENERAL_AREA_KEYWORDS.some(kw => upper.includes(kw));
}

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

/**
 * Check if a collaborator already has monthly totals for a given period.
 * Used by Smart Merge to detect existing sectoral data.
 * @returns {{ area: string, importacion_id: string } | null}
 */
async function verificarTotalExistente(colaborador_id, periodo_mes, periodo_anio) {
  const { data } = await supabase
    .from('fichadas_totales_mensuales')
    .select('area, importacion_id')
    .eq('colaborador_id', colaborador_id)
    .eq('periodo_mes', periodo_mes)
    .eq('periodo_anio', periodo_anio)
    .maybeSingle();
  return data;
}

// ─── COLABORADORES ───────────────────────────────────────────────
export async function upsertColaborador({ nombre_completo, area, sector, carga_horaria_default }) {
  // Try to find existing
  const { data: existing } = await supabase
    .from('fichadas_colaboradores')
    .select('id, area')
    .eq('nombre_completo', nombre_completo)
    .maybeSingle();

  if (existing) {
    // Only update area if it's NOT already set (first-time mapping)
    const updates = { updated_at: new Date().toISOString() };
    if (area && !existing.area) updates.area = area;  // Only set if empty
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
  if (!registros.length) return;

  // Extract the date range from records to clean up existing ones first
  const fechas = registros.map(r => r.fecha).filter(Boolean).sort();
  const fechaMin = fechas[0];
  const fechaMax = fechas[fechas.length - 1];

  // Delete ALL existing records for this collaborator in this date range.
  // This aggressively prevents duplicates when re-importing.
  // SAFETY: The Smart Merge in procesarYGuardarFichadas() is the gatekeeper —
  // it ensures this function is NEVER called for collaborators with existing
  // sectoral data during general imports. So this delete is always safe.
  if (fechaMin && fechaMax) {
    await supabase
      .from('fichadas_registros')
      .delete()
      .eq('colaborador_id', colaborador_id)
      .gte('fecha', fechaMin)
      .lte('fecha', fechaMax);
  }

  const rows = registros.map(reg => ({
    importacion_id,
    colaborador_id,
    fecha: reg.fecha,
    fichada_entrada: reg.fichada_entrada || null,
    fichada_salida: reg.fichada_salida || null,
    horas_trabajadas_min: reg.horas_trabajadas_min || 0,
    horas_redondeadas_min: reg.horas_redondeadas_min || 0,
    horas_nocturnas_min: reg.horas_nocturnas_min || 0,
    es_turno_noche: reg.es_turno_noche || false,
    es_recargo: reg.es_recargo || false,
    turno_noche_merge: reg.datos_raw?.turno_noche || false,
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
export async function guardarTotalMensual(importacion_id, colaborador_id, totales, periodo_mes, periodo_anio, area, esGeneralImport = false) {
  // *** FIX: Check if a sectoral total already exists BEFORE deleting ***
  const { data: existingTotal } = await supabase
    .from('fichadas_totales_mensuales')
    .select('id, area, importacion_id')
    .eq('colaborador_id', colaborador_id)
    .eq('periodo_mes', periodo_mes)
    .eq('periodo_anio', periodo_anio)
    .maybeSingle();

  // If this is a general import and the collaborator already has a total
  // from a DIFFERENT (sectoral) import → DO NOT overwrite
  if (esGeneralImport && existingTotal && existingTotal.importacion_id !== importacion_id) {
    console.log(`  🛡 Total protegido para ${colaborador_id}: área "${existingTotal.area}" preservada (import ${existingTotal.importacion_id})`);
    return; // Protect existing sectoral data
  }

  // Delete any existing total for this collaborator+period first (avoids upsert conflict)
  if (existingTotal) {
    await supabase
      .from('fichadas_totales_mensuales')
      .delete()
      .eq('id', existingTotal.id);
  }

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
      total_horas_nocturnas_min: totales.horas_nocturnas_min || 0,
      dias_noche: totales.dias_noche || 0,
      recargos: totales.recargos || 0,
      total_horas_recargo_min: totales.horas_recargo_min || 0,
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

  const esGeneral = isGeneralImport(parsedData.area);
  console.log(`[Service] Processing ${parsedData.colaboradores.length} collaborators for ${parsedData.area} ${parsedData.mes}/${parsedData.anio} (${esGeneral ? 'GENERAL' : 'SECTORAL'})`);

  // 0. Clean previous imports for same area+period
  // *** FIX: NEVER clean previous imports for general/company-wide PDFs ***
  // General imports should only ADD data for collaborators without existing sectoral data
  if (!esGeneral && parsedData.area && parsedData.mes && parsedData.anio) {
    emit({ type: 'cleaning', area: parsedData.area, periodo: `${parsedData.mes}/${parsedData.anio}` });
    await limpiarImportacionesPrevias(parsedData.area, parsedData.mes, parsedData.anio);
  } else if (esGeneral) {
    emit({ type: 'cleaning', area: parsedData.area, periodo: `${parsedData.mes}/${parsedData.anio}` });
    console.log(`[Service] ⚠ Import GENERAL detectado — NO se limpian importaciones previas. Smart Merge protegerá datos sectoriales.`);
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
  const omitidos = [];  // Smart Merge: collaborators skipped (have sectoral data)
  const nuevos = [];    // Smart Merge: new collaborators without prior data
  let errores = 0;
  const total = parsedData.colaboradores.length;

  // 2. Process each collaborator with Smart Merge
  for (let i = 0; i < parsedData.colaboradores.length; i++) {
    const colab = parsedData.colaboradores[i];
    emit({ type: 'colaborador_start', nombre: colab.nombre, index: i, total });

    try {
      // Upsert collaborator — for general imports, do NOT update the area field
      const colaborador_id = await upsertColaborador({
        nombre_completo: colab.nombre,
        area: esGeneral ? null : parsedData.area,  // *** FIX: Don't overwrite area from general import ***
      });

      // ─── SMART MERGE CHECK ──────────────────────────────
      // Check if this collaborator already has totals for this period
      const existingTotal = await verificarTotalExistente(
        colaborador_id, parsedData.mes, parsedData.anio
      );

      // *** FIX: For general imports, skip ANY collaborator that already has data ***
      // (regardless of whether the area matches or not)
      // For sectoral imports, skip only if the existing data is from a different area
      const shouldSkip = esGeneral
        ? (existingTotal != null)  // General: skip if ANY existing data
        : (existingTotal && existingTotal.area && existingTotal.area !== parsedData.area);  // Sectoral: skip if different area

      if (shouldSkip) {
        omitidos.push({
          nombre: colab.nombre,
          colaborador_id,
          area_existente: existingTotal?.area || '(sin área)',
          area_pdf: parsedData.area,
          registros: colab.registros.length,
          totalHoras: colab.totales.horas_redondeadas_min,
        });

        emit({
          type: 'colaborador_skip',
          nombre: colab.nombre,
          area_existente: existingTotal?.area || '(sin área)',
        });
        console.log(`  ⏭ ${colab.nombre}: Datos de "${existingTotal?.area}" preservados (omitido)`);
        continue; // Skip — do NOT overwrite existing data
      }
      // ─── END SMART MERGE CHECK ──────────────────────────

      // Track if this is a genuinely new collaborator (no prior data)
      const esNuevo = !existingTotal;

      // Save daily records
      if (colab.registros.length > 0) {
        await guardarRegistros(importacion.id, colaborador_id, colab.registros);
      }

      // Save monthly totals
      // For new collaborators in a general import, mark as SIN ASIGNAR
      const areaParaTotales = esGeneral && esNuevo
        ? 'SIN ASIGNAR'
        : (esGeneral ? parsedData.area : parsedData.area);

      await guardarTotalMensual(
        importacion.id,
        colaborador_id,
        colab.totales,
        parsedData.mes,
        parsedData.anio,
        areaParaTotales,
        esGeneral,  // *** FIX: Pass general flag so guardarTotalMensual can protect existing data ***
      );

      // If it's new AND we're in a general import, update collaborator area
      if (esNuevo && esGeneral) {
        await supabase
          .from('fichadas_colaboradores')
          .update({ area: 'SIN ASIGNAR' })
          .eq('id', colaborador_id);

        nuevos.push({
          nombre: colab.nombre,
          colaborador_id,
          area_pdf: parsedData.area,
          registros: colab.registros.length,
        });
      }

      resultados.push({
        nombre: colab.nombre,
        colaborador_id,
        registros: colab.registros.length,
        totalHoras: colab.totales.horas_redondeadas_min,
        diasTrabajados: colab.totales.dias_trabajados,
        esNuevo,
      });

      emit({ type: 'colaborador_done', nombre: colab.nombre, registros: colab.registros.length, dias: colab.totales.dias_trabajados });
      console.log(`  ✓ ${colab.nombre}: ${colab.registros.length} registros, ${colab.totales.dias_trabajados} días${esNuevo ? ' (NUEVO)' : ''}`);
    } catch (err) {
      console.error(`  ✗ Error processing ${colab.nombre}:`, err.message);
      emit({ type: 'colaborador_error', nombre: colab.nombre, error: err.message });
      errores++;
    }
  }

  // Log merge summary
  if (omitidos.length > 0) {
    console.log(`[Service] Smart Merge: ${omitidos.length} omitidos (datos preservados), ${nuevos.length} nuevos (SIN ASIGNAR)`);
  }

  emit({ type: 'done', ok: resultados.length, errores, omitidos: omitidos.length, nuevos: nuevos.length });
  console.log(`[Service] Done: ${resultados.length} OK, ${omitidos.length} omitidos, ${nuevos.length} nuevos, ${errores} errors`);

  return {
    importacion_id: importacion.id,
    area: parsedData.area,
    periodo: `${parsedData.mes}/${parsedData.anio}`,
    resultados,
    omitidos,
    nuevos,
    errores,
    esGeneral,
  };
}
