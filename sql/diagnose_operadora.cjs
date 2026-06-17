/**
 * Diagnóstico: verificar el estado de los campos operadora en la base de datos
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hakysnqiryimxbwdslwe.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhha3lzbnFpcnlpbXhid2RzbHdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA0MjI3NCwiZXhwIjoyMDg1NjE4Mjc0fQ.v0Zw7yFjGKJX8xsMCZJPwRyhr2eNd1gjASsI7qSK0YM';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function diagnose() {
  console.log('═══════════════════════════════════════════');
  console.log('  🔍 Diagnóstico: Operadoras en metricas_visitas_sf');
  console.log('═══════════════════════════════════════════\n');

  // 1. Total records
  const { count: total } = await supabase
    .from('metricas_visitas_sf')
    .select('id', { count: 'exact', head: true });
  console.log(`📊 Total registros: ${total}\n`);

  // 2. Check if columns exist by querying them
  const { data: probe, error: probeErr } = await supabase
    .from('metricas_visitas_sf')
    .select('usuario_cita_raw, operadora, sector_operadora')
    .limit(1);
  
  if (probeErr) {
    console.log(`❌ Las columnas NO existen: ${probeErr.message}`);
    return;
  }
  console.log('✅ Columnas operadora existen en la tabla\n');

  // 3. Count non-null usuario_cita_raw
  const { count: conRaw } = await supabase
    .from('metricas_visitas_sf')
    .select('id', { count: 'exact', head: true })
    .not('usuario_cita_raw', 'is', null);
  console.log(`📝 Registros con usuario_cita_raw: ${conRaw} / ${total}`);

  // 4. Count non-null operadora
  const { count: conOp } = await supabase
    .from('metricas_visitas_sf')
    .select('id', { count: 'exact', head: true })
    .not('operadora', 'is', null);
  console.log(`👩‍💼 Registros con operadora: ${conOp} / ${total}\n`);

  // 5. Show 5 sample usuario_cita_raw values
  const { data: samples } = await supabase
    .from('metricas_visitas_sf')
    .select('id_visita, usuario_cita_raw, operadora, sector_operadora')
    .not('usuario_cita_raw', 'is', null)
    .limit(5);

  if (samples && samples.length > 0) {
    console.log('📋 Muestras con usuario_cita_raw:');
    samples.forEach((s, i) => {
      console.log(`\n  [${i + 1}] id_visita: ${s.id_visita}`);
      console.log(`      raw: "${(s.usuario_cita_raw || '').substring(0, 150)}..."`);
      console.log(`      operadora: ${s.operadora || 'NULL'}`);
      console.log(`      sector: ${s.sector_operadora || 'NULL'}`);
    });
  } else {
    console.log('⚠️  No hay registros con usuario_cita_raw populado.');
    console.log('   → Los datos fueron subidos ANTES de agregar las columnas.');
    console.log('   → Necesitás RE-SUBIR el revision.xlsx desde el dashboard.\n');

    // Check a sample without the raw field to see what data exists
    const { data: anySamples } = await supabase
      .from('metricas_visitas_sf')
      .select('id_visita, paciente, especialidad, responsable')
      .limit(3);
    if (anySamples) {
      console.log('📋 Muestras de registros existentes (sin campo raw):');
      anySamples.forEach((s, i) => {
        console.log(`  [${i + 1}] id:${s.id_visita} | pac:${s.paciente} | esp:${s.especialidad}`);
      });
    }
  }

  console.log('\n═══════════════════════════════════════════');
}

diagnose().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
