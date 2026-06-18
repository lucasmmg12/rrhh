/**
 * upload_prestadores_fotos.cjs
 * ────────────────────────────
 * Sube las fotos desde Google Drive al bucket fotos-prestadores
 * y actualiza foto_url en los registros existentes.
 *
 * Usage: node sql/upload_prestadores_fotos.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');

const SUPABASE_URL = 'https://hakysnqiryimxbwdslwe.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhha3lzbnFpcnlpbXhid2RzbHdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA0MjI3NCwiZXhwIjoyMDg1NjE4Mjc0fQ.v0Zw7yFjGKJX8xsMCZJPwRyhr2eNd1gjASsI7qSK0YM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Map: nombre → driveId (from the original sheet)
const DRIVE_MAP = [
  { nombre: 'Dra. Flavia Viguera', driveId: '1WyS8sDmTcigMsf8O52U1xpp0OaHxu7zr' },
  { nombre: 'Dr. Jorge E. Castro', driveId: '1AMrP7mLPyylea7w8l7Z_tzCHMQzlG2BO' },
  { nombre: 'DARIO JAVIER MENGUAL PEREZ', driveId: '1VaUJEs1KK9hrthkmcdO1HBJ5u_aeaJvf' },
  { nombre: 'Robles Carolina', driveId: '1x8NU-QBGFj8A7MjZbeiUT0e9LK_Ki73s' },
  { nombre: 'Paola Guadalupe Garcia', driveId: '1umEfVth7PciME83nhOrNkF90doUTbKgk' },
  { nombre: 'Celio Eduardo Torres Arroyo', driveId: '1A65pFJh4xEDgltlLxUjzjlBj7hfW6jUp' },
  { nombre: 'Danilo Andrade Gonzalez', driveId: '14xHyFnxodcYiIoMMSsPW7YBYbweTFruk' },
  { nombre: 'Celina Ruarte Lopez', driveId: '16I2QBnwathaGi8g6dHALkoZHp5TFbVgc' },
  { nombre: 'Gerbec Daniela', driveId: '17Cm0kIIslO_kC11eivL103-FN5VIKAHB' },
  { nombre: 'Melisa Antonella Gangitano', driveId: '1k6Mw72OQkwyZEWtAF7FwfFrCLdqCWmV4' },
  { nombre: 'Federico Rojo', driveId: '1FLEeSlQQtbUCV0N535lOTCLA6RPZ1rrB' },
  { nombre: 'Pamela Rojas', driveId: '1mPp_CVOmBZpaKUY_0_GC_IwupXXFjuzc' },
  { nombre: 'Susana porres', driveId: '1N4b_rbO1I4733G7dHpXrvX-l_nss97Xa' },
  { nombre: 'María Elisabet Paredes', driveId: '1t3tHyMqVl_3Abznv7UU0SV4O49OPps-T' },
  { nombre: 'Nahir Ayelen Alé Moreno', driveId: '10PqdR1HvbMFQ39gcQg05wHSbFH0D9gjW' },
  { nombre: 'Susana porres', driveId: '1TDIY-lcyHGMxKMjSzcDxCTIg9KX0B2Tj' },
  { nombre: 'Leslie Sosa', driveId: '1S7juCFM2ZRz2g3dM_txVcsepe_TTSfeo' },
  { nombre: 'Marcos Rojas Clevers', driveId: '1YdiQPur9JNL3q4I1kNl2HZ-zqUFeReZU' },
  { nombre: 'Franco mombello', driveId: '1pziqRbyFnFswNLU4AoPHTYgLIul9tbCG' },
  { nombre: 'Paula Elena gallego', driveId: '1hZaz4CYoVp_Af1EdHIsSy7xsS2WqH2gH' },
  { nombre: 'Graciela Julia Sisterna de Romero', driveId: '1VlQ5Wd2H3KrxkxtOB8_O4J0bt4eaBj6M' },
  { nombre: 'Federico Morales Martínez', driveId: '1y8W_C2NC9_UKPDVJI0g0DTBj44Iwu9Lb' },
  { nombre: 'María Alejandra Rodano', driveId: '1ZaWId95LUakiE4vybtXX-inEP8d8DN47' },
  { nombre: 'Celeste Tejada Botella', driveId: '13RzxVOfYrCeqRFGRCtsol1YHHOnS_iZc' },
  { nombre: 'Daniela Navarro Belli', driveId: '16ebKT2r0hH7_kNVBYm42wWZ255nOeMoQ' },
  { nombre: 'Melisa Contreras', driveId: '1eyg-bcTj2vQ7T9wGcw627aSws7I-HUkq' },
  { nombre: 'Jorge Alberto Clavel', driveId: '1RaumUyCVHDEM2Jyisumhs9DF4HYOPRy2' },
  { nombre: 'Sebastian Gasques', driveId: '12meXLfETWNpoHBtB63xfzuibp5G_2nmS' },
  { nombre: 'Nievas José Eduardo', driveId: '1ryKKfkDKYm0YHL6XBz2x_rB_2kIthQLH' },
  { nombre: 'Valentina Basualdo Diaz', driveId: '1ZKCmuacdQG9e5fWli79t8RNYRFY-qUjD' },
  { nombre: 'María Paula Aciar Castro', driveId: '1_coK7XxzYMhXvXd1FvfVVfCIOpGG5dVK' },
  { nombre: 'Marco Gabriel Massano', driveId: '1kuKHB0KS55IsLy69cMbSxFZ-F590uMx4' },
  { nombre: 'María Paula Aciar Castro', driveId: '1sSOpmzA5dF44abuHnyvjXD-e9sCJAAOa' },
  { nombre: 'Aldana Giselle Vidal Fernandez', driveId: '16pdUwUs-6N40kYt85uEeH0lM6lOsBUJy' },
  { nombre: 'Aldana Vidal Fernandez', driveId: '1VXIeF7RbwcD8NuVeXfs3Sw8h2pcB0WhQ' },
  { nombre: 'Pareja Suarez Erica Yamil', driveId: '1UXUuaCRkJMjEnRkiKozPZ1KCfU3yN90b' },
  { nombre: 'Micaela Montiveros', driveId: '1alDZxDI3u9OS02FkqEbzP7EWCShH7UQw' },
  { nombre: 'Gabriel Navarta', driveId: '1Q0saDJLDzgZycKqm5aKAR4ZBKF_ZqVAb' },
  { nombre: 'Cumine luz', driveId: '1vT0wYkNVQ8dNaIcm2zaO2B3XB4ziRruu' },
  { nombre: 'Sofía Michelle Zárate Montaña', driveId: '1UKE5ksLYBKt6ND1nU2QmZ_CDY7AI_-Ky' },
  { nombre: 'HORACIO RAUL CAMERA ARRIGONI', driveId: '1dxP7M3185P3uOEK9D7VtTeK9qOBVPzcz' },
  { nombre: 'Verónica Quiroga Gonella', driveId: '1KrTbEU10YL5nwpJHZz2hiEEOUXKP-4Xl' },
  { nombre: 'Pamela Inés Rojas', driveId: '1t6iZCSnhoeGAvyvSk_9CsQRHU84lgnCr' },
  { nombre: 'Mariana Riveros', driveId: '1KzyiuJBeTLwYBWxVoS9ZgKhfWtRnT3oI' },
  { nombre: 'Leandro Gustavo Aliaga Conte Grand', driveId: '14OoLObIw3HYGVt_mIXhQj01IE87B7A3X' },
  { nombre: 'María Alejandra Godoy', driveId: '1dCPaD5j-fIh8boXEW13cydAE310Vy6Qh' },
  { nombre: 'Ruben Balmaceda', driveId: '1LCTv-HYE1eXiAllYt3U1bF8W416vX2b4' },
  { nombre: 'Gerardo Raul Calvo Hidalgo', driveId: '1CtqK9AI8mZYL4Ub1Bu5y5YM_N-qVbfUU' },
  { nombre: 'Pamela Torres Tello', driveId: '1Sdy8heruNzn6veI8UG-6pX-ku4SFbPV3' },
];

function downloadFromDrive(fileId, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    const url = `https://lh3.googleusercontent.com/d/${fileId}=s1600`;
    function followRedirects(currentUrl, redirectsLeft) {
      const mod = currentUrl.startsWith('https') ? https : http;
      const req = mod.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*,*/*',
        }
      }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (redirectsLeft <= 0) { reject(new Error('Too many redirects')); return; }
          let rUrl = res.headers.location;
          if (rUrl.startsWith('/')) { const p = new URL(currentUrl); rUrl = `${p.protocol}//${p.host}${rUrl}`; }
          res.resume();
          followRedirects(rUrl, redirectsLeft - 1);
          return;
        }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'image/jpeg' }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    }
    followRedirects(url, maxRedirects);
  });
}

function getExt(ct) {
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'jpg';
}

async function main() {
  console.log('📸 Subiendo fotos al bucket fotos-prestadores...\n');

  // Get all records without photos
  const { data: records, error } = await supabase
    .from('nuevos_prestadores')
    .select('id, nombre_completo')
    .is('foto_url', null)
    .order('created_at', { ascending: true });

  if (error) { console.error('DB error:', error); return; }
  console.log(`Records sin foto: ${records.length}\n`);

  let ok = 0, fail = 0;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    // Find matching drive entry
    const driveEntry = DRIVE_MAP.find(d => d.nombre === rec.nombre_completo);
    if (!driveEntry) {
      console.log(`[${i+1}] ${rec.nombre_completo.padEnd(40)} ❌ No drive mapping`);
      fail++;
      continue;
    }

    try {
      process.stdout.write(`[${String(i+1).padStart(2)}] ${rec.nombre_completo.padEnd(40)} `);

      // Download
      const { buffer, contentType } = await downloadFromDrive(driveEntry.driveId);
      
      // Check it's not HTML
      const firstBytes = buffer.slice(0, 200).toString('utf-8');
      if (firstBytes.includes('<!DOCTYPE') || firstBytes.includes('<html') || firstBytes.includes('<HTML')) {
        throw new Error('Got HTML (restricted)');
      }

      if (buffer.length < 500) {
        throw new Error(`Too small (${buffer.length} bytes)`);
      }

      const ext = getExt(contentType);
      const fileName = `prestadores/${driveEntry.driveId}.${ext}`;

      // Upload
      const { error: upErr } = await supabase.storage
        .from('fotos-prestadores')
        .upload(fileName, buffer, { contentType, cacheControl: '3600', upsert: true });

      if (upErr) throw new Error(`Upload: ${upErr.message}`);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('fotos-prestadores')
        .getPublicUrl(fileName);
      const fotoUrl = urlData?.publicUrl;

      // Update record
      const { error: updErr } = await supabase
        .from('nuevos_prestadores')
        .update({ foto_url: fotoUrl })
        .eq('id', rec.id);

      if (updErr) throw new Error(`Update: ${updErr.message}`);

      console.log(`📷 ✅ (${(buffer.length/1024).toFixed(0)}KB)`);
      ok++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      fail++;
    }
  }

  console.log(`\n════════════════════════════════════`);
  console.log(`✅ Fotos subidas: ${ok}`);
  console.log(`❌ Fallidas: ${fail}`);
  console.log('🏁 Completado.');
}

main().catch(console.error);
