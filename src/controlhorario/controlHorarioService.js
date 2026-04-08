/**
 * Control de Horarios - Database Service
 * Handles all Supabase operations for sectors, collaborators, diagrams, and fichadas
 */
import { supabase } from '../supabaseClient';

// ─── SECTORES ────────────────────────────────────────────────────
export async function listarSectores() {
  const { data, error } = await supabase
    .from('ch_sectores')
    .select('*')
    .eq('activo', true)
    .order('orden');

  if (error) throw error;
  return data || [];
}

export async function crearSector({ nombre, descripcion, color, orden }) {
  const { data, error } = await supabase
    .from('ch_sectores')
    .insert({ nombre, descripcion, color, orden })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── COLABORADORES ───────────────────────────────────────────────
export async function listarColaboradores(filtros = {}) {
  let query = supabase
    .from('ch_colaboradores')
    .select(`
      *,
      sector:ch_sectores(id, nombre, color, orden)
    `)
    .eq('activo', true)
    .order('nombre_completo');

  if (filtros.sector_id) query = query.eq('sector_id', filtros.sector_id);
  if (filtros.nombre) query = query.ilike('nombre_completo', `%${filtros.nombre}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function crearColaborador({ nombre_completo, sector_id, dni, legajo, telefono, email, cargo, turno_habitual }) {
  const { data, error } = await supabase
    .from('ch_colaboradores')
    .insert({
      nombre_completo,
      sector_id: sector_id || null,
      dni: dni || null,
      legajo: legajo || null,
      telefono: telefono || null,
      email: email || null,
      cargo: cargo || null,
      turno_habitual: turno_habitual || null,
    })
    .select(`*, sector:ch_sectores(id, nombre, color)`)
    .single();

  if (error) throw error;
  return data;
}

export async function actualizarColaborador(id, updates) {
  const { data, error } = await supabase
    .from('ch_colaboradores')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`*, sector:ch_sectores(id, nombre, color)`)
    .single();

  if (error) throw error;
  return data;
}

export async function desactivarColaborador(id) {
  const { error } = await supabase
    .from('ch_colaboradores')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// ─── DIAGRAMAS (Planificación) ───────────────────────────────────
export async function obtenerDiagramas(filtros = {}) {
  let query = supabase
    .from('ch_diagramas')
    .select(`
      *,
      colaborador:ch_colaboradores(id, nombre_completo, sector_id,
        sector:ch_sectores(id, nombre, color)
      )
    `)
    .order('fecha');

  if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id);
  if (filtros.fecha_desde) query = query.gte('fecha', filtros.fecha_desde);
  if (filtros.fecha_hasta) query = query.lte('fecha', filtros.fecha_hasta);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function guardarDiagrama({ colaborador_id, fecha, turno, hora_inicio, hora_fin, observaciones }) {
  const { data, error } = await supabase
    .from('ch_diagramas')
    .upsert({
      colaborador_id,
      fecha,
      turno,
      hora_inicio: hora_inicio || null,
      hora_fin: hora_fin || null,
      observaciones: observaciones || null,
    }, { onConflict: 'colaborador_id,fecha' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function guardarDiagramasBatch(registros) {
  if (!registros.length) return;

  const { error } = await supabase
    .from('ch_diagramas')
    .upsert(registros, { onConflict: 'colaborador_id,fecha' });

  if (error) throw error;
}

// ─── FICHADAS (Registros reales) ─────────────────────────────────
export async function obtenerFichadas(filtros = {}) {
  let query = supabase
    .from('ch_fichadas')
    .select(`
      *,
      colaborador:ch_colaboradores(id, nombre_completo, sector_id,
        sector:ch_sectores(id, nombre, color)
      )
    `)
    .order('fecha');

  if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id);
  if (filtros.fecha_desde) query = query.gte('fecha', filtros.fecha_desde);
  if (filtros.fecha_hasta) query = query.lte('fecha', filtros.fecha_hasta);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function guardarFichada({ colaborador_id, fecha, hora_ingreso, hora_egreso, fuente, observaciones }) {
  // Calculate worked minutes
  let horas_trabajadas_min = 0;
  if (hora_ingreso && hora_egreso) {
    const [ih, im] = hora_ingreso.split(':').map(Number);
    const [eh, em] = hora_egreso.split(':').map(Number);
    let inMin = ih * 60 + im;
    let outMin = eh * 60 + em;
    if (outMin < inMin) outMin += 24 * 60;
    horas_trabajadas_min = outMin - inMin;
  }

  const { data, error } = await supabase
    .from('ch_fichadas')
    .upsert({
      colaborador_id,
      fecha,
      hora_ingreso: hora_ingreso || null,
      hora_egreso: hora_egreso || null,
      horas_trabajadas_min,
      fuente: fuente || 'manual',
      observaciones: observaciones || null,
    }, { onConflict: 'colaborador_id,fecha' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── CRUCE: Diagrama vs Fichadas ─────────────────────────────────
/**
 * Cruza diagramas con fichadas para un período dado.
 * Devuelve un array con el estado de cada día por colaborador.
 */
export async function cruzarDiagramaVsFichadas(fecha_desde, fecha_hasta, sector_id = null) {
  // Traer ambas fuentes en paralelo
  const filtros = { fecha_desde, fecha_hasta };
  const [diagramas, fichadas, colaboradores] = await Promise.all([
    obtenerDiagramas(filtros),
    obtenerFichadas(filtros),
    listarColaboradores(sector_id ? { sector_id } : {}),
  ]);

  // Index fichadas by colab+fecha
  const fichadaMap = {};
  for (const f of fichadas) {
    fichadaMap[`${f.colaborador_id}_${f.fecha}`] = f;
  }

  // Index diagramas by colab+fecha
  const diagramaMap = {};
  for (const d of diagramas) {
    diagramaMap[`${d.colaborador_id}_${d.fecha}`] = d;
  }

  // Build result per collaborator
  const resultado = [];
  for (const colab of colaboradores) {
    const dias = [];
    const start = new Date(fecha_desde + 'T12:00:00');
    const end = new Date(fecha_hasta + 'T12:00:00');

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const fechaStr = d.toISOString().slice(0, 10);
      const key = `${colab.id}_${fechaStr}`;
      const diagrama = diagramaMap[key] || null;
      const fichada = fichadaMap[key] || null;

      let estado = 'sin_datos';
      let minutoDiferencia = 0;

      if (diagrama && fichada) {
        // Cruce: comparar horario planificado vs real
        if (diagrama.turno === 'F' || diagrama.turno === 'L') {
          estado = fichada.hora_ingreso ? 'trabajo_en_franco' : 'franco';
        } else if (!fichada.hora_ingreso) {
          estado = 'ausencia';
        } else {
          // Comparar hora de entrada
          if (diagrama.hora_inicio && fichada.hora_ingreso) {
            const [ph, pm] = diagrama.hora_inicio.split(':').map(Number);
            const [rh, rm] = fichada.hora_ingreso.split(':').map(Number);
            minutoDiferencia = (rh * 60 + rm) - (ph * 60 + pm);

            if (minutoDiferencia > 5) {
              estado = 'llegada_tarde';
            } else {
              estado = 'cumplido';
            }
          } else {
            estado = 'cumplido';
          }
        }
      } else if (diagrama && !fichada) {
        if (diagrama.turno === 'F' || diagrama.turno === 'L') {
          estado = 'franco';
        } else {
          estado = 'ausencia';
        }
      } else if (!diagrama && fichada) {
        estado = 'sin_diagrama';
      }

      dias.push({
        fecha: fechaStr,
        diagrama,
        fichada,
        estado,
        minutoDiferencia,
      });
    }

    resultado.push({
      colaborador: colab,
      dias,
    });
  }

  return resultado;
}

// ─── ESTADÍSTICAS ────────────────────────────────────────────────
export function calcularEstadisticas(cruceData) {
  const stats = {
    totalColaboradores: cruceData.length,
    cumplidos: 0,
    llegadasTarde: 0,
    ausencias: 0,
    francos: 0,
    sinDatos: 0,
  };

  for (const colab of cruceData) {
    for (const dia of colab.dias) {
      switch (dia.estado) {
        case 'cumplido': stats.cumplidos++; break;
        case 'llegada_tarde': stats.llegadasTarde++; break;
        case 'ausencia': stats.ausencias++; break;
        case 'franco': stats.francos++; break;
        default: stats.sinDatos++; break;
      }
    }
  }

  return stats;
}
