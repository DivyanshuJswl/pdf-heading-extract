import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App className="bg-linear-to-br from-slate-300 to-slate-500 min-h-screen"/>
  </StrictMode>,
)
