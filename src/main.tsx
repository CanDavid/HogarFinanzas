import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'

const updateServiceWorker = registerSW({
  onNeedRefresh() {
    if (window.confirm('Hay una nueva versión disponible. ¿Actualizar ahora?')) void updateServiceWorker(true)
  },
})

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
