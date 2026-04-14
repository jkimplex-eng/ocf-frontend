import React, { useState, useRef } from 'react'
import { fetchBrandProducts } from '../api/client'

// ── Icons ──────────────────────────────────────────────────────────────────
const IconSearch  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
const IconSort    = ({ dir }) => (
  <svg className="w-3 h-3 ml-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    {dir === 'asc'
      ? <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"/>
      : dir === 'desc'
      ? <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
      : <path d="M5 10l3-3 3 3M11 14l3-3 3 3" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round"/>
    }
  </svg>
)

// ── Formatters ─────────────────────────────────────────────────────────────
const fmt = {
  rub: v => {
    if (!v) return '—'
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн ₽`
    if (v >= 1_000)     return `${(v / 1_000).toFixed(0)} тыс ₽`
    return `${v.toLocaleString('ru')} ₽`
  },
  num: v => v ? v.toLocaleString('ru') : '—',
  price: v => v ? `${v.toLocaleString('ru')} ₽` : '—',
  rating: v => v ? v.toFixed(1) : '—',
  pct: v => v ? `${v}%` : '—',
}

function Stars({ rating }) {
  if (!rating) return <span className="text-gray-300 text-xs">—</span>
  const full = Math.floor(rating)
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-3 h-3 ${i <= full ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
      <span className="text-xs text-gray-500 ml-0.5">{rating.toFixed(1)}</span>
    </span>
  )
}

// ── MetricCard ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'from-blue-500  to-blue-600',
    green:  'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-400 to-orange-500',
  }
  return (
    <div className={`card p-4 bg-gradient-to-br ${colors[color]} text-white`}>
      <p className="text-xs font-medium text-white/70 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1 truncate">{value}</p>
      {sub && <p className="text-xs text-white/70 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Table ──────────────────────────────────────────────────────────────────
const COLS = [
  { key: 'name',     label: 'Товар',    sortable: false,  width: 'min-w-[200px]' },
  { key: 'category', label: 'Категория',sortable: false,  width: 'min-w-[120px]' },
  { key: 'price',    label: 'Цена',     sortable: true,   width: 'w-28' },
  { key: 'revenue',  label: 'Выручка',  sortable: true,   width: 'w-32' },
  { key: 'sales',    label: 'Продажи',  sortable: true,   width: 'w-24' },
  { key: 'stock',    label: 'Остатки',  sortable: true,   width: 'w-24' },
  { key: 'rating',   label: 'Рейтинг',  sortable: true,   width: 'w-32' },
]

function ProductsTable({ products }) {
  const [sortKey, setSortKey] = useState('revenue')
  const [sortDir, setSortDir] = useState('desc')

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...products].sort((a, b) => {
    const va = a[sortKey] ?? 0
    const vb = b[sortKey] ?? 0
    return sortDir === 'asc' ? va - vb : vb - va
  })

  if (products.length === 0) {
    return <p className="text-center py-12 text-gray-400 text-sm">Нет товаров для отображения</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
            {COLS.map(col => (
              <th
                key={col.key}
                className={`text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide ${col.width}`}
              >
                {col.sortable ? (
                  <button
                    onClick={() => handleSort(col.key)}
                    className="flex items-center hover:text-gray-800 transition-colors"
                  >
                    {col.label}
                    <IconSort dir={sortKey === col.key ? sortDir : null} />
                  </button>
                ) : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((p, i) => (
            <tr key={p.id ?? i} className="hover:bg-gray-50 transition-colors group">
              <td className="px-3 py-2.5 text-gray-400 tabular-nums">{i + 1}</td>

              {/* Name + thumb */}
              <td className="px-3 py-2.5 min-w-[200px]">
                <div className="flex items-center gap-2.5">
                  {p.thumb ? (
                    <img
                      src={p.thumb}
                      alt=""
                      className="w-8 h-8 rounded object-cover flex-shrink-0 bg-gray-100"
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0"/>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate max-w-[220px]" title={p.name}>{p.name || '—'}</p>
                    {p.seller && <p className="text-xs text-gray-400 truncate">{p.seller}</p>}
                  </div>
                </div>
              </td>

              {/* Category */}
              <td className="px-3 py-2.5 text-gray-500 text-xs">
                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[110px]" title={p.category}>
                  {p.category || '—'}
                </span>
              </td>

              {/* Price */}
              <td className="px-3 py-2.5 tabular-nums text-gray-700">{fmt.price(p.price)}</td>

              {/* Revenue */}
              <td className="px-3 py-2.5 tabular-nums font-medium text-gray-800">
                {fmt.rub(p.revenue)}
              </td>

              {/* Sales */}
              <td className="px-3 py-2.5 tabular-nums text-gray-700">{fmt.num(p.sales)}</td>

              {/* Stock */}
              <td className="px-3 py-2.5 tabular-nums">
                <span className={`font-medium ${p.stock === 0 ? 'text-red-500' : p.stock < 10 ? 'text-orange-500' : 'text-gray-700'}`}>
                  {fmt.num(p.stock)}
                </span>
              </td>

              {/* Rating */}
              <td className="px-3 py-2.5">
                <div className="flex flex-col gap-0.5">
                  <Stars rating={p.rating} />
                  {p.reviews_count > 0 && (
                    <span className="text-xs text-gray-400">{p.reviews_count} отзывов</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Dates helpers ──────────────────────────────────────────────────────────
function today()    { return new Date().toISOString().slice(0, 10) }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

// ── Page ────────────────────────────────────────────────────────────────────
export default function BrandAnalyticsPage() {
  const [brandInput, setBrandInput] = useState('')
  const [brand,      setBrand]      = useState('')
  const [dateFrom,   setDateFrom]   = useState(daysAgo(30))
  const [dateTo,     setDateTo]     = useState(today())
  const [itemId,     setItemId]     = useState('')
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const inputRef = useRef(null)

  async function search(e) {
    e?.preventDefault()
    const b = brandInput.trim()
    if (!b) return
    setBrand(b)
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetchBrandProducts(b, {
        date_from: dateFrom,
        date_to:   dateTo,
        item_id:   itemId.trim() || undefined,
        limit:     200,
      })
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const summary = data?.summary

  return (
    <div className="space-y-5">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Аналитика бренда</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Метрики товаров по бренду из MPStats: выручка, продажи, остатки, цена, рейтинг
        </p>
      </div>

      {/* Filters */}
      <form onSubmit={search} className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Brand */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Бренд *</label>
            <input
              ref={inputRef}
              value={brandInput}
              onChange={e => setBrandInput(e.target.value)}
              placeholder="например: Aravia, L'Oreal, Garnier"
              className="input"
              required
            />
          </div>

          {/* Date from */}
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-600 mb-1">Дата от</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              max={dateTo}
              className="input"
            />
          </div>

          {/* Date to */}
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-600 mb-1">Дата до</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              min={dateFrom}
              max={today()}
              className="input"
            />
          </div>

          {/* Item ID */}
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">ID товара (опц.)</label>
            <input
              value={itemId}
              onChange={e => setItemId(e.target.value)}
              placeholder="123456789"
              className="input"
            />
          </div>
        </div>

        {/* Presets + submit */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Период:</span>
          {[
            { label: '7 дней',  days: 7  },
            { label: '30 дней', days: 30 },
            { label: '90 дней', days: 90 },
          ].map(({ label, days }) => (
            <button
              key={days}
              type="button"
              onClick={() => { setDateFrom(daysAgo(days)); setDateTo(today()) }}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors
                ${dateFrom === daysAgo(days) && dateTo === today()
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
          <div className="flex-1"/>
          <button type="submit" disabled={loading || !brandInput.trim()} className="btn-primary">
            {loading
              ? <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Загрузка...</>
              : <><IconSearch /> Найти</>}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">
          Ошибка: {error}
        </div>
      )}

      {/* Empty state before search */}
      {!loading && !data && !error && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">📊</p>
          <p className="font-medium text-gray-500">Введите название бренда и нажмите «Найти»</p>
          <p className="text-sm mt-1">Данные загружаются из MPStats в реальном времени</p>
        </div>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Выручка"
              value={fmt.rub(summary?.total_revenue)}
              sub={`${dateFrom} — ${dateTo}`}
              color="blue"
            />
            <MetricCard
              label="Продажи"
              value={fmt.num(summary?.total_sales)}
              sub="единиц за период"
              color="green"
            />
            <MetricCard
              label="Товаров"
              value={fmt.num(summary?.total_products)}
              sub="в выборке"
              color="purple"
            />
            <MetricCard
              label="Средняя цена"
              value={fmt.price(summary?.avg_price)}
              sub="за единицу"
              color="orange"
            />
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                Товары бренда <span className="text-blue-600">{brand}</span>
              </h2>
              <span className="text-xs text-gray-400 tabular-nums">
                {data.products.length} товаров
              </span>
            </div>
            <ProductsTable products={data.products} />
          </div>
        </>
      )}
    </div>
  )
}
