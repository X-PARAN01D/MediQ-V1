/* Central configuration surface. Everything Deep needs to connect lives here. */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

export const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || ''

export const isFirebaseConfigured =
  Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) &&
  import.meta.env.VITE_DEMO_MODE !== '1'

/** 'firebase' when a real project is wired up, otherwise the built-in demo backend. */
export const backendMode: 'firebase' | 'demo' = isFirebaseConfigured ? 'firebase' : 'demo'

/** Set to true in demo mode so the UI can be honest about simulated OTP/SMS. */
export const isDemo = backendMode === 'demo'
