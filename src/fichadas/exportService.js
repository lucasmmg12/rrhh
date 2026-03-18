/**
 * Export Service — XLSX and PDF exports for fichadas data
 */
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatMinToHHMM } from './pdfParser';

/**
 * Export data to XLSX
 */
export function exportToXLSX(data, filename = 'fichadas_export') {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen mensual
  const resumenRows = data.map(row => ({
    'Colaborador': row.colaborador?.nombre_completo || row.nombre || '',
    'Área': row.area || row.colaborador?.area || '',
    'Sector': row.colaborador?.sector || '',
    'DNI': row.colaborador?.dni || '',
    'Período': `${row.periodo_mes}/${row.periodo_anio}`,
    'Días Trabajados': row.dias_trabajados || 0,
    'Hs. Trabajadas': formatMinToHHMM(row.total_horas_trabajadas_min || 0),
    'Hs. Redondeadas': formatMinToHHMM(row.total_horas_redondeadas_min || 0),
    'Hs. Redondeadas (num)': Math.round((row.total_horas_redondeadas_min || 0) / 60),
    'Hs. Extra': formatMinToHHMM(row.total_hora_extra_min || 0),
    'Días con Tardanza': row.dias_tarde || 0,
    'Días Incompletos': row.dias_incompletos || 0,
  }));

  const ws = XLSX.utils.json_to_sheet(resumenRows);

  // Auto-size columns
  const colWidths = Object.keys(resumenRows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...resumenRows.map(r => String(r[key] || '').length)) + 2
  }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Resumen Mensual');

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export data to PDF
 */
export function exportToPDF(data, config = {}) {
  const { title = 'Horas Totalizadas', area = '', periodo = '' } = config;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SANATORIO ARGENTINO SRL', 148.5, 15, { align: 'center' });

  doc.setFontSize(11);
  doc.text(`${title} de ${area}`, 148.5, 22, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(periodo, 148.5, 28, { align: 'center' });

  // Table
  const headers = [
    'Colaborador', 'Área', 'Días Trab.', 'Hs. Trabajadas',
    'Hs. Redondeadas', 'Total Hs. (Redond.)', 'Hs. Extra', 'Tardanzas'
  ];

  const rows = data.map(row => [
    row.colaborador?.nombre_completo || row.nombre || '',
    row.area || row.colaborador?.area || '',
    row.dias_trabajados || 0,
    formatMinToHHMM(row.total_horas_trabajadas_min || 0),
    formatMinToHHMM(row.total_horas_redondeadas_min || 0),
    Math.round((row.total_horas_redondeadas_min || 0) / 60),
    formatMinToHHMM(row.total_hora_extra_min || 0),
    row.dias_tarde || 0,
  ]);

  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 34,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 94, 184],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 55 },
      1: { halign: 'left', cellWidth: 30 },
    },
    alternateRowStyles: {
      fillColor: [240, 244, 255],
    },
    margin: { left: 10, right: 10 },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Generado el ${new Date().toLocaleDateString('es-AR')} — Pág. ${i}/${pageCount}`,
      148.5,
      doc.internal.pageSize.height - 8,
      { align: 'center' }
    );
  }

  doc.save(`${config.filename || 'fichadas_reporte'}.pdf`);
}

/**
 * Export detailed records to XLSX
 */
export function exportDetailedXLSX(registros, filename = 'fichadas_detalle') {
  const wb = XLSX.utils.book_new();

  const rows = registros.map(r => ({
    'Colaborador': r.colaborador?.nombre_completo || '',
    'Área': r.colaborador?.area || '',
    'Fecha': r.fecha,
    'Entrada': r.fichada_entrada || '',
    'Salida': r.fichada_salida || '',
    'Hs. Trabajadas': formatMinToHHMM(r.horas_trabajadas_min || 0),
    'Hs. Redondeadas': formatMinToHHMM(r.horas_redondeadas_min || 0),
    'Horario Entrada': r.horario_entrada || '',
    'Carga Horaria': r.carga_horaria || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length)) + 2
  }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Detalle Fichadas');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
