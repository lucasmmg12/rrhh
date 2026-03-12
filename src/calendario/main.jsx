import React from 'react';
import ReactDOM from 'react-dom/client';
import CalendarApp from './CalendarApp';
import './calendario.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CalendarApp isReadonly={false} />
  </React.StrictMode>
);
