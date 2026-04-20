import React, { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { fetchOzonConfig } from '../api/client'

const NAV = [
  { to: '/categories', label: 'Категории' },
  { to: '/scoring',    label: 'Скоринг'   },
  { to: '/pnl',        label: 'P&L'       },
  { to: '/funnel',     label: 'Воронка'   },
  { to: '/hypotheses', label: 'Гипотезы'  },
]

const PAGE_ACTIONS = {
  '/pnl':        'Загрузить P&L',
  '/scoring':    'Рассчитать',
  '/categories': 'Найти категорию',
}

export default function Navbar() {
  const location = useLocation()
  const navigate  = useNavigate()
  const [seller,    setSeller]    = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    fetchOzonConfig()
      .then(cfg => {
        if (cfg.connected) {
          setSeller(cfg.seller_name || cfg.client_id || 'Мой магазин')
          setConnected(true)
        } else {
          setSeller('Мой магазин')
        }
      })
      .catch(() => { setSeller('Мой магазин') })
  }, [])

  const action = PAGE_ACTIONS[location.pathname]

  const linkStyle = isActive => ({
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    textDecoration: 'none',
    color: isActive ? 'var(--text1)' : 'var(--text2)',
    background: isActive ? 'var(--glass)' : 'transparent',
    border: `1px solid ${isActive ? 'var(--glass-border)' : 'transparent'}`,
    transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)',
    whiteSpace: 'nowrap',
  })

  return (
    <header style={{
      height: '52px',
      background: 'rgba(0,0,0,0.72)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderBottom: '1px solid var(--glass-border)',
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center',
      padding: '0 28px', gap: '24px',
    }}>

      {/* Logo */}
      <NavLink to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font)', fontSize: '16px', fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
          OCF<span style={{ color: 'var(--blue)' }}>.</span>
        </span>
      </NavLink>

      {/* Nav links */}
      <nav style={{ display: 'flex', gap: '2px', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {NAV.map(({ to, label }) => (
          <NavLink key={to} to={to}
            style={({ isActive }) => linkStyle(isActive)}
            onMouseEnter={e => { if (!e.currentTarget.style.border.includes('glass-border') || e.currentTarget.style.background === 'transparent') { e.currentTarget.style.color = 'var(--text1)'; e.currentTarget.style.background = 'var(--glass)' } }}
            onMouseLeave={e => { const isActive = location.pathname === to; if (!isActive) { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'transparent' } }}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>

        {/* Store pill — always visible, shows "Мой магазин" until loaded */}
        <div
          onClick={() => navigate('/settings')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'var(--glass)', border: '1px solid var(--glass-border)',
            borderRadius: '20px', padding: '5px 14px',
            fontSize: '13px', color: 'var(--text1)', fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--glass-border-md)'; e.currentTarget.style.background = 'var(--glass-md)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)';    e.currentTarget.style.background = 'var(--glass)'    }}
        >
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%', display: 'block', flexShrink: 0,
            background: connected ? 'var(--green)' : 'var(--text3)',
            animation: connected ? 'pulse 2.5s ease-in-out infinite' : 'none',
          }} />
          <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {seller ?? 'Мой магазин'}
          </span>
        </div>

        {/* Settings button */}
        <button
          onClick={() => navigate('/settings')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '7px 10px', borderRadius: '10px',
            background: 'var(--glass)', border: '1px solid var(--glass-border)',
            color: location.pathname === '/settings' ? 'var(--text1)' : 'var(--text2)',
            cursor: 'pointer', fontSize: '16px', lineHeight: 1,
            transition: 'all 0.2s', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text1)'; e.currentTarget.style.background = 'var(--glass-md)' }}
          onMouseLeave={e => {
            e.currentTarget.style.color = location.pathname === '/settings' ? 'var(--text1)' : 'var(--text2)'
            e.currentTarget.style.background = 'var(--glass)'
          }}
          title="Настройки"
        >
          ⚙
        </button>

        {/* Contextual action button */}
        {action && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('ocf:action'))}
            style={{
              background: 'var(--blue)', color: 'white', border: 'none',
              borderRadius: '20px', padding: '7px 18px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font)', transition: 'filter 0.2s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
          >
            {action}
          </button>
        )}
      </div>
    </header>
  )
}
