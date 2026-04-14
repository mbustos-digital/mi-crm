import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CRMProvider } from './context/CRMContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <CRMProvider>
        <App />
      </CRMProvider>
    </BrowserRouter>
  </StrictMode>
)
