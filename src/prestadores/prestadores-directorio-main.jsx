import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PrestadoresDirectorioApp from './PrestadoresDirectorioApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrestadoresDirectorioApp />
  </StrictMode>,
)
