import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { getStore } from './lib/store'
import { getAuth } from './lib/auth'
import { LangProvider } from './i18n'
import { AuthProvider } from './auth/AuthContext'
import App from './App'
import './index.css'

async function boot() {
  await getStore()
  await getAuth()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <LangProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LangProvider>
      </BrowserRouter>
    </StrictMode>
  )
}

boot().catch(err => {
  // eslint-disable-next-line no-console
  console.error('MediQ failed to start', err)
  document.getElementById('root')!.innerHTML =
    '<div style="padding:40px;font-family:sans-serif;color:#0f2440">MediQ could not start. Please reload the page.</div>'
})
