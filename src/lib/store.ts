import { backendMode } from './config'

export type Doc<T> = T & { id: string }

/**
 * Server-side query constraint. In Firebase mode these become Firestore
 * `where()` clauses — required because security rules only allow queries
 * the rules can prove (e.g. a patient must constrain `patientId == own uid`).
 * In demo mode they are applied client-side with identical semantics.
 */
export interface ServerWhere {
  field: string
  op: '==' | 'in' | '>=' | '<=' | 'array-contains'
  value: unknown
}

export interface Collection<T> {
  list(filter?: (d: Doc<T>) => boolean, serverWhere?: ServerWhere[]): Promise<Doc<T>[]>
  get(id: string): Promise<Doc<T> | null>
  create(data: Omit<T, 'id'>): Promise<Doc<T>>
  set(id: string, data: Omit<T, 'id'>): Promise<Doc<T>>
  update(id: string, patch: Partial<T>): Promise<void>
  remove(id: string): Promise<void>
  subscribe(cb: (docs: Doc<T>[]) => void, filter?: (d: Doc<T>) => boolean, serverWhere?: ServerWhere[]): () => void
}

export interface Store {
  mode: 'demo' | 'firebase'
  col<T>(name: string): Collection<T>
}

/** Lazily built singleton — demo (localStorage) or Firebase (Firestore). */
let instance: Store | null = null

export async function getStore(): Promise<Store> {
  if (instance) return instance
  if (backendMode === 'firebase') {
    const m = await import('./storeFirebase')
    instance = m.createFirebaseStore()
  } else {
    const m = await import('./storeDemo')
    instance = m.createDemoStore()
  }
  return instance
}

/** Synchronous access after getStore() has resolved once (guaranteed by app bootstrap). */
export function store(): Store {
  if (!instance) throw new Error('store not initialized — await getStore() first')
  return instance
}
