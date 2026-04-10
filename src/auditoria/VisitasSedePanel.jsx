/**
 * VisitasSedePanel.jsx — Analytics de consultas médicas (Sede Santa Fe)
 * v2: + Obras Sociales, + Responsables/Médicos, + Heatmap semanal, + Sync
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { obtenerVisitas, calcularMetricasVisitas, triggerSync, checkSyncHealth } from './visitasService';

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
  '#84cc16', '#a855f7', '#22d3ee', '#fb923c', '#4ade80',
];

const DOW_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatNumber = (n) => new Intl.NumberFormat('es-AR').format(n);

export default function VisitasSedePanel() {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodoTipo, setPeriodoTipo] = useState('mes');
  const [fechaRef, setFechaRef] = useState(new Date().toISOString().split('T')[0]);
  const [rangoDesde, setRangoDesde] = useState('');
  const [rangoHasta, setRangoHasta] = useState('');
  const [vistaActiva, setVistaActiva] = useState('usuarios');

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncOnline, setSyncOnline] = useState(null);

  // Check sync health on mount
  useEffect(() => {
    checkSyncHealth().then(r => setSyncOnline(r.success));
  }, []);

  // ── Calcular rango de fechas según período ──
  const { fechaDesde, fechaHasta, periodoLabel } = useMemo(() => {
    const ref = new Date(fechaRef + 'T12:00:00');
    if (periodoTipo === 'dia') {
      return {
        fechaDesde: fechaRef,
        fechaHasta: fechaRef,
        periodoLabel: ref.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
      };
    }
    if (periodoTipo === 'semana') {
      const day = ref.getDay();
      const start = new Date(ref);
      start.setDate(ref.getDate() - (day === 0 ? 6 : day - 1));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        fechaDesde: start.toISOString().split('T')[0],
        fechaHasta: end.toISOString().split('T')[0],
        periodoLabel: `${start.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`,
      };
    }
    if (periodoTipo === 'rango' && rangoDesde && rangoHasta) {
      return { fechaDesde: rangoDesde, fechaHasta: rangoHasta, periodoLabel: `${rangoDesde} → ${rangoHasta}` };
    }
    // mes
    const y = ref.getFullYear();
    const m = ref.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return {
      fechaDesde: start.toISOString().split('T')[0],
      fechaHasta: end.toISOString().split('T')[0],
      periodoLabel: ref.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
    };
  }, [periodoTipo, fechaRef, rangoDesde, rangoHasta]);

  // ── Cargar datos ──
  const cargarDatos = useCallback(() => {
    if (!fechaDesde || !fechaHasta) return;
    setLoading(true);
    obtenerVisitas(fechaDesde, fechaHasta)
      .then(setDatos)
      .catch(e => console.error('Error cargando visitas:', e))
      .finally(() => setLoading(false));
  }, [fechaDesde, fechaHasta]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const metricas = useMemo(() => calcularMetricasVisitas(datos), [datos]);

  // ── Datos ordenados ──
  const usuarios = useMemo(() =>
    Object.entries(metricas.por_usuario)
      .sort((a, b) => b[1].cantidad - a[1].cantidad),
    [metricas]
  );
  const especialidades = useMemo(() =>
    Object.entries(metricas.por_especialidad)
      .sort((a, b) => b[1].cantidad - a[1].cantidad),
    [metricas]
  );
  const tiposVisita = useMemo(() =>
    Object.entries(metricas.por_tipo_visita)
      .sort((a, b) => b[1].cantidad - a[1].cantidad),
    [metricas]
  );
  const diasOrdenados = useMemo(() =>
    Object.entries(metricas.por_dia)
      .sort((a, b) => a[0].localeCompare(b[0])),
    [metricas]
  );
  const obrasSociales = useMemo(() =>
    Object.entries(metricas.por_cliente)
      .sort((a, b) => b[1].cantidad - a[1].cantidad),
    [metricas]
  );
  const responsables = useMemo(() =>
    Object.entries(metricas.por_responsable)
      .sort((a, b) => b[1].cantidad - a[1].cantidad),
    [metricas]
  );

  // ── Navegación ──
  const navegar = (dir) => {
    const ref = new Date(fechaRef + 'T12:00:00');
    if (periodoTipo === 'dia') ref.setDate(ref.getDate() + dir);
    else if (periodoTipo === 'semana') ref.setDate(ref.getDate() + 7 * dir);
    else ref.setMonth(ref.getMonth() + dir);
    setFechaRef(ref.toISOString().split('T')[0]);
  };

  const maxBar = (arr) => Math.max(...arr.map(([, v]) => v.cantidad), 1);

  // ── Sync handler ──
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const result = await triggerSync('visitas');
    setSyncResult(result);
    setSyncing(false);
    if (result.success) {
      // Reload data after sync
      setTimeout(cargarDatos, 500);
    }
  };

  return (
    <div>
      {/* ── Barra de período + Sync ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        marginBottom: '1rem', flexWrap: 'wrap',
        padding: '0.65rem 0.85rem', borderRadius: '12px',
        background: '#f8fafc', border: '1px solid #e2e8f0',
      }}>
        {['dia', 'semana', 'mes', 'rango'].map(t => (
          <button key={t} onClick={() => setPeriodoTipo(t)} style={{
            padding: '0.35rem 0.75rem', borderRadius: '8px', border: 'none',
            background: periodoTipo === t ? '#1e40af' : 'white',
            color: periodoTipo === t ? 'white' : '#64748b',
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            boxShadow: periodoTipo === t ? '0 2px 8px rgba(30,64,175,0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
            transition: 'all 0.2s',
          }}>
            {t === 'dia' ? '📅 Día' : t === 'semana' ? '📆 Semana' : t === 'mes' ? '🗓️ Mes' : '📐 Rango'}
          </button>
        ))}
        {periodoTipo !== 'rango' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: '0.5rem' }}>
            <button onClick={() => navegar(-1)} style={{
              width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #e2e8f0',
              background: 'white', cursor: 'pointer', fontSize: '0.75rem', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>◀</button>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', padding: '0 0.5rem', textTransform: 'capitalize' }}>
              {periodoLabel}
            </span>
            <button onClick={() => navegar(1)} style={{
              width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #e2e8f0',
              background: 'white', cursor: 'pointer', fontSize: '0.75rem', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>▶</button>
            <button onClick={() => setFechaRef(new Date().toISOString().split('T')[0])} style={{
              padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0',
              background: 'white', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
              color: '#3b82f6', marginLeft: '0.3rem',
            }}>Hoy</button>
          </div>
        )}
        {periodoTipo === 'rango' && (
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginLeft: '0.5rem' }}>
            <input type="date" className="aud-input" value={rangoDesde}
              onChange={e => setRangoDesde(e.target.value)}
              style={{ width: '150px', marginBottom: 0, fontSize: '0.78rem' }}
            />
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>a</span>
            <input type="date" className="aud-input" value={rangoHasta}
              onChange={e => setRangoHasta(e.target.value)}
              style={{ width: '150px', marginBottom: 0, fontSize: '0.78rem' }}
            />
          </div>
        )}

        {/* Sync button */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: syncOnline === true ? '#10b981' : syncOnline === false ? '#ef4444' : '#94a3b8',
            display: 'inline-block',
          }} />
          <button
            onClick={handleSync}
            disabled={syncing || !syncOnline}
            style={{
              padding: '0.3rem 0.65rem', borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: syncing ? '#f1f5f9' : 'white',
              fontSize: '0.72rem', fontWeight: 600, cursor: syncing ? 'wait' : 'pointer',
              color: syncOnline ? '#3b82f6' : '#94a3b8',
              transition: 'all 0.2s',
            }}
          >
            {syncing ? '⏳ Sincronizando...' : '🔄 Sync SALUS'}
          </button>
        </div>
      </div>

      {/* Sync result toast */}
      {syncResult && (
        <div style={{
          padding: '0.5rem 0.75rem', borderRadius: '8px', marginBottom: '0.75rem',
          background: syncResult.success ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${syncResult.success ? '#bbf7d0' : '#fecaca'}`,
          fontSize: '0.78rem', color: syncResult.success ? '#166534' : '#dc2626',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>
            {syncResult.success
              ? `✅ ${syncResult.results?.inserted || 0} visitas sincronizadas desde SALUS`
              : `❌ ${syncResult.error}`}
          </span>
          <button onClick={() => setSyncResult(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#94a3b8',
          }}>✕</button>
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '0.65rem', marginBottom: '1rem',
      }}>
        {[
          { label: 'Total Consultas', value: formatNumber(metricas.total_visitas), icon: '🏥', bg: '#eff6ff', color: '#1e40af' },
          { label: 'Pacientes Únicos', value: formatNumber(metricas.pacientes_unicos), icon: '👥', bg: '#f0fdf4', color: '#166534' },
          { label: 'Promedio/Día', value: formatNumber(metricas.promedio_diario || 0), icon: '📊', bg: '#fef3c7', color: '#92400e' },
          { label: 'Especialidades', value: especialidades.length, icon: '🩺', bg: '#faf5ff', color: '#7c3aed' },
          { label: 'Colaboradores', value: usuarios.length, icon: '👤', bg: '#fff7ed', color: '#c2410c' },
          { label: 'Obras Sociales', value: obrasSociales.length, icon: '🏦', bg: '#f0f9ff', color: '#0369a1' },
          { label: 'Día Pico', value: metricas.dia_pico?.cantidad || 0, icon: '🔥', bg: '#fce7f3', color: '#9d174d',
            sub: metricas.dia_pico?.fecha ? new Date(metricas.dia_pico.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '' },
        ].map((kpi, i) => (
          <div key={i} className="aud-card" style={{
            padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.15rem',
            background: kpi.bg, border: `1px solid ${kpi.color}20`,
          }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: kpi.color, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {kpi.icon} {kpi.label}
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: kpi.color, lineHeight: 1.1 }}>
              {kpi.value}
            </span>
            {kpi.sub && <span style={{ fontSize: '0.62rem', color: `${kpi.color}99` }}>{kpi.sub}</span>}
          </div>
        ))}
      </div>

      {/* ── Vista Tabs ── */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1rem', overflowX: 'auto' }}>
        {[
          { id: 'usuarios', label: '👤 Colaborador' },
          { id: 'cierre', label: '📊 Cierre Diario' },
          { id: 'especialidades', label: '🩺 Especialidad' },
          { id: 'os', label: '🏦 Obras Sociales' },
          { id: 'medicos', label: '👨‍⚕️ Médicos' },
          { id: 'tipos', label: '📋 Tipo Visita' },
          { id: 'timeline', label: '📈 Timeline' },
          { id: 'heatmap', label: '🗺️ Heatmap' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setVistaActiva(tab.id)} style={{
            padding: '0.45rem 0.85rem', border: 'none', cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 600, background: 'none', whiteSpace: 'nowrap',
            borderBottom: vistaActiva === tab.id ? '2px solid #1e40af' : '2px solid transparent',
            color: vistaActiva === tab.id ? '#1e40af' : '#94a3b8',
            transition: 'all 0.2s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          ⏳ Cargando visitas...
        </div>
      ) : datos.length === 0 ? (
        <div className="aud-card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
          📭 Sin datos de visitas para este período
          {syncOnline && (
            <div style={{ marginTop: '0.5rem' }}>
              <button onClick={handleSync} style={{
                padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #bfdbfe',
                background: '#eff6ff', color: '#1e40af', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              }}>🔄 Sincronizar desde SALUS</button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── VISTA: POR COLABORADOR ── */}
          {vistaActiva === 'usuarios' && (
            <div className="aud-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                👤 Consultas por Colaborador — {usuarios.length} activos
              </div>
              {usuarios.map(([usr, data], idx) => {
                const pct = Math.round((data.cantidad / metricas.total_visitas) * 100);
                const topEsp = Object.entries(data.por_especialidad).sort((a, b) => b[1] - a[1]).slice(0, 3);
                const topOS = Object.entries(data.por_cliente || {}).sort((a, b) => b[1] - a[1]).slice(0, 2);
                const diasActivos = Object.keys(data.por_dia).length;
                const promDiario = diasActivos > 0 ? Math.round(data.cantidad / diasActivos) : 0;
                return (
                  <div key={usr} style={{
                    padding: '0.6rem 0', borderBottom: idx < usuarios.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: CHART_COLORS[idx % CHART_COLORS.length], display: 'inline-block',
                        }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{usr}</span>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{diasActivos}d · ~{promDiario}/día</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e40af' }}>{formatNumber(data.cantidad)}</span>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 600, color: '#3b82f6',
                          padding: '2px 8px', borderRadius: '10px', background: '#eff6ff',
                        }}>{pct}%</span>
                      </div>
                    </div>
                    {/* Bar */}
                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.3rem' }}>
                      <div style={{
                        height: '100%', borderRadius: '3px',
                        background: `linear-gradient(90deg, ${CHART_COLORS[idx % CHART_COLORS.length]}, ${CHART_COLORS[idx % CHART_COLORS.length]}90)`,
                        width: `${(data.cantidad / maxBar(usuarios)) * 100}%`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    {/* Top especialidades + OS */}
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {topEsp.map(([esp, cnt]) => (
                        <span key={esp} style={{
                          fontSize: '0.65rem', padding: '1px 6px', borderRadius: '6px',
                          background: '#f1f5f9', color: '#64748b', fontWeight: 500,
                        }}>🩺 {esp}: {cnt}</span>
                      ))}
                      {topOS.map(([os, cnt]) => (
                        <span key={os} style={{
                          fontSize: '0.65rem', padding: '1px 6px', borderRadius: '6px',
                          background: '#fef3c7', color: '#92400e', fontWeight: 500,
                        }}>🏦 {os}: {cnt}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── VISTA: OBRAS SOCIALES ── */}
          {vistaActiva === 'os' && (
            <div className="aud-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                🏦 Consultas por Obra Social — {obrasSociales.length} activas
              </div>
              {obrasSociales.map(([os, data], idx) => {
                const pct = Math.round((data.cantidad / metricas.total_visitas) * 100);
                const topEsp = Object.entries(data.especialidades || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
                return (
                  <div key={os} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 0', borderBottom: idx < obrasSociales.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}>
                    <span style={{
                      width: '22px', height: '22px', borderRadius: '6px',
                      background: `${CHART_COLORS[idx % CHART_COLORS.length]}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 800, color: CHART_COLORS[idx % CHART_COLORS.length],
                      flexShrink: 0,
                    }}>{idx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {os}
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '2px' }}>
                        {topEsp.map(([esp, cnt]) => (
                          <span key={esp} style={{
                            fontSize: '0.6rem', padding: '0px 5px', borderRadius: '4px',
                            background: '#f1f5f9', color: '#64748b',
                          }}>{esp}: {cnt}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ width: '80px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '3px',
                        background: CHART_COLORS[idx % CHART_COLORS.length],
                        width: `${(data.cantidad / maxBar(obrasSociales)) * 100}%`,
                      }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', width: '45px', textAlign: 'right' }}>
                      {formatNumber(data.cantidad)}
                    </span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', width: '35px', textAlign: 'right' }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── VISTA: MÉDICOS/RESPONSABLES ── */}
          {vistaActiva === 'medicos' && (
            <div className="aud-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                👨‍⚕️ Consultas por Médico/Responsable — {responsables.length} activos
              </div>
              {responsables.slice(0, 30).map(([med, data], idx) => {
                const pct = Math.round((data.cantidad / metricas.total_visitas) * 100);
                const topEsp = Object.entries(data.especialidades || {}).sort((a, b) => b[1] - a[1]).slice(0, 2);
                return (
                  <div key={med} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.45rem 0', borderBottom: idx < 29 ? '1px solid #f1f5f9' : 'none',
                  }}>
                    <span style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: CHART_COLORS[idx % CHART_COLORS.length], display: 'inline-block', flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>{med}</span>
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '1px' }}>
                        {topEsp.map(([esp, cnt]) => (
                          <span key={esp} style={{
                            fontSize: '0.58rem', padding: '0px 4px', borderRadius: '4px',
                            background: '#f0fdf4', color: '#166534',
                          }}>{esp}: {cnt}</span>
                        ))}
                        <span style={{
                          fontSize: '0.58rem', padding: '0px 4px', borderRadius: '4px',
                          background: '#eff6ff', color: '#1e40af',
                        }}>{data.pacientes_unicos} pac.</span>
                      </div>
                    </div>
                    <div style={{ width: '80px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '3px',
                        background: CHART_COLORS[idx % CHART_COLORS.length],
                        width: `${(data.cantidad / maxBar(responsables)) * 100}%`,
                      }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', width: '45px', textAlign: 'right' }}>
                      {formatNumber(data.cantidad)}
                    </span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', width: '35px', textAlign: 'right' }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
              {responsables.length > 30 && (
                <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.72rem', color: '#94a3b8' }}>
                  ... y {responsables.length - 30} médicos más
                </div>
              )}
            </div>
          )}

          {/* ── VISTA: POR ESPECIALIDAD ── */}
          {vistaActiva === 'especialidades' && (
            <div className="aud-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                🩺 Consultas por Especialidad — {especialidades.length} activas
              </div>
              {especialidades.map(([esp, data], idx) => {
                const pct = Math.round((data.cantidad / metricas.total_visitas) * 100);
                return (
                  <div key={esp} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.45rem 0', borderBottom: idx < especialidades.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}>
                    <span style={{
                      width: '10px', height: '10px', borderRadius: '3px',
                      background: CHART_COLORS[idx % CHART_COLORS.length], display: 'inline-block', flexShrink: 0,
                    }} />
                    <span style={{ fontSize: '0.82rem', color: '#334155', flex: 1 }}>{esp}</span>
                    <div style={{ width: '120px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '3px',
                        background: CHART_COLORS[idx % CHART_COLORS.length],
                        width: `${(data.cantidad / maxBar(especialidades)) * 100}%`,
                      }} />
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', width: '50px', textAlign: 'right' }}>
                      {formatNumber(data.cantidad)}
                    </span>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8',
                      width: '35px', textAlign: 'right',
                    }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── VISTA: POR TIPO VISITA ── */}
          {vistaActiva === 'tipos' && (
            <div className="aud-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                📋 Consultas por Tipo de Visita — {tiposVisita.length} tipos
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {tiposVisita.map(([tipo, data], idx) => (
                  <div key={tipo} style={{
                    padding: '0.75rem', borderRadius: '10px',
                    background: `${CHART_COLORS[idx % CHART_COLORS.length]}10`,
                    border: `1px solid ${CHART_COLORS[idx % CHART_COLORS.length]}20`,
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: CHART_COLORS[idx % CHART_COLORS.length], marginBottom: '0.3rem' }}>
                      {tipo}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>
                      {formatNumber(data.cantidad)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                      {Math.round((data.cantidad / metricas.total_visitas) * 100)}% del total
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VISTA: TIMELINE ── */}
          {vistaActiva === 'timeline' && (
            <div className="aud-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                📈 Consultas por Día — Tendencia
              </div>
              {/* SVG Bar Chart */}
              {diasOrdenados.length > 0 && (() => {
                const maxVal = Math.max(...diasOrdenados.map(([, d]) => d.cantidad), 1);
                const barW = Math.max(20, Math.min(40, 600 / diasOrdenados.length));
                const chartW = Math.max(600, diasOrdenados.length * (barW + 8));
                const chartH = 200;
                const avg = metricas.promedio_diario || 0;
                const avgY = chartH - (avg / maxVal) * chartH;
                return (
                  <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                    <svg width={chartW} height={chartH + 50} style={{ display: 'block' }}>
                      {/* Average line */}
                      {avg > 0 && (
                        <>
                          <line x1={15} y1={avgY} x2={chartW} y2={avgY} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
                          <text x={chartW - 5} y={avgY - 4} textAnchor="end" fontSize="9" fill="#f59e0b" fontWeight="600">
                            Prom: {avg}
                          </text>
                        </>
                      )}
                      {diasOrdenados.map(([dia, data], i) => {
                        const barH = (data.cantidad / maxVal) * chartH;
                        const x = i * (barW + 8) + 20;
                        const dateLabel = new Date(dia + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                        const isPeak = dia === metricas.dia_pico?.fecha;
                        return (
                          <g key={dia}>
                            <rect
                              x={x} y={chartH - barH} width={barW} height={barH}
                              rx={4} fill={isPeak ? '#ef4444' : CHART_COLORS[i % CHART_COLORS.length]}
                              opacity={0.85}
                            />
                            <text
                              x={x + barW / 2} y={chartH - barH - 6}
                              textAnchor="middle" fontSize="10" fontWeight="700" fill="#1e293b"
                            >{data.cantidad}</text>
                            <text
                              x={x + barW / 2} y={chartH + 18}
                              textAnchor="middle" fontSize="9" fill="#94a3b8"
                              transform={`rotate(-45 ${x + barW / 2} ${chartH + 18})`}
                            >{dateLabel}</text>
                          </g>
                        );
                      })}
                      <line x1={15} y1={chartH} x2={chartW} y2={chartH} stroke="#e2e8f0" strokeWidth={1} />
                    </svg>
                  </div>
                );
              })()}
              {/* Grid cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
                {diasOrdenados.map(([dia, data]) => {
                  const dateLabel = new Date(dia + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
                  const isPeak = dia === metricas.dia_pico?.fecha;
                  return (
                    <div key={dia} style={{
                      padding: '0.5rem', borderRadius: '8px',
                      background: isPeak ? '#fef2f2' : '#f8fafc',
                      border: `1px solid ${isPeak ? '#fecaca' : '#e2e8f0'}`, textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>{dateLabel}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: isPeak ? '#dc2626' : '#1e40af' }}>
                        {data.cantidad} {isPeak && '🔥'}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{data.pacientes} pac.</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── VISTA: HEATMAP SEMANAL ── */}
          {vistaActiva === 'heatmap' && (
            <div className="aud-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>
                🗺️ Distribución por Día de la Semana
              </div>
              {/* Día de semana bars */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {[1, 2, 3, 4, 5, 6, 0].map((dow) => { // Lun-Dom
                  const count = metricas.por_dia_semana[dow] || 0;
                  const maxDow = Math.max(...Object.values(metricas.por_dia_semana), 1);
                  const pct = Math.round((count / maxDow) * 100);
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <div key={dow} style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '0.72rem', fontWeight: 700,
                        color: isWeekend ? '#94a3b8' : '#334155',
                        marginBottom: '0.3rem',
                      }}>{DOW_NAMES[dow]}</div>
                      <div style={{
                        height: '120px', position: 'relative',
                        background: '#f8fafc', borderRadius: '8px', overflow: 'hidden',
                        border: '1px solid #e2e8f0',
                      }}>
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          height: `${pct}%`,
                          background: isWeekend
                            ? 'linear-gradient(180deg, #94a3b8, #cbd5e1)'
                            : `linear-gradient(180deg, ${CHART_COLORS[dow % CHART_COLORS.length]}, ${CHART_COLORS[dow % CHART_COLORS.length]}80)`,
                          borderRadius: '0 0 7px 7px',
                          transition: 'height 0.5s ease',
                        }} />
                      </div>
                      <div style={{
                        fontSize: '1rem', fontWeight: 800,
                        color: isWeekend ? '#94a3b8' : '#1e40af',
                        marginTop: '0.3rem',
                      }}>{formatNumber(count)}</div>
                      <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                        {Math.round((count / Math.max(metricas.total_visitas, 1)) * 100)}%
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Calendar heatmap */}
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                📅 Mapa de Calor Diario
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {diasOrdenados.map(([dia, data]) => {
                  const maxDia = metricas.dia_pico?.cantidad || 1;
                  const intensity = Math.round((data.cantidad / maxDia) * 100);
                  const opacity = Math.max(0.15, intensity / 100);
                  const dateLabel = new Date(dia + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
                  return (
                    <div
                      key={dia}
                      title={`${dateLabel}: ${data.cantidad} consultas, ${data.pacientes} pacientes`}
                      style={{
                        width: '32px', height: '32px', borderRadius: '4px',
                        background: `rgba(30, 64, 175, ${opacity})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6rem', fontWeight: 700,
                        color: intensity > 50 ? 'white' : '#1e40af',
                        cursor: 'default',
                      }}
                    >
                      {data.cantidad}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Menos</span>
                {[0.15, 0.3, 0.5, 0.7, 1].map((o, i) => (
                  <div key={i} style={{
                    width: '12px', height: '12px', borderRadius: '2px',
                    background: `rgba(30, 64, 175, ${o})`,
                  }} />
                ))}
                <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Más</span>
              </div>
            </div>
          )}

          {/* ── VISTA: CIERRE DIARIO POR COLABORADOR ── */}
          {vistaActiva === 'cierre' && (
            <div>
              {diasOrdenados.slice().reverse().map(([dia, diaData]) => {
                const dateLabel = new Date(dia + 'T12:00:00').toLocaleDateString('es-AR', {
                  weekday: 'long', day: 'numeric', month: 'long',
                });
                const usrForDay = usuarios
                  .map(([usr, data]) => ({
                    nombre: usr,
                    cantidad: data.por_dia[dia] || 0,
                  }))
                  .filter(u => u.cantidad > 0)
                  .sort((a, b) => b.cantidad - a.cantidad);

                const totalDia = diaData.cantidad;

                return (
                  <div key={dia} className="aud-card" style={{ padding: '1rem', marginBottom: '0.65rem' }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: '0.65rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 800, fontSize: '0.85rem',
                        }}>
                          {new Date(dia + 'T12:00:00').getDate()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', textTransform: 'capitalize' }}>
                            {dateLabel}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {usrForDay.length} colaborador{usrForDay.length !== 1 ? 'es' : ''} · {diaData.pacientes} pacientes
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#1e40af' }}>
                          {formatNumber(totalDia)}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>consultas</div>
                      </div>
                    </div>
                    {/* Users table */}
                    <div style={{ display: 'grid', gap: '0.35rem' }}>
                      {usrForDay.map((usr, idx) => {
                        const pct = Math.round((usr.cantidad / totalDia) * 100);
                        return (
                          <div key={usr.nombre} style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.35rem 0.5rem', borderRadius: '8px',
                            background: idx % 2 === 0 ? '#f8fafc' : 'white',
                          }}>
                            <span style={{
                              width: '8px', height: '8px', borderRadius: '50%',
                              background: CHART_COLORS[idx % CHART_COLORS.length],
                              display: 'inline-block', flexShrink: 0,
                            }} />
                            <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                              {usr.nombre}
                            </span>
                            <div style={{ width: '80px', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: '3px',
                                background: CHART_COLORS[idx % CHART_COLORS.length],
                                width: `${pct}%`,
                              }} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e40af', width: '40px', textAlign: 'right' }}>
                              {usr.cantidad}
                            </span>
                            <span style={{
                              fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', width: '35px', textAlign: 'right',
                            }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
