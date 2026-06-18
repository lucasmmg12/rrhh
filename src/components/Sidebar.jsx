import { useState } from 'react';
import {
  Home, Building2, Calendar, Clock, ClipboardCheck, CalendarHeart,
  PanelLeftClose, PanelLeft, ChevronDown, Settings, Timer, HelpCircle,
  BarChart3, UserPlus,
} from 'lucide-react';

export default function Sidebar({ collapsed, onToggle, activeView, onViewChange }) {
  const [auditOpen, setAuditOpen] = useState(false);
  const [metricasOpen, setMetricasOpen] = useState(false);

  // Sub-items dentro de "Auditoría"
  const auditSubItems = [
    { id: 'auditoria', label: 'Nueva Auditoría', icon: ClipboardCheck },
  ];

  const isAuditActive = auditSubItems.some(i => activeView === i.id);

  // Helper to render a collapsible group
  function renderGroup({ label, icon: GroupIcon, isOpen, setOpen, isGroupActive, subItems }) {
    if (collapsed) {
      return subItems.map(item => {
        const Icon = item.icon;
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
            onClick={() => onViewChange(item.id)}
            title={item.label}
          >
            <Icon size={20} className="sidebar__item-icon" />
            {isActive && <div className="sidebar__item-indicator" />}
          </button>
        );
      });
    }

    return (
      <div style={{ marginBottom: '4px' }}>
        <button
          onClick={() => setOpen(prev => !prev)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', padding: '10px 16px', border: 'none',
            background: isGroupActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            color: isGroupActive ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer', borderRadius: 'var(--radius-md, 8px)',
            fontSize: '0.82rem', fontWeight: 700, transition: 'all 0.15s',
            textAlign: 'left',
          }}
        >
          <GroupIcon size={20} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{label}</span>
          <ChevronDown size={14} style={{
            transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            opacity: 0.5,
          }} />
        </button>

        {isOpen && (
          <div className="animate-fade-in" style={{
            marginLeft: '20px', borderLeft: '2px solid rgba(255, 255, 255, 0.2)',
            paddingLeft: '0', marginTop: '2px',
          }}>
            {subItems.map(item => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
                  onClick={() => onViewChange(item.id)}
                  style={{ paddingLeft: '14px', fontSize: '0.8rem' }}
                >
                  <Icon size={17} className="sidebar__item-icon" />
                  <span className="sidebar__item-label">{item.label}</span>
                  {isActive && <div className="sidebar__item-indicator" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Animated video background */}
      <div className="sidebar__video-bg">
        <video
          src="/anima_la_imagen_202606091409.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
      </div>
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <img
            src="/logosanatorio.png"
            alt="Sanatorio Argentino"
            className="sidebar__logo-img"
            style={{
              width: collapsed ? 32 : 38,
              height: collapsed ? 32 : 38,
              borderRadius: '8px',
              objectFit: 'contain',
            }}
          />
          {!collapsed && (
            <div className="sidebar__brand-text animate-fade-in">
              <span className="sidebar__brand-name" style={{ display: 'flex' }}>
                {'RRHH'.split('').map((char, i) => (
                  <span key={i} style={{ display: 'inline-block', animation: 'title-wave 3s ease-in-out infinite', animationDelay: `${i * 0.08}s` }}>{char}</span>
                ))}
              </span>
              <span className="sidebar__brand-sub" style={{ display: 'flex' }}>
                {'Sanatorio Argentino'.split('').map((char, i) => (
                  <span key={i} style={{ display: 'inline-block', animation: 'title-wave 3s ease-in-out infinite', animationDelay: `${(i + 4) * 0.08}s` }}>{char === ' ' ? '\u00A0' : char}</span>
                ))}
              </span>
            </div>
          )}
        </div>
        <button
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="sidebar__nav">
        {/* ─── Inicio ─── */}
        {(() => {
          const isActive = activeView === 'inicio';
          return (
            <button
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => onViewChange('inicio')}
              title={collapsed ? 'Inicio' : undefined}
            >
              <Home size={20} className="sidebar__item-icon" />
              {!collapsed && <span className="sidebar__item-label">Inicio</span>}
              {isActive && <div className="sidebar__item-indicator" />}
            </button>
          );
        })()}

        {/* ─── Items individuales ─── */}
        {[
          { id: 'organigrama', label: 'Organigrama', icon: Building2 },
          { id: 'calendario', label: 'Agenda de Salas', icon: Calendar },
          { id: 'fichadas', label: 'Control de Fichadas', icon: Clock },
          { id: 'controlhorario', label: 'Control Horario — Sede SF', icon: Timer },
          { id: 'prestadores', label: 'Prestadores', icon: UserPlus },
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => onViewChange(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} className="sidebar__item-icon" />
              {!collapsed && <span className="sidebar__item-label">{item.label}</span>}
              {isActive && <div className="sidebar__item-indicator" />}
            </button>
          );
        })}

        {/* ─── Separador visual ─── */}
        {!collapsed && (
          <div style={{
            height: '1px', background: 'var(--neutral-200, #E2E8F0)',
            margin: '4px 16px 4px',
          }} />
        )}

        {/* ─── Métricas (collapsible) ─── */}
        {renderGroup({
          label: 'Métricas',
          icon: BarChart3,
          isOpen: metricasOpen,
          setOpen: setMetricasOpen,
          isGroupActive: activeView === 'metricas-sf',
          subItems: [
            { id: 'metricas-sf', label: 'Santa Fe', icon: BarChart3 },
          ],
        })}

        {/* ─── Auditoría ─── */}
        {(() => {
          const isActive = activeView === 'auditoria';
          return (
            <button
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => onViewChange('auditoria')}
              title={collapsed ? 'Seguimiento de Sede' : undefined}
            >
              <ClipboardCheck size={20} className="sidebar__item-icon" />
              {!collapsed && <span className="sidebar__item-label">Seguimiento y Acompañamiento de Sede</span>}
              {isActive && <div className="sidebar__item-indicator" />}
            </button>
          );
        })()}

        {/* ─── Efemérides (placeholder) ─── */}
        {(() => {
          const isActive = activeView === 'efemerides';
          return (
            <button
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => onViewChange('efemerides')}
              title={collapsed ? 'Efemérides' : undefined}
            >
              <CalendarHeart size={20} className="sidebar__item-icon" />
              {!collapsed && <span className="sidebar__item-label">Efemérides</span>}
              {isActive && <div className="sidebar__item-indicator" />}
            </button>
          );
        })()}

        {/* ─── Ayuda Control Horario ─── */}
        {(() => {
          const isActive = activeView === 'ayuda-ch';
          return (
            <button
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => onViewChange('ayuda-ch')}
              title={collapsed ? 'Ayuda Control Horario' : undefined}
            >
              <HelpCircle size={20} className="sidebar__item-icon" />
              {!collapsed && <span className="sidebar__item-label">Ayuda Control Horario</span>}
              {isActive && <div className="sidebar__item-indicator" />}
            </button>
          );
        })()}

        {/* ─── Configuración ─── */}
        {(() => {
          const isActive = activeView === 'config';
          return (
            <button
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => onViewChange('config')}
              title={collapsed ? 'Configuración' : undefined}
            >
              <Settings size={20} className="sidebar__item-icon" />
              {!collapsed && <span className="sidebar__item-label">Configuración</span>}
              {isActive && <div className="sidebar__item-indicator" />}
            </button>
          );
        })()}
      </nav>

      <div className="sidebar__footer">
        {!collapsed && (
          <div className="sidebar__footer-info animate-fade-in">
            <p className="sidebar__footer-version">Sistema RRHH v1.0</p>
            <p className="sidebar__footer-by">Creado por Innovación y Transformación Digital</p>
          </div>
        )}
      </div>
    </aside>
  );
}
