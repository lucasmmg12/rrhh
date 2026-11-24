import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  Stethoscope, Search, Download, RefreshCw, Clock, CheckCircle2,
  XCircle, Activity, Users, ChevronLeft, ChevronRight,
  BarChart3, Table2, GitCommitHorizontal, Eye, ArrowRight, ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts';
import { supabase } from '../supabaseClient';
import './padron-medicos.css';

const YEARS_LIST = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

function formatDateAR(isoStr) {
  if (!isoStr) return '—';
  const parts = String(isoStr).split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoStr;
}

function getInitials(nombre) {
  if (!nombre) return 'MD';
  const cleaned = String(nombre).replace(/[,]/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

function formatCompactCount(n) {
  if (!n || n <= 0) return '·';
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function shortenSedeName(sede) {
  if (!sede) return '';
  if (sede === 'SANTA FE') return 'Santa Fe';
  if (sede === 'SAN LUIS SUR') return 'Sede 1 (Sur)';
  if (sede === 'SAN LUIS NORTE') return 'Sede 2 (Norte)';
  if (sede === 'SAN LUIS SEDE 3') return 'Sede 3';
  return sede;
}

function formatAntiguedad(primeraIso, ultimaIso) {
  if (!primeraIso || !ultimaIso) return '—';
  const d1 = new Date(primeraIso + 'T00:00:00');
  const d2 = new Date(ultimaIso + 'T00:00:00');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '—';
  const diffDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  if (years > 0 && months > 0) return `${years}a ${months}m`;
  if (years > 0) return `${years} ${years === 1 ? 'año' : 'años'}`;
  if (months > 0) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  return `${diffDays}d`;
}

function formatTiempoSinAtender(dias) {
  if (dias === null || dias === undefined) return '—';
  if (dias === 0) return 'Atendió hoy';
  if (dias === 1) return 'Hace 1 día';
  if (dias < 30) return `Hace ${dias} días`;
  if (dias < 365) {
    const m = Math.floor(dias / 30);
    return `Hace ${m} ${m === 1 ? 'mes' : 'meses'} (${dias}d)`;
  }
  const y = (dias / 365).toFixed(1);
  return `Hace ${y} años`;
}

// Normalización para cruce dinámico entre nuevos_prestadores y padrón SALUS
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

const COMMON_COMPOUND_NAMES = new Set(['maria', 'jose', 'juan', 'ana', 'luis', 'carlos']);

function matchDoctorWithPrestador(doc, prestadoresList) {
  if (doc.es_generico || !Array.isArray(prestadoresList)) return null;
  const docNums = extractAllNumbers(doc.matricula);
  const rawParts = String(doc.nombre || '').split(',');
  const surnameTokens = getTokens(rawParts[0] || '');
  const givenTokens = getTokens(rawParts[1] || '');
  const docAllTokens = [...surnameTokens, ...givenTokens];
  if (surnameTokens.length === 0) return null;

  const primarySurname = surnameTokens[0];
  const docMP4 = docNums.filter(n => n.length === 4);

  let bestMatch = null;
  let bestScore = 0;

  for (const p of prestadoresList) {
    if (!p.foto_url) continue;
    const pTokens = getTokens(p.nombre_completo);
    if (pTokens.length < 2 || !pTokens.includes(primarySurname)) continue;

    const pNums = extractAllNumbers(p.matricula);
    const pMP4 = pNums.filter(n => n.length === 4);
    const mpOverlap = docNums.some(n => pNums.includes(n));

    if (docMP4.length > 0 && pMP4.length > 0 && !mpOverlap) continue;

    const pGivenCandidates = pTokens.filter(t => !surnameTokens.includes(t));
    let score = 0;

    if (mpOverlap) {
      if (pGivenCandidates.length > 0 && givenTokens.length > 0) {
        if (pGivenCandidates.some(t => givenTokens.includes(t))) score = 100;
      } else {
        score = 95;
      }
    } else if (pTokens.every(t => docAllTokens.includes(t))) {
      const distP = pGivenCandidates.filter(t => !COMMON_COMPOUND_NAMES.has(t));
      const distDoc = givenTokens.filter(t => !COMMON_COMPOUND_NAMES.has(t));
      if (distP.length > 0) {
        if (distP.every(t => givenTokens.includes(t))) score = 70 + pTokens.length * 5;
      } else if (distDoc.length === 0 || pTokens.filter(t => surnameTokens.includes(t)).length >= 2) {
        score = 70 + pTokens.length * 5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = p;
    }
  }
  return bestMatch;
}

// Categorización clínica vs. servicios/diagnóstico para el buscador inteligente de especialidades
const APOYO_DIAGNOSTICO_SET = new Set([
  'ENFERMERIA', 'ENFERMERÍA', '**APOYO DE SERVICIO**', 'APOYO DE SERVICIO',
  'CHEQUEO', 'MONITOREO FETAL', 'CURACIONES', 'PREADMISION', 'PREPARTO',
  'ECOGRAFISTA', 'RADIOLOGIA', 'MAMOGRAFIA', 'TOMOGRAFIA COMPUTADA',
  'DENSITOMETRIA', 'BIOQUIMICA', 'INSTRUMENTISTA', 'VACUNATORIO',
  'EXTRACCIONISTA', 'CONTROL NEONATAL', 'SUTURAS', 'CONTROL - AUX',
  'SIN ESPECIFICAR',
]);

function formatEspDisplayName(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/\*+/g, '')
    .replace(/\s*\/\s*/g, ' / ')
    .trim();
}

function getEspCategory(raw) {
  const upper = String(raw || '').toUpperCase().trim();
  return APOYO_DIAGNOSTICO_SET.has(upper) ? 'apoyo' : 'medica';
}

function EspecialidadSearchSelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('todas'); // 'todas' | 'medica' | 'apoyo'
  const [sortMode, setSortMode] = useState('count'); // 'count' | 'az'
  const [popoverStyle, setPopoverStyle] = useState({});
  const wrapRef = useRef(null);
  const popoverRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function updatePosition() {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const popoverWidth = Math.min(375, window.innerWidth - 24);
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - popoverWidth - 12);
      }
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const top = spaceBelow >= 260 ? rect.bottom + 6 : Math.max(12, rect.top - 410);
      setPopoverStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`,
        zIndex: 99999,
      });
    }

    function handleOutside(e) {
      const inTrigger = wrapRef.current && wrapRef.current.contains(e.target);
      const inPopover = popoverRef.current && popoverRef.current.contains(e.target);
      if (!inTrigger && !inPopover) {
        setOpen(false);
      }
    }

    if (open) {
      updatePosition();
      document.addEventListener('mousedown', handleOutside);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const enrichedOptions = useMemo(() => {
    return options
      .filter(o => o.nombre && o.nombre !== 'Sin especificar')
      .map(o => ({
        ...o,
        label: formatEspDisplayName(o.nombre),
        cat: getEspCategory(o.nombre),
        norm: normalizeStr(o.nombre),
      }));
  }, [options]);

  const filteredOptions = useMemo(() => {
    const qNorm = normalizeStr(query);
    const list = enrichedOptions.filter(o => {
      if (catFilter === 'medica' && o.cat !== 'medica') return false;
      if (catFilter === 'apoyo' && o.cat !== 'apoyo') return false;
      if (!qNorm) return o.count > 0 || o.secCount > 0;
      return o.norm.includes(qNorm);
    });

    const sorted = [...list];
    if (sortMode === 'az') {
      sorted.sort((a, b) => a.label.localeCompare(b.label, 'es'));
    } else {
      sorted.sort((a, b) => b.count - a.count || b.secCount - a.secCount);
    }
    return sorted;
  }, [enrichedOptions, query, catFilter, sortMode]);

  const selectedObj = useMemo(
    () => enrichedOptions.find(o => o.nombre === value) || null,
    [enrichedOptions, value]
  );

  const medicasCount = useMemo(
    () => enrichedOptions.filter(o => o.cat === 'medica' && o.count > 0).length,
    [enrichedOptions]
  );

  return (
    <div className="pm-esp-combo" ref={wrapRef}>
      <button
        type="button"
        className={`pm-esp-combo__trigger ${open ? 'pm-esp-combo__trigger--open' : ''} ${value ? 'pm-esp-combo__trigger--active' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        title="Buscar y filtrar por 1ª Especialidad Principal"
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, overflow: 'hidden' }}>
          <Stethoscope size={14} style={{ color: value ? '#1E5FA6' : '#64748b', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedObj
              ? `${selectedObj.label} (${selectedObj.count})`
              : `Especialidades (${medicasCount} médicas)`}
          </span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {value && (
            <span
              role="button"
              tabIndex={0}
              className="pm-esp-combo__clear"
              title="Quitar filtro de especialidad"
              onClick={e => {
                e.stopPropagation();
                onChange('');
                setQuery('');
              }}
            >
              &times;
            </span>
          )}
          <ChevronDown size={14} style={{ color: '#64748b', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </span>
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          className="pm-esp-combo__popover"
          style={popoverStyle}
        >
          <div className="pm-esp-combo__search-box">
            <Search size={14} style={{ position: 'absolute', left: '1.25rem', top: '53%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              ref={inputRef}
              type="text"
              className="pm-esp-combo__search-input"
              placeholder="Escribí para buscar especialidad (ej: Gine, Cardio)..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter' && filteredOptions.length > 0) {
                  onChange(filteredOptions[0].nombre);
                  setOpen(false);
                }
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute', right: '1.15rem', top: '53%', transform: 'translateY(-50%)',
                  border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700,
                }}
              >
                &times;
              </button>
            )}
          </div>

          <div className="pm-esp-combo__toolbar">
            <div className="pm-esp-combo__cat-pills">
              <button
                type="button"
                className={`pm-esp-combo__cat-btn ${catFilter === 'todas' ? 'pm-esp-combo__cat-btn--active' : ''}`}
                onClick={() => setCatFilter('todas')}
              >
                Todas
              </button>
              <button
                type="button"
                className={`pm-esp-combo__cat-btn ${catFilter === 'medica' ? 'pm-esp-combo__cat-btn--active' : ''}`}
                onClick={() => setCatFilter('medica')}
                title="Mostrar solo especialidades clínicas y quirúrgicas"
              >
                🩺 Médicas
              </button>
              <button
                type="button"
                className={`pm-esp-combo__cat-btn ${catFilter === 'apoyo' ? 'pm-esp-combo__cat-btn--active' : ''}`}
                onClick={() => setCatFilter('apoyo')}
                title="Diagnóstico por imágenes, enfermería, chequeos y servicios de apoyo"
              >
                🔬 Diagnóstico / Apoyo
              </button>
            </div>

            <button
              type="button"
              className="pm-esp-combo__sort-btn"
              onClick={() => setSortMode(prev => (prev === 'count' ? 'az' : 'count'))}
              title="Cambiar orden de la lista"
            >
              {sortMode === 'count' ? '↓ Cantidad' : 'A → Z'}
            </button>
          </div>

          <div className="pm-esp-combo__list">
            {!query && (
              <button
                type="button"
                className={`pm-esp-combo__option ${value === '' ? 'pm-esp-combo__option--selected' : ''}`}
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <span className="pm-esp-combo__opt-name">📋 Todas las especialidades</span>
                <span className="pm-esp-combo__badge-main">Ver padrón completo</span>
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div style={{ padding: '1.2rem 0.75rem', textAlign: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                No se encontraron especialidades para &ldquo;{query}&rdquo;
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = value === opt.nombre;
                return (
                  <button
                    key={opt.nombre}
                    type="button"
                    className={`pm-esp-combo__option ${isSelected ? 'pm-esp-combo__option--selected' : ''}`}
                    onClick={() => {
                      onChange(opt.nombre);
                      setOpen(false);
                    }}
                  >
                    <span className="pm-esp-combo__opt-name" title={opt.label}>
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: opt.cat === 'medica' ? '#1E5FA6' : '#94a3b8',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                    </span>
                    <span className="pm-esp-combo__counts">
                      <span className="pm-esp-combo__badge-main" title={`${opt.count} profesionales con ${opt.label} como 1ª especialidad`}>
                        {opt.count}
                      </span>
                      {opt.secCount > 0 && (
                        <span className="pm-esp-combo__badge-sec" title={`+${opt.secCount} profesionales la registran como especialidad secundaria`}>
                          +{opt.secCount} sec
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Componente Avatar con Foto Real de Prestadores o Iniciales
function DoctorAvatar({ doc, size = 38 }) {
  const [imgError, setImgError] = useState(false);
  const hasPhoto = Boolean(doc?.foto_url) && !imgError;

  return (
    <div
      className={`pm-doc-avatar ${hasPhoto ? 'pm-doc-avatar--photo' : ''}`}
      style={{ width: size, height: size, borderRadius: size > 50 ? '14px' : '10px', fontSize: size > 50 ? '1.1rem' : '0.76rem' }}
    >
      {hasPhoto ? (
        <img
          src={doc.foto_url}
          alt={doc.nombre}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        getInitials(doc?.nombre)
      )}
    </div>
  );
}

export default function PadronMedicosApp() {
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'directorio' | 'analitica'

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState(''); // '' | 'Activo' | 'Baja Frecuencia' | 'Inactivo'
  const [filterEspecialidad, setFilterEspecialidad] = useState('');
  const [filterModalidad, setFilterModalidad] = useState(''); // '' | 'solo_guardia' | 'excluir_guardia' | 'consultorio' | 'mixto'
  const [filterSede, setFilterSede] = useState('');
  const [filterObraSocial, setFilterObraSocial] = useState('');
  const [filterSeguro, setFilterSeguro] = useState(''); // '' | 'con_seguro' | 'sin_seguro' | 'con_cuil' | 'con_sss'
  const [onlyWithPhoto, setOnlyWithPhoto] = useState(false);
  const [includeGenericos, setIncludeGenericos] = useState(false);
  const [sortBy, setSortBy] = useState('ultima_desc');

  // Expansión de especialidades secundarias ("Ver más")
  const [expandedEspIds, setExpandedEspIds] = useState({});
  const [showSecundariosPanel, setShowSecundariosPanel] = useState(false);
  const [modalShowSecundarias, setModalShowSecundarias] = useState(false);

  function toggleDoctorSecundarias(idPersonal, e) {
    if (e) e.stopPropagation();
    setExpandedEspIds(prev => ({ ...prev, [idPersonal]: !prev[idPersonal] }));
  }

  // Paginación
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  // Médico seleccionado para Ficha 360°
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  useEffect(() => {
    loadPadron();
  }, []);

  async function loadPadron() {
    setLoading(true);
    let baseDocs = [];
    try {
      const res = await fetch('/data/padron_medicos_salus.json');
      if (res.ok) {
        const json = await res.json();
        baseDocs = json.profesionales || [];
      }
    } catch (err) {
      console.warn('Intentando cargar padrón desde Supabase...', err);
    }

    if (baseDocs.length === 0) {
      try {
        const { data, error } = await supabase
          .from('padron_medicos_salus')
          .select('*')
          .order('total_atenciones', { ascending: false });
        if (!error && data && data.length > 0) {
          baseDocs = data;
        }
      } catch (err) {
        console.error('Error cargando padron_medicos_salus:', err);
      }
    }

    // Cruzar en vivo con nuevos_prestadores para mapear fotos recién subidas
    try {
      const { data: prestadoresData } = await supabase
        .from('nuevos_prestadores')
        .select('nombre_completo, matricula, foto_url, comentarios')
        .not('foto_url', 'is', null);

      if (prestadoresData && prestadoresData.length > 0) {
        baseDocs = baseDocs.map(doc => {
          if (doc.foto_url) return doc;
          const match = matchDoctorWithPrestador(doc, prestadoresData);
          if (match) {
            return { ...doc, foto_url: match.foto_url, prestador_comentarios: match.comentarios || '' };
          }
          return doc;
        });
      }
    } catch (err) {
      console.warn('No se pudo cruzar fotos en vivo:', err);
    }

    setProfesionales(baseDocs);
    setLoading(false);
  }

  // Filtrar base (nominales vs genéricos)
  const baseList = useMemo(() => {
    return includeGenericos ? profesionales : profesionales.filter(p => !p.es_generico);
  }, [profesionales, includeGenericos]);

  // Catálogos dinámicos para selectores de filtro (conteo limpio por 1ª Especialidad Principal)
  const allEspecialidades = useMemo(() => {
    const primaryMap = new Map();
    const secondaryMap = new Map();

    baseList.forEach(p => {
      const princ = p.especialidad_principal;
      if (princ && princ !== 'Sin especificar') {
        primaryMap.set(princ, (primaryMap.get(princ) || 0) + 1);
      }
      const secs = p.especialidades_secundarias || (p.especialidades || []).slice(1);
      secs.forEach(e => {
        if (e.nombre && e.nombre !== princ) {
          secondaryMap.set(e.nombre, (secondaryMap.get(e.nombre) || 0) + 1);
        }
      });
    });

    const allNames = new Set([...primaryMap.keys(), ...secondaryMap.keys()]);
    return Array.from(allNames)
      .map(nombre => ({
        nombre,
        count: primaryMap.get(nombre) || 0,
        secCount: secondaryMap.get(nombre) || 0,
      }))
      .sort((a, b) => b.count - a.count || b.secCount - a.secCount);
  }, [baseList]);

  const allObrasSociales = useMemo(() => {
    const map = new Map();
    baseList.forEach(p => {
      (p.top_obras_sociales || []).forEach(os => {
        if (os.nombre) {
          map.set(os.nombre, (map.get(os.nombre) || 0) + os.cantidad);
        }
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([nombre]) => nombre);
  }, [baseList]);

  // KPIs globales sobre la base seleccionada
  const kpis = useMemo(() => {
    const total = baseList.length;
    const activos = baseList.filter(p => p.estado_actividad === 'Activo').length;
    const bajaFrec = baseList.filter(p => p.estado_actividad === 'Baja Frecuencia').length;
    const inactivos = baseList.filter(p => p.estado_actividad === 'Inactivo').length;
    const totalAtenciones = baseList.reduce((acc, p) => acc + (p.total_atenciones || 0), 0);
    const atendieron30d = baseList.filter(p => (p.atenciones_30d || 0) > 0).length;
    const conFoto = baseList.filter(p => Boolean(p.foto_url)).length;
    const conCuil = baseList.filter(p => Boolean(p.cuil)).length;
    const conSeguro = baseList.filter(p => Boolean(p.seguro)).length;
    const conDireccion = baseList.filter(p => Boolean(p.direccion)).length;
    const conSss = baseList.filter(p => Boolean(p.nro_sss)).length;
    const soloGuardia = baseList.filter(p => Boolean(p.es_solo_guardia)).length;
    const mixtoGuardia = baseList.filter(p => p.modalidad_atencion === 'Consultorio y Guardia').length;
    const soloConsultorio = baseList.filter(p => !p.es_solo_guardia && (p.atenciones_guardia || 0) === 0).length;

    return {
      total,
      activos,
      bajaFrec,
      inactivos,
      totalAtenciones,
      atendieron30d,
      conFoto,
      conCuil,
      conSeguro,
      conDireccion,
      conSss,
      soloGuardia,
      mixtoGuardia,
      soloConsultorio,
      pctActivos: total > 0 ? ((activos / total) * 100).toFixed(1) : '0.0',
    };
  }, [baseList]);

  // Función común para filtros excepto especialidad
  const matchesNonEspFilters = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return (p) => {
      if (onlyWithPhoto && !p.foto_url) return false;
      if (filterEstado && p.estado_actividad !== filterEstado) return false;
      if (filterModalidad === 'solo_guardia' && !p.es_solo_guardia) return false;
      if (filterModalidad === 'excluir_guardia' && p.es_solo_guardia) return false;
      if (filterModalidad === 'consultorio' && (p.es_solo_guardia || (p.atenciones_guardia || 0) > 0)) return false;
      if (filterModalidad === 'mixto' && p.modalidad_atencion !== 'Consultorio y Guardia') return false;
      if (filterSeguro === 'con_seguro' && !p.seguro) return false;
      if (filterSeguro === 'sin_seguro' && p.seguro) return false;
      if (filterSeguro === 'con_cuil' && !p.cuil) return false;
      if (filterSeguro === 'con_sss' && !p.nro_sss) return false;
      if (filterSede) {
        const hasSede = (p.sedes || []).some(s => s.sede === filterSede);
        if (!hasSede) return false;
      }
      if (filterObraSocial) {
        const hasOS = (p.top_obras_sociales || []).some(o => o.nombre === filterObraSocial);
        if (!hasOS) return false;
      }
      if (q) {
        const matchNombre = (p.nombre || '').toLowerCase().includes(q);
        const matchMat = (p.matricula || '').toLowerCase().includes(q);
        const matchNif = (p.nif || '').toLowerCase().includes(q);
        const matchDni = (p.dni || '').toLowerCase().includes(q);
        const matchCuil = (p.cuil || '').toLowerCase().includes(q) || (p.cuil || '').replace(/-/g, '').includes(q);
        const matchRazon = (p.razon_social || '').toLowerCase().includes(q);
        const matchDir = (p.direccion || '').toLowerCase().includes(q);
        const matchSeguro = (p.seguro || '').toLowerCase().includes(q);
        const matchSss = (p.nro_sss || '').toLowerCase().includes(q);
        const matchEsp = (p.especialidad_principal || '').toLowerCase().includes(q);
        if (!matchNombre && !matchMat && !matchNif && !matchDni && !matchCuil && !matchRazon && !matchDir && !matchSeguro && !matchSss && !matchEsp) return false;
      }
      return true;
    };
  }, [onlyWithPhoto, filterEstado, filterModalidad, filterSeguro, filterSede, filterObraSocial, searchTerm]);

  // Aplicar filtros y ordenamiento (estricto por 1ª especialidad cuando hay filtro activo)
  const filteredDoctors = useMemo(() => {
    const list = baseList.filter(p => {
      if (!matchesNonEspFilters(p)) return false;
      if (filterEspecialidad && p.especialidad_principal !== filterEspecialidad) return false;
      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'ultima_desc') {
        return (b.ultima_atencion || '').localeCompare(a.ultima_atencion || '');
      }
      if (sortBy === 'ultima_asc') {
        return (a.ultima_atencion || '').localeCompare(b.ultima_atencion || '');
      }
      if (sortBy === 'primera_asc') {
        return (a.primera_atencion || '9999').localeCompare(b.primera_atencion || '9999');
      }
      if (sortBy === 'nombre_asc') {
        return (a.nombre || '').localeCompare(b.nombre || '', 'es');
      }
      return (b.total_atenciones || 0) - (a.total_atenciones || 0);
    });

    return sorted;
  }, [baseList, matchesNonEspFilters, filterEspecialidad, sortBy]);

  // Otros médicos que tienen la especialidad filtrada como secundaria
  const secondaryDoctorsForSelectedEsp = useMemo(() => {
    if (!filterEspecialidad) return [];
    return baseList
      .filter(p => {
        if (!matchesNonEspFilters(p)) return false;
        if (p.especialidad_principal === filterEspecialidad) return false;
        const secs = p.especialidades_secundarias || (p.especialidades || []).slice(1);
        return secs.some(e => e.nombre === filterEspecialidad);
      })
      .map(p => {
        const secs = p.especialidades_secundarias || (p.especialidades || []).slice(1);
        const secEntry = secs.find(e => e.nombre === filterEspecialidad);
        return { ...p, _secCant: secEntry?.cantidad || 0, _secPct: secEntry?.porcentaje || 0 };
      })
      .sort((a, b) => b._secCant - a._secCant);
  }, [baseList, matchesNonEspFilters, filterEspecialidad]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, onlyWithPhoto, filterEstado, filterModalidad, filterSeguro, filterEspecialidad, filterSede, filterObraSocial, includeGenericos, sortBy]);

  useEffect(() => {
    setShowSecundariosPanel(false);
  }, [filterEspecialidad]);

  useEffect(() => {
    setModalShowSecundarias(false);
  }, [selectedDoctor]);

  const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / PAGE_SIZE));
  const paginatedDoctors = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredDoctors.slice(start, start + PAGE_SIZE);
  }, [filteredDoctors, page]);

  // Analítica por Especialidad
  const analyticsEspecialidades = useMemo(() => {
    const map = {};
    baseList.forEach(p => {
      const esp = p.especialidad_principal || 'Sin especificar';
      if (esp === 'Sin especificar') return;
      if (!map[esp]) {
        map[esp] = { especialidad: esp, Activos: 0, BajaFrecuencia: 0, Inactivos: 0, total: 0 };
      }
      map[esp].total += 1;
      if (p.estado_actividad === 'Activo') map[esp].Activos += 1;
      else if (p.estado_actividad === 'Baja Frecuencia') map[esp].BajaFrecuencia += 1;
      else map[esp].Inactivos += 1;
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 14);
  }, [baseList]);

  // Analítica de Médicos con Atención Efectiva por Año
  const analyticsPorAnio = useMemo(() => {
    const yearMap = {};
    for (let y = 2016; y <= 2026; y++) {
      yearMap[y] = { anio: String(y), medicosActivosEseAnio: 0, totalAtenciones: 0 };
    }
    baseList.forEach(p => {
      (p.historial_anual || []).forEach(h => {
        if (yearMap[h.anio] && h.cantidad > 0) {
          yearMap[h.anio].medicosActivosEseAnio += 1;
          yearMap[h.anio].totalAtenciones += h.cantidad;
        }
      });
    });
    return Object.values(yearMap);
  }, [baseList]);

  // Exportar a Excel (.xlsx)
  function handleExportExcel() {
    const wb = XLSX.utils.book_new();
    const rowsExport = filteredDoctors.map(d => ({
      'ID SALUS': d.id_personal,
      'Médico / Prestador': d.nombre,
      'Matrícula Provincial (MP)': d.matricula || '',
      'N° Superintendencia Salud (SSS)': d.nro_sss || '',
      'DNI': d.dni || d.nif || '',
      'CUIL / CUIT': d.cuil || '',
      'Razón Social / Facturación': d.razon_social || '',
      'Dirección': d.direccion || '',
      'Localidad': d.localidad || '',
      'Código Postal': d.cp || '',
      'Seguro Responsabilidad Civil': d.seguro || '',
      'Vencimiento Seguro RC': formatDateAR(d.seguro_vencimiento),
      'Especialidad Principal (1ª)': d.especialidad_principal || '',
      'Especialidades Secundarias': (d.especialidades_secundarias || (d.especialidades || []).slice(1)).map(e => `${e.nombre} (${e.cantidad})`).join(', '),
      'Modalidad de Atención': d.modalidad_atencion || (d.es_solo_guardia ? 'Solo Guardia' : 'Consultorio / Programado'),
      'Es Solo de Guardia': d.es_solo_guardia ? 'Sí' : 'No',
      '% Atenciones en Guardia': d.pct_guardia !== undefined ? `${d.pct_guardia}%` : '0%',
      'Agendas de Guardia (SALUS)': (d.agendas_guardia || []).map(a => `${a.nombre} (${a.cantidad})`).join(' | '),
      'Estado de Actividad': d.estado_actividad,
      'Activo en Ficha SALUS': d.activo_salus ? 'Sí' : 'No',
      'Primera Atención (Desde)': formatDateAR(d.primera_atencion),
      'Última Atención (Hasta)': formatDateAR(d.ultima_atencion),
      'Días sin atender': d.dias_sin_atender,
      'Trayectoria': formatAntiguedad(d.primera_atencion, d.ultima_atencion),
      'Total Atenciones Históricas': d.total_atenciones,
      'Pacientes Únicos': d.pacientes_unicos,
      'Atenciones Últimos 30 días': d.atenciones_30d,
      'Atenciones Últimos 90 días': d.atenciones_90d,
      'Atenciones Último Año': d.atenciones_365d,
      'Meses Activos': d.meses_activos,
      'Promedio Mensual': d.promedio_por_mes_activo,
      'Sedes donde atiende': (d.sedes || []).map(s => `${s.sede} (${s.cantidad})`).join(' | '),
      'Top 5 Atenciones más concurridas': (d.top_atenciones || []).slice(0, 5).map(a => `${a.nombre} (${a.cantidad})`).join(' | '),
      'Top 5 Obras Sociales': (d.top_obras_sociales || []).slice(0, 5).map(o => `${o.nombre} (${o.cantidad})`).join(' | '),
      'Teléfono': d.telefono || '',
      'Email': d.email || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rowsExport);
    XLSX.utils.book_append_sheet(wb, ws, 'Padron_Medicos_SALUS');
    XLSX.writeFile(wb, `Padron_Medicos_SALUS_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '65vh', gap: '0.75rem', color: '#64748b' }}>
        <RefreshCw size={30} className="animate-spin" style={{ color: '#1E5FA6' }} />
        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Cargando Padrón Histórico de Médicos...</p>
      </div>
    );
  }

  return (
    <div className="pm-module">
      {/* ─── ENCABEZADO ─── */}
      <div className="pm-header">
        <div>
          <h2 className="pm-header__title">
            <Stethoscope size={24} style={{ color: '#1E5FA6' }} />
            Padrón Histórico y Línea de Tiempo de Médicos
          </h2>
          <p className="pm-header__subtitle">
            Base unificada de todos los profesionales que han atendido en el Sanatorio: estado de actividad, fechas extremas de atención, Top 15 prácticas y Obras Sociales más recibidas.
          </p>
        </div>

        <div className="pm-header__actions">
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            fontSize: '0.78rem', fontWeight: 600, color: '#475569',
            background: '#f8fafc', padding: '0.48rem 0.75rem',
            borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={includeGenericos}
              onChange={e => setIncludeGenericos(e.target.checked)}
            />
            Incluir agendas genéricas/servicios
          </label>

          <button
            type="button"
            className="pm-btn pm-btn--excel"
            onClick={handleExportExcel}
          >
            <Download size={15} />
            Exportar Padrón Excel ({filteredDoctors.length})
          </button>
        </div>
      </div>

      {/* ─── TARJETAS KPI INTERACTIVAS ─── */}
      <div className="pm-kpi-grid">
        <div
          className={`pm-kpi-card ${filterEstado === '' ? 'pm-kpi-card--selected' : ''}`}
          onClick={() => setFilterEstado('')}
          title="Ver todos los médicos"
        >
          <div>
            <div className="pm-kpi-card__label">Total Médicos</div>
            <div className="pm-kpi-card__value">{kpis.total.toLocaleString('es-AR')}</div>
            <div className="pm-kpi-card__sub">
              Han atendido en el Sanatorio
            </div>
          </div>
          <div className="pm-kpi-card__icon" style={{ background: '#EBF2FA', color: '#1E5FA6' }}>
            <Users size={20} />
          </div>
        </div>

        <div
          className={`pm-kpi-card ${filterEstado === 'Activo' ? 'pm-kpi-card--selected' : ''}`}
          onClick={() => setFilterEstado(filterEstado === 'Activo' ? '' : 'Activo')}
          title="Filtrar solo médicos activos (atendieron en los últimos 90 días)"
        >
          <div>
            <div className="pm-kpi-card__label">🟢 Médicos Activos</div>
            <div className="pm-kpi-card__value" style={{ color: '#15803d' }}>
              {kpis.activos.toLocaleString('es-AR')}
            </div>
            <div className="pm-kpi-card__sub">
              <strong>{kpis.pctActivos}%</strong> del padrón ({kpis.atendieron30d} en últ. 30d)
            </div>
          </div>
          <div className="pm-kpi-card__icon" style={{ background: '#DCFCE7', color: '#15803D' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div
          className={`pm-kpi-card ${filterEstado === 'Baja Frecuencia' ? 'pm-kpi-card--selected' : ''}`}
          onClick={() => setFilterEstado(filterEstado === 'Baja Frecuencia' ? '' : 'Baja Frecuencia')}
          title="Filtrar médicos con última atención entre 91 y 365 días atrás"
        >
          <div>
            <div className="pm-kpi-card__label">🟡 Baja Frecuencia</div>
            <div className="pm-kpi-card__value" style={{ color: '#b45309' }}>
              {kpis.bajaFrec.toLocaleString('es-AR')}
            </div>
            <div className="pm-kpi-card__sub">
              Última atención hace 3 a 12 meses
            </div>
          </div>
          <div className="pm-kpi-card__icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
            <Clock size={20} />
          </div>
        </div>

        <div
          className={`pm-kpi-card ${filterEstado === 'Inactivo' ? 'pm-kpi-card--selected' : ''}`}
          onClick={() => setFilterEstado(filterEstado === 'Inactivo' ? '' : 'Inactivo')}
          title="Filtrar médicos inactivos (> 1 año sin registrar atenciones)"
        >
          <div>
            <div className="pm-kpi-card__label">🔴 Inactivos / Históricos</div>
            <div className="pm-kpi-card__value" style={{ color: '#b91c1c' }}>
              {kpis.inactivos.toLocaleString('es-AR')}
            </div>
            <div className="pm-kpi-card__sub">
              Más de 365 días sin atender
            </div>
          </div>
          <div className="pm-kpi-card__icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
            <XCircle size={20} />
          </div>
        </div>

        <div
          className={`pm-kpi-card ${filterModalidad === 'solo_guardia' ? 'pm-kpi-card--selected' : ''}`}
          onClick={() => setFilterModalidad(filterModalidad === 'solo_guardia' ? '' : 'solo_guardia')}
          title="Filtrar médicos que atienden exclusivamente en agendas de Guardia en SALUS"
        >
          <div>
            <div className="pm-kpi-card__label">🚨 Solo de Guardia</div>
            <div className="pm-kpi-card__value" style={{ color: '#b45309' }}>
              {kpis.soloGuardia.toLocaleString('es-AR')}
            </div>
            <div className="pm-kpi-card__sub">
              Exclusivos agendas Guardias (+{kpis.mixtoGuardia} mixtos)
            </div>
          </div>
          <div className="pm-kpi-card__icon" style={{ background: '#FEF3C7', color: '#B45309' }}>
            <Activity size={20} />
          </div>
        </div>
      </div>

      {/* ─── NAVEGACIÓN DE PESTAÑAS ─── */}
      <div className="pm-tabs-bar">
        <div className="pm-tabs">
          <button
            type="button"
            className={`pm-tab ${activeTab === 'timeline' ? 'pm-tab--active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <GitCommitHorizontal size={16} />
            Línea de Tiempo Anual (Desde — Hasta)
          </button>
          <button
            type="button"
            className={`pm-tab ${activeTab === 'directorio' ? 'pm-tab--active' : ''}`}
            onClick={() => setActiveTab('directorio')}
          >
            <Table2 size={16} />
            Base de Datos de Médicos ({filteredDoctors.length})
          </button>
          <button
            type="button"
            className={`pm-tab ${activeTab === 'analitica' ? 'pm-tab--active' : ''}`}
            onClick={() => setActiveTab('analitica')}
          >
            <BarChart3 size={16} />
            Analítica de Especialidades y Evolución
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.74rem', color: '#475569' }}>
          {activeTab === 'timeline' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#ffffff', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontWeight: 700, color: '#334155' }}>Intensidad anual:</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#f8fafc', border: '1px solid #cbd5e1' }} /> Sin atención
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#e0f2fe', border: '1px solid #7dd3fc' }} /> &lt; 200
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#93c5fd' }} /> 200–999
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#1E5FA6' }} /> 1.000+ atenciones
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── BARRA DE FILTROS COMÚN ─── */}
      {activeTab !== 'analitica' && (
        <div className="pm-filters">
          <div className="pm-search-wrap">
            <Search
              size={15}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              className="pm-search-input"
              placeholder="Buscar por apellido, nombre, matrícula, DNI, CUIL, razón social, seguro, dirección o N° SSS..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="pm-select"
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
          >
            <option value="">Estado: Todos ({baseList.length})</option>
            <option value="Activo">🟢 Activos ≤ 90 días ({kpis.activos})</option>
            <option value="Baja Frecuencia">🟡 Baja Frecuencia 91-365d ({kpis.bajaFrec})</option>
            <option value="Inactivo">🔴 Inactivos &gt; 365 días ({kpis.inactivos})</option>
          </select>

          <EspecialidadSearchSelect
            options={allEspecialidades}
            value={filterEspecialidad}
            onChange={setFilterEspecialidad}
          />

          <select
            className="pm-select"
            value={filterModalidad}
            onChange={e => setFilterModalidad(e.target.value)}
            title="Filtrar según si el médico atiende en Consultorio o en Agendas de Guardia"
          >
            <option value="">Modalidad: Todas</option>
            <option value="solo_guardia">🚨 Solo de Guardia ({kpis.soloGuardia})</option>
            <option value="excluir_guardia">🚫 Excluir Solo Guardia ({kpis.total - kpis.soloGuardia})</option>
            <option value="consultorio">🏥 Solo Consultorio / Programado ({kpis.soloConsultorio})</option>
            <option value="mixto">🔄 Mixtos: Consultorio + Guardia ({kpis.mixtoGuardia})</option>
          </select>

          <select
            className="pm-select"
            value={filterSede}
            onChange={e => setFilterSede(e.target.value)}
          >
            <option value="">Todas las sedes</option>
            <option value="SAN LUIS SUR">🏥 Sede 1 (San Luis Sur)</option>
            <option value="SANTA FE">📍 Sede Santa Fe</option>
            <option value="SAN LUIS NORTE">🏥 Sede 2 (San Luis Norte)</option>
            <option value="SAN LUIS SEDE 3">🏥 Sede 3 (San Luis 463)</option>
          </select>

          <select
            className="pm-select"
            value={filterObraSocial}
            onChange={e => setFilterObraSocial(e.target.value)}
          >
            <option value="">Obra Social recibida...</option>
            {allObrasSociales.map(os => (
              <option key={os} value={os}>{os}</option>
            ))}
          </select>

          <select
            className="pm-select"
            value={filterSeguro}
            onChange={e => setFilterSeguro(e.target.value)}
            title="Filtrar por datos legales y seguro profesional en SALUS"
          >
            <option value="">Legajo SALUS: Todos</option>
            <option value="con_cuil">🧾 Con CUIL / Razón Social ({kpis.conCuil})</option>
            <option value="con_seguro">🛡️ Con Seguro RC cargado ({kpis.conSeguro})</option>
            <option value="sin_seguro">⚠️ Sin Seguro RC registrado ({kpis.total - kpis.conSeguro})</option>
            <option value="con_sss">🏛️ Con N° Superintendencia SSS ({kpis.conSss})</option>
          </select>

          <select
            className="pm-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ fontWeight: 700, color: '#1E5FA6' }}
          >
            <option value="ultima_desc">Ordenar: Última atención (Más reciente)</option>
            <option value="ultima_asc">Ordenar: Última atención (Más antigua)</option>
            <option value="total_desc">Ordenar: Mayor volumen de atenciones</option>
            <option value="primera_asc">Ordenar: Antigüedad (Primera atención)</option>
            <option value="nombre_asc">Ordenar: Alfabético (A → Z)</option>
          </select>

          <button
            type="button"
            className="pm-btn"
            onClick={() => setOnlyWithPhoto(prev => !prev)}
            style={{
              background: onlyWithPhoto ? '#1E5FA6' : '#f8fafc',
              color: onlyWithPhoto ? '#ffffff' : '#334155',
              borderColor: onlyWithPhoto ? '#1E5FA6' : '#cbd5e1',
            }}
            title="Filtrar médicos que tienen fotografía cargada en Prestadores"
          >
            📷 Con foto ({kpis.conFoto})
          </button>

          {(searchTerm || onlyWithPhoto || filterEstado || filterModalidad || filterSeguro || filterEspecialidad || filterSede || filterObraSocial) && (
            <button
              type="button"
              className="pm-btn pm-btn--secondary"
              onClick={() => {
                setSearchTerm('');
                setOnlyWithPhoto(false);
                setFilterEstado('');
                setFilterModalidad('');
                setFilterSeguro('');
                setFilterEspecialidad('');
                setFilterSede('');
                setFilterObraSocial('');
              }}
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* ─── BANNER DE OTROS MÉDICOS CON ESTA ESPECIALIDAD COMO SECUNDARIA ─── */}
      {activeTab !== 'analitica' && filterEspecialidad && secondaryDoctorsForSelectedEsp.length > 0 && (
        <div className="pm-secondary-banner">
          <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.4 }}>
            🎯 Mostrando <strong>{filteredDoctors.length}</strong> {filteredDoctors.length === 1 ? 'profesional' : 'profesionales'} cuya <strong>1ª especialidad principal</strong> es <strong>{filterEspecialidad}</strong>.
            {' '}Además, existen <strong>{secondaryDoctorsForSelectedEsp.length} médicos</strong> de otras especialidades que registran atenciones secundarias en <strong>{filterEspecialidad}</strong>.
          </div>
          <button
            type="button"
            className="pm-btn"
            style={{
              background: showSecundariosPanel ? '#1E5FA6' : '#ffffff',
              color: showSecundariosPanel ? '#ffffff' : '#1E5FA6',
              borderColor: '#1E5FA6',
              padding: '0.4rem 0.85rem',
              fontSize: '0.76rem',
            }}
            onClick={() => setShowSecundariosPanel(prev => !prev)}
          >
            {showSecundariosPanel
              ? 'Ocultar médicos con especialidad secundaria'
              : `➕ Ver otros ${secondaryDoctorsForSelectedEsp.length} médicos con ${filterEspecialidad} como secundaria`}
          </button>
        </div>
      )}

      {/* ============================================================
          VISTA 1 MEJORADA: MATRIZ ANUAL Y LÍNEA DE TIEMPO (2016–2026)
         ============================================================ */}
      {activeTab === 'timeline' && (
        <div className="pm-matrix-card">
          <div className="pm-matrix-scroll">
            <table className="pm-matrix-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '250px' }}>Médico / Especialidad</th>
                  <th style={{ minWidth: '150px' }}>Estado / Última vez</th>
                  {YEARS_LIST.map(yr => (
                    <th key={yr} className="pm-year-th">{yr}</th>
                  ))}
                  <th style={{ minWidth: '215px', textAlign: 'right' }}>Período (Desde → Hasta)</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDoctors.length === 0 ? (
                  <tr>
                    <td colSpan={16} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      No se encontraron médicos con los criterios seleccionados.
                    </td>
                  </tr>
                ) : (
                  paginatedDoctors.map(doc => {
                    const statusClass =
                      doc.estado_actividad === 'Activo'
                        ? 'pm-status--activo'
                        : doc.estado_actividad === 'Baja Frecuencia'
                        ? 'pm-status--baja'
                        : 'pm-status--inactivo';

                    const dotColor =
                      doc.estado_actividad === 'Activo'
                        ? '#16a34a'
                        : doc.estado_actividad === 'Baja Frecuencia'
                        ? '#d97706'
                        : '#dc2626';

                    const yearMap = {};
                    (doc.historial_anual || []).forEach(h => {
                      yearMap[h.anio] = h.cantidad;
                    });

                    return (
                      <tr
                        key={doc.id_personal}
                        onClick={() => setSelectedDoctor(doc)}
                        title="Hacé clic para ver la Ficha 360° completa del médico"
                      >
                        {/* Col 1: Médico + Avatar + Especialidad */}
                        <td>
                          <div className="pm-doc-cell">
                            <DoctorAvatar doc={doc} size={38} />
                            <div style={{ minWidth: 0 }}>
                              <div className="pm-doc-name" title={doc.nombre} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', maxWidth: '280px' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nombre}</span>
                                {doc.es_solo_guardia && (
                                  <span
                                    className="pm-guardia-badge"
                                    title={`Médico exclusivo de Guardia (${doc.pct_guardia}% en agendas Guardias: ${(doc.agendas_guardia || []).map(a => a.nombre).join(', ')})`}
                                  >
                                    🚨 Solo Guardia
                                  </span>
                                )}
                              </div>
                              <div className="pm-doc-meta" style={{ flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1E5FA6' }}>
                                  {formatEspDisplayName(doc.especialidad_principal)}
                                </span>
                                {(doc.especialidades_secundarias?.length || (doc.especialidades?.length || 0) - 1) > 0 && (
                                  <button
                                    type="button"
                                    className="pm-ver-mas-btn"
                                    onClick={e => toggleDoctorSecundarias(doc.id_personal, e)}
                                    title="Ver especialidades secundarias registradas por este profesional"
                                  >
                                    {expandedEspIds[doc.id_personal]
                                      ? 'Ocultar'
                                      : `Ver más (+${(doc.especialidades_secundarias || doc.especialidades.slice(1)).length})`}
                                  </button>
                                )}
                                {doc.matricula && (
                                  <span className="pm-meta-chip">MP {doc.matricula}</span>
                                )}
                                {doc.cuil ? (
                                  <span className="pm-meta-chip pm-meta-chip--cuil" title={`CUIL/CUIT: ${doc.cuil}${doc.razon_social ? ` • Razón Social: ${doc.razon_social}` : ''}`}>
                                    CUIL {doc.cuil}
                                  </span>
                                ) : doc.dni ? (
                                  <span className="pm-meta-chip">DNI {doc.dni}</span>
                                ) : null}
                                {doc.nro_sss && (
                                  <span className="pm-meta-chip pm-meta-chip--sss" title="N° Superintendencia de Servicios de Salud">
                                    SSS {doc.nro_sss}
                                  </span>
                                )}
                              </div>
                              {expandedEspIds[doc.id_personal] && (
                                <div className="pm-sec-esp-list" onClick={e => e.stopPropagation()}>
                                  {(doc.especialidades_secundarias || (doc.especialidades || []).slice(1)).map(sec => (
                                    <span
                                      key={sec.nombre}
                                      className="pm-sec-esp-chip"
                                      title={`${sec.nombre}: ${(sec.cantidad || 0).toLocaleString('es-AR')} atenciones (${sec.porcentaje || 0}%)`}
                                    >
                                      {sec.nombre} ({(sec.cantidad || 0).toLocaleString('es-AR')})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Col 2: Estado + Hace cuánto */}
                        <td>
                          <span className={`pm-status ${statusClass}`}>
                            <span className="pm-status__dot" style={{ background: dotColor }} />
                            {doc.estado_actividad}
                          </span>
                          <div style={{ fontSize: '0.71rem', color: '#475569', marginTop: '4px', fontWeight: 600 }}>
                            {formatTiempoSinAtender(doc.dias_sin_atender)}
                          </div>
                        </td>

                        {/* Cols 3..13: Celdas Año por Año (2016 a 2026) perfectamente alineadas */}
                        {YEARS_LIST.map(yr => {
                          const count = yearMap[yr] || 0;
                          const boxClass =
                            count >= 1000
                              ? 'pm-year-box--high'
                              : count >= 200
                              ? 'pm-year-box--mid'
                              : count > 0
                              ? 'pm-year-box--low'
                              : 'pm-year-box--empty';

                          return (
                            <td key={yr} className="pm-year-td">
                              <div
                                className={`pm-year-box ${boxClass}`}
                                title={`${doc.nombre} — Año ${yr}: ${count.toLocaleString('es-AR')} atenciones`}
                              >
                                {formatCompactCount(count)}
                              </div>
                            </td>
                          );
                        })}

                        {/* Col 14: Período (Desde → Hasta) y Total */}
                        <td style={{ textAlign: 'right' }}>
                          <div className="pm-period-box">
                            <span style={{ color: '#475569', fontWeight: 600 }}>
                              {formatDateAR(doc.primera_atencion)}
                            </span>
                            <ArrowRight size={12} style={{ color: '#94a3b8' }} />
                            <strong style={{ color: doc.estado_actividad === 'Activo' ? '#15803d' : '#b91c1c' }}>
                              {formatDateAR(doc.ultima_atencion)}
                            </strong>
                          </div>
                          <div style={{ fontSize: '0.69rem', color: '#64748b', marginTop: '3px' }}>
                            <strong>{doc.total_atenciones.toLocaleString('es-AR')}</strong> atenciones • <strong>{formatAntiguedad(doc.primera_atencion, doc.ultima_atencion)}</strong>
                          </div>
                        </td>

                        {/* Col 15: Botón Ficha 360° */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="pm-btn pm-btn--secondary"
                            style={{ padding: '0.32rem 0.6rem', fontSize: '0.72rem', color: '#1E5FA6', borderColor: '#bfdbfe', background: '#eff6ff' }}
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedDoctor(doc);
                            }}
                          >
                            <Eye size={13} />
                            360°
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginador */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.9rem 1.25rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
          }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Mostrando <strong>{(page - 1) * PAGE_SIZE + 1}</strong> a <strong>{Math.min(page * PAGE_SIZE, filteredDoctors.length)}</strong> de <strong>{filteredDoctors.length}</strong> profesionales
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="pm-btn pm-btn--secondary"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={15} /> Anterior
              </button>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0 0.5rem' }}>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                className="pm-btn pm-btn--secondary"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Siguiente <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          VISTA 2 MEJORADA: BASE DE DATOS DE MÉDICOS (TABLA COMPACTA Y LIMPIA)
         ============================================================ */}
      {activeTab === 'directorio' && (
        <div className="pm-table-card">
          <div className="pm-table-scroll">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Médico / Identificación</th>
                  <th>Especialidad</th>
                  <th>CUIL / Razón Social</th>
                  <th>Dirección / Seguro RC</th>
                  <th>Estado y Última Atención</th>
                  <th>Período de Atención (Desde → Hasta)</th>
                  <th style={{ textAlign: 'right' }}>Volumen Histórico</th>
                  <th>Sedes de Atención</th>
                  <th>Práctica #1 y Obra Social #1</th>
                  <th style={{ textAlign: 'center' }}>Ficha 360°</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDoctors.map(doc => {
                  const statusClass =
                    doc.estado_actividad === 'Activo'
                      ? 'pm-status--activo'
                      : doc.estado_actividad === 'Baja Frecuencia'
                      ? 'pm-status--baja'
                      : 'pm-status--inactivo';

                  const dotColor =
                    doc.estado_actividad === 'Activo'
                      ? '#16a34a'
                      : doc.estado_actividad === 'Baja Frecuencia'
                      ? '#d97706'
                      : '#dc2626';

                  const topPrac = doc.top_atenciones?.[0];
                  const topOS = doc.top_obras_sociales?.[0];

                  return (
                    <tr key={doc.id_personal} onClick={() => setSelectedDoctor(doc)}>
                      {/* Col 1: Avatar + Nombre en 1 línea + Chips MP / DNI / SSS */}
                      <td>
                        <div className="pm-doc-cell">
                          <DoctorAvatar doc={doc} size={38} />
                          <div>
                            <div className="pm-doc-name" title={doc.nombre} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', maxWidth: '280px' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nombre}</span>
                              {doc.es_solo_guardia && (
                                <span
                                  className="pm-guardia-badge"
                                  title={`Médico exclusivo de Guardia (${doc.pct_guardia}% en agendas Guardias: ${(doc.agendas_guardia || []).map(a => a.nombre).join(', ')})`}
                                >
                                  🚨 Solo Guardia
                                </span>
                              )}
                            </div>
                            <div className="pm-doc-meta">
                              <span className="pm-meta-chip">
                                {doc.matricula ? `MP ${doc.matricula}` : 'Sin MP'}
                              </span>
                              {(doc.dni || doc.nif) && (
                                <span className="pm-meta-chip">DNI {doc.dni || doc.nif}</span>
                              )}
                              {doc.nro_sss && (
                                <span className="pm-meta-chip pm-meta-chip--sss" title="N° Superintendencia de Servicios de Salud">
                                  SSS {doc.nro_sss}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: 1ª Especialidad Principal + botón Ver más */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span className="pm-esp-badge">
                            {formatEspDisplayName(doc.especialidad_principal)}
                          </span>
                          {(doc.especialidades_secundarias?.length || (doc.especialidades?.length || 0) - 1) > 0 && (
                            <button
                              type="button"
                              className="pm-ver-mas-btn"
                              onClick={e => toggleDoctorSecundarias(doc.id_personal, e)}
                              title="Ver otras especialidades secundarias de este profesional"
                            >
                              {expandedEspIds[doc.id_personal]
                                ? 'Ocultar'
                                : `Ver más (+${(doc.especialidades_secundarias || doc.especialidades.slice(1)).length})`}
                            </button>
                          )}
                        </div>
                        {expandedEspIds[doc.id_personal] && (
                          <div className="pm-sec-esp-list" onClick={e => e.stopPropagation()}>
                            {(doc.especialidades_secundarias || (doc.especialidades || []).slice(1)).map(sec => (
                              <span
                                key={sec.nombre}
                                className="pm-sec-esp-chip"
                                title={`${sec.nombre}: ${(sec.cantidad || 0).toLocaleString('es-AR')} atenciones (${sec.porcentaje || 0}%)`}
                              >
                                {sec.nombre} ({(sec.cantidad || 0).toLocaleString('es-AR')})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Col 3: CUIL / Razón Social */}
                      <td>
                        {doc.cuil ? (
                          <div style={{ fontWeight: 700, fontSize: '0.77rem', color: '#1e3a8a' }}>
                            {doc.cuil}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.73rem', color: '#94a3b8' }}>Sin CUIL</div>
                        )}
                        <div
                          style={{
                            fontSize: '0.69rem',
                            color: '#64748b',
                            maxWidth: '185px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={doc.razon_social || 'Sin razón social'}
                        >
                          {doc.razon_social || '—'}
                        </div>
                      </td>

                      {/* Col 4: Dirección & Seguro RC */}
                      <td>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            color: '#1e293b',
                            maxWidth: '215px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={doc.direccion || 'Sin dirección registrada'}
                        >
                          {doc.direccion ? `📍 ${doc.direccion}` : '—'}
                        </div>
                        <div style={{ fontSize: '0.69rem', color: doc.seguro ? '#0369a1' : '#94a3b8', marginTop: '2px', fontWeight: 600 }}>
                          {doc.seguro
                            ? `🛡️ ${doc.seguro}${doc.seguro_vencimiento ? ` (Vto: ${formatDateAR(doc.seguro_vencimiento)})` : ''}`
                            : 'Sin seguro RC en legajo'}
                        </div>
                      </td>

                      {/* Col 3: Estado Actual + Hace cuánto */}
                      <td>
                        <span className={`pm-status ${statusClass}`}>
                          <span className="pm-status__dot" style={{ background: dotColor }} />
                          {doc.estado_actividad}
                        </span>
                        <div style={{ fontSize: '0.71rem', color: '#64748b', marginTop: '3px', fontWeight: 600 }}>
                          {formatTiempoSinAtender(doc.dias_sin_atender)}
                        </div>
                      </td>

                      {/* Col 4: Período (Desde → Hasta) + Antigüedad */}
                      <td>
                        <div className="pm-period-box">
                          <span style={{ color: '#475569', fontWeight: 600 }}>
                            {formatDateAR(doc.primera_atencion)}
                          </span>
                          <ArrowRight size={12} style={{ color: '#94a3b8' }} />
                          <strong style={{ color: doc.estado_actividad === 'Activo' ? '#15803d' : '#0f172a' }}>
                            {formatDateAR(doc.ultima_atencion)}
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.69rem', color: '#64748b', marginTop: '3px' }}>
                          Trayectoria: <strong>{formatAntiguedad(doc.primera_atencion, doc.ultima_atencion)}</strong> ({doc.meses_activos} meses activos)
                        </div>
                      </td>

                      {/* Col 5: Volumen Histórico + Pacientes Únicos */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                          {doc.total_atenciones.toLocaleString('es-AR')} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748b' }}>atenc.</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>
                          👥 {doc.pacientes_unicos.toLocaleString('es-AR')} pac. únicos (~{doc.promedio_por_mes_activo}/mes)
                        </div>
                      </td>

                      {/* Col 6: Sedes en píldoras horizontales limpias */}
                      <td>
                        <div className="pm-sedes-row">
                          {(doc.sedes || []).map(s => (
                            <span
                              key={s.sede}
                              className={`pm-sede-pill ${s.sede === 'SANTA FE' ? 'pm-sede-pill--sf' : 'pm-sede-pill--sl'}`}
                              title={`${s.sede}: ${s.cantidad.toLocaleString('es-AR')} atenciones (Última: ${formatDateAR(s.ultima_vez)})`}
                            >
                              {shortenSedeName(s.sede)}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Col 7: Top Práctica #1 y Top Obra Social #1 bien alineados */}
                      <td>
                        <div className="pm-top-pair">
                          {topPrac && (
                            <div className="pm-top-line" title={`Práctica principal: ${topPrac.nombre} (${topPrac.cantidad.toLocaleString('es-AR')} atenciones)`}>
                              <span className="pm-top-line__name">🩺 {topPrac.nombre}</span>
                              <span className="pm-top-line__pct">{topPrac.porcentaje}%</span>
                            </div>
                          )}
                          {topOS && (
                            <div className="pm-top-line" title={`Obra Social principal: ${topOS.nombre} (${topOS.cantidad.toLocaleString('es-AR')} atenciones)`}>
                              <span className="pm-top-line__name" style={{ color: '#475569', fontWeight: 500 }}>
                                💳 {topOS.nombre}
                              </span>
                              <span className="pm-top-line__pct" style={{ background: '#f1f5f9', color: '#475569' }}>
                                {topOS.porcentaje}%
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Col 8: Botón Ver 360° */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="pm-btn pm-btn--secondary"
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.73rem', color: '#1E5FA6', borderColor: '#bfdbfe', background: '#eff6ff' }}
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedDoctor(doc);
                          }}
                        >
                          <Eye size={13} />
                          Ver 360°
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginador */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.9rem 1.25rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
          }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Mostrando <strong>{(page - 1) * PAGE_SIZE + 1}</strong> a <strong>{Math.min(page * PAGE_SIZE, filteredDoctors.length)}</strong> de <strong>{filteredDoctors.length}</strong> profesionales
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="pm-btn pm-btn--secondary"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={15} /> Anterior
              </button>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0 0.5rem' }}>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                className="pm-btn pm-btn--secondary"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Siguiente <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PANEL DESPLEGABLE DE MÉDICOS CON LA ESPECIALIDAD FILTRADA COMO SECUNDARIA ─── */}
      {activeTab !== 'analitica' && filterEspecialidad && showSecundariosPanel && secondaryDoctorsForSelectedEsp.length > 0 && (
        <div className="pm-secondary-section">
          <div className="pm-secondary-section__header">
            <div>
              <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>
                📋 Profesionales de otras especialidades con atenciones secundarias en {filterEspecialidad} ({secondaryDoctorsForSelectedEsp.length})
              </strong>
              <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '2px' }}>
                Separados del padrón principal para no contaminar la cabecera de {filterEspecialidad}, conservando la trazabilidad histórica de SALUS.
              </div>
            </div>
            <button
              type="button"
              className="pm-btn pm-btn--secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.74rem' }}
              onClick={() => setShowSecundariosPanel(false)}
            >
              Cerrar lista secundaria
            </button>
          </div>
          <div className="pm-table-scroll">
            <table className="pm-table" style={{ minWidth: '920px' }}>
              <thead>
                <tr>
                  <th>Médico / Prestador</th>
                  <th>1ª Especialidad Principal (Cabecera)</th>
                  <th style={{ textAlign: 'right' }}>Atenciones en {filterEspecialidad} (Secundaria)</th>
                  <th style={{ textAlign: 'right' }}>Total Histórico General</th>
                  <th>Estado Actual</th>
                  <th style={{ textAlign: 'center' }}>Ficha 360°</th>
                </tr>
              </thead>
              <tbody>
                {secondaryDoctorsForSelectedEsp.map(doc => (
                  <tr key={doc.id_personal} onClick={() => setSelectedDoctor(doc)}>
                    <td>
                      <div className="pm-doc-cell">
                        <DoctorAvatar doc={doc} size={34} />
                        <div>
                          <div className="pm-doc-name" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>{doc.nombre}</span>
                            {doc.es_solo_guardia && <span className="pm-guardia-badge">🚨 Solo Guardia</span>}
                          </div>
                          <div className="pm-doc-meta">
                            {doc.matricula && <span className="pm-meta-chip">MP {doc.matricula}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="pm-esp-badge">{doc.especialidad_principal}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#1E5FA6' }}>
                      {doc._secCant.toLocaleString('es-AR')} atenc.{' '}
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>({doc._secPct}%)</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                      {doc.total_atenciones.toLocaleString('es-AR')} atenc.
                    </td>
                    <td>
                      <span className={`pm-status ${
                        doc.estado_actividad === 'Activo'
                          ? 'pm-status--activo'
                          : doc.estado_actividad === 'Baja Frecuencia'
                          ? 'pm-status--baja'
                          : 'pm-status--inactivo'
                      }`}>
                        {doc.estado_actividad}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="pm-btn pm-btn--secondary"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.72rem', color: '#1E5FA6' }}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedDoctor(doc);
                        }}
                      >
                        <Eye size={13} /> Ver 360°
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          VISTA 3: ANALÍTICA INSTITUCIONAL DE PRESTADORES
         ============================================================ */}
      {activeTab === 'analitica' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div className="pm-box" style={{ gridColumn: '1 / -1' }}>
            <div className="pm-box__title">
              <span>🏥 Médicos Activos vs Baja Frecuencia vs Inactivos por Especialidad (Top 14)</span>
            </div>
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer>
                <BarChart data={analyticsEspecialidades} margin={{ top: 10, right: 20, left: 10, bottom: 55 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="especialidad" angle={-28} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                  <Bar dataKey="Activos" stackId="a" name="🟢 Activos (≤90d)" fill="#16A34A" />
                  <Bar dataKey="BajaFrecuencia" stackId="a" name="🟡 Baja Frecuencia (91-365d)" fill="#D97706" />
                  <Bar dataKey="Inactivos" stackId="a" name="🔴 Inactivos (>365d)" fill="#DC2626" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pm-box">
            <div className="pm-box__title">
              <span>📈 Médicos con Atención Efectiva por Año (2016–2026)</span>
            </div>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={analyticsPorAnio}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="anio" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="medicosActivosEseAnio" name="Médicos que atendieron ese año" fill="#1E5FA6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pm-box">
            <div className="pm-box__title">
              <span>📊 Volumen de Atenciones Médicas por Año (2016–2026)</span>
            </div>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={analyticsPorAnio}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="anio" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={val => Number(val).toLocaleString('es-AR')} />
                  <Bar dataKey="totalAtenciones" name="Total Atenciones" fill="#0284C7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL FICHA 360° DEL MÉDICO (DETALLE COMPLETO)
         ============================================================ */}
      {selectedDoctor && (
        <div className="pm-modal-backdrop" onClick={() => setSelectedDoctor(null)}>
          <div className="pm-modal" onClick={e => e.stopPropagation()}>
            {/* Header Ficha 360 */}
            <div className="pm-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
                <DoctorAvatar doc={selectedDoctor} size={64} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
                      {selectedDoctor.nombre}
                    </h3>
                    <span className={`pm-status ${
                      selectedDoctor.estado_actividad === 'Activo'
                        ? 'pm-status--activo'
                        : selectedDoctor.estado_actividad === 'Baja Frecuencia'
                        ? 'pm-status--baja'
                        : 'pm-status--inactivo'
                    }`}>
                      {selectedDoctor.estado_actividad}
                    </span>
                    {selectedDoctor.es_solo_guardia && (
                      <span className="pm-guardia-badge pm-guardia-badge--header">
                        🚨 Médico Exclusivo de Guardia ({selectedDoctor.pct_guardia}%)
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '1.1rem', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.92 }}>
                    <span>🩺 <strong>{selectedDoctor.especialidad_principal}</strong></span>
                    {selectedDoctor.matricula && <span>🪪 Matrícula MP: <strong>{selectedDoctor.matricula}</strong></span>}
                    {selectedDoctor.nro_sss && <span>🏛️ N° Superintendencia (SSS): <strong>{selectedDoctor.nro_sss}</strong></span>}
                    {selectedDoctor.cuil ? (
                      <span>🧾 CUIL/CUIT: <strong>{selectedDoctor.cuil}</strong></span>
                    ) : (selectedDoctor.dni || selectedDoctor.nif) ? (
                      <span>🔢 DNI: <strong>{selectedDoctor.dni || selectedDoctor.nif}</strong></span>
                    ) : null}
                    {selectedDoctor.telefono && <span>📞 {selectedDoctor.telefono}</span>}
                    {selectedDoctor.email && <span>✉️ {selectedDoctor.email}</span>}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDoctor(null)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  border: 'none',
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            {/* Body Ficha 360 */}
            <div className="pm-modal__body">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.85rem',
              }}>
                <div className="pm-box" style={{ padding: '0.9rem 1rem', borderLeft: '4px solid #1E5FA6' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Primera Atención (Desde)
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    {formatDateAR(selectedDoctor.primera_atencion)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Alta SALUS: {formatDateAR(selectedDoctor.fecha_alta_salus)}
                  </div>
                </div>

                <div className="pm-box" style={{
                  padding: '0.9rem 1rem',
                  borderLeft: `4px solid ${selectedDoctor.estado_actividad === 'Activo' ? '#16A34A' : '#DC2626'}`,
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Última Atención (Hasta)
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    {formatDateAR(selectedDoctor.ultima_atencion)}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: selectedDoctor.estado_actividad === 'Activo' ? '#15803d' : '#b91c1c', marginTop: '2px' }}>
                    {formatTiempoSinAtender(selectedDoctor.dias_sin_atender)}
                  </div>
                </div>
              </div>

              {/* ─── DATOS FISCALES, LEGALES, DIRECCIÓN Y SEGURO PROFESIONAL (SALUS) ─── */}
              <div className="pm-box">
                <h4 className="pm-box__title">
                  <span>🏛️ Datos Fiscales, Legales, Dirección y Seguro Profesional (SALUS)</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b' }}>
                    ID Personal SALUS #{selectedDoctor.id_personal}
                  </span>
                </h4>
                <div className="pm-legal-grid">
                  <div className="pm-legal-item">
                    <span className="pm-legal-item__label">🧾 CUIL / CUIT</span>
                    <span className="pm-legal-item__val" style={{ color: selectedDoctor.cuil ? '#1E5FA6' : '#94a3b8' }}>
                      {selectedDoctor.cuil || 'No registrado'}
                    </span>
                    <span className="pm-legal-item__sub">
                      DNI: <strong>{selectedDoctor.dni || selectedDoctor.nif || '—'}</strong>
                    </span>
                  </div>

                  <div className="pm-legal-item">
                    <span className="pm-legal-item__label">🏢 Razón Social / Facturación</span>
                    <span className="pm-legal-item__val" style={{ color: selectedDoctor.razon_social ? '#0f172a' : '#94a3b8' }}>
                      {selectedDoctor.razon_social || 'No registrada'}
                    </span>
                    <span className="pm-legal-item__sub">
                      Entidad fiscal asociada en SALUS
                    </span>
                  </div>

                  <div className="pm-legal-item">
                    <span className="pm-legal-item__label">📍 Dirección Registrada</span>
                    <span className="pm-legal-item__val" style={{ color: selectedDoctor.direccion ? '#0f172a' : '#94a3b8' }}>
                      {selectedDoctor.calle || selectedDoctor.direccion || 'No registrada'}
                    </span>
                    <span className="pm-legal-item__sub">
                      {[selectedDoctor.localidad, selectedDoctor.cp ? `CP ${selectedDoctor.cp}` : ''].filter(Boolean).join(' • ') || 'San Juan'}
                    </span>
                  </div>

                  <div className="pm-legal-item">
                    <span className="pm-legal-item__label">🛡️ Seguro Responsabilidad Civil</span>
                    <span className="pm-legal-item__val" style={{ color: selectedDoctor.seguro ? '#0369a1' : '#94a3b8' }}>
                      {selectedDoctor.seguro || 'No registrado en legajo'}
                    </span>
                    <span className="pm-legal-item__sub">
                      {selectedDoctor.seguro_vencimiento
                        ? `Vencimiento póliza: ${formatDateAR(selectedDoctor.seguro_vencimiento)}`
                        : 'Sin fecha de vencimiento informada'}
                    </span>
                  </div>

                  <div className="pm-legal-item">
                    <span className="pm-legal-item__label">🏛️ N° Superintendencia Salud (SSS)</span>
                    <span className="pm-legal-item__val" style={{ color: selectedDoctor.nro_sss ? '#15803d' : '#94a3b8' }}>
                      {selectedDoctor.nro_sss || 'No registrado'}
                    </span>
                    <span className="pm-legal-item__sub">
                      Matrícula Provincial (MP): <strong>{selectedDoctor.matricula || '—'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Evolución Anual + Sedes & Especialidades */}
              <div className="pm-detail-grid">
                <div className="pm-box">
                  <h4 className="pm-box__title">
                    <span>📅 Línea de Tiempo Anual de Atenciones</span>
                    <span style={{ fontSize: '0.73rem', fontWeight: 500, color: '#64748b' }}>
                      {selectedDoctor.meses_activos} meses con actividad registrada
                    </span>
                  </h4>
                  {selectedDoctor.historial_anual?.length > 0 ? (
                    <div style={{ width: '100%', height: 210 }}>
                      <ResponsiveContainer>
                        <BarChart data={selectedDoctor.historial_anual}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="anio" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={v => Number(v).toLocaleString('es-AR')} />
                          <Bar dataKey="cantidad" name="Atenciones" fill="#1E5FA6" radius={[5, 5, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Sin desglose anual disponible.</p>
                  )}
                </div>

                <div className="pm-box" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <h4 className="pm-box__title" style={{ marginBottom: '0.6rem' }}>
                      <span>🏥 Sedes de Atención en el Sanatorio</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {(selectedDoctor.sedes || []).map(s => {
                        const pct = selectedDoctor.total_atenciones > 0
                          ? ((s.cantidad / selectedDoctor.total_atenciones) * 100).toFixed(1)
                          : 0;
                        return (
                          <div key={s.sede} className="pm-rank-item" style={{ justifyContent: 'space-between' }}>
                            <div>
                              <strong style={{ color: '#0f172a' }}>{s.sede}</strong>
                              <span style={{ fontSize: '0.71rem', color: '#64748b', marginLeft: '0.5rem' }}>
                                Última vez: {formatDateAR(s.ultima_vez)}
                              </span>
                            </div>
                            <div style={{ fontWeight: 700, color: '#1E5FA6' }}>
                              {s.cantidad.toLocaleString('es-AR')} ({pct}%)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="pm-box__title" style={{ marginBottom: '0.6rem' }}>
                      <span>🎓 Especialidad Principal y Secundarias</span>
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: '#1E5FA6',
                          color: '#ffffff',
                          padding: '0.32rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        ⭐ 1ª Principal: {selectedDoctor.especialidad_principal}
                        {selectedDoctor.especialidades?.[0]?.cantidad > 0
                          ? ` (${selectedDoctor.especialidades[0].cantidad.toLocaleString('es-AR')})`
                          : ''}
                      </span>

                      {(selectedDoctor.especialidades_secundarias?.length || (selectedDoctor.especialidades?.length || 0) - 1) > 0 && (
                        <button
                          type="button"
                          className="pm-ver-mas-btn"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.74rem' }}
                          onClick={() => setModalShowSecundarias(prev => !prev)}
                        >
                          {modalShowSecundarias
                            ? 'Ocultar especialidades secundarias'
                            : `Ver más especialidades (+${(selectedDoctor.especialidades_secundarias || selectedDoctor.especialidades.slice(1)).length})`}
                        </button>
                      )}
                    </div>

                    {modalShowSecundarias && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                        {(selectedDoctor.especialidades_secundarias || (selectedDoctor.especialidades || []).slice(1)).map(e => (
                          <span
                            key={e.nombre}
                            style={{
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              padding: '0.26rem 0.6rem',
                              borderRadius: '7px',
                              fontSize: '0.73rem',
                              fontWeight: 600,
                            }}
                          >
                            {e.nombre} {e.cantidad > 0 ? `(${e.cantidad.toLocaleString('es-AR')} • ${e.porcentaje || 0}%)` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Modalidad de Atención y Agendas de Guardia */}
                  <div>
                    <h4 className="pm-box__title" style={{ marginBottom: '0.6rem' }}>
                      <span>🚨 Modalidad y Agendas de Guardia (SALUS)</span>
                    </h4>
                    <div style={{ fontSize: '0.79rem', color: '#334155', marginBottom: selectedDoctor.agendas_guardia?.length ? '0.5rem' : 0 }}>
                      Modalidad detectada:{' '}
                      <strong style={{ color: selectedDoctor.es_solo_guardia ? '#b45309' : '#1E5FA6' }}>
                        {selectedDoctor.es_solo_guardia
                          ? `🚨 Exclusivo de Guardia (${selectedDoctor.pct_guardia}% de sus visitas)`
                          : selectedDoctor.atenciones_guardia > 0
                          ? `🔄 Consultorio + Guardia (${selectedDoctor.pct_guardia}% en guardia)`
                          : '🏥 Consultorio / Atención Programada (sin agendas de guardia)'}
                      </strong>
                    </div>
                    {selectedDoctor.agendas_guardia?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {selectedDoctor.agendas_guardia.map(ag => (
                          <div key={ag.nombre} className="pm-rank-item" style={{ justifyContent: 'space-between', background: '#fffbeb', borderColor: '#fde68a' }}>
                            <div>
                              <strong style={{ color: '#92400e' }}>{ag.nombre}</strong>
                              {ag.ultima_vez && (
                                <span style={{ fontSize: '0.7rem', color: '#b45309', marginLeft: '0.5rem' }}>
                                  Última guardia: {formatDateAR(ag.ultima_vez)}
                                </span>
                              )}
                            </div>
                            <strong style={{ color: '#b45309' }}>
                              {ag.cantidad.toLocaleString('es-AR')} atenc.
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* TOP OBRAS SOCIALES MÁS RECIBIDAS */}
              <div className="pm-box">
                <h4 className="pm-box__title">
                  <span>💳 Obras Sociales / Financiadores Más Recibidos</span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                    Top Coberturas del Profesional en SALUS
                  </span>
                </h4>
                <div className="pm-rank-list" style={{ maxHeight: '320px' }}>
                  {(selectedDoctor.top_obras_sociales || []).length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Sin obras sociales detalladas.</p>
                  ) : (
                    selectedDoctor.top_obras_sociales.map((os, idx) => (
                      <div key={os.nombre} className="pm-rank-item">
                        <div className="pm-rank-num" style={{ background: '#E0F2FE', color: '#0369A1' }}>
                          #{idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={os.nombre}>
                            {os.nombre}
                          </div>
                          <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '99px', marginTop: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, os.porcentaje)}%`, height: '100%', background: '#0284C7' }} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 800, color: '#0369A1' }}>
                            {os.cantidad.toLocaleString('es-AR')}
                          </div>
                          <div style={{ fontSize: '0.69rem', color: '#64748b', fontWeight: 600 }}>
                            {os.porcentaje}%
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
