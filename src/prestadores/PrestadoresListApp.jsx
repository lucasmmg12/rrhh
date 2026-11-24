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

// ── Normalización y cruce de trayectoria con SALUS ──
function normalizeStr(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bde\s+[a-z]+$/g, ' ')
    .replace(/\b(dra?|lic|med|esp|mg|magister)\b\.?/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTokens(s) {
  const stop = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);
  return normalizeStr(s)
    .split(' ')
    .filter(t => t.length > 1 && !stop.has(t));
}

function extractAllNumbers(matStr) {
  if (!matStr) return [];
  return String(matStr).match(/\d{3,6}/g) || [];
}

function formatDateAR(isoStr) {
  if (!isoStr) return '';
  const parts = String(isoStr).split('T')[0].split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoStr;
}

function formatAntiguedad(primeraIso, ultimaIso) {
  if (!primeraIso) return '';
  const d1 = new Date(primeraIso + 'T00:00:00');
  const d2 = ultimaIso ? new Date(ultimaIso + 'T00:00:00') : new Date();
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '';
  const diffDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  if (years > 0 && months > 0) return `${years}a ${months}m`;
  if (years > 0) return `${years} ${years === 1 ? 'año' : 'años'}`;
  if (months > 0) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  return `${diffDays}d`;
}

// ── Main Component ──
export default function PrestadoresListApp() {
  const [prestadores, setPrestadores] = useState([]);
  const [padronSalus, setPadronSalus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sedeFilter, setSedeFilter] = useState('');
  const [sortBy, setSortBy] = useState('recientes'); // 'recientes' | 'trayectoria_desc' | 'nombre_asc'
  const [editingPrestador, setEditingPrestador] = useState(null);
  const [deletingPrestador, setDeletingPrestador] = useState(null);

  // ── Fetch data (Prestadores + Padrón SALUS en paralelo) ──
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [prestadoresRes, salusRes] = await Promise.all([
          supabase.from('nuevos_prestadores').select('*').order('created_at', { ascending: false }),
          fetch('/data/padron_medicos_salus.json')
            .then(r => r.ok ? r.json() : { profesionales: [] })
            .catch(() => ({ profesionales: [] }))
        ]);

        if (prestadoresRes.error) {
          console.error('Error fetching prestadores:', prestadoresRes.error);
        } else {
          setPrestadores(prestadoresRes.data || []);
        }

        setPadronSalus(salusRes.profesionales || []);
      } catch (err) {
        console.error('Error al cargar datos de prestadores y padrón:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // ── Mapeo de Trayectoria de cada Prestador ──
  const getPrestadorTrayectoria = (prestador) => {
    if (prestador.trayectoria) {
      return {
        texto: prestador.trayectoria,
        desde: null,
        dias: 99999,
        detalle: `Trayectoria informada: ${prestador.trayectoria}`,
        esNuevo: false,
      };
    }

    if (!padronSalus || padronSalus.length === 0) return null;

    const pTokens = getTokens(prestador.nombre_completo);
    const pNums = extractAllNumbers(prestador.matricula);
    const pMP4 = pNums.filter(n => n.length === 4);

    let bestDoc = null;
    let bestScore = 0;

    for (const doc of padronSalus) {
      if (doc.es_generico) continue;
      const rawParts = String(doc.nombre || '').split(',');
      const surnameTokens = getTokens(rawParts[0] || '');
      const givenTokens = getTokens(rawParts[1] || '');
      if (surnameTokens.length === 0) continue;

      const primarySurname = surnameTokens[0];
      if (!pTokens.includes(primarySurname)) continue;

      const docNums = extractAllNumbers(doc.matricula);
      const docMP4 = docNums.filter(n => n.length === 4);
      const mpOverlap = docNums.some(n => pNums.includes(n));

      if (docMP4.length > 0 && pMP4.length > 0 && !mpOverlap) continue;

      const pGivenCandidates = pTokens.filter(t => !surnameTokens.includes(t));
      let score = 0;

      if (mpOverlap) {
        if (pGivenCandidates.length > 0 && givenTokens.length > 0) {
          if (pGivenCandidates.some(t => givenTokens.includes(t))) score = 100;
          else score = 85;
        } else {
          score = 95;
        }
      } else if (pTokens.every(t => [...surnameTokens, ...givenTokens].includes(t))) {
        score = 70 + pTokens.length * 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestDoc = doc;
      }
    }

    if (bestDoc && bestScore >= 70 && bestDoc.primera_atencion) {
      const antiguedad = formatAntiguedad(bestDoc.primera_atencion, bestDoc.ultima_atencion);
      const anioInicio = bestDoc.primera_atencion.split('-')[0];
      const d1 = new Date(bestDoc.primera_atencion + 'T00:00:00');
      const d2 = bestDoc.ultima_atencion ? new Date(bestDoc.ultima_atencion + 'T00:00:00') : new Date();
      const diffDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        texto: antiguedad,
        desde: anioInicio,
        dias: diffDays,
        primeraAtencion: formatDateAR(bestDoc.primera_atencion),
        ultimaAtencion: formatDateAR(bestDoc.ultima_atencion),
        totalAtenciones: bestDoc.total_atenciones,
        esSoloGuardia: Boolean(bestDoc.es_solo_guardia),
        agendasGuardia: (bestDoc.agendas_guardia || []).map(a => a.nombre).join(', '),
        detalle: `En Sanatorio Argentino desde ${formatDateAR(bestDoc.primera_atencion)} (${bestDoc.total_atenciones?.toLocaleString('es-AR')} atenciones registradas en SALUS)`,
        esNuevo: false,
      };
    }

    return {
      texto: 'Ingreso Reciente',
      desde: prestador.created_at ? new Date(prestador.created_at).getFullYear() : '2026',
      dias: 0,
      detalle: `Incorporación reciente (${formatDate(prestador.created_at)})`,
      esNuevo: true,
    };
  };

  // ── Actions ──
  const handleDeleteClick = (prestador) => {
    setDeletingPrestador(prestador);
  };

  const confirmDelete = async () => {
    if (!deletingPrestador) return;
    const { error } = await supabase.from('nuevos_prestadores').delete().eq('id', deletingPrestador.id);
    if (error) {
      alert('Error al eliminar: ' + error.message);
    } else {
      setPrestadores(prev => prev.filter(p => p.id !== deletingPrestador.id));
      setDeletingPrestador(null);
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
        p.servicio_especialidad.toLowerCase().includes(q) ||
        (p.matricula && p.matricula.toLowerCase().includes(q))
      );
    }

    // Sede filter
    if (sedeFilter) {
      result = result.filter(p =>
        p.sedes && p.sedes.some(s => s === sedeFilter)
      );
    }

    // Ordenamiento
    const sorted = [...result];
    if (sortBy === 'trayectoria_desc') {
      sorted.sort((a, b) => {
        const trayA = getPrestadorTrayectoria(a)?.dias || 0;
        const trayB = getPrestadorTrayectoria(b)?.dias || 0;
        return trayB - trayA;
      });
    } else if (sortBy === 'nombre_asc') {
      sorted.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
    } else {
      // 'recientes': creado más recientemente
      sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    return sorted;
  }, [prestadores, search, sedeFilter, sortBy, padronSalus]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => window.__setActiveView?.('padron-salus')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.5rem 0.9rem', borderRadius: '8px',
              background: '#1E5FA6', color: '#ffffff', border: 'none',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            ⚕️ Padrón Histórico SALUS (Línea de Tiempo)
          </button>
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
        <select
          className="prestadores-list__filter-select"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{ minWidth: '220px', fontWeight: 600, color: '#1E5FA6' }}
        >
          <option value="recientes">Ordenar: Incorporaciones recientes</option>
          <option value="trayectoria_desc">Ordenar: Mayor trayectoria en Sanatorio</option>
          <option value="nombre_asc">Ordenar: Alfabético (A → Z)</option>
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

                {/* Trayectoria y Modalidad Guardia */}
                {(() => {
                  const tray = getPrestadorTrayectoria(p);
                  if (!tray) return null;
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '0.35rem' }}>
                      <div
                        className={`prestadores-list__trayectoria ${tray.esNuevo ? 'prestadores-list__trayectoria--nuevo' : ''}`}
                        style={{ marginTop: 0 }}
                        title={tray.detalle}
                      >
                        <span className="prestadores-list__trayectoria-icon">
                          {tray.esNuevo ? '🌱' : '⏱️'}
                        </span>
                        <span>
                          Trayectoria: <strong>{tray.texto}</strong>
                          {tray.desde && <span className="prestadores-list__trayectoria-desde"> • Desde {tray.desde}</span>}
                        </span>
                      </div>
                      {tray.esSoloGuardia && (
                        <div
                          className="prestadores-list__guardia-chip"
                          title={`Médico exclusivo de Guardia en SALUS${tray.agendasGuardia ? `: ${tray.agendasGuardia}` : ''}`}
                        >
                          🚨 Solo Guardia
                        </div>
                      )}
                    </div>
                  );
                })()}

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
                  onClick={() => handleDeleteClick(p)}
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

      {/* Delete Modal */}
      {deletingPrestador && (
        <div className="prestadores-list__modal-overlay">
          <div className="prestadores-list__modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗑️</div>
            <h3 className="prestadores-list__modal-title" style={{ marginBottom: '0.5rem' }}>Eliminar Prestador</h3>
            <p style={{ color: 'var(--neutral-500)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              ¿Estás seguro de que quieres eliminar a <strong>{deletingPrestador.nombre_completo}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="prestadores-list__modal-actions" style={{ justifyContent: 'center' }}>
              <button type="button" onClick={() => setDeletingPrestador(null)}>Cancelar</button>
              <button type="button" onClick={confirmDelete} className="prestadores-list__modal-delete">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
