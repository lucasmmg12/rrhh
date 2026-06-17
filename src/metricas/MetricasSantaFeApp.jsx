import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Area, AreaChart,
} from 'recharts';
import {
  parseRevisionXlsx,
  uploadRecords,
  fetchVisitasSF,
  getRecordCount,
  getHeatmapDias,
  getHeatmapHoras,
  getObrasSociales,
  getRankingEspecialidades,
  getRankingMedicos,
  getRankingTipoVisita,
  getVisitasPorMes,
  getHeatmapMatrixDiaHora,
  getAusentismoStats,
  getPacientesRecurrentes,
  getRankingGrupoAgenda,
  getRankingOperadoras,
  getBreakdownSectorOperadora,
  getOperadorasStats,
  getOperadoraCoverage,
} from './metricasService';
import './metricas.css';

const MetricasReportePDF = React.lazy(() => import('./MetricasReportePDF'));

// ─── Reusable Chart Help Component ─────────────────────────
function ChartHelp({ text, tips }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mt-chart-help">
      <button
        className="mt-chart-help__toggle"
        onClick={() => setOpen(p => !p)}
      >
        <span style={{ fontSize: '0.9rem' }}>{open ? '📖' : '💡'}</span>
        <span>{open ? 'Ocultar guía' : '¿Cómo interpretar este gráfico?'}</span>
        <span style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '0.7rem' }}>▼</span>
      </button>
      {open && (
        <div className="mt-chart-help__content animate-fade-in">
          <p className="mt-chart-help__text">{text}</p>
          {tips && tips.length > 0 && (
            <div className="mt-chart-help__tips">
              <strong>Claves de lectura:</strong>
              <ul>
                {tips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function MetricasSantaFeApp({ embedded = false }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordCount, setRecordCount] = useState(0);
  const [activeTab, setActiveTab] = useState('resumen');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const fileInputRef = useRef(null);
  const [showReport, setShowReport] = useState(false);

  // Cross-filter: selected specialty (null = show all)
  const [selectedEspecialidad, setSelectedEspecialidad] = useState(null);

  // ─── Load Data ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [records, count] = await Promise.all([fetchVisitasSF(), getRecordCount()]);
      setData(records);
      setRecordCount(count);
    } catch (err) {
      console.error('Error loading métricas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── File Upload Handler ────────────────────────────────
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true); setUploadProgress(0); setError(null); setSuccessMsg(null);
      setUploadProgress(5);
      const records = await parseRevisionXlsx(file);
      setUploadProgress(20);
      const uploaded = await uploadRecords(records, (pct) => setUploadProgress(20 + Math.round(pct * 0.75)));
      setUploadProgress(100);
      setSuccessMsg(`✅ ${uploaded.toLocaleString()} registros procesados correctamente`);
      await loadData();
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Error al procesar: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [loadData]);

  // ─── Filtered data for Resumen cross-filter ─────────────
  const filteredData = useMemo(() => {
    if (!selectedEspecialidad) return data;
    return data.filter(d => d.especialidad === selectedEspecialidad);
  }, [data, selectedEspecialidad]);

  // ─── Computed: full data (for other tabs) ───────────────
  const heatmapDias = useMemo(() => getHeatmapDias(data), [data]);
  const heatmapHoras = useMemo(() => getHeatmapHoras(data), [data]);
  const obrasSociales = useMemo(() => getObrasSociales(data), [data]);
  const rankEspecialidades = useMemo(() => getRankingEspecialidades(data), [data]);
  const rankMedicos = useMemo(() => getRankingMedicos(data), [data]);
  const rankTipoVisita = useMemo(() => getRankingTipoVisita(data), [data]);
  const visitasMes = useMemo(() => getVisitasPorMes(data), [data]);
  const heatmapMatrix = useMemo(() => getHeatmapMatrixDiaHora(data), [data]);
  const ausentismo = useMemo(() => getAusentismoStats(data), [data]);
  const pacientesRec = useMemo(() => getPacientesRecurrentes(data), [data]);
  const rankGrupoAgenda = useMemo(() => getRankingGrupoAgenda(data), [data]);
  const rankOperadoras = useMemo(() => getRankingOperadoras(data), [data]);
  const sectorOperadora = useMemo(() => getBreakdownSectorOperadora(data), [data]);
  const operadorasStats = useMemo(() => getOperadorasStats(data), [data]);
  const operadoraCoverage = useMemo(() => getOperadoraCoverage(data), [data]);

  // ─── Computed: filtered data (for Resumen cross-filter)
  const resHeatmapDias = useMemo(() => getHeatmapDias(filteredData), [filteredData]);
  const resObrasSociales = useMemo(() => getObrasSociales(filteredData), [filteredData]);
  const resVisitasMes = useMemo(() => getVisitasPorMes(filteredData), [filteredData]);
  const resRankMedicos = useMemo(() => getRankingMedicos(filteredData), [filteredData]);

  // KPIs (filtered when specialty selected)
  const kpis = useMemo(() => {
    const src = filteredData;
    return {
      totalVisitas: src.length,
      especialidades: new Set(src.map(d => d.especialidad).filter(Boolean)).size,
      medicos: new Set(src.map(d => d.responsable).filter(Boolean)).size,
      obrasSociales: new Set(src.map(d => d.cliente).filter(c => c && /^\d/.test(c.trim()))).size,
      operadoras: new Set(src.map(d => d.operadora).filter(Boolean)).size,
    };
  }, [filteredData]);

  // Auto-hide success message
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 6000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  return (
    <>
    <div className="mt">
      {/* ─── HERO ─── */}
      <div className="mt-hero">
        <div className="mt-hero__top">
          <div>
            <h1 className="mt-hero__title">📊 Métricas de Atención</h1>
            <p className="mt-hero__subtitle">
              Dashboard analítico de visitas médicas — Sede Santa Fe
            </p>
          </div>
          <div className="mt-hero__badge">📍 SANTA FE</div>
          {data.length > 0 && (
            <button className="mt-hero__report-btn" onClick={() => setShowReport(true)}>
              📄 Generar Informe PDF
            </button>
          )}
        </div>
      </div>

      {/* ─── UPLOAD BAR ─── */}
      <div className="mt-upload">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          id="mt-file-upload"
        />
        <button
          className="mt-upload__btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '⏳ Procesando...' : '📤 Subir revision.xlsx'}
        </button>

        {uploading && (
          <div className="mt-progress">
            <div className="mt-progress__bar">
              <div
                className="mt-progress__fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="mt-progress__label">{uploadProgress}% completado</div>
          </div>
        )}

        {recordCount > 0 && !uploading && (
          <span className="mt-upload__count">
            {recordCount.toLocaleString()} registros en base
          </span>
        )}

        {recordCount === 0 && !uploading && (
          <span className="mt-upload__info">
            Sube el archivo <strong>revision.xlsx</strong> para cargar los datos
          </span>
        )}
      </div>

      {/* Success / Error messages */}
      {successMsg && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1rem',
          background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534',
          fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          animation: 'mtFadeIn 0.3s ease-out',
        }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}>✕</button>
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1rem',
          background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
          fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>❌ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>✕</button>
        </div>
      )}

      {/* ─── CONTENT ─── */}
      {loading ? (
        <div className="mt-loading">
          <div className="mt-loading__spinner" />
          <span className="mt-loading__text">Cargando métricas...</span>
        </div>
      ) : data.length === 0 ? (
        <div className="mt-empty">
          <div className="mt-empty__icon">📊</div>
          <h3 className="mt-empty__title">Sin datos cargados</h3>
          <p className="mt-empty__desc">
            Sube el archivo <strong>revision.xlsx</strong> para visualizar las métricas de atención de la sede Santa Fe.
          </p>
        </div>
      ) : (
        <>
          {/* ─── TABS ─── */}
          <div className="mt-tabs">
            {[
              { id: 'resumen', icon: '📊', label: 'Resumen' },
              { id: 'heatmaps', icon: '🔥', label: 'Mapas de Calor' },
              { id: 'rankings', icon: '🏆', label: 'Rankings' },
              { id: 'operadoras', icon: '👩‍💼', label: 'Operadoras' },
              { id: 'ausentismo', icon: '🚫', label: 'Ausentismo' },
              { id: 'avanzado', icon: '🔬', label: 'Análisis Avanzado' },
              { id: 'tendencias', icon: '📈', label: 'Tendencias' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`mt-tab ${activeTab === tab.id ? 'mt-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="mt-tab__icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* KPIs (always visible) */}
          <div className="mt-kpis">
            <KpiCard icon="📋" label="Total Visitas" value={kpis.totalVisitas.toLocaleString()} color="#1E5FA6" bg="#EBF2FA" />
            <KpiCard icon="🏥" label="Especialidades" value={kpis.especialidades} color="#059669" bg="#dcfce7" />
            <KpiCard icon="👨‍⚕️" label="Médicos" value={kpis.medicos} color="#7C3AED" bg="#ede9fe" />
            <KpiCard icon="🏦" label="Obras Sociales" value={kpis.obrasSociales} color="#0891B2" bg="#cffafe" />
            <KpiCard icon="👩‍💼" label="Operadoras" value={kpis.operadoras} color="#D97706" bg="#fef3c7" />
          </div>

          {activeTab === 'resumen' && (
            <ResumenView
              heatmapDias={resHeatmapDias}
              obrasSociales={resObrasSociales}
              rankEspecialidades={rankEspecialidades}
              rankMedicos={resRankMedicos}
              visitasMes={resVisitasMes}
              selectedEspecialidad={selectedEspecialidad}
              onSelectEspecialidad={(esp) => setSelectedEspecialidad(prev => prev === esp ? null : esp)}
            />
          )}
          {activeTab === 'heatmaps' && (
            <HeatmapsView heatmapDias={heatmapDias} heatmapHoras={heatmapHoras} heatmapMatrix={heatmapMatrix} />
          )}
          {activeTab === 'rankings' && (
            <RankingsView
              rankEspecialidades={rankEspecialidades}
              rankMedicos={rankMedicos}
              rankTipoVisita={rankTipoVisita}
              rankGrupoAgenda={rankGrupoAgenda}
            />
          )}
          {activeTab === 'operadoras' && (
            <OperadorasView
              data={data}
              rankOperadoras={rankOperadoras}
              sectorOperadora={sectorOperadora}
              operadorasStats={operadorasStats}
              coverage={operadoraCoverage}
            />
          )}
          {activeTab === 'ausentismo' && (
            <AusentismoView ausentismo={ausentismo} />
          )}
          {activeTab === 'avanzado' && (
            <AvanzadoView pacientesRec={pacientesRec} heatmapMatrix={heatmapMatrix} />
          )}
          {activeTab === 'tendencias' && (
            <TendenciasView visitasMes={visitasMes} />
          )}
        </>
      )}
    </div>

      {/* ─── PDF REPORT OVERLAY ─── */}
      {showReport && (
        <React.Suspense fallback={<div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', fontSize: '1rem' }}>Cargando informe...</div>}>
          <MetricasReportePDF
            kpis={kpis}
            heatmapDias={heatmapDias}
            obrasSociales={obrasSociales}
            rankEspecialidades={rankEspecialidades}
            rankMedicos={rankMedicos}
            visitasMes={visitasMes}
            heatmapMatrix={heatmapMatrix}
            rankGrupoAgenda={rankGrupoAgenda}
            onClose={() => setShowReport(false)}
          />
        </React.Suspense>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
//  RESUMEN VIEW (Overview)
// ═══════════════════════════════════════════════════════════
function ResumenView({ heatmapDias, obrasSociales, rankEspecialidades, rankMedicos, visitasMes, selectedEspecialidad, onSelectEspecialidad }) {
  return (
    <div style={{ animation: 'mtFadeIn 0.3s ease-out' }}>
      {/* Active filter indicator */}
      {selectedEspecialidad && (
        <div className="mt-filter-badge">
          <span>🏥 Filtrando por: <strong>{selectedEspecialidad}</strong></span>
          <span style={{ fontSize: '0.72rem', color: 'rgba(30,95,166,0.6)', marginLeft: '8px' }}>
            Todos los gráficos de esta pestaña muestran datos de esta especialidad
          </span>
          <button className="mt-filter-badge__clear" onClick={() => onSelectEspecialidad(null)}>
            ✕ Quitar filtro
          </button>
        </div>
      )}

      <div className="mt-chart-grid">
        {/* Heatmap Días mini */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🔥 Días más concurridos</span>
          </div>
          <ChartHelp
            text="Muestra la cantidad total de visitas agrupadas por día de la semana (Lunes a Domingo). El color más oscuro indica mayor concurrencia. Permite identificar los días con mayor carga asistencial."
            tips={[
              'Los colores van de celeste claro (menor actividad) a azul oscuro (mayor actividad)',
              'Compará días de semana vs. fin de semana para evaluar la distribución de la demanda',
              'Días con poca actividad pueden representar oportunidades de redistribución de agenda',
            ]}
          />
          <HeatmapDias data={heatmapDias} />
        </div>

        {/* Pie Obras Sociales */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🏦 Obras Sociales</span>
            <span className="mt-chart-card__subtitle">Top 10</span>
          </div>
          <ChartHelp
            text='Gráfico de torta que muestra la proporción de visitas según la obra social del paciente (campo "Cliente" del sistema). Las 10 obras sociales con más visitas se muestran individualmente y el resto se agrupa en "Otros".'
            tips={[
              'Pasá el mouse sobre cada sector para ver el porcentaje exacto y la cantidad de visitas',
              'Obras sociales dominantes pueden indicar convenios fuertes o perfiles de población atendida',
              'La categoría "Otros" agrupa las obras sociales con menor volumen individual',
            ]}
          />
          <PieObrasSociales data={obrasSociales} />
        </div>

        {/* Ranking Especialidades — CLICKABLE */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🏆 Especialidades más concurridas</span>
            <span className="mt-chart-card__subtitle">Hacé click para filtrar</span>
          </div>
          <ChartHelp
            text="Lista ordenada de las 15 especialidades médicas con mayor cantidad de visitas registradas. Hacé click en cualquier especialidad para filtrar todos los gráficos de esta pestaña y ver los datos específicos de esa especialidad."
            tips={[
              'Click en una especialidad = filtra todos los gráficos de Resumen por esa especialidad',
              'Click de nuevo en la misma = quita el filtro y vuelve a "Todas"',
              '🥇🥈🥉 indican las tres especialidades con más demanda',
              'La barra horizontal muestra la proporción relativa respecto a la especialidad líder',
            ]}
          />
          <ClickableRankingList
            data={rankEspecialidades}
            color="#1E5FA6"
            selectedValue={selectedEspecialidad}
            onSelect={onSelectEspecialidad}
          />
        </div>

        {/* Ranking Médicos (filtered) */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">👨‍⚕️ Médicos{selectedEspecialidad ? ` — ${selectedEspecialidad}` : ''}</span>
            <span className="mt-chart-card__subtitle">Top 15{selectedEspecialidad ? ' (filtrado)' : ''}</span>
          </div>
          <ChartHelp
            text="Ranking de médicos por volumen de atención. Cuando una especialidad está seleccionada, muestra solo los médicos de esa especialidad."
            tips={[
              'Se actualiza automáticamente al seleccionar una especialidad',
              'Útil para ver qué médicos atienden cada especialidad',
            ]}
          />
          <RankingList data={rankMedicos} color="#7C3AED" />
        </div>

        {/* Line Visitas por Mes */}
        <div className="mt-chart-card mt-chart-card--full">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">📈 Visitas por mes{selectedEspecialidad ? ` — ${selectedEspecialidad}` : ''}</span>
          </div>
          <ChartHelp
            text="Gráfico de línea que muestra la evolución temporal de la cantidad total de visitas mes a mes. Permite identificar estacionalidad, tendencias de crecimiento o caída en la demanda."
            tips={[
              'Picos pueden indicar campañas de salud, estacionalidad (invierno = más consultas) o eventos especiales',
              'Caídas abruptas pueden correlacionar con feriados, vacaciones o problemas operativos',
              'La tendencia general (subiendo, bajando, estable) indica la evolución de la demanda',
            ]}
          />
          <LineVisitasMes data={visitasMes} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  HEATMAPS VIEW
// ═══════════════════════════════════════════════════════════
function HeatmapsView({ heatmapDias, heatmapHoras, heatmapMatrix }) {
  return (
    <div style={{ animation: 'mtFadeIn 0.3s ease-out' }}>
      <div className="mt-chart-grid--single" style={{ display: 'grid', gap: '1.25rem' }}>
        {/* Matrix Heatmap - Day × Hour */}
        <div className="mt-chart-card mt-chart-card--full">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🗓️ Mapa de calor — Día × Hora</span>
            <span className="mt-chart-card__subtitle">Cruce de día de la semana y hora del día</span>
          </div>
          <ChartHelp
            text="Grilla matricial que cruza los 7 días de la semana (filas) con cada hora del día (columnas). Cada celda muestra la cantidad de visitas para esa combinación específica día+hora. Los colores más oscuros indican mayor concentración."
            tips={[
              'Pasá el mouse sobre cada celda para ver el detalle exacto (día, hora y cantidad)',
              'Las celdas se amplían al pasar el cursor para facilitar la lectura',
              'Buscá bloques de color oscuro consecutivos: indican las franjas horarias de mayor presión asistencial',
              'Las horas sin actividad (·) no se muestran si no tienen ningún registro en toda la semana',
              'Útil para planificar refuerzos de personal en las franjas críticas',
            ]}
          />
          <HeatmapMatrixDiaHora data={heatmapMatrix} />
        </div>

        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🔥 Mapa de calor — Días de la semana</span>
            <span className="mt-chart-card__subtitle">Distribución de visitas por día</span>
          </div>
          <ChartHelp
            text="Muestra el volumen total de visitas para cada día de la semana (Lunes a Domingo), sumando todas las horas. Permite ver de un vistazo qué días tienen más carga."
            tips={[
              'Colores más oscuros = días con más visitas',
              'Compará la diferencia entre el día más activo y el menos activo para evaluar la distribución',
              'Ideal para planificar dotación de personal semanal',
            ]}
          />
          <HeatmapDias data={heatmapDias} />
        </div>

        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">⏰ Mapa de calor — Horario</span>
            <span className="mt-chart-card__subtitle">Distribución de visitas por hora del día (0-23h)</span>
          </div>
          <ChartHelp
            text="Muestra la cantidad total de visitas para cada hora del día (00:00 a 23:00), sumando todos los días. Identifica las horas pico y los valles de actividad."
            tips={[
              'Las horas con color más intenso son las de mayor demanda asistencial',
              'Horas con valor 0 o muy bajo indican que no se atiende en ese horario',
              'Compará la franja matutina vs. vespertina para equilibrar la oferta de turnos',
              'Picos pronunciados pueden indicar necesidad de ampliar la ventana horaria',
            ]}
          />
          <HeatmapHoras data={heatmapHoras} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  RANKINGS VIEW
// ═══════════════════════════════════════════════════════════
function RankingsView({ rankEspecialidades, rankMedicos, rankTipoVisita, rankGrupoAgenda }) {
  return (
    <div style={{ animation: 'mtFadeIn 0.3s ease-out' }}>
      <div className="mt-chart-grid">
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🏥 Especialidades más concurridas</span>
            <span className="mt-chart-card__subtitle">Top 15</span>
          </div>
          <ChartHelp
            text="Ranking de las 15 especialidades médicas con más visitas registradas. La barra de cada ítem indica la proporción relativa respecto a la especialidad más visitada."
            tips={[
              'Las primeras 3 posiciones tienen medallas (🥇🥈🥉) y barra más intensa',
              'Si una especialidad concentra demasiadas visitas, puede requerir descongestión',
              'Especialidades en las últimas posiciones podrían necesitar mayor difusión o tienen baja oferta',
            ]}
          />
          <RankingList data={rankEspecialidades} color="#1E5FA6" />
        </div>

        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">👨‍⚕️ Ranking por Médico</span>
            <span className="mt-chart-card__subtitle">Top 15 por cantidad de visitas</span>
          </div>
          <ChartHelp
            text="Los 15 profesionales con mayor volumen de atención. Indica qué médicos concentran la mayor carga de pacientes."
            tips={[
              'Médicos con volúmenes muy altos pueden estar sobrecargados',
              'Una distribución desigual puede afectar la calidad de atención y tiempos de espera',
              'Útil para evaluar redistribución de agendas y equilibrar cargas laborales',
            ]}
          />
          <RankingList data={rankMedicos} color="#7C3AED" />
        </div>

        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">📋 Ranking por Tipo de Visita</span>
            <span className="mt-chart-card__subtitle">Top 15</span>
          </div>
          <ChartHelp
            text='Clasificación de visitas según su tipo (ej: "Primera vez", "Control", "Urgencia", etc.). Muestra qué tipos de atención son más frecuentes.'
            tips={[
              'Un alto porcentaje de controles puede indicar buena adherencia al seguimiento',
              'Muchas consultas de primera vez pueden reflejar captación de nuevos pacientes',
              'Tipos poco frecuentes pueden ser oportunidades de crecimiento o servicios especializados',
            ]}
          />
          <RankingList data={rankTipoVisita} color="#0891B2" />
        </div>

        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">📂 Ranking por Grupo de Agenda</span>
            <span className="mt-chart-card__subtitle">Top 15</span>
          </div>
          <ChartHelp
            text="Ranking de los grupos de agenda más utilizados. Los grupos de agenda son las categorías organizativas que agrupan los turnos por servicio, consultorio o tipo de prestación."
            tips={[
              'Grupos con alto volumen pueden requerir más espacios de agenda o consultorios',
              'Compará con la disponibilidad de consultorios para detectar cuellos de botella',
              'Útil para evaluar si la oferta de turnos se ajusta a la demanda real',
            ]}
          />
          <RankingList data={rankGrupoAgenda} color="#D97706" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  TENDENCIAS VIEW
// ═══════════════════════════════════════════════════════════
function TendenciasView({ visitasMes }) {
  return (
    <div style={{ animation: 'mtFadeIn 0.3s ease-out' }}>
      <div className="mt-chart-card">
        <div className="mt-chart-card__header">
          <span className="mt-chart-card__title">📈 Evolución de visitas por mes</span>
          <span className="mt-chart-card__subtitle">Tendencia temporal completa</span>
        </div>
        <ChartHelp
          text="Gráfico de área que muestra la evolución mensual del total de visitas a lo largo de todo el período disponible. El área sombreada debajo de la línea facilita la visualización de la magnitud. Cada punto representa un mes."
          tips={[
            'Pasá el mouse sobre cada punto para ver el mes y la cantidad exacta de visitas',
            'Tendencia ascendente = crecimiento de la demanda; descendente = contracción',
            'Buscá patrones estacionales: ¿hay meses que siempre suben o bajan?',
            'Caídas abruptas pueden correlacionarse con feriados largos, vacaciones o eventos externos',
            'Comparar con otros indicadores (ausentismo, especialidad) ayuda a entender las causas',
          ]}
        />
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visitasMes} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="colorVisitas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E5FA6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#1E5FA6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v.toLocaleString()}
              />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  fontSize: '0.82rem',
                }}
                formatter={(value) => [value.toLocaleString(), 'Visitas']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#1E5FA6"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorVisitas)"
                dot={{ r: 4, fill: '#1E5FA6', strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 6, fill: '#1E5FA6', stroke: '#ffffff', strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CHART COMPONENTS
// ═══════════════════════════════════════════════════════════

// ─── KPI Card ─────────────────────────────────────────────
function KpiCard({ icon, label, value, color, bg }) {
  return (
    <div className="mt-kpi">
      <div className="mt-kpi__icon" style={{ background: bg, color }}>{icon}</div>
      <div>
        <div className="mt-kpi__value">{value}</div>
        <div className="mt-kpi__label">{label}</div>
      </div>
    </div>
  );
}

// ─── Heatmap: Days of Week ────────────────────────────────
function HeatmapDias({ data }) {
  return (
    <div className="mt-heatmap">
      {data.map((d, i) => {
        const bg = getHeatColor(d.intensity);
        const textColor = d.intensity > 0.5 ? '#ffffff' : '#1e293b';
        return (
          <div
            key={i}
            className="mt-heatmap__cell"
            style={{ background: bg, color: textColor }}
            title={`${d.label}: ${d.value.toLocaleString()} visitas`}
          >
            <span className="mt-heatmap__cell-value">{d.value.toLocaleString()}</span>
            <span className="mt-heatmap__cell-label">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Heatmap: Hours ───────────────────────────────────────
function HeatmapHoras({ data }) {
  return (
    <div className="mt-heatmap mt-heatmap--hours">
      {data.map((d, i) => {
        const bg = getHeatColor(d.intensity);
        const textColor = d.intensity > 0.5 ? '#ffffff' : '#1e293b';
        return (
          <div
            key={i}
            className="mt-heatmap__cell mt-heatmap__cell--hour"
            style={{ background: bg, color: textColor }}
            title={`${d.label}: ${d.value.toLocaleString()} visitas`}
          >
            <span className="mt-heatmap__cell-value">{d.value.toLocaleString()}</span>
            <span className="mt-heatmap__cell-label">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Pie: Obras Sociales ──────────────────────────────────
function PieObrasSociales({ data }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: '0.78rem',
            }}
            formatter={(value, name) => [
              `${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '0.72rem', lineHeight: '1.6' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Ranking List ─────────────────────────────────────────
function RankingList({ data, color = '#1E5FA6' }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="mt-ranking">
      {data.map((d, i) => (
        <div key={i} className="mt-ranking__item">
          <div className={`mt-ranking__pos ${getPosClass(i)}`}>
            {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
          </div>
          <span className="mt-ranking__name" title={d.fullName}>{d.name}</span>
          <div className="mt-ranking__bar-wrapper">
            <div className="mt-ranking__bar">
              <div
                className="mt-ranking__bar-fill"
                style={{
                  width: `${(d.value / maxVal) * 100}%`,
                  background: `${color}${i < 3 ? 'CC' : '66'}`,
                }}
              />
            </div>
          </div>
          <span className="mt-ranking__value">{d.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Line Chart: Visitas por Mes ──────────────────────────
function LineVisitasMes({ data }) {
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 20, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="shortLabel"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={45}
            tickFormatter={v => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: '0.78rem',
            }}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.label || label}
            formatter={(value) => [value.toLocaleString(), 'Visitas']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#1E5FA6"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#1E5FA6', strokeWidth: 2, stroke: '#ffffff' }}
            activeDot={{ r: 6, fill: '#1E5FA6', stroke: '#ffffff', strokeWidth: 2 }}
            label={({ x, y, value }) => (
              <text
                x={x} y={y - 12}
                textAnchor="middle"
                fill="#1e3a8a"
                fontSize={11}
                fontWeight={700}
              >
                {value?.toLocaleString()}
              </text>
            )}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

function getHeatColor(intensity) {
  if (intensity <= 0) return '#f1f5f9';
  if (intensity < 0.2) return '#dbeafe';
  if (intensity < 0.4) return '#93c5fd';
  if (intensity < 0.6) return '#3b82f6';
  if (intensity < 0.8) return '#1d4ed8';
  return '#1e3a8a';
}

function getPosClass(index) {
  if (index === 0) return 'mt-ranking__pos--gold';
  if (index === 1) return 'mt-ranking__pos--silver';
  if (index === 2) return 'mt-ranking__pos--bronze';
  return 'mt-ranking__pos--default';
}

// ─── Clickable Ranking List (for cross-filter) ────────────
function ClickableRankingList({ data, color, selectedValue, onSelect }) {
  if (!data || data.length === 0) return <p style={{ color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center' }}>Sin datos</p>;
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="mt-ranking">
      {data.map((item, i) => {
        const isSelected = selectedValue === item.fullName;
        return (
          <div
            key={i}
            className={`mt-ranking__item mt-ranking__item--clickable ${isSelected ? 'mt-ranking__item--selected' : ''}`}
            onClick={() => onSelect(item.fullName)}
            title={`Click para ${isSelected ? 'quitar filtro' : `filtrar por ${item.fullName}`}`}
          >
            <div className={`mt-ranking__pos ${getPosClass(i)}`}>
              {i === 0 ? '\ud83e\udd47' : i === 1 ? '\ud83e\udd48' : i === 2 ? '\ud83e\udd49' : i + 1}
            </div>
            <span className="mt-ranking__name">{item.name}</span>
            <div className="mt-ranking__bar-wrapper">
              <div className="mt-ranking__bar">
                <div
                  className="mt-ranking__bar-fill"
                  style={{
                    width: `${(item.value / maxVal) * 100}%`,
                    backgroundColor: isSelected ? color : `${color}88`,
                  }}
                />
              </div>
            </div>
            <span className="mt-ranking__value">{item.value.toLocaleString()}</span>
            {isSelected && <span style={{ fontSize: '0.7rem', color }}>✓</span>}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  HEATMAP MATRIX: Day × Hour
// ═══════════════════════════════════════════════════════════
function HeatmapMatrixDiaHora({ data }) {
  if (!data || !data.cells) return null;
  // Filter hours with activity (typically 6-22)
  const activeHours = [];
  for (let h = 0; h < 24; h++) {
    const hasData = data.cells.some(dayRow => dayRow[h]?.value > 0);
    if (hasData) activeHours.push(h);
  }

  return (
    <div style={{ overflowX: 'auto', padding: '0.5rem 0' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: '3px', width: '100%', minWidth: '600px' }}>
        <thead>
          <tr>
            <th style={{ width: '50px', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}></th>
            {activeHours.map(h => (
              <th key={h} style={{
                fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600,
                textAlign: 'center', padding: '4px 2px',
              }}>
                {String(h).padStart(2, '0')}h
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.cells.map((dayRow, dayIdx) => (
            <tr key={dayIdx}>
              <td style={{
                fontSize: '0.75rem', fontWeight: 700, color: '#475569',
                paddingRight: '8px', whiteSpace: 'nowrap',
              }}>
                {data.days[dayIdx]}
              </td>
              {activeHours.map(h => {
                const cell = dayRow[h];
                const bg = getHeatColor(cell.intensity);
                const textColor = cell.intensity > 0.5 ? '#ffffff' : cell.value === 0 ? '#cbd5e1' : '#1e293b';
                return (
                  <td
                    key={h}
                    title={`${data.days[dayIdx]} ${String(h).padStart(2, '0')}:00 — ${cell.value.toLocaleString()} visitas`}
                    style={{
                      background: bg,
                      color: textColor,
                      textAlign: 'center',
                      fontSize: '0.65rem',
                      fontWeight: cell.intensity > 0.3 ? 700 : 500,
                      padding: '6px 2px',
                      borderRadius: '4px',
                      minWidth: '32px',
                      cursor: 'default',
                      transition: 'transform 0.15s ease',
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.zIndex = '10'; }}
                    onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '0'; }}
                  >
                    {cell.value > 0 ? cell.value.toLocaleString() : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Color legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', justifyContent: 'center' }}>
        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Menos</span>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((intensity, i) => (
          <div key={i} style={{
            width: 20, height: 14, borderRadius: 3,
            background: getHeatColor(intensity),
            border: '1px solid rgba(0,0,0,0.06)',
          }} />
        ))}
        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Más</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  OPERADORAS VIEW (with cross-filter drill-down)
// ═══════════════════════════════════════════════════════════
function OperadorasView({ data, rankOperadoras, sectorOperadora, operadorasStats, coverage }) {
  const [selectedOp, setSelectedOp] = useState(null);

  const SECTOR_COLORS = {
    'SECTOR 1': '#1E5FA6',
    'SECTOR 2': '#0891B2',
    'CITOLOGÍA': '#7C3AED',
    'DIAGNÓSTICO': '#D97706',
  };

  const totalSectores = sectorOperadora.reduce((sum, s) => sum + s.value, 0);

  // Filtered data for selected operadora
  const filteredData = useMemo(() => {
    if (!selectedOp) return [];
    return data.filter(d => d.operadora === selectedOp);
  }, [data, selectedOp]);

  // Compute metrics for selected operadora
  const opHeatmapDias = useMemo(() => selectedOp ? getHeatmapDias(filteredData) : [], [filteredData, selectedOp]);
  const opObrasSociales = useMemo(() => selectedOp ? getObrasSociales(filteredData) : [], [filteredData, selectedOp]);
  const opRankEsp = useMemo(() => selectedOp ? getRankingEspecialidades(filteredData) : [], [filteredData, selectedOp]);
  const opRankMedicos = useMemo(() => selectedOp ? getRankingMedicos(filteredData) : [], [filteredData, selectedOp]);
  const opVisitasMes = useMemo(() => selectedOp ? getVisitasPorMes(filteredData) : [], [filteredData, selectedOp]);
  const opAusentismo = useMemo(() => selectedOp ? getAusentismoStats(filteredData) : null, [filteredData, selectedOp]);
  const opHeatmapHoras = useMemo(() => selectedOp ? getHeatmapHoras(filteredData) : [], [filteredData, selectedOp]);

  // Find selected operadora stats
  const selectedStats = useMemo(() => {
    if (!selectedOp) return null;
    return operadorasStats.find(s => s.name === selectedOp) || null;
  }, [selectedOp, operadorasStats]);

  return (
    <div style={{ animation: 'mtFadeIn 0.3s ease-out' }}>
      {/* Coverage Banner */}
      <div style={{
        padding: '1rem 1.25rem', borderRadius: 12, marginBottom: '1.25rem',
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        border: '1px solid #fcd34d',
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: '#D97706',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', color: '#fff', flexShrink: 0,
        }}>👩‍💼</div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e' }}>
            Tasa de Identificación de Operadora
          </div>
          <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: 2 }}>
            {coverage.conOperadora.toLocaleString()} de {coverage.total.toLocaleString()} turnos tienen operadora identificada
          </div>
        </div>
        <div style={{
          fontSize: '1.6rem', fontWeight: 800, color: '#92400e',
          background: '#fff', borderRadius: 10, padding: '0.4rem 1rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
        }}>
          {coverage.pctIdentificado}%
        </div>
      </div>

      {/* Active filter indicator */}
      {selectedOp && (
        <div className="mt-filter-badge" style={{ marginBottom: '1rem' }}>
          <span>👩‍💼 Filtrando por: <strong>{selectedOp}</strong></span>
          {selectedStats && (
            <span style={{ fontSize: '0.72rem', color: 'rgba(217,119,6,0.7)', marginLeft: '8px' }}>
              {selectedStats.sector} · {selectedStats.total.toLocaleString()} turnos · {selectedStats.diasActivos} días activos · {selectedStats.promedioDiario} t/día
            </span>
          )}
          <button className="mt-filter-badge__clear" onClick={() => setSelectedOp(null)}>
            ✕ Quitar filtro
          </button>
        </div>
      )}

      <div className="mt-chart-grid">
        {/* Ranking Operadoras — CLICKABLE */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🏆 Ranking de Operadoras</span>
            <span className="mt-chart-card__subtitle">Hacé click para filtrar</span>
          </div>
          <ChartHelp
            text="Ranking de las operadoras que tomaron turnos. Hacé click en cualquier operadora para ver sus métricas detalladas debajo."
            tips={[
              'Click en una operadora = muestra sus métricas individuales',
              'Click de nuevo en la misma = quita el filtro',
              'Las primeras 3 posiciones tienen medallas (🥇🥈🥉)',
            ]}
          />
          {rankOperadoras.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>
              No se identificaron operadoras en los datos.
            </p>
          ) : (
            <ClickableRankingList
              data={rankOperadoras}
              color="#D97706"
              selectedValue={selectedOp}
              onSelect={(name) => setSelectedOp(prev => prev === name ? null : name)}
            />
          )}
        </div>

        {/* Sector Breakdown Pie */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">📊 Distribución por Sector</span>
            <span className="mt-chart-card__subtitle">{totalSectores.toLocaleString()} turnos identificados</span>
          </div>
          <ChartHelp
            text="Distribución porcentual de los turnos asignados según el sector de la operadora."
            tips={[
              'Cada sector tiene un color fijo para facilitar la comparación',
              'Sectores con mayor volumen pueden necesitar más personal',
            ]}
          />
          {sectorOperadora.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>Sin datos de sector</p>
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorOperadora}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {sectorOperadora.map((entry, i) => (
                      <Cell key={i} fill={SECTOR_COLORS[entry.name] || '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      fontSize: '0.78rem',
                    }}
                    formatter={(value, name) => [
                      `${value.toLocaleString()} (${((value / totalSectores) * 100).toFixed(1)}%)`,
                      name,
                    ]}
                  />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '0.75rem', lineHeight: '1.8' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Stats Table */}
        <div className="mt-chart-card mt-chart-card--full">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">📋 Estadísticas Detalladas por Operadora</span>
            <span className="mt-chart-card__subtitle">Click en una fila para ver métricas</span>
          </div>
          {operadorasStats.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>Sin datos de operadoras</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px',
                fontSize: '0.82rem',
              }}>
                <thead>
                  <tr style={{ color: '#64748b', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Operadora</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Sector</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px' }}>Turnos</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px' }}>Días Activos</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px' }}>Prom. Diario</th>
                  </tr>
                </thead>
                <tbody>
                  {operadorasStats.map((op, i) => {
                    const isSelected = selectedOp === op.name;
                    return (
                      <tr
                        key={i}
                        onClick={() => setSelectedOp(prev => prev === op.name ? null : op.name)}
                        style={{
                          background: isSelected ? '#fef3c7' : i % 2 === 0 ? '#f8fafc' : '#ffffff',
                          borderRadius: 8,
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                          outline: isSelected ? '2px solid #D97706' : 'none',
                        }}
                        title={`Click para ${isSelected ? 'quitar filtro' : `ver métricas de ${op.name}`}`}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#94a3b8' }}>
                          {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>
                          {op.name} {isSelected && <span style={{ color: '#D97706' }}>✓</span>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 20,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: '#fff',
                            background: SECTOR_COLORS[op.sector] || '#94a3b8',
                          }}>
                            {op.sector}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                          {op.total.toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>
                          {op.diasActivos}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <span style={{
                            fontWeight: 700,
                            color: parseFloat(op.promedioDiario) > 30 ? '#DC2626' :
                                   parseFloat(op.promedioDiario) > 15 ? '#D97706' : '#059669',
                          }}>
                            {op.promedioDiario}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: 4 }}>t/día</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── DRILL-DOWN: Métricas de operadora seleccionada ─── */}
      {selectedOp && filteredData.length > 0 && (
        <div style={{ marginTop: '1.5rem', animation: 'mtFadeIn 0.3s ease-out' }}>
          <h3 style={{
            fontSize: '1rem', fontWeight: 700, color: '#92400e',
            marginBottom: '1rem', padding: '0.5rem 0',
            borderBottom: '2px solid #fcd34d',
          }}>
            📊 Métricas de {selectedOp} — {filteredData.length.toLocaleString()} turnos
          </h3>

          <div className="mt-chart-grid">
            {/* Heatmap Días */}
            <div className="mt-chart-card">
              <div className="mt-chart-card__header">
                <span className="mt-chart-card__title">🔥 Días más concurridos</span>
                <span className="mt-chart-card__subtitle">{selectedOp}</span>
              </div>
              <HeatmapDias data={opHeatmapDias} />
            </div>

            {/* Heatmap Horas */}
            <div className="mt-chart-card">
              <div className="mt-chart-card__header">
                <span className="mt-chart-card__title">⏰ Distribución Horaria</span>
                <span className="mt-chart-card__subtitle">{selectedOp}</span>
              </div>
              <HeatmapHoras data={opHeatmapHoras} />
            </div>

            {/* Especialidades */}
            <div className="mt-chart-card">
              <div className="mt-chart-card__header">
                <span className="mt-chart-card__title">🏥 Especialidades</span>
                <span className="mt-chart-card__subtitle">Top 15 de {selectedOp}</span>
              </div>
              <RankingList data={opRankEsp} color="#1E5FA6" />
            </div>

            {/* Médicos */}
            <div className="mt-chart-card">
              <div className="mt-chart-card__header">
                <span className="mt-chart-card__title">👨‍⚕️ Médicos</span>
                <span className="mt-chart-card__subtitle">Top 15 de {selectedOp}</span>
              </div>
              <RankingList data={opRankMedicos} color="#7C3AED" />
            </div>

            {/* Obras Sociales */}
            <div className="mt-chart-card">
              <div className="mt-chart-card__header">
                <span className="mt-chart-card__title">🏦 Obras Sociales</span>
                <span className="mt-chart-card__subtitle">Top 10 de {selectedOp}</span>
              </div>
              <PieObrasSociales data={opObrasSociales} />
            </div>

            {/* Ausentismo */}
            {opAusentismo && opAusentismo.breakdown.length > 0 && (
              <div className="mt-chart-card">
                <div className="mt-chart-card__header">
                  <span className="mt-chart-card__title">📊 Asistencia</span>
                  <span className="mt-chart-card__subtitle">{selectedOp} — {opAusentismo.total.toLocaleString()} registros</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0.5rem 0' }}>
                  {opAusentismo.breakdown.map((item, i) => {
                    const pct = parseFloat(item.pct);
                    const color = item.status.toLowerCase().includes('present') ? '#059669' :
                                 item.status.toLowerCase().includes('ausente') ? '#DC2626' :
                                 item.status.toLowerCase().includes('cancelad') ? '#D97706' : '#64748B';
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', minWidth: '120px' }}>
                          {item.status}
                        </span>
                        <div style={{ flex: 1, height: 22, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${pct}%`,
                            background: color, borderRadius: 6,
                            transition: 'width 0.5s ease',
                            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                            paddingRight: '6px',
                          }}>
                            {pct > 10 && <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#fff' }}>{item.pct}%</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', minWidth: '55px', textAlign: 'right' }}>
                          {item.count.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tendencia Mensual */}
            <div className="mt-chart-card mt-chart-card--full">
              <div className="mt-chart-card__header">
                <span className="mt-chart-card__title">📈 Tendencia mensual</span>
                <span className="mt-chart-card__subtitle">{selectedOp}</span>
              </div>
              <LineVisitasMes data={opVisitasMes} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  AUSENTISMO VIEW
// ═══════════════════════════════════════════════════════════
function AusentismoView({ ausentismo }) {
  const COLORS_STATUS = {
    'Presente': '#059669',
    'Ausente': '#DC2626',
    'Cancelado': '#D97706',
  };

  return (
    <div style={{ animation: 'mtFadeIn 0.3s ease-out' }}>
      <div className="mt-chart-grid">
        {/* General breakdown */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">📊 Estado de Asistencia</span>
            <span className="mt-chart-card__subtitle">Distribución general ({ausentismo.total.toLocaleString()} registros)</span>
          </div>
          <ChartHelp
            text='Muestra la distribución porcentual de todos los estados de asistencia registrados (ej: "Presente", "Ausente", "Cancelado", etc.). Cada barra horizontal indica el porcentaje y la cantidad absoluta de visitas en cada estado.'
            tips={[
              'Verde = presente/asistió; Rojo = ausente; Amarillo = cancelado',
              'Una tasa de ausentismo superior al 15% es crítica y requiere acción (ej: recordatorios automáticos, políticas de reprogramación)',
              'Compará el ausentismo con el promedio del sector salud (~10-15%) para evaluar el rendimiento',
              'Los turnos no aprovechados representan un costo directo para la institución',
            ]}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0.5rem 0' }}>
            {ausentismo.breakdown.map((item, i) => {
              const pct = parseFloat(item.pct);
              const color = COLORS_STATUS[item.status] || (item.status.toLowerCase().includes('ausente') ? '#DC2626' : item.status.toLowerCase().includes('present') ? '#059669' : '#64748B');
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', minWidth: '120px' }}>
                    {item.status}
                  </span>
                  <div style={{ flex: 1, height: 24, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: color, borderRadius: 6,
                      transition: 'width 0.5s ease',
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                      paddingRight: '8px',
                    }}>
                      {pct > 8 && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff' }}>{item.pct}%</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', minWidth: '65px', textAlign: 'right' }}>
                    {item.count.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ausentismo by specialty */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🚫 Tasa de Ausentismo por Especialidad</span>
            <span className="mt-chart-card__subtitle">Porcentaje de ausentes (mín. 20 turnos)</span>
          </div>
          <ChartHelp
            text='Gráfico de barras horizontales que muestra el porcentaje de ausentismo de cada especialidad (solo aquellas con al menos 20 turnos registrados para evitar distorsiones estadísticas). Se colorean según el nivel de riesgo.'
            tips={[
              '🔴 Rojo (>20%): ausentismo crítico, requiere intervención urgente',
              '🟡 Amarillo (10-20%): ausentismo moderado, monitorear de cerca',
              '🟢 Verde (<10%): ausentismo saludable, buen rendimiento',
              'Pasá el mouse sobre cada barra para ver el detalle: ausentes / total de turnos',
              'Especialidades con alto ausentismo pueden beneficiarse de confirmación previa de turnos',
            ]}
          />
          {ausentismo.ausentismoByEsp.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>
              No se detectaron registros de ausentismo en los datos.
            </p>
          ) : (
            <div style={{ width: '100%', height: Math.max(300, ausentismo.ausentismoByEsp.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ausentismo.ausentismoByEsp}
                  layout="vertical"
                  margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={v => `${v}%`}
                    domain={[0, 'auto']}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      fontSize: '0.78rem',
                    }}
                    formatter={(value, name, props) => [
                      `${value}% (${props.payload.noShow} de ${props.payload.total})`,
                      'Ausentismo',
                    ]}
                  />
                  <Bar dataKey="rate" fill="#DC2626" radius={[0, 4, 4, 0]} barSize={16}>
                    {ausentismo.ausentismoByEsp.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={parseFloat(entry.rate) > 20 ? '#DC2626' : parseFloat(entry.rate) > 10 ? '#F59E0B' : '#10B981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  ANÁLISIS AVANZADO VIEW
// ═══════════════════════════════════════════════════════════
function AvanzadoView({ pacientesRec, heatmapMatrix }) {
  return (
    <div style={{ animation: 'mtFadeIn 0.3s ease-out' }}>
      <div className="mt-chart-grid">
        {/* Pacientes Recurrentes */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">👤 Pacientes más frecuentes</span>
            <span className="mt-chart-card__subtitle">Top 15 por cantidad de visitas</span>
          </div>
          <ChartHelp
            text="Ranking de los 15 pacientes que más visitas han realizado en el período analizado. Identifica pacientes crónicos, frecuentes o con necesidades de seguimiento intensivo."
            tips={[
              'Pacientes con muchas visitas pueden tener condiciones crónicas que requieren gestión proactiva',
              'Un alto volumen de un solo paciente puede indicar derivaciones internas recurrentes',
              'Útil para programas de fidelización o seguimiento especial',
              'Los datos son anónimos por ID, verificar identidad en el sistema fuente si es necesario',
            ]}
          />
          <RankingList data={pacientesRec} color="#059669" />
        </div>

        {/* Peak hours analysis */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">⏱️ Análisis de Horas Pico</span>
            <span className="mt-chart-card__subtitle">Horarios con mayor y menor demanda</span>
          </div>
          <ChartHelp
            text="Análisis comparativo de los 5 horarios con más demanda (rojo) y los 5 con menos demanda (verde), calculados sobre el total acumulado de todos los días. Permite identificar la distribución de carga horaria."
            tips={[
              'Los horarios rojos son los que concentran la mayor presión asistencial',
              'Los horarios verdes tienen mayor disponibilidad y pueden absorber más turnos',
              'Redistribuir turnos de franjas rojas a verdes puede reducir tiempos de espera',
              'Útil para definir horarios de apertura/cierre de consultorios y dotación de recepción',
            ]}
          />
          <PeakHoursAnalysis data={heatmapMatrix} />
        </div>
      </div>
    </div>
  );
}

// ─── Peak Hours Analysis ──────────────────────────────────
function PeakHoursAnalysis({ data }) {
  if (!data || !data.cells) return null;

  // Calculate total per hour across all days
  const hourTotals = new Array(24).fill(0);
  data.cells.forEach(dayRow => {
    dayRow.forEach((cell, h) => { hourTotals[h] += cell.value; });
  });

  // Find top 5 and bottom 5 active hours
  const activeHours = hourTotals
    .map((total, h) => ({ hour: h, total }))
    .filter(h => h.total > 0)
    .sort((a, b) => b.total - a.total);

  const top5 = activeHours.slice(0, 5);
  const bottom5 = activeHours.slice(-5).reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#DC2626', marginBottom: '8px' }}>
          🔴 Horarios con MAYOR demanda
        </h4>
        {top5.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, color: '#ffffff',
              background: '#DC2626', borderRadius: '50%',
              width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{i + 1}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', minWidth: '50px' }}>
              {String(h.hour).padStart(2, '0')}:00
            </span>
            <div style={{ flex: 1, height: 18, background: '#fef2f2', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(h.total / top5[0].total) * 100}%`,
                background: 'linear-gradient(90deg, #DC2626, #F87171)', borderRadius: 4,
              }} />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626' }}>
              {h.total.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div>
        <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#059669', marginBottom: '8px' }}>
          🟢 Horarios con MENOR demanda
        </h4>
        {bottom5.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, color: '#ffffff',
              background: '#059669', borderRadius: '50%',
              width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{i + 1}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', minWidth: '50px' }}>
              {String(h.hour).padStart(2, '0')}:00
            </span>
            <div style={{ flex: 1, height: 18, background: '#f0fdf4', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(h.total / (top5[0]?.total || 1)) * 100}%`,
                background: 'linear-gradient(90deg, #059669, #34D399)', borderRadius: 4,
              }} />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>
              {h.total.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
