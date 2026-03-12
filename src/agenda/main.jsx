import React from 'react';
import ReactDOM from 'react-dom/client';
import CalendarApp from '../calendario/CalendarApp';
import '../calendario/calendario.css';

// Public readonly entry point — no auth required
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CalendarApp isReadonly={true} />
  </React.StrictMode>
);
