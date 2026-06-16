/**
 * Seed script: Upload revision.xlsx → Supabase metricas_visitas_sf
 * Uses service_role key for unrestricted insert access.
 */
const XLSX = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ─── Config ───
const SUPABASE_URL = 'https://hakysnqiryimxbwdslwe.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhha3lzbnFpcnlpbXhid2RzbHdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA0MjI3NCwiZXhwIjoyMDg1NjE4Mjc0fQ.v0Zw7yFjGKJX8xsMCZJPwRyhr2eNd1gjASsI7qSK0YM';
const XLSX_PATH = path.resolve(__dirname, '..', '..', 'revision.xlsx');
const TABLE = 'metricas_visitas_sf';
const BATCH_SIZE = 500;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ─── Excel serial → JS Date ───
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

// ─── Main ───
async function seed() {
  console.log('═══════════════════════════════════════════');
  console.log('  📊 Seed: revision.xlsx → Supabase');
  console.log('═══════════════════════════════════════════\n');

  // 1. Verify connection
  console.log('🔌 Verificando conexión a Supabase...');
  const { count, error: countErr } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true });

  if (countErr) {
    console.error('❌ Error conectando a tabla:', countErr.message);
    process.exit(1);
  }
  console.log(`✅ Conectado. Registros actuales en tabla: ${count || 0}\n`);

  // 2. Read Excel
  console.log(`📖 Leyendo ${XLSX_PATH}...`);
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  console.log(`   → ${rows.length} filas encontradas\n`);

  // 3. Transform
  console.log('🔄 Transformando datos...');
  const records = [];
  let skipped = 0;

  for (const row of rows) {
    const idVisita = row['idVisita'];
    const fechaDate = excelSerialToDate(row['Fecha Visita']);

    if (!idVisita || !fechaDate) {
      skipped++;
      continue;
    }

    const horaInfo = excelFractionToHour(row['Hora Visita']);

    records.push({
      id_visita: idVisita,
      fecha_visita: fechaDate.toISOString().slice(0, 10),
      mes: row['Mes'] || (fechaDate.getMonth() + 1),
      hora_visita: horaInfo.time,
      hora_numero: horaInfo.hour,
      dia_semana: fechaDate.getDay(),
      asistencia: row['Asistencia'] || null,
      paciente: row['Paciente'] || null,
      grupo_agenda: row['Grupo Agenda'] || null,
      especialidad: row['Visita_Especialidad'] || null,
      cliente: row['Cliente'] || null,
      responsable: row['Responsable'] || null,
      tipo_visita: row['Tipo Visita'] || null,
      centro: row['Centro'] || 'SANTA FE',
    });
  }

  console.log(`   → ${records.length} registros válidos (${skipped} omitidos)\n`);

  // 4. Upload in batches
  console.log(`📤 Subiendo a Supabase en batches de ${BATCH_SIZE}...`);
  const totalBatches = Math.ceil(records.length / BATCH_SIZE);
  let uploaded = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = records.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from(TABLE)
      .upsert(batch, { onConflict: 'id_visita' });

    if (error) {
      console.error(`   ❌ Batch ${batchNum}/${totalBatches}: ${error.message}`);
      errors++;
    } else {
      uploaded += batch.length;
      const pct = Math.round((uploaded / records.length) * 100);
      // Progress bar
      const barLen = 30;
      const filled = Math.round((pct / 100) * barLen);
      const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
      process.stdout.write(`\r   [${bar}] ${pct}% — ${uploaded.toLocaleString()}/${records.length.toLocaleString()} registros`);
    }
  }

  console.log('\n');

  // 5. Verify final count
  const { count: finalCount } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true });

  console.log('═══════════════════════════════════════════');
  console.log(`  ✅ Seed completado!`);
  console.log(`  📊 Registros en tabla: ${(finalCount || 0).toLocaleString()}`);
  console.log(`  📤 Subidos esta vez: ${uploaded.toLocaleString()}`);
  if (errors > 0) console.log(`  ⚠️  Batches con error: ${errors}`);
  console.log('═══════════════════════════════════════════');
}

seed().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
