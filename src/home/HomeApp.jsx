import React, { useState } from 'react';

const MODULES = [
  {
    id: 'organigrama',
    icon: '🏢',
    title: 'Organigrama Institucional',
    description: 'Visualizá y editá la estructura jerárquica completa del Sanatorio. Arrastrá nodos, editá cargos y exportá.',
    badge: 'Interactivo',
    badgeColor: '#0284c7',
    href: '/organigrama.html',
    color: '#0284c7',
    bgGradient: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
  },
  {
    id: 'calendario',
    icon: '📅',
    title: 'Calendario & Reservas',
    description: 'Gestión de salas de reuniones y ateneo. Creá eventos, configurá recurrencia y notificaciones WhatsApp.',
    badge: 'Admin',
    badgeColor: '#059669',
    href: '/calendario.html',
    color: '#059669',
    bgGradient: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
  },
  {
    id: 'agenda',
    icon: '📋',
    title: 'Agenda Pública',
    description: 'Vista de solo lectura del calendario. Sin login, accesible para todo el personal del Sanatorio.',
    badge: 'Público',
    badgeColor: '#d97706',
    href: '/agenda.html',
    color: '#d97706',
    bgGradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
  },
];

const HELP_SECTIONS = [
  {
    icon: '🏢',
    title: 'Organigrama Institucional',
    topics: [
      { q: '¿Cómo navego el organigrama?', a: 'Al ingresar verás la estructura jerárquica completa. Podés hacer zoom con la rueda del mouse, arrastrar para mover la vista, y hacer clic en cualquier nodo para ver los detalles del cargo.' },
      { q: '¿Cómo edito un cargo?', a: 'Hacé clic en un nodo del organigrama, se abrirá el panel de detalles a la derecha. Desde ahí podés editar el nombre del cargo, la persona asignada, foto, y más datos.' },
      { q: '¿Cómo agrego un nuevo puesto?', a: 'Usá el botón "+" en la barra superior. Se abrirá un formulario donde podés definir el nuevo cargo, asignarlo a un área padre y completar los datos.' },
      { q: '¿Cómo reorganizo la estructura?', a: 'Podés arrastrar y soltar nodos para reubicarlos en la jerarquía. Los cambios se guardan automáticamente en la base de datos.' },
    ]
  },
  {
    icon: '📅',
    title: 'Calendario & Reservas de Salas',
    topics: [
      { q: '¿Cómo creo un evento?', a: 'Iniciá sesión como administrador, luego hacé clic en cualquier día del calendario. Se abrirá un formulario donde podés definir título, horario, sala (Reuniones o Ateneo), cantidad de personas y si requiere coffee.' },
      { q: '¿Cómo configuro eventos recurrentes?', a: 'Al crear un evento, activá el toggle "Evento recurrente". Se marcarán automáticamente los días de la semana y podés definir hasta cuándo se repite. El sistema crea copias del evento en las fechas futuras.' },
      { q: '¿Cómo funcionan las notificaciones WhatsApp?', a: 'Activá "Notificar por WA (20 min antes)" en el evento. El sistema enviará un mensaje automático a todos los contactos activos configurados en "Contactos WA", 20 minutos antes del evento.' },
      { q: '¿Cómo gestiono los contactos de notificación?', a: 'Desde el botón "Contactos WA" en la barra superior podés agregar, editar y desactivar los teléfonos que recibirán las notificaciones.' },
      { q: '¿Cómo adjunto archivos a un evento?', a: 'Al ver o editar un evento, usá el botón "+ Agregar archivo" para subir documentos. Los archivos quedan asociados al evento y cualquiera puede descargarlos.' },
      { q: '¿Cómo elimino un evento recurrente?', a: 'Al tocar "Eliminar" en un evento recurrente, el sistema te da dos opciones: eliminar solo ese evento o eliminar todo el grupo de recurrencia.' },
    ]
  },
  {
    icon: '📋',
    title: 'Agenda Pública (Solo Lectura)',
    topics: [
      { q: '¿Quién puede ver la agenda pública?', a: 'Cualquier persona con el link puede acceder. No requiere login. Es ideal para el personal de limpieza y auxiliares.' },
      { q: '¿Qué información se muestra?', a: 'Se ven todos los eventos programados con horario, sala, y detalles. No se pueden crear, editar ni eliminar eventos desde esta vista.' },
      { q: '¿Cómo accedo?', a: 'Entrá directamente a /agenda.html o usá el link "Agenda Pública" desde cualquier otra sección del sistema.' },
    ]
  },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatDate() {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const d = new Date();
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

export default function HomeApp() {
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (idx) => {
    setExpandedSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const [expandedTopics, setExpandedTopics] = useState({});
  const toggleTopic = (sIdx, tIdx) => {
    const key = `${sIdx}-${tIdx}`;
    setExpandedTopics(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#f8fafc',
      minHeight: '100vh',
    }}>
      {/* HEADER */}
      <header style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.75rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/logosanatorio.png" alt="Sanatorio Argentino" style={{ height: 32, objectFit: 'contain' }} />
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
              RRHH <span style={{ color: '#0284c7' }}>Sanatorio Argentino</span>
            </h1>
            <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>Sistema de gestión integral</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>{formatDate()}</span>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: '0.8rem',
          }}>SA</div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* WELCOME BANNER */}
        <div style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #075985 100%)',
          borderRadius: 16,
          padding: '2rem 2.5rem',
          color: 'white',
          marginBottom: '2.5rem',
          boxShadow: '0 10px 25px rgba(3, 105, 161, 0.3)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', right: -30, top: -30,
            width: 150, height: 150, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }} />
          <div style={{
            position: 'absolute', right: 60, bottom: -40,
            width: 100, height: 100, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }} />

          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, marginBottom: '0.5rem' }}>
            {getGreeting()} 👋
          </h2>
          <p style={{ fontSize: '0.9rem', opacity: 0.9, margin: 0, marginBottom: '1.25rem', maxWidth: 500, lineHeight: 1.5 }}>
            Bienvenido al <strong>Sistema de RRHH</strong> del Sanatorio Argentino.
            Desde acá podés gestionar el organigrama institucional, reservar salas y coordinar reuniones.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {MODULES.map(m => (
              <a key={m.id} href={m.href} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                borderRadius: 20,
                color: 'white',
                textDecoration: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.2)',
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                <span>{m.icon}</span>
                <span>{m.title.split(' ')[0]}</span>
                <span style={{
                  fontSize: '0.65rem', padding: '0.1rem 0.35rem',
                  background: 'rgba(255,255,255,0.2)', borderRadius: 8,
                }}>{m.badge}</span>
              </a>
            ))}
          </div>
        </div>

        {/* MODULES GRID */}
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🚀 Módulos del Sistema
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
          {MODULES.map(m => (
            <a key={m.id} href={m.href} style={{
              background: 'white',
              borderRadius: 12,
              padding: '1.5rem',
              textDecoration: 'none',
              border: '1px solid #e2e8f0',
              transition: 'all 0.2s',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.08)';
                e.currentTarget.style.borderColor = m.color;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: m.bgGradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', marginBottom: '0.75rem',
              }}>
                {m.icon}
              </div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
                {m.title}
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                {m.description}
              </p>
              <div style={{
                display: 'inline-block', marginTop: '0.75rem',
                padding: '0.2rem 0.5rem', borderRadius: 8,
                background: `${m.color}15`, color: m.color,
                fontSize: '0.7rem', fontWeight: 600,
              }}>
                {m.badge}
              </div>
            </a>
          ))}
        </div>

        {/* HELP / GUIDE SECTION */}
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📖 Guía del Usuario
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem 0' }}>
          Tocá cada sección para aprender cómo usar el sistema paso a paso.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {HELP_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} style={{
              background: 'white',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              transition: 'all 0.2s',
            }}>
              {/* Section Header */}
              <button
                onClick={() => toggleSection(sIdx)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  background: 'white', border: 'none', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: '#f1f5f9', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.2rem',
                  }}>{section.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{section.title}</h4>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                      {section.topics.length} {section.topics.length === 1 ? 'tema' : 'temas'}
                    </p>
                  </div>
                </div>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600, color: '#0284c7',
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                }}>
                  {section.topics.length} {section.topics.length === 1 ? 'tema' : 'temas'}
                  <span style={{
                    transform: expandedSections[sIdx] ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s', display: 'inline-block',
                  }}>▾</span>
                </span>
              </button>

              {/* Topics */}
              {expandedSections[sIdx] && (
                <div style={{
                  borderTop: '1px solid #e2e8f0',
                  padding: '0.5rem',
                }}>
                  {section.topics.map((topic, tIdx) => {
                    const key = `${sIdx}-${tIdx}`;
                    return (
                      <div key={tIdx} style={{
                        borderRadius: 8,
                        overflow: 'hidden',
                        marginBottom: tIdx < section.topics.length - 1 ? '0.25rem' : 0,
                      }}>
                        <button
                          onClick={() => toggleTopic(sIdx, tIdx)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0.65rem 0.75rem',
                            background: expandedTopics[key] ? '#f0f9ff' : 'transparent',
                            border: 'none', cursor: 'pointer',
                            borderRadius: 8, transition: 'background 0.15s',
                            textAlign: 'left',
                          }}
                          onMouseEnter={e => !expandedTopics[key] && (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => !expandedTopics[key] && (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                            {topic.q}
                          </span>
                          <span style={{
                            fontSize: '0.8rem', color: '#94a3b8',
                            transform: expandedTopics[key] ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s', display: 'inline-block',
                            flexShrink: 0, marginLeft: '0.5rem',
                          }}>▾</span>
                        </button>
                        {expandedTopics[key] && (
                          <div style={{
                            padding: '0.5rem 0.75rem 0.75rem 0.75rem',
                            fontSize: '0.82rem',
                            color: '#475569',
                            lineHeight: 1.6,
                            background: '#f0f9ff',
                            borderRadius: '0 0 8px 8px',
                          }}>
                            {topic.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <footer style={{
          marginTop: '3rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#94a3b8',
        }}>
          <p style={{ margin: 0 }}>Sanatorio Argentino — Sistema de RRHH · Desarrollado por <strong>Innovación y Transformación Digital</strong></p>
          <p style={{ margin: '0.25rem 0 0 0' }}>© {new Date().getFullYear()}</p>
        </footer>
      </main>
    </div>
  );
}
