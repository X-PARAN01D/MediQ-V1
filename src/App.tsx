import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { JSX } from 'react'
import { useAuth } from './auth/AuthContext'
import { AppShell, PlainShell } from './components/layout'
import { Spinner } from './components/ui'
import type { Role } from './lib/types'

import Landing from './pages/Landing'
import Auth from './pages/Auth'
import FinishLogin from './pages/auth/FinishLogin'
import Saathi from './pages/Saathi'
import Consult from './pages/Consult'
import Emergency from './pages/Emergency'
import NotFound from './pages/NotFound'

import Home from './pages/patient/Home'
import Intake from './pages/patient/Intake'
import TriageResult from './pages/patient/TriageResult'
import Tokens from './pages/patient/Tokens'
import Doctors from './pages/patient/Doctors'
import DoctorProfile from './pages/patient/DoctorProfile'
import Appointments from './pages/patient/Appointments'
import Records from './pages/patient/Records'
import Messages from './pages/patient/Messages'
import Profile from './pages/patient/Profile'

import DoctorDashboard from './pages/doctor/Dashboard'
import DoctorQueue from './pages/doctor/Queue'
import TriageDetail from './pages/doctor/TriageDetail'
import VerifyStatus from './pages/doctor/VerifyStatus'
import DoctorProfilePage from './pages/doctor/Profile'

import AdminDashboard from './pages/admin/Dashboard'
import VerifyQueue from './pages/admin/VerifyQueue'
import Analytics from './pages/admin/Analytics'

function roleHome(role: Role): string {
  return role === 'doctor' ? '/doctor' : role === 'admin' ? '/admin' : '/home'
}

function RequireAuth({ roles, children }: { roles: Role[]; children: JSX.Element }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <PlainShell><Spinner /></PlainShell>
  if (!user) return <Navigate to="/auth" state={{ from: loc.pathname }} replace />
  if (!roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />
  return <AppShell>{children}</AppShell>
}

function Root() {
  const { user, loading } = useAuth()
  if (loading) return <PlainShell><Spinner /></PlainShell>
  if (!user) return <PlainShell><Landing /></PlainShell>
  return <Navigate to={roleHome(user.role)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/auth" element={<PlainShell><Auth /></PlainShell>} />
      <Route path="/auth/finish" element={<PlainShell><FinishLogin /></PlainShell>} />

      {/* patient */}
      <Route path="/home" element={<RequireAuth roles={['patient']}><Home /></RequireAuth>} />
      <Route path="/intake" element={<RequireAuth roles={['patient']}><Intake /></RequireAuth>} />
      <Route path="/triage/:id" element={<RequireAuth roles={['patient']}><TriageResult /></RequireAuth>} />
      <Route path="/tokens" element={<RequireAuth roles={['patient']}><Tokens /></RequireAuth>} />
      <Route path="/doctors" element={<RequireAuth roles={['patient']}><Doctors /></RequireAuth>} />
      <Route path="/doctors/:id" element={<RequireAuth roles={['patient']}><DoctorProfile /></RequireAuth>} />
      <Route path="/appointments" element={<RequireAuth roles={['patient']}><Appointments /></RequireAuth>} />
      <Route path="/records" element={<RequireAuth roles={['patient']}><Records /></RequireAuth>} />
      <Route path="/messages" element={<RequireAuth roles={['patient', 'doctor', 'admin']}><Messages /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth roles={['patient', 'doctor', 'admin']}><Profile /></RequireAuth>} />
      <Route path="/saathi" element={<RequireAuth roles={['patient']}><Saathi /></RequireAuth>} />
      <Route path="/emergency" element={<RequireAuth roles={['patient']}><Emergency /></RequireAuth>} />
      <Route path="/consult/:tokenId" element={<RequireAuth roles={['patient', 'doctor']}><Consult /></RequireAuth>} />

      {/* doctor */}
      <Route path="/doctor" element={<RequireAuth roles={['doctor']}><DoctorDashboard /></RequireAuth>} />
      <Route path="/doctor/queue" element={<RequireAuth roles={['doctor']}><DoctorQueue /></RequireAuth>} />
      <Route path="/doctor/triage/:id" element={<RequireAuth roles={['doctor']}><TriageDetail /></RequireAuth>} />
      <Route path="/doctor/verify" element={<RequireAuth roles={['doctor']}><VerifyStatus /></RequireAuth>} />
      <Route path="/doctor/profile" element={<RequireAuth roles={['doctor']}><DoctorProfilePage /></RequireAuth>} />

      {/* admin */}
      <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/verify" element={<RequireAuth roles={['admin']}><VerifyQueue /></RequireAuth>} />
      <Route path="/admin/analytics" element={<RequireAuth roles={['admin']}><Analytics /></RequireAuth>} />

      <Route path="*" element={<PlainShell><NotFound /></PlainShell>} />
    </Routes>
  )
}
