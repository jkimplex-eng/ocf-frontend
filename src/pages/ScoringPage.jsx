import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { scoreStream, fetchLimits } from '../api/client'

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = {
  rub: v => {
    if (!v && v !== 0) return '—'
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн ₽`
    if (v >= 1_000)     return `${(v / 1_000).toFixed(0)} тыс ₽`
    return `${Number(v).toLocaleString('ru')} ₽`
  },
  pct: (v, decimals = 0) => v != null ? `${Number(v).toFixed(decimals)}%` : '—',
  num: v => v != null ? Number(v).toLocaleString('ru') : '—',
}

const COLOR_MAP = {
  green:  { bg: 'bg-green-50',  border: 'border-green-200', badge: 'bg-green-100 text-green-800',  bar: 'bg-green-500',  dot: 'bg-green-500',  text: 'text-green-700'  },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200',badge: 'bg-yellow-100 text-yellow-800',bar: 'bg-yellow-400', dot: 'bg-yellow-400', text: 'text-yellow-700' },
  red:    { bg: 'bg-red-50',    border: 'border-red-200',   badge: 'bg-red-100 text-red-800',      bar: 'bg-red-500',    dot: 'bg-red-500',    text: 'text-red-700'    },
}

const VERDICT_ICON = { green: '🟢', yellow: '🟡', red: '🔴' }

const COMPONENT_KEYS = [
  { key: 'growth_index',      label: 'Рост',        max: 25, icon: '📈' },
  { key: 'competition_index', label: 'Конкуренция', max: 25, icon: '⚔️' },
  { key: 'entry_barrier',     label: 'Барьер входа',max: 20, icon: '🚧' },
  { key: 'margin',            label: 'Маржа',        max: 20, icon: '💰' },
  { key: 'seasonal',          label: 'Сезонность',   max: 10, icon: '📅' },
]

// ── ScoreBar ───────────────────────────────────────────────────────────────
function ScoreBar({ score, max, color = 'blue' }) {
  const pct = Math.round(score / max * 100)
  const barColor =
    pct >= 75 ? 'bg-green-500' :
    pct >= 45 ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-500 w-8 text-right">{score}/{max}</span>
    </div>
  )
}

// ── TotalScoreRing ─────────────────────────────────────────────────────────
function ScoreRing({ score, color }) {
  const c = COLOR_MAP[color] || COLOR_MAP.red
  const r = 28, cx = 32, cy = 32
  const circ = 2 * Math.PI * r
  const dash  = circ * score / 100
  return (
    <div className="relative inline-flex items-center justify-center w-16 h-16">
      <svg className="absolute inset-0 -rotate-90" width="64" height="64">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={color === 'green' ? '#22c55e' : color === 'yellow' ? '#eab308' : '#ef4444'}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className={`relative text-lg font-bold ${c.text}`}>{score}</span>
    </div>
  )
}

// ── Category result card ───────────────────────────────────────────────────
function CategoryCard({ result, expanded, onToggle }) {
  const c = COLOR_MAP[result.color] || COLOR_MAP.red
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} overflow-hidden transition-all`}>
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:brightness-95 transition-all"
      >
        {/* Score ring */}
        <ScoreRing score={result.total_score} color={result.color} />

        {/* Name + verdict */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 truncate">{result.name}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
              {VERDICT_ICON[result.color]} {result.verdict}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">{result.path}</p>
        </div>

        {/* Mini component bars */}
        <div className="hidden sm:flex flex-col gap-1 w-40">
          {COMPONENT_KEYS.map(({ key, label, max, icon }) => {
            const comp = result.components?.[key]
            if (!comp) return null
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span className="text-xs w-3">{icon}</span>
                <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.bar}`}
                    style={{ width: `${comp.pct}%`, opacity: 0.8 }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-6 text-right tabular-nums">{comp.score}</span>
              </div>
            )
          })}
        </div>

        {/* Key metrics */}
        <div className="hidden md:flex flex-col items-end gap-1 text-right min-w-[110px]">
          <span className="text-sm font-semibold text-gray-700">{fmt.rub(result.metrics?.revenue_30d)}</span>
          <span className="text-xs text-gray-400">выручка 30д</span>
          {result.metrics?.margin_pct != null && (
            <span className={`text-xs font-medium ${result.metrics.margin_pct >= 15 ? 'text-green-600' : result.metrics.margin_pct >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
              маржа {fmt.pct(result.metrics.margin_pct, 1)}
            </span>
          )}
        </div>

        {/* Chevron */}
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/60 bg-white/50 px-4 py-4 space-y-4">
          {/* Components breakdown */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Компоненты скора</h4>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {COMPONENT_KEYS.map(({ key, icon, max }) => {
                const comp = result.components?.[key]
                if (!comp) return null
                return (
                  <div key={key} className="bg-white rounded-lg p-2.5 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">{icon} {comp.label}</span>
                      <span className="text-sm font-bold text-gray-800 tabular-nums">{comp.score}<span className="text-gray-400 font-normal">/{comp.max}</span></span>
                    </div>
                    <ScoreBar score={comp.score} max={comp.max} />
                    <p className="text-xs text-gray-600 mt-1.5 leading-tight">{comp.signal}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Metrics row */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Метрики категории</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Выручка 30д',       value: fmt.rub(result.metrics?.revenue_30d) },
                { label: 'Выручка пред. 30д', value: fmt.rub(result.metrics?.revenue_prev_30d) },
                { label: 'Средняя цена',       value: fmt.rub(result.metrics?.avg_price) },
                { label: 'Товаров в выборке',  value: fmt.num(result.metrics?.total_products) },
                { label: 'Доля топ-10',        value: fmt.pct((result.metrics?.top10_seller_share ?? 0) * 100, 0) },
                { label: 'Отзывов топ-20',     value: fmt.num(result.metrics?.avg_reviews_top20) },
                { label: 'Расч. маржа',        value: fmt.pct(result.metrics?.margin_pct, 1) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Signals */}
          {result.signals?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Сигналы</h4>
              <ul className="space-y-1">
                {result.signals.map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 bg-white/80 rounded-lg px-3 py-1.5 border border-gray-100">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠️ {result.error}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Summary strip ──────────────────────────────────────────────────────────
function SummaryStrip({ results }) {
  const green  = results.filter(r => r.color === 'green').length
  const yellow = results.filter(r => r.color === 'yellow').length
  const red    = results.filter(r => r.color === 'red').length
  const avg    = results.length ? Math.round(results.reduce((s, r) => s + r.total_score, 0) / results.length) : 0

  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: 'Средний скор', value: avg,    sub: 'из 100',         cls: 'text-blue-600'   },
        { label: 'Входить',      value: green,  sub: 'категорий 🟢',  cls: 'text-green-600'  },
        { label: 'Мониторить',   value: yellow, sub: 'категорий 🟡',  cls: 'text-yellow-600' },
        { label: 'Избегать',     value: red,    sub: 'категорий 🔴',  cls: 'text-red-600'    },
      ].map(({ label, value, sub, cls }) => (
        <div key={label} className="card p-3 text-center">
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`text-2xl font-bold mt-0.5 ${cls}`}>{value}</p>
          <p className="text-xs text-gray-400">{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── Category path picker ───────────────────────────────────────────────────
function PathPicker({ selected, onChange }) {
  const [input, setInput] = useState('')

  function add() {
    const v = input.trim()
    if (v && !selected.includes(v)) {
      onChange([...selected, v])
    }
    setInput('')
  }

  function remove(path) {
    onChange(selected.filter(p => p !== path))
  }

  const QUICK = [
    'Красота и здоровье/Уход за лицом',
    'Красота и здоровье/Уход за телом',
    'Красота и здоровье/Уход за волосами',
    'Красота и здоровье/Декоративная косметика',
    'Дом и сад/Декор и интерьер',
    'Спорт и отдых/Спортивное питание',
  ]

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-600">
        Категории для анализа * <span className="text-gray-400">(макс. 20)</span>
      </label>

      {/* Quick picks */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => !selected.includes(p) && onChange([...selected, p])}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors
              ${selected.includes(p)
                ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
          >
            {p.split('/').pop()}
          </button>
        ))}
      </div>

      {/* Manual input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Красота и здоровье/Парфюмерия"
          className="input text-xs"
        />
        <button type="button" onClick={add} disabled={!input.trim() || selected.length >= 20}
          className="btn-secondary text-xs px-3 whitespace-nowrap">
          + Добавить
        </button>
      </div>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selected.map(p => (
            <span key={p} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full pl-2.5 pr-1 py-0.5">
              <span className="truncate max-w-[180px]">{p.split('/').pop()}</span>
              <button onClick={() => remove(p)} className="rounded-full hover:bg-blue-200 p-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ProgressBar ────────────────────────────────────────────────────────────
function ProgressBar({ progress, done }) {
  const pct = progress.total > 0 ? Math.round(progress.current / progress.total * 100) : 0
  return (
    <div className="card p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {!done && (
            <span className="inline-block w-3.5 h-3.5 flex-shrink-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          {done && <span className="text-green-500 text-sm flex-shrink-0">✓</span>}
          <span className="text-sm text-gray-600 truncate">
            {done
              ? <span className="text-green-700 font-medium">Анализ завершён</span>
              : <><span className="text-gray-400">Анализируем:</span> <strong className="text-gray-800">{progress.name}</strong></>
            }
          </span>
        </div>
        <span className="text-xs tabular-nums text-gray-400 flex-shrink-0 ml-3">
          {progress.current} / {progress.total}
        </span>
      </div>

      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${done ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {!done && progress.current > 0 && (
        <p className="text-xs text-gray-400">
          Осталось {progress.total - progress.current} кат.
          {progress.current > 1 && ` · уже готово ${progress.current - 1}`}
        </p>
      )}
    </div>
  )
}

// ── LimitsStrip ────────────────────────────────────────────────────────────
function LimitsStrip({ limits }) {
  if (!limits) return null
  const { limit, used, available } = limits
  if (available === -1) return null   // неизвестно — не показываем

  const usedPct  = limit > 0 ? Math.round(used / limit * 100) : 0
  const low      = available < 50
  const warn     = available < 200

  return (
    <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 border
      ${low  ? 'bg-red-50 border-red-200 text-red-700'
      : warn ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
             : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
      <span className="flex-1">
        Лимит MPStats: <strong>{limit.toLocaleString('ru')}</strong>
        {' / использовано: '}<strong>{used.toLocaleString('ru')}</strong>
        {' / доступно: '}<strong className={low ? 'text-red-600' : warn ? 'text-yellow-600' : ''}>{available.toLocaleString('ru')}</strong>
      </span>
      {/* usage bar */}
      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
        <div
          className={`h-full rounded-full ${low ? 'bg-red-500' : warn ? 'bg-yellow-400' : 'bg-green-500'}`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
      <span className="tabular-nums">{usedPct}%</span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
const DEFAULT_PATHS = [
  'Красота и здоровье/Уход за лицом',
  'Красота и здоровье/Уход за телом',
]

export default function ScoringPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [paths,    setPaths]    = useState(DEFAULT_PATHS)
  const [budget,   setBudget]   = useState('150000')
  const [cogs,     setCogs]     = useState('400')
  const [schema,   setSchema]   = useState('FBO')
  const [drr,      setDrr]      = useState('10')
  const [results,  setResults]  = useState([])
  const [progress, setProgress] = useState(null)   // null | {current, total, name}
  const [done,     setDone]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [expanded, setExpanded] = useState({})
  const [limits,   setLimits]   = useState(null)   // null | {limit, used, available}
  const abortRef = useRef(null)

  // Загрузить лимиты MPStats при монтировании
  useEffect(() => {
    fetchLimits().then(setLimits).catch(() => {})
  }, [])

  // Добавить категорию из URL-параметра ?path=...
  useEffect(() => {
    const urlPath = searchParams.get('path')
    if (urlPath && !paths.includes(urlPath)) {
      setPaths(prev => [urlPath, ...prev.filter(p => p !== urlPath)])
    }
    if (urlPath) setSearchParams({}, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleExpand = useCallback((path) => {
    setExpanded(e => ({ ...e, [path]: !e[path] }))
  }, [])

  async function run(e) {
    e.preventDefault()
    if (paths.length === 0) return

    setLoading(true)
    setError(null)
    setResults([])
    setProgress(null)
    setDone(false)
    setExpanded({})

    try {
      const stream = scoreStream({
        paths,
        budget_rub:   parseInt(budget)  || 0,
        avg_cogs_rub: parseInt(cogs)    || 0,
        schema,
        target_drr:   parseFloat(drr)   || 0,
      })

      for await (const ev of stream) {
        if (ev.type === 'limits') {
          setLimits({ limit: ev.limit, used: ev.used, available: ev.available })

        } else if (ev.type === 'progress') {
          setProgress({ current: ev.current, total: ev.total, name: ev.name })

        } else if (ev.type === 'result') {
          setResults(prev => {
            const next = [...prev, ev].sort((a, b) => b.total_score - a.total_score)
            // Авто-раскрыть первый зелёный результат
            if (ev.color === 'green') {
              setExpanded(ex => Object.keys(ex).length === 0 ? { [ev.path]: true } : ex)
            }
            return next
          })

        } else if (ev.type === 'timeout') {
          setError(ev.message)
          setDone(true)

        } else if (ev.type === 'error') {
          if (ev.code === 'limit_exceeded') {
            setError(`🚫 ${ev.message}`)
          } else {
            setError(ev.message)
          }

        } else if (ev.type === 'done') {
          setDone(true)
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const hasResults = results.length > 0

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Title */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Скоринг категорий</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Введите параметры вашего бизнеса — алгоритм оценит привлекательность каждой категории
          </p>
        </div>
        {limits && limits.available !== -1 && (
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400">Лимит MPStats</p>
            <p className={`text-sm font-semibold tabular-nums ${limits.available < 50 ? 'text-red-600' : limits.available < 200 ? 'text-yellow-600' : 'text-green-600'}`}>
              {limits.available.toLocaleString('ru')} / {limits.limit.toLocaleString('ru')}
            </p>
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={run} className="card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Параметры бизнеса</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Бюджет, ₽</label>
              <input value={budget} onChange={e => setBudget(e.target.value)}
                type="number" min="0" placeholder="150000" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Себестоимость, ₽ <span className="text-gray-400 font-normal">(за ед.)</span>
              </label>
              <input value={cogs} onChange={e => setCogs(e.target.value)}
                type="number" min="0" placeholder="400" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Схема работы</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                {['FBO', 'FBS'].map(s => (
                  <button key={s} type="button" onClick={() => setSchema(s)}
                    className={`flex-1 py-2 text-sm font-medium transition-colors
                      ${schema === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Целевой ДРР, % <span className="text-gray-400 font-normal">(реклама)</span>
              </label>
              <input value={drr} onChange={e => setDrr(e.target.value)}
                type="number" min="0" max="100" step="0.5" placeholder="10" className="input" />
            </div>
          </div>
        </div>

        {cogs && budget && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
            <span>Мин. партия: <strong>{(parseInt(cogs) * 30).toLocaleString('ru')} ₽</strong></span>
            <span>Бюджет / партия: <strong>{Math.floor(parseInt(budget) / (parseInt(cogs) * 30)) || 0} шт</strong></span>
            <span className="text-gray-400">Логистика {schema}: <strong>{schema === 'FBO' ? '200' : '80'} ₽/ед</strong></span>
            <span className="text-gray-400">Комиссия Ozon: <strong>15%</strong></span>
          </div>
        )}

        <hr className="border-gray-100" />
        <PathPicker selected={paths} onChange={setPaths} />

        <LimitsStrip limits={limits} />

        {limits && limits.available !== -1 && limits.available < 50 && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ⛔ Лимит MPStats исчерпан (доступно {limits.available} запросов). Скоринг недоступен до завтра.
          </div>
        )}

        {(() => {
          const limitsExhausted = limits && limits.available !== -1 && limits.available < 50
          return (
            <button type="submit" disabled={loading || paths.length === 0 || limitsExhausted}
              className="btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading
                ? <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>
                    {progress ? `Анализируем ${progress.current}/${progress.total}…` : 'Запускаем…'}</>
                : `🔍 Рассчитать скор (${paths.length} ${paths.length === 1 ? 'категория' : 'категорий'})`}
            </button>
          )
        })()}
      </form>

      {/* Error */}
      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Progress bar — видна пока загружаем */}
      {progress && (
        <ProgressBar progress={progress} done={done} />
      )}

      {/* Empty state — только если ничего нет и не грузим */}
      {!loading && !hasResults && !error && !progress && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">🎯</p>
          <p className="font-medium text-gray-500">Настройте параметры и нажмите «Рассчитать скор»</p>
          <p className="text-sm mt-1">Алгоритм проверит каждую категорию по 5 критериям</p>
        </div>
      )}

      {/* Results — появляются по мере готовности */}
      {hasResults && (
        <div className="space-y-4">
          <SummaryStrip results={results} />

          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Результаты{' '}
              <span className="text-gray-400 font-normal text-sm">
                ({results.length}{loading && progress ? `/${progress.total}` : ''} категорий)
              </span>
            </h2>
            <div className="flex gap-2">
              <button onClick={() => setExpanded(Object.fromEntries(results.map(r => [r.path, true])))}
                className="text-xs text-blue-600 hover:underline">Раскрыть все</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setExpanded({})}
                className="text-xs text-gray-500 hover:underline">Свернуть</button>
            </div>
          </div>

          <div className="space-y-2">
            {results.map(r => (
              <CategoryCard
                key={r.path}
                result={r}
                expanded={!!expanded[r.path]}
                onToggle={() => toggleExpand(r.path)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
