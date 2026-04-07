import React, { useState, useEffect, useMemo } from 'react';
import {
  obtenerFacturacion,
  calcularResumenPorRecepcionista,
  calcularMetricasOperativas,
} from './facturacionService';

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

function getMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return {
    desde: `${y}-${m}-01`,
    hasta: `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`,
    label: new Date(y, now.getMonth()).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
  };
}

export default function EstadisticasSedePanel() {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [turnoFilter, setTurnoFilter] = useState('todos');
  const [fechaDiaria, setFechaDiaria] = useState(new Date().toISOString().slice(0, 10));
  const [vista, setVista] = useState('recepcionistas'); // 'recepcionistas' | 'metricas'
  const [recepcionistaDetalle, setRecepcionistaDetalle] = useState(null);

  const { desde, hasta, label: mesLabel } = useMemo(getMonthRange, []);

  // Load data
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

  // Datos filtrados por día específico
  const datosDiarios = useMemo(() => {
    return datos.filter(d => d.fecha === fechaDiaria);
  }, [datos, fechaDiaria]);
  const resumenDiario = useMemo(() => calcularResumenPorRecepcionista(datosDiarios), [datosDiarios]);

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

  return (
    <div className="aud-animate-in">
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem',
      }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            📊 Estadísticas de Sede
          </h2>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
            Tablero financiero · {mesLabel} · {formatNumber(datos.length)} registros
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex', gap: '0', borderBottom: '2px solid #e2e8f0',
        marginBottom: '1.5rem',
      }}>
        {[
          { id: 'recepcionistas', icon: '👩‍💼', label: 'Por Recepcionista' },
          { id: 'metricas', icon: '📈', label: 'Métricas Operativas' },
          { id: 'diario', icon: '📅', label: 'Vista Diaria' },
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
          fechaDiaria={fechaDiaria}
          setFechaDiaria={setFechaDiaria}
          resumen={resumenDiario}
          datosRaw={datosDiarios}
        />
      )}
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
// VISTA: DIARIA (un día específico)
// ═══════════════════════════════════════════════════════════════
function VistaDiaria({ fechaDiaria, setFechaDiaria, resumen, datosRaw }) {
  const [expandedUser, setExpandedUser] = useState(null);
  const totalDia = datosRaw.reduce((s, r) => s + (Number(r.total_importe) || 0), 0);
  const fechaLabel = new Date(fechaDiaria + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // Operaciones de un usuario específico
  const opsDetalle = expandedUser
    ? datosRaw.filter(d => d.usuario_factura === expandedUser)
        .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
    : [];

  return (
    <div>
      {/* Date picker */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        marginBottom: '1rem', flexWrap: 'wrap',
      }}>
        <input
          type="date"
          className="aud-input"
          value={fechaDiaria}
          onChange={e => { setFechaDiaria(e.target.value); setExpandedUser(null); }}
          style={{ width: '180px', marginBottom: 0 }}
        />
        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
          {fechaLabel}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
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
        </div>
      </div>

      {/* Tabla por recepcionista del día */}
      {resumen.length > 0 ? (
        <div style={{
          background: 'white', borderRadius: '12px', overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>#</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Recepcionista</th>
                <th style={thStyle}>Operaciones</th>
                <th style={thStyle}>Facturado</th>
                <th style={thStyle}>% del Total</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r, idx) => {
                const isExpanded = expandedUser === r.nombre;
                return (
                  <React.Fragment key={r.nombre}>
                    <tr
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9',
                        transition: 'background 0.1s',
                        background: isExpanded ? '#f0f9ff' : 'white',
                      }}
                      onMouseOver={e => { if (!isExpanded) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseOut={e => { if (!isExpanded) e.currentTarget.style.background = 'white'; }}
                    >
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#94a3b8' }}>{idx + 1}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#1e293b' }}>{formatUserName(r.nombre)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{r.cantidad_operaciones}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatMoney(r.total_facturado)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {totalDia > 0 ? ((r.total_facturado / totalDia) * 100).toFixed(1) : 0}%
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => setExpandedUser(isExpanded ? null : r.nombre)}
                          style={{
                            padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none',
                            fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                            background: isExpanded ? '#3b82f6' : '#eff6ff',
                            color: isExpanded ? 'white' : '#3b82f6',
                            transition: 'all 0.15s',
                          }}
                        >
                          {isExpanded ? '✕ Cerrar' : '🔍 Ver Detalle'}
                        </button>
                      </td>
                    </tr>
                    {/* Expanded detail rows */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <div style={{
                            background: '#f8fafc', padding: '0.75rem 1rem',
                            borderBottom: '2px solid #bfdbfe',
                            animation: 'fadeIn 0.2s ease',
                          }}>
                            <div style={{
                              fontSize: '0.72rem', fontWeight: 700, color: '#64748b',
                              textTransform: 'uppercase', marginBottom: '0.5rem',
                              display: 'flex', justifyContent: 'space-between',
                            }}>
                              <span>📋 Detalle de {r.cantidad_operaciones} operaciones — {formatUserName(r.nombre)}</span>
                              <span style={{ color: '#3b82f6' }}>Total: {formatMoney(r.total_facturado)}</span>
                            </div>
                            <div style={{
                              maxHeight: '300px', overflowY: 'auto',
                              borderRadius: '8px', border: '1px solid #e2e8f0',
                              background: 'white',
                            }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                <thead>
                                  <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                                    <th style={thDetailStyle}>Hora</th>
                                    <th style={thDetailStyle}>Turno</th>
                                    <th style={{ ...thDetailStyle, textAlign: 'left' }}>Paciente</th>
                                    <th style={{ ...thDetailStyle, textAlign: 'left' }}>Descripción</th>
                                    <th style={{ ...thDetailStyle, textAlign: 'left' }}>Familia</th>
                                    <th style={{ ...thDetailStyle, textAlign: 'left' }}>Forma de Pago</th>
                                    <th style={thDetailStyle}>Importe</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {opsDetalle.map((op, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ ...tdDetailStyle, textAlign: 'center', color: '#64748b' }}>
                                        {op.hora ? op.hora.substring(0, 5) : '—'}
                                      </td>
                                      <td style={{ ...tdDetailStyle, textAlign: 'center' }}>
                                        <span style={{
                                          padding: '0.1rem 0.4rem', borderRadius: '4px',
                                          fontSize: '0.65rem', fontWeight: 600,
                                          background: op.turno === 'mañana' ? '#fef3c7' : '#e0e7ff',
                                          color: op.turno === 'mañana' ? '#d97706' : '#4f46e5',
                                        }}>
                                          {op.turno === 'mañana' ? '☀️' : '🌙'}
                                        </span>
                                      </td>
                                      <td style={{ ...tdDetailStyle, color: '#334155', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {op.paciente || '—'}
                                      </td>
                                      <td style={{ ...tdDetailStyle, color: '#475569', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {op.descripcion || '—'}
                                      </td>
                                      <td style={{ ...tdDetailStyle, color: '#64748b' }}>
                                        {op.familia || '—'}
                                      </td>
                                      <td style={{ ...tdDetailStyle, color: '#0e7490', fontSize: '0.72rem' }}>
                                        {op.forma_de_pago || '—'}
                                      </td>
                                      <td style={{ ...tdDetailStyle, textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
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
                <td style={tdStyle}>TOTAL</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{resumen.reduce((s, r) => s + r.cantidad_operaciones, 0)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: '#3b82f6' }}>{formatMoney(totalDia)}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>100%</td>
                <td style={tdStyle}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          <div>No hay datos para el {fechaLabel}</div>
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
