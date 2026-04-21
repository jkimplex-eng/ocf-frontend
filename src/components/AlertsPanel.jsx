import React, { useState, useMemo } from 'react'

const pct = (v, d = 1) => v == null ? '—' : `${Number(v).toFixed(d)}%`

function linearTrend(arr) {
  const n = arr.length
  if (n < 2) return { slope: 0, intercept: arr[0] ?? 0 }
  const sumX  = arr.reduce((s, _, i) => s + i, 0)
  const sumY  = arr.reduce((s, v) => s + v, 0)
  const sumXY = arr.reduce((s, v, i) => s + i * v, 0)
  const sumX2 = arr.reduce((s, _, i) => s + i * i, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n }
  return {
    slope:     (n * sumXY - sumX * sumY) / denom,
    intercept: (sumY - ((n * sumXY - sumX * sumY) / denom) * sumX) / n,
  }
}

const TYPE = {
  critical: { icon: '⚠', color: 'var(--red)',   bg: 'rgba(255,69,58,0.08)',   border: 'rgba(255,69,58,0.2)'   },
  warn:     { icon: '⚠', color: 'var(--amber)',  bg: 'rgba(255,214,10,0.08)', border: 'rgba(255,214,10,0.2)' },
  good:     { icon: '✓', color: 'var(--green)',  bg: 'rgba(48,209,88,0.08)',  border: 'rgba(48,209,88,0.2)'  },
}

export default function AlertsPanel({ data, perfConnected = false }) {
  const [dismissed, setDismissed] = useState(new Set())

  const allAlerts = useMemo(() => {
    const list = []
    const s    = data.summary
    const skus = data.by_sku || []
    const days = data.by_day || []

    const lossSkus = skus.filter(r => r.profit < 0)
    if (lossSkus.length > 0)
      list.push({ id: 'loss-sku', type: 'critical', text: `${lossSkus.length} SKU с отрицательной маржой` })

    if (s.drr > 25)
      list.push({ id: 'drr-high', type: 'critical', text: `ДРР ${pct(s.drr)} превышает норму 25%` })

    if (!perfConnected && (!s.ad_spend || Math.abs(s.ad_spend) === 0))
      list.push({ id: 'no-ads', type: 'warn', text: 'Реклама не подключена — подключите Performance API в Настройках' })

    const noCogs = skus.filter(r => !r.cost_per_unit)
    if (noCogs.length > 0)
      list.push({ id: 'no-cogs', type: 'warn', text: `${noCogs.length} SKU без себестоимости` })

    if (days.length >= 7) {
      const margins = days.map(d => d.margin_pct).filter(m => m != null && !isNaN(m))
      if (margins.length >= 7 && linearTrend(margins).slope < -0.05)
        list.push({ id: 'margin-trend', type: 'warn', text: 'Маржа снижается — тренд отрицательный' })
    }

    const buyout = s.buyout_pct ?? s.buyout
    if (buyout != null && buyout > 70)
      list.push({ id: 'buyout-good', type: 'good', text: `Выкуп ${pct(buyout)} — выше рынка` })

    return list
  }, [data])

  const alerts = allAlerts.filter(a => !dismissed.has(a.id))
  if (alerts.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '2px 0 8px 0', scrollbarWidth: 'none' }}>
      {alerts.map(alert => {
        const cfg = TYPE[alert.type]
        return (
          <div key={alert.id} style={{
            display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: '12px', padding: '7px 14px',
            animation: 'fadeUp 0.3s ease both',
          }}>
            <span style={{ fontSize: '11px', color: cfg.color, fontWeight: 700, flexShrink: 0 }}>
              {cfg.icon}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: cfg.color, whiteSpace: 'nowrap' }}>
              {alert.text}
            </span>
            <button
              onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
              style={{
                marginLeft: '4px', color: cfg.color, opacity: 0.5, cursor: 'pointer',
                background: 'none', border: 'none', fontSize: '14px',
                lineHeight: 1, padding: '0 2px', flexShrink: 0,
              }}
            >×</button>
          </div>
        )
      })}
    </div>
  )
}
