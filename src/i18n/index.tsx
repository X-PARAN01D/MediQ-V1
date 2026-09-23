import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { en, type Strings } from './en'
import { hi } from './hi'

export type Lang = 'en' | 'hi'

const dicts: Record<Lang, Strings> = { en, hi }

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: Strings
}

const Ctx = createContext<LangCtx>({ lang: 'en', setLang: () => {}, t: en })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem('mediq-lang') as Lang) || 'en' } catch { return 'en' }
  })
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('mediq-lang', l) } catch { /* noop */ }
  }, [])
  return <Ctx.Provider value={{ lang, setLang, t: dicts[lang] }}>{children}</Ctx.Provider>
}

export const useLang = () => useContext(Ctx)
