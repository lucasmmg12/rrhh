import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from '../components/AuthGate';
import HomeApp from './HomeApp';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate moduleName="Portal RRHH">
      <HomeApp />
    </AuthGate>
  </React.StrictMode>
);
