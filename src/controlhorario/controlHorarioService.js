/**
 * Control de Horarios — Sede Santa Fe
 * Service Layer: All Supabase operations for sectors, collaborators, diagrams, and fichadas
 * Sanatorio Argentino SRL
 */
import { supabase } from '../supabaseClient';

// ─── SECTOR COLORS (fallback map) ─────────────────────────────────
export const SECTOR_COLORS = {
  'SECTOR 1': '#3B82F6',
  'SECTOR 2': '#8B5CF6',
  'CITOLOGÍA': '#EC4899',
  'DXI': '#F59E0B',
  'GUARDIAS DE SEGURIDAD': '#10B981',
  'CHEQUEO Y PREVENIR': '#06B6D4',
  'MAMOGRAFÍA Y DENSITOGRAFÍA': '#F472B6',
};

export const SECTOR_ICONS = {
  'SECTOR 1': '🏥',
  'SECTOR 2': '🏥',
  'CITOLOGÍA': '🔬',
  'DXI': '📷',
  'GUARDIAS DE SEGURIDAD': '🛡️',
  'CHEQUEO Y PREVENIR': '✅',
  'MAMOGRAFÍA Y DENSITOGRAFÍA': '🩺',
};

// ─── REGLAS DE HORAS — Sede Santa Fe ─────────────────────────────
// Lunes(1) a Jueves(4): 9hs | Viernes(5): 8hs | Sábado(6): 4hs | Domingo(0): 0hs
export const HORAS_REQUERIDAS_DIA = {
  1: 9, // Lunes
  2: 9, // Martes
  3: 9, // Miércoles
  4: 9, // Jueves
  5: 8, // Viernes
  6: 4, // Sábado
  0: 0, // Domingo
};
export const HORAS_SEMANALES_OBJETIVO = 44;

// ─── TURNOS DEL DIAGRAMA (Planificación mensual) ────────────────
// Códigos utilizados en el diagrama mensual de cada sector
// El diagrama se recibe como PDF o imagen al inicio de cada mes
export const TURNOS_DIAGRAMA = {
  M:   { codigo: 'M',   nombre: 'Mañana',       inicio: '07:00', fin: '16:00', totalMin: 540,  color: '#3B82F6', esLaboral: true },
  T:   { codigo: 'T',   nombre: 'Tarde',         inicio: '13:30', fin: '21:30', totalMin: 480,  color: '#8B5CF6', esLaboral: true },
  S:   { codigo: 'S',   nombre: 'Siesta',        inicio: '13:00', fin: '17:00', totalMin: 240,  color: '#F59E0B', esLaboral: true },
  C:   { codigo: 'C',   nombre: 'Cortado',       inicio: '08:00', fin: '21:00', totalMin: 480,  color: '#06B6D4', esLaboral: true,
         tramos: [{ inicio: '08:00', fin: '12:00' }, { inicio: '17:00', fin: '21:00' }] },
  R:   { codigo: 'R',   nombre: 'Recargo',       inicio: '07:00', fin: '21:30', totalMin: 870,  color: '#EF4444', esLaboral: true },
  V:   { codigo: 'V',   nombre: 'Vacaciones',    inicio: null,    fin: null,    totalMin: 0,    color: '#10B981', esLaboral: false },
  L:   { codigo: 'L',   nombre: 'Libre/Franco',  inicio: null,    fin: null,    totalMin: 0,    color: '#94A3B8', esLaboral: false },
  F:   { codigo: 'F',   nombre: 'Feriado',       inicio: null,    fin: null,    totalMin: 0,    color: '#F472B6', esLaboral: false },
  // Turnos combinados (ej: M/S = Mañana + Siesta)
  'M/S': { codigo: 'M/S', nombre: 'Mañana+Siesta', inicio: '07:00', fin: '17:00', totalMin: 600, color: '#0891B2', esLaboral: true },
  'M/T': { codigo: 'M/T', nombre: 'Mañana+Tarde',  inicio: '07:00', fin: '21:30', totalMin: 870, color: '#D97706', esLaboral: true },
  'S/T': { codigo: 'S/T', nombre: 'Siesta+Tarde',  inicio: '13:00', fin: '21:30', totalMin: 510, color: '#7C3AED', esLaboral: true },
};

/**
 * Obtiene los minutos planificados según el turno asignado en el diagrama.
 * Aplica el redondeo de 45min sobre los minutos del turno.
 */
export function getHorasTurno(codigoTurno) {
  if (!codigoTurno) return null;
  const turno = TURNOS_DIAGRAMA[codigoTurno.toUpperCase()];
  if (!turno) return null;
  return {
    ...turno,
    horasRedondeadas: redondearHoras(turno.totalMin),
  };
}

/**
 * Regla de redondeo de fichadas:
 * Se toma 1 hora a partir de los 45 minutos.
 * Ej: 3h30m → 3h | 3h45m → 4h | 8h44m → 8h | 8h45m → 9h
 */
export function redondearHoras(totalMinutos) {
  if (!totalMinutos || totalMinutos <= 0) return 0;
  const horas = Math.floor(totalMinutos / 60);
  const resto = totalMinutos % 60;
  return resto >= 45 ? horas + 1 : horas;
}

/**
 * Formatea minutos a "Xh Ym" para display
 */
export function formatMinutosDisplay(totalMinutos) {
  if (!totalMinutos || totalMinutos <= 0) return '0h 0m';
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return `${h}h ${m}m`;
}

/**
 * Obtiene las horas requeridas para una fecha específica
 */
export function getHorasRequeridas(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00');
  const dayOfWeek = d.getDay(); // 0=Dom, 1=Lun... 6=Sab
  return HORAS_REQUERIDAS_DIA[dayOfWeek] ?? 0;
}

/**
 * Evalúa el cumplimiento horario de un día
 * Retorna: { minutosReales, horasRedondeadas, horasRequeridas, deficit, cumple, esDiaLaboral }
 */
export function evaluarCumplimientoDiario(fichada, fechaStr) {
  const horasRequeridas = getHorasRequeridas(fechaStr);
  const esDiaLaboral = horasRequeridas > 0;
  const minutosReales = fichada?.horas_trabajadas_min || 0;
  const horasRedondeadas = redondearHoras(minutosReales);
  const deficit = horasRequeridas - horasRedondeadas;
  const cumple = horasRedondeadas >= horasRequeridas;

  return {
    minutosReales,
    horasRedondeadas,
    horasRequeridas,
    deficit: deficit > 0 ? deficit : 0,
    excedente: deficit < 0 ? Math.abs(deficit) : 0,
    cumple,
    esDiaLaboral,
  };
}

/**
 * Evalúa el cumplimiento semanal de un colaborador
 * Recibe array de { fichada, fecha } del cruce
 */
export function evaluarCumplimientoSemanal(dias) {
  let totalMinutosReales = 0;
  let totalHorasRedondeadas = 0;
  let diasLaborales = 0;
  let diasCumplidos = 0;
  let diasDeficit = 0;
  const detalleDias = [];

  for (const dia of dias) {
    const eval_ = evaluarCumplimientoDiario(dia.fichada, dia.fecha);
    totalMinutosReales += eval_.minutosReales;
    totalHorasRedondeadas += eval_.horasRedondeadas;

    if (eval_.esDiaLaboral) {
      diasLaborales++;
      if (eval_.cumple) diasCumplidos++;
      else diasDeficit++;
    }

    detalleDias.push({
      fecha: dia.fecha,
      ...eval_,
    });
  }

  const deficitSemanal = HORAS_SEMANALES_OBJETIVO - totalHorasRedondeadas;
  const cumpleSemana = totalHorasRedondeadas >= HORAS_SEMANALES_OBJETIVO;

  return {
    totalMinutosReales,
    totalHorasRedondeadas,
    objetivo: HORAS_SEMANALES_OBJETIVO,
    deficitSemanal: deficitSemanal > 0 ? deficitSemanal : 0,
    excedenteSemanal: deficitSemanal < 0 ? Math.abs(deficitSemanal) : 0,
    cumpleSemana,
    diasLaborales,
    diasCumplidos,
    diasDeficit,
    detalleDias,
    porcentajeSemanal: HORAS_SEMANALES_OBJETIVO > 0
      ? Math.min(100, Math.round((totalHorasRedondeadas / HORAS_SEMANALES_OBJETIVO) * 100))
      : 0,
  };
}

// ─── SECTORES ────────────────────────────────────────────────────
export async function listarSectores(sede = 'SANTA FE') {
  const { data, error } = await supabase
    .from('ch_sectores')
    .select('*')
    .eq('activo', true)
    .eq('sede', sede)
    .order('orden');

  if (error) throw error;
  return data || [];
}

export async function crearSector({ nombre, descripcion, color, orden, sede = 'SANTA FE' }) {
  const { data, error } = await supabase
    .from('ch_sectores')
    .insert({ nombre, descripcion, color, orden, sede })
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
      sector:ch_sectores(id, nombre, color, orden, sede)
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

export async function obtenerDiagramaMensual(sector, date) {
  // Legacy compat
  return obtenerDiagramas({ fecha_desde: date, fecha_hasta: date });
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

export async function obtenerFichadasPorSector(sector, date) {
  // Legacy compat
  return obtenerFichadas({ fecha_desde: date, fecha_hasta: date });
}

export async function guardarFichada({ colaborador_id, fecha, hora_ingreso, hora_egreso, fuente, observaciones }) {
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

// ─── NOVEDADES ───────────────────────────────────────────────────
export async function obtenerNovedades(filtros = {}) {
  let query = supabase
    .from('ch_novedades')
    .select(`
      *,
      colaborador:ch_colaboradores(id, nombre_completo, sector_id,
        sector:ch_sectores(id, nombre, color)
      )
    `)
    .order('fecha', { ascending: false });

  if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id);
  if (filtros.fecha_desde) query = query.gte('fecha', filtros.fecha_desde);
  if (filtros.fecha_hasta) query = query.lte('fecha', filtros.fecha_hasta);
  if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
  if (filtros.estado) query = query.eq('estado', filtros.estado);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function crearNovedad({ colaborador_id, fecha, tipo, minutos_diferencia, descripcion }) {
  const { data, error } = await supabase
    .from('ch_novedades')
    .insert({
      colaborador_id,
      fecha,
      tipo,
      minutos_diferencia: minutos_diferencia || 0,
      descripcion: descripcion || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function actualizarNovedad(id, updates) {
  const { data, error } = await supabase
    .from('ch_novedades')
    .update(updates)
    .eq('id', id)
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
        if (diagrama.turno === 'F' || diagrama.turno === 'L') {
          estado = fichada.hora_ingreso ? 'trabajo_en_franco' : 'franco';
        } else if (!fichada.hora_ingreso) {
          estado = 'ausencia';
        } else {
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
    sinDiagrama: 0,
    trabajoEnFranco: 0,
  };

  for (const colab of cruceData) {
    for (const dia of colab.dias) {
      switch (dia.estado) {
        case 'cumplido': stats.cumplidos++; break;
        case 'llegada_tarde': stats.llegadasTarde++; break;
        case 'ausencia': stats.ausencias++; break;
        case 'franco': stats.francos++; break;
        case 'sin_diagrama': stats.sinDiagrama++; break;
        case 'trabajo_en_franco': stats.trabajoEnFranco++; break;
        default: stats.sinDatos++; break;
      }
    }
  }

  return stats;
}

// ─── ESTADÍSTICAS POR SECTOR ─────────────────────────────────────
export function calcularEstadisticasPorSector(cruceData) {
  const porSector = {};

  for (const colab of cruceData) {
    const sectorNombre = colab.colaborador?.sector?.nombre || 'SIN SECTOR';
    const sectorColor = colab.colaborador?.sector?.color || '#94A3B8';

    if (!porSector[sectorNombre]) {
      porSector[sectorNombre] = {
        nombre: sectorNombre,
        color: sectorColor,
        totalColaboradores: 0,
        cumplidos: 0,
        llegadasTarde: 0,
        ausencias: 0,
        francos: 0,
        sinDatos: 0,
        colaboradores: [],
      };
    }

    porSector[sectorNombre].totalColaboradores++;
    porSector[sectorNombre].colaboradores.push(colab);

    for (const dia of colab.dias) {
      switch (dia.estado) {
        case 'cumplido': porSector[sectorNombre].cumplidos++; break;
        case 'llegada_tarde': porSector[sectorNombre].llegadasTarde++; break;
        case 'ausencia': porSector[sectorNombre].ausencias++; break;
        case 'franco': porSector[sectorNombre].francos++; break;
        default: porSector[sectorNombre].sinDatos++; break;
      }
    }
  }

  return porSector;
}

// ─── HELPERS ─────────────────────────────────────────────────────
export function formatTime(timeStr) {
  if (!timeStr) return '—';
  return timeStr.slice(0, 5); // HH:MM
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function getDayName(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long' });
}

export function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Get the date range for the current week (Mon-Sun) or a specific date
 */
export function getWeekRange(refDate = new Date()) {
  const d = new Date(refDate);
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon...
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    desde: monday.toISOString().slice(0, 10),
    hasta: sunday.toISOString().slice(0, 10),
  };
}

/**
 * Get the date range for a month
 */
export function getMonthRange(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  return {
    desde: firstDay.toISOString().slice(0, 10),
    hasta: lastDay.toISOString().slice(0, 10),
  };
}
