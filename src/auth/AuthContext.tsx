import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getAuth, type AuthApi } from '../lib/auth'
import type { User } from '../lib/types'

interface Ctx {
  user: (User & { id: string }) | null
  loading: boolean
  auth: AuthApi | null
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AC = createContext<Ctx>({ user: null, loading: true, auth: null, refresh: async () => {}, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(User & { id: string }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [api, setApi] = useState<AuthApi | null>(null)

  useEffect(() => {
    let unsub = () => {}
    getAuth().then(a => {
      setApi(a)
      unsub = a.onAuth(setUser)
      return a.currentUser()
    }).then(u => { setUser(u); setLoading(false) })
      .catch(() => setLoading(false))
    return () => unsub()
  }, [])

  const refresh = async () => {
    if (!api) return
    setUser(await api.currentUser())
  }
  const signOut = async () => {
    if (!api) return
    await api.signOut()
    setUser(null)
  }

  return <AC.Provider value={{ user, loading, auth: api, refresh, signOut }}>{children}</AC.Provider>
}

export const useAuth = () => useContext(AC)
