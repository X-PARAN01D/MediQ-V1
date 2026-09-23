import { initializeApp } from 'firebase/app'
import {
  getFirestore, collection as fsCol, doc as fsDoc, getDoc, getDocs, addDoc,
  setDoc, updateDoc, deleteDoc, deleteField, onSnapshot, query, where, limit as fsLimit,
  type QueryConstraint,
} from 'firebase/firestore'
import { firebaseConfig } from './config'
import type { Store, Collection, Doc, ServerWhere } from './store'

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
export { db as firestore, app as firebaseApp }

/**
 * Call a Firebase callable Cloud Function by name.
 * Used for server-side work the client must not do directly:
 * atomic token issuance, SAATHI (server Gemini key), notifications.
 */
export async function callFn<T>(name: string, data: unknown): Promise<T> {
  const { getFunctions, httpsCallable } = await import('firebase/functions')
  const fns = getFunctions(app)
  const fn = httpsCallable(fns, name)
  const res: any = await fn(data)
  return res.data as T
}

function constraints(serverWhere?: ServerWhere[]): QueryConstraint[] {
  const cs: QueryConstraint[] = []
  for (const w of serverWhere || []) {
    cs.push(where(w.field, w.op as any, w.value))
  }
  // NOTE: no orderBy here. Equality-only where clauses are served by Firestore's
  // index merging with no composite index; adding orderBy would require one.
  // Results are sorted client-side below.
  cs.push(fsLimit(500))
  return cs
}

function sortRecent<T>(docs: Doc<T>[]): Doc<T>[] {
  return docs.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
}

function collection<T>(name: string): Collection<T> {
  const ref = fsCol(db, name)
  const toDoc = (id: string, data: any): Doc<T> => ({ ...data, id } as Doc<T>)
  return {
    async list(filter, serverWhere) {
      const snap = await getDocs(query(ref, ...constraints(serverWhere)))
      const docs = sortRecent(snap.docs.map(d => toDoc(d.id, d.data())))
      return filter ? docs.filter(filter) : docs
    },
    async get(id) {
      const snap = await getDoc(fsDoc(db, name, id))
      return snap.exists() ? toDoc(snap.id, snap.data()) : null
    },
    async create(data: Omit<T, 'id'>) {
      const r = await addDoc(ref, data as any)
      return toDoc(r.id, data)
    },
    async set(id, data: Omit<T, 'id'>) {
      await setDoc(fsDoc(db, name, id), data as any)
      return toDoc(id, data)
    },
    async update(id, patch) {
      // Firestore rejects `undefined` values — translate them to field deletions.
      const clean: Record<string, any> = {}
      for (const [k, v] of Object.entries(patch as Record<string, any>)) {
        clean[k] = v === undefined ? deleteField() : v
      }
      await updateDoc(fsDoc(db, name, id), clean)
    },
    async remove(id) {
      await deleteDoc(fsDoc(db, name, id))
    },
    subscribe(cb, filter, serverWhere) {
      return onSnapshot(query(ref, ...constraints(serverWhere)), snap => {
        const docs = sortRecent(snap.docs.map(d => toDoc(d.id, d.data())))
        cb(filter ? docs.filter(filter) : docs)
      })
    },
  }
}

export function createFirebaseStore(): Store {
  return { mode: 'firebase', col: <T,>(name: string) => collection<T>(name) }
}
