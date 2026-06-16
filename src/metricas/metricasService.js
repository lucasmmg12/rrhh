/**
 * Métricas Santa Fe — Service Layer
 * Handles Excel parsing, Supabase CRUD, and client-side data aggregation.
 */
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

// ─── TABLE NAME ─────────────────────────────────────────────
const TABLE = 'metricas_visitas_sf';

// ─── EXCEL SERIAL → JS DATE ────────────────────────────────
function excelSerialToDate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000);
}

function excelFractionToHour(fraction) {
  if (fraction == null || typeof fraction !== 'number') return { hour: 0, time: '00:00:00' };
  const totalMinutes = Math.round(fraction * 24 * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return {
    hour: h,
    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`,
  };
}

// ─── PARSE XLSX → RECORDS ───────────────────────────────────
export function parseRevisionXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);

        const records = rows.map(row => {
          const fechaDate = excelSerialToDate(row['Fecha Visita']);
          const horaInfo = excelFractionToHour(row['Hora Visita']);

          return {
            id_visita: row['idVisita'],
            fecha_visita: fechaDate ? fechaDate.toISOString().slice(0, 10) : null,
            mes: row['Mes'] || (fechaDate ? fechaDate.getMonth() + 1 : null),
            hora_visita: horaInfo.time,
            hora_numero: horaInfo.hour,
            dia_semana: fechaDate ? fechaDate.getDay() : null,
            asistencia: row['Asistencia'] || null,
            paciente: row['Paciente'] || null,
            grupo_agenda: row['Grupo Agenda'] || null,
            especialidad: row['Visita_Especialidad'] || null,
            cliente: row['Cliente'] || null,
            responsable: row['Responsable'] || null,
            tipo_visita: row['Tipo Visita'] || null,
            centro: row['Centro'] || 'SANTA FE',
          };
        }).filter(r => r.id_visita && r.fecha_visita);

        resolve(records);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── UPLOAD TO SUPABASE (BATCH UPSERT) ─────────────────────
export async function uploadRecords(records, onProgress) {
  const BATCH_SIZE = 500;
  const total = records.length;
  let uploaded = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from(TABLE)
      .upsert(batch, { onConflict: 'id_visita' });

    if (error) throw new Error(`Error en batch ${i}: ${error.message}`);
    uploaded += batch.length;
    onProgress?.(Math.min(100, Math.round((uploaded / total) * 100)));
  }

  return uploaded;
}

// ─── FETCH ALL RECORDS ──────────────────────────────────────
export async function fetchVisitasSF() {
  // Supabase default limit is 1000, we need all records
  const allRecords = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id_visita, fecha_visita, mes, hora_numero, dia_semana, asistencia, especialidad, cliente, responsable, tipo_visita')
      .range(from, from + PAGE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    allRecords.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return allRecords;
}

// ─── GET RECORD COUNT ───────────────────────────────────────
export async function getRecordCount() {
  const { count, error } = await supabase
    .from(TABLE)
    .select('id_visita', { count: 'exact', head: true });
  if (error) return 0;
  return count || 0;
}

// ─── DELETE ALL RECORDS (for full refresh) ──────────────────
export async function deleteAllRecords() {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .neq('id_visita', 0); // deletes all rows
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════
//  AGGREGATION FUNCTIONS (Client-side)
// ═══════════════════════════════════════════════════════════

const DIAS_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ─── HEATMAP: Visits by Day of Week ────────────────────────
export function getHeatmapDias(data) {
  const counts = new Array(7).fill(0);
  data.forEach(d => {
    if (d.dia_semana != null) counts[d.dia_semana]++;
  });

  // Reorder to start from Monday: [Lun, Mar, Mié, Jue, Vie, Sáb, Dom]
  const ordered = [1, 2, 3, 4, 5, 6, 0];
  const maxVal = Math.max(...counts, 1);

  return ordered.map(i => ({
    label: DIAS_LABELS[i],
    value: counts[i],
    intensity: counts[i] / maxVal,
  }));
}

// ─── HEATMAP: Visits by Hour of Day ────────────────────────
export function getHeatmapHoras(data) {
  const counts = new Array(24).fill(0);
  data.forEach(d => {
    if (d.hora_numero != null && d.hora_numero >= 0 && d.hora_numero < 24) {
      counts[d.hora_numero]++;
    }
  });

  const maxVal = Math.max(...counts, 1);

  return counts.map((val, h) => ({
    label: `${String(h).padStart(2, '0')}:00`,
    value: val,
    intensity: val / maxVal,
  }));
}

// ─── PIE: Top Obras Sociales (Cliente) ─────────────────────
export function getObrasSociales(data, topN = 10) {
  const counts = {};
  data.forEach(d => {
    if (d.cliente) {
      // Clean up the client name: remove leading number prefix
      const name = d.cliente.replace(/^\d+\s*-\s*/, '').trim();
      counts[name] = (counts[name] || 0) + 1;
    }
  });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]);

  const top = sorted.slice(0, topN);
  const othersCount = sorted.slice(topN).reduce((sum, [, v]) => sum + v, 0);

  const COLORS = [
    '#1E5FA6', '#0891B2', '#059669', '#7C3AED', '#D97706',
    '#DC2626', '#2563EB', '#0D9488', '#9333EA', '#EA580C',
  ];

  const result = top.map(([name, value], i) => ({
    name: name.length > 25 ? name.substring(0, 22) + '...' : name,
    fullName: name,
    value,
    color: COLORS[i % COLORS.length],
  }));

  if (othersCount > 0) {
    result.push({ name: 'Otros', fullName: 'Otros', value: othersCount, color: '#94A3B8' });
  }

  return result;
}

// ─── RANKING: Especialidades ───────────────────────────────
export function getRankingEspecialidades(data, topN = 15) {
  return buildRanking(data, 'especialidad', topN);
}

// ─── RANKING: Médicos (Responsable) ────────────────────────
export function getRankingMedicos(data, topN = 15) {
  return buildRanking(data, 'responsable', topN);
}

// ─── RANKING: Tipo de Visita ───────────────────────────────
export function getRankingTipoVisita(data, topN = 15) {
  return buildRanking(data, 'tipo_visita', topN);
}

// ─── LINE: Visitas por Mes ─────────────────────────────────
export function getVisitasPorMes(data) {
  const counts = {};
  data.forEach(d => {
    if (d.fecha_visita) {
      const key = d.fecha_visita.slice(0, 7); // YYYY-MM
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => {
      const [year, month] = key.split('-');
      return {
        key,
        label: `${MESES_LABELS[parseInt(month, 10) - 1]} ${year}`,
        shortLabel: MESES_LABELS[parseInt(month, 10) - 1],
        value,
      };
    });
}

// ─── Generic Ranking Builder ───────────────────────────────
function buildRanking(data, field, topN) {
  const counts = {};
  data.forEach(d => {
    const val = d[field];
    if (val) {
      counts[val] = (counts[val] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name, value], i) => ({
      name: name.length > 35 ? name.substring(0, 32) + '...' : name,
      fullName: name,
      value,
      rank: i + 1,
    }));
}
