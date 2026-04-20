import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import CategoryTreePage from './pages/CategoryTreePage'
import BrandAnalyticsPage from './pages/BrandAnalyticsPage'
import ScoringPage from './pages/ScoringPage'
import SettingsPage from './pages/SettingsPage'
import PnLPage from './pages/PnLPage'

function PlaceholderPage({ title, icon }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 28px', color: 'var(--text3)' }}>
      <p style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</p>
      <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text2)' }}>{title}</p>
      <p style={{ fontSize: '14px', marginTop: '6px' }}>Раздел в разработке</p>
    </div>
  )
}

export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <Navbar />
      <main style={{ flex: 1, padding: '28px' }}>
        <Routes>
          <Route path="/"           element={<Navigate to="/categories" replace />} />
          <Route path="/categories" element={<CategoryTreePage />} />
          <Route path="/scoring"    element={<ScoringPage />} />
          <Route path="/brands"     element={<BrandAnalyticsPage />} />
          <Route path="/pnl"        element={<PnLPage />} />
          <Route path="/settings"   element={<SettingsPage />} />
          <Route path="/funnel"     element={<PlaceholderPage title="Воронка продаж" icon="🎯" />} />
          <Route path="/hypotheses" element={<PlaceholderPage title="Гипотезы" icon="💡" />} />
        </Routes>
      </main>
    </div>
  )
}
