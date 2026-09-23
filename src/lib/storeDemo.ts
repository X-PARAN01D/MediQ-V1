import type { Store, Collection, Doc, ServerWhere } from './store'
import { uid, type User, type AppNotification } from './types'

const KEY = 'mediq-db-v1'
type DB = Record<string, any>

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* corrupted — reseed */ }
  return {}
}
function save(db: DB) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* quota — keep in memory */ }
}

const listeners = new Map<string, Set<(docs: any[]) => void>>()

function emit(name: string) {
  const db = load()
  const docs = Object.values(db[name] || {})
  listeners.get(name)?.forEach(cb => { try { cb(docs) } catch { /* noop */ } })
}

function seed(db: DB): DB {
  if (db._seeded) return db
  const now = Date.now()
  const doctors: User[] = [
    {
      id: 'doc_anjali', role: 'doctor', name: 'Dr. Anjali Deshmukh', phone: '919820000001',
      specialization: 'General Physician', clinic: 'Rural Hospital, Shirur', experience: 12,
      fee: 200, languages: ['Marathi', 'Hindi', 'English'], qualifications: 'MBBS, MD (Medicine)',
      bio: 'Serving rural communities around Shirur for over a decade, with focus on diabetes, hypertension and infectious diseases.',
      availability: 'Mon–Sat · 9:00 AM – 1:00 PM', verification: 'approved', verified: true, createdAt: now,
    },
    {
      id: 'doc_rahul', role: 'doctor', name: 'Dr. Rahul Patil', phone: '919820000002',
      specialization: 'Pediatrician', clinic: 'PHC, Ranjangaon', experience: 8,
      fee: 250, languages: ['Marathi', 'Hindi', 'English'], qualifications: 'MBBS, DCH',
      bio: 'Child health, immunization and nutrition. Runs the weekly well-baby clinic at Ranjangaon PHC.',
      availability: 'Mon–Fri · 10:00 AM – 2:00 PM', verification: 'approved', verified: true, createdAt: now,
    },
    {
      id: 'doc_sunita', role: 'doctor', name: 'Dr. Sunita Pawar', phone: '919820000003',
      specialization: 'Gynecologist', clinic: 'Civil Hospital, Baramati', experience: 15,
      fee: 300, languages: ['Marathi', 'Hindi'], qualifications: 'MBBS, MS (OBGY)',
      bio: 'Antenatal care, safe deliveries and women\u2019s health. Conducts monthly outreach camps.',
      availability: 'Tue, Thu, Sat · 11:00 AM – 3:00 PM', verification: 'approved', verified: true, createdAt: now,
    },
    {
      id: 'doc_vikram', role: 'doctor', name: 'Dr. Vikram Shinde', phone: '919820000004',
      specialization: 'Orthopedic', clinic: 'Rural Hospital, Daund', experience: 10,
      fee: 300, languages: ['Marathi', 'English'], qualifications: 'MBBS, MS (Ortho)',
      bio: 'Fractures, joint pain and sports injuries. Tele-follow-ups for post-operative patients.',
      availability: 'Mon, Wed, Fri · 9:00 AM – 12:00 PM', verification: 'approved', verified: true, createdAt: now,
    },
    {
      id: 'doc_meera', role: 'doctor', name: 'Dr. Meera Kulkarni', phone: '919820000005',
      specialization: 'Dermatologist', clinic: 'Skin Care Clinic, Pune', experience: 7,
      fee: 350, languages: ['Hindi', 'English', 'Marathi'], qualifications: 'MBBS, DVD',
      bio: 'Skin infections, allergies and chronic dermatitis — common in farm-worker communities.',
      availability: 'Mon–Sat · 4:00 PM – 7:00 PM', verification: 'approved', verified: true, createdAt: now,
    },
    {
      id: 'doc_amit', role: 'doctor', name: 'Dr. Amit Joshi', phone: '919820000006',
      specialization: 'General Physician', clinic: 'PHC, Kedgaon', experience: 5,
      fee: 150, languages: ['Marathi', 'Hindi'], qualifications: 'MBBS',
      bio: 'Primary care for everyday illness — fever, cough, stomach issues and lifestyle counselling.',
      availability: 'Mon–Sat · 9:00 AM – 5:00 PM', verification: 'approved', verified: true, createdAt: now,
    },
    {
      id: 'doc_pending1', role: 'doctor', name: 'Dr. Kavita Nair', phone: '919820000007',
      specialization: 'General Physician', clinic: 'PHC, Yavat', experience: 6,
      fee: 200, languages: ['Marathi', 'English'], qualifications: 'MBBS',
      bio: 'Awaiting document verification.', availability: 'Mon–Fri · 10:00 AM – 4:00 PM',
      verification: 'pending', verified: false, createdAt: now,
    },
  ]
  db.users = {}
  doctors.forEach(d => { db.users[d.id] = d })
  db.users['admin_1'] = {
    id: 'admin_1', role: 'admin', name: 'MediQ Admin', email: 'admin@mediq.in',
    phone: '919820000099', createdAt: now,
  } as User
  db.tokens = {}
  db.triages = {}
  db.prescriptions = {}
  db.appointments = {}
  db.emergency = {}
  db.audit = {}
  db.notifications = {}
  const welcome: AppNotification = {
    id: uid('ntf'), userId: 'admin_1', title: 'Welcome to MediQ',
    body: 'Demo data is loaded. Sign in as a patient to try triage, tokens and SAATHI.',
    channel: 'inapp', read: false, createdAt: now,
  }
  db.notifications[welcome.id] = welcome
  db._seeded = true
  save(db)
  return db
}

function matchesWhere(d: any, w: ServerWhere[]): boolean {
  return w.every(({ field, op, value }) => {
    const v = d[field]
    switch (op) {
      case '==': return v === value
      case 'in': return Array.isArray(value) && value.includes(v)
      case '>=': return v >= (value as any)
      case '<=': return v <= (value as any)
      case 'array-contains': return Array.isArray(v) && v.includes(value)
      default: return true
    }
  })
}

function collection<T>(name: string): Collection<T> {
  const read = (): Doc<T>[] => {
    const db = seed(load())
    return Object.values(db[name] || {}) as Doc<T>[]
  }
  const write = (mut: (table: Record<string, any>) => void) => {
    const db = seed(load())
    if (!db[name]) db[name] = {}
    mut(db[name])
    save(db)
    emit(name)
  }
  return {
    async list(filter, serverWhere) {
      let docs = read().sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
      if (serverWhere?.length) docs = docs.filter(d => matchesWhere(d, serverWhere))
      return filter ? docs.filter(filter) : docs
    },
    async get(id) {
      const db = seed(load())
      return (db[name]?.[id] as Doc<T>) || null
    },
    async create(data: Omit<T, 'id'>) {
      const id = uid(name.slice(0, 3))
      const doc = { ...data, id } as Doc<T>
      write(t => { t[id] = doc })
      return doc
    },
    async set(id, data: Omit<T, 'id'>) {
      const doc = { ...data, id } as Doc<T>
      write(t => { t[id] = doc })
      return doc
    },
    async update(id, patch) {
      write(t => { if (t[id]) t[id] = { ...t[id], ...patch } })
    },
    async remove(id) {
      write(t => { delete t[id] })
    },
    subscribe(cb, filter, serverWhere) {
      const run = () => {
        let docs = read()
        if (serverWhere?.length) docs = docs.filter(d => matchesWhere(d, serverWhere))
        cb(filter ? docs.filter(filter) : docs)
      }
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name)!.add(run)
      run()
      return () => { listeners.get(name)?.delete(run) }
    },
  }
}

export function createDemoStore(): Store {
  seed(load())
  return { mode: 'demo', col: <T,>(name: string) => collection<T>(name) }
}
