import React, { useState, useEffect, useMemo } from 'react';
import {
  obtenerFacturacion,
  calcularResumenPorRecepcionista,
  calcularMetricasOperativas,
} from './facturacionService';
import VisitasSedePanel from './VisitasSedePanel';

// ═══════════════════════════════════════════════════════════════
// ESTADÍSTICAS DE SEDE — Panel completo de facturación
// ═══════════════════════════════════════════════════════════════

const formatMoney = (n) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
};

const formatNumber = (n) => new Intl.NumberFormat('es-AR').format(n);

// ── Color palette for charts ──
const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48',
];

// ── Period helpers ──
function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekRange(refDate) {
  const d = new Date(refDate + 'T12:00:00');
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    desde: mon.toISOString().slice(0, 10),
    hasta: sun.toISOString().slice(0, 10),
  };
}

function getMonthRange(refDate) {
  const d = new Date(refDate + 'T12:00:00');
  const y = d.getFullYear();
  const m = d.getMonth();
  return {
    desde: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    hasta: `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`,
  };
}

function formatPeriodLabel(tipo, desde, hasta) {
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  const optsShort = { day: 'numeric', month: 'short' };
  const d = new Date(desde + 'T12:00:00');
  const h = new Date(hasta + 'T12:00:00');

  if (tipo === 'dia') {
    return d.toLocaleDateString('es-AR', { weekday: 'long', ...opts });
  }
  if (tipo === 'semana') {
    return `${d.toLocaleDateString('es-AR', optsShort)} — ${h.toLocaleDateString('es-AR', opts)}`;
  }
  if (tipo === 'mes') {
    return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }
  // rango
  return `${d.toLocaleDateString('es-AR', optsShort)} — ${h.toLocaleDateString('es-AR', opts)}`;
}

export default function EstadisticasSedePanel() {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [turnoFilter, setTurnoFilter] = useState('todos');
  const [vista, setVista] = useState('recepcionistas');
  const [recepcionistaDetalle, setRecepcionistaDetalle] = useState(null);

  // ── Period filter state ──
  const [periodoTipo, setPeriodoTipo] = useState('dia'); // 'dia' | 'semana' | 'mes' | 'rango'
  const [fechaRef, setFechaRef] = useState(getToday());
  const [rangoDesde, setRangoDesde] = useState(getToday());
  const [rangoHasta, setRangoHasta] = useState(getToday());

  // Compute actual date range based on period type
  const { desde, hasta } = useMemo(() => {
    if (periodoTipo === 'dia') return { desde: fechaRef, hasta: fechaRef };
    if (periodoTipo === 'semana') return getWeekRange(fechaRef);
    if (periodoTipo === 'mes') return getMonthRange(fechaRef);
    return { desde: rangoDesde, hasta: rangoHasta };
  }, [periodoTipo, fechaRef, rangoDesde, rangoHasta]);

  const periodoLabel = useMemo(() => formatPeriodLabel(periodoTipo, desde, hasta), [periodoTipo, desde, hasta]);

  // Load data for the computed range
  useEffect(() => {
    setLoading(true);
    setError(null);
    obtenerFacturacion(desde, hasta, turnoFilter)
      .then(setDatos)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [desde, hasta, turnoFilter]);

  const resumenRecepcionistas = useMemo(() => calcularResumenPorRecepcionista(datos), [datos]);
  const metricas = useMemo(() => calcularMetricasOperativas(datos), [datos]);

  // For VistaDiaria we pass the same datos since they're already filtered by period
  const resumenDiario = useMemo(() => calcularResumenPorRecepcionista(datos), [datos]);

  // Navigation: prev/next period
  const navigatePeriod = (dir) => {
    const d = new Date(fechaRef + 'T12:00:00');
    if (periodoTipo === 'dia') d.setDate(d.getDate() + dir);
    else if (periodoTipo === 'semana') d.setDate(d.getDate() + (dir * 7));
    else if (periodoTipo === 'mes') d.setMonth(d.getMonth() + dir);
    const newDate = d.toISOString().slice(0, 10);
    setFechaRef(newDate);
  };

  const goToToday = () => {
    setFechaRef(getToday());
    if (periodoTipo === 'rango') {
      setRangoDesde(getToday());
      setRangoHasta(getToday());
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: '#64748b' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>📊</div>
          <div style={{ fontWeight: 600 }}>Cargando estadísticas de sede...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '2rem', background: '#fef2f2', border: '1px solid #fecaca',
        borderRadius: '12px', color: '#dc2626', textAlign: 'center',
      }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚠️</div>
        <div style={{ fontWeight: 600 }}>Error al cargar datos</div>
        <div style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>{error}</div>
        <div style={{ fontSize: '0.75rem', marginTop: '0.8rem', color: '#94a3b8' }}>
          Asegurate de que la tabla <code>facturacion_sede</code> existe en Supabase y que se ejecutó la sincronización desde ADM-QUI.
        </div>
      </div>
    );
  }

  const btnNav = {
    padding: '0.35rem 0.6rem', borderRadius: 6, border: '1px solid #e2e8f0',
    background: 'white', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
    color: '#64748b', transition: 'all 0.15s', lineHeight: 1,
  };
  const btnNavHover = (e, enter) => {
    e.currentTarget.style.background = enter ? '#f1f5f9' : 'white';
  };

  return (
    <div className="aud-animate-in">
      {/* ── HEADER + PERIOD FILTERS ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem',
      }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            📊 Estadísticas de Sede
          </h2>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem', textTransform: 'capitalize' }}>
            Tablero financiero · {periodoLabel} · {formatNumber(datos.length)} registros
          </div>
        </div>

        {/* Turno filter */}
        <select
          className="aud-select"
          value={turnoFilter}
          onChange={e => setTurnoFilter(e.target.value)}
          style={{ minWidth: '120px', fontSize: '0.82rem' }}
        >
          <option value="todos">Todos los turnos</option>
          <option value="mañana">☀️ Mañana (7:30-16:30)</option>
          <option value="tarde">🌙 Tarde (12-21hs)</option>
        </select>
      </div>

      {/* ── PERIOD SELECTOR BAR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: 10,
        border: '1px solid #e2e8f0', marginBottom: '1rem',
        flexWrap: 'wrap',
      }}>
        {/* Period type buttons */}
        {[
          { id: 'dia', label: '📅 Día' },
          { id: 'semana', label: '📆 Semana' },
          { id: 'mes', label: '🗓️ Mes' },
          { id: 'rango', label: '↔️ Rango' },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setPeriodoTipo(p.id)}
            style={{
              padding: '0.35rem 0.75rem', borderRadius: 6, border: 'none',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              background: periodoTipo === p.id ? '#3b82f6' : 'white',
              color: periodoTipo === p.id ? 'white' : '#64748b',
              transition: 'all 0.15s',
              boxShadow: periodoTipo === p.id ? '0 2px 6px rgba(59,130,246,0.25)' : '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            {p.label}
          </button>
        ))}

        <div style={{ width: 1, height: 24, background: '#e2e8f0', margin: '0 0.25rem' }} />

        {/* Navigation + Date inputs */}
        {periodoTipo !== 'rango' ? (
          <>
            <button style={btnNav} onClick={() => navigatePeriod(-1)}
              onMouseOver={e => btnNavHover(e, true)} onMouseOut={e => btnNavHover(e, false)}>
              ◀
            </button>
            <input
              type="date"
              className="aud-input"
              value={fechaRef}
              onChange={e => setFechaRef(e.target.value)}
              style={{ width: '160px', marginBottom: 0, fontSize: '0.82rem', textAlign: 'center' }}
            />
            <button style={btnNav} onClick={() => navigatePeriod(1)}
              onMouseOver={e => btnNavHover(e, true)} onMouseOut={e => btnNavHover(e, false)}>
              ▶
            </button>
          </>
        ) : (
          <>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8' }}>Desde:</label>
            <input
              type="date"
              className="aud-input"
              value={rangoDesde}
              onChange={e => setRangoDesde(e.target.value)}
              style={{ width: '150px', marginBottom: 0, fontSize: '0.82rem' }}
            />
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8' }}>Hasta:</label>
            <input
              type="date"
              className="aud-input"
              value={rangoHasta}
              onChange={e => setRangoHasta(e.target.value)}
              style={{ width: '150px', marginBottom: 0, fontSize: '0.82rem' }}
            />
          </>
        )}

        <button
          onClick={goToToday}
          style={{
            ...btnNav, background: '#eff6ff', color: '#3b82f6',
            border: '1px solid #bfdbfe', fontWeight: 700, fontSize: '0.72rem',
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#dbeafe'; }}
          onMouseOut={e => { e.currentTarget.style.background = '#eff6ff'; }}
        >
          Hoy
        </button>

        {/* Period label summary */}
        <div style={{
          marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 600, color: '#1e293b',
          textTransform: 'capitalize',
        }}>
          {periodoLabel}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex', gap: '0', borderBottom: '2px solid #e2e8f0',
        marginBottom: '1.5rem',
      }}>
        {[
          { id: 'recepcionistas', icon: '👩‍💼', label: 'Por Recepcionista' },
          { id: 'metricas', icon: '📈', label: 'Métricas Operativas' },
          { id: 'diario', icon: '📅', label: 'Vista por Sector' },
          { id: 'visitas', icon: '🏥', label: 'Consultas Médicas' },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => { setVista(tab.id); setRecepcionistaDetalle(null); }}
            style={{
              padding: '0.65rem 1.2rem', border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 600, background: 'none',
              borderBottom: vista === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
              color: vista === tab.id ? '#3b82f6' : '#94a3b8',
              marginBottom: '-2px', transition: 'all 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Summary Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem', marginBottom: '1.5rem',
      }}>
        <KPICard icon="💰" label="Total Facturado" value={formatMoney(metricas.total_facturado)} color="#3b82f6" />
        <KPICard icon="📋" label="Operaciones" value={formatNumber(metricas.total_operaciones)} color="#8b5cf6" />
        <KPICard icon="👥" label="Pacientes Únicos" value={formatNumber(metricas.pacientes_unicos)} color="#f59e0b" />
        <KPICard icon="💳" label="Formas de Pago" value={Object.keys(metricas.por_forma_pago || {}).length} color="#10b981" />
      </div>

      {/* Tab Content */}
      {vista === 'recepcionistas' && (
        <VistaRecepcionistas
          resumen={resumenRecepcionistas}
          totalGeneral={metricas.total_facturado}
          detalle={recepcionistaDetalle}
          setDetalle={setRecepcionistaDetalle}
        />
      )}
      {vista === 'metricas' && <VistaMetricas metricas={metricas} />}
      {vista === 'diario' && (
        <VistaDiaria
          fechaDiaria={desde}
          setFechaDiaria={(f) => { setPeriodoTipo('dia'); setFechaRef(f); }}
          resumen={resumenDiario}
          datosRaw={datos}
        />
      )}
      {vista === 'visitas' && <VisitasSedePanel />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// KPI CARD Component
// ═══════════════════════════════════════════════════════════════
function KPICard({ icon, label, value, color }) {
  return (
    <div style={{
      background: 'white', borderRadius: '12px', padding: '1rem',
      border: '1px solid #f1f5f9',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
      onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
    >
      <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color, marginTop: '0.3rem' }}>
        {value}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VISTA: POR RECEPCIONISTA
// ═══════════════════════════════════════════════════════════════
function VistaRecepcionistas({ resumen, totalGeneral, detalle, setDetalle }) {
  const maxFacturado = resumen.length > 0 ? resumen[0].total_facturado : 1;

  return (
    <div>
      {/* Ranking de recepcionistas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {resumen.map((r, idx) => {
          const pct = totalGeneral > 0 ? ((r.total_facturado / totalGeneral) * 100).toFixed(1) : 0;
          const barWidth = maxFacturado > 0 ? (r.total_facturado / maxFacturado) * 100 : 0;
          const isOpen = detalle === r.nombre;

          return (
            <div key={r.nombre}>
              <div
                onClick={() => setDetalle(isOpen ? null : r.nombre)}
                style={{
                  background: 'white', borderRadius: '10px', padding: '0.85rem 1rem',
                  border: isOpen ? '1px solid #bfdbfe' : '1px solid #f1f5f9',
                  cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: isOpen ? '0 2px 8px rgba(59,130,246,0.1)' : '0 1px 2px rgba(0,0,0,0.03)',
                }}
                onMouseOver={e => { if (!isOpen) e.currentTarget.style.borderColor = '#e2e8f0'; }}
                onMouseOut={e => { if (!isOpen) e.currentTarget.style.borderColor = '#f1f5f9'; }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      background: idx < 3 ? ['linear-gradient(135deg,#fbbf24,#f59e0b)', 'linear-gradient(135deg,#d1d5db,#9ca3af)', 'linear-gradient(135deg,#f97316,#ea580c)'][idx] : '#f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.68rem', fontWeight: 700, color: idx < 3 ? 'white' : '#64748b',
                    }}>
                      {idx + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                        {formatUserName(r.nombre)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        {r.cantidad_operaciones} ops · {r.dias_trabajados} días
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                      {formatMoney(r.total_facturado)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      {pct}% del total
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{
                  height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${barWidth}%`, borderRadius: '3px',
                    background: `linear-gradient(90deg, ${CHART_COLORS[idx % CHART_COLORS.length]}, ${CHART_COLORS[(idx + 1) % CHART_COLORS.length]})`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>

              {/* Detalle expandido */}
              {isOpen && (
                <div style={{
                  background: '#f8fafc', borderRadius: '0 0 10px 10px',
                  padding: '0.85rem 1rem', marginTop: '-4px',
                  border: '1px solid #bfdbfe', borderTop: 'none',
                  animation: 'slideDown 0.2s ease',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    {/* Por familia */}
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                        Por Familia
                      </div>
                      {Object.entries(r.por_familia)
                        .sort((a, b) => b[1].importe - a[1].importe)
                        .map(([fam, val]) => (
                          <div key={fam} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.25rem 0', fontSize: '0.78rem', borderBottom: '1px solid #e2e8f0',
                          }}>
                            <span style={{ color: '#475569' }}>{fam}</span>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>
                              {formatMoney(val.importe)} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({val.cantidad})</span>
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* Por servicio */}
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                        Por Servicio
                      </div>
                      {Object.entries(r.por_servicio)
                        .sort((a, b) => b[1].importe - a[1].importe)
                        .slice(0, 8)
                        .map(([srv, val]) => (
                          <div key={srv} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.25rem 0', fontSize: '0.78rem', borderBottom: '1px solid #e2e8f0',
                          }}>
                            <span style={{ color: '#475569' }}>{srv}</span>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>
                              {val.cantidad}
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* Por forma de pago */}
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                        Forma de Pago
                      </div>
                      {Object.entries(r.por_forma_pago || {})
                        .sort((a, b) => b[1].importe - a[1].importe)
                        .map(([fp, val]) => (
                          <div key={fp} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.25rem 0', fontSize: '0.78rem', borderBottom: '1px solid #e2e8f0',
                          }}>
                            <span style={{ color: '#475569' }}>{fp}</span>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>
                              {formatMoney(val.importe)} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({val.cantidad})</span>
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div style={{
                    marginTop: '0.5rem', padding: '0.4rem 0.6rem',
                    background: '#eff6ff', borderRadius: '8px',
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '0.78rem',
                  }}>
                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                      Promedio/op: {formatMoney(r.total_facturado / (r.cantidad_operaciones || 1))}
                    </span>
                    <span style={{ color: '#64748b' }}>
                      {r.dias_trabajados} días activos
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {resumen.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          <div>No hay datos de facturación para el período seleccionado</div>
          <div style={{ fontSize: '0.78rem', marginTop: '0.3rem' }}>
            Ejecutá la sincronización desde ADM-QUI primero.
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VISTA: MÉTRICAS OPERATIVAS
// ═══════════════════════════════════════════════════════════════
function VistaMetricas({ metricas }) {
  const familias = Object.entries(metricas.por_familia)
    .sort((a, b) => b[1].cantidad - a[1].cantidad);
  const servicios = Object.entries(metricas.por_servicio)
    .sort((a, b) => b[1].cantidad - a[1].cantidad);
  const formasPago = Object.entries(metricas.por_forma_pago || {})
    .sort((a, b) => b[1].importe - a[1].importe);
  const diasOrdenados = Object.entries(metricas.por_dia)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const maxDiaImporte = Math.max(...diasOrdenados.map(([, d]) => d.importe), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Turno breakdown */}
      <div className="aud-card" style={{ padding: '1rem' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
          ⏰ Distribución por Turno
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <TurnoCard
            icon="☀️" label="Mañana (7:30-16:30)"
            cantidad={metricas.por_turno.mañana?.cantidad || 0}
            importe={metricas.por_turno.mañana?.importe || 0}
            color="#f59e0b"
            total={metricas.total_operaciones}
          />
          <TurnoCard
            icon="🌙" label="Tarde (12-21hs)"
            cantidad={metricas.por_turno.tarde?.cantidad || 0}
            importe={metricas.por_turno.tarde?.importe || 0}
            color="#6366f1"
            total={metricas.total_operaciones}
          />
        </div>
      </div>

      {/* Grid: Familias + Servicios + Formas de Pago */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {/* Familias */}
        <div className="aud-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.6rem' }}>
            📂 Conteo por Familia
          </div>
          {familias.map(([fam, val], idx) => (
            <div key={fam} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: CHART_COLORS[idx % CHART_COLORS.length],
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: '0.82rem', color: '#334155' }}>{fam}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{formatNumber(val.cantidad)}</span>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: '0.4rem' }}>{formatMoney(val.importe)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Servicios */}
        <div className="aud-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.6rem' }}>
            🏥 Conteo por Servicio
          </div>
          {servicios.slice(0, 12).map(([srv, val], idx) => (
            <div key={srv} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9',
            }}>
              <span style={{ fontSize: '0.82rem', color: '#334155' }}>{srv}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{formatNumber(val.cantidad)}</span>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: '0.4rem' }}>{formatMoney(val.importe)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Formas de Pago */}
        <div className="aud-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.6rem' }}>
            💳 Formas de Pago
          </div>
          {formasPago.map(([fp, val], idx) => (
            <div key={fp} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: CHART_COLORS[(idx + 4) % CHART_COLORS.length],
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: '0.82rem', color: '#334155' }}>{fp}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{formatNumber(val.cantidad)}</span>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: '0.4rem' }}>{formatMoney(val.importe)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evolución diaria */}
      <div className="aud-card" style={{ padding: '1rem' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.6rem' }}>
          📅 Evolución Diaria del Mes
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {diasOrdenados.map(([dia, val]) => {
            const barW = (val.importe / maxDiaImporte) * 100;
            const diaLabel = new Date(dia + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
            return (
              <div key={dia} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', width: '60px', textAlign: 'right', flexShrink: 0 }}>
                  {diaLabel}
                </span>
                <div style={{ flex: 1, height: '18px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    height: '100%', width: `${barW}%`, borderRadius: '4px',
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#334155', width: '80px', textAlign: 'right', flexShrink: 0 }}>
                  {formatMoney(val.importe)}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', width: '40px', flexShrink: 0 }}>
                  {val.pacientes}p
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VISTA: POR SECTOR (data filtered by global period)
// ═══════════════════════════════════════════════════════════════
function VistaDiaria({ fechaDiaria, setFechaDiaria, resumen, datosRaw }) {
  const [expandedUser, setExpandedUser] = useState(null);
  const [expandedSector, setExpandedSector] = useState(null);
  const [showDepositos, setShowDepositos] = useState(false);
  const totalDia = datosRaw.reduce((s, r) => s + (Number(r.total_importe) || 0), 0);

  // ── Agrupar datos raw por Sector (servicio) ──
  const porSector = useMemo(() => {
    const sectorMap = {};
    for (const row of datosRaw) {
      const sector = row.servicio || 'Sin sector';
      if (!sectorMap[sector]) {
        sectorMap[sector] = {
          nombre: sector,
          datos: [],
          total: 0,
          operaciones: 0,
          por_forma_pago: {},
          por_usuario: {},
        };
      }
      const s = sectorMap[sector];
      s.datos.push(row);
      s.total += Number(row.total_importe) || 0;
      s.operaciones += 1;

      // Por forma de pago
      const fp = row.forma_de_pago || 'Sin especificar';
      if (!s.por_forma_pago[fp]) s.por_forma_pago[fp] = { cantidad: 0, importe: 0 };
      s.por_forma_pago[fp].cantidad += 1;
      s.por_forma_pago[fp].importe += Number(row.total_importe) || 0;

      // Por usuario dentro del sector
      const user = row.usuario_factura || 'Sin usuario';
      if (!s.por_usuario[user]) {
        s.por_usuario[user] = {
          nombre: user,
          total: 0,
          operaciones: 0,
          por_forma_pago: {},
        };
      }
      const u = s.por_usuario[user];
      u.total += Number(row.total_importe) || 0;
      u.operaciones += 1;
      if (!u.por_forma_pago[fp]) u.por_forma_pago[fp] = { cantidad: 0, importe: 0 };
      u.por_forma_pago[fp].cantidad += 1;
      u.por_forma_pago[fp].importe += Number(row.total_importe) || 0;
    }

    return Object.values(sectorMap)
      .map(s => ({
        ...s,
        usuarios: Object.values(s.por_usuario).sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [datosRaw]);

  // ── Resumen global de formas de pago ──
  const formasPagoGlobal = useMemo(() => {
    const fp = {};
    for (const row of datosRaw) {
      const key = row.forma_de_pago || 'Sin especificar';
      if (!fp[key]) fp[key] = { cantidad: 0, importe: 0 };
      fp[key].cantidad += 1;
      fp[key].importe += Number(row.total_importe) || 0;
    }
    return Object.entries(fp).sort((a, b) => b[1].importe - a[1].importe);
  }, [datosRaw]);

  // ── Depósitos con datos de paciente ──
  const depositos = useMemo(() => {
    return datosRaw.filter(r =>
      (r.forma_de_pago || '').toLowerCase().includes('dep') ||
      (r.descripcion || '').toLowerCase().includes('deposito') ||
      (r.descripcion || '').toLowerCase().includes('depósito')
    ).sort((a, b) => (Number(b.total_importe) || 0) - (Number(a.total_importe) || 0));
  }, [datosRaw]);

  // Forma de pago color palette
  const fpColors = {
    'EFECTIVO': { bg: '#dcfce7', color: '#166534', icon: '💵' },
    'DEBITO': { bg: '#e0e7ff', color: '#3730a3', icon: '💳' },
    'TRANSFERENCIA': { bg: '#cffafe', color: '#0e7490', icon: '🔄' },
    'DEPOSITO': { bg: '#fef3c7', color: '#92400e', icon: '🏦' },
  };
  const getFPStyle = (fp) => {
    const key = (fp || '').toUpperCase();
    for (const [k, v] of Object.entries(fpColors)) {
      if (key.includes(k)) return v;
    }
    return { bg: '#f1f5f9', color: '#64748b', icon: '💳' };
  };

  // Operaciones de un usuario específico
  const opsDetalle = expandedUser
    ? datosRaw.filter(d => d.usuario_factura === expandedUser)
        .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
    : [];

  return (
    <div>
      {/* KPI summary for this period */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        marginBottom: '1rem', flexWrap: 'wrap',
      }}>
        <span style={{
          padding: '0.35rem 0.75rem', borderRadius: '8px',
          background: '#eff6ff', fontSize: '0.82rem', fontWeight: 600, color: '#3b82f6',
        }}>
          💰 {formatMoney(totalDia)}
        </span>
        <span style={{
          padding: '0.35rem 0.75rem', borderRadius: '8px',
          background: '#f0fdf4', fontSize: '0.82rem', fontWeight: 600, color: '#10b981',
        }}>
          📋 {datosRaw.length} ops
        </span>
        <span style={{
          padding: '0.35rem 0.75rem', borderRadius: '8px',
          background: '#faf5ff', fontSize: '0.82rem', fontWeight: 600, color: '#7c3aed',
        }}>
          🏥 {porSector.length} sectores
        </span>
      </div>

      {/* ── FORMAS DE PAGO GLOBALES ── */}
      {datosRaw.length > 0 && (
        <div style={{
          display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap',
        }}>
          {formasPagoGlobal.map(([fp, val]) => {
            const style = getFPStyle(fp);
            return (
              <div key={fp} style={{
                padding: '0.5rem 0.85rem', borderRadius: '10px',
                background: style.bg, border: `1px solid ${style.color}30`,
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                flex: '1 1 auto', minWidth: '150px',
              }}>
                <span style={{ fontSize: '1.1rem' }}>{style.icon}</span>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: style.color, textTransform: 'uppercase' }}>
                    {fp}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: style.color }}>
                    {formatMoney(val.importe)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: style.color + 'aa' }}>
                    {val.cantidad} operaciones
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DESGLOSE POR SECTOR ── */}
      {porSector.length > 0 ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {porSector.map((sector, sIdx) => {
            const isOpen = expandedSector === sector.nombre;
            const fpEntries = Object.entries(sector.por_forma_pago).sort((a, b) => b[1].importe - a[1].importe);
            const pctTotal = totalDia > 0 ? ((sector.total / totalDia) * 100).toFixed(1) : 0;

            return (
              <div key={sector.nombre} style={{
                background: 'white', borderRadius: 12, overflow: 'hidden',
                border: '1px solid #e2e8f0',
                borderLeft: `4px solid ${CHART_COLORS[sIdx % CHART_COLORS.length]}`,
              }}>
                {/* Sector Header */}
                <div
                  onClick={() => setExpandedSector(isOpen ? null : sector.nombre)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.75rem 1rem', cursor: 'pointer',
                    background: isOpen ? '#f8fafc' : 'white',
                    transition: 'background 0.15s',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseOut={e => { if (!isOpen) e.currentTarget.style.background = 'white'; }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      🏥 {sector.nombre}
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 400, color: '#94a3b8',
                        padding: '0.1rem 0.4rem', background: '#f1f5f9', borderRadius: 4,
                      }}>
                        {sector.operaciones} ops · {sector.usuarios.length} recep.
                      </span>
                    </div>
                    {/* Formas de pago mini-badges */}
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                      {fpEntries.map(([fp, val]) => {
                        const s = getFPStyle(fp);
                        return (
                          <span key={fp} style={{
                            fontSize: '0.65rem', fontWeight: 700,
                            padding: '0.1rem 0.4rem', borderRadius: 4,
                            background: s.bg, color: s.color,
                          }}>
                            {s.icon} {fp}: {formatMoney(val.importe)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, fontSize: '1.15rem', color: CHART_COLORS[sIdx % CHART_COLORS.length] }}>
                      {formatMoney(sector.total)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                      {pctTotal}% del total
                    </div>
                  </div>
                </div>

                {/* Sector Detail — Usuarios */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #e2e8f0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={thStyle}>#</th>
                          <th style={{ ...thStyle, textAlign: 'left' }}>Recepcionista</th>
                          <th style={thStyle}>Ops</th>
                          {fpEntries.map(([fp]) => (
                            <th key={fp} style={{ ...thStyle, fontSize: '0.65rem' }}>
                              {getFPStyle(fp).icon} {fp.length > 8 ? fp.slice(0, 8) + '…' : fp}
                            </th>
                          ))}
                          <th style={thStyle}>Total</th>
                          <th style={thStyle}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sector.usuarios.map((u, uIdx) => {
                          const isUserOpen = expandedUser === u.nombre;
                          return (
                            <React.Fragment key={u.nombre}>
                              <tr
                                style={{
                                  borderBottom: '1px solid #f1f5f9',
                                  background: isUserOpen ? '#f0f9ff' : 'white',
                                }}
                                onMouseOver={e => { if (!isUserOpen) e.currentTarget.style.background = '#fafafa'; }}
                                onMouseOut={e => { if (!isUserOpen) e.currentTarget.style.background = isUserOpen ? '#f0f9ff' : 'white'; }}
                              >
                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#94a3b8' }}>{uIdx + 1}</td>
                                <td style={{ ...tdStyle, fontWeight: 600, color: '#1e293b' }}>{formatUserName(u.nombre)}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>{u.operaciones}</td>
                                {fpEntries.map(([fp]) => {
                                  const val = u.por_forma_pago[fp];
                                  return (
                                    <td key={fp} style={{ ...tdStyle, textAlign: 'right', fontSize: '0.78rem' }}>
                                      {val ? (
                                        <span style={{ fontWeight: 600, color: getFPStyle(fp).color }}>
                                          {formatMoney(val.importe)}
                                          <span style={{ fontSize: '0.6rem', color: '#94a3b8', marginLeft: '2px' }}>({val.cantidad})</span>
                                        </span>
                                      ) : (
                                        <span style={{ color: '#e2e8f0' }}>—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                                  {formatMoney(u.total)}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  <button
                                    onClick={() => setExpandedUser(isUserOpen ? null : u.nombre)}
                                    style={{
                                      padding: '0.25rem 0.5rem', borderRadius: '6px', border: 'none',
                                      fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer',
                                      background: isUserOpen ? '#3b82f6' : '#eff6ff',
                                      color: isUserOpen ? 'white' : '#3b82f6',
                                    }}
                                  >
                                    {isUserOpen ? '✕' : '🔍'}
                                  </button>
                                </td>
                              </tr>
                              {/* Expanded user detail */}
                              {isUserOpen && (
                                <tr>
                                  <td colSpan={fpEntries.length + 5} style={{ padding: 0 }}>
                                    <div style={{
                                      background: '#f8fafc', padding: '0.6rem 1rem',
                                      borderBottom: '2px solid #bfdbfe',
                                    }}>
                                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem' }}>
                                        📋 {opsDetalle.length} operaciones — {formatUserName(u.nombre)}
                                      </div>
                                      <div style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', maxHeight: '300px', overflowY: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                          <thead>
                                            <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                                              <th style={thDetailStyle}>Hora</th>
                                              <th style={{ ...thDetailStyle, textAlign: 'left' }}>Paciente</th>
                                              <th style={{ ...thDetailStyle, textAlign: 'left' }}>Descripción</th>
                                              <th style={{ ...thDetailStyle, textAlign: 'left' }}>Forma Pago</th>
                                              <th style={thDetailStyle}>Importe</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {opsDetalle.map((op, i) => (
                                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ ...tdDetailStyle, textAlign: 'center', color: '#64748b' }}>
                                                  {op.hora ? op.hora.substring(0, 5) : '—'}
                                                </td>
                                                <td style={{ ...tdDetailStyle, color: '#334155', fontWeight: 500 }}>
                                                  {op.paciente || '—'}
                                                </td>
                                                <td style={{ ...tdDetailStyle, color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                  {op.descripcion || '—'}
                                                </td>
                                                <td style={tdDetailStyle}>
                                                  <span style={{
                                                    padding: '0.1rem 0.35rem', borderRadius: 4,
                                                    fontSize: '0.65rem', fontWeight: 600,
                                                    background: getFPStyle(op.forma_de_pago).bg,
                                                    color: getFPStyle(op.forma_de_pago).color,
                                                  }}>
                                                    {op.forma_de_pago || '—'}
                                                  </span>
                                                </td>
                                                <td style={{ ...tdDetailStyle, textAlign: 'right', fontWeight: 600 }}>
                                                  {formatMoney(Number(op.total_importe) || 0)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f0f9ff', fontWeight: 700 }}>
                          <td style={tdStyle}></td>
                          <td style={tdStyle}>SUBTOTAL SECTOR</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{sector.operaciones}</td>
                          {fpEntries.map(([fp, val]) => (
                            <td key={fp} style={{ ...tdStyle, textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, color: getFPStyle(fp).color }}>
                              {formatMoney(val.importe)}
                            </td>
                          ))}
                          <td style={{ ...tdStyle, textAlign: 'right', color: CHART_COLORS[sIdx % CHART_COLORS.length], fontSize: '0.95rem' }}>
                            {formatMoney(sector.total)}
                          </td>
                          <td style={tdStyle}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {/* TOTAL General */}
          <div style={{
            background: '#f0f9ff', borderRadius: 10, padding: '0.75rem 1rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            border: '1px solid #bfdbfe',
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
              📊 TOTAL DEL DÍA — {porSector.length} sectores · {datosRaw.length} operaciones
            </span>
            <span style={{ fontWeight: 900, fontSize: '1.2rem', color: '#3b82f6' }}>
              {formatMoney(totalDia)}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          <div>No hay datos para el {fechaLabel}</div>
        </div>
      )}

      {/* ── DEPÓSITOS CON DATOS DE PACIENTE ── */}
      {depositos.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <div
            onClick={() => setShowDepositos(!showDepositos)}
            style={{
              background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 10,
              padding: '0.65rem 1rem', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>🏦</span>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#92400e' }}>
                Depósitos del Día
              </span>
              <span style={{ fontSize: '0.72rem', color: '#b45309' }}>
                ({depositos.length} operaciones · {formatMoney(depositos.reduce((s, d) => s + (Number(d.total_importe) || 0), 0))})
              </span>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#92400e' }}>{showDepositos ? '▲' : '▼'}</span>
          </div>

          {showDepositos && (
            <div style={{
              background: 'white', border: '1px solid #fbbf24', borderTop: 'none',
              borderRadius: '0 0 10px 10px', overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: '#fffbeb' }}>
                    <th style={thDetailStyle}>Hora</th>
                    <th style={{ ...thDetailStyle, textAlign: 'left' }}>Paciente</th>
                    <th style={{ ...thDetailStyle, textAlign: 'left' }}>ID Paciente</th>
                    <th style={{ ...thDetailStyle, textAlign: 'left' }}>Descripción</th>
                    <th style={{ ...thDetailStyle, textAlign: 'left' }}>Recepcionista</th>
                    <th style={{ ...thDetailStyle, textAlign: 'left' }}>Sector</th>
                    <th style={thDetailStyle}>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {depositos.map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #fef3c7' }}>
                      <td style={{ ...tdDetailStyle, textAlign: 'center', color: '#64748b' }}>
                        {d.hora ? d.hora.substring(0, 5) : '—'}
                      </td>
                      <td style={{ ...tdDetailStyle, fontWeight: 600, color: '#1e293b' }}>
                        {d.paciente || '—'}
                      </td>
                      <td style={{ ...tdDetailStyle, color: '#94a3b8', fontSize: '0.72rem' }}>
                        {d.id_paciente || '—'}
                      </td>
                      <td style={{ ...tdDetailStyle, color: '#475569' }}>
                        {d.descripcion || '—'}
                      </td>
                      <td style={{ ...tdDetailStyle, color: '#64748b' }}>
                        {formatUserName(d.usuario_factura)}
                      </td>
                      <td style={{ ...tdDetailStyle, color: '#64748b' }}>
                        {d.servicio || '—'}
                      </td>
                      <td style={{ ...tdDetailStyle, textAlign: 'right', fontWeight: 700, color: '#92400e' }}>
                        {formatMoney(Number(d.total_importe) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#fef3c7', fontWeight: 700 }}>
                    <td colSpan={6} style={{ ...tdDetailStyle, textAlign: 'right', color: '#92400e' }}>Total Depósitos:</td>
                    <td style={{ ...tdDetailStyle, textAlign: 'right', color: '#92400e', fontSize: '0.9rem' }}>
                      {formatMoney(depositos.reduce((s, d) => s + (Number(d.total_importe) || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TURNO CARD
// ═══════════════════════════════════════════════════════════════
function TurnoCard({ icon, label, cantidad, importe, color, total }) {
  const pct = total > 0 ? ((cantidad / total) * 100).toFixed(0) : 0;
  return (
    <div style={{
      padding: '0.75rem', borderRadius: '10px',
      background: `${color}08`, border: `1px solid ${color}20`,
    }}>
      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{icon} {label}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, color, marginTop: '0.2rem' }}>
        {formatNumber(cantidad)} <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#94a3b8' }}>ops ({pct}%)</span>
      </div>
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginTop: '0.15rem' }}>
        {formatMoney(importe)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function formatUserName(name) {
  if (!name) return '';
  // "RUARTE, DAIANA MICAELA" → "Ruarte, Daiana M."
  const parts = name.split(',').map(p => p.trim());
  if (parts.length === 2) {
    const apellido = parts[0].charAt(0) + parts[0].slice(1).toLowerCase();
    const nombres = parts[1].split(' ').map(n => n.charAt(0) + n.slice(1).toLowerCase());
    // Abreviar si hay más de un nombre
    const display = nombres.length > 1
      ? `${nombres[0]} ${nombres[1].charAt(0)}.`
      : nombres[0];
    return `${apellido}, ${display}`;
  }
  return name.charAt(0) + name.slice(1).toLowerCase();
}

const thStyle = {
  padding: '0.6rem 0.75rem', fontWeight: 700, fontSize: '0.72rem',
  color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em',
  textAlign: 'center',
};

const tdStyle = {
  padding: '0.6rem 0.75rem',
};

const thDetailStyle = {
  padding: '0.4rem 0.6rem', fontWeight: 700, fontSize: '0.68rem',
  color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em',
  textAlign: 'center',
};

const tdDetailStyle = {
  padding: '0.35rem 0.6rem',
};
