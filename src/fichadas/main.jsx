import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthGate from '../components/AuthGate'
import FichadasApp from './FichadasApp'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate moduleName="Control de Fichadas">
      <FichadasApp />
    </AuthGate>
  </React.StrictMode>
)
