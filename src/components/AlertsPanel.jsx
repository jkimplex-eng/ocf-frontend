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
  critical: { icon: '🔴', border: '#ef4444' },
  warn:     { icon: '🟡', border: '#f59e0b' },
  good:     { icon: '🟢', border: '#22c55e' },
}

export default function AlertsPanel({ data }) {
  const [dismissed, setDismissed] = useState(new Set())

  const allAlerts = useMemo(() => {
    const list = []
    const s    = data.summary
    const skus = data.by_sku  || []
    const days = data.by_day  || []

    const lossSkus = skus.filter(r => r.profit < 0)
    if (lossSkus.length > 0)
      list.push({ id: 'loss-sku', type: 'critical',
        text: `${lossSkus.length} SKU с отрицательной маржой` })

    if (s.drr > 25)
      list.push({ id: 'drr-high', type: 'critical',
        text: `ДРР ${pct(s.drr)} превышает норму 25%` })

    if (!s.ad_spend || Math.abs(s.ad_spend) === 0)
      list.push({ id: 'no-ads', type: 'warn',
        text: 'Реклама не подключена — данные неполные' })

    const noCogs = skus.filter(r => !r.cost_per_unit)
    if (noCogs.length > 0)
      list.push({ id: 'no-cogs', type: 'warn',
        text: `${noCogs.length} SKU без себестоимости — прибыль завышена` })

    if (days.length >= 7) {
      const margins = days.map(d => d.margin_pct).filter(m => m != null && !isNaN(m))
      if (margins.length >= 7 && linearTrend(margins).slope < -0.05)
        list.push({ id: 'margin-trend', type: 'warn',
          text: 'Маржа снижается — тренд отрицательный за период' })
    }

    const buyout = s.buyout_pct ?? s.buyout
    if (buyout != null && buyout > 70)
      list.push({ id: 'buyout-good', type: 'good',
        text: `Выкуп ${pct(buyout)} — выше среднего по рынку (70%)` })

    return list
  }, [data])

  const alerts = allAlerts.filter(a => !dismissed.has(a.id))
  if (alerts.length === 0) return null

  return (
    <div style={{
      display: 'flex', gap: '8px', overflowX: 'auto',
      padding: '4px 0 8px 0', scrollbarWidth: 'thin',
    }}>
      {alerts.map(alert => {
        const cfg = TYPE[alert.type]
        return (
          <div key={alert.id} style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderLeft: `3px solid ${cfg.border}`,
            borderRadius: '6px',
            padding: '6px 10px',
            display: 'flex', alignItems: 'center', gap: '6px',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
            animation: 'fadeUp 0.3s ease both',
          }}>
            <span style={{ fontSize: '12px' }}>{cfg.icon}</span>
            <span style={{
              fontSize: '11px', fontFamily: 'monospace',
              color: '#374151', whiteSpace: 'nowrap',
            }}>
              {alert.text}
            </span>
            <button
              onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
              style={{
                marginLeft: '2px', color: '#9ca3af', cursor: 'pointer',
                background: 'none', border: 'none', fontSize: '15px',
                lineHeight: 1, padding: '0 2px', flexShrink: 0,
              }}
              title="Закрыть"
            >×</button>
          </div>
        )
      })}
    </div>
  )
}
