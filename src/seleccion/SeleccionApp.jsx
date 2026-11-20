import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  UserCheck, Plus, Search, Upload, Download, Edit3, Trash2, Copy,
  CheckCircle2, Clock, AlertTriangle, BarChart3, BookOpen, Table2,
  Calendar, Filter, RefreshCw, Sparkles, Building2, FileSpreadsheet,
  HelpCircle, Play, ChevronLeft, ChevronRight, X, Lightbulb,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '../supabaseClient';
import './seleccion.css';

const STORAGE_KEY = 'rrhh_seleccion_personal_v1';

// Catálogos sugeridos (permiten además valores personalizados)
const AREAS_SUGERIDAS = [
  'Enfermería',
  'Recepción',
  'Quirófano',
  'Cocina',
  'Mantenimiento',
  'Administración',
  'UTI / Terapia Intensiva',
  'Guardia Médica',
  'Diagnóstico por Imágenes',
  'Laboratorio',
  'Farmacia',
  'Facturación',
  'Atención al Paciente / Contact Center',
  'Limpieza y Hotelería',
  'Recursos Humanos',
  'Sistemas / TyS',
  'Calidad y Seguridad del Paciente',
];

const FUENTES_CONTRATACION = [
  'Portal de empleo',
  'Redes sociales',
  'Referidos',
  'Base interna / CV espontáneo',
  'LinkedIn',
  'Consultora externa',
  'Convenio educativo / Universidad',
  'Promoción / Búsqueda interna',
  'Otro',
];

const ESTADOS_BUSQUEDA = ['Abierta', 'Cubierta', 'Suspendida', 'Cancelada'];

const MOTIVOS_BUSQUEDA = [
  'Reemplazo',
  'Nuevo puesto',
  'Cobertura temporal',
  'Licencia prolongada',
  'Refuerzo operativo',
  'Rotación / Baja',
];

const SITUACIONES_3M = ['', 'Continúa', 'Baja'];

const MONTHS_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const CHART_COLORS = ['#1E5FA6', '#0284C7', '#0D9488', '#7C3AED', '#D97706', '#059669', '#E11D48', '#64748B'];

// Datos iniciales del Excel Seleccion_personal_por_areas.xlsx (Filas 8 a 13)
const INITIAL_EXCEL_ROWS = [
  {
    id: 'ex-1',
    area: 'Enfermería',
    puesto: 'Enfermero/a',
    fecha_solicitud: '2026-11-01',
    fecha_aceptacion: '2026-11-13',
    postulaciones: 4,
    perfiles_idoneos: 2,
    fuente_contratacion: 'Portal de empleo',
    estado: 'Cubierta',
    psicotecnicos: 2,
    fecha_ingreso: '2026-11-16',
    situacion_3_meses: '',
    motivo_busqueda: 'Reemplazo',
    observaciones: '',
    is_example: true,
  },
  {
    id: 'ex-2',
    area: 'Recepción',
    puesto: 'Recepcionista',
    fecha_solicitud: '2026-11-03',
    fecha_aceptacion: '2026-11-12',
    postulaciones: 4,
    perfiles_idoneos: 2,
    fuente_contratacion: 'Redes sociales',
    estado: 'Cubierta',
    psicotecnicos: 1,
    fecha_ingreso: '2026-11-16',
    situacion_3_meses: '',
    motivo_busqueda: 'Nuevo puesto',
    observaciones: '',
    is_example: true,
  },
  {
    id: 'ex-3',
    area: 'Quirófano',
    puesto: 'Instrumentador/a',
    fecha_solicitud: '2026-11-01',
    fecha_aceptacion: '2026-11-17',
    postulaciones: 4,
    perfiles_idoneos: 2,
    fuente_contratacion: 'Referidos',
    estado: 'Cubierta',
    psicotecnicos: 2,
    fecha_ingreso: '',
    situacion_3_meses: '',
    motivo_busqueda: 'Reemplazo',
    observaciones: '',
    is_example: true,
  },
  {
    id: 'ex-4',
    area: 'Cocina',
    puesto: 'Auxiliar de cocina',
    fecha_solicitud: '2026-11-06',
    fecha_aceptacion: '',
    postulaciones: 4,
    perfiles_idoneos: 1,
    fuente_contratacion: '',
    estado: 'Abierta',
    psicotecnicos: 1,
    fecha_ingreso: '',
    situacion_3_meses: '',
    motivo_busqueda: 'Cobertura temporal',
    observaciones: '',
    is_example: true,
  },
  {
    id: 'ex-5',
    area: 'Mantenimiento',
    puesto: 'Técnico/a de mantenimiento',
    fecha_solicitud: '2026-11-09',
    fecha_aceptacion: '',
    postulaciones: 4,
    perfiles_idoneos: 1,
    fuente_contratacion: '',
    estado: 'Abierta',
    psicotecnicos: 0,
    fecha_ingreso: '',
    situacion_3_meses: '',
    motivo_busqueda: 'Reemplazo',
    observaciones: '',
    is_example: true,
  },
  {
    id: 'ex-6',
    area: 'Administración',
    puesto: 'Administrativo/a de facturación',
    fecha_solicitud: '2026-11-02',
    fecha_aceptacion: '2026-11-15',
    postulaciones: 4,
    perfiles_idoneos: 3,
    fuente_contratacion: 'Portal de empleo',
    estado: 'Cubierta',
    psicotecnicos: 1,
    fecha_ingreso: '2026-11-17',
    situacion_3_meses: '',
    motivo_busqueda: 'Nuevo puesto',
    observaciones: '',
    is_example: true,
  },
];

// ============================================================
// FUNCIONES DE CÁLCULO AUTOMÁTICO (FÓRMULAS EXACTAS DEL EXCEL)
// ============================================================

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateAR(dateStr) {
  const d = parseLocalDate(dateStr);
  if (!d) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toISODateString(d) {
  if (!d || isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Columna I: Días de cobertura
 * Fórmula Excel: =IF(OR(B8="",C8="",D8=""),"",D8-C8)
 */
function calcDiasCobertura(puesto, fechaSolicitud, fechaAceptacion) {
  if (!puesto || !fechaSolicitud || !fechaAceptacion) return null;
  const dSol = parseLocalDate(fechaSolicitud);
  const dAcep = parseLocalDate(fechaAceptacion);
  if (!dSol || !dAcep) return null;
  const diffMs = dAcep.getTime() - dSol.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Columna J: % de perfiles idóneos
 * Fórmula Excel: =IF(OR(B8="",E8="",F8="",E8=0),"",F8/E8)
 */
function calcPorcentajeIdoneos(puesto, postulaciones, perfilesIdoneos) {
  const post = Number(postulaciones);
  const idon = Number(perfilesIdoneos);
  if (!puesto || isNaN(post) || isNaN(idon) || post <= 0) return null;
  return (idon / post) * 100;
}

/**
 * Columna M: Revisión a los 3 meses
 * Fórmula Excel: =IF(OR(B8="",L8=""),"",EDATE(L8,3))
 */
function calcRevision3Meses(puesto, fechaIngreso) {
  if (!puesto || !fechaIngreso) return '';
  const dIng = parseLocalDate(fechaIngreso);
  if (!dIng) return '';
  const targetMonth = dIng.getMonth() + 3;
  const result = new Date(dIng.getFullYear(), targetMonth, dIng.getDate());
  // Ajuste de fin de mes estilo EDATE de Excel
  if (result.getMonth() !== (targetMonth % 12)) {
    result.setDate(0);
  }
  return toISODateString(result);
}

/**
 * Columna N: Aviso de seguimiento
 * Fórmula Excel: =IF(OR(B8="",L8=""),"",IF(O8<>"","Registrado",IF(TODAY()<M8,"Pendiente de plazo","Revisar")))
 */
function calcAvisoSeguimiento(puesto, fechaIngreso, situacion3Meses) {
  if (!puesto || !fechaIngreso) return { label: '', code: 'empty', daysRemaining: null };
  if (situacion3Meses && String(situacion3Meses).trim() !== '') {
    return { label: 'Registrado', code: 'registrado', daysRemaining: 0 };
  }
  const revIso = calcRevision3Meses(puesto, fechaIngreso);
  const dRev = parseLocalDate(revIso);
  if (!dRev) return { label: '', code: 'empty', daysRemaining: null };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dRev.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((dRev.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (today < dRev) {
    return { label: 'Pendiente de plazo', code: 'pendiente', daysRemaining: diffDays };
  }
  return { label: 'Revisar', code: 'revisar', daysRemaining: diffDays };
}

function enrichRow(row) {
  const dias_cobertura = calcDiasCobertura(row.puesto, row.fecha_solicitud, row.fecha_aceptacion);
  const porcentaje_idoneos = calcPorcentajeIdoneos(row.puesto, row.postulaciones, row.perfiles_idoneos);
  const fecha_revision_3m = calcRevision3Meses(row.puesto, row.fecha_ingreso);
  const aviso = calcAvisoSeguimiento(row.puesto, row.fecha_ingreso, row.situacion_3_meses);

  return {
    ...row,
    dias_cobertura,
    porcentaje_idoneos,
    fecha_revision_3m,
    aviso_seguimiento: aviso.label,
    aviso_code: aviso.code,
    aviso_dias: aviso.daysRemaining,
  };
}

// Parseo de fechas provenientes de Excel (serial o DD/MM/YYYY o YYYY-MM-DD)
function normalizeExcelDate(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return toISODateString(val);
  }
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const str = String(val).trim();
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  return '';
}

const EMPTY_FORM = {
  area: 'Enfermería',
  puesto: '',
  fecha_solicitud: toISODateString(new Date()),
  fecha_aceptacion: '',
  postulaciones: 0,
  perfiles_idoneos: 0,
  fuente_contratacion: '',
  estado: 'Abierta',
  psicotecnicos: 0,
  fecha_ingreso: '',
  situacion_3_meses: '',
  motivo_busqueda: 'Reemplazo',
  observaciones: '',
};

// Pasos del Tutorial Interactivo Guiado (Spotlight Tour)
const TOUR_STEPS = [
  {
    id: 'welcome',
    tab: 'vacantes',
    target: 'header',
    title: '👋 1. Regla de Oro: Una Fila por Vacante',
    desc: 'Este módulo digitaliza la planilla de Selección de Personal por Áreas. Cada fila representa exactamente UNA vacante a cubrir. Al iniciar vienen 6 ejemplos cargados (etiquetados como EJEMPLO) que podés quitar en cualquier momento con el botón "Limpiar ejemplos".',
    tip: '💡 Si te piden 2 vacantes para un mismo puesto (ej. 2 Enfermeros/as), creá 2 filas separadas o usá el botón Duplicar (📑) en la columna Acciones y repartí las postulaciones sin duplicarlas.',
  },
  {
    id: 'kpis',
    tab: 'vacantes',
    target: 'kpis',
    title: '📊 2. Indicadores Automáticos en Tiempo Real',
    desc: 'Las 6 tarjetas superiores calculan automáticamente el total de Búsquedas activas, las Postulaciones únicas recibidas, el % de Perfiles Idóneos sobre postulados, la tasa de Efectividad de Cobertura, el Promedio de días corridos de cobertura y las Alertas de seguimiento a los 3 meses.',
    tip: '💡 Todos estos indicadores equivalen a la Fila 5 azul del Excel y se actualizan al instante ante cada cambio.',
  },
  {
    id: 'legend',
    tab: 'vacantes',
    target: 'tabs',
    title: '🎨 3. Campos Amarillos vs. Cálculos Azules',
    desc: 'En el encabezado de la tabla verás columnas con borde AMARILLO (datos que carga RRHH manualmente) y columnas con fondo AZUL y el ícono ⚡ (cálculos 100% automáticos que nunca necesitás escribir a mano).',
    tip: '💡 Navegá entre las 3 pestañas para alternar entre el Tablero Operativo, las Búsquedas por Mes & Gráficos, y el Simulador / Guía de Criterios.',
  },
  {
    id: 'filters',
    tab: 'vacantes',
    target: 'filters',
    title: '🔍 4. Filtros Rápidos y Alertas de Vencimiento',
    desc: 'Filtrá rápidamente por Área/Servicio, por Estado (Abierta, Cubierta, Suspendida, Cancelada) o por el estado del Seguimiento a los 3 meses.',
    tip: '💡 Elegí "⚠️ Revisar (Plazo vencido)" en el cuarto filtro para ver únicamente los ingresos que ya cumplieron 3 meses y requieren tu evaluación.',
  },
  {
    id: 'table',
    tab: 'vacantes',
    target: 'table',
    title: '⚡ 5. Ciclo Completo de una Vacante y Seguimiento a 3 Meses',
    desc: '1) Al abrir la búsqueda cargás Área, Puesto, Fecha de Solicitud y Estado "Abierta". 2) A medida que evaluás CVs, actualizás Postulaciones, Perfiles idóneos y Psicotécnicos. 3) Al cubrirla, cargás la Fecha de Aceptación y la Fuente del candidato elegido (calcula solo los Días de Cobertura). 4) Al ingresar el colaborador, cargás la Fecha de Ingreso (calcula sola la Revisión a +3 meses).',
    tip: '💡 Cuando se cumplen los 3 meses del ingreso, aparece "⚠️ Revisar". Desde el desplegable de la columna "Situación 3 meses" elegís "Continúa" o "Baja" y el aviso pasa automáticamente a "✅ Registrado".',
  },
  {
    id: 'monthly',
    tab: 'analitica',
    target: 'analytics',
    title: '📅 6. Búsquedas por Mes y Analítica (Según Solicitud Aprobada)',
    desc: 'Esta pestaña replica la tabla lateral del Excel: cuenta cada vacante en el mes de su "Solicitud aprobada" según el Año seleccionado (incluso si luego fue suspendida o cancelada), acompañado por gráficos de evolución, áreas demandantes, efectividad de fuentes y motivos.',
    tip: '💡 Podés cambiar el Año en el selector amarillo superior derecho de la tabla mensual para auditar distintos períodos.',
  },
  {
    id: 'simulator',
    tab: 'guia',
    target: 'simulator',
    title: '🧪 7. Simulador Interactivo y Criterios de Uso',
    desc: 'En la pestaña "Criterios y Guía de Uso" tenés un Simulador Interactivo para probar cómo reaccionan las fórmulas automáticas cambiando fechas y cantidades sin afectar tus datos reales, además de todas las reglas operativas del área.',
    tip: '💡 También podés importar tu archivo Excel (.xlsx) o exportar toda la tabla actualizada en 1 clic desde los botones superiores.',
  },
];

export default function SeleccionApp() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingSupabase, setUsingSupabase] = useState(false);
  const [activeTab, setActiveTab] = useState('vacantes'); // 'vacantes' | 'analitica' | 'guia'

  // Estado del Tutorial Interactivo (Spotlight Tour)
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(() =>
    localStorage.getItem('rrhh_seleccion_tour_dismissed') !== 'true'
  );

  // Estado del Simulador Interactivo (dentro de Guía de Uso)
  const [simData, setSimData] = useState({
    puesto: 'Enfermero/a de UTI',
    fecha_solicitud: '2026-11-01',
    fecha_aceptacion: '2026-11-14',
    postulaciones: 10,
    perfiles_idoneos: 4,
    fecha_ingreso: '2026-08-10', // Fecha > 3 meses atrás para ver el cambio entre Revisar y Registrado
    situacion_3_meses: '',
  });

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterAviso, setFilterAviso] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026); // Celda U5 del Excel

  // Modal de creación / edición
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [customAreaMode, setCustomAreaMode] = useState(false);

  // Confirmación de eliminación
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileInputRef = useRef(null);

  // ── Carga inicial (Supabase con fallback a LocalStorage + Datos del Excel) ──
  useEffect(() => {
    loadData();
  }, []);

  // Normaliza fechas de ingreso donde por error de tipeo se cargó 1 año más (ej. solicitud 11/2026 e ingreso 01/12/2027 en vez de 01/12/2026)
  function sanitizeLoadedRows(list) {
    if (!Array.isArray(list)) return [];
    let changed = false;
    const sanitized = list.map(r => {
      if (r.fecha_solicitud && r.fecha_ingreso) {
        const dSol = parseLocalDate(r.fecha_solicitud);
        const dIng = parseLocalDate(r.fecha_ingreso);
        if (dSol && dIng) {
          const diffDays = Math.round((dIng.getTime() - dSol.getTime()) / (1000 * 60 * 60 * 24));
          // Si la fecha de ingreso quedó > 300 días después de la solicitud (ej. 01/12/2027 cuando la solicitud es 11/2026), corregir el año al de la solicitud
          if (diffDays > 300 && dIng.getFullYear() === dSol.getFullYear() + 1 && dIng.getMonth() >= dSol.getMonth()) {
            const fixedDate = new Date(dSol.getFullYear(), dIng.getMonth(), dIng.getDate());
            changed = true;
            return { ...r, fecha_ingreso: toISODateString(fixedDate) };
          }
        }
      }
      return r;
    });
    return { sanitized, changed };
  }

  async function loadData() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seleccion_personal')
        .select('*')
        .order('fecha_solicitud', { ascending: false });

      if (!error && Array.isArray(data)) {
        setUsingSupabase(true);
        if (data.length === 0) {
          // Sembrar ejemplos iniciales si la tabla recién se creó y no se limpió antes
          const clearedBefore = localStorage.getItem('rrhh_seleccion_examples_cleared') === 'true';
          if (!clearedBefore) {
            const payload = INITIAL_EXCEL_ROWS.map(({ id, ...rest }) => ({
              ...rest,
              fecha_solicitud: rest.fecha_solicitud || null,
              fecha_aceptacion: rest.fecha_aceptacion || null,
              fecha_ingreso: rest.fecha_ingreso || null,
            }));
            const { data: inserted } = await supabase.from('seleccion_personal').insert(payload).select();
            setRows(inserted && inserted.length ? inserted : INITIAL_EXCEL_ROWS);
          } else {
            setRows([]);
          }
        } else {
          const { sanitized, changed } = sanitizeLoadedRows(data);
          setRows(sanitized);
          if (changed) {
            sanitized.forEach(r => {
              supabase.from('seleccion_personal').update({ fecha_ingreso: r.fecha_ingreso }).eq('id', r.id);
            });
          }
        }
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Usando almacenamiento local para Selección de Personal:', err?.message);
    }

    // Fallback LocalStorage
    setUsingSupabase(false);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const { sanitized, changed } = sanitizeLoadedRows(parsed);
        setRows(sanitized);
        if (changed) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        }
      } catch {
        setRows(INITIAL_EXCEL_ROWS);
      }
    } else {
      setRows(INITIAL_EXCEL_ROWS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_EXCEL_ROWS));
    }
    setLoading(false);
  }

  function saveLocal(nextRows) {
    setRows(nextRows);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRows));
  }

  // Enriquecer todas las filas con las fórmulas del Excel
  const enrichedRows = useMemo(() => rows.map(enrichRow), [rows]);

  // Áreas disponibles (catálogo + personalizadas existentes)
  const allAreas = useMemo(() => {
    const set = new Set(AREAS_SUGERIDAS);
    rows.forEach(r => {
      if (r.area) set.add(r.area);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [rows]);

  // Años disponibles para el selector de "Búsquedas por mes"
  const availableYears = useMemo(() => {
    const set = new Set([2025, 2026, 2027]);
    rows.forEach(r => {
      const d = parseLocalDate(r.fecha_solicitud);
      if (d) set.add(d.getFullYear());
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  // Filtrado de la tabla
  const filteredRows = useMemo(() => {
    return enrichedRows.filter(r => {
      if (filterArea && r.area !== filterArea) return false;
      if (filterEstado && r.estado !== filterEstado) return false;
      if (filterAviso && r.aviso_code !== filterAviso) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const match =
          (r.area || '').toLowerCase().includes(q) ||
          (r.puesto || '').toLowerCase().includes(q) ||
          (r.fuente_contratacion || '').toLowerCase().includes(q) ||
          (r.motivo_busqueda || '').toLowerCase().includes(q) ||
          (r.observaciones || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [enrichedRows, filterArea, filterEstado, filterAviso, searchTerm]);

  // ── KPIs Superiores (Fila 5 del Excel + Indicadores Clínicos) ──
  const kpis = useMemo(() => {
    const validRows = enrichedRows.filter(r => r.puesto && r.puesto.trim() !== '');
    const totalBusquedas = validRows.length; // COUNTA(B8:B57)
    const totalPostulaciones = validRows.reduce((acc, r) => acc + (Number(r.postulaciones) || 0), 0); // SUM(E8:E57)
    const totalIdoneos = validRows.reduce((acc, r) => acc + (Number(r.perfiles_idoneos) || 0), 0); // SUM(F8:F57)
    const totalCubiertas = validRows.filter(r => r.estado === 'Cubierta').length; // COUNTIFS(H8:H57,"Cubierta")
    const totalAbiertas = validRows.filter(r => r.estado === 'Abierta').length;
    const totalPsicotecnicos = validRows.reduce((acc, r) => acc + (Number(r.psicotecnicos) || 0), 0);

    const rowsConDias = validRows.filter(r => r.dias_cobertura !== null && r.dias_cobertura >= 0);
    const promedioDias = rowsConDias.length > 0
      ? (rowsConDias.reduce((acc, r) => acc + r.dias_cobertura, 0) / rowsConDias.length).toFixed(1)
      : '—';

    const tasaIdoneidad = totalPostulaciones > 0
      ? ((totalIdoneos / totalPostulaciones) * 100).toFixed(1)
      : '0.0';

    const alertasRevisar = validRows.filter(r => r.aviso_code === 'revisar').length;
    const pendientes3m = validRows.filter(r => r.aviso_code === 'pendiente').length;

    return {
      totalBusquedas,
      totalPostulaciones,
      totalIdoneos,
      totalCubiertas,
      totalAbiertas,
      totalPsicotecnicos,
      promedioDias,
      tasaIdoneidad,
      alertasRevisar,
      pendientes3m,
    };
  }, [enrichedRows]);

  // ── Búsquedas por Mes (Columnas T y U del Excel: COUNTIFS por fecha_solicitud y año) ──
  const monthlyStats = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, idx) => {
      const monthNum = idx + 1;
      const label = `${String(monthNum).padStart(2, '0')}/${selectedYear}`;
      const monthRows = enrichedRows.filter(r => {
        if (!r.puesto) return false;
        const d = parseLocalDate(r.fecha_solicitud);
        return d && d.getFullYear() === Number(selectedYear) && (d.getMonth() + 1) === monthNum;
      });
      const cubiertas = monthRows.filter(r => r.estado === 'Cubierta').length;
      const abiertas = monthRows.filter(r => r.estado === 'Abierta').length;
      const conDias = monthRows.filter(r => r.dias_cobertura !== null);
      const promDias = conDias.length > 0
        ? Math.round(conDias.reduce((a, b) => a + b.dias_cobertura, 0) / conDias.length)
        : null;

      return {
        monthIndex: idx,
        monthName: MONTHS_NAMES[idx],
        label,
        total: monthRows.length,
        cubiertas,
        abiertas,
        promDias,
      };
    });

    const totalAnio = months.reduce((acc, m) => acc + m.total, 0);
    const totalCubiertasAnio = months.reduce((acc, m) => acc + m.cubiertas, 0);
    return { months, totalAnio, totalCubiertasAnio };
  }, [enrichedRows, selectedYear]);

  // ── Datos para Gráficos Analíticos ──
  const analyticsByArea = useMemo(() => {
    const map = {};
    enrichedRows.forEach(r => {
      if (!r.area || !r.puesto) return;
      if (!map[r.area]) {
        map[r.area] = { area: r.area, total: 0, cubiertas: 0, abiertas: 0, postulaciones: 0, idoneos: 0 };
      }
      map[r.area].total += 1;
      if (r.estado === 'Cubierta') map[r.area].cubiertas += 1;
      if (r.estado === 'Abierta') map[r.area].abiertas += 1;
      map[r.area].postulaciones += Number(r.postulaciones) || 0;
      map[r.area].idoneos += Number(r.perfiles_idoneos) || 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [enrichedRows]);

  const analyticsByFuente = useMemo(() => {
    const map = {};
    enrichedRows.forEach(r => {
      if (!r.fuente_contratacion) return;
      map[r.fuente_contratacion] = (map[r.fuente_contratacion] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [enrichedRows]);

  const analyticsByMotivo = useMemo(() => {
    const map = {};
    enrichedRows.forEach(r => {
      if (!r.motivo_busqueda) return;
      map[r.motivo_busqueda] = (map[r.motivo_busqueda] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [enrichedRows]);

  // ── Acciones CRUD ──
  function handleOpenNew() {
    setEditingId(null);
    setFormData({
      ...EMPTY_FORM,
      fecha_solicitud: toISODateString(new Date()),
    });
    setCustomAreaMode(false);
    setModalOpen(true);
  }

  function handleOpenEdit(row) {
    setEditingId(row.id);
    setFormData({
      area: row.area || '',
      puesto: row.puesto || '',
      fecha_solicitud: row.fecha_solicitud || '',
      fecha_aceptacion: row.fecha_aceptacion || '',
      postulaciones: row.postulaciones ?? 0,
      perfiles_idoneos: row.perfiles_idoneos ?? 0,
      fuente_contratacion: row.fuente_contratacion || '',
      estado: row.estado || 'Abierta',
      psicotecnicos: row.psicotecnicos ?? 0,
      fecha_ingreso: row.fecha_ingreso || '',
      situacion_3_meses: row.situacion_3_meses || '',
      motivo_busqueda: row.motivo_busqueda || '',
      observaciones: row.observaciones || '',
    });
    setCustomAreaMode(!AREAS_SUGERIDAS.includes(row.area));
    setModalOpen(true);
  }

  // Regla fila 62: "Una fila por vacante. Para dos vacantes iguales, usar dos filas..."
  async function handleDuplicateRow(row) {
    const copyPayload = {
      area: row.area,
      puesto: row.puesto,
      fecha_solicitud: row.fecha_solicitud || null,
      fecha_aceptacion: null,
      postulaciones: 0,
      perfiles_idoneos: 0,
      fuente_contratacion: '',
      estado: 'Abierta',
      psicotecnicos: 0,
      fecha_ingreso: null,
      situacion_3_meses: '',
      motivo_busqueda: row.motivo_busqueda || '',
      observaciones: `Vacante adicional (${row.puesto})`,
      is_example: false,
    };

    if (usingSupabase) {
      const { data, error } = await supabase.from('seleccion_personal').insert([copyPayload]).select().single();
      if (!error && data) {
        setRows(prev => [data, ...prev]);
        return;
      }
    }
    const localNew = { ...copyPayload, id: `sel-${Date.now()}` };
    saveLocal([localNew, ...rows]);
  }

  async function handleSaveForm(e) {
    e.preventDefault();
    if (!formData.area.trim() || !formData.puesto.trim()) {
      alert('Completá al menos el Área / Servicio y el Puesto buscado.');
      return;
    }

    let fechaIngresoClean = formData.fecha_ingreso || null;
    if (formData.fecha_solicitud && fechaIngresoClean) {
      const dSol = parseLocalDate(formData.fecha_solicitud);
      const dIng = parseLocalDate(fechaIngresoClean);
      if (dSol && dIng) {
        const diffDays = Math.round((dIng.getTime() - dSol.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 300 && dIng.getFullYear() === dSol.getFullYear() + 1 && dIng.getMonth() >= dSol.getMonth()) {
          fechaIngresoClean = toISODateString(new Date(dSol.getFullYear(), dIng.getMonth(), dIng.getDate()));
        }
      }
    }

    const normalized = {
      area: formData.area.trim(),
      puesto: formData.puesto.trim(),
      fecha_solicitud: formData.fecha_solicitud || null,
      fecha_aceptacion: formData.fecha_aceptacion || null,
      postulaciones: Math.max(0, Number(formData.postulaciones) || 0),
      perfiles_idoneos: Math.max(0, Number(formData.perfiles_idoneos) || 0),
      fuente_contratacion: formData.estado === 'Abierta' ? (formData.fuente_contratacion || '') : (formData.fuente_contratacion || ''),
      estado: formData.estado,
      psicotecnicos: Math.max(0, Number(formData.psicotecnicos) || 0),
      fecha_ingreso: fechaIngresoClean,
      situacion_3_meses: formData.situacion_3_meses || '',
      motivo_busqueda: formData.motivo_busqueda || '',
      observaciones: formData.observaciones || '',
      is_example: false,
    };

    if (editingId) {
      if (usingSupabase) {
        const { data, error } = await supabase
          .from('seleccion_personal')
          .update(normalized)
          .eq('id', editingId)
          .select()
          .single();
        if (!error && data) {
          setRows(prev => prev.map(r => (r.id === editingId ? data : r)));
          setModalOpen(false);
          return;
        }
      }
      const next = rows.map(r => (r.id === editingId ? { ...r, ...normalized } : r));
      saveLocal(next);
      setModalOpen(false);
    } else {
      if (usingSupabase) {
        const { data, error } = await supabase
          .from('seleccion_personal')
          .insert([normalized])
          .select()
          .single();
        if (!error && data) {
          setRows(prev => [data, ...prev]);
          setModalOpen(false);
          return;
        }
      }
      const localNew = { ...normalized, id: `sel-${Date.now()}` };
      saveLocal([localNew, ...rows]);
      setModalOpen(false);
    }
  }

  async function handleQuickSituacion3M(row, value) {
    if (usingSupabase) {
      const { data, error } = await supabase
        .from('seleccion_personal')
        .update({ situacion_3_meses: value })
        .eq('id', row.id)
        .select()
        .single();
      if (!error && data) {
        setRows(prev => prev.map(r => (r.id === row.id ? data : r)));
        return;
      }
    }
    const next = rows.map(r => (r.id === row.id ? { ...r, situacion_3_meses: value } : r));
    saveLocal(next);
  }

  async function handleQuickEstado(row, nuevoEstado) {
    if (usingSupabase) {
      const { data, error } = await supabase
        .from('seleccion_personal')
        .update({ estado: nuevoEstado })
        .eq('id', row.id)
        .select()
        .single();
      if (!error && data) {
        setRows(prev => prev.map(r => (r.id === row.id ? data : r)));
        return;
      }
    }
    const next = rows.map(r => (r.id === row.id ? { ...r, estado: nuevoEstado } : r));
    saveLocal(next);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    if (usingSupabase) {
      await supabase.from('seleccion_personal').delete().eq('id', targetId);
    }
    const next = rows.filter(r => r.id !== targetId);
    saveLocal(next);
  }

  async function handleClearExamples() {
    localStorage.setItem('rrhh_seleccion_examples_cleared', 'true');
    if (usingSupabase) {
      await supabase.from('seleccion_personal').delete().eq('is_example', true);
    }
    const next = rows.filter(r => !r.is_example);
    saveLocal(next);
  }

  async function handleRestoreExamples() {
    localStorage.removeItem('rrhh_seleccion_examples_cleared');
    if (usingSupabase) {
      const payload = INITIAL_EXCEL_ROWS.map(({ id, ...rest }) => ({
        ...rest,
        fecha_solicitud: rest.fecha_solicitud || null,
        fecha_aceptacion: rest.fecha_aceptacion || null,
        fecha_ingreso: rest.fecha_ingreso || null,
      }));
      const { data } = await supabase.from('seleccion_personal').insert(payload).select();
      if (data) {
        setRows(prev => [...prev, ...data]);
        return;
      }
    }
    saveLocal([...INITIAL_EXCEL_ROWS, ...rows.filter(r => !r.is_example)]);
  }

  // ── Importar desde archivo Excel (.xlsx) ──
  function handleImportExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = wb.SheetNames.includes('Seleccion') ? 'Seleccion' : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Buscar fila de encabezado ("Área / servicio" | "Puesto buscado")
        let headerRowIdx = rawRows.findIndex(r =>
          Array.isArray(r) &&
          r.some(c => String(c).toLowerCase().includes('área') || String(c).toLowerCase().includes('area')) &&
          r.some(c => String(c).toLowerCase().includes('puesto'))
        );
        if (headerRowIdx === -1) headerRowIdx = 6; // Fila 7 (índice 6) por defecto

        const imported = [];
        for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
          const r = rawRows[i];
          if (!r || !Array.isArray(r)) continue;
          const area = String(r[0] || '').trim();
          const puesto = String(r[1] || '').trim();

          // Cortar si llegamos a las notas de uso al pie del Excel
          if (area.startsWith('Uso:') || area.startsWith('Completar ') || area.startsWith('Una fila ')) break;
          if (!area && !puesto) continue;

          imported.push({
            id: `imp-${Date.now()}-${i}`,
            area: area || 'Sin especificar',
            puesto: puesto || 'Sin especificar',
            fecha_solicitud: normalizeExcelDate(r[2]) || null,
            fecha_aceptacion: normalizeExcelDate(r[3]) || null,
            postulaciones: Number(r[4]) || 0,
            perfiles_idoneos: Number(r[5]) || 0,
            fuente_contratacion: String(r[6] || '').trim(),
            estado: ESTADOS_BUSQUEDA.includes(String(r[7] || '').trim()) ? String(r[7]).trim() : 'Abierta',
            psicotecnicos: Number(r[10]) || 0,
            fecha_ingreso: normalizeExcelDate(r[11]) || null,
            situacion_3_meses: String(r[14] || '').trim(),
            motivo_busqueda: String(r[15] || '').trim(),
            observaciones: String(r[16] || '').trim(),
            is_example: false,
          });
        }

        if (imported.length === 0) {
          alert('No se encontraron filas de vacantes válidas en el archivo seleccionado.');
          return;
        }

        if (usingSupabase) {
          const dbPayload = imported.map(({ id, ...rest }) => rest);
          const { data: inserted, error } = await supabase.from('seleccion_personal').insert(dbPayload).select();
          if (!error && inserted) {
            setRows(prev => [...inserted, ...prev]);
            alert(`Se importaron ${inserted.length} vacantes correctamente.`);
            return;
          }
        }
        saveLocal([...imported, ...rows]);
        alert(`Se importaron ${imported.length} vacantes correctamente.`);
      } catch (err) {
        console.error('Error importando Excel:', err);
        alert('Error al leer el archivo Excel: ' + err.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Exportar a Excel (.xlsx) respetando el formato original ──
  function handleExportExcel() {
    const wb = XLSX.utils.book_new();

    const exportData = enrichedRows.map(r => ({
      'Área / servicio': r.area,
      'Puesto buscado': r.puesto,
      'Solicitud aprobada': formatDateAR(r.fecha_solicitud) === '—' ? '' : formatDateAR(r.fecha_solicitud),
      'Propuesta aceptada': formatDateAR(r.fecha_aceptacion) === '—' ? '' : formatDateAR(r.fecha_aceptacion),
      'Postulaciones recibidas': r.postulaciones ?? 0,
      'Perfiles idóneos': r.perfiles_idoneos ?? 0,
      'Fuente de contratación': r.fuente_contratacion || '',
      'Estado de la búsqueda': r.estado || 'Abierta',
      'Días de cobertura': r.dias_cobertura !== null ? r.dias_cobertura : '',
      '% de perfiles idóneos': r.porcentaje_idoneos !== null ? `${r.porcentaje_idoneos.toFixed(1)}%` : '',
      'Psicotécnicos realizados': r.psicotecnicos ?? 0,
      'Fecha de ingreso': formatDateAR(r.fecha_ingreso) === '—' ? '' : formatDateAR(r.fecha_ingreso),
      'Revisión a los 3 meses': formatDateAR(r.fecha_revision_3m) === '—' ? '' : formatDateAR(r.fecha_revision_3m),
      'Aviso de seguimiento': r.aviso_seguimiento || '',
      'Situación a los 3 meses': r.situacion_3_meses || '',
      'Motivo de la búsqueda': r.motivo_busqueda || '',
      'Observaciones': r.observaciones || '',
    }));

    const wsSeleccion = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, wsSeleccion, 'Seleccion');

    // Segunda hoja con el resumen mensual del año seleccionado
    const monthlySheetData = [
      ...monthlyStats.months.map(m => ({
        Mes: m.label,
        'Nombre del Mes': m.monthName,
        'Total búsquedas': m.total,
        Cubiertas: m.cubiertas,
        Abiertas: m.abiertas,
        'Promedio días cobertura': m.promDias ?? '—',
      })),
      {
        Mes: 'TOTAL DEL AÑO',
        'Nombre del Mes': String(selectedYear),
        'Total búsquedas': monthlyStats.totalAnio,
        Cubiertas: monthlyStats.totalCubiertasAnio,
        Abiertas: monthlyStats.months.reduce((a, m) => a + m.abiertas, 0),
        'Promedio días cobertura': kpis.promedioDias,
      },
    ];
    const wsMensual = XLSX.utils.json_to_sheet(monthlySheetData);
    XLSX.utils.book_append_sheet(wb, wsMensual, `Busquedas_${selectedYear}`);

    XLSX.writeFile(wb, `Seleccion_personal_por_areas_${selectedYear}.xlsx`);
  }

  // Vista previa en vivo dentro del modal de los cálculos automáticos
  const modalPreview = useMemo(() => enrichRow(formData), [formData]);
  const simPreview = useMemo(() => enrichRow(simData), [simData]);
  const hasExamples = useMemo(() => rows.some(r => r.is_example), [rows]);

  // ── Funciones del Tutorial Interactivo (Spotlight Tour) ──
  const currentTourStep = tourActive ? TOUR_STEPS[tourStep] : null;

  function startTour(initialStep = 0) {
    const stepObj = TOUR_STEPS[initialStep] || TOUR_STEPS[0];
    setActiveTab(stepObj.tab);
    setTourStep(initialStep);
    setTourActive(true);
  }

  function goToTourStep(nextIdx) {
    if (nextIdx < 0 || nextIdx >= TOUR_STEPS.length) return;
    const stepObj = TOUR_STEPS[nextIdx];
    if (stepObj.tab && stepObj.tab !== activeTab) {
      setActiveTab(stepObj.tab);
    }
    setTourStep(nextIdx);
    setTimeout(() => {
      const el = document.getElementById(`sel-tour-${stepObj.target}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  }

  function closeTour() {
    setTourActive(false);
    setShowOnboardingBanner(false);
    localStorage.setItem('rrhh_seleccion_tour_dismissed', 'true');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '65vh', gap: '0.75rem', color: '#64748b' }}>
        <RefreshCw size={28} className="animate-spin" style={{ color: '#1E5FA6' }} />
        <p style={{ fontSize: '0.88rem', fontWeight: 500 }}>Cargando módulo de Selección de Personal...</p>
      </div>
    );
  }

  return (
    <div className="sel-module">
      {/* ─── BANNER DE BIENVENIDA AL TUTORIAL INTERACTIVO ─── */}
      {showOnboardingBanner && !tourActive && (
        <div className="sel-onboarding-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 38, height: 38, borderRadius: '10px', background: '#7c3aed', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Lightbulb size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e1b4b' }}>
                ¿Primera vez usando Selección de Personal?
              </div>
              <div style={{ fontSize: '0.78rem', color: '#4338ca' }}>
                Hacé el recorrido interactivo de 1 minuto para conocer cómo funcionan las columnas automáticas, el control de los 3 meses y las búsquedas por mes.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="sel-btn sel-btn--tour"
              onClick={() => startTour(0)}
            >
              <Play size={14} />
              Iniciar Recorrido Guiado (7 pasos)
            </button>
            <button
              type="button"
              className="sel-btn sel-btn--secondary"
              onClick={() => {
                setShowOnboardingBanner(false);
                localStorage.setItem('rrhh_seleccion_tour_dismissed', 'true');
              }}
            >
              Ocultar
            </button>
          </div>
        </div>
      )}

      {/* ─── ENCABEZADO ─── */}
      <div
        id="sel-tour-header"
        className={`sel-header ${currentTourStep?.target === 'header' ? 'sel-tour-highlight' : ''}`}
      >
        <div className="sel-header__title-group">
          <h2>
            <UserCheck size={24} style={{ color: '#1E5FA6' }} />
            Selección de Personal por Áreas
          </h2>
          <p className="sel-header__subtitle">
            Seguimiento integral de vacantes, tiempos de cobertura, embudo de idoneidad y evaluación de permanencia a los 3 meses.
          </p>
        </div>

        <div className="sel-header__actions">
          <button
            type="button"
            className="sel-btn sel-btn--tour"
            onClick={() => startTour(0)}
            title="Iniciar tutorial interactivo paso a paso"
          >
            <HelpCircle size={15} />
            Tutorial Interactivo
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportExcel}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="sel-btn sel-btn--excel"
            onClick={() => fileInputRef.current?.click()}
            title="Importar planilla Excel (.xlsx)"
          >
            <Upload size={15} />
            Importar Excel
          </button>

          <button
            type="button"
            className="sel-btn sel-btn--secondary"
            onClick={handleExportExcel}
            title="Descargar planilla Excel (.xlsx) con cálculos actualizados"
          >
            <Download size={15} />
            Exportar Excel
          </button>

          {hasExamples ? (
            <button
              type="button"
              className="sel-btn sel-btn--danger-soft"
              onClick={handleClearExamples}
              title="Quitar las 6 filas de ejemplo iniciales para comenzar de cero"
            >
              <Sparkles size={15} />
              Limpiar ejemplos
            </button>
          ) : rows.length === 0 ? (
            <button
              type="button"
              className="sel-btn sel-btn--secondary"
              onClick={handleRestoreExamples}
            >
              <RefreshCw size={15} />
              Cargar ejemplos del Excel
            </button>
          ) : null}

          <button
            type="button"
            className="sel-btn sel-btn--primary"
            onClick={handleOpenNew}
          >
            <Plus size={16} />
            Nueva Vacante
          </button>
        </div>
      </div>

      {/* ─── TARJETAS KPI (Fila 5 del Excel + Indicadores Clave) ─── */}
      <div
        id="sel-tour-kpis"
        className={`sel-kpi-grid ${currentTourStep?.target === 'kpis' ? 'sel-tour-highlight' : ''}`}
      >
        <div className="sel-kpi-card">
          <div>
            <div className="sel-kpi-card__label">Búsquedas</div>
            <div className="sel-kpi-card__value">{kpis.totalBusquedas}</div>
            <div className="sel-kpi-card__sub">
              {kpis.totalAbiertas} abiertas • {kpis.totalCubiertas} cubiertas
            </div>
          </div>
          <div className="sel-kpi-card__icon" style={{ background: '#EBF2FA', color: '#1E5FA6' }}>
            <Building2 size={20} />
          </div>
        </div>

        <div className="sel-kpi-card">
          <div>
            <div className="sel-kpi-card__label">Postulaciones</div>
            <div className="sel-kpi-card__value">{kpis.totalPostulaciones}</div>
            <div className="sel-kpi-card__sub">Candidatos únicos recibidos</div>
          </div>
          <div className="sel-kpi-card__icon" style={{ background: '#E0F2FE', color: '#0284C7' }}>
            <UserCheck size={20} />
          </div>
        </div>

        <div className="sel-kpi-card">
          <div>
            <div className="sel-kpi-card__label">Perfiles Idóneos</div>
            <div className="sel-kpi-card__value">{kpis.totalIdoneos}</div>
            <div className="sel-kpi-card__sub">
              <strong style={{ color: '#0284C7' }}>{kpis.tasaIdoneidad}%</strong> sobre postulaciones
            </div>
          </div>
          <div className="sel-kpi-card__icon" style={{ background: '#EDE9FE', color: '#7C3AED' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="sel-kpi-card">
          <div>
            <div className="sel-kpi-card__label">Cubiertas</div>
            <div className="sel-kpi-card__value" style={{ color: '#15803d' }}>{kpis.totalCubiertas}</div>
            <div className="sel-kpi-card__sub">
              {kpis.totalBusquedas > 0
                ? `${Math.round((kpis.totalCubiertas / kpis.totalBusquedas) * 100)}% de efectividad`
                : 'Sin búsquedas'}
            </div>
          </div>
          <div className="sel-kpi-card__icon" style={{ background: '#DCFCE7', color: '#15803D' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="sel-kpi-card">
          <div>
            <div className="sel-kpi-card__label">Promedio Cobertura</div>
            <div className="sel-kpi-card__value">
              {kpis.promedioDias !== '—' ? `${kpis.promedioDias} d` : '—'}
            </div>
            <div className="sel-kpi-card__sub">Días corridos (solicitud → aceptación)</div>
          </div>
          <div className="sel-kpi-card__icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
            <Clock size={20} />
          </div>
        </div>

        <div className="sel-kpi-card">
          <div>
            <div className="sel-kpi-card__label">Seguimiento 3 Meses</div>
            <div className="sel-kpi-card__value" style={{ color: kpis.alertasRevisar > 0 ? '#dc2626' : '#0f172a' }}>
              {kpis.alertasRevisar > 0 ? `${kpis.alertasRevisar} por revisar` : `${kpis.pendientes3m} en plazo`}
            </div>
            <div className="sel-kpi-card__sub">
              {kpis.totalPsicotecnicos} psicotécnicos realizados
            </div>
          </div>
          <div
            className="sel-kpi-card__icon"
            style={{
              background: kpis.alertasRevisar > 0 ? '#FEE2E2' : '#F1F5F9',
              color: kpis.alertasRevisar > 0 ? '#DC2626' : '#475569',
            }}
          >
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* ─── NAVEGACIÓN DE PESTAÑAS + LEYENDA ─── */}
      <div
        id="sel-tour-tabs"
        className={`sel-tabs-bar ${currentTourStep?.target === 'tabs' ? 'sel-tour-highlight' : ''}`}
        style={currentTourStep?.target === 'tabs' ? { padding: '0.5rem 0.75rem' } : undefined}
      >
        <div className="sel-tabs">
          <button
            type="button"
            className={`sel-tab ${activeTab === 'vacantes' ? 'sel-tab--active' : ''}`}
            onClick={() => setActiveTab('vacantes')}
          >
            <Table2 size={16} />
            Tablero de Vacantes ({filteredRows.length})
          </button>
          <button
            type="button"
            className={`sel-tab ${activeTab === 'analitica' ? 'sel-tab--active' : ''}`}
            onClick={() => setActiveTab('analitica')}
          >
            <BarChart3 size={16} />
            Búsquedas por Mes & Analítica
          </button>
          <button
            type="button"
            className={`sel-tab ${activeTab === 'guia' ? 'sel-tab--active' : ''}`}
            onClick={() => setActiveTab('guia')}
          >
            <BookOpen size={16} />
            Criterios y Guía de Uso
          </button>
        </div>

        {activeTab === 'vacantes' && (
          <div className="sel-legend">
            <span style={{ color: '#1E5FA6', fontWeight: 700 }}>
              👆 Hacé clic en cualquier fila para abrir y modificar la búsqueda
            </span>
            <span>
              <span className="sel-legend__dot" style={{ background: '#facc15' }} />
              <strong>Amarillo:</strong> Datos a completar
            </span>
            <span>
              <span className="sel-legend__dot" style={{ background: '#3b82f6' }} />
              <strong>Azul:</strong> Cálculo automático
            </span>
          </div>
        )}
      </div>

      {/* ============================================================
          PESTAÑA 1: TABLERO DE VACANTES (PLANILLA OPERATIVA)
         ============================================================ */}
      {activeTab === 'vacantes' && (
        <>
          {/* Filtros */}
          <div
            id="sel-tour-filters"
            className={`sel-filters ${currentTourStep?.target === 'filters' ? 'sel-tour-highlight' : ''}`}
          >
            <div className="sel-search-wrap">
              <Search
                size={15}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
              />
              <input
                type="text"
                className="sel-search-input"
                placeholder="Buscar por área, puesto, fuente, motivo u observación..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="sel-select"
              value={filterArea}
              onChange={e => setFilterArea(e.target.value)}
            >
              <option value="">Todas las áreas / servicios</option>
              {allAreas.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <select
              className="sel-select"
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {ESTADOS_BUSQUEDA.map(est => (
                <option key={est} value={est}>{est}</option>
              ))}
            </select>

            <select
              className="sel-select"
              value={filterAviso}
              onChange={e => setFilterAviso(e.target.value)}
            >
              <option value="">Seguimiento 3 meses (Todos)</option>
              <option value="revisar">⚠️ Revisar (Plazo vencido)</option>
              <option value="pendiente">⏳ Pendiente de plazo</option>
              <option value="registrado">✅ Registrado</option>
            </select>

            {(searchTerm || filterArea || filterEstado || filterAviso) && (
              <button
                type="button"
                className="sel-btn sel-btn--secondary"
                onClick={() => {
                  setSearchTerm('');
                  setFilterArea('');
                  setFilterEstado('');
                  setFilterAviso('');
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Tabla Principal */}
          <div
            id="sel-tour-table"
            className={`sel-table-card ${currentTourStep?.target === 'table' ? 'sel-tour-highlight' : ''}`}
          >
            <div className="sel-table-scroll">
              <table className="sel-table">
                <thead>
                  <tr>
                    <th className="sel-th--input">Área / servicio</th>
                    <th className="sel-th--input">Puesto buscado</th>
                    <th className="sel-th--input">Solicitud aprobada</th>
                    <th className="sel-th--input">Propuesta aceptada</th>
                    <th className="sel-th--input" style={{ textAlign: 'center' }}>Postulaciones</th>
                    <th className="sel-th--input" style={{ textAlign: 'center' }}>Perfiles idóneos</th>
                    <th className="sel-th--input">Fuente de contratación</th>
                    <th className="sel-th--input">Estado</th>
                    <th className="sel-th--calc" style={{ textAlign: 'center' }} title="Días corridos entre solicitud aprobada y propuesta aceptada">
                      ⚡ Días cobertura
                    </th>
                    <th className="sel-th--calc" style={{ textAlign: 'center' }} title="Perfiles idóneos / Postulaciones recibidas">
                      ⚡ % Idóneos
                    </th>
                    <th className="sel-th--input" style={{ textAlign: 'center' }}>Psicotécnicos</th>
                    <th className="sel-th--input">Fecha de ingreso</th>
                    <th className="sel-th--calc" title="Se calcula automáticamente a 3 meses exactos desde la fecha de ingreso">
                      ⚡ Revisión 3 meses
                    </th>
                    <th className="sel-th--calc" title="Estado automático de seguimiento a los 3 meses">
                      ⚡ Aviso seguimiento
                    </th>
                    <th className="sel-th--input">Situación 3 meses</th>
                    <th className="sel-th--input">Motivo búsqueda</th>
                    <th className="sel-th--input">Observaciones</th>
                    <th className="sel-th--actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={18} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                        No hay búsquedas registradas con los filtros actuales. Hacé clic en <strong>+ Nueva Vacante</strong> para registrar una búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map(row => {
                      const estadoClass =
                        row.estado === 'Cubierta'
                          ? 'sel-badge--cubierta'
                          : row.estado === 'Suspendida'
                          ? 'sel-badge--suspendida'
                          : row.estado === 'Cancelada'
                          ? 'sel-badge--cancelada'
                          : 'sel-badge--abierta';

                      return (
                        <tr
                          key={row.id}
                          onClick={() => handleOpenEdit(row)}
                          title="Hacé clic para abrir y modificar esta búsqueda (fechas, postulaciones, estado, etc.)"
                        >
                          {/* Área */}
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>{row.area}</span>
                              {row.is_example && (
                                <span
                                  style={{
                                    fontSize: '0.62rem',
                                    background: '#f1f5f9',
                                    color: '#64748b',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                  }}
                                  title="Fila de ejemplo inicial del Excel"
                                >
                                  EJEMPLO
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Puesto */}
                          <td style={{ fontWeight: 600, color: '#1E5FA6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ textDecoration: 'underline', textDecorationColor: 'rgba(30,95,166,0.35)', textUnderlineOffset: '3px' }}>
                                {row.puesto}
                              </span>
                              <Edit3 size={12} style={{ color: '#64748b', opacity: 0.7, flexShrink: 0 }} />
                            </div>
                          </td>

                          {/* Solicitud aprobada */}
                          <td>{formatDateAR(row.fecha_solicitud)}</td>

                          {/* Propuesta aceptada */}
                          <td>{formatDateAR(row.fecha_aceptacion)}</td>

                          {/* Postulaciones */}
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.postulaciones ?? 0}</td>

                          {/* Perfiles idóneos */}
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.perfiles_idoneos ?? 0}</td>

                          {/* Fuente de contratación */}
                          <td>
                            {row.fuente_contratacion ? (
                              <span style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 500,
                              }}>
                                {row.fuente_contratacion}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>

                          {/* Estado (selector rápido + clic en fila para editar todo) */}
                          <td onClick={e => e.stopPropagation()}>
                            <select
                              value={row.estado || 'Abierta'}
                              onChange={e => handleQuickEstado(row, e.target.value)}
                              className={`sel-badge ${estadoClass}`}
                              style={{ cursor: 'pointer', outline: 'none', paddingRight: '0.45rem' }}
                              title="Cambiar estado de la búsqueda"
                            >
                              {ESTADOS_BUSQUEDA.map(est => (
                                <option key={est} value={est} style={{ background: '#ffffff', color: '#0f172a' }}>
                                  {est}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* CÁLCULO: Días de cobertura */}
                          <td className="sel-td--calc" style={{ textAlign: 'center' }}>
                            {row.dias_cobertura !== null ? (
                              <span>{row.dias_cobertura} días</span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontWeight: 400 }}>—</span>
                            )}
                          </td>

                          {/* CÁLCULO: % de perfiles idóneos */}
                          <td className="sel-td--calc" style={{ textAlign: 'center' }}>
                            {row.porcentaje_idoneos !== null ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span>{row.porcentaje_idoneos.toFixed(1)}%</span>
                                <div style={{ width: '54px', height: '4px', background: '#dbeafe', borderRadius: '99px', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${Math.min(100, row.porcentaje_idoneos)}%`,
                                      height: '100%',
                                      background: '#1E5FA6',
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontWeight: 400 }}>—</span>
                            )}
                          </td>

                          {/* Psicotécnicos */}
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.psicotecnicos ?? 0}</td>

                          {/* Fecha de ingreso */}
                          <td>{formatDateAR(row.fecha_ingreso)}</td>

                          {/* CÁLCULO: Revisión a los 3 meses */}
                          <td className="sel-td--calc">
                            {row.fecha_revision_3m ? (
                              formatDateAR(row.fecha_revision_3m)
                            ) : (
                              <span style={{ color: '#94a3b8', fontWeight: 400 }}>—</span>
                            )}
                          </td>

                          {/* CÁLCULO: Aviso de seguimiento */}
                          <td className="sel-td--calc">
                            {row.aviso_code === 'revisar' && (
                              <span className="sel-badge sel-followup--revisar">
                                ⚠️ Revisar
                              </span>
                            )}
                            {row.aviso_code === 'pendiente' && (
                              <span className="sel-badge sel-followup--pendiente" title={`Faltan ${row.aviso_dias} días corridos`}>
                                ⏳ Pendiente de plazo
                              </span>
                            )}
                            {row.aviso_code === 'registrado' && (
                              <span className="sel-badge sel-followup--registrado">
                                ✅ Registrado
                              </span>
                            )}
                            {row.aviso_code === 'empty' && (
                              <span style={{ color: '#94a3b8', fontWeight: 400 }}>—</span>
                            )}
                          </td>

                          {/* Situación a los 3 meses (selector directo para facilitar seguimiento) */}
                          <td onClick={e => e.stopPropagation()}>
                            {row.fecha_ingreso ? (
                              <select
                                value={row.situacion_3_meses || ''}
                                onChange={e => handleQuickSituacion3M(row, e.target.value)}
                                style={{
                                  padding: '0.28rem 0.5rem',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background:
                                    row.situacion_3_meses === 'Continúa'
                                      ? '#dcfce7'
                                      : row.situacion_3_meses === 'Baja'
                                      ? '#fee2e2'
                                      : '#ffffff',
                                  color:
                                    row.situacion_3_meses === 'Continúa'
                                      ? '#15803d'
                                      : row.situacion_3_meses === 'Baja'
                                      ? '#b91c1c'
                                      : '#475569',
                                  cursor: 'pointer',
                                }}
                              >
                                <option value="">Sin verificar</option>
                                <option value="Continúa">Continúa</option>
                                <option value="Baja">Baja</option>
                              </select>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>

                          {/* Motivo de la búsqueda */}
                          <td>{row.motivo_busqueda || <span style={{ color: '#94a3b8' }}>—</span>}</td>

                          {/* Observaciones */}
                          <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.observaciones}>
                            {row.observaciones || <span style={{ color: '#94a3b8' }}>—</span>}
                          </td>

                          {/* Acciones (Fija a la derecha para que siempre esté visible) */}
                          <td
                            className="sel-td--actions"
                            style={{ textAlign: 'center', whiteSpace: 'nowrap' }}
                            onClick={e => e.stopPropagation()}
                          >
                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(row)}
                                title="Abrir y modificar fechas, postulaciones o datos de esta vacante"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.32rem 0.6rem',
                                  borderRadius: '6px',
                                  border: '1px solid #bfdbfe',
                                  background: '#eff6ff',
                                  color: '#1E5FA6',
                                  fontWeight: 700,
                                  fontSize: '0.73rem',
                                  cursor: 'pointer',
                                }}
                              >
                                <Edit3 size={13} />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateRow(row)}
                                title="Duplicar fila para segunda vacante del mismo puesto"
                                style={{
                                  padding: '0.35rem',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                  background: '#ffffff',
                                  color: '#475569',
                                  cursor: 'pointer',
                                }}
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(row)}
                                title="Eliminar vacante"
                                style={{
                                  padding: '0.35rem',
                                  borderRadius: '6px',
                                  border: '1px solid #fecaca',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ============================================================
          PESTAÑA 2: BÚSQUEDAS POR MES (COLUMNAS T:U DEL EXCEL) & ANALÍTICA
         ============================================================ */}
      {activeTab === 'analitica' && (
        <div
          id="sel-tour-analytics"
          className={`sel-analytics-grid ${currentTourStep?.target === 'analytics' ? 'sel-tour-highlight' : ''}`}
        >
          {/* Panel Izquierdo: Tabla exacta "Búsquedas por mes — Según solicitud aprobada" */}
          <div className="sel-panel-card">
            <div className="sel-panel-card__header">
              <div>
                <h3 className="sel-panel-card__title">📅 Búsquedas por Mes</h3>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Según fecha de solicitud aprobada
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#713f12', background: '#fef9c3', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #fde047' }}>
                  Año:
                </label>
                <select
                  className="sel-select"
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  style={{ fontWeight: 700 }}
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <table className="sel-month-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th style={{ textAlign: 'center' }}>Total búsquedas</th>
                  <th style={{ textAlign: 'center' }}>Cubiertas</th>
                  <th style={{ textAlign: 'center' }}>Prom. Días</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStats.months.map(m => (
                  <tr key={m.label} style={m.total > 0 ? { background: '#f8fafc', fontWeight: 600 } : undefined}>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.label}</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '0.4rem' }}>
                        ({m.monthName})
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: m.total > 0 ? '#1E5FA6' : '#94a3b8' }}>
                      {m.total}
                    </td>
                    <td style={{ textAlign: 'center', color: m.cubiertas > 0 ? '#15803d' : '#94a3b8' }}>
                      {m.cubiertas}
                    </td>
                    <td style={{ textAlign: 'center', color: '#475569' }}>
                      {m.promDias !== null ? `${m.promDias} d` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>TOTAL DEL AÑO</td>
                  <td style={{ textAlign: 'center', fontSize: '0.95rem' }}>{monthlyStats.totalAnio}</td>
                  <td style={{ textAlign: 'center' }}>{monthlyStats.totalCubiertasAnio}</td>
                  <td style={{ textAlign: 'center' }}>
                    {kpis.promedioDias !== '—' ? `${kpis.promedioDias} d` : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Panel Derecho: Gráficos Ejecutivos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Gráfico 1: Evolución Mensual */}
            <div className="sel-panel-card">
              <div className="sel-panel-card__header">
                <h3 className="sel-panel-card__title">
                  Evolución Mensual de Búsquedas ({selectedYear})
                </h3>
              </div>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={monthlyStats.months}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="total" name="Solicitudes Aprobadas" fill="#1E5FA6" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="cubiertas" name="Vacantes Cubiertas" fill="#16A34A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Búsquedas y Postulaciones por Área / Servicio */}
            <div className="sel-panel-card">
              <div className="sel-panel-card__header">
                <h3 className="sel-panel-card__title">
                  Demanda y Postulaciones por Área / Servicio
                </h3>
              </div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={analyticsByArea} layout="vertical" margin={{ left: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="area" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="total" name="Vacantes" fill="#1E5FA6" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="idoneos" name="Perfiles Idóneos" fill="#0284C7" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="cubiertas" name="Cubiertas" fill="#059669" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Fila inferior de gráficos: Fuentes de Contratación y Motivos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              <div className="sel-panel-card">
                <div className="sel-panel-card__header">
                  <h3 className="sel-panel-card__title">Fuentes de Contratación Efectivas</h3>
                </div>
                {analyticsByFuente.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>
                    Sin fuentes registradas aún
                  </p>
                ) : (
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={analyticsByFuente}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={75}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {analyticsByFuente.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="sel-panel-card">
                <div className="sel-panel-card__header">
                  <h3 className="sel-panel-card__title">Motivos de Búsqueda</h3>
                </div>
                {analyticsByMotivo.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>
                    Sin motivos registrados aún
                  </p>
                ) : (
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={analyticsByMotivo}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={75}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {analyticsByMotivo.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[(idx + 2) % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          PESTAÑA 3: CRITERIOS, SIMULADOR INTERACTIVO Y GUÍA DE USO
         ============================================================ */}
      {activeTab === 'guia' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Simulador Interactivo en Vivo */}
          <div
            id="sel-tour-simulator"
            className={`sel-panel-card ${currentTourStep?.target === 'simulator' ? 'sel-tour-highlight' : ''}`}
            style={{ borderLeft: '4px solid #7c3aed' }}
          >
            <div className="sel-panel-card__header">
              <div>
                <h3 className="sel-panel-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🧪 Simulador Interactivo de Fórmulas (Modo Práctica)
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Cambiá cualquier dato amarillo de prueba acá abajo y observá cómo reaccionan automáticamente las 4 fórmulas azules sin modificar tu base real.
                </span>
              </div>
              <button
                type="button"
                className="sel-btn sel-btn--tour"
                onClick={() => startTour(0)}
              >
                <Play size={14} />
                Iniciar Tour Guiado Paso a Paso
              </button>
            </div>

            <div className="sel-form-grid" style={{ marginBottom: '1rem' }}>
              <div className="sel-field">
                <label>🟡 1. Solicitud aprobada</label>
                <input
                  type="date"
                  value={simData.fecha_solicitud}
                  onChange={e => setSimData(prev => ({ ...prev, fecha_solicitud: e.target.value }))}
                />
              </div>
              <div className="sel-field">
                <label>🟡 2. Propuesta aceptada</label>
                <input
                  type="date"
                  value={simData.fecha_aceptacion}
                  onChange={e => setSimData(prev => ({ ...prev, fecha_aceptacion: e.target.value }))}
                />
              </div>
              <div className="sel-field">
                <label>🟡 3. Postulaciones recibidas</label>
                <input
                  type="number"
                  min="0"
                  value={simData.postulaciones}
                  onChange={e => setSimData(prev => ({ ...prev, postulaciones: e.target.value }))}
                />
              </div>
              <div className="sel-field">
                <label>🟡 4. Perfiles idóneos</label>
                <input
                  type="number"
                  min="0"
                  value={simData.perfiles_idoneos}
                  onChange={e => setSimData(prev => ({ ...prev, perfiles_idoneos: e.target.value }))}
                />
              </div>
              <div className="sel-field">
                <label>🟡 5. Fecha de ingreso efectivo</label>
                <input
                  type="date"
                  value={simData.fecha_ingreso}
                  onChange={e => setSimData(prev => ({ ...prev, fecha_ingreso: e.target.value }))}
                />
              </div>
              <div className="sel-field">
                <label>🟡 6. Situación a los 3 meses</label>
                <select
                  value={simData.situacion_3_meses}
                  onChange={e => setSimData(prev => ({ ...prev, situacion_3_meses: e.target.value }))}
                >
                  <option value="">Vacío (Sin verificar aún)</option>
                  <option value="Continúa">Continúa</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>
            </div>

            {/* Resultado en vivo de las 4 fórmulas azules */}
            <div style={{
              background: '#eff6ff',
              border: '1px solid #93c5fd',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  ⚡ Días de cobertura (Automático)
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
                  {simPreview.dias_cobertura !== null ? `${simPreview.dias_cobertura} días corridos` : 'Pendiente de aceptación'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>
                  Fórmula: Propuesta aceptada − Solicitud aprobada
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  ⚡ % de Perfiles Idóneos (Automático)
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
                  {simPreview.porcentaje_idoneos !== null ? `${simPreview.porcentaje_idoneos.toFixed(1)}%` : '—'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>
                  Fórmula: Perfiles idóneos ÷ Postulaciones
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  ⚡ Revisión a los 3 meses (Automático)
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
                  {formatDateAR(simPreview.fecha_revision_3m)}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>
                  Fórmula: Fecha de ingreso + 3 meses calendario
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  ⚡ Aviso de seguimiento (Automático)
                </div>
                <div style={{ marginTop: '6px' }}>
                  {simPreview.aviso_code === 'revisar' && (
                    <span className="sel-badge sel-followup--revisar">⚠️ Revisar (Plazo cumplido)</span>
                  )}
                  {simPreview.aviso_code === 'pendiente' && (
                    <span className="sel-badge sel-followup--pendiente">⏳ Pendiente de plazo ({simPreview.aviso_dias}d restantes)</span>
                  )}
                  {simPreview.aviso_code === 'registrado' && (
                    <span className="sel-badge sel-followup--registrado">✅ Registrado ({simData.situacion_3_meses})</span>
                  )}
                  {simPreview.aviso_code === 'empty' && <span style={{ color: '#64748b' }}>Sin fecha de ingreso</span>}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px' }}>
                  Probá elegir &quot;Continúa&quot; en el campo 6 para ver cómo pasa a Registrado.
                </div>
              </div>
            </div>
          </div>

          <div className="sel-guide-grid">
          <div className="sel-guide-card">
            <h4>📋 Regla de Vacante Única por Fila</h4>
            <ul>
              <li>Registrar <strong>una fila por cada vacante</strong>.</li>
              <li>Para dos vacantes iguales del mismo puesto, usar <strong>dos filas separadas</strong> (podés usar el botón de duplicar fila) y repartir las postulaciones sin duplicarlas.</li>
              <li>Completar área, puesto, fechas, cantidades, motivo y estado. Al cubrirla, agregar la fecha de aceptación y la fuente de contratación.</li>
            </ul>
          </div>

          <div className="sel-guide-card">
            <h4>🎯 Postulaciones y Perfiles Idóneos</h4>
            <ul>
              <li><strong>Postulaciones recibidas:</strong> Candidatos únicos para esa vacante. No repetir a quien envió su CV por distintos medios.</li>
              <li><strong>Perfil idóneo:</strong> Candidato que cumple los requisitos indispensables acordados con el responsable del área.</li>
              <li><strong>% de perfiles idóneos:</strong> Divide automáticamente perfiles idóneos por postulaciones recibidas. Actualizar al evaluar los CV.</li>
            </ul>
          </div>

          <div className="sel-guide-card">
            <h4>⏱️ Tiempos y Fuente de Contratación</h4>
            <ul>
              <li><strong>Días de cobertura:</strong> Se calcula automáticamente desde la <em>Solicitud aprobada</em> hasta la <em>Propuesta aceptada</em>, en días corridos.</li>
              <li><strong>Fuente de contratación:</strong> Corresponde al canal del candidato que aceptó la propuesta (no mide postulaciones por canal). Dejar vacía mientras la búsqueda siga abierta.</li>
              <li><strong>Psicotécnicos realizados:</strong> Cantidad de evaluaciones efectivamente realizadas en esa búsqueda.</li>
            </ul>
          </div>

          <div className="sel-guide-card">
            <h4>🗓️ Seguimiento a los 3 Meses y Estados</h4>
            <ul>
              <li><strong>Revisión a los 3 meses:</strong> Se calcula desde la <em>Fecha de ingreso efectivo</em>, no desde la aceptación de la propuesta.</li>
              <li><strong>Aviso de seguimiento:</strong> Al cumplirse el plazo aparece <strong>⚠️ Revisar</strong>. Completar la columna <em>Situación a los 3 meses</em> con <strong>Continúa</strong> o <strong>Baja</strong>; el aviso pasará automáticamente a <strong>✅ Registrado</strong>.</li>
              <li><strong>Búsquedas suspendidas o canceladas:</strong> Se conservan en el historial y cuentan en el mes en que fueron aprobadas.</li>
            </ul>
          </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL DE CREACIÓN / EDICIÓN DE VACANTE
         ============================================================ */}
      {modalOpen && (
        <div className="sel-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="sel-modal" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleSaveForm}>
              <div className="sel-modal__header">
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  {editingId ? '✏️ Editar Búsqueda / Vacante' : '➕ Nueva Búsqueda / Vacante'}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <button
                    type="submit"
                    className="sel-btn sel-btn--primary"
                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.78rem' }}
                  >
                    <CheckCircle2 size={15} />
                    {editingId ? 'Guardar Cambios' : 'Registrar Vacante'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    style={{ fontSize: '1.4rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                    title="Cerrar"
                  >
                    &times;
                  </button>
                </div>
              </div>

              <div className="sel-modal__body">
                {/* Bloque 1: Identificación de la vacante */}
                <div className="sel-form-grid">
                  <div className="sel-field">
                    <label>Área / Servicio *</label>
                    {!customAreaMode ? (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <select
                          value={formData.area}
                          onChange={e => {
                            if (e.target.value === '__custom__') {
                              setCustomAreaMode(true);
                              setFormData(prev => ({ ...prev, area: '' }));
                            } else {
                              setFormData(prev => ({ ...prev, area: e.target.value }));
                            }
                          }}
                          required
                        >
                          {allAreas.map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                          <option value="__custom__">+ Otra área / servicio...</option>
                        </select>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <input
                          type="text"
                          placeholder="Escribir área o servicio..."
                          value={formData.area}
                          onChange={e => setFormData(prev => ({ ...prev, area: e.target.value }))}
                          required
                        />
                        <button
                          type="button"
                          className="sel-btn sel-btn--secondary"
                          onClick={() => {
                            setCustomAreaMode(false);
                            setFormData(prev => ({ ...prev, area: AREAS_SUGERIDAS[0] }));
                          }}
                        >
                          Lista
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="sel-field">
                    <label>Puesto buscado *</label>
                    <input
                      type="text"
                      placeholder="Ej: Enfermero/a, Instrumentador/a..."
                      value={formData.puesto}
                      onChange={e => setFormData(prev => ({ ...prev, puesto: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="sel-field">
                    <label>Estado de la búsqueda</label>
                    <select
                      value={formData.estado}
                      onChange={e => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                    >
                      {ESTADOS_BUSQUEDA.map(est => (
                        <option key={est} value={est}>{est}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sel-field">
                    <label>Motivo de la búsqueda</label>
                    <select
                      value={formData.motivo_busqueda}
                      onChange={e => setFormData(prev => ({ ...prev, motivo_busqueda: e.target.value }))}
                    >
                      <option value="">Seleccionar motivo...</option>
                      {MOTIVOS_BUSQUEDA.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bloque 2: Fechas y Embudo de Selección */}
                <div className="sel-form-grid">
                  <div className="sel-field">
                    <label>Solicitud aprobada</label>
                    <input
                      type="date"
                      value={formData.fecha_solicitud || ''}
                      onChange={e => setFormData(prev => ({ ...prev, fecha_solicitud: e.target.value }))}
                    />
                  </div>

                  <div className="sel-field">
                    <label>Propuesta aceptada</label>
                    <input
                      type="date"
                      value={formData.fecha_aceptacion || ''}
                      onChange={e => setFormData(prev => ({ ...prev, fecha_aceptacion: e.target.value }))}
                    />
                  </div>

                  <div className="sel-field">
                    <label>Postulaciones recibidas</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.postulaciones}
                      onChange={e => setFormData(prev => ({ ...prev, postulaciones: e.target.value }))}
                    />
                  </div>

                  <div className="sel-field">
                    <label>Perfiles idóneos</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.perfiles_idoneos}
                      onChange={e => setFormData(prev => ({ ...prev, perfiles_idoneos: e.target.value }))}
                    />
                  </div>

                  <div className="sel-field">
                    <label>Psicotécnicos realizados</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.psicotecnicos}
                      onChange={e => setFormData(prev => ({ ...prev, psicotecnicos: e.target.value }))}
                    />
                  </div>

                  <div className="sel-field">
                    <label>Fuente de contratación (al cubrir)</label>
                    <select
                      value={formData.fuente_contratacion}
                      onChange={e => setFormData(prev => ({ ...prev, fuente_contratacion: e.target.value }))}
                    >
                      <option value="">Vacía (Búsqueda abierta)</option>
                      {FUENTES_CONTRATACION.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bloque 3: Ingreso y Seguimiento a los 3 meses */}
                <div className="sel-form-grid">
                  <div className="sel-field">
                    <label>Fecha de ingreso efectivo</label>
                    <input
                      type="date"
                      value={formData.fecha_ingreso || ''}
                      onChange={e => setFormData(prev => ({ ...prev, fecha_ingreso: e.target.value }))}
                    />
                  </div>

                  <div className="sel-field">
                    <label>Situación a los 3 meses</label>
                    <select
                      value={formData.situacion_3_meses}
                      onChange={e => setFormData(prev => ({ ...prev, situacion_3_meses: e.target.value }))}
                    >
                      <option value="">Vacío (Pendiente de verificar)</option>
                      <option value="Continúa">Continúa</option>
                      <option value="Baja">Baja</option>
                    </select>
                  </div>
                </div>

                {/* Vista previa automática de las fórmulas azules del Excel */}
                <div style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '0.75rem',
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                      ⚡ Días de cobertura
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e3a8a', marginTop: '2px' }}>
                      {modalPreview.dias_cobertura !== null ? `${modalPreview.dias_cobertura} días` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                      ⚡ % Perfiles Idóneos
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e3a8a', marginTop: '2px' }}>
                      {modalPreview.porcentaje_idoneos !== null ? `${modalPreview.porcentaje_idoneos.toFixed(1)}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                      ⚡ Revisión a los 3 meses
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e3a8a', marginTop: '2px' }}>
                      {formatDateAR(modalPreview.fecha_revision_3m)}
                    </div>
                    {formData.fecha_ingreso && (
                      <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '2px' }}>
                        +3 meses desde ingreso ({formatDateAR(formData.fecha_ingreso)})
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                      ⚡ Aviso de seguimiento
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e3a8a', marginTop: '2px' }}>
                      {modalPreview.aviso_seguimiento || '—'}
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                <div className="sel-field">
                  <label>Observaciones (demoras, desistimientos, motivo de baja, candidato seleccionado)</label>
                  <textarea
                    rows={2}
                    placeholder="Registrar solo novedades relevantes..."
                    value={formData.observaciones}
                    onChange={e => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                  />
                </div>
              </div>

              <div className="sel-modal__footer">
                <button
                  type="button"
                  className="sel-btn sel-btn--secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="sel-btn sel-btn--primary">
                  {editingId ? 'Guardar Cambios' : 'Registrar Vacante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL DE CONFIRMACIÓN DE ELIMINACIÓN
         ============================================================ */}
      {deleteTarget && (
        <div className="sel-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="sel-modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="sel-modal__body" style={{ textAlign: 'center', padding: '1.75rem' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', background: '#fef2f2', color: '#dc2626',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem',
              }}>
                <Trash2 size={24} />
              </div>
              <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Eliminar búsqueda
              </h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5 }}>
                ¿Estás seguro de eliminar la vacante de <strong>{deleteTarget.puesto}</strong> ({deleteTarget.area})?
              </p>
            </div>
            <div className="sel-modal__footer" style={{ justifyContent: 'center' }}>
              <button type="button" className="sel-btn sel-btn--secondary" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="sel-btn"
                style={{ background: '#dc2626', color: '#ffffff' }}
                onClick={handleConfirmDelete}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ============================================================
          TARJETA FLOTANTE DEL TUTORIAL INTERACTIVO (SPOTLIGHT TOUR)
         ============================================================ */}
      {tourActive && currentTourStep && (
        <>
          <div className="sel-tour-Overlay" onClick={closeTour} />
          <div className="sel-tour-card">
            <div className="sel-tour-card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HelpCircle size={18} />
                <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>Tutorial Interactivo — Selección</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="sel-tour-card__step-badge">
                  Paso {tourStep + 1} de {TOUR_STEPS.length}
                </span>
                <button
                  type="button"
                  onClick={closeTour}
                  style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex' }}
                  title="Cerrar tutorial"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="sel-tour-card__body">
              <h4 className="sel-tour-card__title">{currentTourStep.title}</h4>
              <p className="sel-tour-card__desc">{currentTourStep.desc}</p>
              {currentTourStep.tip && (
                <div className="sel-tour-card__tip">{currentTourStep.tip}</div>
              )}
            </div>

            <div className="sel-tour-card__progress">
              {TOUR_STEPS.map((st, idx) => (
                <div
                  key={st.id}
                  className={`sel-tour-card__dot ${
                    idx === tourStep ? 'sel-tour-card__dot--active' : idx < tourStep ? 'sel-tour-card__dot--done' : ''
                  }`}
                  onClick={() => goToTourStep(idx)}
                  title={st.title}
                />
              ))}
            </div>

            <div className="sel-tour-card__footer">
              <button
                type="button"
                className="sel-btn sel-btn--secondary"
                onClick={closeTour}
                style={{ fontSize: '0.76rem', padding: '0.42rem 0.75rem' }}
              >
                Salir del tour
              </button>

              <div style={{ display: 'flex', gap: '0.45rem' }}>
                <button
                  type="button"
                  className="sel-btn sel-btn--secondary"
                  disabled={tourStep === 0}
                  onClick={() => goToTourStep(tourStep - 1)}
                  style={{ fontSize: '0.78rem', padding: '0.42rem 0.75rem' }}
                >
                  <ChevronLeft size={14} /> Anterior
                </button>

                {tourStep < TOUR_STEPS.length - 1 ? (
                  <button
                    type="button"
                    className="sel-btn sel-btn--tour"
                    onClick={() => goToTourStep(tourStep + 1)}
                    style={{ fontSize: '0.78rem', padding: '0.42rem 0.9rem' }}
                  >
                    Siguiente <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sel-btn sel-btn--primary"
                    onClick={closeTour}
                    style={{ fontSize: '0.78rem', padding: '0.42rem 0.9rem', background: '#16a34a' }}
                  >
                    ✅ ¡Entendido, empezar!
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
