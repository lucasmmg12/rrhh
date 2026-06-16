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
} from './metricasService';
import './metricas.css';

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

  // ─── Load Data ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [records, count] = await Promise.all([
        fetchVisitasSF(),
        getRecordCount(),
      ]);
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
      setUploading(true);
      setUploadProgress(0);
      setError(null);
      setSuccessMsg(null);

      // Parse Excel
      setUploadProgress(5);
      const records = await parseRevisionXlsx(file);
      setUploadProgress(20);

      // Upload to Supabase
      const uploaded = await uploadRecords(records, (pct) => {
        setUploadProgress(20 + Math.round(pct * 0.75));
      });
      setUploadProgress(100);
      setSuccessMsg(`✅ ${uploaded.toLocaleString()} registros procesados correctamente`);

      // Reload data
      await loadData();
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Error al procesar: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [loadData]);

  // ─── Computed Data ──────────────────────────────────────
  const heatmapDias = useMemo(() => getHeatmapDias(data), [data]);
  const heatmapHoras = useMemo(() => getHeatmapHoras(data), [data]);
  const obrasSociales = useMemo(() => getObrasSociales(data), [data]);
  const rankEspecialidades = useMemo(() => getRankingEspecialidades(data), [data]);
  const rankMedicos = useMemo(() => getRankingMedicos(data), [data]);
  const rankTipoVisita = useMemo(() => getRankingTipoVisita(data), [data]);
  const visitasMes = useMemo(() => getVisitasPorMes(data), [data]);

  // Unique counts for KPIs
  const kpis = useMemo(() => {
    const uniqueEsp = new Set(data.map(d => d.especialidad).filter(Boolean));
    const uniqueMed = new Set(data.map(d => d.responsable).filter(Boolean));
    const uniqueOS = new Set(data.map(d => d.cliente).filter(Boolean));
    return {
      totalVisitas: data.length,
      especialidades: uniqueEsp.size,
      medicos: uniqueMed.size,
      obrasSociales: uniqueOS.size,
    };
  }, [data]);

  // Auto-hide success message
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 6000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  return (
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
          </div>

          {activeTab === 'resumen' && (
            <ResumenView
              heatmapDias={heatmapDias}
              obrasSociales={obrasSociales}
              rankEspecialidades={rankEspecialidades}
              visitasMes={visitasMes}
            />
          )}
          {activeTab === 'heatmaps' && (
            <HeatmapsView heatmapDias={heatmapDias} heatmapHoras={heatmapHoras} />
          )}
          {activeTab === 'rankings' && (
            <RankingsView
              rankEspecialidades={rankEspecialidades}
              rankMedicos={rankMedicos}
              rankTipoVisita={rankTipoVisita}
            />
          )}
          {activeTab === 'tendencias' && (
            <TendenciasView visitasMes={visitasMes} />
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  RESUMEN VIEW (Overview)
// ═══════════════════════════════════════════════════════════
function ResumenView({ heatmapDias, obrasSociales, rankEspecialidades, visitasMes }) {
  return (
    <div style={{ animation: 'mtFadeIn 0.3s ease-out' }}>
      <div className="mt-chart-grid">
        {/* Heatmap Días mini */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🔥 Días más concurridos</span>
          </div>
          <HeatmapDias data={heatmapDias} />
        </div>

        {/* Pie Obras Sociales */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🏦 Obras Sociales</span>
            <span className="mt-chart-card__subtitle">Top 10</span>
          </div>
          <PieObrasSociales data={obrasSociales} />
        </div>

        {/* Ranking Especialidades */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🏆 Especialidades más concurridas</span>
            <span className="mt-chart-card__subtitle">Top 15</span>
          </div>
          <RankingList data={rankEspecialidades} color="#1E5FA6" />
        </div>

        {/* Line Visitas por Mes */}
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">📈 Visitas por mes</span>
          </div>
          <LineVisitasMes data={visitasMes} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  HEATMAPS VIEW
// ═══════════════════════════════════════════════════════════
function HeatmapsView({ heatmapDias, heatmapHoras }) {
  return (
    <div style={{ animation: 'mtFadeIn 0.3s ease-out' }}>
      <div className="mt-chart-grid--single" style={{ display: 'grid', gap: '1.25rem' }}>
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🔥 Mapa de calor — Días de la semana</span>
            <span className="mt-chart-card__subtitle">Distribución de visitas por día</span>
          </div>
          <HeatmapDias data={heatmapDias} />
        </div>

        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">⏰ Mapa de calor — Horario</span>
            <span className="mt-chart-card__subtitle">Distribución de visitas por hora del día (0-23h)</span>
          </div>
          <HeatmapHoras data={heatmapHoras} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  RANKINGS VIEW
// ═══════════════════════════════════════════════════════════
function RankingsView({ rankEspecialidades, rankMedicos, rankTipoVisita }) {
  return (
    <div style={{ animation: 'mtFadeIn 0.3s ease-out' }}>
      <div className="mt-chart-grid">
        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">🏥 Especialidades más concurridas</span>
            <span className="mt-chart-card__subtitle">Top 15</span>
          </div>
          <RankingList data={rankEspecialidades} color="#1E5FA6" />
        </div>

        <div className="mt-chart-card">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">👨‍⚕️ Ranking por Médico</span>
            <span className="mt-chart-card__subtitle">Top 15 por cantidad de visitas</span>
          </div>
          <RankingList data={rankMedicos} color="#7C3AED" />
        </div>

        <div className="mt-chart-card mt-chart-card--full">
          <div className="mt-chart-card__header">
            <span className="mt-chart-card__title">📋 Ranking por Tipo de Visita</span>
            <span className="mt-chart-card__subtitle">Top 15</span>
          </div>
          <RankingList data={rankTipoVisita} color="#0891B2" />
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
        <LineChart data={data} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
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
            dot={{ r: 3, fill: '#1E5FA6', strokeWidth: 2, stroke: '#ffffff' }}
            activeDot={{ r: 5, fill: '#1E5FA6', stroke: '#ffffff', strokeWidth: 2 }}
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
