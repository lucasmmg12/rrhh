/**
 * migrate_prestadores.cjs
 * ────────────────────────
 * Migra los 49 registros del Google Form "Difusión NUEVOS PRESTADORES"
 * a la tabla `nuevos_prestadores` y sube las fotos al bucket `fotos-prestadores`.
 *
 * Usage: node sql/migrate_prestadores.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');

// ── Supabase config (service role for admin operations) ──
const SUPABASE_URL = 'https://hakysnqiryimxbwdslwe.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhha3lzbnFpcnlpbXhid2RzbHdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA0MjI3NCwiZXhwIjoyMDg1NjE4Mjc0fQ.v0Zw7yFjGKJX8xsMCZJPwRyhr2eNd1gjASsI7qSK0YM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── All 49 records from the Google Sheet ──
const RECORDS = [
  { timestamp: '12/12/2023 9:32:34', nombre: 'Dra. Flavia Viguera', especialidad: 'Neumonologia y geriatría', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1WyS8sDmTcigMsf8O52U1xpp0OaHxu7zr', comentarios: '' },
  { timestamp: '12/12/2023 9:43:42', nombre: 'Dr. Jorge E. Castro', especialidad: 'Diabetologia', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '1AMrP7mLPyylea7w8l7Z_tzCHMQzlG2BO', comentarios: 'Días: Martes 13hs a 16.30 hs' },
  { timestamp: '28/12/2023 22:06:18', nombre: 'DARIO JAVIER MENGUAL PEREZ', especialidad: 'Clínica médica y Nefrología', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '1VaUJEs1KK9hrthkmcdO1HBJ5u_aeaJvf', comentarios: '' },
  { timestamp: '30/01/2024 15:01:48', nombre: 'Robles Carolina', especialidad: 'Cardiología Imágenes', sedes: 'Sede 1 (San Luis 432 oeste)', driveId: '1x8NU-QBGFj8A7MjZbeiUT0e9LK_Ki73s', comentarios: '' },
  { timestamp: '6/02/2024 20:04:07', nombre: 'Paola Guadalupe Garcia', especialidad: 'Clínica Médica', sedes: 'Sede 1 (San Luis 432 oeste)', driveId: '1umEfVth7PciME83nhOrNkF90doUTbKgk', comentarios: 'Mis horarios son: Martes y jueves de 8 a 12 y miércoles de 16 a 20' },
  { timestamp: '20/02/2024 18:07:16', nombre: 'Celio Eduardo Torres Arroyo', especialidad: 'Urologo', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1A65pFJh4xEDgltlLxUjzjlBj7hfW6jUp', comentarios: '' },
  { timestamp: '26/02/2024 0:53:05', nombre: 'Danilo Andrade Gonzalez', especialidad: 'Ginecologia y obstetricia', sedes: 'Sede Santa Fe - Sector 2', driveId: '14xHyFnxodcYiIoMMSsPW7YBYbweTFruk', comentarios: '' },
  { timestamp: '27/02/2024 11:56:26', nombre: 'Celina Ruarte Lopez', especialidad: 'Servicio de imágenes cardiovasculares', sedes: 'Sede 1 (San Luis 432 oeste)', driveId: '16I2QBnwathaGi8g6dHALkoZHp5TFbVgc', comentarios: '' },
  { timestamp: '27/02/2024 11:58:23', nombre: 'Gerbec Daniela', especialidad: 'Servicio de Imagenes Cardiovasculares', sedes: 'Sede 1 (San Luis 432 oeste)', driveId: '17Cm0kIIslO_kC11eivL103-FN5VIKAHB', comentarios: '' },
  { timestamp: '4/04/2024 15:10:51', nombre: 'Melisa Antonella Gangitano', especialidad: 'Nutrición clínica', sedes: 'Sede Santa Fe - Sector 2', driveId: '1k6Mw72OQkwyZEWtAF7FwfFrCLdqCWmV4', comentarios: 'Atención adultos y niños. Embarazadas' },
  { timestamp: '8/04/2024 16:44:23', nombre: 'Federico Rojo', especialidad: 'Urologia', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1FLEeSlQQtbUCV0N535lOTCLA6RPZ1rrB', comentarios: '' },
  { timestamp: '10/04/2024 8:37:49', nombre: 'Pamela Rojas', especialidad: 'Lic. en Kinesiología y Fisioterapia', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1mPp_CVOmBZpaKUY_0_GC_IwupXXFjuzc', comentarios: '' },
  { timestamp: '24/04/2024 19:34:51', nombre: 'Susana porres', especialidad: 'Lic. Kinesiologia y fisioterapia / Drenaje Linfatico manual', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '1N4b_rbO1I4733G7dHpXrvX-l_nss97Xa', comentarios: '' },
  { timestamp: '25/04/2024 10:51:55', nombre: 'María Elisabet Paredes', especialidad: 'Nutricion', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1t3tHyMqVl_3Abznv7UU0SV4O49OPps-T', comentarios: '' },
  { timestamp: '29/04/2024 12:09:14', nombre: 'Nahir Ayelen Alé Moreno', especialidad: 'Lic.Nutricion. Nutrición deportiva, estudios antrometricos, Nutrición y Microbiota', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '10PqdR1HvbMFQ39gcQg05wHSbFH0D9gjW', comentarios: 'Atiendo dos veces al mes. Mes de mayo la atención será 22 y 29/5' },
  { timestamp: '8/05/2024 20:17:52', nombre: 'Susana porres', especialidad: 'Drenaje linfático manual', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '1TDIY-lcyHGMxKMjSzcDxCTIg9KX0B2Tj', comentarios: '' },
  { timestamp: '9/05/2024 18:58:24', nombre: 'Leslie Sosa', especialidad: 'Lic kinesiologia y fisioterapia especialista en Rehabilitación de piso pélvico pediatrico', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1S7juCFM2ZRz2g3dM_txVcsepe_TTSfeo', comentarios: '' },
  { timestamp: '15/05/2024 19:48:46', nombre: 'Marcos Rojas Clevers', especialidad: 'Medicina General y Familiar', sedes: 'Sede 1 (San Luis 432 oeste)', driveId: '1YdiQPur9JNL3q4I1kNl2HZ-zqUFeReZU', comentarios: '' },
  { timestamp: '3/06/2024 15:07:47', nombre: 'Franco mombello', especialidad: 'Ortopedia y traumatología (pierna, tobillo y pie)', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '1pziqRbyFnFswNLU4AoPHTYgLIul9tbCG', comentarios: '' },
  { timestamp: '24/06/2024 10:28:50', nombre: 'Paula Elena gallego', especialidad: 'Clínica geriatría medicina del dolor', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1hZaz4CYoVp_Af1EdHIsSy7xsS2WqH2gH', comentarios: 'Medicina del dolor crónico' },
  { timestamp: '22/07/2024 20:39:23', nombre: 'Graciela Julia Sisterna de Romero', especialidad: 'Psicopedagoga', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1VlQ5Wd2H3KrxkxtOB8_O4J0bt4eaBj6M', comentarios: 'También me gustaría agregar que soy Doctora en Educación.' },
  { timestamp: '25/07/2024 17:44:30', nombre: 'Federico Morales Martínez', especialidad: 'Cardiología Pediatrica', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1y8W_C2NC9_UKPDVJI0g0DTBj44Iwu9Lb', comentarios: '' },
  { timestamp: '5/09/2024 15:52:45', nombre: 'María Alejandra Rodano', especialidad: 'Seguimiento de Alto Riesgo y estimulación temprana', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '1ZaWId95LUakiE4vybtXX-inEP8d8DN47', comentarios: '' },
  { timestamp: '13/09/2024 19:42:10', nombre: 'Celeste Tejada Botella', especialidad: 'Clínica Médica', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '13RzxVOfYrCeqRFGRCtsol1YHHOnS_iZc', comentarios: '' },
  { timestamp: '19/09/2024 15:34:12', nombre: 'Daniela Navarro Belli', especialidad: 'Médica Especialista en Endocrinología', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '16ebKT2r0hH7_kNVBYm42wWZ255nOeMoQ', comentarios: '' },
  { timestamp: '2/10/2024 15:37:31', nombre: 'Melisa Contreras', especialidad: 'Clínica medica', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1eyg-bcTj2vQ7T9wGcw627aSws7I-HUkq', comentarios: '' },
  { timestamp: '3/10/2024 13:43:12', nombre: 'Jorge Alberto Clavel', especialidad: 'Clinica medica-terapia intensiva', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1RaumUyCVHDEM2Jyisumhs9DF4HYOPRy2', comentarios: '' },
  { timestamp: '13/11/2024 11:25:10', nombre: 'Sebastian Gasques', especialidad: 'Licenciado en nutrición', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '12meXLfETWNpoHBtB63xfzuibp5G_2nmS', comentarios: '' },
  { timestamp: '13/11/2024 11:30:50', nombre: 'Nievas José Eduardo', especialidad: 'Cardiología', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1ryKKfkDKYm0YHL6XBz2x_rB_2kIthQLH', comentarios: '' },
  { timestamp: '20/11/2024 21:06:01', nombre: 'Valentina Basualdo Diaz', especialidad: 'Clinica Medica- Obesidad', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1ZKCmuacdQG9e5fWli79t8RNYRFY-qUjD', comentarios: '' },
  { timestamp: '4/08/2025 19:55:46', nombre: 'María Paula Aciar Castro', especialidad: 'Diabetologia, obesidad magister en PINE', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '1_coK7XxzYMhXvXd1FvfVVfCIOpGG5dVK', comentarios: 'Médica de planta del hospital dr Federico Cantoni.' },
  { timestamp: '6/08/2025 10:17:50', nombre: 'Marco Gabriel Massano', especialidad: 'Cardiologia', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '1kuKHB0KS55IsLy69cMbSxFZ-F590uMx4', comentarios: '' },
  { timestamp: '1/09/2025 9:39:44', nombre: 'María Paula Aciar Castro', especialidad: 'Psicoinmunoneuroendocrinologia, diabetologia, obesidad', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1sSOpmzA5dF44abuHnyvjXD-e9sCJAAOa', comentarios: 'Atención día miércoles de 14 a 16 hs' },
  { timestamp: '2/09/2025 12:26:48', nombre: 'Aldana Giselle Vidal Fernandez', especialidad: 'Psiquiatra adultos. Psiquiatra perinatal', sedes: 'Sede Santa Fe - Sector 1', driveId: '16pdUwUs-6N40kYt85uEeH0lM6lOsBUJy', comentarios: '' },
  { timestamp: '2/09/2025 12:51:41', nombre: 'Aldana Vidal Fernandez', especialidad: 'Psiquiatra Adultos. Psiquiatra Perinatal', sedes: 'Sede Santa Fe - Sector 1, Sede Santa Fe - Sector 2', driveId: '1VXIeF7RbwcD8NuVeXfs3Sw8h2pcB0WhQ', comentarios: 'Formulario anterior correjidp' },
  { timestamp: '3/09/2025 18:03:49', nombre: 'Pareja Suarez Erica Yamil', especialidad: 'ENDOCRINOLOGIA INFANTIL', sedes: 'Sede 1 (San Luis 432 oeste)', driveId: '1UXUuaCRkJMjEnRkiKozPZ1KCfU3yN90b', comentarios: '' },
  { timestamp: '29/09/2025 19:08:24', nombre: 'Micaela Montiveros', especialidad: 'Tocoginecologa especialista en fertilidad', sedes: 'Sede 2 (San Luis 433 oeste), Sede Santa Fe - Sector 2', driveId: '1alDZxDI3u9OS02FkqEbzP7EWCShH7UQw', comentarios: '' },
  { timestamp: '30/09/2025 14:18:31', nombre: 'Gabriel Navarta', especialidad: 'Cirujano de cabeza y cuello', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1Q0saDJLDzgZycKqm5aKAR4ZBKF_ZqVAb', comentarios: '' },
  { timestamp: '30/09/2025 17:08:58', nombre: 'Cumine luz', especialidad: 'Tocoginecologia', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '1vT0wYkNVQ8dNaIcm2zaO2B3XB4ziRruu', comentarios: 'Martes de 17 a 21 hs.' },
  { timestamp: '1/10/2025 12:17:12', nombre: 'Sofía Michelle Zárate Montaña', especialidad: 'Tocoginecologia.', sedes: 'Sede Santa Fe - Sector 1', driveId: '1UKE5ksLYBKt6ND1nU2QmZ_CDY7AI_-Ky', comentarios: '' },
  { timestamp: '14/10/2025 22:53:06', nombre: 'HORACIO RAUL CAMERA ARRIGONI', especialidad: 'GERIATRIA', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1dxP7M3185P3uOEK9D7VtTeK9qOBVPzcz', comentarios: '' },
  { timestamp: '16/10/2025 10:17:01', nombre: 'Verónica Quiroga Gonella', especialidad: 'Psiquiatria', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '1KrTbEU10YL5nwpJHZz2hiEEOUXKP-4Xl', comentarios: '' },
  { timestamp: '28/11/2025 10:32:53', nombre: 'Pamela Inés Rojas', especialidad: 'Lic. en Kinesiología y Fisioterapia', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1t6iZCSnhoeGAvyvSk_9CsQRHU84lgnCr', comentarios: 'Traumatología, ortopedia y deporte. Drenaje linfático manual. Kinesiología dermatofuncional en postquirúrgicos' },
  { timestamp: '2/12/2025 16:41:10', nombre: 'Mariana Riveros', especialidad: 'Kinesiología deportiva y traumatológica, rehabilitación respiratoria adultos', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1KzyiuJBeTLwYBWxVoS9ZgKhfWtRnT3oI', comentarios: '' },
  { timestamp: '3/02/2026 11:51:04', nombre: 'Leandro Gustavo Aliaga Conte Grand', especialidad: 'Reumatologo', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '14OoLObIw3HYGVt_mIXhQj01IE87B7A3X', comentarios: '' },
  { timestamp: '3/02/2026 15:43:53', nombre: 'María Alejandra Godoy', especialidad: 'Lic en Psicología', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1dCPaD5j-fIh8boXEW13cydAE310Vy6Qh', comentarios: '' },
  { timestamp: '3/02/2026 16:40:56', nombre: 'Ruben Balmaceda', especialidad: 'Coloproctología', sedes: 'Sede 3 (San Luis 436 oeste)', driveId: '1LCTv-HYE1eXiAllYt3U1bF8W416vX2b4', comentarios: '' },
  { timestamp: '17/04/2026 10:57:09', nombre: 'Gerardo Raul Calvo Hidalgo', especialidad: 'Cardiologia', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '1CtqK9AI8mZYL4Ub1Bu5y5YM_N-qVbfUU', comentarios: '' },
  { timestamp: '8/05/2026 12:16:56', nombre: 'Pamela Torres Tello', especialidad: 'Licenciada en Nutrición', sedes: 'Sede 2 (San Luis 433 oeste)', driveId: '1Sdy8heruNzn6veI8UG-6pX-ku4SFbPV3', comentarios: '' },
];

// ── Parse sedes string into array ──
function parseSedes(sedesStr) {
  // Some entries have multiple sedes separated by ", " within the same string
  // e.g. "Sede Santa Fe - Sector 1, Sede Santa Fe - Sector 2"
  // We need to be careful: "Sede 2 (San Luis 433 oeste)" has commas that are NOT separators
  // The pattern is: sedes are separated by ", Sede" 
  const parts = sedesStr.split(/,\s*(?=Sede)/);
  return parts.map(s => s.trim()).filter(Boolean);
}

// ── Parse timestamp ──
function parseTimestamp(ts) {
  // Format: "12/12/2023 9:32:34" or "6/02/2024 20:04:07" (D/MM/YYYY H:mm:ss)
  const [datePart, timePart] = ts.split(' ');
  const [day, month, year] = datePart.split('/');
  const [hour, min, sec] = timePart.split(':');
  // Construct manually to avoid locale issues
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(min),
    parseInt(sec)
  );
}

// ── Download file from Google Drive ──
// Uses the lh3 thumbnail endpoint at max resolution which reliably serves the actual image
function downloadFromDrive(fileId, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    // Try the direct thumbnail URL first (most reliable for Google Forms uploads)
    const url = `https://lh3.googleusercontent.com/d/${fileId}=s1600`;

    function followRedirects(currentUrl, redirectsLeft) {
      const mod = currentUrl.startsWith('https') ? https : http;
      const req = mod.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*,*/*',
        }
      }, (res) => {
        // Follow redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (redirectsLeft <= 0) {
            reject(new Error(`Too many redirects for file ${fileId}`));
            return;
          }
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith('/')) {
            const parsed = new URL(currentUrl);
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          res.resume(); // consume response to free socket
          followRedirects(redirectUrl, redirectsLeft - 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for file ${fileId}`));
          return;
        }

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const contentType = res.headers['content-type'] || 'image/jpeg';
          resolve({ buffer, contentType });
        });
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error(`Timeout downloading file ${fileId}`));
      });
    }

    followRedirects(url, maxRedirects);
  });
}

// ── Detect file extension from content type ──
function getExtFromContentType(ct) {
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'jpg'; // default
}

// ── Main migration ──
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Migración de Prestadores — Google Sheets → DB  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\nTotal registros: ${RECORDS.length}\n`);

  let ok = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < RECORDS.length; i++) {
    const r = RECORDS[i];
    const idx = `[${String(i + 1).padStart(2, '0')}/${RECORDS.length}]`;

    try {
      process.stdout.write(`${idx} ${r.nombre.padEnd(40)} `);

      // 1. Download photo from Google Drive
      let fotoUrl = null;
      try {
        const { buffer, contentType } = await downloadFromDrive(r.driveId);
        const ext = getExtFromContentType(contentType);
        const fileName = `prestadores/${r.driveId}.${ext}`;

        // Check if it's actually an HTML page (virus scan warning or access denied)
        const firstBytes = buffer.slice(0, 100).toString('utf-8');
        if (firstBytes.includes('<!DOCTYPE') || firstBytes.includes('<html')) {
          throw new Error('Got HTML instead of image (access restricted or virus scan)');
        }

        // 2. Upload to Supabase Storage
        const { error: uploadErr } = await supabase.storage
          .from('fotos-prestadores')
          .upload(fileName, buffer, {
            contentType,
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadErr) throw new Error(`Storage: ${uploadErr.message}`);

        // 3. Get public URL
        const { data: urlData } = supabase.storage
          .from('fotos-prestadores')
          .getPublicUrl(fileName);

        fotoUrl = urlData?.publicUrl || null;
        process.stdout.write('📷 ');
      } catch (photoErr) {
        process.stdout.write('⚠️  ');
        errors.push({ nombre: r.nombre, error: `Photo: ${photoErr.message}` });
      }

      // 4. Parse sedes
      const sedes = parseSedes(r.sedes);

      // 5. Parse original timestamp
      const createdAt = parseTimestamp(r.timestamp);

      // 6. Insert record
      const { error: insertErr } = await supabase
        .from('nuevos_prestadores')
        .insert({
          nombre_completo: r.nombre.trim(),
          servicio_especialidad: r.especialidad.trim(),
          sedes,
          foto_url: fotoUrl,
          comentarios: r.comentarios.trim() || null,
          created_at: createdAt.toISOString(),
        });

      if (insertErr) throw new Error(`DB: ${insertErr.message}`);

      console.log('✅');
      ok++;
    } catch (err) {
      console.log('❌ ' + err.message);
      failed++;
      errors.push({ nombre: r.nombre, error: err.message });
    }
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log(`✅ Exitosos: ${ok}`);
  console.log(`❌ Fallidos: ${failed}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Errores:');
    errors.forEach(e => console.log(`   - ${e.nombre}: ${e.error}`));
  }

  console.log('\n🏁 Migración completada.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
