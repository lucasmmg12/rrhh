import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import OrganigramaApp from '../App.jsx';

// Public read-only entry point — no authentication required
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OrganigramaApp isReadonly={true} />
  </StrictMode>
);

