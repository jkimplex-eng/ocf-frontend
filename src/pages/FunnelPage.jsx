import React, { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { fetchFunnelSummary } from '../api/client'

// ── Formatters ────────────────────────────────────────────────────────────────
const num  = v => v == null ? '—' : Number(v).toLocaleString('ru')
const pct  = v => v == null ? '—' : `${Number(v).toFixed(1)}%`
const rub  = v => {
  if (v == null) return '—'
  const n = Number(v)
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`
  if (Math.abs(n) >= 1_000)     return `${Math.round(n / 1_000)} тыс ₽`
  return `${Math.round(n)} ₽`
}
const shortDate = s => s ? s.slice(5).replace('-', '.') : ''

// ── Date utils ────────────────────────────────────────────────────────────────
function isoDate(d) { return d.toISOString().slice(0, 10) }
function preset(days) {
  const end   = new Date()
  const start = new Date(+end - days * 86_400_000)
  return [isoDate(start), isoDate(end)]
}
function thisMonth() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return [isoDate(start), isoDate(now)]
}

// ── Step colors ───────────────────────────────────────────────────────────────
const STEP_COLORS = {
  views:     '#409cff',
  pdp:       '#5ac8fa',
  cart:      '#ffd60a',
  orders:    '#30d158',
  delivered: '#0071e3',
}

const STEP_ICONS = {
  views:     '👁',
  pdp:       '🖱',
  cart:      '🛒',
  orders:    '📦',
  delivered: '✅',
}

// ── FunnelBar component ───────────────────────────────────────────────────────
function FunnelBar({ step, maxValue, index, total }) {
  const widthPct = maxValue > 0 ? Math.max(8, (step.value / maxValue) * 100) : 8
  const color    = STEP_COLORS[step.key] || 'var(--blue)'
  const icon     = STEP_ICONS[step.key]  || '•'
  const isLast   = index === total - 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
        {/* Label */}
        <div style={{ width: '110px', flexShrink: 0, textAlign: 'right' }}>
          <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 500 }}>
            {icon} {step.step}
          </span>
        </div>

        {/* Bar */}
        <div style={{ flex: 1, position: 'relative', height: '36px', display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: `${widthPct}%`,
            height: '36px',
            background: `linear-gradient(90deg, ${color}33, ${color}88)`,
            border: `1px solid ${color}66`,
            borderRadius: '6px',
            display: 'flex', alignItems: 'center',
            paddingLeft: '12px',
            transition: 'width 0.4s ease',
            minWidth: '80px',
          }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              {num(step.value)}
            </span>
          </div>
          <span style={{ marginLeft: '10px', fontSize: '12px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
            {index === 0 ? '100%' : `${step.conv_from_top}% от показов`}
          </span>
        </div>
      </div>

      {/* Arrow + conversion between steps */}
      {!isLast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 0 0 122px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text3)', fontSize: '12px' }}>
            <span style={{ fontSize: '10px' }}>↓</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: step.conv_from_prev > 50 ? 'var(--green)' : step.conv_from_prev > 20 ? 'var(--amber)' : 'var(--red)' }}>
              {pct(step.conv_from_prev)} конверсия
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--glass)', border: '1px solid var(--glass-border)',
      borderRadius: '14px', padding: '16px 20px', flex: 1, minWidth: '140px',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 500, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: color || 'var(--text1)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>{sub}</div>
      )}
    </div>
  )
}

// ── Custom tooltip for chart ──────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--glass-border)',
      borderRadius: '10px', padding: '10px 14px', fontSize: '12px',
    }}>
      <div style={{ color: 'var(--text2)', marginBottom: '6px' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: '2px' }}>
          {p.name}: <strong style={{ fontFamily: 'var(--font-mono)' }}>{num(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FunnelPage() {
  const [dateFrom, setDateFrom] = useState(() => preset(30)[0])
  const [dateTo,   setDateTo]   = useState(() => preset(30)[1])
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [skuSort,  setSkuSort]  = useState('orders')
  const [tab,      setTab]      = useState('funnel')

  const PRESETS = [
    { label: '7 дн',   action: () => { const [f, t] = preset(7);  setDateFrom(f); setDateTo(t) } },
    { label: '30 дн',  action: () => { const [f, t] = preset(30); setDateFrom(f); setDateTo(t) } },
    { label: '90 дн',  action: () => { const [f, t] = preset(90); setDateFrom(f); setDateTo(t) } },
    { label: 'Месяц',  action: () => { const [f, t] = thisMonth(); setDateFrom(f); setDateTo(t) } },
  ]

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchFunnelSummary(dateFrom, dateTo)
      setData(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    const handler = () => load()
    window.addEventListener('ocf:action', handler)
    return () => window.removeEventListener('ocf:action', handler)
  }, [load])

  const maxValue = data?.funnel?.[0]?.value || 1

  const sortedSkus = data
    ? [...data.by_sku].sort((a, b) => (b[skuSort] ?? 0) - (a[skuSort] ?? 0))
    : []

  const SKU_COLS = [
    { key: 'name',        label: 'Товар',         fmt: v => v },
    { key: 'views',       label: 'Показы',        fmt: num },
    { key: 'pdp',         label: 'Просмотры',     fmt: num },
    { key: 'ctr',         label: 'CTR',            fmt: pct },
    { key: 'cart',        label: 'Корзина',        fmt: num },
    { key: 'cart_rate',   label: 'В корз.%',       fmt: pct },
    { key: 'orders',      label: 'Заказы',         fmt: num },
    { key: 'order_rate',  label: 'Заказ%',         fmt: pct },
    { key: 'delivered',   label: 'Выкуп',          fmt: num },
    { key: 'buyout_rate', label: 'Выкуп%',         fmt: pct },
    { key: 'revenue',     label: 'Выручка',        fmt: rub },
  ]

  const TABS = ['funnel', 'dynamics', 'by_sku']
  const TAB_LABELS = { funnel: 'Воронка', dynamics: 'Динамика', by_sku: 'По товарам' }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text1)' }}>
          Воронка продаж
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '4px' }}>
          Показы → Просмотры карточки → Корзина → Заказы → Выкуп
        </p>
      </div>

      {/* Date controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={p.action} style={{
            background: 'var(--glass)', border: '1px solid var(--glass-border)',
            color: 'var(--text2)', borderRadius: '8px', padding: '6px 14px',
            fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)',
          }}>
            {p.label}
          </button>
        ))}
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{
          background: 'var(--bg2)', border: '1px solid var(--glass-border)',
          color: 'var(--text1)', borderRadius: '8px', padding: '6px 10px',
          fontSize: '13px', fontFamily: 'var(--font)',
        }} />
        <span style={{ color: 'var(--text3)' }}>—</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{
          background: 'var(--bg2)', border: '1px solid var(--glass-border)',
          color: 'var(--text1)', borderRadius: '8px', padding: '6px 10px',
          fontSize: '13px', fontFamily: 'var(--font)',
        }} />
        <button onClick={load} disabled={loading} style={{
          background: 'var(--blue)', color: 'white', border: 'none',
          borderRadius: '20px', padding: '7px 20px',
          fontSize: '13px', fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
          fontFamily: 'var(--font)', opacity: loading ? 0.7 : 1,
        }}>
          {loading ? 'Загрузка…' : 'Загрузить'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.3)',
          borderRadius: '12px', padding: '14px 18px', marginBottom: '20px',
          color: 'var(--red)', fontSize: '13px',
        }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div style={{
          textAlign: 'center', padding: '80px 28px',
          background: 'var(--glass)', border: '1px solid var(--glass-border)',
          borderRadius: '18px', color: 'var(--text3)',
        }}>
          <p style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</p>
          <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text2)' }}>Выберите период и нажмите «Загрузить»</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Данные из Ozon Analytics API</p>
        </div>
      )}

      {/* Data */}
      {data && (
        <>
          {/* KPI summary */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <KpiCard label="Показы"      value={num(data.summary.views)}     color={STEP_COLORS.views} />
            <KpiCard label="Просмотры"   value={num(data.summary.pdp)}       color={STEP_COLORS.pdp}   sub={`CTR ${pct(data.summary.ctr)}`} />
            <KpiCard label="Корзина"     value={num(data.summary.cart)}      color={STEP_COLORS.cart}  sub={`${pct(data.summary.cart_rate)} от просмотров`} />
            <KpiCard label="Заказы"      value={num(data.summary.orders)}    color={STEP_COLORS.orders} sub={`${pct(data.summary.order_rate)} из корзины`} />
            <KpiCard label="Выкуп"       value={num(data.summary.delivered)} color={STEP_COLORS.delivered} sub={`${pct(data.summary.buyout_rate)} от заказов`} />
            <KpiCard label="Выручка"     value={rub(data.summary.revenue)} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                background: tab === t ? 'var(--glass)' : 'transparent',
                border: `1px solid ${tab === t ? 'var(--glass-border)' : 'transparent'}`,
                color: tab === t ? 'var(--text1)' : 'var(--text2)',
                borderRadius: '8px', padding: '6px 16px',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)',
              }}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Tab: Funnel */}
          {tab === 'funnel' && (
            <div style={{
              background: 'var(--glass)', border: '1px solid var(--glass-border)',
              borderRadius: '18px', padding: '28px 32px',
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 20px', color: 'var(--text1)' }}>
                Воронка конверсий
              </h2>
              {data.funnel.map((step, i) => (
                <FunnelBar
                  key={step.key}
                  step={step}
                  maxValue={maxValue}
                  index={i}
                  total={data.funnel.length}
                />
              ))}
              {data.summary.views === 0 && (
                <p style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '20px', textAlign: 'center' }}>
                  Данные по показам недоступны. Убедитесь, что к магазину подключён Ozon Analytics.
                </p>
              )}
            </div>
          )}

          {/* Tab: Dynamics */}
          {tab === 'dynamics' && (
            <div style={{
              background: 'var(--glass)', border: '1px solid var(--glass-border)',
              borderRadius: '18px', padding: '28px 32px',
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 20px', color: 'var(--text1)' }}>
                Динамика по дням
              </h2>
              {data.by_day.length > 0 ? (
                <>
                  {/* Orders + Delivered chart */}
                  <p style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px' }}>Заказы и выкуп</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.by_day} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} width={40} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text2)' }} />
                      <Line dataKey="orders"    name="Заказы"  stroke={STEP_COLORS.orders}    dot={false} strokeWidth={2} />
                      <Line dataKey="delivered" name="Выкуп"   stroke={STEP_COLORS.delivered}  dot={false} strokeWidth={2} strokeDasharray="4 2" />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Conversion rates chart */}
                  <p style={{ fontSize: '12px', color: 'var(--text3)', margin: '24px 0 8px' }}>Конверсии по дням (%)</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={data.by_day} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} width={40} unit="%" />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text2)' }} />
                      <Line dataKey="ctr"         name="CTR"        stroke={STEP_COLORS.pdp}  dot={false} strokeWidth={1.5} />
                      <Line dataKey="cart_rate"   name="В корзину"  stroke={STEP_COLORS.cart} dot={false} strokeWidth={1.5} />
                      <Line dataKey="buyout_rate" name="Выкуп%"     stroke={STEP_COLORS.delivered} dot={false} strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <p style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                  Нет данных по дням
                </p>
              )}
            </div>
          )}

          {/* Tab: By SKU */}
          {tab === 'by_sku' && (
            <div style={{
              background: 'var(--glass)', border: '1px solid var(--glass-border)',
              borderRadius: '18px', padding: '28px 32px', overflowX: 'auto',
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text1)' }}>
                По товарам ({data.by_sku.length})
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    {SKU_COLS.map(col => (
                      <th
                        key={col.key}
                        onClick={() => col.key !== 'name' && setSkuSort(col.key)}
                        style={{
                          textAlign: col.key === 'name' ? 'left' : 'right',
                          padding: '8px 10px',
                          color: skuSort === col.key ? 'var(--blue)' : 'var(--text3)',
                          fontWeight: 600,
                          borderBottom: '1px solid var(--glass-border)',
                          cursor: col.key !== 'name' ? 'pointer' : 'default',
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                        }}
                      >
                        {col.label}{skuSort === col.key ? ' ↓' : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedSkus.map((row, i) => (
                    <tr key={row.sku_id || i} style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {SKU_COLS.map(col => (
                        <td key={col.key} style={{
                          padding: '9px 10px',
                          textAlign: col.key === 'name' ? 'left' : 'right',
                          color: col.key === 'name' ? 'var(--text1)' : 'var(--text2)',
                          fontFamily: col.key === 'name' ? 'var(--font)' : 'var(--font-mono)',
                          maxWidth: col.key === 'name' ? '220px' : undefined,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {col.fmt(row[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {sortedSkus.length === 0 && (
                    <tr>
                      <td colSpan={SKU_COLS.length} style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
                        Нет данных по товарам
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
