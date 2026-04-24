import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Navbar from './components/Navbar'
import CategoryTreePage from './pages/CategoryTreePage'
import BrandAnalyticsPage from './pages/BrandAnalyticsPage'
import ScoringPage from './pages/ScoringPage'
import SettingsPage from './pages/SettingsPage'
import PnLPage from './pages/PnLPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

function PlaceholderPage({ title, icon }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 28px', color: 'var(--text3)' }}>
      <p style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</p>
      <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text2)' }}>{title}</p>
      <p style={{ fontSize: '14px', marginTop: '6px' }}>Раздел в разработке</p>
    </div>
  )
}

function AppLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <Navbar />
      <main style={{ flex: 1, padding: '28px' }}>{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/" element={
          <PrivateRoute>
            <AppLayout>
              <Navigate to="/categories" replace />
            </AppLayout>
          </PrivateRoute>
        } />
        <Route path="/categories" element={
          <PrivateRoute><AppLayout><CategoryTreePage /></AppLayout></PrivateRoute>
        } />
        <Route path="/scoring" element={
          <PrivateRoute><AppLayout><ScoringPage /></AppLayout></PrivateRoute>
        } />
        <Route path="/brands" element={
          <PrivateRoute><AppLayout><BrandAnalyticsPage /></AppLayout></PrivateRoute>
        } />
        <Route path="/pnl" element={
          <PrivateRoute><AppLayout><PnLPage /></AppLayout></PrivateRoute>
        } />
        <Route path="/settings" element={
          <PrivateRoute><AppLayout><SettingsPage /></AppLayout></PrivateRoute>
        } />
        <Route path="/funnel" element={
          <PrivateRoute><AppLayout><PlaceholderPage title="Воронка продаж" icon="🎯" /></AppLayout></PrivateRoute>
        } />
        <Route path="/hypotheses" element={
          <PrivateRoute><AppLayout><PlaceholderPage title="Гипотезы" icon="💡" /></AppLayout></PrivateRoute>
        } />
      </Routes>
    </AuthProvider>
  )
}
