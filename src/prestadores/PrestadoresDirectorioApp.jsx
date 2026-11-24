import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import './prestadores-directorio.css';

// Helpers
function getInitials(name) {
  return name
    .replace(/^(Dra?\.\s*|Lic\.\s*)/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');
}

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

function shortenSede(sede) {
  if (sede.includes('432')) return 'Sede 1';
  if (sede.includes('433')) return 'Sede 2';
  if (sede.includes('436')) return 'Sede 3';
  if (sede.includes('Sector 1')) return 'SF Sector 1';
  if (sede.includes('Sector 2')) return 'SF Sector 2';
  return sede;
}

// Subcomponents
const Accordion = ({ title, count, children, isOpen, onClick }) => {
  return (
    <div className={`directorio-accordion ${isOpen ? 'open' : ''}`}>
      <div className="directorio-accordion-header" onClick={onClick}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3 className="directorio-accordion-title">{title}</h3>
          <span className="directorio-accordion-count">{count}</span>
        </div>
        <svg className="directorio-accordion-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      {isOpen && (
        <div className="directorio-accordion-body">
          {children}
        </div>
      )}
    </div>
  );
};

const PrestadorCard = ({ prestador, trayectoria }) => {
  return (
    <div className="prestador-card">
      <div className="prestador-card-header">
        <div className="prestador-avatar">
          {prestador.foto_url ? (
            <img 
              src={prestador.foto_url} 
              alt={`Foto de ${prestador.nombre_completo}`}
              className="prestador-foto"
            />
          ) : (
            getInitials(prestador.nombre_completo)
          )}
        </div>
        <div className="prestador-info">
          <h4 className="prestador-name">{prestador.nombre_completo}</h4>
          {prestador.matricula && (
            <p className="prestador-matricula">Mat. {prestador.matricula}</p>
          )}
          {trayectoria && (
            <span
              className={`prestador-trayectoria ${trayectoria.esNuevo ? 'prestador-trayectoria--nuevo' : ''}`}
              title={trayectoria.detalle}
            >
              {trayectoria.esNuevo ? '🌱' : '⏱️'} Trayectoria: <strong>{trayectoria.texto}</strong>
              {trayectoria.desde && <span> ({trayectoria.desde})</span>}
            </span>
          )}
        </div>
      </div>
      {prestador.comentarios && (
        <p className="prestador-comentarios">"{prestador.comentarios}"</p>
      )}
    </div>
  );
};

export default function PrestadoresDirectorioApp() {
  const [prestadores, setPrestadores] = useState([]);
  const [padronSalus, setPadronSalus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSede, setActiveSede] = useState('');
  const [openEspecialidades, setOpenEspecialidades] = useState({}); // { [especialidad]: boolean }

  // Fetch data
  useEffect(() => {
    async function fetchPrestadores() {
      setLoading(true);
      try {
        const [prestadoresRes, salusRes] = await Promise.all([
          supabase.from('nuevos_prestadores').select('*').order('nombre_completo', { ascending: true }),
          fetch('/data/padron_medicos_salus.json').then(r => r.ok ? r.json() : { profesionales: [] }).catch(() => ({ profesionales: [] }))
        ]);

        if (prestadoresRes.error) {
          console.error('Error fetching prestadores:', prestadoresRes.error);
        } else {
          const data = prestadoresRes.data || [];
          setPrestadores(data);
          
          if (data && data.length > 0) {
            const sedeCounts = {};
            data.forEach(p => {
              if (p.sedes) {
                p.sedes.forEach(s => {
                  sedeCounts[s] = (sedeCounts[s] || 0) + 1;
                });
              }
            });
            const sortedSedes = Object.keys(sedeCounts).sort((a, b) => sedeCounts[b] - sedeCounts[a]);
            if (sortedSedes.length > 0) {
              setActiveSede(sortedSedes[0]);
            }
          }
        }
        setPadronSalus(salusRes.profesionales || []);
      } catch (err) {
        console.error('Error loading directorio data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPrestadores();
  }, []);

  // Helper para trayectoria
  const getTrayectoria = (prestador) => {
    if (prestador.trayectoria) {
      return { texto: prestador.trayectoria, desde: null, detalle: prestador.trayectoria, esNuevo: false };
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
      return {
        texto: antiguedad,
        desde: `Desde ${anioInicio}`,
        detalle: `En Sanatorio Argentino desde ${bestDoc.primera_atencion}`,
        esNuevo: false,
      };
    }

    return {
      texto: 'Ingreso Reciente',
      desde: null,
      detalle: 'Incorporación reciente al Sanatorio',
      esNuevo: true,
    };
  };

  // Procesar y agrupar datos
  const { allSedes, groupedData } = useMemo(() => {
    const sedesSet = new Set();
    let filtered = prestadores;

    // 1. Filtrar por búsqueda general
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.nombre_completo.toLowerCase().includes(q) ||
        p.servicio_especialidad.toLowerCase().includes(q)
      );
    }

    // 2. Extraer todas las sedes disponibles en los datos filtrados
    filtered.forEach(p => {
      if (p.sedes) {
        p.sedes.forEach(s => sedesSet.add(s));
      }
    });

    const sedesArray = Array.from(sedesSet).sort();

    // Si la sede activa ya no está en los resultados, cambiarla
    if (activeSede && !sedesSet.has(activeSede) && sedesArray.length > 0) {
       // Se actualizará en el render mediante useEffect, pero aquí lo manejamos con cuidado.
    }

    // 3. Agrupar por Especialidad solo para la sede activa
    const group = {};
    if (activeSede) {
       const prestadoresEnSede = filtered.filter(p => p.sedes && p.sedes.includes(activeSede));
       prestadoresEnSede.forEach(p => {
         const esp = p.servicio_especialidad || 'Sin Especialidad';
         if (!group[esp]) {
           group[esp] = [];
         }
         group[esp].push(p);
       });
    }
    
    // Sort especialidades
    const sortedGroup = Object.keys(group).sort().reduce((acc, key) => {
      acc[key] = group[key];
      return acc;
    }, {});

    return { allSedes: sedesArray, groupedData: sortedGroup };
  }, [prestadores, search, activeSede]);

  // Asegurar que activeSede sea válido tras una búsqueda
  useEffect(() => {
    if (allSedes.length > 0 && !allSedes.includes(activeSede)) {
      setActiveSede(allSedes[0]);
    } else if (allSedes.length === 0 && activeSede !== '') {
      setActiveSede('');
    }
  }, [allSedes, activeSede]);

  // Toggle accordion
  const toggleAccordion = (especialidad) => {
    setOpenEspecialidades(prev => ({
      ...prev,
      [especialidad]: !prev[especialidad]
    }));
  };

  return (
    <div className="directorio-app">
      <header className="directorio-header">
        <img src="/logosanatorio.png" alt="Sanatorio Argentino" className="directorio-logo" />
        <h1>Directorio Médico</h1>
      </header>

      <div className="directorio-search-container">
        <input
          type="search"
          className="directorio-search-input"
          placeholder="Buscar profesional o especialidad..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {!loading && allSedes.length > 0 && (
        <div className="directorio-tabs-container">
          <div className="directorio-tabs">
            {allSedes.map(sede => (
              <button
                key={sede}
                className={`directorio-tab ${activeSede === sede ? 'active' : ''}`}
                onClick={() => setActiveSede(sede)}
              >
                {shortenSede(sede)}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="directorio-content">
        {loading ? (
          <div className="directorio-message">
            <div className="directorio-spinner"></div>
            <p>Cargando directorio...</p>
          </div>
        ) : allSedes.length === 0 ? (
          <div className="directorio-message">
            <p>No se encontraron prestadores que coincidan con la búsqueda.</p>
          </div>
        ) : (
          Object.entries(groupedData).map(([especialidad, prestadoresList]) => (
            <Accordion
              key={especialidad}
              title={especialidad}
              count={prestadoresList.length}
              isOpen={openEspecialidades[especialidad] !== false} // Default open
              onClick={() => toggleAccordion(especialidad)}
            >
              {prestadoresList.map(prestador => (
                <PrestadorCard
                  key={prestador.id}
                  prestador={prestador}
                  trayectoria={getTrayectoria(prestador)}
                />
              ))}
            </Accordion>
          ))
        )}
      </main>
    </div>
  );
}
