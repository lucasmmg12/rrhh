import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from '../components/AuthGate';
import CalendarApp from './CalendarApp';
import './calendario.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate moduleName="Calendario & Reservas">
      <CalendarApp isReadonly={false} />
    </AuthGate>
  </React.StrictMode>
);
