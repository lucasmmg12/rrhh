import { useState, useCallback, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar.jsx';

// Lazy load heavy modules for performance
const OrganigramaApp = lazy(() => import('./App.jsx'));
const CalendarApp = lazy(() => import('./calendario/CalendarApp.jsx'));
const FichadasApp = lazy(() => import('./fichadas/FichadasApp.jsx'));
const AuditoriaApp = lazy(() => import('./auditoria/AuditoriaApp.jsx'));
const EfemeridesApp = lazy(() => import('./efemerides/EfemeridesApp.jsx'));

// Loading spinner
function LoadingSpinner({ label = 'Cargando módulo...' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: 'calc(100vh - 80px)', gap: '1rem', color: 'var(--neutral-400)',
    }}>
      <div style={{
        width: 40, height: 40,
        border: '4px solid var(--neutral-200)',
        borderTop: '4px solid var(--primary-500)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <p style={{ fontSize: '0.85rem' }}>{label}</p>
    </div>
  );
}

// Home Panel
function HomePanel() {
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Buenos días' : now.getHours() < 18 ? 'Buenas tardes' : 'Buenas noches';

  const modules = [
    {
      id: 'organigrama',
      title: 'Organigrama',
      description: 'Estructura organizacional del Sanatorio',
      icon: '🏛️',
      color: '#1E5FA6',
      bg: '#EBF2FA',
    },
    {
      id: 'calendario',
      title: 'Agenda de Salas',
      description: 'Reservas y calendario de quirófanos',
      icon: '📅',
      color: '#0284C7',
      bg: '#E0F2FE',
    },
    {
      id: 'fichadas',
      title: 'Control de Fichadas',
      description: 'Gestión horaria de colaboradores',
      icon: '⏰',
      color: '#7C3AED',
      bg: '#EDE9FE',
    },
    {
      id: 'auditoria',
      title: 'Auditoría en Terreno',
      description: 'Checklist de inspección en campo',
      icon: '✅',
      color: '#059669',
      bg: '#D1FAE5',
    },
    {
      id: 'efemerides',
      title: 'Efemérides',
      description: 'Cumpleaños y fechas especiales',
      icon: '🎂',
      color: '#D97706',
      bg: '#FEF3C7',
    },
  ];

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontSize: '1.5rem', fontWeight: 800, color: 'var(--neutral-800)',
          margin: 0,
        }}>
          {greeting} 👋
        </h2>
        <p style={{
          fontSize: '0.9rem', color: 'var(--neutral-500)', margin: '0.25rem 0 0',
        }}>
          Bienvenido al sistema de Recursos Humanos
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
      }}>
        {modules.map(mod => (
          <button
            key={mod.id}
            onClick={() => window.__setActiveView?.(mod.id)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '1rem',
              padding: '1.25rem', background: '#fff',
              border: '1px solid var(--neutral-200)',
              borderRadius: '12px', cursor: 'pointer',
              transition: 'all 0.2s', textAlign: 'left',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = mod.color;
              e.currentTarget.style.boxShadow = `0 4px 12px ${mod.color}20`;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = 'var(--neutral-200)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: '12px',
              background: mod.bg, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', flexShrink: 0,
            }}>
              {mod.icon}
            </div>
            <div>
              <div style={{
                fontSize: '0.95rem', fontWeight: 700,
                color: 'var(--neutral-800)',
              }}>
                {mod.title}
              </div>
              <div style={{
                fontSize: '0.78rem', color: 'var(--neutral-500)',
                marginTop: '2px', lineHeight: 1.4,
              }}>
                {mod.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Placeholder for modules not yet built
function PlaceholderPanel({ title, icon }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: 'calc(100vh - 80px)', gap: '1rem', color: 'var(--neutral-400)',
    }}>
      <div style={{ fontSize: '3rem' }}>{icon}</div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--neutral-600)', margin: 0 }}>
        {title}
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--neutral-400)' }}>
        Este módulo está en desarrollo
      </p>
    </div>
  );
}


export default function RRHHApp() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('rrhh_sidebar_collapsed') === 'true'
  );
  const [activeView, setActiveViewRaw] = useState(() =>
    localStorage.getItem('rrhh_active_view') || 'inicio'
  );

  const setActiveView = useCallback((view) => {
    setActiveViewRaw(view);
    localStorage.setItem('rrhh_active_view', view);
  }, []);

  // Expose for HomePanel cards
  window.__setActiveView = setActiveView;

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('rrhh_sidebar_collapsed', next);
      return next;
    });
  }, []);

  // Title mapping
  const titles = {
    inicio: 'Inicio',
    organigrama: 'Organigrama Institucional',
    calendario: 'Agenda de Salas',
    fichadas: 'Control de Fichadas',
    auditoria: 'Auditoría en Terreno',
    efemerides: 'Efemérides',
    config: 'Configuración',
  };

  return (
    <div className="app">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleToggleSidebar}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <main className={`main ${sidebarCollapsed ? 'main--expanded' : ''}`}>
        {/* Top Bar */}
        <header className="topbar">
          <div>
            <h1 className="topbar__title">
              <span className="topbar__title-accent">RRHH</span> {titles[activeView] || ''}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="topbar__date">
              {new Date().toLocaleDateString('es-AR', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </span>
          </div>
        </header>

        {/* Content */}
        <Suspense fallback={<LoadingSpinner />}>
          {activeView === 'inicio' && <HomePanel />}

          {activeView === 'organigrama' && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <OrganigramaApp embedded />
            </div>
          )}

          {activeView === 'calendario' && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <CalendarApp embedded />
            </div>
          )}

          {activeView === 'fichadas' && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <FichadasApp embedded />
            </div>
          )}

          {activeView === 'auditoria' && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <AuditoriaApp embedded />
            </div>
          )}

          {activeView === 'efemerides' && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <EfemeridesApp embedded />
            </div>
          )}

          {activeView === 'config' && (
            <PlaceholderPanel title="Configuración" icon="⚙️" />
          )}
        </Suspense>
      </main>
    </div>
  );
}
