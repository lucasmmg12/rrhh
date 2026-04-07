import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from '../components/AuthGate';
import AuditoriaApp from './AuditoriaApp';
import './auditoria.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate moduleName="Seguimiento y Acompañamiento de Sede">
      <AuditoriaApp />
    </AuthGate>
  </React.StrictMode>
);
