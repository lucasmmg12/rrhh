/**
 * PDF Parser para Fichadas de Sanatorio Argentino
 * Extrae datos de horas totalizadas del formato estándar del sistema legacy
 * 
 * COLUMN LAYOUT (approximate X positions from debug):
 * x=23:  Nombre colaborador
 * x=33:  "Fecha" header
 * x=114: Date column (dd-mmm.-yy)
 * x=153: "Fichadas" header
 * x=161: Primera fichada (entrada)
 * x=185: Segunda fichada (salida)
 * x=354: Redondeadas
 * x=381: Trabajadas
 * x=412: Cumplidas
 * x=435: Adicionales
 * x=459: Intermedias
 * x=483: Hora Extras
 * x=497: Registradas
 * x=530: Tarde
 * x=554: Fuera de Hora
 * x=578: Incompletas
 * x=601: Excepciones
 * x=613-636: Horario (Al 50%, Al 100%, Entrada, Salida)
 * x=748: Carga Horaria
 */
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

// X position thresholds for column detection
const COL = {
  FICHADA_ENTRADA_MIN: 140,
  FICHADA_ENTRADA_MAX: 175,
  FICHADA_SALIDA_MIN: 176,
  FICHADA_SALIDA_MAX: 210,
  DATA_COLS_START: 340,    // Redondeadas and beyond
  HORARIO_MIN: 600,
  CARGA_HORARIA_MIN: 730,
};

/**
 * Parse a PDF file and extract fichadas data
 * @param {File} file - The PDF file to parse
 * @returns {Promise<{area: string, mes: number, anio: number, colaboradores: Array}>}
 */
export async function parseFichadasPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items.map(item => ({
      text: item.str,
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      width: item.width,
    }));

    const lines = groupByLines(items, 3);
    allLines.push(...lines);
  }

  return extractData(allLines);
}

/**
 * Group text items into lines by Y coordinate
 */
function groupByLines(items, tolerance = 3) {
  if (!items.length) return [];

  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) <= tolerance) return a.x - b.x;
    return b.y - a.y;
  });

  const lines = [];
  let currentLine = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentY) <= tolerance) {
      currentLine.push(sorted[i]);
    } else {
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(currentLine);
      currentLine = [sorted[i]];
      currentY = sorted[i].y;
    }
  }
  if (currentLine.length) {
    currentLine.sort((a, b) => a.x - b.x);
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Month mapping
 */
const MESES = {
  'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
  'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12
};

/**
 * Extract structured data from grouped text lines
 */
function extractData(lines) {
  const result = {
    area: '',
    mes: 0,
    anio: 0,
    colaboradores: [],
  };

  let currentColaborador = null;

  for (const lineItems of lines) {
    const lineText = lineItems.map(i => i.text).join(' ').trim();

    if (!lineText || lineText.length < 2) continue;

    // Skip pagination lines ("Página X de Y")
    if (/Página\s+\d+\s+de\s+\d+/i.test(lineText)) continue;

    // Skip header column names
    if (/Redondeo|Trabajadas|Adicionales|Intermedias|Hora\s*Extra|Registrada|Excedentes|Incumplidas|Fuera\s+de\s+Hora|Carga\s+Horaria|Cumlidas|Al\s+\d+%/i.test(lineText)) continue;
    if (/^Fecha|^Fichadas|^Tarde|^Entra|^Salida|^da$/i.test(lineText.trim())) continue;
    if (/Horario/.test(lineText) && lineText.length < 20) continue;

    // Detect area header: "Horas Totalizadas de XXXX"
    const areaMatch = lineText.match(/Horas\s+Totalizadas\s+de\s+(.+)/i);
    if (areaMatch) {
      result.area = areaMatch[1].trim();
      continue;
    }

    // Detect period: "mar 2026" or "mar. 2026"
    const periodMatch = lineText.match(/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s*\.?\s*(\d{4})\b/i);
    if (periodMatch && !result.mes) {
      result.mes = MESES[periodMatch[1].toLowerCase().substring(0, 3)] || 0;
      result.anio = parseInt(periodMatch[2]);
      continue;
    }

    // Detect collaborator name
    if (isCollaboratorName(lineText, lineItems)) {
      if (currentColaborador) {
        result.colaboradores.push(currentColaborador);
      }
      currentColaborador = {
        nombre: lineText.trim(),
        registros: [],
        totales: {}
      };
      continue;
    }

    // Detect date line (fichada record): "dd-mmm.-yy"
    const dateMatch = lineText.match(/(\d{1,2})-(\w{3,4})\.?-(\d{2,4})/);
    if (dateMatch && currentColaborador) {
      const record = parseFichadaLine(lineItems, dateMatch);
      if (record) {
        currentColaborador.registros.push(record);
      }
      continue;
    }

    // Subtotal lines (e.g. "28:22m", "27:0m") — skip, we recalculate
    if (/\d+:\d+\s*m\b/.test(lineText) || /^\s*\d+:\s*\d+\s*$/.test(lineText)) {
      continue;
    }
  }

  // Push last collaborator
  if (currentColaborador) {
    result.colaboradores.push(currentColaborador);
  }

  // Calculate totals for each collaborator
  for (const colab of result.colaboradores) {
    calculateTotals(colab);
  }

  console.log(`[Parser] Area: ${result.area}, Periodo: ${result.mes}/${result.anio}`);
  console.log(`[Parser] Colaboradores: ${result.colaboradores.length}`);
  for (const c of result.colaboradores) {
    console.log(`  - ${c.nombre}: ${c.registros.length} registros, ${formatMinToHHMM(c.totales.horas_trabajadas_min)} trabajadas, ${formatMinToHHMM(c.totales.horas_redondeadas_min)} redondeadas`);
  }

  return result;
}

/**
 * Check if a line is a collaborator name
 */
function isCollaboratorName(text, lineItems) {
  const cleaned = text.trim();
  if (cleaned.length < 5) return false;

  // Check if starts at leftmost position (x ~= 23)
  const firstItemX = lineItems[0]?.x || 0;
  const nonSpaceItems = lineItems.filter(i => i.text.trim().length > 0);
  const firstNonSpaceX = nonSpaceItems[0]?.x || firstItemX;

  // Name items are at x < 100
  if (firstNonSpaceX > 100) return false;

  // Must not start with a number
  if (/^\d/.test(cleaned)) return false;
  // Must not contain time patterns
  if (/\d{2}:\d{2}/.test(cleaned)) return false;
  // Must not contain date patterns
  if (/\d{1,2}-\w{3}/.test(cleaned)) return false;
  // Must not be a section header
  if (/sanatorio|horas|totalizadas|horario|fecha|fichadas|página|redondeo|trabajada|intermedia|adicional/i.test(cleaned)) return false;

  // Must be predominantly uppercase
  const upperCount = (cleaned.match(/[A-ZÁÉÍÓÚÑÜ]/g) || []).length;
  const letterCount = (cleaned.match(/[a-záéíóúñüA-ZÁÉÍÓÚÑÜ]/g) || []).length;
  return letterCount >= 4 && upperCount / letterCount > 0.7;
}

/**
 * Parse a single fichada line into a record
 * Uses X positions to correctly identify entrada vs salida vs calculated columns
 */
function parseFichadaLine(lineItems, dateMatch) {
  // Extract date
  const day = parseInt(dateMatch[1]);
  const monthStr = dateMatch[2].toLowerCase().replace('.', '').substring(0, 3);
  let year = parseInt(dateMatch[3]);
  if (year < 100) year += 2000;
  const month = MESES[monthStr] || 0;

  if (!month || !day) return null;

  // Extract times by X position
  let fichadaEntrada = null;
  let fichadaSalida = null;
  let horasRedondeadas = null;
  let horasTrabajadas = null;
  let horarioAsignado = null;
  let cargaHoraria = '00:00';

  for (const item of lineItems) {
    const text = item.text.trim();
    const x = item.x;
    const timeMatch = text.match(/^(\d{1,2}):(\d{2})$/);

    if (!timeMatch) continue;

    const h = parseInt(timeMatch[1]);
    const m = parseInt(timeMatch[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) continue;

    const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    // Classify by X position
    if (x >= COL.FICHADA_ENTRADA_MIN && x <= COL.FICHADA_ENTRADA_MAX) {
      fichadaEntrada = formatted;
    } else if (x >= COL.FICHADA_SALIDA_MIN && x <= COL.FICHADA_SALIDA_MAX) {
      fichadaSalida = formatted;
    } else if (x >= COL.DATA_COLS_START && x < COL.DATA_COLS_START + 40) {
      horasRedondeadas = formatted;
    } else if (x >= COL.DATA_COLS_START + 20 && x < COL.DATA_COLS_START + 60) {
      horasTrabajadas = formatted;
    } else if (x >= COL.HORARIO_MIN && x < COL.CARGA_HORARIA_MIN) {
      horarioAsignado = formatted;
    } else if (x >= COL.CARGA_HORARIA_MIN) {
      cargaHoraria = formatted;
    }
  }

  const record = {
    fecha: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    fichada_entrada: fichadaEntrada,
    fichada_salida: fichadaSalida,
    horas_trabajadas_min: 0,
    horas_redondeadas_min: 0,
    horario_asignado: horarioAsignado,
    carga_horaria: cargaHoraria,
    datos_raw: {},
  };

  // Calculate worked hours from fichada entrada/salida
  if (fichadaEntrada && fichadaSalida) {
    const entradaParts = fichadaEntrada.split(':').map(Number);
    const salidaParts = fichadaSalida.split(':').map(Number);
    const entradaMin = entradaParts[0] * 60 + entradaParts[1];
    const salidaMin = salidaParts[0] * 60 + salidaParts[1];
    let workedMin = salidaMin - entradaMin;
    if (workedMin < 0) workedMin += 24 * 60; // overnight shift
    record.horas_trabajadas_min = workedMin;

    // Apply rounding rule: >=45 min rounds up, <45 rounds down
    const fullHours = Math.floor(workedMin / 60);
    const remainingMin = workedMin % 60;
    record.horas_redondeadas_min = remainingMin >= 45
      ? (fullHours + 1) * 60
      : fullHours * 60;
  }

  return record;
}

/**
 * Calculate totals for a collaborator based on their records
 */
function calculateTotals(colab) {
  let totalTrabajadas = 0;
  let totalRedondeadas = 0;
  let diasTrabajados = 0;

  for (const reg of colab.registros) {
    if (reg.horas_trabajadas_min > 0) {
      totalTrabajadas += reg.horas_trabajadas_min;
      totalRedondeadas += reg.horas_redondeadas_min;
      diasTrabajados++;
    }
  }

  colab.totales = {
    horas_trabajadas_min: totalTrabajadas,
    horas_redondeadas_min: totalRedondeadas,
    dias_trabajados: diasTrabajados,
    dias_tarde: 0,
    horas_extra_min: 0,
  };
}

/**
 * Format minutes to HH:MM string
 */
export function formatMinToHHMM(totalMin) {
  if (!totalMin && totalMin !== 0) return '00:00';
  const hours = Math.floor(Math.abs(totalMin) / 60);
  const mins = Math.abs(totalMin) % 60;
  const sign = totalMin < 0 ? '-' : '';
  return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Format minutes to display as "Xh YYm"
 */
export function formatMinToDisplay(totalMin) {
  if (!totalMin && totalMin !== 0) return '0h 00m';
  const hours = Math.floor(Math.abs(totalMin) / 60);
  const mins = Math.abs(totalMin) % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

/**
 * Apply the rounding rule to a total of minutes:
 * >=45 min remainder → round up to next hour
 * <45 min remainder → round down
 */
export function roundHours(totalMinutes) {
  const fullHours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  return remainder >= 45 ? fullHours + 1 : fullHours;
}
