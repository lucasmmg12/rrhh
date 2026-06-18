/**
 * Prestadores Form — Standalone Entry Point
 * No AuthGate: this is a public form accessible via direct link.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './prestadores.css';
import PrestadoresFormApp from './PrestadoresFormApp.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrestadoresFormApp />
  </StrictMode>,
);
