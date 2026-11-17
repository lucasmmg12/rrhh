import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Stethoscope, Search, Download, RefreshCw, Clock, CheckCircle2,
  AlertTriangle, XCircle, Calendar, Building2, Award, CreditCard,
  Activity, Users, Phone, Mail, Hash, ChevronLeft, ChevronRight,
  BarChart3, Table2, GitCommitHorizontal, Eye, Filter,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts';
import { supabase } from '../supabaseClient';
import './padron-medicos.css';

const TIMELINE_MIN_YEAR = 2016;
const TIMELINE_MAX_YEAR = 2026;
const TIMELINE_SPAN_MS =
  new Date(`${TIMELINE_MAX_YEAR}-12-31T23:59:59`).getTime() -
  new Date(`${TIMELINE_MIN_YEAR}-01-01T00:00:00`).getTime();

function formatDateAR(isoStr) {
  if (!isoStr) return '—';
  const parts = String(isoStr).split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoStr;
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
  return `${diffDays} días`;
}

function formatTiempoSinAtender(dias) {
  if (dias === null || dias === undefined) return '—';
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer (1 día)';
  if (dias < 30) return `Hace ${dias} días`;
  if (dias < 365) {
    const m = Math.floor(dias / 30);
    return `Hace ${m} ${m === 1 ? 'mes' : 'meses'} (${dias}d)`;
  }
  const y = (dias / 365).toFixed(1);
  return `Hace ${y} años (${dias}d)`;
}

function getTimelinePosition(primeraIso, ultimaIso) {
  const minMs = new Date(`${TIMELINE_MIN_YEAR}-01-01T00:00:00`).getTime();
  const maxMs = new Date(`${TIMELINE_MAX_YEAR}-12-31T23:59:59`).getTime();

  const dStart = primeraIso ? new Date(primeraIso + 'T00:00:00').getTime() : minMs;
  const dEnd = ultimaIso ? new Date(ultimaIso + 'T00:00:00').getTime() : dStart;

  const clampedStart = Math.max(minMs, Math.min(maxMs, dStart));
  const clampedEnd = Math.max(clampedStart, Math.min(maxMs, dEnd));

  const leftPct = ((clampedStart - minMs) / TIMELINE_SPAN_MS) * 100;
  const widthPct = Math.max(1.5, ((clampedEnd - clampedStart) / TIMELINE_SPAN_MS) * 100);

  return {
    left: `${Math.min(98, Math.max(0, leftPct)).toFixed(2)}%`,
    width: `${Math.min(100 - leftPct, widthPct).toFixed(2)}%`,
  };
}

export default function PadronMedicosApp() {
  const [profesionales, setProfesionales] = useState([]);
  const [metaInfo, setMetaInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'directorio' | 'analitica'

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState(''); // '' | 'Activo' | 'Baja Frecuencia' | 'Inactivo'
  const [filterEspecialidad, setFilterEspecialidad] = useState('');
  const [filterSede, setFilterSede] = useState('');
  const [filterObraSocial, setFilterObraSocial] = useState('');
  const [includeGenericos, setIncludeGenericos] = useState(false);
  const [sortBy, setSortBy] = useState('ultima_desc'); // 'ultima_desc' | 'ultima_asc' | 'total_desc' | 'primera_asc' | 'nombre_asc'

  // Paginación para fluidez con 1,242 médicos
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 35;

  // Médico seleccionado para Ficha 360°
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  useEffect(() => {
    loadPadron();
  }, []);

  async function loadPadron() {
    setLoading(true);
    try {
      // 1. Intentar cargar el JSON pre-extraído de SALUS (ultra rápido, 1,242 médicos completos)
      const res = await fetch('/data/padron_medicos_salus.json');
      if (res.ok) {
        const json = await res.json();
        setProfesionales(json.profesionales || []);
        setMetaInfo({
          generated_at: json.generated_at,
          source: json.source,
        });
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Error cargando JSON local de SALUS, intentando Supabase...', err);
    }

    // 2. Fallback a tabla Supabase padron_medicos_salus si existe
    try {
      const { data, error } = await supabase
        .from('padron_medicos_salus')
        .select('*')
        .order('total_atenciones', { ascending: false });
      if (!error && data && data.length > 0) {
        setProfesionales(data);
      }
    } catch (err) {
      console.error('Error cargando padron_medicos_salus:', err);
    }
    setLoading(false);
  }

  async function handleSyncSalus() {
    setSyncing(true);
    try {
      const resp = await fetch('http://localhost:3457/api/rrhh/sync/padron-medicos');
      const data = await resp.json();
      if (data.success) {
        await loadPadron();
        alert(`Sincronización con SALUS completada: ${data.total_profesionales} profesionales actualizados.`);
      } else {
        alert('Error al sincronizar con SALUS: ' + (data.error || 'Verificar que RRHH Sync Server esté corriendo en puerto 3457'));
      }
    } catch {
      alert('Para actualizar en vivo desde SQL Server SALUS, asegurate de tener ejecutando "Iniciar RRHH Sync.bat" (puerto 3457). Actualmente estás visualizando la base completa extraída de SALUS.');
    } finally {
      setSyncing(false);
    }
  }

  // Filtrar base (nominales vs genéricos)
  const baseList = useMemo(() => {
    return includeGenericos ? profesionales : profesionales.filter(p => !p.es_generico);
  }, [profesionales, includeGenericos]);

  // Catálogos dinámicos para selectores de filtro
  const allEspecialidades = useMemo(() => {
    const map = new Map();
    baseList.forEach(p => {
      (p.especialidades || []).forEach(e => {
        if (e.nombre) {
          map.set(e.nombre, (map.get(e.nombre) || 0) + 1);
        }
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, count]) => ({ nombre, count }));
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

    return {
      total,
      activos,
      bajaFrec,
      inactivos,
      totalAtenciones,
      atendieron30d,
      pctActivos: total > 0 ? ((activos / total) * 100).toFixed(1) : '0.0',
    };
  }, [baseList]);

  // Aplicar filtros y ordenamiento
  const filteredDoctors = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    const list = baseList.filter(p => {
      if (filterEstado && p.estado_actividad !== filterEstado) return false;
      if (filterEspecialidad) {
        const hasEsp =
          p.especialidad_principal === filterEspecialidad ||
          (p.especialidades || []).some(e => e.nombre === filterEspecialidad);
        if (!hasEsp) return false;
      }
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
        const matchEsp = (p.especialidad_principal || '').toLowerCase().includes(q);
        if (!matchNombre && !matchMat && !matchNif && !matchEsp) return false;
      }
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
      // default: total_desc
      return (b.total_atenciones || 0) - (a.total_atenciones || 0);
    });

    return sorted;
  }, [baseList, filterEstado, filterEspecialidad, filterSede, filterObraSocial, searchTerm, sortBy]);

  // Resetear página al cambiar filtros
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterEstado, filterEspecialidad, filterSede, filterObraSocial, includeGenericos, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / PAGE_SIZE));
  const paginatedDoctors = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredDoctors.slice(start, start + PAGE_SIZE);
  }, [filteredDoctors, page]);

  // Analítica por Especialidad (Activos vs Baja Frecuencia vs Inactivos)
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
      'Matrícula': d.matricula || '',
      'DNI / NIF': d.nif || '',
      'Especialidad Principal': d.especialidad_principal || '',
      'Otras Especialidades': (d.especialidades || []).slice(1).map(e => e.nombre).join(', '),
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
        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Cargando Padrón Histórico de Médicos desde SALUS...</p>
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
            Padrón Histórico y Línea de Tiempo de Médicos (SALUS)
          </h2>
          <p className="pm-header__subtitle">
            Base unificada de todos los profesionales que han atendido en el Sanatorio: estado de actividad, fechas extremas de atención, Top 15 prácticas y Obras Sociales más recibidas.
            {metaInfo?.generated_at && (
              <span style={{ marginLeft: '0.5rem', color: '#0284c7', fontWeight: 600 }}>
                • Fuente: {metaInfo.source} ({formatDateAR(metaInfo.generated_at)})
              </span>
            )}
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

          <button
            type="button"
            className="pm-btn pm-btn--primary"
            onClick={handleSyncSalus}
            disabled={syncing}
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando SALUS...' : 'Actualizar desde SALUS'}
          </button>
        </div>
      </div>

      {/* ─── TARJETAS KPI INTERACTIVAS (CLIC PARA FILTRAR POR ESTADO) ─── */}
      <div className="pm-kpi-grid">
        <div
          className={`pm-kpi-card ${filterEstado === '' ? 'pm-kpi-card--selected' : ''}`}
          onClick={() => setFilterEstado('')}
          title="Ver todos los médicos"
        >
          <div>
            <div className="pm-kpi-card__label">Total Médicos (SALUS)</div>
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

        <div className="pm-kpi-card" style={{ cursor: 'default' }}>
          <div>
            <div className="pm-kpi-card__label">Atenciones Analizadas</div>
            <div className="pm-kpi-card__value" style={{ color: '#1E5FA6' }}>
              {(kpis.totalAtenciones / 1000000).toFixed(2)}M
            </div>
            <div className="pm-kpi-card__sub">
              {kpis.totalAtenciones.toLocaleString('es-AR')} consultas/prácticas
            </div>
          </div>
          <div className="pm-kpi-card__icon" style={{ background: '#E0F2FE', color: '#0284C7' }}>
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
            Línea de Tiempo (Desde — Hasta cuándo atendió)
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

        <div style={{ fontSize: '0.77rem', color: '#64748b', fontWeight: 500 }}>
          💡 Hacé clic sobre cualquier médico para abrir su <strong>Ficha 360°</strong> (Top 15 Atenciones, Obras Sociales, Sedes e Historial Anual).
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
              placeholder="Buscar médico por apellido, nombre, matrícula, DNI o especialidad..."
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

          <select
            className="pm-select"
            value={filterEspecialidad}
            onChange={e => setFilterEspecialidad(e.target.value)}
          >
            <option value="">Todas las especialidades ({allEspecialidades.length})</option>
            {allEspecialidades.map(e => (
              <option key={e.nombre} value={e.nombre}>
                {e.nombre} ({e.count})
              </option>
            ))}
          </select>

          <select
            className="pm-select"
            value={filterSede}
            onChange={e => setFilterSede(e.target.value)}
          >
            <option value="">Todas las sedes</option>
            <option value="SAN LUIS SUR">🏥 SAN LUIS SUR (Sede 1)</option>
            <option value="SANTA FE">📍 SANTA FE</option>
            <option value="SAN LUIS NORTE">🏥 SAN LUIS NORTE (Sede 2)</option>
            <option value="SAN LUIS SEDE 3">🏥 SAN LUIS SEDE 3</option>
          </select>

          <select
            className="pm-select"
            value={filterObraSocial}
            onChange={e => setFilterObraSocial(e.target.value)}
          >
            <option value="">Filtrar por Obra Social recibida...</option>
            {allObrasSociales.map(os => (
              <option key={os} value={os}>{os}</option>
            ))}
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

          {(searchTerm || filterEstado || filterEspecialidad || filterSede || filterObraSocial) && (
            <button
              type="button"
              className="pm-btn pm-btn--secondary"
              onClick={() => {
                setSearchTerm('');
                setFilterEstado('');
                setFilterEspecialidad('');
                setFilterSede('');
                setFilterObraSocial('');
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* ============================================================
          VISTA 1: LÍNEA DE TIEMPO DE ATENCIÓN MÉDICA (DESDE — HASTA)
         ============================================================ */}
      {activeTab === 'timeline' && (
        <div className="pm-timeline-card">
          {/* Escala de años superior */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '270px 150px 1fr 140px',
            gap: '1rem',
            padding: '0.5rem 0.75rem 0.75rem',
            borderBottom: '2px solid #e2e8f0',
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
          }}>
            <div>Médico / Especialidad</div>
            <div>Estado / Última vez</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
              {Array.from({ length: TIMELINE_MAX_YEAR - TIMELINE_MIN_YEAR + 1 }, (_, i) => TIMELINE_MIN_YEAR + i).map(yr => (
                <span key={yr}>{yr}</span>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>Período (Desde — Hasta)</div>
          </div>

          {paginatedDoctors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              No se encontraron médicos con los criterios seleccionados.
            </div>
          ) : (
            paginatedDoctors.map(doc => {
              const pos = getTimelinePosition(doc.primera_atencion, doc.ultima_atencion);
              const barColor =
                doc.estado_actividad === 'Activo'
                  ? 'linear-gradient(90deg, #1E5FA6, #16A34A)'
                  : doc.estado_actividad === 'Baja Frecuencia'
                  ? 'linear-gradient(90deg, #0284C7, #D97706)'
                  : 'linear-gradient(90deg, #94A3B8, #DC2626)';

              const statusClass =
                doc.estado_actividad === 'Activo'
                  ? 'pm-status--activo'
                  : doc.estado_actividad === 'Baja Frecuencia'
                  ? 'pm-status--baja'
                  : 'pm-status--inactivo';

              return (
                <div
                  key={doc.id_personal}
                  className="pm-timeline-row"
                  onClick={() => setSelectedDoctor(doc)}
                  title="Clic para abrir Ficha 360° del médico"
                >
                  {/* Col 1: Nombre y Especialidad */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.83rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doc.nombre}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#1E5FA6', fontWeight: 600, display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span>{doc.especialidad_principal}</span>
                      {doc.matricula && <span style={{ color: '#64748b' }}>• MP {doc.matricula}</span>}
                    </div>
                  </div>

                  {/* Col 2: Badge Estado + Hace cuánto */}
                  <div>
                    <span className={`pm-status ${statusClass}`}>
                      {doc.estado_actividad}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '3px', fontWeight: 500 }}>
                      {formatTiempoSinAtender(doc.dias_sin_atender)}
                    </div>
                  </div>

                  {/* Col 3: Barra de línea de tiempo */}
                  <div>
                    <div className="pm-timeline-track">
                      <div
                        className="pm-timeline-bar"
                        style={{
                          left: pos.left,
                          width: pos.width,
                          background: barColor,
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginTop: '3px' }}>
                      <span>
                        <strong>{doc.total_atenciones.toLocaleString('es-AR')}</strong> atenciones ({doc.pacientes_unicos.toLocaleString('es-AR')} pac.)
                      </span>
                      <span>
                        Trayectoria: <strong>{formatAntiguedad(doc.primera_atencion, doc.ultima_atencion)}</strong> ({doc.meses_activos} meses activos)
                      </span>
                    </div>
                  </div>

                  {/* Col 4: Fechas Desde — Hasta */}
                  <div style={{ textAlign: 'right', fontSize: '0.74rem' }}>
                    <div style={{ color: '#475569' }}>
                      <span style={{ color: '#94a3b8' }}>Desde:</span> <strong>{formatDateAR(doc.primera_atencion)}</strong>
                    </div>
                    <div style={{ color: doc.estado_actividad === 'Activo' ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                      <span style={{ color: '#94a3b8', fontWeight: 400 }}>Última:</span> {formatDateAR(doc.ultima_atencion)}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Paginador */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: '1rem', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0',
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
          VISTA 2: BASE DE DATOS DE MÉDICOS (TABLA COMPLETA)
         ============================================================ */}
      {activeTab === 'directorio' && (
        <div className="pm-table-card">
          <div className="pm-table-scroll">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Médico / Matrícula</th>
                  <th>Especialidades</th>
                  <th>Estado Actual</th>
                  <th>Desde (1ª Atención)</th>
                  <th>Hasta (Últ. Atención)</th>
                  <th>Tiempo sin atender</th>
                  <th style={{ textAlign: 'right' }}>Total Atenciones</th>
                  <th style={{ textAlign: 'right' }}>Pacientes Únicos</th>
                  <th>Sedes</th>
                  <th>Práctica #1 / Obra Social #1</th>
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

                  const topPrac = doc.top_atenciones?.[0];
                  const topOS = doc.top_obras_sociales?.[0];

                  return (
                    <tr key={doc.id_personal} onClick={() => setSelectedDoctor(doc)}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{doc.nombre}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {doc.matricula ? `MP: ${doc.matricula}` : 'Sin MP'}
                          {doc.nif ? ` • DNI/CUIT: ${doc.nif}` : ''}
                        </div>
                      </td>

                      <td>
                        <span style={{
                          display: 'inline-block',
                          background: '#EBF2FA',
                          color: '#1E5FA6',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          padding: '0.18rem 0.5rem',
                          borderRadius: '6px',
                        }}>
                          {doc.especialidad_principal}
                        </span>
                        {doc.especialidades?.length > 1 && (
                          <span style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: '0.35rem' }}>
                            +{doc.especialidades.length - 1} más
                          </span>
                        )}
                      </td>

                      <td>
                        <span className={`pm-status ${statusClass}`}>
                          {doc.estado_actividad}
                        </span>
                      </td>

                      <td style={{ fontWeight: 500 }}>{formatDateAR(doc.primera_atencion)}</td>

                      <td style={{ fontWeight: 700, color: doc.estado_actividad === 'Activo' ? '#15803d' : '#0f172a' }}>
                        {formatDateAR(doc.ultima_atencion)}
                      </td>

                      <td>
                        <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                          {formatTiempoSinAtender(doc.dias_sin_atender)}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {doc.total_atenciones.toLocaleString('es-AR')}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                        {doc.pacientes_unicos.toLocaleString('es-AR')}
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {(doc.sedes || []).map(s => (
                            <span
                              key={s.sede}
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                background: s.sede === 'SANTA FE' ? '#ede9fe' : '#f1f5f9',
                                color: s.sede === 'SANTA FE' ? '#6d28d9' : '#334155',
                              }}
                            >
                              {s.sede.replace('SAN LUIS ', 'SL ')}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td style={{ maxWidth: '240px' }}>
                        {topPrac && (
                          <div style={{ fontSize: '0.72rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            🩺 <strong>{topPrac.nombre}</strong> ({topPrac.porcentaje}%)
                          </div>
                        )}
                        {topOS && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            💳 {topOS.nombre} ({topOS.porcentaje}%)
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="pm-btn pm-btn--secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.73rem', color: '#1E5FA6', borderColor: '#bfdbfe', background: '#eff6ff' }}
                          onClick={(e) => {
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
            padding: '0.9rem 1.25rem', borderTop: '1px solid #e2e8f0',
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
                  <Tooltip formatter={(val) => Number(val).toLocaleString('es-AR')} />
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
                </div>

                <div style={{ display: 'flex', gap: '1.1rem', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.92 }}>
                  <span>🩺 <strong>{selectedDoctor.especialidad_principal}</strong></span>
                  {selectedDoctor.matricula && <span>🪪 Matrícula: <strong>{selectedDoctor.matricula}</strong></span>}
                  {selectedDoctor.nif && <span>🔢 DNI/CUIT: <strong>{selectedDoctor.nif}</strong></span>}
                  {selectedDoctor.telefono && <span>📞 {selectedDoctor.telefono}</span>}
                  {selectedDoctor.email && <span>✉️ {selectedDoctor.email}</span>}
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
              {/* Resumen de Ciclo de Vida y Actividad */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
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

                <div className="pm-box" style={{ padding: '0.9rem 1rem', borderLeft: '4px solid #0284C7' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Total Atenciones
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    {selectedDoctor.total_atenciones.toLocaleString('es-AR')}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    {selectedDoctor.pacientes_unicos.toLocaleString('es-AR')} pacientes únicos
                  </div>
                </div>

                <div className="pm-box" style={{ padding: '0.9rem 1rem', borderLeft: '4px solid #7C3AED' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Trayectoria y Ritmo
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    {formatAntiguedad(selectedDoctor.primera_atencion, selectedDoctor.ultima_atencion)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    ~{selectedDoctor.promedio_por_mes_activo} atenciones/mes ({selectedDoctor.dias_atendidos} días atendidos)
                  </div>
                </div>

                <div className="pm-box" style={{ padding: '0.9rem 1rem', borderLeft: '4px solid #0D9488' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Actividad Reciente
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    {selectedDoctor.atenciones_90d.toLocaleString('es-AR')} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>en 90d</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    {selectedDoctor.atenciones_365d.toLocaleString('es-AR')} en últimos 12 meses
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
                      <span>🎓 Especialidades Registradas</span>
                    </h4>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      {(selectedDoctor.especialidades || []).map(e => (
                        <span
                          key={e.nombre}
                          style={{
                            background: '#EBF2FA',
                            color: '#1E5FA6',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '8px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                          }}
                        >
                          {e.nombre} {e.cantidad > 0 ? `(${e.cantidad.toLocaleString('es-AR')})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* TOP 15 ATENCIONES MÁS CONCURRIDAS & TOP OBRAS SOCIALES MÁS RECIBIDAS */}
              <div className="pm-detail-grid">
                {/* Columna Izquierda: Top 15 Atenciones */}
                <div className="pm-box">
                  <h4 className="pm-box__title">
                    <span>🏆 Top 15 Atenciones / Prácticas Más Concurridas</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                      Según Tipo de Visita en SALUS
                    </span>
                  </h4>
                  <div className="pm-rank-list">
                    {(selectedDoctor.top_atenciones || []).length === 0 ? (
                      <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Sin prácticas detalladas.</p>
                    ) : (
                      selectedDoctor.top_atenciones.map((item, idx) => (
                        <div key={item.nombre} className="pm-rank-item">
                          <div className="pm-rank-num">#{idx + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.nombre}>
                              {item.nombre}
                            </div>
                            <div style={{ fontSize: '0.69rem', color: '#64748b' }}>
                              Última realización: {formatDateAR(item.ultima_vez)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontWeight: 800, color: '#1E5FA6' }}>
                              {item.cantidad.toLocaleString('es-AR')}
                            </div>
                            <div style={{ fontSize: '0.69rem', color: '#64748b', fontWeight: 600 }}>
                              {item.porcentaje}%
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Columna Derecha: Top Obras Sociales */}
                <div className="pm-box">
                  <h4 className="pm-box__title">
                    <span>💳 Obras Sociales / Financiadores Más Recibidos</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                      Top Coberturas del Profesional
                    </span>
                  </h4>
                  <div className="pm-rank-list">
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
        </div>
      )}
    </div>
  );
}
