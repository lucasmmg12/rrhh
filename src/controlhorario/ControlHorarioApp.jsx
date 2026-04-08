import React, { useEffect, useState } from 'react';
import { obtenerDiagramaMensual, obtenerFichadasPorSector } from './controlHorarioService';
import './controlhorario.css';

export default function ControlHorarioApp({ onBack }) {
  const [sector, setSector] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [diagram, setDiagram] = useState([]);
  const [fichadas, setFichadas] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load sectors list from service (placeholder static list)
  const SECTORES = [
    { value: 'SECTOR 1', label: 'Sector 1' },
    { value: 'SECTOR 2', label: 'Sector 2' },
    { value: 'CITOLOGÍA', label: 'Citología' },
    { value: 'DXI', label: 'DXI' },
    { value: 'GUARDIAS DE SEGURIDAD', label: 'Guardias' },
  ];

  useEffect(() => {
    if (sector && date) {
      setLoading(true);
      Promise.all([
        obtenerDiagramaMensual(sector, date),
        obtenerFichadasPorSector(sector, date)
      ])
        .then(([diag, fich]) => {
          setDiagram(diag);
          setFichadas(fich);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [sector, date]);

  const renderRow = (dia) => {
    const fich = fichadas.find(f => f.fecha === dia.fecha);
    const estado = fich ? (fich.hora_entrada <= dia.hora_entrada ? 'Cumplido' : 'Llegada Tarde') : 'Ausente';
    return (
      <tr key={dia.fecha} className="control-row">
        <td>{dia.fecha}</td>
        <td>{dia.hora_entrada} - {dia.hora_salida}</td>
        <td>{fich ? `${fich.hora_entrada} - ${fich.hora_salida}` : '—'}</td>
        <td className={`status-${estado.toLowerCase().replace(' ', '-')}`}>{estado}</td>
      </tr>
    );
  };

  return (
    <div className="controlhorario-container">
      <header className="controlhorario-header">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Control de Horarios</h1>
      </header>
      <div className="filters">
        <select value={sector} onChange={e => setSector(e.target.value)} className="control-select">
          <option value="">Seleccionar sector...</option>
          {SECTORES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="control-date" />
      </div>
      {loading && <p>Cargando datos...</p>}
      {!loading && diagram.length > 0 && (
        <table className="control-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Planificado</th>
              <th>Fichado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {diagram.map(renderRow)}
          </tbody>
        </table>
      )}
      {!loading && sector && diagram.length === 0 && <p>No hay datos para el sector y fecha seleccionados.</p>}
    </div>
  );
}
