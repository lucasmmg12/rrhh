/**
 * ReporteDiario — Reporte visual de auditorías de un día
 * Incluye gráficos comparativos, análisis por IA (OpenAI) y descarga
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { obtenerAuditorias, obtenerAuditoriaCompleta, SECTORES, CHECKLIST_TEMPLATE, MAX_PUNTOS } from './auditoriaService';

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// ─── COLORS ─────────────────────────────────────────────────
const EVAL_COLORS = {
  bueno: '#22c55e',
  regular: '#f59e0b',
  critico: '#ef4444',
};

const SECTOR_PALETTE = ['#1E5FA6', '#0891b2', '#7c3aed', '#d97706', '#059669', '#dc2626', '#6366f1'];

// ─── SIMPLE BAR CHART (SVG) ─────────────────────────────────
function BarChart({ data, width = 500, height = 220 }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d.value), 100);
  const barW = Math.min(60, (width - 40) / data.length - 10);
  const chartH = height - 50;

  return (
    <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * chartH;
        const x = 30 + i * (barW + 10);
        const y = chartH - barH + 10;
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={barW} height={barH}
              rx={4} fill={d.color || SECTOR_PALETTE[i % SECTOR_PALETTE.length]}
              opacity={0.85}
            />
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e293b">
              {d.value}%
            </text>
            <text x={x + barW / 2} y={height - 5} textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">
              {d.label.length > 12 ? d.label.slice(0, 12) + '…' : d.label}
            </text>
          </g>
        );
      })}
      {/* Baseline */}
      <line x1="20" y1={chartH + 10} x2={width - 10} y2={chartH + 10} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}

// ─── TREND CHART (SVG Line) ─────────────────────────────────
function TrendChart({ data, width = 500, height = 180 }) {
  if (!data || data.length < 2) return <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8', padding: '1rem' }}>Se necesitan al menos 2 días para ver la tendencia</div>;
  const maxVal = 100;
  const padding = { top: 20, bottom: 40, left: 40, right: 20 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - (d.value / maxVal) * chartH,
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(v => {
        const y = padding.top + chartH - (v / 100) * chartH;
        return (
          <g key={v}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={padding.left - 5} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{v}%</text>
          </g>
        );
      })}

      {/* Area */}
      <path
        d={`${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`}
        fill="url(#trendGrad)" opacity="0.15"
      />
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E5FA6" />
          <stop offset="100%" stopColor="#1E5FA6" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Line */}
      <path d={pathD} fill="none" stroke="#1E5FA6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#1E5FA6" strokeWidth="2" />
          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1e293b">{p.value}%</text>
          <text x={p.x} y={height - 8} textAnchor="middle" fontSize="8" fill="#64748b" fontWeight="600">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── RADAR CHART (Categories) ───────────────────────────────
function RadarChart({ categories, size = 220 }) {
  if (!categories || categories.length === 0) return null;
  const cx = size / 2, cy = size / 2, r = size / 2 - 30;
  const n = categories.length;
  const angleStep = (2 * Math.PI) / n;

  const getPoint = (i, val) => ({
    x: cx + r * (val / 100) * Math.cos(angleStep * i - Math.PI / 2),
    y: cy + r * (val / 100) * Math.sin(angleStep * i - Math.PI / 2),
  });

  const points = categories.map((c, i) => getPoint(i, c.pct));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      {/* Grid rings */}
      {[25, 50, 75, 100].map(v => (
        <polygon key={v}
          points={Array.from({ length: n }, (_, i) => {
            const p = getPoint(i, v);
            return `${p.x},${p.y}`;
          }).join(' ')}
          fill="none" stroke="#e2e8f0" strokeWidth="0.5"
        />
      ))}
      {/* Axes & Labels */}
      {categories.map((c, i) => {
        const lp = getPoint(i, 115);
        const ep = getPoint(i, 100);
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={ep.x} y2={ep.y} stroke="#e2e8f0" strokeWidth="0.5" />
            <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="600" fill="#64748b">
              {c.label.length > 10 ? c.label.slice(0, 10) + '…' : c.label}
            </text>
          </g>
        );
      })}
      {/* Data area */}
      <path d={pathD} fill="#1E5FA6" fillOpacity="0.15" stroke="#1E5FA6" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#1E5FA6" />
      ))}
    </svg>
  );
}

// ─── OPENAI ANALYSIS ────────────────────────────────────────
async function generateAIAnalysis(auditsData) {
  if (!OPENAI_KEY) return 'API Key de OpenAI no configurada.';

  const prompt = `Eres un consultor de calidad hospitalaria del Sanatorio Argentino. Analiza las siguientes auditorías del día y genera un informe ejecutivo en español con:

1. **Resumen General** del día (2-3 oraciones)
2. **Fortalezas** detectadas (bullet points)
3. **Áreas Críticas** que requieren atención inmediata
4. **Recomendaciones** concretas de mejora
5. **Comparación entre sectores** si hay más de uno

Los datos son:
${JSON.stringify(auditsData, null, 2)}

Sé conciso, profesional y orientado a la acción. No uses formato markdown, solo texto plano con saltos de línea. Máximo 350 palabras.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'Sin respuesta del modelo.';
  } catch (err) {
    console.error('[OpenAI] Error:', err);
    return `Error al generar análisis: ${err.message}`;
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function ReporteDiario({ fecha, auditorias, onClose }) {
  const [fullAudits, setFullAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [historicalData, setHistoricalData] = useState([]);
  const reportRef = useRef(null);

  const fechaFormatted = useMemo(() => {
    const d = new Date(fecha + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, [fecha]);

  // Load full audit details + historical
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Load complete audit data for the day
        const details = await Promise.all(
          auditorias.map(a => obtenerAuditoriaCompleta(a.id))
        );
        setFullAudits(details);

        // Load historical (last 10 audits before this date for trend)
        const hist = await obtenerAuditorias({ fechaHasta: fecha });
        // Group by date and get avg for each date
        const byDate = {};
        hist.forEach(a => {
          if (a.fecha < fecha) {
            if (!byDate[a.fecha]) byDate[a.fecha] = [];
            byDate[a.fecha].push(a.porcentaje);
          }
        });
        const trendData = Object.entries(byDate)
          .map(([f, pcts]) => ({
            fecha: f,
            label: new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
            value: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length * 100) / 100,
          }))
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
          .slice(-6);

        // Add current day
        const currentAvg = auditorias.length > 0
          ? Math.round(auditorias.reduce((s, a) => s + a.porcentaje, 0) / auditorias.length * 100) / 100
          : 0;
        trendData.push({
          fecha,
          label: new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
          value: currentAvg,
        });
        setHistoricalData(trendData);
      } catch (err) {
        console.error('Error loading report data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fecha, auditorias]);

  // Sector comparison data
  const sectorData = useMemo(() => {
    return auditorias.map((a, i) => ({
      label: SECTORES.find(s => s.value === a.sector)?.label || a.sector,
      value: a.porcentaje,
      color: EVAL_COLORS[a.evaluacion] || SECTOR_PALETTE[i],
    }));
  }, [auditorias]);

  // Category breakdown (avg per category across all audits)
  const categoryData = useMemo(() => {
    if (fullAudits.length === 0) return [];
    return CHECKLIST_TEMPLATE.map(cat => {
      const itemKeys = cat.items.map(i => i.key);
      let totalPts = 0, maxPts = 0;
      fullAudits.forEach(audit => {
        audit.items?.forEach(item => {
          if (itemKeys.includes(item.item_key)) {
            totalPts += item.puntuacion || 0;
            maxPts += 2;
          }
        });
      });
      return {
        label: cat.label,
        icon: cat.icon,
        pct: maxPts > 0 ? Math.round((totalPts / maxPts) * 100) : 0,
      };
    });
  }, [fullAudits]);

  // Auditors for the day
  const auditores = useMemo(() => {
    const set = new Set(auditorias.map(a => a.auditor_nombre));
    return [...set];
  }, [auditorias]);

  // General stats
  const avgPorcentaje = useMemo(() => {
    if (auditorias.length === 0) return 0;
    return Math.round(auditorias.reduce((s, a) => s + a.porcentaje, 0) / auditorias.length * 100) / 100;
  }, [auditorias]);

  const handleAIAnalysis = async () => {
    setAiLoading(true);
    const summaryData = auditorias.map(a => ({
      sector: SECTORES.find(s => s.value === a.sector)?.label || a.sector,
      porcentaje: a.porcentaje,
      evaluacion: a.evaluacion,
      turno: a.turno,
      auditor: a.auditor_nombre,
    }));
    const analysis = await generateAIAnalysis(summaryData);
    setAiAnalysis(analysis);
    setAiLoading(false);
  };

  // Print / Download as PDF
  const handlePrint = () => {
    const content = reportRef.current;
    if (!content) return;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Reporte de Auditoría — ${fechaFormatted}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; padding: 2rem; font-size: 13px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin: 16px 0 8px; color: #1E5FA6; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
        h3 { font-size: 13px; margin: 8px 0 4px; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th, td { padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px; }
        th { background: #f8fafc; font-weight: 700; }
        .badge { padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; }
        .bueno { background: #dcfce7; color: #166534; }
        .regular { background: #fef3c7; color: #92400e; }
        .critico { background: #fef2f2; color: #991b1b; }
        .ai-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 8px 0; white-space: pre-wrap; font-size: 12px; line-height: 1.6; }
        .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        @media print { body { padding: 1rem; } }
      </style></head><body>`);
    
    w.document.write(`<h1>📋 Reporte de Auditoría — ${fechaFormatted}</h1>`);
    w.document.write(`<p style="color:#64748b; margin-bottom:12px">Sanatorio Argentino — Sede Santa Fe · Auditor(es): ${auditores.join(', ')}</p>`);
    
    // Summary table
    w.document.write(`<h2>📊 Resumen del Día</h2>`);
    w.document.write(`<table><thead><tr><th>Sector</th><th>Turno</th><th>Auditor</th><th>Porcentaje</th><th>Evaluación</th></tr></thead><tbody>`);
    auditorias.forEach(a => {
      const sector = SECTORES.find(s => s.value === a.sector)?.label || a.sector;
      w.document.write(`<tr><td>${sector}</td><td>${a.turno}</td><td>${a.auditor_nombre}</td><td><strong>${a.porcentaje}%</strong></td><td><span class="badge ${a.evaluacion}">${a.evaluacion.toUpperCase()}</span></td></tr>`);
    });
    w.document.write(`</tbody></table>`);
    w.document.write(`<p style="font-weight:700; margin-top:8px">Promedio del día: <span style="color:#1E5FA6; font-size:16px">${avgPorcentaje}%</span></p>`);

    // Category breakdown
    w.document.write(`<h2>📋 Desglose por Categoría</h2>`);
    w.document.write(`<table><thead><tr><th>Categoría</th><th>Cumplimiento</th></tr></thead><tbody>`);
    categoryData.forEach(c => {
      const evalClass = c.pct >= 85 ? 'bueno' : c.pct >= 60 ? 'regular' : 'critico';
      w.document.write(`<tr><td>${c.icon} ${c.label}</td><td><span class="badge ${evalClass}">${c.pct}%</span></td></tr>`);
    });
    w.document.write(`</tbody></table>`);

    // Detail per audit
    w.document.write(`<h2>🔍 Detalle por Auditoría</h2>`);
    fullAudits.forEach(audit => {
      const sector = SECTORES.find(s => s.value === audit.sector)?.label || audit.sector;
      w.document.write(`<h3>${sector} — ${audit.porcentaje}% (${audit.evaluacion.toUpperCase()})</h3>`);
      w.document.write(`<table><thead><tr><th>Ítem</th><th>Puntuación</th><th>Observación</th></tr></thead><tbody>`);
      (audit.items || []).forEach(item => {
        const pLabel = item.puntuacion === 2 ? '✓ Cumple' : item.puntuacion === 1 ? '~ Parcial' : '✗ No cumple';
        w.document.write(`<tr><td>${item.item_label}</td><td>${pLabel}</td><td>${item.observaciones || '—'}</td></tr>`);
      });
      w.document.write(`</tbody></table>`);
      if (audit.no_conformidades) w.document.write(`<p><strong>No conformidades:</strong> ${audit.no_conformidades}</p>`);
      if (audit.oportunidades_mejora) w.document.write(`<p><strong>Oportunidades de mejora:</strong> ${audit.oportunidades_mejora}</p>`);
    });

    // AI Analysis
    if (aiAnalysis) {
      w.document.write(`<h2>🤖 Análisis Inteligente (IA)</h2>`);
      w.document.write(`<div class="ai-box">${aiAnalysis}</div>`);
    }

    w.document.write(`<div class="footer">Generado automáticamente — Sanatorio Argentino SRL · RRHH · Innovación y Transformación Digital · ${new Date().toLocaleString('es-AR')}</div>`);
    w.document.write(`</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const cardStyle = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem', marginBottom: '0.75rem' };
  const labelStyle = { fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
        Cargando datos del reporte...
      </div>
    );
  }

  return (
    <div style={{ animation: 'chFadeIn 0.3s ease-out' }} ref={reportRef}>
      {/* ─── HEADER ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            📋 Reporte — {fechaFormatted}
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.1rem 0 0' }}>
            {auditorias.length} auditoría{auditorias.length !== 1 ? 's' : ''} · Auditor{auditores.length > 1 ? 'es' : ''}: {auditores.join(', ')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={handleAIAnalysis}
            disabled={aiLoading}
            style={{
              padding: '0.45rem 1rem', borderRadius: 8, border: '1px solid #e2e8f0',
              background: aiLoading ? '#f1f5f9' : 'white', cursor: aiLoading ? 'wait' : 'pointer',
              fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            {aiLoading ? '⏳ Analizando...' : '🤖 Análisis IA'}
          </button>
          <button
            onClick={handlePrint}
            style={{
              padding: '0.45rem 1rem', borderRadius: 8, border: 'none',
              background: '#1E5FA6', color: 'white', cursor: 'pointer',
              fontSize: '0.78rem', fontWeight: 700, transition: 'all 0.15s',
            }}
          >
            📥 Descargar PDF
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.45rem 0.65rem', borderRadius: 8, border: '1px solid #e2e8f0',
              background: '#f8fafc', cursor: 'pointer', fontSize: '0.95rem', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ─── KPIs ROW ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ ...cardStyle, textAlign: 'center', borderLeft: '4px solid #1E5FA6' }}>
          <div style={labelStyle}>Promedio del Día</div>
          <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#1E5FA6' }}>{avgPorcentaje}%</div>
        </div>
        <div style={{ ...cardStyle, textAlign: 'center', borderLeft: '4px solid #22c55e' }}>
          <div style={labelStyle}>Buenos (≥85%)</div>
          <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#22c55e' }}>
            {auditorias.filter(a => a.evaluacion === 'bueno').length}
          </div>
        </div>
        <div style={{ ...cardStyle, textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
          <div style={labelStyle}>Regulares (60-84%)</div>
          <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#f59e0b' }}>
            {auditorias.filter(a => a.evaluacion === 'regular').length}
          </div>
        </div>
        <div style={{ ...cardStyle, textAlign: 'center', borderLeft: '4px solid #ef4444' }}>
          <div style={labelStyle}>Críticos (&lt;60%)</div>
          <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#ef4444' }}>
            {auditorias.filter(a => a.evaluacion === 'critico').length}
          </div>
        </div>
      </div>

      {/* ─── CHARTS ROW ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        {/* Sector Comparison */}
        <div style={{ ...cardStyle, background: 'white' }}>
          <div style={labelStyle}>📊 Comparación entre Sectores</div>
          <BarChart data={sectorData} width={440} height={200} />
        </div>

        {/* Category Radar */}
        <div style={{ ...cardStyle, background: 'white' }}>
          <div style={labelStyle}>🎯 Cumplimiento por Categoría</div>
          <RadarChart categories={categoryData} size={200} />
        </div>
      </div>

      {/* ─── TREND CHART ─── */}
      <div style={{ ...cardStyle, background: 'white', marginBottom: '1rem' }}>
        <div style={labelStyle}>📈 Tendencia Histórica (Promedio por Día)</div>
        <TrendChart data={historicalData} width={700} height={180} />
      </div>

      {/* ─── DETAIL TABLE ─── */}
      <div style={{ ...cardStyle, background: 'white', marginBottom: '1rem' }}>
        <div style={labelStyle}>🔍 Detalle de Auditorías del Día</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>Sector</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>Turno</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>Auditor</th>
                {CHECKLIST_TEMPLATE.map(cat => (
                  <th key={cat.categoria} style={{ padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #e2e8f0', fontSize: '0.72rem' }}>
                    {cat.icon}
                  </th>
                ))}
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>Total</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>Evaluación</th>
              </tr>
            </thead>
            <tbody>
              {fullAudits.map(audit => {
                const sector = SECTORES.find(s => s.value === audit.sector)?.label || audit.sector;
                // Calculate per-category scores
                const catScores = CHECKLIST_TEMPLATE.map(cat => {
                  const keys = cat.items.map(i => i.key);
                  const items = (audit.items || []).filter(it => keys.includes(it.item_key));
                  const pts = items.reduce((s, it) => s + (it.puntuacion || 0), 0);
                  const max = cat.items.length * 2;
                  return Math.round((pts / max) * 100);
                });

                return (
                  <tr key={audit.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{sector}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{audit.turno}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>{audit.auditor_nombre}</td>
                    {catScores.map((pct, i) => (
                      <td key={i} style={{
                        padding: '0.5rem', textAlign: 'center', fontWeight: 700, fontSize: '0.78rem',
                        color: pct >= 85 ? '#059669' : pct >= 60 ? '#d97706' : '#dc2626',
                        background: pct >= 85 ? '#f0fdf4' : pct >= 60 ? '#fffbeb' : '#fef2f2',
                      }}>
                        {pct}%
                      </td>
                    ))}
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 900, fontSize: '0.95rem', color: '#1E5FA6' }}>
                      {audit.porcentaje}%
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.2rem 0.5rem', borderRadius: 6, fontWeight: 700, fontSize: '0.72rem',
                        background: audit.evaluacion === 'bueno' ? '#dcfce7' : audit.evaluacion === 'regular' ? '#fef3c7' : '#fef2f2',
                        color: audit.evaluacion === 'bueno' ? '#166534' : audit.evaluacion === 'regular' ? '#92400e' : '#991b1b',
                      }}>
                        {audit.evaluacion.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── AI ANALYSIS ─── */}
      {aiAnalysis && (
        <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #eff6ff, #f8fafc)', border: '1px solid #bfdbfe', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🤖</span>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1E5FA6' }}>Análisis Inteligente (IA)</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
            {aiAnalysis}
          </div>
        </div>
      )}

      {/* ─── FOOTER ─── */}
      <div style={{ textAlign: 'center', fontSize: '0.68rem', color: '#94a3b8', padding: '0.5rem 0', borderTop: '1px solid #f1f5f9' }}>
        Generado automáticamente — Sanatorio Argentino SRL · RRHH · Innovación y Transformación Digital
      </div>
    </div>
  );
}
