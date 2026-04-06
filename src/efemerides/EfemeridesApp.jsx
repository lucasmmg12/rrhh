import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  obtenerEfemerides_Mes,
  crearEfemeride,
  eliminarEfemeride,
  obtenerProximosCumpleaños,
} from './efemeridesService';

// ─── CONSTANTS ───
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const TIPO_CONFIG = {
  cumpleaños:     { label: 'Cumpleaños',    color: '#e11d48', bg: '#fef2f2', icon: '🎂' },
  dia_mundial:    { label: 'Día Mundial',   color: '#0284c7', bg: '#eff6ff', icon: '🌍' },
  feriado:        { label: 'Feriado',       color: '#dc2626', bg: '#fef2f2', icon: '🏛️' },
  institucional:  { label: 'Institucional', color: '#7c3aed', bg: '#f5f3ff', icon: '🏥' },
  otro:           { label: 'Otro',          color: '#64748b', bg: '#f8fafc', icon: '📌' },
};

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getMonthDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const days = [];
  for (let i = startPad - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), current: false });
  for (let i = 1; i <= lastDay.getDate(); i++) days.push({ date: new Date(year, month, i), current: true });
  while (days.length < 42) {
    days.push({ date: new Date(year, month + 1, days.length - startPad - lastDay.getDate() + 1), current: false });
  }
  return days;
};

// ─── MAIN COMPONENT ───
export default function EfemeridesApp({ embedded = false }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [efemerides, setEfemerides] = useState([]);
  const [cumpleaños, setCumpleaños] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('todos');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // ─── DATA LOADING ───
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [efs, cumps] = await Promise.all([
        obtenerEfemerides_Mes(year, month),
        obtenerProximosCumpleaños(60),
      ]);
      setEfemerides(efs);
      setCumpleaños(cumps);
    } catch (err) {
      console.error('Error loading efemérides:', err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── NAVIGATION ───
  const goPrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const goNext = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // ─── EVENTS MAP ───
  const eventsByDate = useMemo(() => {
    const map = {};
    const filtered = filter === 'todos' ? efemerides : efemerides.filter(e => e.tipo === filter);
    filtered.forEach(e => {
      const key = e.fecha;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [efemerides, filter]);

  // ─── CREATE EFEMERIDE ───
  const handleCreate = async (data) => {
    try {
      await crearEfemeride(data);
      setShowForm(false);
      setSelectedDay(null);
      loadData();
    } catch (err) {
      alert('Error al crear: ' + err.message);
    }
  };

  // ─── DELETE ───
  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta efeméride?')) return;
    try {
      await eliminarEfemeride(id);
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ─── CALENDAR DAYS ───
  const days = getMonthDays(year, month);
  const today = new Date();
  const todayKey = toDateKey(today);

  // ─── RENDER ───
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: embedded ? '100%' : '100vh', fontFamily: "'Inter', sans-serif" }}>

      {/* TOOLBAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1.25rem', background: 'white',
        borderBottom: '1px solid var(--neutral-200, #e2e8f0)',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        {/* Left: Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={goToday} style={btnSmall}>Hoy</button>
          <button onClick={goPrev} style={btnNav}>‹</button>
          <button onClick={goNext} style={btnNav}>›</button>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--neutral-800, #1e293b)' }}>
            {MONTHS[month]} {year}
          </span>
        </div>

        {/* Right: Filters + New */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={selectStyle}>
            <option value="todos">Todos los tipos</option>
            {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
            ))}
          </select>
          <button onClick={() => { setShowForm(true); setSelectedDay(toDateKey(new Date())); }} style={btnPrimary}>
            + Nueva
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* CALENDAR GRID */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '4px' }}>
            {DAYS.map(d => (
              <div key={d} style={{
                textAlign: 'center', fontSize: '0.7rem', fontWeight: 700,
                color: 'var(--neutral-500, #64748b)', padding: '0.35rem 0',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px', flex: 1,
          }}>
            {days.map(({ date, current }, i) => {
              const key = toDateKey(date);
              const dayEvents = eventsByDate[key] || [];
              const isToday = key === todayKey;
              const isSelected = key === selectedDay;

              return (
                <div
                  key={i}
                  onClick={() => { setSelectedDay(key); }}
                  style={{
                    minHeight: '80px', padding: '0.25rem 0.35rem',
                    background: isSelected ? 'var(--primary-50, #eff6ff)' : isToday ? '#fefce8' : current ? 'white' : '#fafbfc',
                    border: isSelected ? '2px solid var(--primary-500, #1E5FA6)' : isToday ? '2px solid #fbbf24' : '1px solid var(--neutral-100, #f1f5f9)',
                    borderRadius: '8px', cursor: 'pointer',
                    opacity: current ? 1 : 0.45,
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = isToday ? '#fefce8' : current ? 'white' : '#fafbfc'; }}
                >
                  <div style={{
                    fontSize: '0.72rem', fontWeight: isToday ? 800 : 600,
                    color: isToday ? '#92400e' : current ? 'var(--neutral-700, #334155)' : 'var(--neutral-400)',
                    marginBottom: '2px',
                  }}>
                    {date.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    {dayEvents.slice(0, 3).map((ev, j) => {
                      const cfg = TIPO_CONFIG[ev.tipo] || TIPO_CONFIG.otro;
                      return (
                        <div key={j} style={{
                          fontSize: '0.6rem', padding: '1px 4px',
                          borderRadius: '4px', background: cfg.bg,
                          color: cfg.color, fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          lineHeight: 1.4,
                        }}>
                          {ev.icono || cfg.icon} {ev.titulo}{ev.obsequio ? ' 🎁' : ''}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div style={{ fontSize: '0.55rem', color: 'var(--neutral-400)', textAlign: 'center' }}>
                        +{dayEvents.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT SIDEBAR — Upcoming birthdays & selected day */}
        <aside style={{
          width: '300px', background: 'white',
          borderLeft: '1px solid var(--neutral-200, #e2e8f0)',
          overflow: 'auto', display: 'flex', flexDirection: 'column',
        }}>
          {/* Selected day detail */}
          {selectedDay && (
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--neutral-100, #f1f5f9)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--neutral-800)', margin: 0 }}>
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <button onClick={() => { setShowForm(true); }} style={{
                  ...btnSmall, fontSize: '0.7rem', background: 'var(--primary-500, #1E5FA6)', color: 'white',
                }}>+ Agregar</button>
              </div>

              {(eventsByDate[selectedDay] || []).length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-400)', margin: '0.5rem 0', textAlign: 'center' }}>
                  Sin efemérides
                </p>
              ) : (
                (eventsByDate[selectedDay] || []).map(ev => {
                  const cfg = TIPO_CONFIG[ev.tipo] || TIPO_CONFIG.otro;
                  return (
                    <div key={ev.id} style={{
                      padding: '0.65rem', marginBottom: '0.4rem',
                      borderRadius: '8px', border: `1px solid ${cfg.color}20`,
                      background: cfg.bg,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: cfg.color }}>
                            {cfg.icon} {ev.titulo}
                          </div>
                          {ev.descripcion && (
                            <p style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', margin: '0.2rem 0 0' }}>
                              {ev.descripcion}
                            </p>
                          )}
                          <span style={{
                            fontSize: '0.6rem', padding: '1px 6px', borderRadius: '8px',
                            background: cfg.color + '15', color: cfg.color, fontWeight: 600,
                            display: 'inline-block', marginTop: '0.25rem',
                          }}>{cfg.label}</span>
                          {ev.obsequio && (
                            <span style={{
                              fontSize: '0.6rem', padding: '1px 6px', borderRadius: '8px',
                              background: '#fef3c7', color: '#92400e', fontWeight: 600,
                              display: 'inline-block', marginTop: '0.25rem', marginLeft: '0.25rem',
                            }}>🎁 Obsequio</span>
                          )}
                        </div>
                        <button onClick={() => handleDelete(ev.id)} style={{
                          border: 'none', background: 'none', cursor: 'pointer',
                          fontSize: '0.8rem', color: 'var(--neutral-400)',
                          padding: '2px', lineHeight: 1,
                        }}>✕</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Upcoming birthdays */}
          <div style={{ padding: '1rem', flex: 1 }}>
            <h3 style={{
              fontSize: '0.82rem', fontWeight: 700,
              color: 'var(--neutral-800)', margin: '0 0 0.75rem',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              🎂 Próximos cumpleaños
            </h3>

            {cumpleaños.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--neutral-400)', textAlign: 'center' }}>
                No hay cumpleaños cargados aún.
                <br/><span style={{ fontSize: '0.7rem' }}>Agrega fecha de nacimiento a los colaboradores.</span>
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {cumpleaños.slice(0, 10).map(c => {
                  const nac = new Date(c.fecha_nacimiento + 'T00:00:00');
                  const cumple = new Date(today.getFullYear(), nac.getMonth(), nac.getDate());
                  if (cumple < today) cumple.setFullYear(cumple.getFullYear() + 1);
                  const diasRestantes = Math.ceil((cumple - today) / (1000 * 60 * 60 * 24));
                  const edad = cumple.getFullYear() - nac.getFullYear();

                  return (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.65rem',
                      padding: '0.55rem 0.65rem', borderRadius: '8px',
                      background: diasRestantes === 0 ? '#fef2f2' : '#f8fafc',
                      border: diasRestantes === 0 ? '1px solid #fecaca' : '1px solid transparent',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: diasRestantes === 0 ? '#fee2e2' : '#e0f2fe',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', flexShrink: 0,
                      }}>
                        {diasRestantes === 0 ? '🥳' : '🎂'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.78rem', fontWeight: 600,
                          color: 'var(--neutral-800)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{c.nombre_completo}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--neutral-500)' }}>
                          {c.area || 'Sin sector'} · Cumple {edad} años
                        </div>
                      </div>
                      <div style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px',
                        borderRadius: '12px',
                        background: diasRestantes === 0 ? '#dc2626' : diasRestantes <= 7 ? '#f59e0b' : '#94a3b8',
                        color: 'white',
                      }}>
                        {diasRestantes === 0 ? '¡HOY!' : `${diasRestantes}d`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* NEW EFEMERIDE MODAL */}
      {showForm && (
        <CreateModal
          date={selectedDay || toDateKey(new Date())}
          onClose={() => setShowForm(false)}
          onCreate={handleCreate}
        />
      )}

      {loading && (
        <div style={{
          position: 'fixed', bottom: '1rem', right: '1rem',
          background: 'var(--primary-500, #1E5FA6)', color: 'white',
          padding: '0.5rem 1rem', borderRadius: '8px',
          fontSize: '0.8rem', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          Cargando...
        </div>
      )}
    </div>
  );
}

// ─── CREATE MODAL ───
function CreateModal({ date, onClose, onCreate }) {
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    fecha: date,
    tipo: 'institucional',
    recurrente: false,
    obsequio: false,
    color: '#7c3aed',
    icono: '📌',
    notificar_whatsapp: false,
  });

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) return alert('El título es obligatorio');
    onCreate(form);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: '16px', padding: '1.5rem',
        width: '90%', maxWidth: '440px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
      }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--neutral-800)', margin: '0 0 1.25rem' }}>
          Nueva Efeméride
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={labelStyle}>Título *</label>
            <input type="text" value={form.titulo} onChange={e => update('titulo', e.target.value)}
              placeholder="Ej: Día del Médico" style={inputStyle} autoFocus />
          </div>

          <div>
            <label style={labelStyle}>Descripción</label>
            <textarea value={form.descripcion} onChange={e => update('descripcion', e.target.value)}
              placeholder="Descripción opcional..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => update('fecha', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select value={form.tipo} onChange={e => {
                const cfg = TIPO_CONFIG[e.target.value];
                update('tipo', e.target.value);
                update('color', cfg?.color || '#64748b');
                update('icono', cfg?.icon || '📌');
              }} style={inputStyle}>
                {Object.entries(TIPO_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.recurrente} onChange={e => update('recurrente', e.target.checked)} />
              Se repite cada año
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.obsequio} onChange={e => update('obsequio', e.target.checked)} />
              🎁 Obsequio
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.notificar_whatsapp} onChange={e => update('notificar_whatsapp', e.target.checked)} />
              📱 Notificar WA
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button type="button" onClick={onClose} style={{
            padding: '0.5rem 1.25rem', borderRadius: '8px', border: '1px solid var(--neutral-200, #e2e8f0)',
            background: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
          }}>Cancelar</button>
          <button type="submit" style={{
            padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none',
            background: 'var(--primary-500, #1E5FA6)', color: 'white',
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
          }}>Crear</button>
        </div>
      </form>
    </div>
  );
}

// ─── STYLES ───
const btnSmall = {
  padding: '0.3rem 0.75rem', borderRadius: '6px',
  border: '1px solid var(--neutral-200, #e2e8f0)',
  background: 'white', cursor: 'pointer',
  fontSize: '0.78rem', fontWeight: 600,
  color: 'var(--neutral-700, #334155)',
};

const btnNav = {
  ...btnSmall, padding: '0.3rem 0.6rem', fontSize: '1rem', lineHeight: 1,
};

const btnPrimary = {
  ...btnSmall, background: 'var(--primary-500, #1E5FA6)', color: 'white',
  border: '1px solid var(--primary-500, #1E5FA6)',
};

const selectStyle = {
  padding: '0.35rem 0.65rem', borderRadius: '6px',
  border: '1px solid var(--neutral-200, #e2e8f0)',
  fontSize: '0.78rem', background: 'white',
  cursor: 'pointer', outline: 'none',
};

const labelStyle = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  color: 'var(--neutral-600, #475569)', marginBottom: '0.3rem',
  textTransform: 'uppercase', letterSpacing: '0.03em',
};

const inputStyle = {
  width: '100%', padding: '0.55rem 0.75rem',
  borderRadius: '8px', border: '1px solid var(--neutral-200, #e2e8f0)',
  fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};
