import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar .env del proyecto padre
config({ path: resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.RRHH_SYNC_PORT || 3457;

app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// Supabase Client
// ═══════════════════════════════════════════════════════════════
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ═══════════════════════════════════════════════════════════════
// SQL Server Config (SALUS)
// ═══════════════════════════════════════════════════════════════
const SQL_CONFIG = {
    server: '128.223.16.29',
    port: 2450,
    user: 'SalusConsulta',
    password: 'ConsultaSALUS1234',
    database: 'SALUS',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        requestTimeout: 120000,
        connectionTimeout: 15000,
        tdsVersion: '7_4',
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
};

// ═══════════════════════════════════════════════════════════════
// Pool de conexiones
// ═══════════════════════════════════════════════════════════════
let pool = null;
async function getPool() {
    if (!pool || !pool.connected) {
        console.log('🔌 Conectando a SQL Server SALUS...');
        pool = await sql.connect(SQL_CONFIG);
        console.log('✅ Conexión SQL Server establecida');
    }
    return pool;
}

// ═══════════════════════════════════════════════════════════════
// Utilidades
// ═══════════════════════════════════════════════════════════════
function formatDate(d) {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().split('T')[0];
}

function getDateRange(mesesAtras = 0) {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = hoy.getMonth() - mesesAtras;
    const target = new Date(y, m, 1);
    const primerDia = `${target.getFullYear()}${String(target.getMonth() + 1).padStart(2, '0')}01`;
    const primerDiaFmt = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-01`;
    return { primerDia, primerDiaFmt };
}

// ═══════════════════════════════════════════════════════════════
// SYNC: VISITAS SEDE
// Fuente: [SALUS].[dbo].[VLISE_Visitas]
// Centro: SANTA FE | Asistencia: Presente
// ═══════════════════════════════════════════════════════════════
async function syncVisitasSede(db, mesesAtras = 0) {
    const { primerDia, primerDiaFmt } = getDateRange(mesesAtras);
    const label = mesesAtras === 0 ? 'mes actual' : `${mesesAtras} mes(es) atrás`;
    console.log(`\n🏥 Extrayendo visitas Sede Santa Fe — ${label} (desde ${primerDiaFmt})...`);

    const result = await db.request().query(`
        SELECT 
            [idVisita],
            CAST([Fecha Visita] AS DATE) AS [Fecha],
            [IdPaciente],
            [Paciente],
            [Cliente],
            [Responsable],
            [Tipo Visita],
            [Centro],
            [Visita_Especialidad],
            [Usuario Creacion Nombre]
        FROM [SALUS].[dbo].[VLISE_Visitas]
        WHERE 
            CAST([Fecha Visita] AS DATE) >= '${primerDia}'
            AND [Asistencia] = 'Presente'
            AND [Centro] = 'SANTA FE'
        ORDER BY [Fecha Visita] DESC
    `);
    console.log(`   📊 ${result.recordset.length} visitas extraídas`);

    if (result.recordset.length === 0) {
        return { total: 0, deleted: 0, inserted: 0, skipped: 0, desde: primerDiaFmt };
    }

    // Transformar filas
    const records = [];
    for (const r of result.recordset) {
        const usuario = r['Usuario Creacion Nombre']?.trim();
        if (!usuario) continue;

        const fecha = formatDate(r.Fecha);
        if (!fecha) continue;

        records.push({
            id_visita: r.idVisita ? String(r.idVisita).trim() : null,
            fecha,
            id_paciente: r.IdPaciente ? String(r.IdPaciente).trim() : null,
            paciente: r.Paciente?.trim() || null,
            cliente: r.Cliente?.trim() || null,
            responsable: r.Responsable?.trim() || null,
            tipo_visita: r['Tipo Visita']?.trim() || null,
            especialidad: r.Visita_Especialidad?.trim() || null,
            usuario_creacion: usuario,
            centro: 'SANTA FE',
        });
    }

    console.log(`   📋 ${records.length} registros válidos`);

    // Estrategia: delete-insert (desde la fecha indicada)
    const { error: delError } = await supabase
        .from('visitas_sede')
        .delete()
        .gte('fecha', primerDiaFmt);

    if (delError) {
        console.error(`   ⚠️ Error al limpiar datos:`, delError.message);
    } else {
        console.log(`   🗑️ Datos limpiados desde ${primerDiaFmt}`);
    }

    // Insert en lotes
    let inserted = 0, skipped = 0;
    const BATCH = 100;

    for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { data, error } = await supabase
            .from('visitas_sede')
            .insert(batch)
            .select('id');

        if (error) {
            console.error(`   ❌ Batch ${Math.floor(i/BATCH)+1} error:`, error.message);
            skipped += batch.length;
        } else if (data) {
            inserted += data.length;
        }
    }

    const summary = { total: result.recordset.length, inserted, skipped, desde: primerDiaFmt };
    console.log(`   ✅ Visitas: ${inserted} sincronizados, ${skipped} errores`);
    return summary;
}

// ═══════════════════════════════════════════════════════════════
// SYNC: VISITAS RANGO PERSONALIZADO
// Para sync histórico o por rango de fechas
// ═══════════════════════════════════════════════════════════════
async function syncVisitasRango(db, fechaDesde, fechaHasta) {
    console.log(`\n🏥 Extrayendo visitas rango: ${fechaDesde} → ${fechaHasta}...`);

    const desde = fechaDesde.replace(/-/g, '');

    const result = await db.request().query(`
        SELECT 
            [idVisita],
            CAST([Fecha Visita] AS DATE) AS [Fecha],
            [IdPaciente],
            [Paciente],
            [Cliente],
            [Responsable],
            [Tipo Visita],
            [Centro],
            [Visita_Especialidad],
            [Usuario Creacion Nombre]
        FROM [SALUS].[dbo].[VLISE_Visitas]
        WHERE 
            CAST([Fecha Visita] AS DATE) >= '${desde}'
            AND CAST([Fecha Visita] AS DATE) <= '${fechaHasta.replace(/-/g, '')}'
            AND [Asistencia] = 'Presente'
            AND [Centro] = 'SANTA FE'
        ORDER BY [Fecha Visita] DESC
    `);
    console.log(`   📊 ${result.recordset.length} visitas extraídas`);

    if (result.recordset.length === 0) {
        return { total: 0, inserted: 0, skipped: 0, desde: fechaDesde, hasta: fechaHasta };
    }

    // Transformar
    const records = [];
    for (const r of result.recordset) {
        const usuario = r['Usuario Creacion Nombre']?.trim();
        if (!usuario) continue;
        const fecha = formatDate(r.Fecha);
        if (!fecha) continue;

        records.push({
            id_visita: r.idVisita ? String(r.idVisita).trim() : null,
            fecha,
            id_paciente: r.IdPaciente ? String(r.IdPaciente).trim() : null,
            paciente: r.Paciente?.trim() || null,
            cliente: r.Cliente?.trim() || null,
            responsable: r.Responsable?.trim() || null,
            tipo_visita: r['Tipo Visita']?.trim() || null,
            especialidad: r.Visita_Especialidad?.trim() || null,
            usuario_creacion: usuario,
            centro: 'SANTA FE',
        });
    }

    // Delete rango + insert
    const { error: delError } = await supabase
        .from('visitas_sede')
        .delete()
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta);

    if (delError) console.error(`   ⚠️ Error limpiando rango:`, delError.message);
    else console.log(`   🗑️ Rango ${fechaDesde} → ${fechaHasta} limpiado`);

    let inserted = 0, skipped = 0;
    const BATCH = 100;

    for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { data, error } = await supabase
            .from('visitas_sede')
            .insert(batch)
            .select('id');

        if (error) {
            console.error(`   ❌ Batch ${Math.floor(i/BATCH)+1}:`, error.message);
            skipped += batch.length;
        } else if (data) {
            inserted += data.length;
        }
    }

    console.log(`   ✅ Rango: ${inserted} sincronizados, ${skipped} errores`);
    return { total: result.recordset.length, inserted, skipped, desde: fechaDesde, hasta: fechaHasta };
}

// ═══════════════════════════════════════════════════════════════
// SYNC: FACTURACIÓN SEDE (replica del de ADM-QUI)
// Fuente: [SALUS].[dbo].[PR_FACTURAS_QRY]
// ═══════════════════════════════════════════════════════════════
async function syncFacturacionSede(db, mesesAtras = 0) {
    const { primerDia, primerDiaFmt } = getDateRange(mesesAtras);
    const label = mesesAtras === 0 ? 'mes actual' : `${mesesAtras} mes(es) atrás`;
    console.log(`\n💰 Extrayendo facturación Sede — ${label} (desde ${primerDiaFmt})...`);

    const result = await db.request().query(`
        WITH Deduped AS (
            SELECT [idVisita], [Paciente_Nombre], [Paciente_NHC], [Descripcion],
                   CAST([Cantidad] AS INT) AS [Cantidad],
                   CAST([importeUnitario] AS DECIMAL(18,2)) AS [ImporteUnitario],
                   CAST([ImporteTotal] AS DECIMAL(18,2)) AS [ImporteTotal],
                   [IdPaciente], [Factura_FechaActualizacion],
                   CAST([Factura_FechaActualizacion] AS DATE) AS [Fecha],
                   CAST([Factura_FechaActualizacion] AS TIME(0)) AS [Hora],
                   [Centro_Alias], [Familia], [Servicio], [FormaDePago],
                   [Responsable], [Visita_TipoVisita], [Tarifa],
                   [UsuarioFactura], [Paciente_Telf1],
                   ROW_NUMBER() OVER(PARTITION BY [idVisita], [Descripcion] ORDER BY [Factura_FechaActualizacion] DESC) as DupFila
            FROM [SALUS].[dbo].[PR_FACTURAS_QRY]
            WHERE [Factura_FechaActualizacion] >= '${primerDia}'
              AND [Centro_Alias] = 'SANTA FE'
        )
        SELECT d.[idVisita], d.[Paciente_Nombre], d.[Paciente_NHC], d.[Descripcion],
               d.[Cantidad], d.[ImporteUnitario], d.[ImporteTotal],
               d.[IdPaciente], d.[Fecha], d.[Hora],
               d.[Centro_Alias], d.[Familia], d.[Servicio], d.[FormaDePago],
               d.[Responsable], d.[Visita_TipoVisita], d.[Tarifa],
               d.[UsuarioFactura], d.[Paciente_Telf1]
        FROM Deduped d
        WHERE d.DupFila = 1
        ORDER BY d.[Fecha] DESC, d.[Hora] DESC
    `);
    console.log(`   📊 ${result.recordset.length} líneas extraídas (desde ${primerDiaFmt})`);

    if (result.recordset.length === 0) {
        return { total: 0, inserted: 0, skipped: 0, desde: primerDiaFmt };
    }

    const records = [];
    for (const r of result.recordset) {
        const usuario = r.UsuarioFactura?.trim();
        if (!usuario) continue;
        const fecha = formatDate(r.Fecha);
        if (!fecha) continue;

        // Extraer hora y calcular turno
        let hora = null;
        let turno = 'mañana';
        if (r.Hora) {
            if (r.Hora instanceof Date) {
                const h = r.Hora.getUTCHours();
                const mn = r.Hora.getUTCMinutes();
                const s = r.Hora.getUTCSeconds();
                hora = `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                turno = h < 15 ? 'mañana' : 'tarde';
            } else {
                const timeStr = String(r.Hora);
                const hMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
                if (hMatch) {
                    hora = timeStr.substring(0, 8);
                    turno = parseInt(hMatch[1], 10) < 15 ? 'mañana' : 'tarde';
                }
            }
        }

        // ⭐ Usar importeUnitario (por práctica) en lugar de ImporteTotal (por visita)
        const importe = Number(r.ImporteUnitario) || 0;

        records.push({
            id_visita: r.idVisita ? String(r.idVisita).trim() : null,
            id_paciente: r.IdPaciente ? String(r.IdPaciente).trim() : null,
            paciente: r.Paciente_Nombre?.trim() || null,
            paciente_nhc: r.Paciente_NHC ? String(r.Paciente_NHC).trim() : null,
            paciente_telefono: r.Paciente_Telf1 ? String(r.Paciente_Telf1).trim() : null,
            descripcion: r.Descripcion?.trim() || null,
            cantidad: Number(r.Cantidad) || 1,
            total_importe: importe,
            fecha,
            hora,
            turno,
            familia: r.Familia?.trim() || null,
            servicio: r.Servicio?.trim() || null,
            forma_de_pago: r.FormaDePago?.trim() || null,
            responsable: r.Responsable?.trim() || null,
            visita_tipo: r.Visita_TipoVisita?.trim() || null,
            tarifa: r.Tarifa?.trim() || null,
            usuario_factura: usuario,
        });
    }

    // Delete-insert
    const { error: delError } = await supabase
        .from('facturacion_sede')
        .delete()
        .gte('fecha', primerDiaFmt);

    if (delError) console.error(`   ⚠️ Error limpiando:`, delError.message);
    else console.log(`   🗑️ Facturación limpiada desde ${primerDiaFmt}`);

    let inserted = 0, skipped = 0;
    const BATCH = 100;
    for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { data, error } = await supabase
            .from('facturacion_sede')
            .insert(batch)
            .select('id');

        if (error) {
            console.error(`   ❌ Batch ${Math.floor(i/BATCH)+1}:`, error.message);
            skipped += batch.length;
        } else if (data) {
            inserted += data.length;
        }
    }

    console.log(`   ✅ Facturación: ${inserted} sincronizados, ${skipped} errores`);
    return { total: result.recordset.length, inserted, skipped, desde: primerDiaFmt };
}

// ═══════════════════════════════════════════════════════════════
// ENDPOINTS
// ═══════════════════════════════════════════════════════════════
let syncInProgress = false;

// Sync completo (visitas + facturación)
app.get('/api/rrhh/sync-all', async (req, res) => {
    if (syncInProgress) {
        return res.status(429).json({ success: false, error: 'Sync en curso. Esperá a que termine.' });
    }

    syncInProgress = true;
    const startTime = Date.now();
    console.log('\n🚀 ═══ SINCRONIZACIÓN RRHH COMPLETA ═══');

    const results = {};

    try {
        const db = await getPool();

        try {
            results.visitas = await syncVisitasSede(db);
        } catch (err) {
            console.error('❌ Error en visitas:', err.message);
            results.visitas = { error: err.message };
        }

        try {
            results.facturacion = await syncFacturacionSede(db);
        } catch (err) {
            console.error('❌ Error en facturación:', err.message);
            results.facturacion = { error: err.message };
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ ═══ SYNC COMPLETADO en ${elapsed}s ═══\n`);

        res.json({
            success: true,
            elapsed: `${elapsed}s`,
            timestamp: new Date().toISOString(),
            results,
        });
    } catch (err) {
        console.error('❌ Error fatal:', err.message);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        syncInProgress = false;
    }
});

// Sync solo visitas (mes actual)
app.get('/api/rrhh/sync/visitas', async (req, res) => {
    try {
        const db = await getPool();
        const results = await syncVisitasSede(db);
        res.json({ success: true, results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Sync visitas con meses atrás (e.g., /api/rrhh/sync/visitas/3 = últimos 3 meses)
app.get('/api/rrhh/sync/visitas/:meses', async (req, res) => {
    try {
        const meses = parseInt(req.params.meses) || 0;
        const db = await getPool();
        const results = await syncVisitasSede(db, meses);
        res.json({ success: true, results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Sync visitas por rango personalizado
app.get('/api/rrhh/sync/visitas-rango', async (req, res) => {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) {
        return res.status(400).json({ success: false, error: 'Parámetros "desde" y "hasta" requeridos (YYYY-MM-DD)' });
    }
    try {
        const db = await getPool();
        const results = await syncVisitasRango(db, desde, hasta);
        res.json({ success: true, results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Sync solo facturación
app.get('/api/rrhh/sync/facturacion', async (req, res) => {
    try {
        const db = await getPool();
        const results = await syncFacturacionSede(db);
        res.json({ success: true, results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Diagnóstico: ver columnas y muestra de PR_FACTURAS_QRY
app.get('/api/rrhh/diag/facturacion-schema', async (req, res) => {
    try {
        const db = await getPool();
        // Obtener columnas
        const cols = await db.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'PR_FACTURAS_QRY'
            ORDER BY ORDINAL_POSITION
        `);
        // Obtener muestra (un paciente con múltiples prácticas)
        const sample = await db.request().query(`
            SELECT TOP 10 *
            FROM [SALUS].[dbo].[PR_FACTURAS_QRY]
            WHERE [Centro_Alias] = 'SANTA FE'
              AND [Factura_FechaActualizacion] >= '20260401'
            ORDER BY [Factura_FechaActualizacion] DESC
        `);
        res.json({
            success: true,
            columns: cols.recordset.map(c => ({ name: c.COLUMN_NAME, type: c.DATA_TYPE, maxLen: c.CHARACTER_MAXIMUM_LENGTH })),
            sample: sample.recordset,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Sync Padrón Histórico de Médicos desde SALUS
app.get('/api/rrhh/sync/padron-medicos', async (req, res) => {
    try {
        const db = await getPool();
        console.log('\n🩺 Extrayendo Padrón Histórico de Médicos desde SALUS...');

        const docsRes = await db.request().query(`
            SELECT 
                p.id AS id_personal,
                LTRIM(RTRIM(p.Nombre)) AS nombre,
                LTRIM(RTRIM(ISNULL(p.NombreAbrev, ''))) AS nombre_abrev,
                LTRIM(RTRIM(ISNULL(p.NumColegiado, ''))) AS matricula,
                LTRIM(RTRIM(ISNULL(p.NumColegiado2, ''))) AS matricula2,
                LTRIM(RTRIM(ISNULL(p.NIF, ''))) AS nif,
                LTRIM(RTRIM(ISNULL(p.Telefono1, ''))) AS telefono,
                LTRIM(RTRIM(ISNULL(p.Telefono2, ''))) AS telefono2,
                LTRIM(RTRIM(ISNULL(p.email_empresa, ''))) AS email,
                LTRIM(RTRIM(ISNULL(p.Titulo, ''))) AS titulo,
                p.FechaNac AS fecha_nacimiento,
                ISNULL(p.Activo, 0) AS activo_salus,
                ISNULL(p.Generico, 0) AS es_generico,
                p.FechaAlta AS fecha_alta_salus,
                p.FechaBaja AS fecha_baja_salus,
                COUNT(v.id) AS total_atenciones,
                COUNT(DISTINCT ps.IdPacient) AS pacientes_unicos,
                MIN(CAST(v.Data AS DATE)) AS primera_atencion,
                MAX(CAST(v.Data AS DATE)) AS ultima_atencion,
                SUM(CASE WHEN v.Data >= DATEADD(DAY, -30, GETDATE()) THEN 1 ELSE 0 END) AS atenciones_30d,
                SUM(CASE WHEN v.Data >= DATEADD(DAY, -90, GETDATE()) THEN 1 ELSE 0 END) AS atenciones_90d,
                SUM(CASE WHEN v.Data >= DATEADD(DAY, -180, GETDATE()) THEN 1 ELSE 0 END) AS atenciones_180d,
                SUM(CASE WHEN v.Data >= DATEADD(DAY, -365, GETDATE()) THEN 1 ELSE 0 END) AS atenciones_365d,
                COUNT(DISTINCT YEAR(v.Data) * 100 + MONTH(v.Data)) AS meses_activos,
                COUNT(DISTINCT CAST(v.Data AS DATE)) AS dias_atendidos
            FROM dbo.Visitas v WITH (NOLOCK)
            INNER JOIN dbo.PacientsSessions ps WITH (NOLOCK) ON ps.idVisita = v.id
            INNER JOIN dbo.Personal p WITH (NOLOCK) ON p.id = v.idPersonal
            WHERE ps.IdAusencia = 1
              AND v.Data <= GETDATE()
              AND v.Data >= '2010-01-01'
            GROUP BY 
                p.id, p.Nombre, p.NombreAbrev, p.NumColegiado, p.NumColegiado2, p.NIF,
                p.Telefono1, p.Telefono2, p.email_empresa, p.Titulo, p.FechaNac,
                p.Activo, p.Generico, p.FechaAlta, p.FechaBaja
            ORDER BY total_atenciones DESC
        `);

        const [espRes, tipusRes, osRes, sedeRes, timelineRes] = await Promise.all([
            db.request().query(`
                SELECT v.idPersonal AS id_personal, LTRIM(RTRIM(e.Descripcion)) AS especialidad, COUNT(v.id) AS cantidad
                FROM dbo.Visitas v WITH (NOLOCK)
                INNER JOIN dbo.PacientsSessions ps WITH (NOLOCK) ON ps.idVisita = v.id
                INNER JOIN dbo.Especialidades e WITH (NOLOCK) ON e.id = v.idEspecialidad
                WHERE ps.IdAusencia = 1 AND v.Data <= GETDATE() AND v.Data >= '2010-01-01'
                  AND e.Descripcion IS NOT NULL AND LTRIM(RTRIM(e.Descripcion)) <> ''
                GROUP BY v.idPersonal, LTRIM(RTRIM(e.Descripcion))
                ORDER BY v.idPersonal, cantidad DESC
            `),
            db.request().query(`
                WITH RankedTipus AS (
                    SELECT v.idPersonal AS id_personal, LTRIM(RTRIM(ts.Nom)) AS tipo_atencion, COUNT(v.id) AS cantidad,
                           MAX(CAST(v.Data AS DATE)) AS ultima_vez,
                           ROW_NUMBER() OVER (PARTITION BY v.idPersonal ORDER BY COUNT(v.id) DESC) AS rn
                    FROM dbo.Visitas v WITH (NOLOCK)
                    INNER JOIN dbo.PacientsSessions ps WITH (NOLOCK) ON ps.idVisita = v.id
                    INNER JOIN dbo.TipusDeSessions ts WITH (NOLOCK) ON ts.IdTipus = v.IdTipus
                    WHERE ps.IdAusencia = 1 AND v.Data <= GETDATE() AND v.Data >= '2010-01-01'
                      AND ts.Nom IS NOT NULL AND LTRIM(RTRIM(ts.Nom)) <> ''
                    GROUP BY v.idPersonal, LTRIM(RTRIM(ts.Nom))
                )
                SELECT id_personal, tipo_atencion, cantidad, ultima_vez FROM RankedTipus WHERE rn <= 15 ORDER BY id_personal, cantidad DESC
            `),
            db.request().query(`
                WITH RankedOS AS (
                    SELECT v.idPersonal AS id_personal, LTRIM(RTRIM(ent.nombre)) AS obra_social, COUNT(v.id) AS cantidad,
                           ROW_NUMBER() OVER (PARTITION BY v.idPersonal ORDER BY COUNT(v.id) DESC) AS rn
                    FROM dbo.Visitas v WITH (NOLOCK)
                    INNER JOIN dbo.PacientsSessions ps WITH (NOLOCK) ON ps.idVisita = v.id
                    INNER JOIN dbo.FE_Entidades ent WITH (NOLOCK) ON ent.id = ps.idCliente
                    WHERE ps.IdAusencia = 1 AND v.Data <= GETDATE() AND v.Data >= '2010-01-01'
                      AND ent.nombre IS NOT NULL AND LTRIM(RTRIM(ent.nombre)) <> ''
                    GROUP BY v.idPersonal, LTRIM(RTRIM(ent.nombre))
                )
                SELECT id_personal, obra_social, cantidad FROM RankedOS WHERE rn <= 15 ORDER BY id_personal, cantidad DESC
            `),
            db.request().query(`
                SELECT v.idPersonal AS id_personal, v.idBd AS id_centro, COUNT(v.id) AS cantidad, MAX(CAST(v.Data AS DATE)) AS ultima_vez
                FROM dbo.Visitas v WITH (NOLOCK)
                INNER JOIN dbo.PacientsSessions ps WITH (NOLOCK) ON ps.idVisita = v.id
                WHERE ps.IdAusencia = 1 AND v.Data <= GETDATE() AND v.Data >= '2010-01-01'
                GROUP BY v.idPersonal, v.idBd ORDER BY v.idPersonal, cantidad DESC
            `),
            db.request().query(`
                SELECT v.idPersonal AS id_personal, YEAR(v.Data) AS anio, COUNT(v.id) AS cantidad
                FROM dbo.Visitas v WITH (NOLOCK)
                INNER JOIN dbo.PacientsSessions ps WITH (NOLOCK) ON ps.idVisita = v.id
                WHERE ps.IdAusencia = 1 AND v.Data <= GETDATE() AND v.Data >= '2015-01-01'
                GROUP BY v.idPersonal, YEAR(v.Data) ORDER BY v.idPersonal, anio ASC
            `),
        ]);

        const CENTRO_MAP = { 1: 'SAN LUIS SUR', 8: 'SANTA FE', 11: 'SAN LUIS NORTE', 12: 'SAN LUIS SEDE 3' };
        const doctorsMap = new Map();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const r of docsRes.recordset) {
            const primera = formatDate(r.primera_atencion);
            const ultima = formatDate(r.ultima_atencion);
            const dUltima = ultima ? new Date(ultima + 'T00:00:00') : null;
            const diasSinAtender = dUltima ? Math.max(0, Math.floor((today.getTime() - dUltima.getTime()) / 86400000)) : 9999;
            let estadoActividad = 'Inactivo';
            if (diasSinAtender <= 90) estadoActividad = 'Activo';
            else if (diasSinAtender <= 365) estadoActividad = 'Baja Frecuencia';

            doctorsMap.set(r.id_personal, {
                id_personal: r.id_personal,
                nombre: r.nombre || `Profesional #${r.id_personal}`,
                nombre_abrev: r.nombre_abrev || '',
                matricula: r.matricula || r.matricula2 || '',
                nif: r.nif || '',
                telefono: [r.telefono, r.telefono2].filter(Boolean).join(' / '),
                email: r.email || '',
                titulo: r.titulo || '',
                fecha_nacimiento: formatDate(r.fecha_nacimiento),
                activo_salus: Boolean(r.activo_salus),
                es_generico: Boolean(r.es_generico) || /GUARDIA|GENERICO|SIN MEDICO|SERVICIO|LABORATORIO|ECOGRAFIA|RADIOLOGIA|TOMOGRAFIA|MAMOGRAFIA|RESONANCIA/i.test(r.nombre || ''),
                fecha_alta_salus: formatDate(r.fecha_alta_salus),
                fecha_baja_salus: formatDate(r.fecha_baja_salus),
                total_atenciones: Number(r.total_atenciones) || 0,
                pacientes_unicos: Number(r.pacientes_unicos) || 0,
                primera_atencion: primera,
                ultima_atencion: ultima,
                dias_sin_atender: diasSinAtender,
                estado_actividad: estadoActividad,
                atenciones_30d: Number(r.atenciones_30d) || 0,
                atenciones_90d: Number(r.atenciones_90d) || 0,
                atenciones_180d: Number(r.atenciones_180d) || 0,
                atenciones_365d: Number(r.atenciones_365d) || 0,
                meses_activos: Number(r.meses_activos) || 1,
                dias_atendidos: Number(r.dias_atendidos) || 1,
                promedio_por_mes_activo: Math.round((Number(r.total_atenciones) || 0) / Math.max(1, Number(r.meses_activos) || 1)),
                promedio_por_dia_atendido: Number(((Number(r.total_atenciones) || 0) / Math.max(1, Number(r.dias_atendidos) || 1)).toFixed(1)),
                especialidades: [],
                especialidad_principal: 'Sin especificar',
                top_atenciones: [],
                top_obras_sociales: [],
                sedes: [],
                historial_anual: [],
            });
        }

        for (const r of espRes.recordset) {
            const doc = doctorsMap.get(r.id_personal);
            if (doc) doc.especialidades.push({ nombre: r.especialidad, cantidad: Number(r.cantidad) || 0 });
        }
        for (const doc of doctorsMap.values()) {
            if (doc.especialidades.length > 0) doc.especialidad_principal = doc.especialidades[0].nombre;
        }
        for (const r of tipusRes.recordset) {
            const doc = doctorsMap.get(r.id_personal);
            if (!doc) continue;
            const cant = Number(r.cantidad) || 0;
            doc.top_atenciones.push({
                nombre: r.tipo_atencion,
                cantidad: cant,
                porcentaje: doc.total_atenciones > 0 ? Number(((cant / doc.total_atenciones) * 100).toFixed(1)) : 0,
                ultima_vez: formatDate(r.ultima_vez),
            });
        }
        for (const r of osRes.recordset) {
            const doc = doctorsMap.get(r.id_personal);
            if (!doc) continue;
            const cant = Number(r.cantidad) || 0;
            doc.top_obras_sociales.push({
                nombre: r.obra_social,
                cantidad: cant,
                porcentaje: doc.total_atenciones > 0 ? Number(((cant / doc.total_atenciones) * 100).toFixed(1)) : 0,
            });
        }
        for (const r of sedeRes.recordset) {
            const doc = doctorsMap.get(r.id_personal);
            if (!doc) continue;
            doc.sedes.push({
                sede: CENTRO_MAP[r.id_centro] || `Centro ${r.id_centro}`,
                cantidad: Number(r.cantidad) || 0,
                ultima_vez: formatDate(r.ultima_vez),
            });
        }
        for (const r of timelineRes.recordset) {
            const doc = doctorsMap.get(r.id_personal);
            if (doc) doc.historial_anual.push({ anio: Number(r.anio), cantidad: Number(r.cantidad) || 0 });
        }

        const allDoctors = Array.from(doctorsMap.values());
        const payload = {
            generated_at: new Date().toISOString(),
            source: 'SALUS SQL Server (128.223.16.29:2450)',
            total_profesionales: allDoctors.length,
            profesionales: allDoctors,
        };

        const outPath = resolve(__dirname, '..', 'public', 'data', 'padron_medicos_salus.json');
        fs.mkdirSync(dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(payload));

        res.json({ success: true, total_profesionales: allDoctors.length });
    } catch (err) {
        console.error('❌ Error sincronizando padrón médicos:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Health check
app.get('/api/rrhh/health', async (req, res) => {
    try {
        const db = await getPool();
        await db.request().query('SELECT 1 AS ok');
        res.json({
            success: true,
            connected: true,
            server: '128.223.16.29:2450',
            database: 'SALUS',
            supabase: supabaseUrl ? 'configurado' : 'FALTA',
        });
    } catch (err) {
        res.json({ success: false, connected: false, error: err.message });
    }
});

// Status — consulta conteos rápidos de Supabase
app.get('/api/rrhh/status', async (req, res) => {
    try {
        const [visitas, facturacion] = await Promise.all([
            supabase.from('visitas_sede').select('id', { count: 'exact', head: true }),
            supabase.from('facturacion_sede').select('id', { count: 'exact', head: true }),
        ]);
        res.json({
            success: true,
            visitas_sede: visitas.count || 0,
            facturacion_sede: facturacion.count || 0,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// Servidor
// ═══════════════════════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║  🏥 RRHH Sync Server — Sanatorio Argentino          ║
║  Puerto: ${PORT}                                       ║
║  SQL Server: 128.223.16.29:2450 (SALUS)              ║
║  Supabase: ${supabaseUrl ? '✅ Configurado' : '❌ FALTA'}                          ║
║                                                      ║
║  Endpoints:                                          ║
║    GET /api/rrhh/sync-all          (todo)            ║
║    GET /api/rrhh/sync/visitas      (mes actual)      ║
║    GET /api/rrhh/sync/visitas/:N   (N meses atrás)   ║
║    GET /api/rrhh/sync/visitas-rango?desde=&hasta=    ║
║    GET /api/rrhh/sync/facturacion  (mes actual)      ║
║    GET /api/rrhh/status            (conteos)         ║
║    GET /api/rrhh/health            (check)           ║
╚══════════════════════════════════════════════════════╝
    `);
    getPool().catch(err => console.warn('⚠️ Conexión inicial fallida:', err.message));
});

process.on('SIGINT', async () => {
    console.log('\n👋 Cerrando RRHH Sync Server...');
    if (pool) await pool.close();
    process.exit(0);
});
