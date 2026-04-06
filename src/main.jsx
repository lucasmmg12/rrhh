import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthGate from './components/AuthGate'
import RRHHApp from './RRHHApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate moduleName="RRHH Sanatorio Argentino">
      <RRHHApp />
    </AuthGate>
  </StrictMode>,
)
