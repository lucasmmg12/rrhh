import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { calendarService } from './services/calendarService';
import { sendTestMessage, notifySelectedContacts, notifyCancellation } from './services/whatsappService';
import { holidays2026, recurringMeetings } from './data/holidays2026';

// ===== HELPERS =====
const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const EVENT_TYPES = [
  { value: 'meeting', label: 'Reunión', color: '#0284c7' },
  { value: 'training', label: 'Capacitación', color: '#7c3aed' },
  { value: 'ateneo', label: 'Ateneo', color: '#0ea5e9' },
  { value: 'holiday', label: 'Feriado', color: '#dc2626' },
  { value: 'block', label: 'Bloqueo', color: '#64748b' },
  { value: 'other', label: 'Otro', color: '#10b981' },
];

const COLOR_PALETTE = ['#0284c7', '#7c3aed', '#0ea5e9', '#dc2626', '#f59e0b', '#e11d48', '#10b981', '#f97316', '#64748b', '#6366f1'];

const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const isSameDay = (d1, d2) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
};

const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getMonthDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Monday-first
  const days = [];

  // Previous month padding
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }

  // Current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }

  // Next month padding (fill to 42 cells = 6 rows)
  while (days.length < 42) {
    const d = new Date(year, month + 1, days.length - startPad - lastDay.getDate() + 1);
    days.push({ date: d, isCurrentMonth: false });
  }

  return days;
};

const getWeekDays = (date) => {
  const d = new Date(date);
  const dayOfWeek = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dayOfWeek);
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
};

// ===== MAIN APP =====
export default function CalendarApp({ isReadonly = false }) {
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalState, setModalState] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [allContacts, setAllContacts] = useState([]);

  // ===== AUTH STATE =====
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(!isReadonly);
  const [showContactsPanel, setShowContactsPanel] = useState(false);
  const isAdmin = !isReadonly && !!user;

  useEffect(() => {
    if (isReadonly) return; // No auth needed for public page
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, [isReadonly]);

  // ===== DATA LOADING =====
  const loadEvents = useCallback(async () => {
    try {
      let startRange, endRange;
      if (view === 'month') {
        startRange = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
        endRange = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString();
      } else {
        const weekDays = getWeekDays(currentDate);
        const weekStart = new Date(weekDays[0]);
        weekStart.setHours(0, 0, 0, 0);
        startRange = weekStart.toISOString();
        const weekEnd = new Date(weekDays[6]);
        weekEnd.setHours(23, 59, 59, 999);
        endRange = weekEnd.toISOString();
      }
      const data = await calendarService.getEvents(startRange, endRange);
      setEvents(data);
    } catch (e) {
      console.error('Failed to load events:', e);
    }
  }, [currentDate, view]);

  const loadContacts = useCallback(async () => {
    try {
      const data = await calendarService.getContacts();
      setAllContacts(data);
    } catch (e) { console.error('Failed to load contacts:', e); }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        await calendarService.seedHolidays(holidays2026);
        await loadEvents();
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Load contacts when admin auth resolves
  useEffect(() => {
    if (isAdmin) loadContacts();
  }, [isAdmin, loadContacts]);

  useEffect(() => {
    if (!isLoading) loadEvents();
  }, [currentDate, view, loadEvents]);

  // ===== NAVIGATION =====
  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const goNext = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  // ===== EVENT CRUD =====
  const handleCreateEvent = async (eventData, pendingFiles = []) => {
    try {
      const created = await calendarService.createEvent(eventData, user?.email);
      if (eventData.is_recurring && eventData.recurrence_rule) {
        await calendarService.generateRecurringEvents(created);
      }
      // Upload pending files after event creation
      if (pendingFiles.length > 0 && created?.id) {
        for (const file of pendingFiles) {
          try {
            await calendarService.uploadAttachment(created.id, file);
          } catch (err) {
            console.error('Failed to upload attachment:', file.name, err);
          }
        }
      }
      setModalState(null);
      await loadEvents();
    } catch (e) {
      console.error('Create failed:', e);
      alert('Error al crear evento');
    }
  };

  const handleUpdateEvent = async (id, eventData) => {
    try {
      const updated = await calendarService.updateEvent(id, eventData, user?.email);

      // Handle recurrence changes on edit
      if (eventData.is_recurring && eventData.recurrence_rule) {
        // First, delete any existing recurring children for this event
        // (the parent is identified by its own id or its recurrence_parent_id)
        const parentId = updated.recurrence_parent_id || updated.id;
        try {
          // Remove old children before regenerating
          const { error: cleanupError } = await supabase
            .from('calendar_events')
            .delete()
            .eq('recurrence_parent_id', parentId);
          if (cleanupError) console.error('Cleanup old recurrences:', cleanupError);
        } catch (cleanupErr) {
          console.error('Non-critical: cleanup old recurrences failed:', cleanupErr);
        }

        // Generate fresh recurring events from the updated parent
        await calendarService.generateRecurringEvents(updated);
      }

      setModalState(null);
      await loadEvents();
    } catch (e) {
      console.error('Update failed:', e);
      alert('Error al actualizar evento');
    }
  };

  const handleDeleteEvent = async (id, deleteAll = false) => {
    try {
      if (deleteAll) {
        await calendarService.deleteRecurrenceGroup(id);
      } else {
        await calendarService.deleteEvent(id, user?.email);
      }
      setModalState(null);
      await loadEvents();
    } catch (e) {
      console.error('Delete failed:', e);
      alert('Error al eliminar evento');
    }
  };

  const handleCancelEvent = async (id, cancelAll = false) => {
    try {
      if (cancelAll) {
        await calendarService.cancelRecurrenceGroup(id, user?.email);
      } else {
        await calendarService.cancelEvent(id, user?.email);
      }
      setModalState(null);
      await loadEvents();
    } catch (e) {
      console.error('Cancel failed:', e);
      alert('Error al cancelar evento');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  // ===== LABEL =====
  const headerLabel = useMemo(() => {
    if (view === 'month') {
      return `${MONTHS_ES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    const weekDays = getWeekDays(currentDate);
    const s = weekDays[0]; const e = weekDays[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} – ${e.getDate()} ${MONTHS_ES[s.getMonth()]} ${s.getFullYear()}`;
    }
    return `${s.getDate()} ${MONTHS_ES[s.getMonth()].substring(0, 3)} – ${e.getDate()} ${MONTHS_ES[e.getMonth()].substring(0, 3)} ${s.getFullYear()}`;
  }, [currentDate, view]);

  // ===== RENDER =====
  if (authLoading) {
    return (
      <div className="cal-loading">
        <div className="cal-spinner"></div>
        <p>Verificando acceso...</p>
      </div>
    );
  }

  // Show login for admin page when not authenticated
  if (!isReadonly && !user) {
    return <LoginScreen />;
  }

  if (isLoading) {
    return (
      <div className="cal-loading">
        <div className="cal-spinner"></div>
        <p>Cargando agenda...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* HEADER */}
      <header className="cal-header">
        <div className="cal-header-left">
          <img src="/logosanatorio.png" alt="Sanatorio Argentino" />
          <h1>Agenda de Salas</h1>
          <span className="cal-badge">{isAdmin ? 'ADMINISTRACIÓN' : 'AGENDA DIGITAL'}</span>
          {isAdmin && (
            <nav style={{ display: 'flex', gap: '0.35rem', marginLeft: '0.75rem' }}>
              <a href="/" style={{
                fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem',
                borderRadius: '12px', background: '#f1f5f9', color: '#475569',
                textDecoration: 'none', transition: 'all 0.15s'
              }}>🏠 Inicio</a>
              <a href="/agenda.html" style={{
                fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem',
                borderRadius: '12px', background: '#e0f2fe', color: '#0284c7',
                textDecoration: 'none', transition: 'all 0.15s'
              }}>📅 Agenda Pública</a>
              <a href="/organigrama.html" style={{
                fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem',
                borderRadius: '12px', background: '#f0fdf4', color: '#16a34a',
                textDecoration: 'none', transition: 'all 0.15s'
              }}>🏢 Organigrama</a>
            </nav>
          )}
        </div>

        <div className="cal-header-center">
          <button className="cal-today-btn" onClick={goToday}>Hoy</button>
          <button className="cal-nav-btn" onClick={goPrev}>‹</button>
          <button className="cal-nav-btn" onClick={goNext}>›</button>
          <span className="cal-month-label">{headerLabel}</span>
        </div>

        <div className="cal-header-right">
          <div className="cal-view-toggle">
            <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>Mes</button>
            <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Semana</button>
          </div>
          {isAdmin && (
            <button className="cal-export-btn" onClick={() => setShowContactsPanel(true)} style={{ background: '#10b981', borderColor: '#10b981' }}>
              📱 Contactos WA
            </button>
          )}
          <button className="cal-export-btn" onClick={handleExportPDF}>
            📄 Exportar PDF
          </button>
          {isAdmin && (
            <button className="cal-export-btn" onClick={async () => { await supabase.auth.signOut(); setUser(null); }} style={{ background: '#ef4444', borderColor: '#ef4444' }}>
              Cerrar Sesión
            </button>
          )}
        </div>
      </header>

      {/* CALENDAR BODY */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view === 'month' ? (
          <MonthView
            currentDate={currentDate}
            events={events}
            onDayClick={(date) => isAdmin && setModalState({ mode: 'create', date })}
            onEventClick={(event) => setModalState({ mode: 'view', event })}
          />
        ) : (
          <WeekView
            currentDate={currentDate}
            events={events}
            onSlotClick={(date) => isAdmin && setModalState({ mode: 'create', date })}
            onEventClick={(event) => setModalState({ mode: 'view', event })}
          />
        )}
      </div>

      {/* EVENT MODAL */}
      {modalState && (
        <EventModal
          mode={modalState.mode}
          event={modalState.event || null}
          date={modalState.date || null}
          onClose={() => setModalState(null)}
          onCreate={handleCreateEvent}
          onUpdate={handleUpdateEvent}
          onDelete={handleDeleteEvent}
          onCancel={handleCancelEvent}
          onEdit={() => setModalState({ mode: 'edit', event: modalState.event })}
          isAdmin={isAdmin}
          allContacts={allContacts}
        />
      )}

      {/* CONTACTS PANEL */}
      {showContactsPanel && (
        <ContactsPanel onClose={() => setShowContactsPanel(false)} />
      )}
    </div>
  );
}

// ===== MONTH VIEW COMPONENT =====
function MonthView({ currentDate, events, onDayClick, onEventClick }) {
  const days = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
  const today = new Date();

  const getEventsForDay = (date) => {
    const dateStr = toLocalDateString(date);
    return events.filter(ev => {
      const evDate = toLocalDateString(new Date(ev.start_time));
      return evDate === dateStr;
    });
  };

  return (
    <div className="cal-month-grid">
      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
        <div key={d} className="cal-day-header">{d}</div>
      ))}
      {days.map((day, i) => {
        const dayEvents = getEventsForDay(day.date);
        const isToday = isSameDay(day.date, today);
        const holidayEvent = dayEvents.find(e => e.event_type === 'holiday');
        const isBlocked = !!holidayEvent;
        const nonHolidayEvents = dayEvents.filter(e => e.event_type !== 'holiday');
        const maxVisible = 3;

        return (
          <div
            key={i}
            className={`cal-day-cell ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isBlocked ? 'blocked' : ''}`}
            onClick={(e) => {
              if (isBlocked) return; // Prevent creating events on holidays
              if (!e.target.closest('.cal-event-pill')) {
                onDayClick(day.date);
              }
            }}
            style={isBlocked ? { cursor: 'not-allowed' } : {}}
          >
            <div className="cal-day-number">{day.date.getDate()}</div>
            {isBlocked && (
              <div className="cal-blocked-overlay">
                <span className="cal-blocked-icon">🚫</span>
                <span className="cal-blocked-label">{holidayEvent.title}</span>
              </div>
            )}
            {!isBlocked && nonHolidayEvents.slice(0, maxVisible).map(ev => {
              const isCancelled = ev.status === 'cancelled';
              return (
              <div
                key={ev.id}
                className={`cal-event-pill ${isCancelled ? 'cal-event-cancelled' : ''}`}
                style={{ background: isCancelled ? '#94a3b8' : (ev.color || '#0284c7') }}
                onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                title={`${ev.title} — ${formatTime(ev.start_time)}${isCancelled ? ' (CANCELADO)' : ''}`}
              >
                <span className="pill-time">{formatTime(ev.start_time)}</span>
                <span>{isCancelled ? '🚫 ' : ''}{ev.requires_coffee && '☕ '}{ev.requires_tys && '🖥️ '}{ev.title}</span>
              </div>
              );
            })}
            {!isBlocked && nonHolidayEvents.length > maxVisible && (
              <div className="cal-more-events" onClick={(e) => { e.stopPropagation(); }}>
                +{nonHolidayEvents.length - maxVisible} más
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===== WEEK VIEW COMPONENT =====
function WeekView({ currentDate, events, onSlotClick, onEventClick }) {
  const weekDays = getWeekDays(currentDate);
  const today = new Date();
  const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 7:00 to 21:00

  const getEventsForDay = (date) => {
    const dateStr = toLocalDateString(date);
    return events.filter(ev => {
      const evDate = toLocalDateString(new Date(ev.start_time));
      return evDate === dateStr;
    });
  };

  return (
    <div className="cal-week-container" style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      {/* Time column */}
      <div className="cal-time-column">
        <div style={{ height: '65px' }}></div> {/* Header spacer */}
        {hours.map(h => (
          <div key={h} className="cal-time-slot-label">
            {String(h).padStart(2, '0')}:00
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="cal-week-grid">
        {/* Day headers */}
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} className={`cal-week-day-header ${isToday ? 'today' : ''}`}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                {DAYS_ES[(day.getDay() + 6) % 7 + 1] || DAYS_ES[day.getDay()]}
              </div>
              <div className="day-number">{day.getDate()}</div>
            </div>
          );
        })}

        {/* Day columns */}
        {weekDays.map((day, colIdx) => {
          const allDayEvents = getEventsForDay(day);
          const holidayEvent = allDayEvents.find(e => e.event_type === 'holiday');
          const isBlocked = !!holidayEvent;
          const dayEvents = allDayEvents.filter(e => e.event_type !== 'holiday');

          return (
            <div key={colIdx} className="cal-week-day-col" style={{ position: 'relative' }}>
              {/* Holiday full-day block overlay */}
              {isBlocked && (
                <div className="cal-week-blocked-overlay">
                  <div className="cal-week-blocked-content">
                    <span style={{ fontSize: '2rem' }}>🚫</span>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>FERIADO</span>
                    <span style={{ fontSize: '0.72rem', textAlign: 'center', opacity: 0.8 }}>{holidayEvent.title}</span>
                  </div>
                </div>
              )}

              {hours.map(h => (
                <div
                  key={h}
                  className="cal-week-hour-slot"
                  style={isBlocked ? { cursor: 'not-allowed', pointerEvents: 'none' } : {}}
                  onClick={() => {
                    if (isBlocked) return;
                    const clickDate = new Date(day);
                    clickDate.setHours(h, 0, 0, 0);
                    onSlotClick(clickDate);
                  }}
                />
              ))}

              {/* Events positioned absolutely (only if not blocked) */}
              {!isBlocked && dayEvents.map(ev => {
                const start = new Date(ev.start_time);
                const end = new Date(ev.end_time);
                const startHour = start.getHours() + start.getMinutes() / 60;
                const endHour = end.getHours() + end.getMinutes() / 60;
                const top = (startHour - 7) * 60;
                const height = Math.max((endHour - startHour) * 60, 20);
                const isCancelled = ev.status === 'cancelled';

                return (
                  <div
                    key={ev.id}
                    className={`cal-week-event ${isCancelled ? 'cal-event-cancelled' : ''}`}
                    style={{
                      top: `${top + 65}px`,
                      height: `${height}px`,
                      background: isCancelled ? '#94a3b8' : (ev.color || '#0284c7'),
                    }}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                  >
                    <div className="ev-title">{isCancelled ? '🚫 ' : ''}{ev.requires_coffee && '☕ '}{ev.requires_tys && '🖥️ '}{ev.title}</div>
                    <div className="ev-time">{formatTime(ev.start_time)} – {formatTime(ev.end_time)}{isCancelled ? ' • CANCELADO' : ''}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== EVENT MODAL =====
function EventModal({ mode, event, date, onClose, onCreate, onUpdate, onDelete, onCancel, onEdit, isAdmin = false, allContacts = [] }) {
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isCreateMode = mode === 'create';
  const isCancelled = event?.status === 'cancelled';

  const defaultStart = date
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() || 9, 0)
    : new Date();
  const defaultEnd = new Date(defaultStart.getTime() + 3600000);

  // Group contacts by role
  const contactsByRole = useMemo(() => ({
    rrhh: allContacts.filter(c => c.role === 'rrhh' && c.is_active),
    limpieza: allContacts.filter(c => c.role === 'limpieza' && c.is_active),
    cocina: allContacts.filter(c => c.role === 'cocina' && c.is_active),
    tys: allContacts.filter(c => c.role === 'tys' && c.is_active),
    general: allContacts.filter(c => !c.role || c.role === 'general' && c.is_active),
  }), [allContacts]);

  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    start_time: event?.start_time ? toLocalISOString(new Date(event.start_time)) : toLocalISOString(defaultStart),
    end_time: event?.end_time ? toLocalISOString(new Date(event.end_time)) : toLocalISOString(defaultEnd),
    event_type: event?.event_type || 'meeting',
    color: event?.color || '#0284c7',
    location: event?.location || 'Sala de Ateneo',
    attendees_count: event?.attendees_count || 0,
    requires_coffee: event?.requires_coffee || false,
    requires_tys: event?.requires_tys || false,
    notify_whatsapp: event?.notify_whatsapp ?? true,
    is_recurring: event?.is_recurring || false,
    recurrence_days: event?.recurrence_rule?.days || [],
    recurrence_until: event?.recurrence_rule?.until || '2026-12-31',
    links: event?.links || [],
  });

  // Selected contact IDs for notification
  const [selectedContacts, setSelectedContacts] = useState(() => {
    // Default: select all RRHH contacts
    return allContacts.filter(c => c.role === 'rrhh' && c.is_active).map(c => c.id);
  });
  const [showRecipients, setShowRecipients] = useState(false);

  const [newLink, setNewLink] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Load attachments for existing events
  useEffect(() => {
    if (event?.id) {
      calendarService.getAttachments(event.id).then(setAttachments).catch(console.error);
    }
  }, [event?.id]);

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    // Auto-add/remove role contacts when toggling coffee or tys
    if (key === 'requires_coffee') {
      const cocinaIds = contactsByRole.cocina.map(c => c.id);
      if (value) {
        setSelectedContacts(prev => [...new Set([...prev, ...cocinaIds])]);
      } else {
        setSelectedContacts(prev => prev.filter(id => !cocinaIds.includes(id)));
      }
    }
    if (key === 'requires_tys') {
      const tysIds = contactsByRole.tys.map(c => c.id);
      if (value) {
        setSelectedContacts(prev => [...new Set([...prev, ...tysIds])]);
      } else {
        setSelectedContacts(prev => prev.filter(id => !tysIds.includes(id)));
      }
    }
  };

  const toggleContact = (contactId) => {
    setSelectedContacts(prev =>
      prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );
  };

  const toggleRoleGroup = (role) => {
    const ids = contactsByRole[role]?.map(c => c.id) || [];
    const allSelected = ids.every(id => selectedContacts.includes(id));
    if (allSelected) {
      setSelectedContacts(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedContacts(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const toggleRecurrenceDay = (day) => {
    setForm(prev => {
      const days = prev.recurrence_days.includes(day)
        ? prev.recurrence_days.filter(d => d !== day)
        : [...prev.recurrence_days, day];
      return { ...prev, recurrence_days: days };
    });
  };

  const addLink = () => {
    if (newLink.trim()) {
      updateField('links', [...form.links, newLink.trim()]);
      setNewLink('');
    }
  };

  const removeLink = (idx) => {
    updateField('links', form.links.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return alert('El título es obligatorio');

    const payload = {
      title: form.title,
      description: form.description,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
      event_type: form.event_type,
      color: form.color,
      location: form.location,
      attendees_count: parseInt(form.attendees_count) || 0,
      requires_coffee: form.requires_coffee,
      requires_tys: form.requires_tys,
      notify_whatsapp: form.notify_whatsapp,
      is_recurring: form.is_recurring,
      links: form.links,
      selectedContacts: selectedContacts,
      recurrence_rule: form.is_recurring ? {
        frequency: 'weekly',
        days: form.recurrence_days,
        until: form.recurrence_until,
      } : null,
    };

    if (isCreateMode) {
      onCreate(payload, pendingFiles);
    } else if (isEditMode && event?.id) {
      onUpdate(event.id, payload);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    if (isCreateMode) {
      // Queue files for upload after creation
      setPendingFiles(prev => [...prev, ...files]);
    } else if (event?.id) {
      // Upload immediately in edit mode
      setUploading(true);
      for (const file of files) {
        try {
          const att = await calendarService.uploadAttachment(event.id, file);
          setAttachments(prev => [att, ...prev]);
        } catch (err) {
          console.error('Upload failed:', err);
          alert('Error al subir archivo: ' + file.name);
        }
      }
      setUploading(false);
    }
    e.target.value = ''; // Reset input
  };

  const removePendingFile = (idx) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  };


  const handleDeleteAttachment = async (att) => {
    try {
      await calendarService.deleteAttachment(att);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
    } catch (err) {
      console.error('Delete attachment failed:', err);
    }
  };

  // ===== VIEW MODE =====
  if (isViewMode && event) {
    return (
      <div className="cal-modal-overlay" onClick={onClose}>
        <div className="cal-modal" onClick={e => e.stopPropagation()} style={{
          borderTop: `4px solid ${isCancelled ? '#94a3b8' : event.color}`,
          overflow: 'hidden'
        }}>
          <div className="cal-modal-header" style={{
            background: `linear-gradient(135deg, ${event.color}15 0%, transparent 100%)`,
            borderBottom: `1px solid ${event.color}30`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: event.color }} />
              <h2>{event.title}</h2>
            </div>
            <button className="cal-modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="cal-modal-body">
            {isCancelled && (
              <div style={{
                padding: '0.6rem 1rem', borderRadius: '8px',
                background: '#fef2f2', border: '1px solid #fecaca',
                color: '#dc2626', fontWeight: 700, fontSize: '0.85rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}>
                🚫 EVENTO CANCELADO
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>
              <span>📅</span>
              <span>{formatDate(event.start_time)}</span>
              <span style={{ margin: '0 0.25rem' }}>·</span>
              <span>{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
            </div>

            {event.location && (
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>
                <span>📍</span>
                <span>{event.location}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem' }}>
              <span style={{
                padding: '0.2rem 0.6rem',
                borderRadius: '12px',
                background: event.color + '20',
                color: event.color,
                fontWeight: 600,
              }}>
                {EVENT_TYPES.find(t => t.value === event.event_type)?.label || event.event_type}
              </span>
              {event.is_recurring && (
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', background: '#f0fdf4', color: '#16a34a', fontWeight: 600 }}>
                  🔄 Recurrente
                </span>
              )}
            </div>

            {/* Attendees, Coffee, TyS badges */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
              {event.attendees_count > 0 && (
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', background: '#f0f9ff', color: '#0369a1', fontWeight: 600 }}>
                  👥 {event.attendees_count} personas
                </span>
              )}
              {event.requires_coffee && (
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                  ☕ Coffee
                </span>
              )}
              {event.requires_tys && (
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', background: '#ede9fe', color: '#5b21b6', fontWeight: 600 }}>
                  🖥️ TyS
                </span>
              )}
              {event.notify_whatsapp && (
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', background: '#d1fae5', color: '#065f46', fontWeight: 600 }}>
                  📱 Notificación WA
                </span>
              )}
            </div>

            {event.description && (
              <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {event.description}
              </div>
            )}

            {/* Links */}
            {event.links && event.links.length > 0 && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.35rem' }}>🔗 Enlaces</label>
                {event.links.map((link, i) => (
                  <a key={i} href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '0.8rem', color: '#0284c7', marginBottom: '0.25rem' }}>
                    {link}
                  </a>
                ))}
              </div>
            )}

            {/* Attachments */}
            <div className="cal-attachments">
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.35rem' }}>📎 Archivos adjuntos</label>
              {attachments.map(att => (
                <div key={att.id} className="cal-attachment-item">
                  <span>📄</span>
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        const url = await calendarService.getSignedDownloadUrl(att.storage_path, att.file_name);
                        window.open(url, '_blank');
                      } catch (err) {
                        console.error('Download error:', err);
                        // Fallback to public URL
                        window.open(calendarService.getAttachmentUrl(att.storage_path), '_blank');
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {att.file_name}
                  </a>
                  {isAdmin && <button className="cal-attachment-delete" onClick={() => handleDeleteAttachment(att)}>✕</button>}
                </div>
              ))}
              {isAdmin && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label className="cal-btn cal-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    {uploading ? 'Subiendo...' : '+ Agregar archivo'}
                    <input type="file" hidden onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="cal-modal-footer">
            {isAdmin && !showDeleteConfirm && !showCancelConfirm && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="cal-btn cal-btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                  🗑 Eliminar
                </button>
                {!isCancelled && (
                  <button className="cal-btn" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }} onClick={() => setShowCancelConfirm(true)}>
                    🚫 Cancelar Evento
                  </button>
                )}
              </div>
            )}
            {showCancelConfirm && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e' }}>¿Cancelar evento?</span>
                <button
                  className="cal-btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
                  onClick={() => { onCancel(event.id, false); }}
                >
                  Solo este
                </button>
                {event.is_recurring && (
                  <button
                    className="cal-btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: '#92400e', color: 'white', border: '1px solid #92400e' }}
                    onClick={() => { onCancel(event.id, true); }}
                  >
                    Todo el grupo
                  </button>
                )}
                <button className="cal-btn cal-btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setShowCancelConfirm(false)}>
                  Volver
                </button>
              </div>
            )}
            {showDeleteConfirm && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#dc2626' }}>¿Eliminar?</span>
                <button
                  className="cal-btn cal-btn-danger"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={() => { onDelete(event.id, false); }}
                >
                  Solo este
                </button>
                {event.is_recurring && (
                  <button
                    className="cal-btn cal-btn-danger"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: '#dc2626', color: 'white', border: '1px solid #dc2626' }}
                    onClick={() => { onDelete(event.id, true); }}
                  >
                    Todo el grupo
                  </button>
                )}
                <button
                  className="cal-btn cal-btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Volver
                </button>
              </div>
            )}
            {!isAdmin && !showDeleteConfirm && !showCancelConfirm && <div></div>}
            {!showDeleteConfirm && !showCancelConfirm && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="cal-btn cal-btn-secondary" onClick={onClose}>Cerrar</button>
                {isAdmin && !isCancelled && <button className="cal-btn cal-btn-primary" onClick={onEdit}>✏️ Editar</button>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== CREATE / EDIT MODE =====
  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal" onClick={e => e.stopPropagation()} style={{
        borderTop: `4px solid ${form.color}`,
        overflow: 'hidden'
      }}>
        <div className="cal-modal-header" style={{
          background: `linear-gradient(135deg, ${form.color}15 0%, transparent 100%)`,
          borderBottom: `1px solid ${form.color}30`
        }}>
          <h2>{isCreateMode ? 'Nuevo Evento' : 'Editar Evento'}</h2>
          <button className="cal-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="cal-modal-body">
          <div className="cal-form-group">
            <label>Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="Nombre del evento"
              autoFocus
            />
          </div>

          <div className="cal-form-row">
            <div className="cal-form-group">
              <label>Inicio</label>
              <input type="datetime-local" value={form.start_time} onChange={e => updateField('start_time', e.target.value)} />
            </div>
            <div className="cal-form-group">
              <label>Fin</label>
              <input type="datetime-local" value={form.end_time} onChange={e => updateField('end_time', e.target.value)} />
            </div>
          </div>

          <div className="cal-form-row">
            <div className="cal-form-group">
              <label>Tipo de evento</label>
              <select value={form.event_type} onChange={e => {
                const type = e.target.value;
                updateField('event_type', type);
                const defaultColor = EVENT_TYPES.find(t => t.value === type)?.color;
                if (defaultColor) updateField('color', defaultColor);
              }}>
                {EVENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="cal-form-group">
              <label>Ubicación</label>
              <select value={form.location} onChange={e => updateField('location', e.target.value)}>
                <option value="Sala de Reuniones">Sala de Reuniones</option>
                <option value="Sala de Ateneo">Sala de Ateneo</option>
              </select>
            </div>
          </div>

          <div className="cal-form-row">
            <div className="cal-form-group">
              <label>👥 Cantidad de personas</label>
              <input
                type="number"
                min="0"
                value={form.attendees_count}
                onChange={e => updateField('attendees_count', e.target.value)}
                placeholder="Ej: 12"
              />
            </div>
            <div className="cal-form-group">
              <label>Color</label>
              <div className="cal-color-picker">
                {COLOR_PALETTE.map(c => (
                  <div
                    key={c}
                    className={`cal-color-swatch ${form.color === c ? 'selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => updateField('color', c)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Coffee, TyS & WhatsApp toggles */}
          <div className="cal-form-row" style={{ gap: '0.75rem', gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="cal-recurrence-toggle" style={{ flex: 1 }}>
              <input
                type="checkbox"
                checked={form.requires_coffee}
                onChange={e => updateField('requires_coffee', e.target.checked)}
                id="coffee-check"
              />
              <label htmlFor="coffee-check" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                ☕ Coffee
              </label>
            </div>
            <div className="cal-recurrence-toggle" style={{ flex: 1 }}>
              <input
                type="checkbox"
                checked={form.requires_tys}
                onChange={e => updateField('requires_tys', e.target.checked)}
                id="tys-check"
              />
              <label htmlFor="tys-check" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                🖥️ TyS
              </label>
            </div>
            <div className="cal-recurrence-toggle" style={{ flex: 1 }}>
              <input
                type="checkbox"
                checked={form.notify_whatsapp}
                onChange={e => updateField('notify_whatsapp', e.target.checked)}
                id="wa-notify-check"
              />
              <label htmlFor="wa-notify-check" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                📱 WA
              </label>
            </div>
          </div>

          {/* Collapsible Recipients Selector */}
          {form.notify_whatsapp && (
            <div className="cal-recipients-section">
              <div
                className="cal-recipients-header"
                onClick={() => setShowRecipients(!showRecipients)}
              >
                <span style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📱 Destinatarios ({selectedContacts.length} seleccionados)
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b', transition: 'transform 0.2s', transform: showRecipients ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </div>

              {showRecipients && (
                <div className="cal-recipients-body">
                  {/* RRHH group */}
                  {contactsByRole.rrhh.length > 0 && (
                    <div className="cal-recipient-group">
                      <div className="cal-recipient-group-header" onClick={() => toggleRoleGroup('rrhh')}>
                        <input type="checkbox" readOnly checked={contactsByRole.rrhh.every(c => selectedContacts.includes(c.id))} />
                        <span>💼 RRHH ({contactsByRole.rrhh.length})</span>
                      </div>
                      <div className="cal-recipient-list">
                        {contactsByRole.rrhh.map(c => (
                          <label key={c.id} className="cal-recipient-item">
                            <input type="checkbox" checked={selectedContacts.includes(c.id)} onChange={() => toggleContact(c.id)} />
                            <span>{c.name}</span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{c.phone}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Aux Limpieza group */}
                  <div className="cal-recipient-group">
                    <div className="cal-recipient-group-header" onClick={() => toggleRoleGroup('limpieza')}>
                      <input type="checkbox" readOnly checked={contactsByRole.limpieza.length > 0 && contactsByRole.limpieza.every(c => selectedContacts.includes(c.id))} />
                      <span>🧹 Aux Limpieza ({contactsByRole.limpieza.length})</span>
                    </div>
                    {contactsByRole.limpieza.length > 0 ? (
                      <div className="cal-recipient-list">
                        {contactsByRole.limpieza.map(c => (
                          <label key={c.id} className="cal-recipient-item">
                            <input type="checkbox" checked={selectedContacts.includes(c.id)} onChange={() => toggleContact(c.id)} />
                            <span>{c.name}</span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{c.phone}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        ⚠️ No hay contactos de Limpieza. Agregalos desde "Contactos WA".
                      </div>
                    )}
                  </div>

                  {/* Cocina group */}
                  <div className="cal-recipient-group">
                    <div className="cal-recipient-group-header" onClick={() => toggleRoleGroup('cocina')} style={form.requires_coffee ? { background: '#fef3c7', borderColor: '#fde68a' } : {}}>
                      <input type="checkbox" readOnly checked={contactsByRole.cocina.length > 0 && contactsByRole.cocina.every(c => selectedContacts.includes(c.id))} />
                      <span>☕ Cocina ({contactsByRole.cocina.length})</span>
                      {form.requires_coffee && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#92400e', background: '#fde68a', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>AUTO</span>}
                    </div>
                    {contactsByRole.cocina.length > 0 ? (
                      <div className="cal-recipient-list">
                        {contactsByRole.cocina.map(c => (
                          <label key={c.id} className="cal-recipient-item">
                            <input type="checkbox" checked={selectedContacts.includes(c.id)} onChange={() => toggleContact(c.id)} />
                            <span>{c.name}</span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{c.phone}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        ⚠️ No hay contactos de Cocina. Agregalos desde "Contactos WA".
                      </div>
                    )}
                  </div>

                  {/* TyS group */}
                  <div className="cal-recipient-group">
                    <div className="cal-recipient-group-header" onClick={() => toggleRoleGroup('tys')} style={form.requires_tys ? { background: '#ede9fe', borderColor: '#c4b5fd' } : {}}>
                      <input type="checkbox" readOnly checked={contactsByRole.tys.length > 0 && contactsByRole.tys.every(c => selectedContacts.includes(c.id))} />
                      <span>🖥️ TyS ({contactsByRole.tys.length})</span>
                      {form.requires_tys && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#5b21b6', background: '#ddd6fe', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>AUTO</span>}
                    </div>
                    {contactsByRole.tys.length > 0 ? (
                      <div className="cal-recipient-list">
                        {contactsByRole.tys.map(c => (
                          <label key={c.id} className="cal-recipient-item">
                            <input type="checkbox" checked={selectedContacts.includes(c.id)} onChange={() => toggleContact(c.id)} />
                            <span>{c.name}</span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{c.phone}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        ⚠️ No hay contactos de TyS. Agregalos desde "Contactos WA".
                      </div>
                    )}
                  </div>

                  {/* General/sin categoría (legacy) */}
                  {contactsByRole.general.length > 0 && (
                    <div className="cal-recipient-group">
                      <div className="cal-recipient-group-header" onClick={() => toggleRoleGroup('general')}>
                        <input type="checkbox" readOnly checked={contactsByRole.general.every(c => selectedContacts.includes(c.id))} />
                        <span>👤 Sin categoría ({contactsByRole.general.length})</span>
                      </div>
                      <div className="cal-recipient-list">
                        {contactsByRole.general.map(c => (
                          <label key={c.id} className="cal-recipient-item">
                            <input type="checkbox" checked={selectedContacts.includes(c.id)} onChange={() => toggleContact(c.id)} />
                            <span>{c.name}</span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{c.phone}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="cal-form-group">
            <label>Descripción</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder="Notas, detalles del evento..."
            />
          </div>

          {/* Recurrence */}
          <div className="cal-recurrence-toggle">
            <input
              type="checkbox"
              checked={form.is_recurring}
              onChange={e => {
                const checked = e.target.checked;
                updateField('is_recurring', checked);
                // Auto-select the event's day of week when enabling recurrence
                if (checked && form.recurrence_days.length === 0) {
                  const eventDay = new Date(form.start_time).getDay();
                  updateField('recurrence_days', [eventDay]);
                }
              }}
              id="recurrence-check"
            />
            <label htmlFor="recurrence-check" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
              🔄 Evento recurrente (repetir semanalmente)
            </label>
          </div>

          {form.is_recurring && (
            <div style={{ paddingLeft: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem', display: 'block' }}>
                Repetir los días:
              </label>
              <div className="cal-recurrence-days">
                {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((label, idx) => (
                  <div
                    key={idx}
                    className={`cal-day-check ${form.recurrence_days.includes(idx) ? 'selected' : ''}`}
                    onClick={() => toggleRecurrenceDay(idx)}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Hasta:</label>
                <input
                  type="date"
                  value={form.recurrence_until}
                  onChange={e => updateField('recurrence_until', e.target.value)}
                  style={{ marginLeft: '0.5rem', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          )}

          {/* Links */}
          <div className="cal-form-group">
            <label>🔗 Enlaces</label>
            {form.links.map((link, i) => (
              <div key={i} className="cal-link-item">
                <input type="text" value={link} readOnly style={{ flex: 1, fontSize: '0.8rem', background: '#f8fafc' }} />
                <button className="cal-attachment-delete" onClick={() => removeLink(i)}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="url"
                value={newLink}
                onChange={e => setNewLink(e.target.value)}
                placeholder="https://..."
                onKeyDown={e => e.key === 'Enter' && addLink()}
                style={{ flex: 1, padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}
              />
              <button className="cal-btn cal-btn-secondary" onClick={addLink} style={{ padding: '0.4rem 0.75rem' }}>+</button>
            </div>
          </div>

          {/* Attachments */}
          <div className="cal-form-group">
            <label>📎 Archivos adjuntos</label>
            {/* Already uploaded (edit mode) */}
            {attachments.map(att => (
              <div key={att.id} className="cal-link-item" style={{ fontSize: '0.8rem' }}>
                <span>📄</span>
                <a href={calendarService.getAttachmentUrl(att.storage_path)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, color: '#0284c7' }}>
                  {att.file_name}
                </a>
                <button className="cal-attachment-delete" onClick={() => handleDeleteAttachment(att)}>✕</button>
              </div>
            ))}
            {/* Pending files (create mode) */}
            {pendingFiles.map((file, i) => (
              <div key={i} className="cal-link-item" style={{ fontSize: '0.8rem' }}>
                <span>📄</span>
                <span style={{ flex: 1, color: '#64748b' }}>{file.name} <span style={{ color: '#94a3b8' }}>({(file.size / 1024).toFixed(0)} KB)</span></span>
                <button className="cal-attachment-delete" onClick={() => removePendingFile(i)}>✕</button>
              </div>
            ))}
            <div style={{ marginTop: '0.35rem' }}>
              <label className="cal-btn cal-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                {uploading ? '⏳ Subiendo...' : '+ Agregar archivo'}
                <input type="file" hidden onChange={handleFileUpload} disabled={uploading} multiple />
              </label>
            </div>
          </div>
        </div>

        <div className="cal-modal-footer">
          <div></div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="cal-btn cal-btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="cal-btn cal-btn-primary" onClick={handleSubmit}>
              {isCreateMode ? '✓ Crear Evento' : '✓ Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: Convert Date to local ISO string for datetime-local input
function toLocalISOString(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ===== LOGIN SCREEN =====
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0f9ff 100%)',
      fontFamily: "'Inter', sans-serif"
    }}>
      <form onSubmit={handleLogin} style={{
        background: 'white', borderRadius: '16px', padding: '2.5rem',
        width: '100%', maxWidth: '420px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', gap: '1.5rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logosanatorio.png" alt="Sanatorio Argentino" style={{ height: '48px', marginBottom: '0.75rem' }} />
          <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', color: '#0c4a6e', fontWeight: 700 }}>
            Agenda de Salas
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Acceso Administrador — RRHH
          </p>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem', borderRadius: '8px', background: '#fef2f2',
            color: '#dc2626', fontSize: '0.85rem', border: '1px solid #fecaca'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="admin@sanatorio.local" required autoFocus
            style={{
              padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0',
              fontSize: '0.9rem', outline: 'none', transition: 'border 0.2s'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Contraseña</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required
            style={{
              padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0',
              fontSize: '0.9rem', outline: 'none', transition: 'border 0.2s'
            }}
          />
        </div>

        <button type="submit" disabled={loading} style={{
          padding: '0.85rem', borderRadius: '8px', border: 'none',
          background: '#0284c7', color: 'white', fontWeight: 700,
          fontSize: '0.95rem', cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1, transition: 'all 0.2s'
        }}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>

        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
          <a href="/agenda.html" style={{ color: '#0284c7', textDecoration: 'none' }}>
            Ver agenda en modo lectura →
          </a>
        </div>
      </form>
    </div>
  );
}

// ===== CONTACTS PANEL =====
function ContactsPanel({ onClose }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('rrhh');
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const ROLE_CONFIG = {
    rrhh: { label: '💼 RRHH', bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    limpieza: { label: '🧹 Aux Limpieza', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    cocina: { label: '☕ Cocina', bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    tys: { label: '🖥️ TyS', bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
    general: { label: '👤 Sin cat.', bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' },
  };

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_contacts')
        .select('*')
        .order('name');
      if (error) throw error;
      setContacts(data || []);
    } catch (e) {
      console.error('Error loading contacts:', e);
    }
    setLoading(false);
  };

  useEffect(() => { loadContacts(); }, []);

  const handleAdd = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_contacts')
        .insert({ name: newName.trim(), phone: newPhone.trim(), role: newRole });
      if (error) throw error;
      setNewName('');
      setNewPhone('');
      setNewRole('general');
      await loadContacts();
    } catch (e) {
      console.error('Error adding contact:', e);
      alert('Error al agregar contacto');
    }
    setSaving(false);
  };

  const handleToggle = async (contact) => {
    try {
      const { error } = await supabase
        .from('notification_contacts')
        .update({ is_active: !contact.is_active })
        .eq('id', contact.id);
      if (error) throw error;
      await loadContacts();
    } catch (e) {
      console.error('Error toggling contact:', e);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este contacto?')) return;
    try {
      const { error } = await supabase
        .from('notification_contacts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadContacts();
    } catch (e) {
      console.error('Error deleting contact:', e);
    }
  };

  const handleSendTest = async (contact) => {
    setTestingId(contact.id);
    setTestResult(null);
    try {
      const result = await sendTestMessage(contact.phone);
      setTestResult({ id: contact.id, ...result });
    } catch (e) {
      setTestResult({ id: contact.id, success: false, error: e.message });
    }
    setTestingId(null);
  };

  const handleRoleChange = async (contact, role) => {
    try {
      const { error } = await supabase
        .from('notification_contacts')
        .update({ role })
        .eq('id', contact.id);
      if (error) throw error;
      await loadContacts();
    } catch (e) {
      console.error('Error changing role:', e);
    }
  };

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <div className="cal-modal-header">
          <h2>📱 Contactos de Notificación</h2>
          <button className="cal-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="cal-modal-body">
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0' }}>
            Estas personas recibirán un mensaje de WhatsApp <strong>20 minutos antes</strong> de cada evento con notificación activa.
          </p>

          {loading ? (
            <p style={{ textAlign: 'center', color: '#94a3b8' }}>Cargando...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {contacts.length === 0 && (
                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No hay contactos registrados.
                </p>
              )}
              {contacts.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem', borderRadius: '10px',
                  background: c.is_active ? '#f0fdf4' : '#f8fafc',
                  border: `1px solid ${c.is_active ? '#bbf7d0' : '#e2e8f0'}`,
                  transition: 'all 0.2s'
                }}>
                  <button
                    onClick={() => handleToggle(c)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '1.2rem', padding: 0, lineHeight: 1
                    }}
                    title={c.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {c.is_active ? '✅' : '⬜'}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: c.is_active ? '#1e293b' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {c.name}
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        background: ROLE_CONFIG[c.role || 'general']?.bg,
                        color: ROLE_CONFIG[c.role || 'general']?.color,
                      }}>{ROLE_CONFIG[c.role || 'general']?.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                      📞 {c.phone}
                      <select
                        value={c.role || 'general'}
                        onChange={e => handleRoleChange(c, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: '0.7rem', padding: '0.1rem 0.25rem', borderRadius: '4px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                      >
                        <option value="rrhh">RRHH</option>
                        <option value="limpieza">Aux Limpieza</option>
                        <option value="cocina">Cocina</option>
                        <option value="tys">TyS</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ef4444', fontSize: '1rem', padding: '0.25rem'
                    }}
                    title="Eliminar"
                  >
                    🗑
                  </button>
                  <button
                    onClick={() => handleSendTest(c)}
                    disabled={testingId === c.id}
                    style={{
                      background: testResult?.id === c.id && testResult?.success ? '#d1fae5' : '#f0f9ff',
                      border: '1px solid ' + (testResult?.id === c.id && testResult?.success ? '#10b981' : '#0284c7'),
                      borderRadius: '6px', cursor: testingId === c.id ? 'wait' : 'pointer',
                      color: testResult?.id === c.id && testResult?.success ? '#065f46' : '#0284c7',
                      fontSize: '0.75rem', padding: '0.25rem 0.5rem', fontWeight: 600,
                      opacity: testingId === c.id ? 0.5 : 1
                    }}
                    title="Enviar mensaje de prueba"
                  >
                    {testingId === c.id ? '⏳' : testResult?.id === c.id && testResult?.success ? '✅ Enviado' : '📲 Probar'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new contact */}
          <div style={{
            padding: '1rem', borderRadius: '10px', background: '#f8fafc',
            border: '1px solid #e2e8f0'
          }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.75rem' }}>
              ➕ Agregar contacto
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Nombre" style={{
                  flex: 1, minWidth: '100px', padding: '0.5rem', borderRadius: '6px',
                  border: '1px solid #e2e8f0', fontSize: '0.85rem'
                }}
              />
              <input
                type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                placeholder="543492XXXXXX" style={{
                  flex: 1, minWidth: '120px', padding: '0.5rem', borderRadius: '6px',
                  border: '1px solid #e2e8f0', fontSize: '0.85rem'
                }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <select
                value={newRole} onChange={e => setNewRole(e.target.value)}
                style={{
                  padding: '0.5rem', borderRadius: '6px',
                  border: '1px solid #e2e8f0', fontSize: '0.85rem',
                  background: ROLE_CONFIG[newRole]?.bg,
                  color: ROLE_CONFIG[newRole]?.color,
                  fontWeight: 600,
                }}
              >
                <option value="rrhh">💼 RRHH</option>
                <option value="limpieza">🧹 Aux Limpieza</option>
                <option value="cocina">☕ Cocina</option>
                <option value="tys">🖥️ TyS</option>
              </select>
              <button
                onClick={handleAdd} disabled={saving}
                className="cal-btn cal-btn-primary"
                style={{ padding: '0.5rem 1rem' }}
              >
                {saving ? '...' : '+ Agregar'}
              </button>
            </div>
          </div>
        </div>

        <div className="cal-modal-footer">
          <div></div>
          <button className="cal-btn cal-btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
