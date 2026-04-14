import React from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import CategoryTreePage from './pages/CategoryTreePage'
import BrandAnalyticsPage from './pages/BrandAnalyticsPage'
import ScoringPage from './pages/ScoringPage'
import SettingsPage from './pages/SettingsPage'
import PnLPage from './pages/PnLPage'

const NAV = [
  { to: '/categories', label: 'Категории' },
  { to: '/scoring',    label: 'Скоринг' },
  { to: '/brands',     label: 'Аналитика бренда' },
  { to: '/pnl',        label: 'P&L' },
  { to: '/settings',   label: 'Настройки' },
]

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-8">
          <span className="font-bold text-blue-600 text-lg tracking-tight select-none">
            OCF
          </span>
          <nav className="flex gap-1">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ` +
                  (isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100')
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/categories" replace />} />
          <Route path="/categories" element={<CategoryTreePage />} />
          <Route path="/scoring"    element={<ScoringPage />} />
          <Route path="/brands"     element={<BrandAnalyticsPage />} />
          <Route path="/pnl"        element={<PnLPage />} />
          <Route path="/settings"   element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
