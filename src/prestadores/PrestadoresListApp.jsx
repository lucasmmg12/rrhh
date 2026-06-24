import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import './prestadores-list.css';

// ── All known sedes for the filter dropdown ──
const ALL_SEDES = [
  'Sede 1 (San Luis 432 oeste)',
  'Sede 2 (San Luis 433 oeste)',
  'Sede 3 (San Luis 436 oeste)',
  'Sede Santa Fe - Sector 1',
  'Sede Santa Fe - Sector 2',
];

// ── Helpers ──
function getInitials(name) {
  return name
    .replace(/^(Dra?\.\s*|Lic\.\s*)/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');
}

function isSantaFe(sede) {
  return sede.toLowerCase().includes('santa fe');
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function shortenSede(sede) {
  if (sede.includes('432')) return 'Sede 1';
  if (sede.includes('433')) return 'Sede 2';
  if (sede.includes('436')) return 'Sede 3';
  if (sede.includes('Sector 1')) return 'SF Sector 1';
  if (sede.includes('Sector 2')) return 'SF Sector 2';
  return sede;
}

// ── Main Component ──
export default function PrestadoresListApp() {
  const [prestadores, setPrestadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sedeFilter, setSedeFilter] = useState('');
  const [editingPrestador, setEditingPrestador] = useState(null);

  // ── Fetch data ──
  useEffect(() => {
    async function fetchPrestadores() {
      setLoading(true);
      const { data, error } = await supabase
        .from('nuevos_prestadores')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching prestadores:', error);
      } else {
        setPrestadores(data || []);
      }
      setLoading(false);
    }

    fetchPrestadores();
  }, []);

  // ── Actions ──
  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este prestador?')) return;
    const { error } = await supabase.from('nuevos_prestadores').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar: ' + error.message);
    } else {
      setPrestadores(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const { id, nombre_completo, servicio_especialidad, matricula, sedes, comentarios } = editingPrestador;
    const { error } = await supabase
      .from('nuevos_prestadores')
      .update({ nombre_completo, servicio_especialidad, matricula, sedes, comentarios })
      .eq('id', id);

    if (error) {
      alert('Error al actualizar: ' + error.message);
    } else {
      setPrestadores(prev => prev.map(p => p.id === id ? editingPrestador : p));
      setEditingPrestador(null);
    }
  };

  // ── Filtered data ──
  const filtered = useMemo(() => {
    let result = prestadores;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p =>
        p.nombre_completo.toLowerCase().includes(q) ||
        p.servicio_especialidad.toLowerCase().includes(q)
      );
    }

    // Sede filter
    if (sedeFilter) {
      result = result.filter(p =>
        p.sedes && p.sedes.some(s => s === sedeFilter)
      );
    }

    return result;
  }, [prestadores, search, sedeFilter]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="prestadores-list__loading">
        <div className="prestadores-list__spinner" />
        <p style={{ fontSize: '0.85rem' }}>Cargando prestadores...</p>
      </div>
    );
  }

  return (
    <div className="prestadores-list">
      {/* Header */}
      <div className="prestadores-list__header">
        <div className="prestadores-list__title-section">
          <h2 className="prestadores-list__title">Prestadores Médicos</h2>
          <p className="prestadores-list__subtitle">
            Registro de difusión de nuevos prestadores incorporados
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="prestadores-list__count">
            👥 {filtered.length} {filtered.length === 1 ? 'prestador' : 'prestadores'}
          </span>
          <a
            href="/prestadores.html"
            target="_blank"
            rel="noopener noreferrer"
            className="prestadores-list__form-link"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Nuevo prestador
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="prestadores-list__filters">
        <input
          type="text"
          className="prestadores-list__search"
          placeholder="Buscar por nombre o especialidad..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="prestadores-list__filter-select"
          value={sedeFilter}
          onChange={e => setSedeFilter(e.target.value)}
        >
          <option value="">Todas las sedes</option>
          {ALL_SEDES.map(s => (
            <option key={s} value={s}>{shortenSede(s)}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      <div className="prestadores-list__grid">
        {filtered.length === 0 ? (
          <div className="prestadores-list__empty">
            <div className="prestadores-list__empty-icon">🔍</div>
            <p className="prestadores-list__empty-text">No se encontraron prestadores</p>
            <p className="prestadores-list__empty-hint">
              Probá con otros términos de búsqueda o cambiá el filtro de sede
            </p>
          </div>
        ) : (
          filtered.map((p, i) => (
            <div
              key={p.id}
              className="prestadores-list__card"
              style={{ animationDelay: `${Math.min(i * 0.04, 0.8)}s` }}
            >
              {/* Avatar */}
              {p.foto_url ? (
                <img
                  src={p.foto_url}
                  alt={p.nombre_completo}
                  className="prestadores-list__avatar"
                  loading="lazy"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                  }}
                />
              ) : null}
              <div
                className="prestadores-list__avatar-placeholder"
                style={p.foto_url ? { display: 'none' } : {}}
              >
                {getInitials(p.nombre_completo)}
              </div>

              {/* Info */}
              <div className="prestadores-list__info">
                <h3 className="prestadores-list__name">{p.nombre_completo}</h3>
                <p className="prestadores-list__especialidad">{p.servicio_especialidad}</p>

                {/* Sede chips */}
                {p.sedes && p.sedes.length > 0 && (
                  <div className="prestadores-list__sedes">
                    {p.sedes.map(s => (
                      <span
                        key={s}
                        className={`prestadores-list__sede-chip ${
                          isSantaFe(s) ? 'prestadores-list__sede-chip--sf' : 'prestadores-list__sede-chip--sl'
                        }`}
                      >
                        {isSantaFe(s) ? '📍' : '🏥'} {shortenSede(s)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Comment indicator */}
                {p.comentarios && (
                  <div className="prestadores-list__comment" title={p.comentarios}>
                    💬 {p.comentarios.length > 60 ? p.comentarios.substring(0, 60) + '...' : p.comentarios}
                  </div>
                )}

                {/* Date */}
                <div className="prestadores-list__date">
                  Registrado: {formatDate(p.created_at)}
                </div>
              </div>

              {/* Actions */}
              <div className="prestadores-list__actions">
                <button
                  className="prestadores-list__action-btn"
                  title="Editar"
                  onClick={() => setEditingPrestador(p)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button
                  className="prestadores-list__action-btn prestadores-list__action-btn--delete"
                  title="Eliminar"
                  onClick={() => handleDelete(p.id)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingPrestador && (
        <div className="prestadores-list__modal-overlay">
          <div className="prestadores-list__modal">
            <h3 className="prestadores-list__modal-title">Editar Prestador</h3>
            <form onSubmit={handleEditSubmit} className="prestadores-list__modal-form">
              <label>
                Nombre y Apellido
                <input
                  type="text"
                  value={editingPrestador.nombre_completo}
                  onChange={e => setEditingPrestador({ ...editingPrestador, nombre_completo: e.target.value })}
                  required
                />
              </label>
              <label>
                Especialidad
                <input
                  type="text"
                  value={editingPrestador.servicio_especialidad}
                  onChange={e => setEditingPrestador({ ...editingPrestador, servicio_especialidad: e.target.value })}
                  required
                />
              </label>
              <label>
                Matrícula
                <input
                  type="text"
                  value={editingPrestador.matricula}
                  onChange={e => setEditingPrestador({ ...editingPrestador, matricula: e.target.value })}
                  required
                />
              </label>
              <label>
                Sedes
                <div className="prestadores-list__modal-sedes">
                  {ALL_SEDES.map(sede => {
                    const checked = editingPrestador.sedes?.includes(sede);
                    return (
                      <label key={sede} className="prestadores-list__modal-sede-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            let newSedes = editingPrestador.sedes || [];
                            if (e.target.checked) newSedes = [...newSedes, sede];
                            else newSedes = newSedes.filter(s => s !== sede);
                            setEditingPrestador({ ...editingPrestador, sedes: newSedes });
                          }}
                        />
                        {shortenSede(sede)}
                      </label>
                    );
                  })}
                </div>
              </label>
              <label>
                Comentarios
                <textarea
                  value={editingPrestador.comentarios || ''}
                  onChange={e => setEditingPrestador({ ...editingPrestador, comentarios: e.target.value })}
                  rows={3}
                />
              </label>
              <div className="prestadores-list__modal-actions">
                <button type="button" onClick={() => setEditingPrestador(null)}>Cancelar</button>
                <button type="submit" className="prestadores-list__modal-save">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
