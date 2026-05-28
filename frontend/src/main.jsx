import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

localStorage.removeItem('access_token')
localStorage.removeItem('refresh_token')
localStorage.removeItem('auth-storage')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
