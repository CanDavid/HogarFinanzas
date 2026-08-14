import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'

registerSW({
  onNeedRefresh() {
    if (window.confirm('Hay una nueva versión disponible. ¿Actualizar ahora?')) window.location.reload()
  },
})

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
