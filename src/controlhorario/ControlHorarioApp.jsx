import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  listarSectores,
  listarColaboradores,
  cruzarDiagramaVsFichadas,
  calcularEstadisticas,
  calcularEstadisticasPorSector,
  guardarFichada,
  getWeekRange,
  getMonthRange,
  formatTime,
  formatDate,
  getDayName,
  getInitials,
  SECTOR_ICONS,
  // ─── Reglas de horas ───
  HORAS_REQUERIDAS_DIA,
  HORAS_SEMANALES_OBJETIVO,
  redondearHoras,
  formatMinutosDisplay,
  getHorasRequeridas,
  evaluarCumplimientoDiario,
  evaluarCumplimientoSemanal,
} from './controlHorarioService';
import './controlhorario.css';

// ─── CONSTANTS ─────────────────────────────────────────────
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_SEMANA_REQ = ['9h', '9h', '9h', '9h', '8h', '4h', '—'];

const STATUS_CONFIG = {
  cumplido: { label: 'Cumplido', class: 'ch-badge--cumplido', icon: '✅', short: '✓' },
  llegada_tarde: { label: 'Tardanza', class: 'ch-badge--tarde', icon: '⚠️', short: '⏰' },
  ausencia: { label: 'Ausencia', class: 'ch-badge--ausencia', icon: '❌', short: '✗' },
  franco: { label: 'Franco', class: 'ch-badge--franco', icon: '🔲', short: 'F' },
  sin_datos: { label: 'Sin datos', class: 'ch-badge--sin-datos', icon: '—', short: '—' },
  sin_diagrama: { label: 'Sin diagrama', class: 'ch-badge--sin-diagrama', icon: '📋', short: '?' },
  trabajo_en_franco: { label: 'Trabajó en franco', class: 'ch-badge--trabajo-en-franco', icon: '⭐', short: '★' },
};

// ─── MAIN COMPONENT ───────────────────────────────────────
export default function ControlHorarioApp({ embedded = false }) {
  const [activeTab, setActiveTab] = useState('resumen');
  const [selectedSector, setSelectedSector] = useState(null);

  const [sectores, setSectores] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [cruceData, setCruceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [weekOffset, setWeekOffset] = useState(0);

  const dateRange = useMemo(() => {
    const ref = new Date();
    ref.setDate(ref.getDate() + weekOffset * 7);
    return getWeekRange(ref);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    const days = [];
    const start = new Date(dateRange.desde + 'T12:00:00');
    const end = new Date(dateRange.hasta + 'T12:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, [dateRange]);

  const today = new Date().toISOString().slice(0, 10);

  // ─── LOAD DATA ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sectoresData, colabData, cruce] = await Promise.all([
        listarSectores(),
        listarColaboradores(),
        cruzarDiagramaVsFichadas(dateRange.desde, dateRange.hasta),
      ]);
      setSectores(sectoresData);
      setColaboradores(colabData);
      setCruceData(cruce);
    } catch (err) {
      console.error('Error loading control horario:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── COMPUTED ───────────────────────────────────────────
  const stats = useMemo(() => calcularEstadisticas(cruceData), [cruceData]);
  const sectorStats = useMemo(() => calcularEstadisticasPorSector(cruceData), [cruceData]);

  const filteredCruce = useMemo(() => {
    if (!selectedSector) return cruceData;
    return cruceData.filter(c => c.colaborador?.sector?.nombre === selectedSector);
  }, [cruceData, selectedSector]);

  // Evaluate weekly compliance for all collaborators
  const weeklyEvals = useMemo(() => {
    const map = {};
    for (const colab of filteredCruce) {
      map[colab.colaborador.id] = evaluarCumplimientoSemanal(colab.dias);
    }
    return map;
  }, [filteredCruce]);

  const weekLabel = useMemo(() => {
    const start = new Date(dateRange.desde + 'T12:00:00');
    const end = new Date(dateRange.hasta + 'T12:00:00');
    const opts = { day: '2-digit', month: 'short' };
    return `${start.toLocaleDateString('es-AR', opts)} — ${end.toLocaleDateString('es-AR', opts)}, ${end.getFullYear()}`;
  }, [dateRange]);

  if (loading && sectores.length === 0) {
    return (
      <div className="ch">
        <div className="ch-loading">
          <div className="ch-loading__spinner" />
          <span className="ch-loading__text">Cargando Control de Horarios...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ch">
      {/* ─── HERO ─── */}
      <div className="ch-hero">
        <div className="ch-hero__top">
          <div>
            <h1 className="ch-hero__title">⏱️ Control de Horarios</h1>
            <p className="ch-hero__subtitle">
              Gestión y auditoría horaria — Sede Santa Fe · Objetivo: {HORAS_SEMANALES_OBJETIVO}hs semanales (L-J 9h · V 8h · S 4h)
            </p>
          </div>
          <div className="ch-hero__badge">📍 SEDE SANTA FE</div>
        </div>
      </div>

      {/* ─── TABS ─── */}
      <div className="ch-tabs">
        {[
          { id: 'resumen', icon: '📊', label: 'Resumen' },
          { id: 'semanal', icon: '📅', label: 'Vista Semanal' },
          { id: 'fichadas', icon: '⏰', label: 'Fichadas' },
          { id: 'auditoria', icon: '🔍', label: 'Auditoría' },
        ].map(tab => (
          <button key={tab.id} className={`ch-tab ${activeTab === tab.id ? 'ch-tab--active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <span className="ch-tab__icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>❌ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ─── Reglas Card ─── */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', padding: '0.6rem 1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: '0.72rem', color: '#92400e', fontWeight: 600, alignItems: 'center' }}>
        <span>📋 Regla horaria:</span>
        <span style={{ background: '#fef3c7', padding: '0.15rem 0.5rem', borderRadius: 6 }}>L-J: 9h</span>
        <span style={{ background: '#fef3c7', padding: '0.15rem 0.5rem', borderRadius: 6 }}>V: 8h</span>
        <span style={{ background: '#fef3c7', padding: '0.15rem 0.5rem', borderRadius: 6 }}>S: 4h</span>
        <span style={{ background: '#fef3c7', padding: '0.15rem 0.5rem', borderRadius: 6 }}>Semana: 44h</span>
        <span style={{ marginLeft: 'auto', fontWeight: 400, fontStyle: 'italic' }}>Redondeo: 45min = 1h (ej: 3h30m→3h · 3h45m→4h)</span>
      </div>

      {activeTab === 'resumen' && <ResumenView stats={stats} sectorStats={sectorStats} sectores={sectores} selectedSector={selectedSector} onSelectSector={setSelectedSector} cruceData={cruceData} weeklyEvals={weeklyEvals} filteredCruce={filteredCruce} weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />}
      {activeTab === 'semanal' && <SemanalView filteredCruce={filteredCruce} weekDays={weekDays} today={today} weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset} sectores={sectores} selectedSector={selectedSector} onSelectSector={setSelectedSector} weeklyEvals={weeklyEvals} loading={loading} />}
      {activeTab === 'fichadas' && <FichadasView filteredCruce={filteredCruce} weekDays={weekDays} today={today} weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset} sectores={sectores} selectedSector={selectedSector} onSelectSector={setSelectedSector} weeklyEvals={weeklyEvals} onReload={loadData} loading={loading} />}
      {activeTab === 'auditoria' && <AuditoriaView sectorStats={sectorStats} sectores={sectores} cruceData={cruceData} dateRange={dateRange} weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset} weeklyEvals={weeklyEvals} filteredCruce={filteredCruce} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  RESUMEN VIEW
// ═══════════════════════════════════════════════════════════
function ResumenView({ stats, sectorStats, sectores, selectedSector, onSelectSector, cruceData, weeklyEvals, filteredCruce, weekLabel, weekOffset, setWeekOffset }) {
  // Count collaborators who meet the 44h target
  const cumplenSemana = Object.values(weeklyEvals).filter(e => e.cumpleSemana).length;
  const noCumplenSemana = Object.values(weeklyEvals).filter(e => !e.cumpleSemana && e.totalHorasRedondeadas > 0).length;

  return (
    <div style={{ animation: 'chFadeIn 0.3s ease-out' }}>
      <WeekNavigator weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />

      {/* KPIs */}
      <div className="ch-kpis">
        <KpiCard icon="👥" label="Colaboradores" value={stats.totalColaboradores} color="#3B82F6" bg="#dbeafe" />
        <KpiCard icon="🎯" label="Cumplen 44h" value={cumplenSemana} color="#059669" bg="#dcfce7" />
        <KpiCard icon="⚠️" label="No cumplen 44h" value={noCumplenSemana} color="#dc2626" bg="#fef2f2" />
        <KpiCard icon="⏰" label="Tardanzas" value={stats.llegadasTarde} color="#d97706" bg="#fef3c7" />
        <KpiCard icon="❌" label="Ausencias" value={stats.ausencias} color="#dc2626" bg="#fee2e2" />
        <KpiCard icon="📋" label="Sin datos" value={stats.sinDatos} color="#94a3b8" bg="#f8fafc" />
      </div>

      {/* Sector Cards */}
      <div className="ch-sectors">
        {sectores.map(sector => {
          const sStats = sectorStats[sector.nombre];
          const isSelected = selectedSector === sector.nombre;
          return (
            <div key={sector.id} className={`ch-sector-card ${isSelected ? 'ch-sector-card--selected' : ''}`} onClick={() => onSelectSector(isSelected ? null : sector.nombre)}>
              <div className="ch-sector-card__header">
                <div className="ch-sector-card__title-group">
                  <div className="ch-sector-card__dot" style={{ background: sector.color || '#94a3b8' }} />
                  <span className="ch-sector-card__name">{SECTOR_ICONS[sector.nombre] || '📁'} {sector.nombre}</span>
                </div>
                <span className="ch-sector-card__count">{sStats?.totalColaboradores || 0} pers.</span>
              </div>
              <div className="ch-sector-card__body">
                {sStats?.colaboradores?.map(colab => {
                  const wEval = weeklyEvals[colab.colaborador.id];
                  return (
                    <div key={colab.colaborador.id} className="ch-sector-card__member">
                      <div className="ch-sector-card__avatar" style={{ background: sector.color || '#94a3b8' }}>
                        {getInitials(colab.colaborador.nombre_completo)}
                      </div>
                      <span className="ch-sector-card__member-name">{colab.colaborador.nombre_completo}</span>
                      {wEval && <WeeklyBadge eval_={wEval} compact />}
                    </div>
                  );
                }) || (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '0.5rem 0' }}>Sin colaboradores asignados</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SEMANAL VIEW (Timeline with hours)
// ═══════════════════════════════════════════════════════════
function SemanalView({ filteredCruce, weekDays, today, weekLabel, weekOffset, setWeekOffset, sectores, selectedSector, onSelectSector, weeklyEvals, loading }) {
  const [hoveredDay, setHoveredDay] = useState(null);

  return (
    <div style={{ animation: 'chFadeIn 0.3s ease-out' }}>
      <div className="ch-filters">
        <span className="ch-filters__label">🏥 Sector</span>
        <select className="ch-filters__select" value={selectedSector || ''} onChange={e => onSelectSector(e.target.value || null)}>
          <option value="">Todos los sectores</option>
          {sectores.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
        </select>
        <div className="ch-filters__divider" />
        <WeekNavigator weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && <div className="ch-loading"><div className="ch-loading__spinner" /><span className="ch-loading__text">Actualizando datos...</span></div>}

      {!loading && filteredCruce.length === 0 && (
        <div className="ch-empty"><div className="ch-empty__icon">📋</div><h3 className="ch-empty__title">Sin datos para mostrar</h3><p className="ch-empty__desc">No hay colaboradores registrados para el sector y período seleccionado.</p></div>
      )}

      {!loading && filteredCruce.length > 0 && (
        <div className="ch-table-wrapper">
          <div className="ch-table-header">
            <div className="ch-table-header__title">
              📅 Control Semanal de Horas
              {selectedSector && <span className="ch-badge ch-badge--cumplido" style={{ marginLeft: 6 }}>{selectedSector}</span>}
            </div>
            <div className="ch-table-header__actions">
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{filteredCruce.length} colaboradores</span>
            </div>
          </div>

          {/* Week Header with required hours */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 90px', gap: '0.75rem', padding: '0.5rem 0.75rem 0', alignItems: 'end' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Colaborador</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem' }}>
              {weekDays.slice(0, 7).map((day, i) => {
                const d = new Date(day + 'T12:00:00');
                const req = getHorasRequeridas(day);
                return (
                  <div key={day} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{DIAS_SEMANA[i]}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: day === today ? '#1E5FA6' : '#64748b' }}>{d.getDate()}</div>
                    <div style={{ fontSize: '0.58rem', fontWeight: 600, color: '#d97706', background: '#fef3c7', borderRadius: 4, padding: '0 0.2rem', marginTop: 1 }}>
                      {req > 0 ? `${req}h` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Total
              <div style={{ fontSize: '0.62rem', color: '#d97706', background: '#fef3c7', borderRadius: 4, padding: '0 0.2rem', marginTop: 1 }}>obj: {HORAS_SEMANALES_OBJETIVO}h</div>
            </div>
          </div>

          {/* Timeline Rows */}
          <div className="ch-timeline" style={{ padding: '0.5rem 0.75rem 0.75rem' }}>
            {filteredCruce.map(colab => {
              const wEval = weeklyEvals[colab.colaborador.id];
              return (
                <div key={colab.colaborador.id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 90px', gap: '0.75rem', alignItems: 'center', background: 'white', border: `1px solid ${wEval && !wEval.cumpleSemana && wEval.totalHorasRedondeadas > 0 ? '#fecaca' : '#f1f5f9'}`, borderRadius: 10, padding: '0.5rem 0.75rem', transition: 'all 0.15s ease', marginBottom: '0.3rem' }}>
                  {/* Person */}
                  <div className="ch-timeline__person">
                    <div className="ch-timeline__person-avatar" style={{ background: colab.colaborador?.sector?.color || '#94a3b8' }}>
                      {getInitials(colab.colaborador.nombre_completo)}
                    </div>
                    <span className="ch-timeline__person-name">{colab.colaborador.nombre_completo}</span>
                  </div>

                  {/* Day cells */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem' }}>
                    {colab.dias.slice(0, 7).map(dia => {
                      const dayEval = evaluarCumplimientoDiario(dia.fichada, dia.fecha);
                      const isToday = dia.fecha === today;
                      const hasData = dia.fichada && dia.fichada.horas_trabajadas_min > 0;

                      // Determine cell color based on hour compliance
                      let cellBg = '#fafafa';
                      let cellColor = '#d4d4d8';
                      if (!dayEval.esDiaLaboral) {
                        cellBg = '#f1f5f9'; cellColor = '#94a3b8';
                      } else if (hasData && dayEval.cumple) {
                        cellBg = '#dcfce7'; cellColor = '#166534';
                      } else if (hasData && !dayEval.cumple) {
                        cellBg = '#fef2f2'; cellColor = '#991b1b';
                      } else if (dia.estado === 'ausencia') {
                        cellBg = '#fef2f2'; cellColor = '#dc2626';
                      }

                      return (
                        <div
                          key={dia.fecha}
                          style={{
                            textAlign: 'center', padding: '0.3rem 0.15rem', borderRadius: 8,
                            background: cellBg, color: cellColor, position: 'relative', cursor: 'default',
                            outline: isToday ? '2px solid #4D8FCC' : 'none', outlineOffset: -1,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={() => setHoveredDay(`${colab.colaborador.id}_${dia.fecha}`)}
                          onMouseLeave={() => setHoveredDay(null)}
                        >
                          {/* Hours worked (rounded) */}
                          <div style={{ fontSize: '0.82rem', fontWeight: 800, lineHeight: 1.1 }}>
                            {hasData ? `${dayEval.horasRedondeadas}h` : (dayEval.esDiaLaboral ? '—' : 'L')}
                          </div>
                          {/* Deficit warning */}
                          {hasData && !dayEval.cumple && dayEval.esDiaLaboral && (
                            <div style={{ fontSize: '0.52rem', fontWeight: 700, color: '#dc2626', marginTop: 1 }}>
                              -{dayEval.deficit}h
                            </div>
                          )}
                          {/* Real minutes small */}
                          {hasData && (
                            <div style={{ fontSize: '0.5rem', opacity: 0.6, marginTop: 1 }}>
                              {formatMinutosDisplay(dayEval.minutosReales)}
                            </div>
                          )}
                          {/* Tooltip */}
                          {hoveredDay === `${colab.colaborador.id}_${dia.fecha}` && (
                            <div className="ch-tooltip">
                              <div style={{ fontWeight: 700 }}>{getDayName(dia.fecha)} {dia.fecha}</div>
                              {dayEval.esDiaLaboral && <div>Requerido: {dayEval.horasRequeridas}h</div>}
                              {hasData && <>
                                <div>Real: {formatMinutosDisplay(dayEval.minutosReales)}</div>
                                <div>Redondeado: {dayEval.horasRedondeadas}h</div>
                                {!dayEval.cumple && <div style={{ color: '#f87171', fontWeight: 700 }}>⚠ Déficit: -{dayEval.deficit}h</div>}
                                {dayEval.cumple && dayEval.esDiaLaboral && <div style={{ color: '#4ade80' }}>✅ Cumple</div>}
                              </>}
                              {dia.fichada && <div style={{ opacity: 0.8 }}>🟢 {formatTime(dia.fichada.hora_ingreso)} → {formatTime(dia.fichada.hora_egreso)}</div>}
                              {!hasData && dayEval.esDiaLaboral && <div style={{ color: '#f87171' }}>Sin fichada registrada</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Weekly Total */}
                  <WeeklyBadge eval_={wEval} />
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.68rem', color: '#64748b' }}>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: '#dcfce7', marginRight: 4, verticalAlign: 'middle' }}></span> Cumple horas</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: '#fef2f2', marginRight: 4, verticalAlign: 'middle' }}></span> No cumple / Déficit</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: '#f1f5f9', marginRight: 4, verticalAlign: 'middle' }}></span> Día no laboral</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: '#fafafa', border: '1px solid #e5e7eb', marginRight: 4, verticalAlign: 'middle' }}></span> Sin datos</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  FICHADAS VIEW
// ═══════════════════════════════════════════════════════════
function FichadasView({ filteredCruce, weekDays, today, weekLabel, weekOffset, setWeekOffset, sectores, selectedSector, onSelectSector, weeklyEvals, onReload, loading }) {
  const [editingFichada, setEditingFichada] = useState(null);
  const [saving, setSaving] = useState(false);

  const tableData = useMemo(() => {
    const rows = [];
    for (const colab of filteredCruce) {
      for (const dia of colab.dias) {
        if (dia.fichada || dia.diagrama) {
          rows.push({ ...dia, colaborador: colab.colaborador });
        }
      }
    }
    return rows.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [filteredCruce]);

  const handleSaveFichada = async () => {
    if (!editingFichada) return;
    try {
      setSaving(true);
      await guardarFichada({
        colaborador_id: editingFichada.colaborador_id,
        fecha: editingFichada.fecha,
        hora_ingreso: editingFichada.hora_ingreso,
        hora_egreso: editingFichada.hora_egreso,
        fuente: 'manual',
      });
      setEditingFichada(null);
      await onReload();
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ animation: 'chFadeIn 0.3s ease-out' }}>
      <div className="ch-filters">
        <span className="ch-filters__label">🏥 Sector</span>
        <select className="ch-filters__select" value={selectedSector || ''} onChange={e => onSelectSector(e.target.value || null)}>
          <option value="">Todos los sectores</option>
          {sectores.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
        </select>
        <div className="ch-filters__divider" />
        <WeekNavigator weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {/* Edit Modal */}
      {editingFichada && (
        <div className="ch-detail">
          <div className="ch-detail__header">
            <h3 className="ch-detail__title">✏️ Registrar Fichada Manual</h3>
            <button className="ch-detail__close" onClick={() => setEditingFichada(null)}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Colaborador</label>
              <input type="text" value={editingFichada.nombre || ''} disabled className="ch-filters__input" style={{ width: '100%', opacity: 0.7 }} />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Ingreso</label>
              <input type="time" value={editingFichada.hora_ingreso || ''} onChange={e => setEditingFichada({ ...editingFichada, hora_ingreso: e.target.value })} className="ch-filters__input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Egreso</label>
              <input type="time" value={editingFichada.hora_egreso || ''} onChange={e => setEditingFichada({ ...editingFichada, hora_egreso: e.target.value })} className="ch-filters__input" style={{ width: '100%' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="ch-btn ch-btn--secondary" onClick={() => setEditingFichada(null)}>Cancelar</button>
            <button className="ch-btn ch-btn--primary" onClick={handleSaveFichada} disabled={saving}>{saving ? '⏳ Guardando...' : '💾 Guardar Fichada'}</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="ch-table-wrapper">
        <div className="ch-table-header">
          <div className="ch-table-header__title">⏰ Registro de Fichadas</div>
          <div className="ch-table-header__actions"><span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{tableData.length} registros</span></div>
        </div>

        {loading ? (
          <div className="ch-loading"><div className="ch-loading__spinner" /><span className="ch-loading__text">Cargando fichadas...</span></div>
        ) : tableData.length === 0 ? (
          <div className="ch-empty"><div className="ch-empty__icon">⏰</div><h3 className="ch-empty__title">Sin fichadas registradas</h3><p className="ch-empty__desc">No hay registros para el período y sector seleccionado.</p></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ch-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Colaborador</th>
                  <th>Sector</th>
                  <th>Ingreso</th>
                  <th>Egreso</th>
                  <th>Real</th>
                  <th>Redond.</th>
                  <th>Requer.</th>
                  <th>Cumple</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, idx) => {
                  const sectorColor = row.colaborador?.sector?.color || '#94a3b8';
                  const dayEval = evaluarCumplimientoDiario(row.fichada, row.fecha);
                  const hasData = row.fichada && row.fichada.horas_trabajadas_min > 0;

                  return (
                    <tr key={`${row.colaborador.id}_${row.fecha}_${idx}`} style={{ background: hasData && !dayEval.cumple && dayEval.esDiaLaboral ? '#fef2f2' : undefined }}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{formatDate(row.fecha)}</div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{getDayName(row.fecha)}</div>
                      </td>
                      <td>
                        <div className="ch-table__colab-cell">
                          <div className="ch-table__colab-avatar" style={{ background: sectorColor }}>{getInitials(row.colaborador.nombre_completo)}</div>
                          <span className="ch-table__colab-name">{row.colaborador.nombre_completo}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 6, background: sectorColor + '18', color: sectorColor }}>
                          {row.colaborador?.sector?.nombre || '—'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, fontFamily: "'Consolas', monospace", fontSize: '0.85rem' }}>
                        {row.fichada ? formatTime(row.fichada.hora_ingreso) : '—'}
                      </td>
                      <td style={{ fontWeight: 600, fontFamily: "'Consolas', monospace", fontSize: '0.85rem' }}>
                        {row.fichada ? formatTime(row.fichada.hora_egreso) : '—'}
                      </td>
                      {/* Real minutes */}
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {hasData ? formatMinutosDisplay(dayEval.minutosReales) : '—'}
                      </td>
                      {/* Rounded hours */}
                      <td>
                        {hasData ? (
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: dayEval.cumple || !dayEval.esDiaLaboral ? '#059669' : '#dc2626' }}>
                            {dayEval.horasRedondeadas}h
                          </span>
                        ) : '—'}
                      </td>
                      {/* Required hours */}
                      <td style={{ fontWeight: 600, fontSize: '0.82rem', color: '#d97706' }}>
                        {dayEval.esDiaLaboral ? `${dayEval.horasRequeridas}h` : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      {/* Compliance */}
                      <td>
                        {hasData && dayEval.esDiaLaboral ? (
                          dayEval.cumple ? (
                            <span className="ch-badge ch-badge--cumplido">✅ Sí</span>
                          ) : (
                            <span className="ch-badge ch-badge--ausencia">⚠ -{dayEval.deficit}h</span>
                          )
                        ) : (
                          !dayEval.esDiaLaboral ? <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>N/A</span> : <span className="ch-badge ch-badge--sin-datos">—</span>
                        )}
                      </td>
                      <td>
                        <button className="ch-btn ch-btn--secondary ch-btn--sm" onClick={() => setEditingFichada({
                          colaborador_id: row.colaborador.id, nombre: row.colaborador.nombre_completo,
                          fecha: row.fecha, hora_ingreso: row.fichada?.hora_ingreso?.slice(0, 5) || '', hora_egreso: row.fichada?.hora_egreso?.slice(0, 5) || '',
                        })}>✏️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Weekly Summary per collaborator */}
      {filteredCruce.length > 0 && (
        <div className="ch-table-wrapper" style={{ marginTop: '1rem' }}>
          <div className="ch-table-header">
            <div className="ch-table-header__title">📊 Resumen Semanal — Objetivo {HORAS_SEMANALES_OBJETIVO}h</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ch-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Sector</th>
                  <th style={{ textAlign: 'center' }}>Hs Redondeadas</th>
                  <th style={{ textAlign: 'center' }}>Objetivo</th>
                  <th style={{ textAlign: 'center' }}>Diferencia</th>
                  <th style={{ textAlign: 'center' }}>Cumple 44h</th>
                  <th style={{ textAlign: 'center' }}>Barra</th>
                </tr>
              </thead>
              <tbody>
                {filteredCruce.map(colab => {
                  const wEval = weeklyEvals[colab.colaborador.id];
                  if (!wEval) return null;
                  const sColor = colab.colaborador?.sector?.color || '#94a3b8';
                  return (
                    <tr key={colab.colaborador.id} style={{ background: !wEval.cumpleSemana && wEval.totalHorasRedondeadas > 0 ? '#fef2f2' : undefined }}>
                      <td>
                        <div className="ch-table__colab-cell">
                          <div className="ch-table__colab-avatar" style={{ background: sColor }}>{getInitials(colab.colaborador.nombre_completo)}</div>
                          <span className="ch-table__colab-name">{colab.colaborador.nombre_completo}</span>
                        </div>
                      </td>
                      <td><span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 6, background: sColor + '18', color: sColor }}>{colab.colaborador?.sector?.nombre || '—'}</span></td>
                      <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: wEval.cumpleSemana ? '#059669' : '#dc2626' }}>
                        {wEval.totalHorasRedondeadas}h
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#d97706' }}>{wEval.objetivo}h</td>
                      <td style={{ textAlign: 'center' }}>
                        {wEval.cumpleSemana ? (
                          wEval.excedenteSemanal > 0 ? <span style={{ color: '#059669', fontWeight: 700 }}>+{wEval.excedenteSemanal}h</span> : <span style={{ color: '#059669', fontWeight: 700 }}>= OK</span>
                        ) : (
                          <span style={{ color: '#dc2626', fontWeight: 800, fontSize: '0.9rem' }}>-{wEval.deficitSemanal}h</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {wEval.cumpleSemana
                          ? <span className="ch-badge ch-badge--cumplido" style={{ fontWeight: 700 }}>✅ SÍ</span>
                          : <span className="ch-badge ch-badge--ausencia" style={{ fontWeight: 700 }}>❌ NO</span>
                        }
                      </td>
                      <td style={{ width: 150 }}>
                        <ProgressBar pct={wEval.porcentajeSemanal} cumple={wEval.cumpleSemana} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  AUDITORÍA VIEW
// ═══════════════════════════════════════════════════════════
function AuditoriaView({ sectorStats, sectores, cruceData, dateRange, weekLabel, weekOffset, setWeekOffset, weeklyEvals, filteredCruce }) {
  return (
    <div style={{ animation: 'chFadeIn 0.3s ease-out' }}>
      <WeekNavigator weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />

      {/* Global KPIs */}
      <div className="ch-detail" style={{ marginBottom: '1.25rem' }}>
        <div className="ch-detail__header">
          <h3 className="ch-detail__title">🔍 Auditoría Horaria — Sede Santa Fe</h3>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Período: {dateRange.desde} al {dateRange.hasta}</span>
        </div>
        <div className="ch-kpis" style={{ marginBottom: 0 }}>
          <KpiCard icon="🎯" label={`Cumplen ${HORAS_SEMANALES_OBJETIVO}h`} value={Object.values(weeklyEvals).filter(e => e.cumpleSemana).length} color="#059669" bg="#dcfce7" />
          <KpiCard icon="⚠️" label={`No cumplen ${HORAS_SEMANALES_OBJETIVO}h`} value={Object.values(weeklyEvals).filter(e => !e.cumpleSemana && e.totalHorasRedondeadas > 0).length} color="#dc2626" bg="#fef2f2" />
          <KpiCard icon="📊" label="Sin registros" value={Object.values(weeklyEvals).filter(e => e.totalHorasRedondeadas === 0).length} color="#94a3b8" bg="#f8fafc" />
        </div>
      </div>

      {/* Per-Sector */}
      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>📋 Detalle por Sector</h3>

      {sectores.map(sector => {
        const sStats = sectorStats[sector.nombre];
        if (!sStats) return null;

        return (
          <div key={sector.id} className="ch-audit-card">
            <div className="ch-audit-card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="ch-audit-card__sector-badge" style={{ background: sector.color + '18', color: sector.color }}>
                  {SECTOR_ICONS[sector.nombre] || '📁'} {sector.nombre}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{sStats.totalColaboradores} personas</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="ch-table" style={{ fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th style={{ textAlign: 'center' }}>Lun</th>
                    <th style={{ textAlign: 'center' }}>Mar</th>
                    <th style={{ textAlign: 'center' }}>Mié</th>
                    <th style={{ textAlign: 'center' }}>Jue</th>
                    <th style={{ textAlign: 'center' }}>Vie</th>
                    <th style={{ textAlign: 'center' }}>Sáb</th>
                    <th style={{ textAlign: 'center' }}>Dom</th>
                    <th style={{ textAlign: 'center', fontWeight: 800 }}>TOTAL</th>
                    <th style={{ textAlign: 'center' }}>44h?</th>
                  </tr>
                </thead>
                <tbody>
                  {sStats.colaboradores.map(colab => {
                    const wEval = weeklyEvals[colab.colaborador.id];
                    if (!wEval) return null;

                    return (
                      <tr key={colab.colaborador.id} style={{ background: !wEval.cumpleSemana && wEval.totalHorasRedondeadas > 0 ? '#fef2f2' : undefined }}>
                        <td>
                          <div className="ch-table__colab-cell">
                            <div className="ch-table__colab-avatar" style={{ background: sector.color, width: 26, height: 26, fontSize: '0.58rem' }}>
                              {getInitials(colab.colaborador.nombre_completo)}
                            </div>
                            <span className="ch-table__colab-name" style={{ fontSize: '0.8rem' }}>{colab.colaborador.nombre_completo}</span>
                          </div>
                        </td>
                        {/* Daily hours cells */}
                        {wEval.detalleDias.slice(0, 7).map((dEval, i) => {
                          const hasData = dEval.minutosReales > 0;
                          let cellColor = '#94a3b8';
                          let cellBg = 'transparent';
                          if (!dEval.esDiaLaboral) {
                            cellColor = '#cbd5e1';
                          } else if (hasData && dEval.cumple) {
                            cellColor = '#059669'; cellBg = '#dcfce7';
                          } else if (hasData && !dEval.cumple) {
                            cellColor = '#dc2626'; cellBg = '#fef2f2';
                          }

                          return (
                            <td key={i} style={{ textAlign: 'center', fontWeight: 700, color: cellColor, background: cellBg, fontSize: '0.82rem' }}>
                              {hasData ? (
                                <div>
                                  {dEval.horasRedondeadas}h
                                  {!dEval.cumple && dEval.esDiaLaboral && (
                                    <div style={{ fontSize: '0.58rem', color: '#dc2626', fontWeight: 800 }}>-{dEval.deficit}h</div>
                                  )}
                                </div>
                              ) : dEval.esDiaLaboral ? '—' : <span style={{ fontSize: '0.65rem' }}>L</span>}
                            </td>
                          );
                        })}
                        {/* Weekly total */}
                        <td style={{ textAlign: 'center', fontWeight: 900, fontSize: '0.95rem', color: wEval.cumpleSemana ? '#059669' : '#dc2626' }}>
                          {wEval.totalHorasRedondeadas}h
                          {!wEval.cumpleSemana && wEval.totalHorasRedondeadas > 0 && (
                            <div style={{ fontSize: '0.58rem', color: '#dc2626' }}>-{wEval.deficitSemanal}h</div>
                          )}
                        </td>
                        {/* Pass/Fail */}
                        <td style={{ textAlign: 'center' }}>
                          {wEval.totalHorasRedondeadas === 0 ? (
                            <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>—</span>
                          ) : wEval.cumpleSemana ? (
                            <span style={{ fontSize: '1.1rem' }}>✅</span>
                          ) : (
                            <span style={{ fontSize: '1.1rem' }}>❌</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════

function KpiCard({ icon, label, value, color, bg }) {
  return (
    <div className="ch-kpi">
      <div className="ch-kpi__icon" style={{ background: bg || '#f1f5f9', color }}>{icon}</div>
      <div>
        <div className="ch-kpi__value" style={{ color }}>{value}</div>
        <div className="ch-kpi__label">{label}</div>
      </div>
    </div>
  );
}

function WeekNavigator({ weekLabel, weekOffset, setWeekOffset }) {
  return (
    <div className="ch-week-nav" style={{ marginBottom: '1rem' }}>
      <button className="ch-week-nav__btn" onClick={() => setWeekOffset(weekOffset - 1)}>‹</button>
      <span className="ch-week-nav__label">{weekLabel}</span>
      <button className="ch-week-nav__btn" onClick={() => setWeekOffset(weekOffset + 1)}>›</button>
      {weekOffset !== 0 && <button className="ch-btn ch-btn--secondary ch-btn--sm" onClick={() => setWeekOffset(0)}>Hoy</button>}
    </div>
  );
}

function WeeklyBadge({ eval_: wEval, compact = false }) {
  if (!wEval) return null;
  const { totalHorasRedondeadas, objetivo, cumpleSemana, deficitSemanal, porcentajeSemanal } = wEval;

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span style={{
          fontWeight: 800, fontSize: '0.72rem',
          color: totalHorasRedondeadas === 0 ? '#94a3b8' : cumpleSemana ? '#059669' : '#dc2626',
          padding: '0.1rem 0.4rem', borderRadius: 6,
          background: totalHorasRedondeadas === 0 ? '#f8fafc' : cumpleSemana ? '#dcfce7' : '#fef2f2',
        }}>
          {totalHorasRedondeadas}h/{objetivo}h
        </span>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontWeight: 900, fontSize: '0.95rem', color: totalHorasRedondeadas === 0 ? '#94a3b8' : cumpleSemana ? '#059669' : '#dc2626', lineHeight: 1.1 }}>
        {totalHorasRedondeadas}h
      </div>
      <div style={{ fontSize: '0.55rem', color: '#94a3b8' }}>/{objetivo}h</div>
      {!cumpleSemana && totalHorasRedondeadas > 0 && (
        <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#dc2626', marginTop: 1 }}>-{deficitSemanal}h</div>
      )}
      {cumpleSemana && totalHorasRedondeadas > 0 && (
        <div style={{ fontSize: '0.55rem', color: '#059669', marginTop: 1 }}>✓</div>
      )}
    </div>
  );
}

function ProgressBar({ pct, cumple }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <div style={{ flex: 1, height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4, transition: 'width 0.5s ease',
          width: `${Math.min(pct, 100)}%`,
          background: cumple ? '#22c55e' : pct >= 75 ? '#f59e0b' : '#ef4444',
        }} />
      </div>
      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: cumple ? '#059669' : '#dc2626', minWidth: 32, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  );
}
