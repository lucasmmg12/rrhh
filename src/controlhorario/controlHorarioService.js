/**
 * Control de Horarios — Sede Santa Fe
 * Service Layer: Usa las tablas existentes de fichadas (fichadas_colaboradores, fichadas_registros)
 * NO depende de tablas ch_* — extrae los datos del módulo de Fichadas ya cargado
 * Sanatorio Argentino SRL
 */
import { supabase } from '../supabaseClient';

// ─── SECTOR COLORS & ICONS ─────────────────────────────────────
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

// ─── MAPEO DE COLABORADORES → SECTORES (Sede Santa Fe) ──────────
// Mapeo estático basado en la estructura organizacional definida
const COLABORADORES_SEDE_SF = {
  'SECTOR 1': ['JACQUES VIRGINIA', 'APARICIO EMILCE', 'MORALES MALEN'],
  'SECTOR 2': ['ATENCIO EVELYN', 'QUINTERO BRITOS JULIETA', 'FIGUEROA HERRERA ERICA'],
  'CITOLOGÍA': ['VEDIA ROMINA', 'DI VIRGILIO MICAELA', 'MESSINA CARLA'],
  'DXI': ['PEREZ YANINA', 'DIAZ DANIELA', 'GORDILLO VEGA MONICA', 'ESPEJO CRISTINA', 'RUARTE DAIANA', 'RUARTE MICAELA'],
  'GUARDIAS DE SEGURIDAD': ['GOMEZ JULIO', 'TORRES DAVID'],
  'CHEQUEO Y PREVENIR': ['GODOY GUZMAN GISEL'],
  'MAMOGRAFÍA Y DENSITOGRAFÍA': ['OROZCO LAURA MARIENELA', 'TORET ANA BELEN', 'GOMEZ MALVINA SOLEDAD', 'TELLO CECILIA', 'ZARZUELO JULIETA MICAELA', 'OLIVA MARIA VERONICA'],
};

// Build reverse lookup: nombre → sector
const NOMBRE_TO_SECTOR = {};
for (const [sector, nombres] of Object.entries(COLABORADORES_SEDE_SF)) {
  for (const nombre of nombres) {
    NOMBRE_TO_SECTOR[nombre] = sector;
  }
}

/**
 * Identifica el sector de un colaborador por su nombre.
 * Usa un matching inteligente: primero exact, luego partial por apellido.
 */
export function getSectorByNombre(nombreCompleto) {
  if (!nombreCompleto) return null;
  const upper = nombreCompleto.toUpperCase().trim();
  
  // 1) Exact match
  if (NOMBRE_TO_SECTOR[upper]) return NOMBRE_TO_SECTOR[upper];
  
  // 2) Check if DB name starts with any of our known names
  for (const [nombre, sector] of Object.entries(NOMBRE_TO_SECTOR)) {
    if (upper.startsWith(nombre) || nombre.startsWith(upper)) return sector;
  }
  
  // 3) Fuzzy: check if ALL words of a known name are contained in the DB name
  for (const [nombre, sector] of Object.entries(NOMBRE_TO_SECTOR)) {
    const words = nombre.split(' ');
    if (words.length >= 2 && words.every(w => upper.includes(w))) return sector;
  }
  
  return null;
}

/**
 * Get all unique sector names for display
 */
export function getSectoresSedeStafe() {
  return Object.keys(COLABORADORES_SEDE_SF).map((nombre, i) => ({
    id: nombre,
    nombre,
    color: SECTOR_COLORS[nombre] || '#94a3b8',
    orden: i + 1,
    sede: 'SANTA FE',
  }));
}

// ─── REGLAS DE HORAS — Sede Santa Fe ─────────────────────────────
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

// ─── TURNOS DEL DIAGRAMA ────────────────────────────────────────
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
  'M/S': { codigo: 'M/S', nombre: 'Mañana+Siesta', inicio: '07:00', fin: '17:00', totalMin: 600, color: '#0891B2', esLaboral: true },
  'M/T': { codigo: 'M/T', nombre: 'Mañana+Tarde',  inicio: '07:00', fin: '21:30', totalMin: 870, color: '#D97706', esLaboral: true },
  'S/T': { codigo: 'S/T', nombre: 'Siesta+Tarde',  inicio: '13:00', fin: '21:30', totalMin: 510, color: '#7C3AED', esLaboral: true },
};

export function getHorasTurno(codigoTurno) {
  if (!codigoTurno) return null;
  const turno = TURNOS_DIAGRAMA[codigoTurno.toUpperCase()];
  if (!turno) return null;
  return { ...turno, horasRedondeadas: redondearHoras(turno.totalMin) };
}

// ─── REDONDEO (regla de 45 min) ─────────────────────────────────
export function redondearHoras(totalMinutos) {
  if (!totalMinutos || totalMinutos <= 0) return 0;
  const horas = Math.floor(totalMinutos / 60);
  const resto = totalMinutos % 60;
  return resto >= 45 ? horas + 1 : horas;
}

export function formatMinutosDisplay(totalMinutos) {
  if (!totalMinutos || totalMinutos <= 0) return '0h 0m';
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return `${h}h ${m}m`;
}

export function getHorasRequeridas(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00');
  const dayOfWeek = d.getDay();
  return HORAS_REQUERIDAS_DIA[dayOfWeek] ?? 0;
}

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
    detalleDias.push({ fecha: dia.fecha, ...eval_ });
  }

  const deficitSemanal = HORAS_SEMANALES_OBJETIVO - totalHorasRedondeadas;
  const cumpleSemana = totalHorasRedondeadas >= HORAS_SEMANALES_OBJETIVO;

  return {
    totalMinutosReales, totalHorasRedondeadas,
    objetivo: HORAS_SEMANALES_OBJETIVO,
    deficitSemanal: deficitSemanal > 0 ? deficitSemanal : 0,
    excedenteSemanal: deficitSemanal < 0 ? Math.abs(deficitSemanal) : 0,
    cumpleSemana, diasLaborales, diasCumplidos, diasDeficit, detalleDias,
    porcentajeSemanal: HORAS_SEMANALES_OBJETIVO > 0
      ? Math.min(100, Math.round((totalHorasRedondeadas / HORAS_SEMANALES_OBJETIVO) * 100))
      : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  DATA ACCESS — Usa tablas existentes: fichadas_colaboradores,
//  fichadas_registros, fichadas_totales_mensuales
// ═══════════════════════════════════════════════════════════════════

// ─── SECTORES: derivados del mapeo estático ──────────────────────
export async function listarSectores() {
  return getSectoresSedeStafe();
}

// ─── COLABORADORES: de fichadas_colaboradores, filtrados a Sede SF ─
export async function listarColaboradores(filtros = {}) {
  // Get all collaborators from fichadas_colaboradores
  const { data, error } = await supabase
    .from('fichadas_colaboradores')
    .select('*')
    .eq('activo', true)
    .order('nombre_completo');

  if (error) throw error;
  if (!data) return [];

  // Filter to only Sede Santa Fe collaborators
  const allNamesSF = Object.values(COLABORADORES_SEDE_SF).flat();

  const sfColabs = data.filter(c => {
    const upper = (c.nombre_completo || '').toUpperCase().trim();
    return allNamesSF.some(n => upper.includes(n) || n.includes(upper));
  }).map(c => {
    const sectorNombre = getSectorByNombre(c.nombre_completo);
    return {
      ...c,
      sector: sectorNombre ? {
        id: sectorNombre,
        nombre: sectorNombre,
        color: SECTOR_COLORS[sectorNombre] || '#94a3b8',
      } : null,
    };
  });

  // Filter by sector if requested
  if (filtros.sector_id) {
    return sfColabs.filter(c => c.sector?.nombre === filtros.sector_id);
  }

  return sfColabs;
}

// ─── FICHADAS: de fichadas_registros ─────────────────────────────
export async function obtenerFichadasRegistros(filtros = {}) {
  let query = supabase
    .from('fichadas_registros')
    .select(`
      *,
      colaborador:fichadas_colaboradores(id, nombre_completo, area, sector)
    `)
    .order('fecha');

  if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id);
  if (filtros.fecha_desde) query = query.gte('fecha', filtros.fecha_desde);
  if (filtros.fecha_hasta) query = query.lte('fecha', filtros.fecha_hasta);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─── CRUCE PRINCIPAL ─────────────────────────────────────────────
/**
 * Construye el cruce de datos para Control Horario.
 * Usa fichadas_registros como fuente de datos reales.
 * No hay diagramas aún — solo fichadas.
 */
export async function cruzarDiagramaVsFichadas(fecha_desde, fecha_hasta) {
  const [colaboradores, allFichadas] = await Promise.all([
    listarColaboradores(),
    obtenerFichadasRegistros({ fecha_desde, fecha_hasta }),
  ]);

  // Index fichadas by colaborador_id + fecha
  const fichadaMap = {};
  for (const f of allFichadas) {
    const key = `${f.colaborador_id}_${f.fecha}`;
    // If there are multiple records for same day, pick the one with most hours
    if (!fichadaMap[key] || (f.horas_trabajadas_min || 0) > (fichadaMap[key].horas_trabajadas_min || 0)) {
      fichadaMap[key] = f;
    }
  }

  const resultado = [];
  for (const colab of colaboradores) {
    const dias = [];
    const start = new Date(fecha_desde + 'T12:00:00');
    const end = new Date(fecha_hasta + 'T12:00:00');

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const fechaStr = d.toISOString().slice(0, 10);
      const key = `${colab.id}_${fechaStr}`;
      const fichada = fichadaMap[key] || null;

      let estado = 'sin_datos';
      if (fichada && fichada.horas_trabajadas_min > 0) {
        const dayEval = evaluarCumplimientoDiario(fichada, fechaStr);
        if (dayEval.esDiaLaboral) {
          estado = dayEval.cumple ? 'cumplido' : 'llegada_tarde';
        } else {
          estado = 'trabajo_en_franco';
        }
      }

      // Map fichada fields to the format expected by the component
      const fichadaNormalizada = fichada ? {
        hora_ingreso: fichada.fichada_entrada,
        hora_egreso: fichada.fichada_salida,
        horas_trabajadas_min: fichada.horas_trabajadas_min || 0,
        horas_redondeadas_min: fichada.horas_redondeadas_min || 0,
      } : null;

      dias.push({
        fecha: fechaStr,
        diagrama: null, // No diagrams loaded yet
        fichada: fichadaNormalizada,
        estado,
        minutoDiferencia: 0,
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
    cumplidos: 0, llegadasTarde: 0, ausencias: 0,
    francos: 0, sinDatos: 0, sinDiagrama: 0, trabajoEnFranco: 0,
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

export function calcularEstadisticasPorSector(cruceData) {
  const porSector = {};
  for (const colab of cruceData) {
    const sectorNombre = colab.colaborador?.sector?.nombre || 'SIN SECTOR';
    const sectorColor = colab.colaborador?.sector?.color || '#94A3B8';
    if (!porSector[sectorNombre]) {
      porSector[sectorNombre] = {
        nombre: sectorNombre, color: sectorColor,
        totalColaboradores: 0, cumplidos: 0, llegadasTarde: 0,
        ausencias: 0, francos: 0, sinDatos: 0, colaboradores: [],
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
  return timeStr.slice(0, 5);
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

export function getWeekRange(refDate = new Date()) {
  const d = new Date(refDate);
  const dayOfWeek = d.getDay();
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    desde: monday.toISOString().slice(0, 10),
    hasta: sunday.toISOString().slice(0, 10),
  };
}

export function getMonthRange(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  return {
    desde: firstDay.toISOString().slice(0, 10),
    hasta: lastDay.toISOString().slice(0, 10),
  };
}

// Legacy compat — guardarFichada not needed since we read from fichadas_registros
export async function guardarFichada() {
  console.warn('[ControlHorario] guardarFichada no disponible — usar módulo de Fichadas');
}
