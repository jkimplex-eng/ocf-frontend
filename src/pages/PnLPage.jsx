import React, { useState, useRef, useMemo } from 'react'
import { fetchPlSummary, fetchCogs, saveCogs } from '../api/client'
import AlertsPanel from '../components/AlertsPanel'

// ── Format ────────────────────────────────────────────────────────────────────
const rub = v => {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)} тыс ₽`
  return `${n.toLocaleString('ru')} ₽`
}
const pct  = (v, d = 1) => v == null ? '—' : `${Number(v).toFixed(d)}%`
const num  = v => v == null ? '—' : Number(v).toLocaleString('ru')
const date = s => s ? s.slice(5).replace('-', '.') : ''

// ── Linear trend (least squares) ──────────────────────────────────────────────
function linearTrend(data) {
  const n = data.length
  if (n < 2) return { slope: 0, intercept: data[0] ?? 0 }
  const sumX  = data.reduce((s, _, i) => s + i, 0)
  const sumY  = data.reduce((s, v) => s + v, 0)
  const sumXY = data.reduce((s, v, i) => s + i * v, 0)
  const sumX2 = data.reduce((s, _, i) => s + i * i, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n }
  const slope     = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

// ── Delta arrow ───────────────────────────────────────────────────────────────
function Arrow({ v }) {
  if (v == null) return <span className="text-gray-300">—</span>
  const up = v >= 0
  return (
    <span className={`text-xs font-semibold whitespace-nowrap ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(v).toFixed(1)}%
    </span>
  )
}

// ── SKU status ────────────────────────────────────────────────────────────────
function skuStatus(row) {
  if (!row.cost_per_unit)
    return { label: 'Нет данных', bg: 'rgba(156,163,175,0.15)', color: '#6b7280', border: '#9ca3af' }
  if (row.profit < 0)
    return { label: 'Убыточный',  bg: 'rgba(239,68,68,0.12)',   color: '#dc2626', border: '#f87171' }
  if (row.margin_pct > 50 && row.units > 50)
    return { label: 'Звезда',     bg: 'rgba(34,197,94,0.12)',   color: '#16a34a', border: '#4ade80' }
  if (row.returns != null && row.revenue > 0 && (row.returns / row.revenue) > 0.15)
    return { label: 'Возвраты',   bg: 'rgba(249,115,22,0.12)',  color: '#ea580c', border: '#fb923c' }
  if (row.margin_pct < 15)
    return { label: 'Под давлением', bg: 'rgba(234,179,8,0.12)', color: '#ca8a04', border: '#fbbf24' }
  return null
}

function SkuStatusBadge({ row }) {
  const s = skuStatus(row)
  if (!s) return <span style={{ fontSize: '10px', color: '#d1d5db', fontFamily: 'monospace' }}>—</span>
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      fontSize: '10px', padding: '1px 5px',
      borderRadius: '9999px', fontFamily: 'monospace',
      whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {s.label}
    </span>
  )
}

// ── KPI strip ─────────────────────────────────────────────────────────────────
function KpiStrip({ s, prev }) {
  function deltaRel(cur, prevVal) {
    if (!prev || prevVal == null || prevVal === 0) return null
    return ((cur - prevVal) / Math.abs(prevVal)) * 100
  }
  function deltaPp(cur, prevVal) {
    if (!prev || prevVal == null) return null
    return cur - prevVal
  }

  const items = [
    { label: 'Выручка',   val: rub(s.revenue),    cls: 'text-blue-700',
      d: deltaRel(s.revenue, prev?.revenue) },
    { label: 'Комиссия',  val: rub(s.commission),  cls: 'text-gray-700',   d: null },
    { label: 'Логистика', val: rub(s.logistics),   cls: 'text-gray-700',   d: null },
    { label: 'Возвраты',  val: rub(s.returns),     cls: 'text-gray-700',   d: null },
    { label: 'Себест.',   val: rub(-s.cogs),       cls: 'text-gray-700',   d: null },
    { label: 'Реклама',   val: rub(-s.ad_spend),   cls: 'text-purple-700', d: null },
    {
      label: 'Прибыль', val: rub(s.profit),
      cls:   s.profit >= 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold',
      d: deltaRel(s.profit, prev?.profit),
    },
    {
      label: 'Маржа', val: pct(s.margin_pct),
      cls: s.margin_pct >= 15 ? 'text-green-700' : s.margin_pct >= 0 ? 'text-yellow-700' : 'text-red-600',
      d: deltaPp(s.margin_pct, prev?.margin_pct), isPp: true,
    },
    { label: 'ДРР',    val: pct(s.drr),           cls: 'text-purple-700',
      d: deltaRel(s.drr, prev?.drr) },
    { label: 'Продаж', val: num(s.units) + ' шт', cls: 'text-gray-700',
      d: deltaRel(s.units, prev?.units) },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {items.map(({ label, val, cls, d, isPp }) => (
        <div key={label} className="card px-3 py-2.5">
          <p className="text-xs text-gray-400">{label}</p>
          <p className={`text-sm mt-0.5 tabular-nums ${cls}`}>{val}</p>
          {d != null && (
            <div className="mt-0.5">
              {isPp
                ? <span className={`text-xs font-semibold ${d >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)} п.п.
                  </span>
                : <Arrow v={d} />}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── COGS editor ───────────────────────────────────────────────────────────────
function CogsEditor({ skus, onSaved }) {
  const [vals,   setVals]   = useState(() =>
    Object.fromEntries(skus.map(s => [s.sku_id, String(s.cost_per_unit ?? s.cost ?? 0)]))
  )
  const [saving, setSaving] = useState(false)
  const [flash,  setFlash]  = useState(false)

  async function save() {
    setSaving(true)
    try {
      const items = skus.map(s => ({
        sku_id: s.sku_id, name: s.name || '',
        cost: parseFloat(vals[s.sku_id] || 0),
      }))
      await saveCogs(items)
      setFlash(true)
      setTimeout(() => setFlash(false), 2000)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  if (!skus.length) return (
    <p className="text-sm text-gray-400 py-4 text-center">
      Загрузите P&amp;L — SKU из транзакций появятся здесь
    </p>
  )

  return (
    <div className="space-y-3">
      <div className="divide-y divide-gray-100">
        {skus.map(s => (
          <div key={s.sku_id} className="flex items-center gap-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{s.name || s.sku_id}</p>
              <p className="text-xs text-gray-400 font-mono">SKU {s.sku_id}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <input type="number" min="0" step="10"
                value={vals[s.sku_id] ?? 0}
                onChange={e => setVals(p => ({ ...p, [s.sku_id]: e.target.value }))}
                className="input text-xs py-1 w-24 text-right"
              />
              <span className="text-xs text-gray-400 w-8">₽/шт</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-gray-400">После сохранения P&amp;L пересчитается автоматически</p>
        <button onClick={save} disabled={saving}
          className={`btn-primary text-xs px-4 py-1.5 disabled:opacity-50 transition-colors
            ${flash ? 'bg-green-600 hover:bg-green-700' : ''}`}>
          {saving ? 'Сохраняем…' : flash ? '✓ Сохранено' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

// ── Waterfall bar ─────────────────────────────────────────────────────────────
function WaterfallBar({ s }) {
  const rev = Math.abs(s.revenue || 0)
  if (!rev) return null

  const safe = (v, negate = false) => {
    const n = negate ? -Number(v || 0) : Number(v || 0)
    return Math.max(0, n)
  }

  const commPct = safe(s.commission) / rev * 100
  const logPct  = safe(s.logistics)  / rev * 100
  const retPct  = safe(s.returns)    / rev * 100
  const adPct   = safe(s.ad_spend, true) / rev * 100   // ad_spend is negative in data
  const cogPct  = safe(s.cogs,     true) / rev * 100   // cogs is negative in data
  const profPct = (s.profit || 0)   / rev * 100

  const segments = [
    { key: 'commission', label: 'Комиссия', pct: commPct, color: 'rgba(239,68,68,0.7)',   amount: safe(s.commission) },
    { key: 'logistics',  label: 'Логистика', pct: logPct, color: 'rgba(245,158,11,0.7)',  amount: safe(s.logistics) },
    { key: 'returns',    label: 'Возвраты',  pct: retPct, color: 'rgba(239,68,68,0.5)',   amount: safe(s.returns) },
    { key: 'ad_spend',   label: 'Реклама',   pct: adPct,  color: 'rgba(99,102,241,0.7)', amount: safe(s.ad_spend, true) },
    { key: 'cogs',       label: 'Себест.',   pct: cogPct, color: 'rgba(20,184,166,0.7)', amount: safe(s.cogs, true) },
    ...(profPct > 0 ? [{
      key: 'profit', label: 'Прибыль', pct: profPct, color: '#22c55e', amount: s.profit,
    }] : []),
  ]

  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Декомпозиция маржи — от выручки к прибыли
      </h3>

      {/* Bar */}
      <div style={{ height: '40px', borderRadius: '8px', overflow: 'hidden', background: '#f3f4f6', display: 'flex' }}>
        {segments.filter(seg => seg.pct > 0).map(seg => (
          <div key={seg.key}
            style={{ width: `${Math.min(seg.pct, 100)}%`, background: seg.color, flexShrink: 0 }}
            title={`${seg.label}: ${seg.pct.toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
        <span className="text-xs flex items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3b82f6', display: 'inline-block' }} />
          <span className="text-blue-700 font-medium">Выручка</span>
          <span className="text-gray-400 font-mono">100%</span>
          <span className="text-gray-400 font-mono">{rub(s.revenue)}</span>
        </span>
        {segments.map(seg => seg.pct > 0.3 && (
          <span key={seg.key} className="text-xs flex items-center gap-1">
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: seg.color, display: 'inline-block' }} />
            <span style={{ color: '#374151' }}>{seg.label}</span>
            <span className="text-gray-500 font-mono">
              {seg.key === 'profit' ? '+' : '-'}{seg.pct.toFixed(1)}%
            </span>
            <span className="text-gray-400 font-mono">{rub(seg.amount)}</span>
          </span>
        ))}
        {profPct <= 0 && (
          <span className="text-xs flex items-center gap-1 text-red-500">
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444', display: 'inline-block' }} />
            <span>Прибыль</span>
            <span className="font-mono">{pct(profPct)}</span>
            <span className="font-mono">{rub(s.profit)}</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ── Insights (comparison) ─────────────────────────────────────────────────────
function InsightsBlock({ curSummary, prevSummary, curSkus, prevSkus }) {
  const insights = useMemo(() => {
    const list = []
    if (prevSummary.revenue && prevSummary.revenue > 0) {
      const revCh = (curSummary.revenue - prevSummary.revenue) / prevSummary.revenue * 100
      if (revCh > 10)  list.push({ type: 'good', text: `Выручка выросла на ${revCh.toFixed(0)}% — сильный рост` })
      if (revCh < -10) list.push({ type: 'bad',  text: `Выручка упала на ${Math.abs(revCh).toFixed(0)}% — требует внимания` })
    }
    if (prevSummary.margin_pct != null) {
      const diff = curSummary.margin_pct - prevSummary.margin_pct
      if (diff < -2) list.push({ type: 'warn',
        text: `Маржа снизилась на ${Math.abs(diff).toFixed(1)} п.п. — рост идёт за счёт низкомаржинальных SKU` })
    }
    return list
  }, [curSummary, prevSummary])

  const skuChanges = useMemo(() => {
    const prevMap = Object.fromEntries((prevSkus || []).map(s => [s.sku_id, s]))
    return (curSkus || [])
      .filter(s => prevMap[s.sku_id] && (prevMap[s.sku_id].revenue || 0) > 0)
      .map(s => ({
        ...s,
        revCh: (s.revenue - prevMap[s.sku_id].revenue) / prevMap[s.sku_id].revenue * 100,
      }))
      .sort((a, b) => b.revCh - a.revCh)
  }, [curSkus, prevSkus])

  const top3up   = skuChanges.slice(0, 3).filter(s => s.revCh > 0)
  const top3down = skuChanges.slice(-3).reverse().filter(s => s.revCh < 0)

  return (
    <div className="card p-4 bg-blue-50 border-blue-200">
      <h3 className="text-sm font-semibold text-blue-800 mb-3">Выводы по сравнению периодов</h3>

      {insights.length === 0 && skuChanges.length === 0 && (
        <p className="text-xs text-blue-600">Значительных изменений не обнаружено</p>
      )}

      {insights.map((ins, i) => (
        <div key={i} className={`text-xs mb-2 flex items-start gap-2
          ${ins.type === 'good' ? 'text-green-700' : ins.type === 'bad' ? 'text-red-700' : 'text-yellow-700'}`}>
          <span>{ins.type === 'good' ? '✅' : ins.type === 'bad' ? '🔴' : '⚠️'}</span>
          <span>{ins.text}</span>
        </div>
      ))}

      <div className="grid grid-cols-2 gap-4 mt-3">
        {top3up.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-blue-700 mb-1">Топ-3 по росту выручки</p>
            {top3up.map(s => (
              <div key={s.sku_id} className="text-xs flex items-center gap-2 mb-1">
                <span className="text-green-600 font-mono tabular-nums w-12 text-right">+{s.revCh.toFixed(0)}%</span>
                <span className="text-gray-700 truncate">{s.name || s.sku_id}</span>
              </div>
            ))}
          </div>
        )}
        {top3down.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-blue-700 mb-1">Топ-3 по падению выручки</p>
            {top3down.map(s => (
              <div key={s.sku_id} className="text-xs flex items-center gap-2 mb-1">
                <span className="text-red-500 font-mono tabular-nums w-12 text-right">{s.revCh.toFixed(0)}%</span>
                <span className="text-gray-700 truncate">{s.name || s.sku_id}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Trend mini-chart (SVG) ────────────────────────────────────────────────────
function TrendChart({ historical, forecast }) {
  const W = 600, H = 120, PX = 10, PY = 12
  const all  = [...historical, ...forecast]
  const minV = Math.min(...all.map(v => v ?? 0), 0)
  const maxV = Math.max(...all.map(v => v ?? 0), 1)
  const vR   = maxV - minV || 1
  const total = historical.length + forecast.length

  const xc = i  => PX + (i  / (total - 1 || 1)) * (W - 2 * PX)
  const yc = v  => PY + (1 - (v - minV) / vR)   * (H - 2 * PY)

  const histPath = historical
    .map((v, i) => `${i ? 'L' : 'M'}${xc(i).toFixed(1)},${yc(v).toFixed(1)}`)
    .join('')

  const forecastPath = [
    `M${xc(historical.length - 1).toFixed(1)},${yc(historical.at(-1)).toFixed(1)}`,
    ...forecast.map((v, i) => `L${xc(historical.length + i).toFixed(1)},${yc(v).toFixed(1)}`),
  ].join('')

  const splitX = xc(historical.length - 1)
  const areaPath = `${histPath} L${xc(historical.length - 1)},${H - PY} L${PX},${H - PY} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '120px' }}>
      <defs>
        <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#fg)" />
      <path d={histPath}     fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinejoin="round" />
      <path d={forecastPath} fill="none" stroke="#3b82f6" strokeWidth="1.8"
        strokeDasharray="5 4" opacity="0.4" strokeLinejoin="round" />
      <line x1={splitX} y1={PY} x2={splitX} y2={H - PY}
        stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 3" />
    </svg>
  )
}

// ── Forecast tab ──────────────────────────────────────────────────────────────
function ForecastTab({ byDay }) {
  if (!byDay || byDay.length < 3) return (
    <p className="text-sm text-gray-400 text-center py-6">
      Недостаточно данных для прогноза — нужно минимум 3 дня
    </p>
  )

  const revenues = byDay.map(d => d.revenue  || 0)
  const profits  = byDay.map(d => d.profit   || 0)
  const n = revenues.length

  const revTrend    = linearTrend(revenues)
  const profTrend   = linearTrend(profits)

  const fcRevs  = Array.from({ length: 30 }, (_, i) =>
    Math.max(0, revTrend.intercept  + revTrend.slope  * (n + i)))
  const fcProfs = Array.from({ length: 30 }, (_, i) =>
    profTrend.intercept + profTrend.slope * (n + i))

  const totalFcRev  = fcRevs.reduce((s, v) => s + v, 0)
  const totalFcProf = fcProfs.reduce((s, v) => s + v, 0)

  const avgCur = revenues.reduce((s, v) => s + v, 0) / n
  const avgFc  = totalFcRev / 30
  const trendChange = avgCur > 0 ? ((avgFc - avgCur) / avgCur * 100) : 0
  const trendDown   = revTrend.slope < 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-400">Прогноз выручки (след. 30 дней)</p>
          <p className="text-lg font-bold text-blue-700 mt-1 tabular-nums">{rub(totalFcRev)}</p>
          <p className="text-xs text-gray-400 mt-1 tabular-nums">
            ±15%: {rub(totalFcRev * 0.85)} — {rub(totalFcRev * 1.15)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400">Прогноз прибыли (след. 30 дней)</p>
          <p className={`text-lg font-bold mt-1 tabular-nums ${totalFcProf >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {rub(totalFcProf)}
          </p>
        </div>
      </div>

      {trendDown && (
        <div className="card p-3 bg-red-50 border-red-200 text-red-700 text-xs">
          ⚠️ Тренд нисходящий — без изменений выручка упадёт на {Math.abs(trendChange).toFixed(0)}% относительно текущего среднего
        </div>
      )}
      {!trendDown && (
        <div className="card p-3 bg-green-50 border-green-200 text-green-700 text-xs">
          ✅ Тренд восходящий — при сохранении динамики выручка вырастет на {Math.abs(trendChange).toFixed(0)}%
        </div>
      )}

      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 mb-1">График: факт + прогноз выручки</p>
        <TrendChart historical={revenues} forecast={fcRevs} />
        <div className="flex items-center gap-5 mt-1 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span style={{ display: 'inline-block', width: '18px', height: '2px', background: '#3b82f6' }} />
            Факт
          </span>
          <span className="flex items-center gap-1.5">
            <span style={{ display: 'inline-block', width: '18px', height: '2px',
              background: 'repeating-linear-gradient(90deg,#3b82f6 0,#3b82f6 5px,transparent 5px,transparent 9px)',
              opacity: 0.5 }} />
            Прогноз
          </span>
        </div>
      </div>
    </div>
  )
}

// ── P&L table (by SKU) ────────────────────────────────────────────────────────
const SKU_COLS = [
  { key: 'name',       label: 'Товар',    align: 'left',  fmt: v => v || '—' },
  { key: 'units',      label: 'Продаж',   align: 'right', fmt: num },
  { key: 'revenue',    label: 'Выручка',  align: 'right', fmt: rub },
  { key: 'commission', label: 'Комиссия', align: 'right', fmt: rub },
  { key: 'logistics',  label: 'Логист.',  align: 'right', fmt: rub },
  { key: 'cogs',       label: 'Себест.',  align: 'right', fmt: v => rub(-v) },
  { key: 'profit',     label: 'Прибыль',  align: 'right', fmt: rub },
  { key: 'margin_pct', label: 'Маржа',    align: 'right', fmt: pct },
]

const FILTER_OPTS = [
  { id: 'all',      label: 'Все' },
  { id: 'stars',    label: '🟢 Звёзды' },
  { id: 'pressure', label: '🟡 Под давлением' },
  { id: 'loss',     label: '🔴 Убыточные' },
]

function SkuTable({ rows, summary }) {
  const [filter, setFilter] = useState('all')

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows
    return rows.filter(row => {
      const s = skuStatus(row)
      if (filter === 'stars')    return s?.label === 'Звезда'
      if (filter === 'pressure') return s?.label === 'Под давлением'
      if (filter === 'loss')     return s?.label === 'Убыточный'
      return true
    })
  }, [rows, filter])

  const totals = {
    name:       'ИТОГО',
    units:      summary.units,
    revenue:    summary.revenue,
    commission: summary.commission,
    logistics:  summary.logistics,
    cogs:       -summary.cogs,
    profit:     summary.profit,
    margin_pct: summary.margin_pct,
  }

  function rowCls(row, key) {
    if (key === 'profit')
      return row.profit >= 0 ? 'text-green-700 font-medium' : 'text-red-500 font-medium'
    if (key === 'margin_pct')
      return row.margin_pct >= 15 ? 'text-green-700' : row.margin_pct >= 0 ? 'text-yellow-700' : 'text-red-500'
    return 'text-gray-700'
  }

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_OPTS.map(opt => (
          <button key={opt.id} onClick={() => setFilter(opt.id)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors
              ${filter === opt.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {opt.label}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-1">
          {filteredRows.length !== rows.length ? `${filteredRows.length} из ${rows.length}` : `${rows.length} SKU`}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="py-2 px-2 text-left font-semibold text-gray-500 whitespace-nowrap">Статус</th>
              {SKU_COLS.map(c => (
                <th key={c.key}
                  className={`py-2 px-2 font-semibold text-gray-500 whitespace-nowrap
                    ${c.align === 'left' ? 'text-left' : 'text-right'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredRows.map(row => (
              <tr key={row.sku_id} className="hover:bg-gray-50/70 transition-colors">
                <td className="py-2 px-2 whitespace-nowrap">
                  <SkuStatusBadge row={row} />
                </td>
                {SKU_COLS.map(c => (
                  <td key={c.key}
                    className={`py-2 px-2 tabular-nums whitespace-nowrap
                      ${c.align === 'right' ? 'text-right' : ''}
                      ${c.key === 'name' ? 'max-w-[180px]' : ''}
                      ${rowCls(row, c.key)}`}
                    title={c.key === 'name' ? row.name : undefined}
                  >
                    {c.key === 'name'
                      ? <span className="block truncate">{c.fmt(row[c.key])}</span>
                      : c.fmt(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={SKU_COLS.length + 1} className="py-6 text-center text-gray-400">
                  Нет SKU с таким статусом
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
              <td className="py-2.5 px-2 text-gray-300 text-xs font-mono">—</td>
              {SKU_COLS.map(c => (
                <td key={c.key}
                  className={`py-2.5 px-2 tabular-nums whitespace-nowrap text-gray-800
                    ${c.align === 'right' ? 'text-right' : ''}
                    ${c.key === 'profit' ? (totals.profit >= 0 ? 'text-green-700' : 'text-red-500') : ''}
                    ${c.key === 'margin_pct' ? (totals.margin_pct >= 15 ? 'text-green-700' : totals.margin_pct >= 0 ? 'text-yellow-700' : 'text-red-500') : ''}`}
                >
                  {c.fmt(totals[c.key])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Daily table ───────────────────────────────────────────────────────────────
function DayTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-gray-200">
            {['Дата','Выручка','Комиссия','Логист.','Возвраты','Себест.','Реклама','Прибыль','Маржа','ДРР','Д/Д','Н/Н'].map(h => (
              <th key={h} className={`py-2 px-2 font-semibold text-gray-500 whitespace-nowrap ${h === 'Дата' ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(d => {
            const pc = d.profit >= 0 ? 'text-green-700' : 'text-red-500'
            const mc = d.margin_pct >= 15 ? 'text-green-700' : d.margin_pct >= 0 ? 'text-yellow-600' : 'text-red-500'
            return (
              <tr key={d.date} className="hover:bg-gray-50/70 transition-colors">
                <td className="py-1.5 px-2 font-mono text-gray-700">{date(d.date)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-blue-700">{rub(d.revenue)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{rub(d.commission)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{rub(d.logistics)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{rub(d.returns)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{rub(-d.cogs)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-purple-700">{d.ad_spend > 0 ? rub(-d.ad_spend) : '—'}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums font-medium ${pc}`}>{rub(d.profit)}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${mc}`}>{pct(d.margin_pct)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-purple-700">{d.drr > 0 ? pct(d.drr) : '—'}</td>
                <td className="py-1.5 px-2 text-right"><Arrow v={d.d1d_pct} /></td>
                <td className="py-1.5 px-2 text-right"><Arrow v={d.w1w_pct} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Date presets ──────────────────────────────────────────────────────────────
function isoDate(d) { return d.toISOString().slice(0, 10) }

function preset(days) {
  const end   = new Date()
  const start = new Date(+end - days * 86400_000)
  return [isoDate(start), isoDate(end)]
}

function thisMonth() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return [isoDate(start), isoDate(now)]
}

// ── Page ──────────────────────────────────────────────────────────────────────
const TABS = ['P&L по SKU', 'По дням', 'Прогноз', 'Себестоимость']

export default function PnLPage() {
  const [[df, dt]]    = useState(() => preset(30))
  const [dateFrom,    setDateFrom]    = useState(df)
  const [dateTo,      setDateTo]      = useState(dt)
  const [adSpend,     setAdSpend]     = useState('0')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [data,        setData]        = useState(null)
  const [tab,         setTab]         = useState(TABS[0])

  // Comparison
  const [showCompare,    setShowCompare]    = useState(false)
  const [compareFrom,    setCompareFrom]    = useState('')
  const [compareTo,      setCompareTo]      = useState('')
  const [compareData,    setCompareData]    = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)

  const loadRef    = useRef(0)
  const cmpLoadRef = useRef(0)

  async function load() {
    const id = ++loadRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await fetchPlSummary(dateFrom, dateTo, parseFloat(adSpend) || 0)
      if (id === loadRef.current) { setData(result); setTab(TABS[0]) }
    } catch (err) {
      if (id === loadRef.current) setError(err.message)
    } finally {
      if (id === loadRef.current) setLoading(false)
    }
  }

  async function loadCompare() {
    if (!compareFrom || !compareTo) return
    const id = ++cmpLoadRef.current
    setCompareLoading(true)
    try {
      const result = await fetchPlSummary(compareFrom, compareTo, parseFloat(adSpend) || 0)
      if (id === cmpLoadRef.current) setCompareData(result)
    } catch {
      // silently ignore comparison errors
    } finally {
      if (id === cmpLoadRef.current) setCompareLoading(false)
    }
  }

  function applyPreset(days) {
    const [f, t] = preset(days)
    setDateFrom(f); setDateTo(t)
  }

  const presets = [
    { label: '7д',    fn: () => applyPreset(7)  },
    { label: '30д',   fn: () => applyPreset(30) },
    { label: '90д',   fn: () => applyPreset(90) },
    { label: 'Месяц', fn: () => { const [f,t] = thisMonth(); setDateFrom(f); setDateTo(t) } },
  ]

  const skuEditorList = data?.by_sku.map(s => ({
    sku_id: s.sku_id, name: s.name, cost_per_unit: s.cost_per_unit,
  })) ?? []

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">P&amp;L калькулятор</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Финансовая аналитика по транзакциям Ozon: выручка, комиссии, логистика, прибыль
        </p>
      </div>

      {/* Controls */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          {/* Presets */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500">Быстрый период</p>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {presets.map(p => (
                <button key={p.label} type="button" onClick={p.fn}
                  className="px-3 py-1.5 text-xs font-medium bg-white text-gray-600
                    hover:bg-gray-50 border-r border-gray-200 last:border-0 transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date inputs */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500">Период</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="input text-xs py-1.5 w-32" />
              <span className="text-gray-400 text-sm">—</span>
              <input type="date" value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="input text-xs py-1.5 w-32" />
              <button
                onClick={() => { setShowCompare(p => !p); if (showCompare) setCompareData(null) }}
                className={`btn-secondary text-xs px-3 py-1.5 transition-colors
                  ${showCompare ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}>
                ⇄ Сравнить период
              </button>
            </div>
          </div>

          {/* Ad spend */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500">Реклама за период, ₽</p>
            <input type="number" min="0" step="100" value={adSpend}
              onChange={e => setAdSpend(e.target.value)}
              className="input text-xs py-1.5 w-32" placeholder="0" />
          </div>

          <button onClick={load} disabled={loading}
            className="btn-primary px-5 py-2 self-end disabled:opacity-50">
            {loading
              ? <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Загрузка…</>
              : '📊 Загрузить P&L'}
          </button>
        </div>

        {/* Comparison period row */}
        {showCompare && (
          <div className="flex items-end gap-3 flex-wrap pt-3 border-t border-gray-100">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-1" />
                Период сравнения
              </p>
              <div className="flex items-center gap-2">
                <input type="date" value={compareFrom}
                  onChange={e => setCompareFrom(e.target.value)}
                  className="input text-xs py-1.5 w-32" />
                <span className="text-gray-400 text-sm">—</span>
                <input type="date" value={compareTo}
                  onChange={e => setCompareTo(e.target.value)}
                  className="input text-xs py-1.5 w-32" />
              </div>
            </div>
            <button onClick={loadCompare}
              disabled={compareLoading || !compareFrom || !compareTo}
              className="btn-secondary text-xs px-4 py-1.5 disabled:opacity-50 self-end">
              {compareLoading ? 'Загрузка…' : 'Загрузить'}
            </button>
            {compareData && (
              <span className="text-xs text-green-600 self-end pb-1.5">✓ Период загружен</span>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Empty */}
      {!data && !loading && !error && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">📊</p>
          <p className="font-medium text-gray-500">Выберите период и нажмите «Загрузить P&L»</p>
          <p className="text-sm mt-1">Данные берутся из финансовых транзакций вашего магазина Ozon</p>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {/* Alerts */}
          <AlertsPanel data={data} />

          {/* KPI */}
          <KpiStrip s={data.summary} prev={compareData?.summary} />

          {/* Comparison insights */}
          {compareData && (
            <InsightsBlock
              curSummary={data.summary}
              prevSummary={compareData.summary}
              curSkus={data.by_sku}
              prevSkus={compareData.by_sku}
            />
          )}

          {/* Waterfall */}
          <WaterfallBar s={data.summary} />

          {/* No data warning */}
          {data.by_day.length === 0 && (
            <div className="card p-4 bg-yellow-50 border-yellow-200 text-yellow-700 text-sm">
              За выбранный период транзакций не найдено. Проверьте даты или подключение магазина.
            </div>
          )}

          {/* SKU with 0 cost warning */}
          {data.by_sku.some(s => !s.cost_per_unit) && (
            <div className="card p-3 bg-blue-50 border-blue-200 text-blue-700 text-xs flex items-center gap-2">
              <span>ℹ️</span>
              <span>
                Для части SKU не указана себестоимость — прибыль посчитана без неё.
                Заполните на вкладке{' '}
                <button onClick={() => setTab('Себестоимость')}
                  className="font-semibold underline">Себестоимость</button>.
              </span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-0 border-b border-gray-200">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
                  ${tab === t
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                {t}
                {t === 'P&L по SKU' && data.by_sku.length > 0 &&
                  <span className="ml-1.5 bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded-full">
                    {data.by_sku.length}
                  </span>}
                {t === 'По дням' && data.by_day.length > 0 &&
                  <span className="ml-1.5 bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded-full">
                    {data.by_day.length}
                  </span>}
              </button>
            ))}
          </div>

          {/* Tab: P&L по SKU */}
          {tab === 'P&L по SKU' && (
            <div className="card p-4">
              {data.by_sku.length === 0
                ? <p className="text-sm text-gray-400 text-center py-6">Нет данных</p>
                : <SkuTable rows={data.by_sku} summary={data.summary} />
              }
            </div>
          )}

          {/* Tab: По дням */}
          {tab === 'По дням' && (
            <div className="card p-4">
              {data.by_day.length === 0
                ? <p className="text-sm text-gray-400 text-center py-6">Нет данных</p>
                : <>
                    <p className="text-xs text-gray-400 mb-3">
                      Д/Д — динамика выручки день к дню;&nbsp; Н/Н — неделя к неделе
                    </p>
                    <DayTable rows={data.by_day} />
                    <div className="border-t-2 border-gray-300 mt-2 pt-2 flex flex-wrap gap-4 text-xs font-semibold text-gray-700">
                      <span>Итого за период:</span>
                      <span className="text-blue-700">Выручка {rub(data.summary.revenue)}</span>
                      <span className={data.summary.profit >= 0 ? 'text-green-700' : 'text-red-500'}>
                        Прибыль {rub(data.summary.profit)}
                      </span>
                      <span>Маржа {pct(data.summary.margin_pct)}</span>
                    </div>
                  </>
              }
            </div>
          )}

          {/* Tab: Прогноз */}
          {tab === 'Прогноз' && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Прогноз на следующие 30 дней
                <span className="ml-2 text-xs font-normal text-gray-400">на основе линейного тренда</span>
              </h3>
              <ForecastTab byDay={data.by_day} />
            </div>
          )}

          {/* Tab: Себестоимость */}
          {tab === 'Себестоимость' && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Себестоимость по SKU</h3>
                <p className="text-xs text-gray-400">{skuEditorList.length} товаров</p>
              </div>
              <CogsEditor skus={skuEditorList} onSaved={load} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
