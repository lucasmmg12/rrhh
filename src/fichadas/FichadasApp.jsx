import React, { useState, useEffect, useCallback, useRef } from 'react';
import { parseFichadasPDF, formatMinToHHMM, formatMinToDisplay, roundHours } from './pdfParser';
import {
  procesarYGuardarFichadas,
  obtenerTotalesMensuales,
  obtenerRegistros,
  obtenerAreas,
  listarColaboradores,
  listarImportaciones,
  eliminarImportacion,
} from './fichadasService';
import { exportToXLSX, exportToPDF, exportDetailedXLSX } from './exportService';

// ─── STYLES ──────────────────────────────────────────────────────
const COLORS = {
  primary: '#005eb8',
  primaryLight: '#eff6ff',
  primaryDark: '#003d7a',
  accent: '#0ea5e9',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
};

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// ─── MAIN APP ────────────────────────────────────────────────────
export default function FichadasApp() {
  // State
  const [view, setView] = useState('upload'); // upload | dashboard
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [progressLog, setProgressLog] = useState([]);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const progressRef = useRef(null);

  // Data
  const [totales, setTotales] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [areas, setAreas] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [importaciones, setImportaciones] = useState([]);

  // Filters
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroColaborador, setFiltroColaborador] = useState('');
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1);
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());
  const [filtroPeriodo, setFiltroPeriodo] = useState('mensual');
  const [filtroCriterio, setFiltroCriterio] = useState('ninguno');

  // Detail view
  const [expandedColab, setExpandedColab] = useState(null);
  const [detailRecords, setDetailRecords] = useState([]);

  const fileInputRef = useRef(null);

  // ─── LOAD DATA ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const filtros = {};
      if (filtroPeriodo === 'mensual') {
        filtros.periodo_mes = filtroMes;
        filtros.periodo_anio = filtroAnio;
      } else if (filtroPeriodo === 'anual') {
        filtros.periodo_anio = filtroAnio;
      }
      if (filtroArea) filtros.area = filtroArea;
      if (filtroColaborador) filtros.colaborador_id = filtroColaborador;

      const [totData, areasData, colabData, impData] = await Promise.all([
        obtenerTotalesMensuales(filtros),
        obtenerAreas(),
        listarColaboradores(filtroArea ? { area: filtroArea } : {}),
        listarImportaciones(),
      ]);

      setTotales(totData);
      setAreas(areasData);
      setColaboradores(colabData);
      setImportaciones(impData);

      if (totData.length > 0) setView('dashboard');
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Error al cargar los datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [filtroArea, filtroColaborador, filtroMes, filtroAnio, filtroPeriodo]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── PDF UPLOAD ────────────────────────────────────────────────
  const handleFileUpload = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor seleccioná un archivo PDF válido.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setProgressLog([]);
    setProgressTotal(0);
    setProgressCurrent(0);

    const addLog = (msg, type = 'info') => {
      setProgressLog(prev => [...prev, { msg, type, time: new Date() }]);
      // Auto-scroll
      setTimeout(() => {
        if (progressRef.current) progressRef.current.scrollTop = progressRef.current.scrollHeight;
      }, 50);
    };

    try {
      // 1. Parse PDF
      addLog(`📄 Leyendo PDF: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
      const parsed = await parseFichadasPDF(file);

      if (!parsed.colaboradores.length) {
        addLog('❌ No se encontraron datos de colaboradores', 'error');
        setError('No se encontraron datos de colaboradores en el PDF. Verificá el formato.');
        setLoading(false);
        return;
      }

      addLog(`✅ PDF parseado: ${parsed.colaboradores.length} colaboradores, Área: ${parsed.area}, Período: ${parsed.mes}/${parsed.anio}`, 'success');
      setProgressTotal(parsed.colaboradores.length);

      // 2. Save to database with progress callback
      const onProgress = (event) => {
        if (event.type === 'cleaning') {
          addLog(`🧹 Limpiando importaciones previas de ${event.area} ${event.periodo}...`);
        } else if (event.type === 'import_created') {
          addLog('📋 Registro de importación creado');
        } else if (event.type === 'colaborador_start') {
          setProgressCurrent(event.index + 1);
          addLog(`⏳ Procesando ${event.nombre} (${event.index + 1}/${event.total})...`);
        } else if (event.type === 'colaborador_done') {
          addLog(`✓ ${event.nombre}: ${event.registros} registros, ${event.dias} días`, 'success');
        } else if (event.type === 'colaborador_error') {
          addLog(`✗ Error en ${event.nombre}: ${event.error}`, 'error');
        } else if (event.type === 'done') {
          addLog(`🎉 Importación completa: ${event.ok} exitosos, ${event.errores} errores`, event.errores > 0 ? 'warning' : 'success');
        }
      };

      const result = await procesarYGuardarFichadas(parsed, file.name, onProgress);

      const totalRegs = result.resultados.reduce((a, r) => a + r.registros, 0);
      const errMsg = result.errores > 0 ? ` (${result.errores} con advertencias)` : '';
      setSuccess(
        `✅ Importación exitosa: ${result.resultados.length} colaboradores procesados${errMsg}, ` +
        `${totalRegs} registros — Área: ${result.area} — Período: ${result.periodo}`
      );

      // Update filters to match imported data
      if (parsed.mes) setFiltroMes(parsed.mes);
      if (parsed.anio) setFiltroAnio(parsed.anio);
      setFiltroArea('');

      addLog('📊 Cargando dashboard...');
      await loadData();
      setView('dashboard');
    } catch (err) {
      console.error('Upload error:', err);
      addLog(`❌ Error fatal: ${err.message}`, 'error');
      setError('Error al procesar el PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileUpload(file);
  };

  const onFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  // ─── EXPAND DETAIL ────────────────────────────────────────────
  const toggleExpand = async (colaboradorId) => {
    if (expandedColab === colaboradorId) {
      setExpandedColab(null);
      setDetailRecords([]);
      return;
    }
    setExpandedColab(colaboradorId);
    try {
      const filtros = { colaborador_id: colaboradorId };
      if (filtroPeriodo === 'mensual') {
        const startDate = `${filtroAnio}-${String(filtroMes).padStart(2, '0')}-01`;
        const lastDay = new Date(filtroAnio, filtroMes, 0).getDate();
        const endDate = `${filtroAnio}-${String(filtroMes).padStart(2, '0')}-${lastDay}`;
        filtros.fecha_desde = startDate;
        filtros.fecha_hasta = endDate;
      }
      const records = await obtenerRegistros(filtros);
      setDetailRecords(records);
    } catch (err) {
      console.error('Error loading detail:', err);
    }
  };

  // ─── EXPORT HANDLERS (defined after filteredTotales) ─────────

  // ─── DELETE IMPORT ─────────────────────────────────────────────
  const handleDeleteImport = async (id) => {
    if (!confirm('¿Estás seguro? Se eliminarán todos los registros asociados a esta importación.')) return;
    try {
      setLoading(true);
      await eliminarImportacion(id);
      setSuccess('Importación eliminada correctamente.');
      await loadData();
    } catch (err) {
      setError('Error al eliminar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── FILTERED DATA ────────────────────────────────────────────
  const filteredTotales = totales.filter(t => {
    if (filtroCriterio === 'area' && filtroArea && t.area !== filtroArea) return false;
    if (filtroCriterio === 'personal' && filtroColaborador && t.colaborador_id !== filtroColaborador) return false;
    return true;
  });

  // Summary stats
  const totalColaboradores = filteredTotales.length;
  const totalHorasRedondeadas = filteredTotales.reduce((a, t) => a + (t.total_horas_redondeadas_min || 0), 0);
  const totalDiasTrabajados = filteredTotales.reduce((a, t) => a + (t.dias_trabajados || 0), 0);
  const totalHorasExtra = filteredTotales.reduce((a, t) => a + (t.total_hora_extra_min || 0), 0);

  // Export handlers (must be after filteredTotales is defined)
  const handleExportXLSX = () => {
    const filename = `fichadas_${filtroArea || 'todas'}_${filtroMes}_${filtroAnio}`;
    exportToXLSX(filteredTotales, filename);
  };

  const handleExportPDF = () => {
    exportToPDF(filteredTotales, {
      title: 'Horas Totalizadas',
      area: filtroArea || 'Todas las Áreas',
      periodo: `${MESES[filtroMes]} ${filtroAnio}`,
      filename: `fichadas_${filtroArea || 'todas'}_${filtroMes}_${filtroAnio}`,
    });
  };

  const handleExportDetailXLSX = () => {
    if (detailRecords.length) {
      const nombre = detailRecords[0]?.colaborador?.nombre_completo || 'detalle';
      exportDetailedXLSX(detailRecords, `detalle_${nombre.replace(/\s/g, '_')}`);
    }
  };

  // ─── RENDER ────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: COLORS.bg, minHeight: '100vh' }}>
      {/* HEADER */}
      <header style={{
        background: 'white', borderBottom: `1px solid ${COLORS.border}`,
        padding: '0.75rem 2rem', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/logosanatorio.png" alt="SA" style={{ height: 32, objectFit: 'contain' }} />
          </a>
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: COLORS.text, margin: 0, lineHeight: 1.2 }}>
              Control de Fichadas <span style={{ color: COLORS.primary }}>— Horas Totalizadas</span>
            </h1>
            <p style={{ fontSize: '0.7rem', color: COLORS.textMuted, margin: 0 }}>Sanatorio Argentino SRL</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => setView('upload')} style={{
            ...btnStyle, background: view === 'upload' ? COLORS.primary : 'transparent',
            color: view === 'upload' ? 'white' : COLORS.textSecondary,
            border: `1px solid ${view === 'upload' ? COLORS.primary : COLORS.border}`,
          }}>
            📄 Importar PDF
          </button>
          <button onClick={() => { setView('dashboard'); loadData(); }} style={{
            ...btnStyle, background: view === 'dashboard' ? COLORS.primary : 'transparent',
            color: view === 'dashboard' ? 'white' : COLORS.textSecondary,
            border: `1px solid ${view === 'dashboard' ? COLORS.primary : COLORS.border}`,
          }}>
            📊 Dashboard
          </button>
          <a href="/" style={{
            ...btnStyle, textDecoration: 'none',
            background: 'transparent', color: COLORS.textSecondary,
            border: `1px solid ${COLORS.border}`,
          }}>
            🏠 Inicio
          </a>
        </div>
      </header>

      {/* ALERTS */}
      {error && (
        <div style={{ margin: '1rem 2rem 0', padding: '0.75rem 1rem', borderRadius: 10,
          background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
          fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
      )}
      {success && (
        <div style={{ margin: '1rem 2rem 0', padding: '0.75rem 1rem', borderRadius: 10,
          background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534',
          fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
      )}

      {/* LOADING OVERLAY */}
      {loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.92)', zIndex: 999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: '2rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: `1px solid ${COLORS.border}`,
            width: '90%', maxWidth: 520, animation: 'fadeIn 0.3s ease-out',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 44, height: 44, border: `4px solid ${COLORS.border}`,
                borderTopColor: COLORS.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: COLORS.text }}>
                  Procesando Fichadas
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: COLORS.textMuted }}>
                  {progressTotal > 0
                    ? `${progressCurrent} de ${progressTotal} colaboradores`
                    : 'Iniciando...'}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            {progressTotal > 0 && (
              <div style={{
                height: 6, background: COLORS.border, borderRadius: 3,
                marginBottom: '1rem', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
                  borderRadius: 3, transition: 'width 0.3s ease',
                  width: `${(progressCurrent / progressTotal) * 100}%`,
                }} />
              </div>
            )}

            {/* Live Log */}
            <div ref={progressRef} style={{
              maxHeight: 280, overflowY: 'auto', background: '#0f172a',
              borderRadius: 10, padding: '0.75rem', fontFamily: "'Consolas', 'Monaco', monospace",
              fontSize: '0.72rem', lineHeight: 1.6,
            }}>
              {progressLog.length === 0 ? (
                <p style={{ color: '#64748b', margin: 0 }}>Esperando...</p>
              ) : (
                progressLog.map((entry, i) => (
                  <div key={i} style={{
                    color: entry.type === 'success' ? '#4ade80'
                         : entry.type === 'error' ? '#f87171'
                         : entry.type === 'warning' ? '#fbbf24'
                         : '#94a3b8',
                    animation: 'fadeIn 0.15s ease-out',
                  }}>
                    <span style={{ color: '#475569', marginRight: 6 }}>
                      {entry.time.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    {entry.msg}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <main style={{ padding: '1.5rem 2rem', maxWidth: 1400, margin: '0 auto' }}>
        {view === 'upload' ? (
          <UploadView
            dragOver={dragOver} setDragOver={setDragOver}
            onDrop={onDrop} onFileSelect={onFileSelect}
            fileInputRef={fileInputRef}
            importaciones={importaciones}
            onDeleteImport={handleDeleteImport}
            onViewImport={(imp) => {
              setFiltroMes(imp.periodo_mes);
              setFiltroAnio(imp.periodo_anio);
              if (imp.area) setFiltroArea(imp.area);
              setView('dashboard');
              loadData();
            }}
          />
        ) : (
          <DashboardView
            totales={filteredTotales}
            totalColaboradores={totalColaboradores}
            totalHorasRedondeadas={totalHorasRedondeadas}
            totalDiasTrabajados={totalDiasTrabajados}
            totalHorasExtra={totalHorasExtra}
            // Filters
            filtroArea={filtroArea} setFiltroArea={setFiltroArea}
            filtroColaborador={filtroColaborador} setFiltroColaborador={setFiltroColaborador}
            filtroMes={filtroMes} setFiltroMes={setFiltroMes}
            filtroAnio={filtroAnio} setFiltroAnio={setFiltroAnio}
            filtroPeriodo={filtroPeriodo} setFiltroPeriodo={setFiltroPeriodo}
            filtroCriterio={filtroCriterio} setFiltroCriterio={setFiltroCriterio}
            areas={areas} colaboradores={colaboradores}
            // Detail
            expandedColab={expandedColab} toggleExpand={toggleExpand}
            detailRecords={detailRecords}
            // Export
            onExportXLSX={handleExportXLSX}
            onExportPDF={handleExportPDF}
            onExportDetailXLSX={handleExportDetailXLSX}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer style={{
        textAlign: 'center', padding: '1.5rem', fontSize: '0.75rem',
        color: COLORS.textMuted, borderTop: `1px solid ${COLORS.border}`,
      }}>
        Sanatorio Argentino — Control de Fichadas · Desarrollado por <strong>Innovación y Transformación Digital</strong>
        <br />© {new Date().getFullYear()}
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── UPLOAD VIEW ─────────────────────────────────────────────────
function UploadView({ dragOver, setDragOver, onDrop, onFileSelect, fileInputRef, importaciones, onDeleteImport, onViewImport }) {
  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Upload Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 50%, #075985 100%)`,
        borderRadius: 16, padding: '2.5rem', color: 'white', marginBottom: '2rem',
        boxShadow: '0 10px 25px rgba(0, 94, 184, 0.3)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', right: 80, bottom: -40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>📄 Importar PDF de Fichadas</h2>
        <p style={{ fontSize: '0.9rem', opacity: 0.9, margin: 0, maxWidth: 600, lineHeight: 1.5 }}>
          Subí el archivo PDF generado por el sistema de fichadas. El sistema lo procesará automáticamente,
          calculará las horas redondeadas (regla de 45 min) y guardará todo en la base de datos.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? COLORS.primary : COLORS.border}`,
          borderRadius: 16, padding: '3rem 2rem', textAlign: 'center',
          background: dragOver ? COLORS.primaryLight : 'white',
          transition: 'all 0.2s', cursor: 'pointer',
          marginBottom: '2rem',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          {dragOver ? '📥' : '📋'}
        </div>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: COLORS.text, margin: '0 0 0.5rem 0' }}>
          {dragOver ? 'Soltá el archivo aquí' : 'Arrastrá el PDF aquí o hacé clic para seleccionar'}
        </p>
        <p style={{ fontSize: '0.8rem', color: COLORS.textMuted, margin: 0 }}>
          Formato aceptado: PDF de Horas Totalizadas del sistema de fichadas
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* Import History */}
      {importaciones.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: COLORS.text }}>
              📂 Historial de Importaciones
            </h3>
            <span style={{ fontSize: '0.75rem', color: COLORS.textMuted }}>{importaciones.length} registros</span>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {importaciones.map((imp) => (
              <div key={imp.id} style={{
                padding: '0.75rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = COLORS.primaryLight}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: COLORS.text }}>
                    {imp.nombre_archivo}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: COLORS.textMuted }}>
                    {imp.area} — {MESES[imp.periodo_mes]} {imp.periodo_anio} — {imp.total_colaboradores} colaboradores — {imp.total_registros} registros
                  </p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: COLORS.textMuted }}>
                    Importado: {new Date(imp.fecha_importacion).toLocaleString('es-AR')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => onViewImport(imp)}
                    style={{ ...btnSmall, background: COLORS.primaryLight, color: COLORS.primary }}>
                    👁 Ver
                  </button>
                  <button onClick={() => onDeleteImport(imp.id)}
                    style={{ ...btnSmall, background: '#fef2f2', color: COLORS.danger }}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD VIEW ──────────────────────────────────────────────
function DashboardView({
  totales, totalColaboradores, totalHorasRedondeadas, totalDiasTrabajados, totalHorasExtra,
  filtroArea, setFiltroArea, filtroColaborador, setFiltroColaborador,
  filtroMes, setFiltroMes, filtroAnio, setFiltroAnio,
  filtroPeriodo, setFiltroPeriodo, filtroCriterio, setFiltroCriterio,
  areas, colaboradores,
  expandedColab, toggleExpand, detailRecords,
  onExportXLSX, onExportPDF, onExportDetailXLSX,
}) {
  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* FILTER PANEL */}
      <div style={{
        background: 'white', borderRadius: 16, border: `1px solid ${COLORS.border}`,
        padding: '1.25rem', marginBottom: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: COLORS.text }}>
            🔎 Configuración de Informes
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
          {/* Criterio de Período */}
          <div style={{ ...filterGroupStyle }}>
            <h4 style={filterGroupTitle}>Criterio de Período</h4>
            {['diario', 'mensual', 'rango', 'anual', 'todo'].map(op => (
              <label key={op} style={radioLabel}>
                <input type="radio" name="periodo" value={op}
                  checked={filtroPeriodo === op}
                  onChange={() => setFiltroPeriodo(op)}
                  style={radioInput}
                />
                <span style={{
                  ...radioCustom,
                  borderColor: filtroPeriodo === op ? COLORS.primary : '#cbd5e1',
                  background: filtroPeriodo === op ? COLORS.primary : 'white',
                }} />
                <span style={{ fontSize: '0.82rem', color: COLORS.text, textTransform: 'capitalize' }}>{op}</span>
              </label>
            ))}

            {(filtroPeriodo === 'mensual' || filtroPeriodo === 'diario') && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <select value={filtroMes} onChange={e => setFiltroMes(Number(e.target.value))} style={selectStyle}>
                  {MESES.slice(1).map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
                <input type="number" value={filtroAnio}
                  onChange={e => setFiltroAnio(Number(e.target.value))}
                  style={{ ...selectStyle, width: 80 }}
                  min={2020} max={2030}
                />
              </div>
            )}
            {filtroPeriodo === 'anual' && (
              <div style={{ marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: COLORS.textMuted }}>Año</label>
                <input type="number" value={filtroAnio}
                  onChange={e => setFiltroAnio(Number(e.target.value))}
                  style={{ ...selectStyle, width: 80 }}
                  min={2020} max={2030}
                />
              </div>
            )}
          </div>

          {/* Criterio de Rango */}
          <div style={{ ...filterGroupStyle }}>
            <h4 style={filterGroupTitle}>Criterio de Rango</h4>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', color: COLORS.textMuted, display: 'block', marginBottom: 4 }}>Buscar por Área</label>
              <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)} style={selectStyle}>
                <option value="">Todas las Áreas</option>
                {areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: COLORS.textMuted, display: 'block', marginBottom: 4 }}>Buscar por Colaborador</label>
              <select value={filtroColaborador} onChange={e => setFiltroColaborador(e.target.value)} style={selectStyle}>
                <option value="">Todos</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre_completo}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Criterio de Selección */}
          <div style={{ ...filterGroupStyle }}>
            <h4 style={filterGroupTitle}>Criterio de Selección</h4>
            {[
              { value: 'area', label: 'por Área' },
              { value: 'sector', label: 'por Sector' },
              { value: 'personal', label: 'por Personal' },
              { value: 'imputacion', label: 'por Imputación' },
              { value: 'ninguno', label: 'Ningún Criterio' },
            ].map(op => (
              <label key={op.value} style={radioLabel}>
                <input type="radio" name="criterio" value={op.value}
                  checked={filtroCriterio === op.value}
                  onChange={() => setFiltroCriterio(op.value)}
                  style={radioInput}
                />
                <span style={{
                  ...radioCustom,
                  borderColor: filtroCriterio === op.value ? COLORS.primary : '#cbd5e1',
                  background: filtroCriterio === op.value ? COLORS.primary : 'white',
                }} />
                <span style={{ fontSize: '0.82rem', color: COLORS.text }}>{op.label}</span>
              </label>
            ))}

            {/* Export buttons */}
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: '0.5rem' }}>
              <button onClick={onExportXLSX} style={{ ...btnSmall, background: '#065f46', color: 'white', flex: 1 }}>
                📊 Excel
              </button>
              <button onClick={onExportPDF} style={{ ...btnSmall, background: COLORS.danger, color: 'white', flex: 1 }}>
                📄 PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <SummaryCard icon="👥" label="Colaboradores" value={totalColaboradores} color={COLORS.primary} />
        <SummaryCard icon="⏱" label="Total Hs. Redondeadas" value={`${roundHours(totalHorasRedondeadas)}h`} color={COLORS.success} />
        <SummaryCard icon="📅" label="Días Trabajados" value={totalDiasTrabajados} color={COLORS.accent} />
        <SummaryCard icon="⭐" label="Horas Extra" value={formatMinToHHMM(totalHorasExtra)} color={COLORS.warning} />
      </div>

      {/* DATA TABLE */}
      <div style={{ background: 'white', borderRadius: 16, border: `1px solid ${COLORS.border}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: COLORS.text }}>
            📋 Detalle por Colaborador
            {filtroArea && <span style={{ fontWeight: 400, color: COLORS.textMuted }}> — {filtroArea}</span>}
            <span style={{ fontWeight: 400, color: COLORS.textMuted }}> — {MESES[filtroMes]} {filtroAnio}</span>
          </h3>
        </div>

        {totales.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: COLORS.textMuted }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Sin datos para este período</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Importá un PDF de fichadas o ajustá los filtros.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: COLORS.primaryLight }}>
                  <th style={thStyle}></th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Colaborador</th>
                  <th style={thStyle}>Área</th>
                  <th style={thStyle}>Días Trab.</th>
                  <th style={thStyle}>Hs. Trabajadas</th>
                  <th style={thStyle}>Hs. Redondeadas</th>
                  <th style={{ ...thStyle, fontWeight: 800, color: COLORS.primary }}>Total Hs.</th>
                  <th style={thStyle}>Hs. Extra</th>
                  <th style={thStyle}>Tardanzas</th>
                </tr>
              </thead>
              <tbody>
                {totales.map((row, idx) => (
                  <React.Fragment key={row.id || idx}>
                    <tr style={{
                      background: idx % 2 === 0 ? 'white' : '#f8fafc',
                      transition: 'background 0.15s', cursor: 'pointer',
                    }}
                      onClick={() => toggleExpand(row.colaborador_id)}
                      onMouseEnter={e => e.currentTarget.style.background = COLORS.primaryLight}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#f8fafc'}
                    >
                      <td style={tdStyle}>
                        <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s', display: 'inline-block',
                          transform: expandedColab === row.colaborador_id ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                          ▶
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>
                        {row.colaborador?.nombre_completo || '—'}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          background: COLORS.primaryLight, color: COLORS.primary,
                          padding: '0.15rem 0.5rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
                        }}>
                          {row.area || '—'}
                        </span>
                      </td>
                      <td style={tdStyle}>{row.dias_trabajados || 0}</td>
                      <td style={tdStyle}>{formatMinToHHMM(row.total_horas_trabajadas_min || 0)}</td>
                      <td style={tdStyle}>{formatMinToHHMM(row.total_horas_redondeadas_min || 0)}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: COLORS.primary, fontSize: '0.9rem' }}>
                        {roundHours(row.total_horas_redondeadas_min || 0)}h
                      </td>
                      <td style={tdStyle}>{formatMinToHHMM(row.total_hora_extra_min || 0)}</td>
                      <td style={tdStyle}>{row.dias_tarde || 0}</td>
                    </tr>

                    {/* Expanded Detail */}
                    {expandedColab === row.colaborador_id && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0, background: '#f0f4ff' }}>
                          <div style={{ padding: '1rem 1.25rem', animation: 'fadeIn 0.2s ease-out' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: COLORS.primary }}>
                                📅 Detalle Diario — {row.colaborador?.nombre_completo}
                              </h4>
                              {detailRecords.length > 0 && (
                                <button onClick={onExportDetailXLSX} style={{ ...btnSmall, background: '#065f46', color: 'white' }}>
                                  📊 Exportar Detalle
                                </button>
                              )}
                            </div>

                            {detailRecords.length === 0 ? (
                              <p style={{ color: COLORS.textMuted, fontSize: '0.8rem' }}>Cargando registros...</p>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', background: 'white', borderRadius: 8, overflow: 'hidden' }}>
                                <thead>
                                  <tr style={{ background: COLORS.primary }}>
                                    <th style={{ ...thStyleSmall, color: 'white' }}>Fecha</th>
                                    <th style={{ ...thStyleSmall, color: 'white' }}>Entrada</th>
                                    <th style={{ ...thStyleSmall, color: 'white' }}>Salida</th>
                                    <th style={{ ...thStyleSmall, color: 'white' }}>Hs. Trabajadas</th>
                                    <th style={{ ...thStyleSmall, color: 'white' }}>Hs. Redondeadas</th>
                                    <th style={{ ...thStyleSmall, color: 'white', fontWeight: 800 }}>Total Hs.</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detailRecords.map((rec, rIdx) => {
                                    const hoursRounded = roundHours(rec.horas_redondeadas_min || 0);
                                    return (
                                      <tr key={rec.id || rIdx} style={{ background: rIdx % 2 === 0 ? 'white' : '#f8fafc' }}>
                                        <td style={tdStyleSmall}>
                                          {new Date(rec.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                                        </td>
                                        <td style={{ ...tdStyleSmall, color: rec.fichada_entrada ? COLORS.success : COLORS.textMuted }}>
                                          {rec.fichada_entrada || '—'}
                                        </td>
                                        <td style={{ ...tdStyleSmall, color: rec.fichada_salida ? '#dc2626' : COLORS.textMuted }}>
                                          {rec.fichada_salida || '—'}
                                        </td>
                                        <td style={tdStyleSmall}>{formatMinToHHMM(rec.horas_trabajadas_min || 0)}</td>
                                        <td style={tdStyleSmall}>{formatMinToHHMM(rec.horas_redondeadas_min || 0)}</td>
                                        <td style={{ ...tdStyleSmall, fontWeight: 700, color: COLORS.primary }}>
                                          {hoursRounded}h
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                {/* TOTALS ROW */}
                <tr style={{ background: COLORS.primary, color: 'white', fontWeight: 700 }}>
                  <td style={{ ...tdStyle, color: 'white' }}></td>
                  <td style={{ ...tdStyle, color: 'white', textAlign: 'left' }}>TOTAL GENERAL</td>
                  <td style={{ ...tdStyle, color: 'white' }}>{totales.length} colab.</td>
                  <td style={{ ...tdStyle, color: 'white' }}>{totalDiasTrabajados}</td>
                  <td style={{ ...tdStyle, color: 'white' }}>{formatMinToHHMM(totales.reduce((a, t) => a + (t.total_horas_trabajadas_min || 0), 0))}</td>
                  <td style={{ ...tdStyle, color: 'white' }}>{formatMinToHHMM(totalHorasRedondeadas)}</td>
                  <td style={{ ...tdStyle, color: 'white', fontSize: '1rem' }}>{roundHours(totalHorasRedondeadas)}h</td>
                  <td style={{ ...tdStyle, color: 'white' }}>{formatMinToHHMM(totalHorasExtra)}</td>
                  <td style={{ ...tdStyle, color: 'white' }}>{totales.reduce((a, t) => a + (t.dias_tarde || 0), 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SUMMARY CARD ────────────────────────────────────────────────
function SummaryCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '1.25rem',
      border: `1px solid ${COLORS.border}`, position: 'relative', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'all 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
    >
      <div style={{ position: 'absolute', right: -10, top: -10, width: 60, height: 60, borderRadius: '50%', background: `${color}10` }} />
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
      <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color }}>{value}</p>
      <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: COLORS.textMuted }}>{label}</p>
    </div>
  );
}

// ─── SHARED STYLES ───────────────────────────────────────────────
const btnStyle = {
  padding: '0.4rem 0.85rem', borderRadius: 8, fontSize: '0.8rem',
  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
  fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
};

const btnSmall = {
  padding: '0.3rem 0.65rem', borderRadius: 6, fontSize: '0.75rem',
  fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
  fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
};

const filterGroupStyle = {
  border: `1px solid ${COLORS.border}`, borderRadius: 10,
  padding: '0.75rem 1rem',
};

const filterGroupTitle = {
  margin: '0 0 0.65rem 0', fontSize: '0.82rem', fontWeight: 700,
  color: COLORS.text, paddingBottom: '0.5rem', borderBottom: `1px solid ${COLORS.border}`,
};

const radioLabel = {
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.2rem 0', cursor: 'pointer',
};

const radioInput = {
  position: 'absolute', opacity: 0, width: 0, height: 0,
};

const radioCustom = {
  width: 14, height: 14, borderRadius: '50%', border: '2px solid #cbd5e1',
  display: 'inline-block', flexShrink: 0, transition: 'all 0.15s',
};

const selectStyle = {
  width: '100%', padding: '0.4rem 0.5rem', borderRadius: 6,
  border: `1px solid ${COLORS.border}`, fontSize: '0.8rem',
  fontFamily: 'inherit', color: COLORS.text, background: 'white',
  outline: 'none',
};

const thStyle = {
  padding: '0.65rem 0.75rem', fontWeight: 700, fontSize: '0.78rem',
  color: COLORS.text, textAlign: 'center', borderBottom: `2px solid ${COLORS.border}`,
};

const tdStyle = {
  padding: '0.6rem 0.75rem', textAlign: 'center',
  borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text,
};

const thStyleSmall = {
  padding: '0.45rem 0.6rem', fontWeight: 600, fontSize: '0.75rem',
  textAlign: 'center',
};

const tdStyleSmall = {
  padding: '0.4rem 0.6rem', textAlign: 'center',
  borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text,
};
