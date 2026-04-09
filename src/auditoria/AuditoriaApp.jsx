import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './auditoria.css';
import { useAuth } from '../components/AuthGate';

// Map known user emails to readable auditor names
const USER_DISPLAY_NAMES = {
  'mjameson@sanatorioargentino.com': 'M. Jameson',
  'rmarun@sanatorioargentino.com': 'R. Marún',
  'lpetit@sanatorioargentino.com': 'L. Petit',
};

function getAuditorName(user) {
  if (!user) return '';
  const email = user.email?.toLowerCase();
  if (USER_DISPLAY_NAMES[email]) return USER_DISPLAY_NAMES[email];
  // Fallback: use part before @ capitalized
  const localPart = email?.split('@')[0] || '';
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}
import {
  SECTORES,
  CHECKLIST_TEMPLATE,
  AUXILIARES_HOTELERIA,
  MAX_PUNTOS,
  calcularResultado,
  crearAuditoria,
  obtenerAuditorias,
  obtenerAuditoriaCompleta,
  obtenerPlanesAnteriores,
  actualizarEstadoPlan,
  obtenerColaboradoresPorArea,
  obtenerTodosColaboradores,
} from './auditoriaService';
import EstadisticasSedePanel from './EstadisticasSedePanel';
import ReporteDiario from './ReporteDiario';
import ControlHorarioApp from '../controlhorario/ControlHorarioApp';

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function AuditoriaApp(props) {
  const { user } = useAuth();
  const [view, setView] = useState('home'); // home | new | detail | stats
  const [selectedAudit, setSelectedAudit] = useState(null);

  const handleNewAudit = () => setView('new');
  const handleViewAudit = async (id) => {
    try {
      const audit = await obtenerAuditoriaCompleta(id);
      setSelectedAudit(audit);
      setView('detail');
    } catch (e) {
      console.error('Error loading audit:', e);
    }
  };
  const handleBack = () => {
    setView('home');
    setSelectedAudit(null);
  };

  return (
    <div className="aud-app">
      {/* HEADER — Only show when standalone (not embedded in hub) */}
      {!props.embedded && (
        <header className="aud-header">
          {view !== 'home' && (
            <button className="aud-header-btn" onClick={handleBack}>
              ← Volver
            </button>
          )}
          <img src="/logosanatorio.png" alt="SA" />
          <div className="aud-header-text">
            <h1>Seguimiento y Acompañamiento de Sede</h1>
            <span>Sede Santa Fe</span>
          </div>
          {view === 'home' && (
            <div className="aud-header-actions">
              <button className="aud-header-btn primary" onClick={handleNewAudit}>
                ✚ Nueva
              </button>
            </div>
          )}
        </header>
      )}

      {/* Embedded sub-nav bar */}
      {props.embedded && view !== 'home' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--neutral-200, #E2E8F0)',
          background: 'white',
        }}>
          <button className="aud-header-btn" onClick={handleBack}>
            ← Volver
          </button>
        </div>
      )}

      {/* Embedded top actions */}
      {props.embedded && (view === 'home' || view === 'stats') && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--neutral-200, #E2E8F0)',
          background: 'white',
        }}>
          <div style={{ display: 'flex', gap: '0' }}>
            {[
              { id: 'home', icon: '📋', label: 'Seguimiento' },
              { id: 'stats', icon: '📊', label: 'Estadísticas' },
              { id: 'controlhorario', icon: '⏰', label: 'Control de Horarios' },
            ].map(tab => (
              <button key={tab.id}
                onClick={() => { setView(tab.id); setSelectedAudit(null); }}
                style={{
                  padding: '0.5rem 1rem', border: 'none', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: 600, background: 'none',
                  borderBottom: (view === tab.id || (tab.id === 'home' && (view === 'new' || view === 'detail')))
                    ? '2px solid var(--primary-500, #1E5FA6)' : '2px solid transparent',
                  color: (view === tab.id || (tab.id === 'home' && (view === 'new' || view === 'detail')))
                    ? 'var(--primary-500, #1E5FA6)' : '#94a3b8',
                  transition: 'all 0.2s',
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          {(view === 'home') && (
            <button className="aud-header-btn primary" onClick={handleNewAudit}
              style={{
                padding: '0.5rem 1rem', borderRadius: '8px',
                background: 'var(--primary-500, #1E5FA6)', color: 'white',
                fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer',
              }}>
              ✚ Nueva Auditoría
            </button>
          )}
        </div>
      )}

      {/* BODY */}
      {view === 'home' && <HomeView onNew={handleNewAudit} onView={handleViewAudit} />}
      {view === 'new' && <NewAuditView onSaved={handleBack} currentUser={user} />}
      {view === 'detail' && selectedAudit && <DetailView audit={selectedAudit} />}
      {view === 'stats' && (
        <div className="aud-content aud-content-wide aud-animate-in">
          <EstadisticasSedePanel />
        </div>
      )}
      {view === 'control' && (
        <div className="aud-content aud-content-wide aud-animate-in">
          <ControlHorarioApp onBack={() => setView('home')} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOME VIEW — History list grouped by day
// ═══════════════════════════════════════════════════════════════
function HomeView({ onNew, onView }) {
  const [auditorias, setAuditorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSector, setFilterSector] = useState('');
  const [reporteFecha, setReporteFecha] = useState(null);
  const [reporteAuditorias, setReporteAuditorias] = useState([]);

  useEffect(() => {
    loadAudits();
  }, [filterSector]);

  const loadAudits = async () => {
    setLoading(true);
    try {
      const data = await obtenerAuditorias(filterSector ? { sector: filterSector } : {});
      setAuditorias(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Group audits by date
  const groupedByDay = useMemo(() => {
    const groups = {};
    auditorias.forEach(a => {
      if (!groups[a.fecha]) groups[a.fecha] = [];
      groups[a.fecha].push(a);
    });
    // Sort by date desc
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([fecha, items]) => ({
        fecha,
        auditorias: items,
        auditores: [...new Set(items.map(a => a.auditor_nombre))],
        promedio: Math.round(items.reduce((s, a) => s + a.porcentaje, 0) / items.length * 100) / 100,
        evaluacionGlobal: (() => {
          const avg = items.reduce((s, a) => s + a.porcentaje, 0) / items.length;
          return avg >= 85 ? 'bueno' : avg >= 60 ? 'regular' : 'critico';
        })(),
      }));
  }, [auditorias]);

  const getEvalColor = (ev) => {
    if (ev === 'bueno') return 'var(--aud-success)';
    if (ev === 'regular') return 'var(--aud-warning)';
    return 'var(--aud-danger)';
  };

  const formatFecha = (f) => {
    const d = new Date(f + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatFechaShort = (f) => {
    const d = new Date(f + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleOpenReport = (fecha, auditorias) => {
    setReporteFecha(fecha);
    setReporteAuditorias(auditorias);
  };

  // If a report is open, show it
  if (reporteFecha) {
    return (
      <div className="aud-content aud-animate-in" style={{ padding: '1rem 1.5rem' }}>
        <ReporteDiario
          fecha={reporteFecha}
          auditorias={reporteAuditorias}
          onClose={() => { setReporteFecha(null); setReporteAuditorias([]); }}
        />
      </div>
    );
  }

  return (
    <div className="aud-content aud-animate-in">
      <div className="aud-section-title">Historial de Auditorías</div>
      <div className="aud-section-subtitle">Revisá las auditorías anteriores agrupadas por día</div>

      <div className="aud-field">
        <select
          className="aud-select"
          value={filterSector}
          onChange={(e) => setFilterSector(e.target.value)}
        >
          <option value="">Todos los sectores</option>
          {SECTORES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="aud-empty">
          <div className="aud-empty-icon">⏳</div>
          <p>Cargando auditorías...</p>
        </div>
      ) : auditorias.length === 0 ? (
        <div className="aud-empty">
          <div className="aud-empty-icon">📋</div>
          <h3>Sin auditorías</h3>
          <p>Comenzá creando la primera auditoría del sector</p>
          <button className="aud-btn aud-btn-primary" style={{ marginTop: '1rem' }} onClick={onNew}>
            ✚ Nueva Auditoría
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {groupedByDay.map(group => (
            <div key={group.fecha} style={{
              background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
              overflow: 'hidden', transition: 'all 0.2s',
            }}>
              {/* Day Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem', background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: 'linear-gradient(135deg, #1E5FA6, #0284c7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 900, fontSize: '0.85rem', flexShrink: 0,
                  }}>
                    {new Date(group.fecha + 'T12:00:00').getDate()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', textTransform: 'capitalize' }}>
                      {formatFecha(group.fecha)}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {group.auditorias.length} auditoría{group.auditorias.length > 1 ? 's' : ''}
                      </span>
                      <span style={{ color: '#e2e8f0' }}>·</span>
                      {group.auditores.map(aud => (
                        <span key={aud} style={{
                          fontSize: '0.68rem', fontWeight: 700,
                          padding: '0.1rem 0.45rem', borderRadius: 6,
                          background: '#eff6ff', color: '#1E5FA6',
                          border: '1px solid #bfdbfe',
                        }}>
                          👤 {aud}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, fontSize: '1.2rem', color: getEvalColor(group.evaluacionGlobal) }}>
                      {group.promedio}%
                    </div>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700,
                      padding: '0.1rem 0.4rem', borderRadius: 4,
                      background: group.evaluacionGlobal === 'bueno' ? '#dcfce7'
                        : group.evaluacionGlobal === 'regular' ? '#fef3c7' : '#fef2f2',
                      color: group.evaluacionGlobal === 'bueno' ? '#166534'
                        : group.evaluacionGlobal === 'regular' ? '#92400e' : '#991b1b',
                    }}>
                      {group.evaluacionGlobal === 'bueno' ? '✓ BUENO' : group.evaluacionGlobal === 'regular' ? '⚠ REGULAR' : '✗ CRÍTICO'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenReport(group.fecha, group.auditorias); }}
                    style={{
                      padding: '0.4rem 0.75rem', borderRadius: 8,
                      border: '1px solid #e2e8f0', background: 'white',
                      cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                      color: '#1E5FA6', transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#1E5FA6'; e.currentTarget.style.color = 'white'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#1E5FA6'; }}
                  >
                    📊 Ver Reporte
                  </button>
                </div>
              </div>

              {/* Audits list */}
              <div style={{ padding: '0.25rem 0' }}>
                {group.auditorias.map(a => {
                  const sectorLabel = SECTORES.find(s => s.value === a.sector)?.label || a.sector;
                  return (
                    <div
                      key={a.id}
                      className="aud-slide-up"
                      onClick={() => onView(a.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.65rem 1rem', cursor: 'pointer',
                        borderBottom: '1px solid #f8fafc',
                        transition: 'background 0.1s',
                      }}
                      onMouseOver={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: 6, height: 32, borderRadius: 3,
                          background: getEvalColor(a.evaluacion),
                        }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>{sectorLabel}</div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            Turno {a.turno} · {a.auditor_nombre}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: getEvalColor(a.evaluacion) }}>
                          {a.porcentaje}%
                        </span>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700,
                          padding: '0.1rem 0.4rem', borderRadius: 4,
                          background: a.evaluacion === 'bueno' ? '#dcfce7'
                            : a.evaluacion === 'regular' ? '#fef3c7' : '#fef2f2',
                          color: a.evaluacion === 'bueno' ? '#166534'
                            : a.evaluacion === 'regular' ? '#92400e' : '#991b1b',
                        }}>
                          {a.evaluacion === 'bueno' ? '✓' : a.evaluacion === 'regular' ? '⚠' : '✗'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NEW AUDIT VIEW — 6-step wizard
// ═══════════════════════════════════════════════════════════════
function NewAuditView({ onSaved, currentUser }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Section 1: General Data
  const [general, setGeneral] = useState({
    fecha: new Date().toISOString().split('T')[0],
    turno: 'mañana',
    sede: 'Santa Fe',
    sector: '',
    responsable_presente: '',
    auxiliar_hoteleria: '',
    auditor_nombre: getAuditorName(currentUser),
  });

  // Section 2: Checklist items
  const [items, setItems] = useState(() => {
    const initial = {};
    CHECKLIST_TEMPLATE.forEach(cat => {
      cat.items.forEach(item => {
        initial[item.key] = {
          categoria: cat.categoria,
          label: item.label,
          puntuacion: null,
          observaciones: '',
        };
      });
    });
    return initial;
  });

  // Section 4: Findings
  const [hallazgos, setHallazgos] = useState({
    no_conformidades: '',
    oportunidades_mejora: '',
  });

  // Section 5: Action Plans
  const [planes, setPlanes] = useState([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [newPlan, setNewPlan] = useState({
    hallazgo: '', prioridad: 'media', accion: '', responsable: '', fecha_limite: '',
  });

  // Section 6: Previous Plans
  const [planesAnteriores, setPlanesAnteriores] = useState([]);
  const [loadingPrevPlans, setLoadingPrevPlans] = useState(false);

  // Collaborators for autocomplete
  const [colaboradores, setColaboradores] = useState([]);

  // ─── Score Calculation (Real-time) ──────────────────────
  const score = useMemo(() => calcularResultado(items), [items]);

  const allItemsAnswered = useMemo(
    () => Object.values(items).every(i => i.puntuacion !== null),
    [items]
  );

  // ─── Load previous plans when sector changes ──────────
  // Load ALL collaborators on mount for search pickers
  useEffect(() => {
    obtenerTodosColaboradores()
      .then(setColaboradores)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (general.sector) {
      setLoadingPrevPlans(true);
      obtenerPlanesAnteriores(general.sector)
        .then(setPlanesAnteriores)
        .catch(console.error)
        .finally(() => setLoadingPrevPlans(false));
    }
  }, [general.sector]);

  // ─── Step Definitions ──────────────────────────────────
  const STEPS = [
    { label: 'Datos', icon: '📝' },
    { label: 'Checklist', icon: '✅' },
    { label: 'Resultado', icon: '📊' },
    { label: 'Hallazgos', icon: '🔍' },
    { label: 'Acciones', icon: '🎯' },
    { label: 'Seguimiento', icon: '🔄' },
  ];

  const canProceed = () => {
    if (step === 0) return general.sector && general.auditor_nombre;
    if (step === 1) return allItemsAnswered;
    return true;
  };

  // ─── Save Audit ────────────────────────────────────────
  const handleSave = async () => {
    if (!general.sector || !general.auditor_nombre) {
      showToast('⚠ Completá los datos generales');
      return;
    }

    setSaving(true);
    try {
      await crearAuditoria(
        {
          ...general,
          total_puntos: score.total,
          porcentaje: score.porcentaje,
          evaluacion: score.evaluacion,
          ...hallazgos,
        },
        items,
        planes
      );
      showToast('✅ Auditoría guardada correctamente');
      setTimeout(onSaved, 1500);
    } catch (e) {
      console.error('Save error:', e);
      showToast('❌ Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const updateItem = (key, field, value) => {
    setItems(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const addPlan = () => {
    if (!newPlan.hallazgo || !newPlan.accion || !newPlan.responsable) {
      showToast('⚠ Completá hallazgo, acción y responsable');
      return;
    }
    setPlanes(prev => [...prev, { ...newPlan }]);
    setNewPlan({ hallazgo: '', prioridad: 'media', accion: '', responsable: '', fecha_limite: '' });
    setShowPlanForm(false);
  };

  const removePlan = (idx) => {
    setPlanes(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePrevPlanStatus = async (planId, estado) => {
    try {
      await actualizarEstadoPlan(planId, estado);
      setPlanesAnteriores(prev =>
        prev.map(p => p.id === planId ? { ...p, estado } : p)
      );
      showToast(`Estado actualizado: ${estado.replace('_', ' ')}`);
    } catch (e) {
      console.error('Status update error:', e);
      showToast('❌ Error al actualizar');
    }
  };

  return (
    <>
      {/* STEP NAV */}
      <div className="aud-steps">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className={`aud-step ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}
            onClick={() => setStep(i)}
          >
            <span className="aud-step-num">
              {i < step ? '✓' : s.icon}
            </span>
            {s.label}
          </div>
        ))}
      </div>

      {/* CONTENT */}
      <div className="aud-content aud-animate-in" key={step}>
        {step === 0 && (
          <StepDatosGenerales
            general={general}
            setGeneral={setGeneral}
            colaboradores={colaboradores}
          />
        )}
        {step === 1 && (
          <StepChecklist items={items} updateItem={updateItem} score={score} />
        )}
        {step === 2 && (
          <StepResultado score={score} items={items} />
        )}
        {step === 3 && (
          <StepHallazgos hallazgos={hallazgos} setHallazgos={setHallazgos} />
        )}
        {step === 4 && (
          <StepPlanesAccion
            planes={planes}
            showPlanForm={showPlanForm}
            setShowPlanForm={setShowPlanForm}
            newPlan={newPlan}
            setNewPlan={setNewPlan}
            addPlan={addPlan}
            removePlan={removePlan}
            colaboradores={colaboradores}
          />
        )}
        {step === 5 && (
          <StepSeguimiento
            planesAnteriores={planesAnteriores}
            loading={loadingPrevPlans}
            onUpdateStatus={handlePrevPlanStatus}
          />
        )}
      </div>

      {/* BOTTOM BAR */}
      <div className="aud-bottom-bar">
        {step > 0 && (
          <button className="aud-btn aud-btn-secondary" onClick={() => setStep(step - 1)}>
            ← Anterior
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            className="aud-btn aud-btn-primary"
            disabled={!canProceed()}
            onClick={() => setStep(step + 1)}
          >
            Siguiente →
          </button>
        ) : (
          <button
            className="aud-btn aud-btn-success"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? '⏳ Guardando...' : '💾 Guardar Auditoría'}
          </button>
        )}
      </div>

      {/* TOAST */}
      {toast && <div className="aud-toast">{toast}</div>}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 1: DATOS GENERALES
// ═══════════════════════════════════════════════════════════════
function StepDatosGenerales({ general, setGeneral, colaboradores }) {
  const update = (key, value) => setGeneral(prev => ({ ...prev, [key]: value }));
  const [respSearch, setRespSearch] = useState('');

  // Parse responsables from comma-separated string
  const responsables = general.responsable_presente
    ? general.responsable_presente.split('|||').filter(Boolean)
    : [];

  const addResponsable = (nombre) => {
    if (responsables.length >= 2) return;
    if (responsables.includes(nombre)) return;
    const updated = [...responsables, nombre].join('|||');
    update('responsable_presente', updated);
    setRespSearch('');
  };

  const removeResponsable = (nombre) => {
    const updated = responsables.filter(r => r !== nombre).join('|||');
    update('responsable_presente', updated);
  };

  return (
    <div>
      <div className="aud-section-title">1. Datos Generales</div>
      <div className="aud-section-subtitle">Completá la información de la ronda de auditoría</div>

      <div className="aud-card">
        <div className="aud-row">
          <div className="aud-field">
            <label className="aud-label">Fecha</label>
            <input
              type="date"
              className="aud-input"
              value={general.fecha}
              onChange={e => update('fecha', e.target.value)}
            />
          </div>
          <div className="aud-field">
            <label className="aud-label">Turno</label>
            <select className="aud-select" value={general.turno} onChange={e => update('turno', e.target.value)}>
              <option value="mañana">Mañana</option>
              <option value="tarde">Tarde</option>
            </select>
          </div>
        </div>

        <div className="aud-field">
          <label className="aud-label">Sector *</label>
          <select
            className="aud-select"
            value={general.sector}
            onChange={e => update('sector', e.target.value)}
          >
            <option value="">Seleccionar sector...</option>
            {SECTORES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="aud-field">
          <label className="aud-label">Responsables presentes (máx 2)</label>

          {/* Selected responsables as pills */}
          {responsables.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.45rem',
            }}>
              {responsables.map(r => (
                <span key={r} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.3rem 0.65rem', borderRadius: '20px',
                  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                  border: '1px solid #bfdbfe', fontSize: '0.82rem',
                  fontWeight: 600, color: '#1e40af',
                }}>
                  👤 {r}
                  <button onClick={() => removeResponsable(r)} style={{
                    border: 'none', background: 'none', cursor: 'pointer',
                    color: '#93c5fd', fontSize: '0.75rem', padding: '0 2px',
                    lineHeight: 1, transition: 'color 0.15s',
                  }}
                    onMouseOver={e => e.currentTarget.style.color = '#dc2626'}
                    onMouseOut={e => e.currentTarget.style.color = '#93c5fd'}
                  >✕</button>
                </span>
              ))}
            </div>
          )}

          {/* Search input */}
          {responsables.length < 2 && (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="aud-input"
                placeholder="🔍 Buscar responsable por nombre..."
                value={respSearch}
                onChange={e => setRespSearch(e.target.value)}
                style={{ marginBottom: 0 }}
              />
              {respSearch.trim() && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  background: 'white', borderRadius: '0 0 10px 10px',
                  border: '1px solid #e2e8f0', borderTop: 'none',
                  maxHeight: '180px', overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                }}>
                  {colaboradores
                    .filter(c =>
                      !responsables.includes(c.nombre_completo) &&
                      c.nombre_completo.toLowerCase().includes(respSearch.toLowerCase())
                    )
                    .slice(0, 12)
                    .map(c => (
                      <div key={c.id}
                        onClick={() => addResponsable(c.nombre_completo)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.5rem 0.75rem', cursor: 'pointer',
                          fontSize: '0.85rem', borderBottom: '1px solid #f8fafc',
                          transition: 'background 0.1s',
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#eff6ff'}
                        onMouseOut={e => e.currentTarget.style.background = 'white'}
                      >
                        <span style={{ fontWeight: 600, color: '#334155' }}>{c.nombre_completo}</span>
                        <span style={{
                          fontSize: '0.68rem', color: '#94a3b8',
                          background: '#f1f5f9', padding: '2px 8px',
                          borderRadius: '6px',
                        }}>{c.area}</span>
                      </div>
                    ))}
                  {colaboradores.filter(c =>
                    !responsables.includes(c.nombre_completo) &&
                    c.nombre_completo.toLowerCase().includes(respSearch.toLowerCase())
                  ).length === 0 && (
                    <div style={{ padding: '0.65rem', fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center' }}>
                      Sin resultados — escribí para agregar manualmente
                    </div>
                  )}
                  {/* Manual add option */}
                  {respSearch.trim().length > 2 && !colaboradores.find(c =>
                    c.nombre_completo.toLowerCase() === respSearch.toLowerCase()
                  ) && (
                    <div
                      onClick={() => addResponsable(respSearch.trim())}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.5rem 0.75rem', cursor: 'pointer',
                        fontSize: '0.82rem', background: '#f0fdf4',
                        borderTop: '1px solid #e2e8f0',
                        fontWeight: 600, color: '#059669',
                      }}
                      onMouseOver={e => e.currentTarget.style.background = '#dcfce7'}
                      onMouseOut={e => e.currentTarget.style.background = '#f0fdf4'}
                    >
                      + Agregar "{respSearch.trim()}" como responsable
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {responsables.length >= 2 && (
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              Máximo 2 responsables alcanzado
            </div>
          )}
        </div>

        {/* Auxiliar de Hotelería selector */}
        <div className="aud-field">
          <label className="aud-label">🧹 Auxiliar de Hotelería presente</label>

          {/* Selected auxiliar as pill */}
          {general.auxiliar_hoteleria && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.45rem',
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.3rem 0.65rem', borderRadius: '20px',
                background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                border: '1px solid #86efac', fontSize: '0.82rem',
                fontWeight: 600, color: '#166534',
              }}>
                🧹 {general.auxiliar_hoteleria}
                <button onClick={() => update('auxiliar_hoteleria', '')} style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: '#86efac', fontSize: '0.75rem', padding: '0 2px',
                  lineHeight: 1, transition: 'color 0.15s',
                }}
                  onMouseOver={e => e.currentTarget.style.color = '#dc2626'}
                  onMouseOut={e => e.currentTarget.style.color = '#86efac'}
                >✕</button>
              </span>
            </div>
          )}

          {/* Auxiliar select dropdown */}
          {!general.auxiliar_hoteleria && (
            <select
              className="aud-select"
              value=""
              onChange={e => update('auxiliar_hoteleria', e.target.value)}
            >
              <option value="">Seleccionar auxiliar...</option>
              {AUXILIARES_HOTELERIA.map(aux => (
                <option key={aux} value={aux}>{aux}</option>
              ))}
            </select>
          )}

          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Seleccioná la auxiliar asignada al sector durante la ronda
          </div>
        </div>

        <div className="aud-field">
          <label className="aud-label">Auditor / Evaluador</label>
          <input
            type="text"
            className="aud-input"
            value={general.auditor_nombre}
            readOnly
            style={{ background: '#f1f5f9', cursor: 'default', fontWeight: 600 }}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 2: CHECKLIST
// ═══════════════════════════════════════════════════════════════
function StepChecklist({ items, updateItem, score }) {
  return (
    <div>
      <div className="aud-section-title">2. Checklist de Evaluación</div>
      <div className="aud-section-subtitle">
        Evaluá cada ítem · Puntos: {score.total}/{MAX_PUNTOS}
      </div>

      {/* Live score mini-bar */}
      <div className="aud-score-bar" style={{ padding: '0.65rem 0.85rem', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--aud-text-secondary)' }}>
            PROGRESO
          </span>
          <span className={`aud-badge ${score.evaluacion}`} style={{ fontSize: '0.65rem' }}>
            {score.porcentaje}% — {score.evaluacion === 'bueno' ? 'BUENO' : score.evaluacion === 'regular' ? 'REGULAR' : 'CRÍTICO'}
          </span>
        </div>
        <div className="aud-score-track">
          <div
            className="aud-score-fill"
            style={{
              width: `${score.porcentaje}%`,
              background: score.evaluacion === 'bueno'
                ? 'var(--aud-success)'
                : score.evaluacion === 'regular'
                ? 'var(--aud-warning)'
                : 'var(--aud-danger)',
            }}
          />
        </div>
      </div>

      {/* Categories */}
      {CHECKLIST_TEMPLATE.map(cat => (
        <div key={cat.categoria} className="aud-card aud-slide-up">
          <div className="aud-card-header">
            <span className="aud-card-icon">{cat.icon}</span>
            <span className="aud-card-title">{cat.label}</span>
          </div>

          {cat.items.map(item => {
            const current = items[item.key];
            const scoreClass = current.puntuacion === 2 ? 'score-2'
              : current.puntuacion === 1 ? 'score-1'
              : current.puntuacion === 0 ? 'score-0' : '';

            return (
              <div key={item.key} className={`aud-checklist-item ${scoreClass}`}>
                <div className="aud-checklist-label">{item.label}</div>
                <div className="aud-radio-group">
                  {[
                    { value: 2, label: 'Cumple', cls: 'cumple', icon: '✓' },
                    { value: 1, label: 'Parcial', cls: 'parcial', icon: '~' },
                    { value: 0, label: 'No cumple', cls: 'no-cumple', icon: '✗' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      className={`aud-radio-btn ${current.puntuacion === opt.value ? `selected-${opt.cls}` : ''}`}
                      onClick={() => updateItem(item.key, 'puntuacion', opt.value)}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  className="aud-obs-input"
                  placeholder="Observaciones / Evidencia..."
                  value={current.observaciones}
                  onChange={e => updateItem(item.key, 'observaciones', e.target.value)}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 3: RESULTADO
// ═══════════════════════════════════════════════════════════════
function StepResultado({ score, items }) {
  const getColor = () => {
    if (score.evaluacion === 'bueno') return 'var(--aud-success)';
    if (score.evaluacion === 'regular') return 'var(--aud-warning)';
    return 'var(--aud-danger)';
  };

  const countByScore = (val) => Object.values(items).filter(i => i.puntuacion === val).length;

  return (
    <div>
      <div className="aud-section-title">3. Resultado General</div>
      <div className="aud-section-subtitle">Cálculo automático basado en las respuestas</div>

      <div className="aud-score-bar aud-slide-up">
        <div className="aud-score-header">
          <span className="aud-score-label">Puntuación Total</span>
          <span className={`aud-badge ${score.evaluacion}`} style={{ fontSize: '0.82rem' }}>
            {score.evaluacion === 'bueno' ? '✓ BUENO' : score.evaluacion === 'regular' ? '⚠ REGULAR' : '✗ CRÍTICO'}
          </span>
        </div>

        <div style={{ textAlign: 'center', margin: '1rem 0' }}>
          <div className="aud-score-value" style={{ color: getColor(), fontSize: '3rem' }}>
            {score.porcentaje}%
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--aud-text-secondary)', fontWeight: 500 }}>
            {score.total} / {MAX_PUNTOS} puntos
          </div>
        </div>

        <div className="aud-score-track" style={{ height: '14px' }}>
          <div
            className="aud-score-fill"
            style={{ width: `${score.porcentaje}%`, background: getColor() }}
          />
        </div>

        <div className="aud-score-breakdown">
          <div className="aud-score-stat">
            <div className="aud-score-stat-value" style={{ color: 'var(--aud-success)' }}>
              {countByScore(2)}
            </div>
            <div className="aud-score-stat-label">Cumple</div>
          </div>
          <div className="aud-score-stat">
            <div className="aud-score-stat-value" style={{ color: 'var(--aud-warning)' }}>
              {countByScore(1)}
            </div>
            <div className="aud-score-stat-label">Parcial</div>
          </div>
          <div className="aud-score-stat">
            <div className="aud-score-stat-value" style={{ color: 'var(--aud-danger)' }}>
              {countByScore(0)}
            </div>
            <div className="aud-score-stat-label">No Cumple</div>
          </div>
        </div>
      </div>

      {/* Per-category breakdown */}
      {CHECKLIST_TEMPLATE.map(cat => {
        const catItems = cat.items.map(i => items[i.key]);
        const catTotal = catItems.reduce((s, i) => s + (i.puntuacion ?? 0), 0);
        const catMax = cat.items.length * 2;
        const catPct = Math.round((catTotal / catMax) * 100);
        return (
          <div key={cat.categoria} className="aud-card aud-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                {cat.icon} {cat.label}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: getColor() }}>
                {catTotal}/{catMax} ({catPct}%)
              </span>
            </div>
            <div className="aud-score-track" style={{ marginTop: '0.5rem', height: '6px' }}>
              <div className="aud-score-fill" style={{
                width: `${catPct}%`,
                background: catPct >= 85 ? 'var(--aud-success)' : catPct >= 60 ? 'var(--aud-warning)' : 'var(--aud-danger)',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 4: HALLAZGOS
// ═══════════════════════════════════════════════════════════════
function StepHallazgos({ hallazgos, setHallazgos }) {
  const update = (key, value) => setHallazgos(prev => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="aud-section-title">4. Hallazgos</div>
      <div className="aud-section-subtitle">Documentá las no conformidades y oportunidades de mejora</div>

      <div className="aud-card aud-slide-up">
        <div className="aud-card-header">
          <span className="aud-card-icon">🚫</span>
          <span className="aud-card-title">No Conformidades</span>
        </div>
        <textarea
          className="aud-textarea"
          placeholder="Describí las no conformidades encontradas durante la auditoría..."
          value={hallazgos.no_conformidades}
          onChange={e => update('no_conformidades', e.target.value)}
          rows={4}
        />
      </div>

      <div className="aud-card aud-slide-up">
        <div className="aud-card-header">
          <span className="aud-card-icon">💡</span>
          <span className="aud-card-title">Oportunidades de Mejora</span>
        </div>
        <textarea
          className="aud-textarea"
          placeholder="Describí las oportunidades de mejora identificadas..."
          value={hallazgos.oportunidades_mejora}
          onChange={e => update('oportunidades_mejora', e.target.value)}
          rows={4}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 5: PLANES DE ACCIÓN
// ═══════════════════════════════════════════════════════════════
function StepPlanesAccion({ planes, showPlanForm, setShowPlanForm, newPlan, setNewPlan, addPlan, removePlan, colaboradores = [] }) {
  const [respPlanSearch, setRespPlanSearch] = useState('');

  const selectResponsable = (nombre) => {
    setNewPlan(prev => ({ ...prev, responsable: nombre }));
    setRespPlanSearch('');
  };

  return (
    <div>
      <div className="aud-section-title">5. Plan de Acción</div>
      <div className="aud-section-subtitle">Definí las acciones correctivas a realizar</div>

      {planes.map((plan, idx) => (
        <div key={idx} className="aud-plan-card aud-slide-up">
          <div className="aud-plan-header">
            <div className="aud-plan-hallazgo">{plan.hallazgo}</div>
            <span className={`aud-plan-prioridad ${plan.prioridad}`}>{plan.prioridad}</span>
          </div>
          <div className="aud-plan-details">
            <div className="aud-plan-detail-row">
              <strong>Acción:</strong> {plan.accion}
            </div>
            <div className="aud-plan-detail-row">
              <strong>Responsable:</strong> {plan.responsable}
            </div>
            {plan.fecha_limite && (
              <div className="aud-plan-detail-row">
                <strong>Fecha límite:</strong> {plan.fecha_limite}
              </div>
            )}
          </div>
          <button className="aud-btn-delete" style={{ marginTop: '0.5rem' }} onClick={() => removePlan(idx)}>
            🗑 Eliminar
          </button>
        </div>
      ))}

      {showPlanForm ? (
        <div className="aud-card aud-slide-up">
          <div className="aud-card-header">
            <span className="aud-card-icon">➕</span>
            <span className="aud-card-title">Nuevo Plan de Acción</span>
          </div>
          <div className="aud-field">
            <label className="aud-label">Hallazgo *</label>
            <input
              className="aud-input"
              placeholder="Describí el hallazgo..."
              value={newPlan.hallazgo}
              onChange={e => setNewPlan(prev => ({ ...prev, hallazgo: e.target.value }))}
            />
          </div>
          <div className="aud-row">
            <div className="aud-field">
              <label className="aud-label">Prioridad *</label>
              <select
                className="aud-select"
                value={newPlan.prioridad}
                onChange={e => setNewPlan(prev => ({ ...prev, prioridad: e.target.value }))}
              >
                <option value="alta">🔴 Alta</option>
                <option value="media">🟡 Media</option>
                <option value="baja">🔵 Baja</option>
              </select>
            </div>
            <div className="aud-field">
              <label className="aud-label">Fecha límite</label>
              <input
                type="date"
                className="aud-input"
                value={newPlan.fecha_limite}
                onChange={e => setNewPlan(prev => ({ ...prev, fecha_limite: e.target.value }))}
              />
            </div>
          </div>
          <div className="aud-field">
            <label className="aud-label">Acción correctiva *</label>
            <textarea
              className="aud-textarea"
              placeholder="Describí la acción a tomar..."
              value={newPlan.accion}
              onChange={e => setNewPlan(prev => ({ ...prev, accion: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="aud-field">
            <label className="aud-label">Responsable *</label>
            {/* Show selected responsable as pill */}
            {newPlan.responsable && (
              <div style={{ marginBottom: '0.35rem' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.3rem 0.65rem', borderRadius: '20px',
                  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                  border: '1px solid #bfdbfe', fontSize: '0.82rem',
                  fontWeight: 600, color: '#1e40af',
                }}>
                  👤 {newPlan.responsable}
                  <button onClick={() => setNewPlan(prev => ({ ...prev, responsable: '' }))} style={{
                    border: 'none', background: 'none', cursor: 'pointer',
                    color: '#93c5fd', fontSize: '0.75rem', padding: '0 2px',
                    lineHeight: 1,
                  }}
                    onMouseOver={e => e.currentTarget.style.color = '#dc2626'}
                    onMouseOut={e => e.currentTarget.style.color = '#93c5fd'}
                  >✕</button>
                </span>
              </div>
            )}
            {/* Search input */}
            {!newPlan.responsable && (
              <div style={{ position: 'relative' }}>
                <input
                  className="aud-input"
                  placeholder="🔍 Buscar responsable por nombre..."
                  value={respPlanSearch}
                  onChange={e => setRespPlanSearch(e.target.value)}
                  style={{ marginBottom: 0 }}
                />
                {respPlanSearch.trim() && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                    background: 'white', borderRadius: '0 0 10px 10px',
                    border: '1px solid #e2e8f0', borderTop: 'none',
                    maxHeight: '160px', overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  }}>
                    {colaboradores
                      .filter(c => c.nombre_completo.toLowerCase().includes(respPlanSearch.toLowerCase()))
                      .slice(0, 10)
                      .map(c => (
                        <div key={c.id}
                          onClick={() => selectResponsable(c.nombre_completo)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.5rem 0.75rem', cursor: 'pointer',
                            fontSize: '0.85rem', borderBottom: '1px solid #f8fafc',
                            transition: 'background 0.1s',
                          }}
                          onMouseOver={e => e.currentTarget.style.background = '#eff6ff'}
                          onMouseOut={e => e.currentTarget.style.background = 'white'}
                        >
                          <span style={{ fontWeight: 600, color: '#334155' }}>{c.nombre_completo}</span>
                          <span style={{
                            fontSize: '0.68rem', color: '#94a3b8',
                            background: '#f1f5f9', padding: '2px 8px',
                            borderRadius: '6px',
                          }}>{c.area}</span>
                        </div>
                      ))}
                    {colaboradores.filter(c =>
                      c.nombre_completo.toLowerCase().includes(respPlanSearch.toLowerCase())
                    ).length === 0 && (
                      <div style={{ padding: '0.6rem', fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center' }}>
                        Sin resultados
                      </div>
                    )}
                    {respPlanSearch.trim().length > 2 && !colaboradores.find(c =>
                      c.nombre_completo.toLowerCase() === respPlanSearch.toLowerCase()
                    ) && (
                      <div
                        onClick={() => selectResponsable(respPlanSearch.trim())}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.5rem 0.75rem', cursor: 'pointer',
                          fontSize: '0.82rem', background: '#f0fdf4',
                          borderTop: '1px solid #e2e8f0',
                          fontWeight: 600, color: '#059669',
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#dcfce7'}
                        onMouseOut={e => e.currentTarget.style.background = '#f0fdf4'}
                      >
                        + Agregar "{respPlanSearch.trim()}" como responsable
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="aud-btn aud-btn-primary" style={{ flex: 1 }} onClick={addPlan}>
              ✓ Agregar
            </button>
            <button className="aud-btn aud-btn-secondary" onClick={() => setShowPlanForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button className="aud-add-btn" onClick={() => setShowPlanForm(true)}>
          ➕ Agregar Plan de Acción
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 6: SEGUIMIENTO ANTERIORES
// ═══════════════════════════════════════════════════════════════
function StepSeguimiento({ planesAnteriores, loading, onUpdateStatus }) {
  const ESTADOS = [
    { value: 'resuelto', label: '✓ Resuelto', cls: 'resuelto' },
    { value: 'en_proceso', label: '⏳ En proceso', cls: 'en_proceso' },
    { value: 'no_resuelto', label: '✗ No resuelto', cls: 'no_resuelto' },
  ];

  return (
    <div>
      <div className="aud-section-title">6. Seguimiento Anteriores</div>
      <div className="aud-section-subtitle">Actualizá el estado de los planes de acción de la auditoría anterior</div>

      {loading ? (
        <div className="aud-empty">
          <div className="aud-empty-icon">⏳</div>
          <p>Cargando planes anteriores...</p>
        </div>
      ) : planesAnteriores.length === 0 ? (
        <div className="aud-empty aud-slide-up">
          <div className="aud-empty-icon">📋</div>
          <h3>Sin planes pendientes</h3>
          <p>No hay planes de acción pendientes de la auditoría anterior para este sector</p>
        </div>
      ) : (
        planesAnteriores.map(plan => (
          <div key={plan.id} className="aud-plan-card aud-slide-up">
            <div className="aud-plan-header">
              <div className="aud-plan-hallazgo">{plan.hallazgo}</div>
              <span className={`aud-plan-prioridad ${plan.prioridad}`}>{plan.prioridad}</span>
            </div>
            <div className="aud-plan-details">
              <div className="aud-plan-detail-row">
                <strong>Acción:</strong> {plan.accion}
              </div>
              <div className="aud-plan-detail-row">
                <strong>Responsable:</strong> {plan.responsable}
              </div>
              {plan.fecha_limite && (
                <div className="aud-plan-detail-row">
                  <strong>Fecha límite:</strong> {new Date(plan.fecha_limite).toLocaleDateString('es-AR')}
                </div>
              )}
            </div>
            <div className="aud-plan-status-btns">
              {ESTADOS.map(est => (
                <button
                  key={est.value}
                  className={`aud-plan-status-btn ${plan.estado === est.value ? `active-${est.cls}` : ''}`}
                  onClick={() => onUpdateStatus(plan.id, est.value)}
                >
                  {est.label}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL VIEW — Read-only view of a completed audit
// ═══════════════════════════════════════════════════════════════
function DetailView({ audit }) {
  const getColor = () => {
    if (audit.evaluacion === 'bueno') return 'var(--aud-success)';
    if (audit.evaluacion === 'regular') return 'var(--aud-warning)';
    return 'var(--aud-danger)';
  };

  const sectorLabel = SECTORES.find(s => s.value === audit.sector)?.label || audit.sector;
  const formatFecha = (f) => {
    const d = new Date(f + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Group items by category
  const itemsByCategory = {};
  (audit.items || []).forEach(item => {
    if (!itemsByCategory[item.categoria]) itemsByCategory[item.categoria] = [];
    itemsByCategory[item.categoria].push(item);
  });

  return (
    <div className="aud-content aud-animate-in">
      {/* Result header */}
      <div className="aud-score-bar" style={{ borderLeft: `4px solid ${getColor()}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{sectorLabel}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--aud-text-secondary)' }}>
              {formatFecha(audit.fecha)} · Turno {audit.turno}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--aud-text-secondary)' }}>
              Auditor: {audit.auditor_nombre} {audit.responsable_presente && `· Resp: ${audit.responsable_presente.replace(/\|\|\|/g, ', ')}`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="aud-score-value" style={{ color: getColor() }}>
              {audit.porcentaje}%
            </div>
            <span className={`aud-badge ${audit.evaluacion}`}>
              {audit.evaluacion === 'bueno' ? '✓ BUENO' : audit.evaluacion === 'regular' ? '⚠ REGULAR' : '✗ CRÍTICO'}
            </span>
          </div>
        </div>
      </div>

      {/* Items by category */}
      {CHECKLIST_TEMPLATE.map(cat => {
        const catItems = itemsByCategory[cat.categoria] || [];
        if (catItems.length === 0) return null;
        return (
          <div key={cat.categoria} className="aud-card">
            <div className="aud-card-header">
              <span className="aud-card-icon">{cat.icon}</span>
              <span className="aud-card-title">{cat.label}</span>
            </div>
            {catItems.map(item => (
              <div
                key={item.id}
                className={`aud-checklist-item score-${item.puntuacion}`}
                style={{ padding: '0.5rem 0.75rem', marginBottom: '0.35rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>{item.item_label}</span>
                  <span className={`aud-badge ${item.puntuacion === 2 ? 'bueno' : item.puntuacion === 1 ? 'regular' : 'critico'}`}>
                    {item.puntuacion === 2 ? 'Cumple' : item.puntuacion === 1 ? 'Parcial' : 'No cumple'}
                  </span>
                </div>
                {item.observaciones && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--aud-text-secondary)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                    📝 {item.observaciones}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {/* Findings */}
      {(audit.no_conformidades || audit.oportunidades_mejora) && (
        <div className="aud-card">
          <div className="aud-card-header">
            <span className="aud-card-icon">🔍</span>
            <span className="aud-card-title">Hallazgos</span>
          </div>
          {audit.no_conformidades && (
            <div style={{ marginBottom: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--aud-danger)', marginBottom: '0.2rem' }}>No conformidades</div>
              <div style={{ fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{audit.no_conformidades}</div>
            </div>
          )}
          {audit.oportunidades_mejora && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--aud-primary)', marginBottom: '0.2rem' }}>Oportunidades de mejora</div>
              <div style={{ fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{audit.oportunidades_mejora}</div>
            </div>
          )}
        </div>
      )}

      {/* Action Plans */}
      {audit.planes && audit.planes.length > 0 && (
        <div>
          <div className="aud-section-title" style={{ marginTop: '1rem' }}>Planes de Acción</div>
          {audit.planes.map(plan => (
            <div key={plan.id} className="aud-plan-card">
              <div className="aud-plan-header">
                <div className="aud-plan-hallazgo">{plan.hallazgo}</div>
                <span className={`aud-plan-prioridad ${plan.prioridad}`}>{plan.prioridad}</span>
              </div>
              <div className="aud-plan-details">
                <div className="aud-plan-detail-row"><strong>Acción:</strong> {plan.accion}</div>
                <div className="aud-plan-detail-row"><strong>Responsable:</strong> {plan.responsable}</div>
                <div className="aud-plan-detail-row"><strong>Estado:</strong>
                  <span className={`aud-badge ${plan.estado === 'resuelto' ? 'bueno' : plan.estado === 'en_proceso' ? 'regular' : 'critico'}`}
                        style={{ marginLeft: '0.35rem' }}>
                    {plan.estado.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
