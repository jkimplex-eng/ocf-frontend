import React, { useState, useCallback, useRef } from 'react'
import { fetchPlSummary, fetchCogs, saveCogs } from '../api/client'

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
const date = s => s ? s.slice(5).replace('-', '.') : ''  // "MM.DD"

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

// ── KPI strip ─────────────────────────────────────────────────────────────────
function KpiStrip({ s }) {
  const items = [
    { label: 'Выручка',   val: rub(s.revenue),    cls: 'text-blue-700'   },
    { label: 'Комиссия',  val: rub(s.commission),  cls: 'text-gray-700'   },
    { label: 'Логистика', val: rub(s.logistics),   cls: 'text-gray-700'   },
    { label: 'Возвраты',  val: rub(s.returns),     cls: 'text-gray-700'   },
    { label: 'Себест.',   val: rub(-s.cogs),       cls: 'text-gray-700'   },
    { label: 'Реклама',   val: rub(-s.ad_spend),   cls: 'text-purple-700' },
    {
      label: 'Прибыль',
      val:   rub(s.profit),
      cls:   s.profit >= 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold',
    },
    { label: 'Маржа',  val: pct(s.margin_pct), cls: s.margin_pct >= 15 ? 'text-green-700' : s.margin_pct >= 0 ? 'text-yellow-700' : 'text-red-600' },
    { label: 'ДРР',    val: pct(s.drr),         cls: 'text-purple-700' },
    { label: 'Продаж', val: num(s.units) + ' шт', cls: 'text-gray-700' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {items.map(({ label, val, cls }) => (
        <div key={label} className="card px-3 py-2.5">
          <p className="text-xs text-gray-400">{label}</p>
          <p className={`text-sm mt-0.5 tabular-nums ${cls}`}>{val}</p>
        </div>
      ))}
    </div>
  )
}

// ── COGS editor ───────────────────────────────────────────────────────────────
function CogsEditor({ skus, onSaved }) {
  // skus: [{sku_id, name, cost_per_unit | cost}]
  const [vals,    setVals]    = useState(() =>
    Object.fromEntries(skus.map(s => [s.sku_id, String(s.cost_per_unit ?? s.cost ?? 0)]))
  )
  const [saving,  setSaving]  = useState(false)
  const [flash,   setFlash]   = useState(false)

  async function save() {
    setSaving(true)
    try {
      const items = skus.map(s => ({
        sku_id: s.sku_id,
        name:   s.name || '',
        cost:   parseFloat(vals[s.sku_id] || 0),
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
              <input
                type="number" min="0" step="10"
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

function SkuTable({ rows, summary }) {
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
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-gray-200">
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
          {rows.map(row => (
            <tr key={row.sku_id} className="hover:bg-gray-50/70 transition-colors">
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
        </tbody>
        {/* Total row */}
        <tfoot>
          <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
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
              <th key={h} className={`py-2 px-2 font-semibold text-gray-500 whitespace-nowrap ${h==='Дата'?'text-left':'text-right'}`}>{h}</th>
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
const TABS = ['P&L по SKU', 'По дням', 'Себестоимость']

export default function PnLPage() {
  const [[df, dt]] = useState(() => preset(30))
  const [dateFrom, setDateFrom] = useState(df)
  const [dateTo,   setDateTo]   = useState(dt)
  const [adSpend,  setAdSpend]  = useState('0')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [data,     setData]     = useState(null)
  const [tab,      setTab]      = useState(TABS[0])

  const loadRef = useRef(0)

  async function load() {
    const id = ++loadRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await fetchPlSummary(dateFrom, dateTo, parseFloat(adSpend) || 0)
      if (id === loadRef.current) {
        setData(result)
        setTab(TABS[0])
      }
    } catch (err) {
      if (id === loadRef.current) setError(err.message)
    } finally {
      if (id === loadRef.current) setLoading(false)
    }
  }

  function applyPreset(days) {
    const [f, t] = preset(days)
    setDateFrom(f); setDateTo(t)
  }

  const presets = [
    { label: '7д',       fn: () => applyPreset(7)   },
    { label: '30д',      fn: () => applyPreset(30)  },
    { label: '90д',      fn: () => applyPreset(90)  },
    { label: 'Месяц',    fn: () => { const [f,t] = thisMonth(); setDateFrom(f); setDateTo(t) } },
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
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="input text-xs py-1.5 w-32" />
              <span className="text-gray-400 text-sm">—</span>
              <input type="date" value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="input text-xs py-1.5 w-32" />
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
              ? <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>Загрузка…</>
              : '📊 Загрузить P&L'}
          </button>
        </div>
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
          {/* KPI */}
          <KpiStrip s={data.summary} />

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
                Заполните на вкладке <button onClick={() => setTab('Себестоимость')}
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
                      Д/Д — динамика выручки день к дню; &nbsp;Н/Н — неделя к неделе
                    </p>
                    <DayTable rows={data.by_day} />
                    {/* Total row */}
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
