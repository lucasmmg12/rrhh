/**
 * MetricasReportePDF.jsx
 * Generates a magazine-style PDF report of the Santa Fe metrics.
 * Uses html2canvas + jsPDF to render styled HTML pages into a downloadable PDF.
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, AreaChart, Area,
} from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './reporte.css';

// ─── CONSTANTS ──────────────────────────────────────────────
const COLORS_OS = ['#1E5FA6', '#0891B2', '#059669', '#7C3AED', '#D97706', '#DC2626', '#2563EB', '#0D9488', '#9333EA', '#EA580C', '#94A3B8'];
const DIAS_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ─── NARRATIVE GENERATORS ──────────────────────────────────
function generateKpiNarrative(kpis) {
  return `El Centro de Atención Médica Santa Fe registra un volumen total de ${kpis.totalVisitas.toLocaleString()} visitas médicas distribuidas en ${kpis.especialidades} especialidades activas. El equipo profesional está compuesto por ${kpis.medicos} médicos que atienden pacientes de ${kpis.obrasSociales} obras sociales distintas, lo que refleja una oferta diversificada y una cobertura amplia del sistema de salud regional.`;
}

function generateEspNarrative(rankEsp) {
  if (!rankEsp?.length) return '';
  const top3 = rankEsp.slice(0, 3);
  const total = rankEsp.reduce((s, e) => s + e.value, 0);
  const top3pct = ((top3.reduce((s, e) => s + e.value, 0) / total) * 100).toFixed(0);
  return `Las tres especialidades con mayor demanda — ${top3.map(e => e.fullName || e.name).join(', ')} — concentran el ${top3pct}% del total de visitas registradas. Esta alta concentración sugiere áreas prioritarias para la asignación de recursos y la planificación de agendas. El análisis detallado permite identificar oportunidades de optimización en la distribución de turnos y la gestión del flujo de pacientes.`;
}

function generateDiasNarrative(heatmapDias) {
  if (!heatmapDias?.length) return '';
  const sorted = [...heatmapDias].sort((a, b) => b.value - a.value);
  const peak = sorted[0];
  const low = sorted[sorted.length - 1];
  return `El día de mayor actividad es el ${peak.label} con ${peak.value.toLocaleString()} visitas, mientras que el ${low.label} registra la menor carga con ${low.value.toLocaleString()}. Esta distribución permite planificar la dotación de personal y la disponibilidad de consultorios de manera estratégica, reforzando los días de mayor demanda y evaluando la posibilidad de redistribuir agendas en los días de menor actividad.`;
}

function generateOSNarrative(obrasSociales) {
  if (!obrasSociales?.length) return '';
  const top = obrasSociales[0];
  const total = obrasSociales.reduce((s, e) => s + e.value, 0);
  const topPct = ((top.value / total) * 100).toFixed(0);
  return `La obra social "${top.fullName || top.name}" lidera el volumen de atenciones con ${top.value.toLocaleString()} visitas (${topPct}% del total), lo que la posiciona como el principal financiador de las prestaciones en la sede. La diversidad de ${obrasSociales.length} obras sociales activas demuestra un perfil de atención plural que fortalece la sustentabilidad económica del centro.`;
}

function generateTendenciaNarrative(visitasMes) {
  if (!visitasMes?.length || visitasMes.length < 2) return '';
  const first = visitasMes[0];
  const last = visitasMes[visitasMes.length - 1];
  const peak = visitasMes.reduce((a, b) => a.value > b.value ? a : b);
  const valley = visitasMes.reduce((a, b) => a.value < b.value ? a : b);
  const trend = last.value > first.value ? 'creciente' : last.value < first.value ? 'decreciente' : 'estable';
  return `La evolución mensual muestra una tendencia ${trend} en el período analizado. El mes de mayor actividad fue ${peak.label} con ${peak.value.toLocaleString()} visitas, mientras que el menor registro corresponde a ${valley.label} con ${valley.value.toLocaleString()}. Estas variaciones pueden correlacionarse con factores estacionales, disponibilidad de agendas y feriados del calendario nacional.`;
}

function generateMedicosNarrative(rankMedicos) {
  if (!rankMedicos?.length) return '';
  const top = rankMedicos[0];
  const top5Total = rankMedicos.slice(0, 5).reduce((s, e) => s + e.value, 0);
  return `El profesional con mayor volumen de atención es ${top.fullName || top.name} con ${top.value.toLocaleString()} visitas registradas. Los 5 médicos más activos acumulan ${top5Total.toLocaleString()} consultas, evidenciando una distribución que puede analizarse para evaluar la carga laboral y la necesidad de incorporar nuevos profesionales en las áreas de mayor demanda.`;
}

// ─── MAIN COMPONENT ────────────────────────────────────────
export default function MetricasReportePDF({
  kpis, heatmapDias, obrasSociales, rankEspecialidades,
  rankMedicos, visitasMes, heatmapMatrix, rankGrupoAgenda,
  onClose,
}) {
  const reportRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const today = new Date().toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const handleDownload = useCallback(async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    setProgress(10);

    try {
      const pages = reportRef.current.querySelectorAll('.rp-page');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = 210;
      const pdfHeight = 297;

      // Wait for charts to fully render
      await new Promise(r => setTimeout(r, 800));

      for (let i = 0; i < pages.length; i++) {
        setProgress(10 + Math.round((i / pages.length) * 80));

        // Scroll page into view to ensure rendering
        pages[i].scrollIntoView({ behavior: 'instant', block: 'start' });
        await new Promise(r => setTimeout(r, 400));

        const pageRect = pages[i].getBoundingClientRect();
        if (pageRect.width === 0 || pageRect.height === 0) continue;

        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: i === 0 ? '#0f172a' : '#ffffff',
          logging: false,
          windowWidth: 794,
          windowHeight: 1123,
          width: pageRect.width,
          height: pageRect.height,
          onclone: (doc) => {
            // Ensure SVGs have explicit dimensions for html2canvas
            doc.querySelectorAll('svg').forEach(svg => {
              if (!svg.getAttribute('width')) {
                const rect = svg.getBoundingClientRect();
                if (rect.width > 0) svg.setAttribute('width', rect.width);
                if (rect.height > 0) svg.setAttribute('height', rect.height);
              }
            });
          },
        });

        if (canvas.width === 0 || canvas.height === 0) continue;

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pdfHeight));
      }

      setProgress(95);
      pdf.save(`Informe_Metricas_SantaFe_${new Date().toISOString().slice(0, 10)}.pdf`);
      setProgress(100);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error al generar el PDF: ' + err.message);
    } finally {
      setTimeout(() => setGenerating(false), 500);
    }
  }, []);

  return (
    <div className="rp-overlay">
      {/* Toolbar */}
      <div className="rp-toolbar">
        <div className="rp-toolbar__left">
          <span className="rp-toolbar__icon">📄</span>
          <span className="rp-toolbar__title">Vista previa del informe</span>
        </div>
        <div className="rp-toolbar__right">
          {generating && (
            <div className="rp-toolbar__progress">
              <div className="rp-toolbar__progress-bar" style={{ width: `${progress}%` }} />
              <span>{progress}%</span>
            </div>
          )}
          <button className="rp-toolbar__btn rp-toolbar__btn--download" onClick={handleDownload} disabled={generating}>
            {generating ? '⏳ Generando...' : '📥 Descargar PDF'}
          </button>
          <button className="rp-toolbar__btn rp-toolbar__btn--close" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Report Pages */}
      <div className="rp-scroll" ref={reportRef}>

        {/* ═══ PAGE 1: COVER ═══ */}
        <div className="rp-page rp-page--cover">
          <div className="rp-cover__badge">INFORME EJECUTIVO</div>
          <div className="rp-cover__content">
            <div className="rp-cover__icon">🏥</div>
            <h1 className="rp-cover__title">Métricas de<br/>Atención Médica</h1>
            <div className="rp-cover__divider" />
            <h2 className="rp-cover__subtitle">Sede Santa Fe</h2>
            <p className="rp-cover__desc">
              Análisis integral del flujo de pacientes, distribución de especialidades
              y rendimiento operativo del centro de atención.
            </p>
          </div>
          <div className="rp-cover__footer">
            <div className="rp-cover__kpi-strip">
              <div className="rp-cover__kpi">
                <span className="rp-cover__kpi-value">{kpis.totalVisitas.toLocaleString()}</span>
                <span className="rp-cover__kpi-label">Visitas</span>
              </div>
              <div className="rp-cover__kpi">
                <span className="rp-cover__kpi-value">{kpis.especialidades}</span>
                <span className="rp-cover__kpi-label">Especialidades</span>
              </div>
              <div className="rp-cover__kpi">
                <span className="rp-cover__kpi-value">{kpis.medicos}</span>
                <span className="rp-cover__kpi-label">Médicos</span>
              </div>
              <div className="rp-cover__kpi">
                <span className="rp-cover__kpi-value">{kpis.obrasSociales}</span>
                <span className="rp-cover__kpi-label">Obras Sociales</span>
              </div>
            </div>
            <div className="rp-cover__date">
              <span>Sanatorio Argentino</span>
              <span>{today}</span>
            </div>
          </div>
        </div>

        {/* ═══ PAGE 2: EXECUTIVE SUMMARY + ESPECIALIDADES ═══ */}
        <div className="rp-page">
          <div className="rp-page__header">
            <span className="rp-page__section-num">01</span>
            <span className="rp-page__section-title">Panorama General</span>
          </div>

          <div className="rp-article">
            <h2 className="rp-article__headline">Radiografía de la actividad asistencial</h2>
            <p className="rp-article__lead">{generateKpiNarrative(kpis)}</p>
          </div>

          <div className="rp-divider" />

          <div className="rp-page__header" style={{ marginTop: '16px' }}>
            <span className="rp-page__section-num">02</span>
            <span className="rp-page__section-title">Especialidades</span>
          </div>

          <div className="rp-two-col">
            <div className="rp-two-col__text">
              <h3 className="rp-article__subhead">Las especialidades que mueven al centro</h3>
              <p className="rp-article__body">{generateEspNarrative(rankEspecialidades)}</p>
              <div className="rp-callout">
                <span className="rp-callout__icon">💡</span>
                <span>Las 3 primeras especialidades representan más de la mitad de la demanda total.</span>
              </div>
            </div>
            <div className="rp-two-col__chart">
              <div className="rp-chart-label">Ranking de Especialidades — Top 10</div>
              <div style={{ width: '100%' }}>
                {rankEspecialidades?.slice(0, 10).map((item, i) => {
                  const maxVal = rankEspecialidades[0]?.value || 1;
                  return (
                    <div key={i} className="rp-bar-item">
                      <span className="rp-bar-item__rank">{i + 1}</span>
                      <span className="rp-bar-item__name">{item.name}</span>
                      <div className="rp-bar-item__bar">
                        <div className="rp-bar-item__fill" style={{ width: `${(item.value / maxVal) * 100}%` }} />
                      </div>
                      <span className="rp-bar-item__value">{item.value.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ PAGE 3: DISTRIBUCIÓN SEMANAL + OBRAS SOCIALES ═══ */}
        <div className="rp-page">
          <div className="rp-page__header">
            <span className="rp-page__section-num">03</span>
            <span className="rp-page__section-title">Distribución de la Demanda</span>
          </div>

          <div className="rp-two-col">
            <div className="rp-two-col__text">
              <h3 className="rp-article__subhead">Patrón semanal de atención</h3>
              <p className="rp-article__body">{generateDiasNarrative(heatmapDias)}</p>
            </div>
            <div className="rp-two-col__chart">
              <div className="rp-chart-label">Volumen por día de la semana</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={heatmapDias} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} tickFormatter={v => v.toLocaleString()} />
                  <Bar dataKey="value" fill="#1E5FA6" radius={[4, 4, 0, 0]}
                    label={({ x, y, width, value }) => (
                      <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#1e3a8a" fontSize={9} fontWeight={700}>
                        {value.toLocaleString()}
                      </text>
                    )}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rp-divider" />

          <div className="rp-page__header" style={{ marginTop: '16px' }}>
            <span className="rp-page__section-num">04</span>
            <span className="rp-page__section-title">Obras Sociales</span>
          </div>

          <div className="rp-two-col">
            <div className="rp-two-col__chart">
              <div className="rp-chart-label">Distribución por Obra Social — Top 10</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={obrasSociales} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={40}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: '#94a3b8', strokeWidth: 0.5 }}
                  >
                    {obrasSociales?.map((_, i) => (
                      <Cell key={i} fill={COLORS_OS[i % COLORS_OS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="rp-two-col__text">
              <h3 className="rp-article__subhead">Financiadores de la prestación</h3>
              <p className="rp-article__body">{generateOSNarrative(obrasSociales)}</p>
              <div className="rp-os-legend">
                {obrasSociales?.slice(0, 8).map((os, i) => (
                  <div key={i} className="rp-os-legend__item">
                    <span className="rp-os-legend__dot" style={{ backgroundColor: COLORS_OS[i % COLORS_OS.length] }} />
                    <span className="rp-os-legend__name">{os.name}</span>
                    <span className="rp-os-legend__val">{os.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ PAGE 4: TENDENCIAS + MÉDICOS ═══ */}
        <div className="rp-page">
          <div className="rp-page__header">
            <span className="rp-page__section-num">05</span>
            <span className="rp-page__section-title">Evolución Temporal</span>
          </div>

          <div className="rp-article">
            <h3 className="rp-article__subhead">Tendencia mensual de visitas</h3>
            <p className="rp-article__body">{generateTendenciaNarrative(visitasMes)}</p>
          </div>

          <div className="rp-chart-full">
            <div className="rp-chart-label">Visitas por mes — Serie completa</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={visitasMes} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="rpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E5FA6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1E5FA6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={42} tickFormatter={v => v.toLocaleString()} />
                <Area type="monotone" dataKey="value" stroke="#1E5FA6" strokeWidth={2} fill="url(#rpGrad)"
                  dot={{ r: 3, fill: '#1E5FA6', stroke: '#fff', strokeWidth: 1.5 }}
                  label={({ x, y, value }) => (
                    <text x={x} y={y - 10} textAnchor="middle" fill="#1e3a8a" fontSize={8} fontWeight={700}>
                      {value.toLocaleString()}
                    </text>
                  )}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rp-divider" />

          <div className="rp-page__header" style={{ marginTop: '16px' }}>
            <span className="rp-page__section-num">06</span>
            <span className="rp-page__section-title">Equipo Médico</span>
          </div>

          <div className="rp-two-col">
            <div className="rp-two-col__text">
              <h3 className="rp-article__subhead">Los profesionales que sostienen la atención</h3>
              <p className="rp-article__body">{generateMedicosNarrative(rankMedicos)}</p>
              <div className="rp-callout">
                <span className="rp-callout__icon">📊</span>
                <span>Analizar la distribución de la carga entre profesionales permite identificar necesidades de refuerzo.</span>
              </div>
            </div>
            <div className="rp-two-col__chart">
              <div className="rp-chart-label">Ranking de Médicos — Top 10</div>
              <div style={{ width: '100%' }}>
                {rankMedicos?.slice(0, 10).map((item, i) => {
                  const maxVal = rankMedicos[0]?.value || 1;
                  return (
                    <div key={i} className="rp-bar-item">
                      <span className="rp-bar-item__rank">{i + 1}</span>
                      <span className="rp-bar-item__name">{item.name}</span>
                      <div className="rp-bar-item__bar">
                        <div className="rp-bar-item__fill rp-bar-item__fill--purple" style={{ width: `${(item.value / maxVal) * 100}%` }} />
                      </div>
                      <span className="rp-bar-item__value">{item.value.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ PAGE 5: MAPA DE CALOR + GRUPO AGENDA ═══ */}
        <div className="rp-page">
          <div className="rp-page__header">
            <span className="rp-page__section-num">07</span>
            <span className="rp-page__section-title">Mapa de Calor Operativo</span>
          </div>

          <div className="rp-article">
            <h3 className="rp-article__subhead">Cruces día-hora: dónde se concentra la presión</h3>
            <p className="rp-article__body">
              La matriz de calor revela los bloques horarios y días de mayor presión asistencial. Las celdas
              más oscuras indican las franjas críticas donde la demanda alcanza su punto máximo, información
              clave para la planificación de recursos y la gestión de turnos.
            </p>
          </div>

          {heatmapMatrix && (
            <div className="rp-heatmap">
              <div className="rp-chart-label">Matriz Día × Hora (intensidad de visitas)</div>
              <table className="rp-heatmap__table">
                <thead>
                  <tr>
                    <th></th>
                    {heatmapMatrix.hours?.filter((_, h) => h >= 6 && h <= 21).map(h => (
                      <th key={h} className="rp-heatmap__th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapMatrix.days?.map((day, di) => (
                    <tr key={day}>
                      <td className="rp-heatmap__day">{day}</td>
                      {heatmapMatrix.cells?.[di]?.filter((_, h) => h >= 6 && h <= 21).map((cell, hi) => (
                        <td key={hi} className="rp-heatmap__cell"
                          style={{ backgroundColor: getHeatBg(cell.intensity), color: cell.intensity > 0.5 ? '#fff' : '#334155' }}
                        >
                          {cell.value > 0 ? cell.value : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="rp-heatmap__legend">
                <span>Menor</span>
                {[0, 0.2, 0.4, 0.6, 0.8, 1].map(i => (
                  <span key={i} className="rp-heatmap__legend-cell" style={{ backgroundColor: getHeatBg(i) }} />
                ))}
                <span>Mayor</span>
              </div>
            </div>
          )}

          {rankGrupoAgenda?.length > 0 && (
            <>
              <div className="rp-divider" />
              <div className="rp-page__header" style={{ marginTop: '16px' }}>
                <span className="rp-page__section-num">08</span>
                <span className="rp-page__section-title">Grupos de Agenda</span>
              </div>
              <div className="rp-two-col">
                <div className="rp-two-col__text">
                  <p className="rp-article__body">
                    La distribución por grupo de agenda permite comprender la segmentación interna de la
                    oferta de servicios y cómo se organizan los turnos según categorías operativas del sistema.
                  </p>
                </div>
                <div className="rp-two-col__chart">
                  <div className="rp-chart-label">Top 10 Grupos de Agenda</div>
                  {rankGrupoAgenda?.slice(0, 10).map((item, i) => {
                    const maxVal = rankGrupoAgenda[0]?.value || 1;
                    return (
                      <div key={i} className="rp-bar-item">
                        <span className="rp-bar-item__rank">{i + 1}</span>
                        <span className="rp-bar-item__name">{item.name}</span>
                        <div className="rp-bar-item__bar">
                          <div className="rp-bar-item__fill rp-bar-item__fill--teal" style={{ width: `${(item.value / maxVal) * 100}%` }} />
                        </div>
                        <span className="rp-bar-item__value">{item.value.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ═══ PAGE 6: CLOSING ═══ */}
        <div className="rp-page rp-page--closing">
          <div className="rp-closing__content">
            <div className="rp-closing__icon">📋</div>
            <h2 className="rp-closing__title">Conclusiones</h2>
            <div className="rp-closing__divider" />
            <div className="rp-closing__points">
              <div className="rp-closing__point">
                <span className="rp-closing__point-num">1</span>
                <div>
                  <strong>Alta concentración en pocas especialidades:</strong> Las tres primeras especialidades
                  representan la mayoría de la demanda, lo que requiere una gestión priorizada de recursos para estas áreas.
                </div>
              </div>
              <div className="rp-closing__point">
                <span className="rp-closing__point-num">2</span>
                <div>
                  <strong>Distribución semanal predecible:</strong> El patrón de actividad por día de la semana
                  es consistente, lo que facilita la planificación de la dotación de personal y la apertura de consultorios.
                </div>
              </div>
              <div className="rp-closing__point">
                <span className="rp-closing__point-num">3</span>
                <div>
                  <strong>Diversidad de financiadores:</strong> La presencia de múltiples obras sociales
                  fortalece la sustentabilidad del centro y reduce la dependencia de un solo pagador.
                </div>
              </div>
              <div className="rp-closing__point">
                <span className="rp-closing__point-num">4</span>
                <div>
                  <strong>Oportunidad de redistribución:</strong> Los días y horarios de menor actividad
                  representan una oportunidad para reubicar consultas y optimizar la utilización de la infraestructura.
                </div>
              </div>
            </div>
          </div>
          <div className="rp-closing__footer">
            <p>Sanatorio Argentino — Informe generado el {today}</p>
            <p className="rp-closing__disclaimer">Este informe fue generado automáticamente a partir de los datos del sistema de gestión de visitas.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getHeatBg(intensity) {
  if (intensity <= 0) return '#f8fafc';
  if (intensity < 0.2) return '#dbeafe';
  if (intensity < 0.4) return '#93c5fd';
  if (intensity < 0.6) return '#3b82f6';
  if (intensity < 0.8) return '#1d4ed8';
  return '#1e3a8a';
}
