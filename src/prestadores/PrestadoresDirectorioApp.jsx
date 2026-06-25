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

const PrestadorCard = ({ prestador }) => {
  return (
    <div className="prestador-card">
      <div className="prestador-card-header">
        <div className="prestador-avatar">
          {getInitials(prestador.nombre_completo)}
        </div>
        <div className="prestador-info">
          <h4 className="prestador-name">{prestador.nombre_completo}</h4>
          {prestador.matricula && (
            <p className="prestador-matricula">Mat. {prestador.matricula}</p>
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSede, setActiveSede] = useState('');
  const [openEspecialidades, setOpenEspecialidades] = useState({}); // { [especialidad]: boolean }

  // Fetch data
  useEffect(() => {
    async function fetchPrestadores() {
      setLoading(true);
      const { data, error } = await supabase
        .from('nuevos_prestadores')
        .select('*')
        .order('nombre_completo', { ascending: true });

      if (error) {
        console.error('Error fetching prestadores:', error);
      } else {
        setPrestadores(data || []);
        
        // Determinar sede por defecto (la que tenga más prestadores o la primera)
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
      setLoading(false);
    }

    fetchPrestadores();
  }, []);

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
        <h1>Directorio Médico</h1>
        <p>Sanatorio Argentino</p>
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
                <PrestadorCard key={prestador.id} prestador={prestador} />
              ))}
            </Accordion>
          ))
        )}
      </main>
    </div>
  );
}
