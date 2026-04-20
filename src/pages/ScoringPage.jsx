import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { scoreStream, fetchLimits } from '../api/client'

// ── Format ────────────────────────────────────────────────────────────────────
const rub = v => {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)} тыс ₽`
  return `${n.toLocaleString('ru')} ₽`
}
const pct = (v, d = 1) => v == null ? '—' : `${Number(v).toFixed(d)}%`

// ── Constants ─────────────────────────────────────────────────────────────────
const COMP_KEYS = [
  { key: 'growth_index',      label: 'Рост категории',  weight: 25 },
  { key: 'competition_index', label: 'Конкуренция',     weight: 25 },
  { key: 'entry_barrier',     label: 'Барьер входа',    weight: 20 },
  { key: 'margin',            label: 'Маржинальность',  weight: 20 },
  { key: 'seasonal',          label: 'Сезонность',      weight: 10 },
]

const WEAKNESS_HINT = {
  growth_index:      'низкий рост категории — рынок замедляется',
  competition_index: 'высокая конкуренция — сложно занять позицию',
  entry_barrier:     'высокий барьер входа — нужен бюджет на отзывы',
  margin:            'низкая маржинальность — юнит-экономика под вопросом',
  seasonal:          'выраженная сезонность — риск сезонных остатков',
}

const QUICK_PATHS = [
  'Красота и здоровье/Уход за лицом',
  'Красота и здоровье/Уход за телом',
  'Красота и здоровье/Уход за волосами',
  'Красота и здоровье/Декоративная косметика',
  'Дом и сад/Декор и интерьер',
  'Спорт и отдых/Спортивное питание',
]

const DEFAULT_PATHS = [
  'Красота и здоровье/Уход за лицом',
  'Красота и здоровье/Уход за телом',
]

// ── Input ─────────────────────────────────────────────────────────────────────
function AppleInput({ label, value, onChange, type = 'text', placeholder, width = '130px' }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text2)', marginBottom: '6px' }}>
        {label}
      </label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width, boxSizing: 'border-box',
          background: 'var(--bg3)', border: `1px solid ${focused ? 'var(--blue)' : 'var(--glass-border)'}`,
          borderRadius: '10px', color: 'var(--text1)',
          padding: '9px 14px', fontSize: '14px', fontFamily: 'var(--font)', outline: 'none',
          boxShadow: focused ? '0 0 0 3px rgba(0,113,227,0.2)' : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      />
    </div>
  )
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function HBar({ value, max = 100, height = 8, color }) {
  const fill = Math.min(100, Math.max(0, (value / max) * 100))
  const c = color || (fill > 70 ? 'var(--green)' : fill >= 40 ? 'var(--blue)' : 'var(--red)')
  return (
    <div style={{ flex: 1, height, background: 'rgba(255,255,255,0.06)', borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{ width: `${fill}%`, height: '100%', background: c, borderRadius: height / 2, transition: 'width 0.7s ease' }} />
    </div>
  )
}

// ── PathPicker ────────────────────────────────────────────────────────────────
function PathPicker({ selected, onChange }) {
  const [input, setInput] = useState('')

  const add = path => {
    if (path && !selected.includes(path) && selected.length < 20)
      onChange([...selected, path])
  }
  const remove = path => onChange(selected.filter(p => p !== path))

  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text2)', marginBottom: '10px' }}>
        Категории для анализа <span style={{ color: 'var(--text3)' }}>(макс. 20)</span>
      </label>

      {/* Quick chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {QUICK_PATHS.map(p => {
          const active = selected.includes(p)
          return (
            <button key={p} type="button" onClick={() => active ? remove(p) : add(p)} style={{
              fontSize: '12px', padding: '5px 14px', borderRadius: '20px',
              cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 500,
              border: `1px solid ${active ? 'var(--blue)' : 'var(--glass-border)'}`,
              background: active ? 'rgba(0,113,227,0.15)' : 'transparent',
              color: active ? 'var(--blue-light)' : 'var(--text2)',
              transition: 'all 0.15s',
            }}>
              {p.split('/').pop()}
            </button>
          )
        })}
      </div>

      {/* Custom input */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input.trim()); setInput('') } }}
          placeholder="Красота и здоровье/Парфюмерия"
          style={{
            flex: 1, background: 'var(--bg3)', border: '1px solid var(--glass-border)',
            borderRadius: '10px', color: 'var(--text1)', padding: '9px 14px',
            fontSize: '13px', fontFamily: 'var(--font)', outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.2)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--glass-border)'; e.target.style.boxShadow = 'none' }}
        />
        <button type="button" onClick={() => { add(input.trim()); setInput('') }}
          disabled={!input.trim() || selected.length >= 20}
          style={{
            padding: '9px 16px', background: 'var(--glass)', border: '1px solid var(--glass-border)',
            borderRadius: '10px', color: 'var(--text2)', fontSize: '13px',
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>
          + Добавить
        </button>
      </div>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
          {selected.map(p => (
            <span key={p} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: 'rgba(0,113,227,0.15)', border: '1px solid rgba(0,113,227,0.35)',
              borderRadius: '20px', padding: '3px 8px 3px 12px',
              fontSize: '12px', color: 'var(--blue-light)',
            }}>
              <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.split('/').pop()}
              </span>
              <button onClick={() => remove(p)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--blue-light)', padding: '0 2px', fontSize: '15px', lineHeight: 1,
              }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Progress ──────────────────────────────────────────────────────────────────
function ProgressBar({ progress, done, mpLimitError }) {
  const fillPct = progress.total > 0 ? Math.round(progress.current / progress.total * 100) : 0
  return (
    <div>
      {/* Thin top bar */}
      <div style={{ height: '2px', background: 'var(--glass)', borderRadius: '1px', overflow: 'hidden', marginBottom: '10px' }}>
        <div style={{
          width: `${fillPct}%`, height: '100%', borderRadius: '1px',
          background: done ? 'var(--green)' : 'var(--blue)',
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: done ? 'var(--green)' : 'var(--text2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!done && (
            <span style={{
              display: 'inline-block', width: '14px', height: '14px', flexShrink: 0,
              border: '2px solid var(--blue)', borderTopColor: 'transparent', borderRadius: '50%',
            }} className="animate-spin" />
          )}
          {done
            ? '✓ Анализ завершён'
            : <>Анализируем <strong style={{ color: 'var(--text1)' }}>{progress.name}</strong>… {progress.current}/{progress.total}</>
          }
        </span>
        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text3)' }}>{fillPct}%</span>
      </div>
      {mpLimitError && (
        <div style={{
          marginTop: '10px', padding: '8px 12px',
          background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.2)',
          borderRadius: '10px', fontSize: '12px', color: 'var(--amber)',
        }}>
          ⚠ Лимит MPStats исчерпан, данные частичные
        </div>
      )}
    </div>
  )
}

// ── Limits info ───────────────────────────────────────────────────────────────
function LimitsInfo({ limits }) {
  const { limit, used, available } = limits
  const usedPct = limit > 0 ? Math.round(used / limit * 100) : 0
  const color = available < 50 ? 'var(--red)' : available < 200 ? 'var(--amber)' : 'var(--green)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text3)' }}>
      <span>MPStats: <strong style={{ color: 'var(--text2)' }}>{limit.toLocaleString('ru')}</strong></span>
      <span>использовано: <strong style={{ color: 'var(--text2)' }}>{used.toLocaleString('ru')}</strong></span>
      <span>доступно: <strong style={{ color }}>{available.toLocaleString('ru')}</strong></span>
      <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${usedPct}%`, height: '100%', background: color, borderRadius: '2px' }} />
      </div>
    </div>
  )
}

// ── Summary strip ─────────────────────────────────────────────────────────────
function SummaryStrip({ results }) {
  const green  = results.filter(r => r.color === 'green').length
  const yellow = results.filter(r => r.color === 'yellow').length
  const red    = results.filter(r => r.color === 'red').length
  const avg    = results.length ? Math.round(results.reduce((s, r) => s + r.total_score, 0) / results.length) : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
      {[
        { label: 'Средний скор', value: avg,    unit: 'из 100', color: 'var(--blue-light)' },
        { label: 'Входить',      value: green,  unit: 'кат.',   color: 'var(--green)'  },
        { label: 'Мониторить',   value: yellow, unit: 'кат.',   color: 'var(--amber)'  },
        { label: 'Избегать',     value: red,    unit: 'кат.',   color: 'var(--red)'    },
      ].map(item => (
        <div key={item.label} className="apple-card" style={{ padding: '16px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px' }}>{item.label}</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: item.color, letterSpacing: '-1px', lineHeight: 1 }}>
            {item.value}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>{item.unit}</p>
        </div>
      ))}
    </div>
  )
}

// ── Score breakdown ───────────────────────────────────────────────────────────
function ScoreBreakdown({ result }) {
  const score = result.total_score
  const components = COMP_KEYS.map(k => {
    const comp = result.components?.[k.key]
    return comp ? { ...k, comp } : null
  }).filter(Boolean)

  const weakest = components.length > 0
    ? [...components].sort((a, b) => (a.comp.pct ?? 0) - (b.comp.pct ?? 0))[0]
    : null

  return (
    <div style={{
      background: 'var(--glass)', border: '1px solid var(--glass-border)',
      borderRadius: '12px', padding: '16px',
    }}>
      <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '14px' }}>
        Разбор скора{' '}
        <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.5px' }}>{score}</span>
        <span style={{ color: 'var(--text3)' }}>/100</span>
      </p>

      {components.length === 0 && (
        <p style={{ fontSize: '12px', color: 'var(--text3)' }}>Компоненты недоступны</p>
      )}

      {components.map(({ key, label, weight, comp }) => {
        const fillPct = comp.pct ?? Math.round((comp.score / comp.max) * 100)
        const barColor = fillPct > 70 ? 'var(--green)' : fillPct >= 40 ? 'var(--blue)' : 'var(--amber)'
        return (
          <div key={key} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{label}</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text1)' }}>
                  {comp.score}/{comp.max}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text3)' }}>вес {weight}%</span>
              </div>
            </div>
            <HBar value={fillPct} height={8} color={barColor} />
          </div>
        )
      })}

      {weakest && (
        <div style={{
          marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)',
          fontSize: '11px', color: 'var(--amber)', lineHeight: 1.5,
        }}>
          ↓ Слабое место: <strong style={{ color: 'var(--text1)' }}>{weakest.label}</strong>
          {' — '}{weakest.comp.signal || WEAKNESS_HINT[weakest.key] || 'требует внимания'}
        </div>
      )}
    </div>
  )
}

// ── Unit economics ────────────────────────────────────────────────────────────
function UnitEconCard({ result, budget, costPrice, schema, targetDrr }) {
  const avg_price = result.metrics?.avg_price || 0

  if (!avg_price) {
    return (
      <div style={{
        background: 'var(--glass)', border: '1px solid var(--glass-border)',
        borderRadius: '12px', padding: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <p style={{ color: 'var(--text3)', fontSize: '13px' }}>Нет данных MPStats</p>
      </div>
    )
  }

  const commission_rate = result.metrics?.commission_rate || 0.15
  const logistics       = result.metrics?.logistics_cost  || (schema === 'FBO' ? 200 : 80)
  const commission      = avg_price * commission_rate
  const ad_spend        = avg_price * (targetDrr / 100)
  const profit_per_unit = avg_price - commission - logistics - ad_spend - costPrice
  const margin_pct      = (profit_per_unit / avg_price * 100).toFixed(1)
  const units           = Math.floor(budget / avg_price)
  const total_profit    = profit_per_unit * units
  const isLoss          = profit_per_unit < 0

  const avgRevPerProduct = (result.metrics?.revenue_30d || 0) / Math.max(result.metrics?.total_products || 1, 1)
  const payback_days = profit_per_unit > 0 && avg_price > 0 && avgRevPerProduct > 0
    ? Math.round(budget / (profit_per_unit * (avgRevPerProduct / avg_price / 30)))
    : null

  const rows = [
    { label: 'Средняя цена в категории',               value: rub(avg_price),        color: 'var(--text1)' },
    { label: `Комиссия Ozon (${(commission_rate * 100).toFixed(0)}%)`, value: `-${rub(commission)}`, color: 'var(--red)' },
    { label: `Логистика ${schema}`,                    value: `-${rub(logistics)}`,  color: 'var(--red)' },
    { label: `Реклама (ДРР ${targetDrr}%)`,            value: `-${rub(ad_spend)}`,   color: 'var(--blue-light)' },
    { label: 'Себестоимость',                          value: `-${rub(costPrice)}`,  color: 'var(--amber)' },
    null,
    { label: 'Прибыль с единицы',  value: rub(profit_per_unit), color: isLoss ? 'var(--red)' : 'var(--green)', bold: true, large: true },
    { label: 'Маржа',              value: `${margin_pct}%`,     color: isLoss ? 'var(--red)' : 'var(--green)' },
    { label: 'Партий на бюджет',   value: `${units.toLocaleString('ru')} шт`, color: 'var(--text1)' },
    { label: 'Потенциальная прибыль', value: rub(total_profit), color: isLoss ? 'var(--red)' : 'var(--green)' },
    ...(payback_days != null ? [{ label: 'Окупаемость', value: `${payback_days} дней`, color: 'var(--text2)' }] : []),
  ]

  return (
    <div style={{
      background: 'var(--glass)', border: '1px solid var(--glass-border)',
      borderRadius: '12px', padding: '16px',
    }}>
      <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '14px' }}>Unit экономика</p>

      {isLoss && (
        <div style={{
          padding: '8px 12px', marginBottom: '12px',
          background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)',
          borderRadius: '8px', fontSize: '12px', color: 'var(--red)',
        }}>
          ⚠ Убыточно при текущих параметрах
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {rows.map((row, i) => {
          if (!row) return (
            <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '3px 0' }} />
          )
          return (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text3)', flexShrink: 0 }}>{row.label}</span>
              <span style={{
                fontSize: row.large ? '15px' : '12px', fontFamily: 'monospace',
                fontWeight: row.bold ? 700 : 400, color: row.color, textAlign: 'right',
              }}>
                {row.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Recommendation card ───────────────────────────────────────────────────────
function RecommendationCard({ result, budget, costPrice, schema, targetDrr }) {
  const navigate = useNavigate()

  const avg_price       = result.metrics?.avg_price || 0
  const commission_rate = result.metrics?.commission_rate || 0.15
  const logistics       = result.metrics?.logistics_cost || (schema === 'FBO' ? 200 : 80)
  const ad_spend        = avg_price * (targetDrr / 100)
  const profit          = avg_price - avg_price * commission_rate - logistics - ad_spend - costPrice
  const marginPct       = avg_price > 0 ? profit / avg_price * 100 : 0
  const score           = result.total_score
  const name            = result.name.split('/').pop()

  let text
  if (score > 70 && marginPct > 20)
    text = `Категория растёт, маржинальность высокая (${marginPct.toFixed(1)}%). Рекомендуем входить в ближайшие 1-2 месяца. ДРР ${targetDrr}% вписывается в юнит-экономику.`
  else if (score > 70)
    text = `Категория перспективная, но маржа под давлением (${marginPct.toFixed(1)}%). Входить можно — важно снизить себестоимость или ДРР.`
  else if (score >= 40)
    text = `Категория умеренная (скор ${score}/100), входить с осторожностью. Проведите дополнительный анализ конкурентов. Маржа ${marginPct.toFixed(1)}%.`
  else
    text = `Высокие риски входа: скор ${score}/100 указывает на насыщенный рынок. Рассмотрите альтернативные категории.`

  const btns = [
    { label: 'Топ товары →',         onClick: () => navigate(`/categories?path=${encodeURIComponent(result.path)}`) },
    { label: 'Анализ конкурентов →', onClick: () => navigate('/brands') },
    { label: 'Создать гипотезу →',   onClick: () => navigate(`/hypotheses?category=${encodeURIComponent(result.name)}`) },
  ]

  return (
    <div style={{
      background: 'var(--glass)', borderRadius: '18px',
      border: '1px solid var(--glass-border)',
      borderLeft: '3px solid var(--green)',
      padding: '20px',
    }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text1)', marginBottom: '8px' }}>
        ★ Рекомендация: входить в «{name}»
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.65, marginBottom: '16px' }}>{text}</p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {btns.map(btn => (
          <button key={btn.label} onClick={btn.onClick} className="btn-secondary">
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Category row ──────────────────────────────────────────────────────────────
function CategoryRow({ result, isTop, budget, costPrice, schema, targetDrr }) {
  const [expanded, setExpanded] = useState(false)

  const score    = result.total_score
  const barColor = score > 70
    ? 'rgba(48,209,88,0.6)'
    : score >= 40
    ? 'rgba(0,113,227,0.5)'
    : 'rgba(255,69,58,0.5)'

  const badge = score > 70
    ? { label: 'Входить',    color: 'var(--green)',  bg: 'rgba(48,209,88,0.1)',  border: 'rgba(48,209,88,0.3)'  }
    : score >= 40
    ? { label: 'Мониторить', color: 'var(--amber)',  bg: 'rgba(255,214,10,0.1)', border: 'rgba(255,214,10,0.3)' }
    : { label: 'Избегать',   color: 'var(--red)',    bg: 'rgba(255,69,58,0.1)',  border: 'rgba(255,69,58,0.3)'  }

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>
      <button
        type="button"
        onClick={() => setExpanded(p => !p)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px', cursor: 'pointer', border: 'none',
          background: expanded ? 'rgba(255,255,255,0.03)' : 'transparent',
          textAlign: 'left', transition: 'background 0.2s', fontFamily: 'var(--font)',
        }}
      >
        {/* Star */}
        <span style={{ width: '16px', flexShrink: 0, color: 'var(--amber)', fontSize: '14px', textAlign: 'center' }}>
          {isTop ? '★' : ''}
        </span>

        {/* Name */}
        <span style={{
          width: '160px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 500, color: 'var(--text1)',
        }} title={result.name}>
          {result.name.split('/').pop()}
        </span>

        {/* Progress bar (20px height per spec) */}
        <div style={{
          flex: 1, height: '20px', background: 'rgba(255,255,255,0.06)',
          borderRadius: '6px', overflow: 'hidden',
        }}>
          <div style={{
            width: `${score}%`, height: '100%', background: barColor,
            borderRadius: '6px', transition: 'width 0.8s ease',
          }} />
        </div>

        {/* Score */}
        <span style={{
          width: '36px', flexShrink: 0, textAlign: 'right', fontSize: '16px',
          fontWeight: 700, color: 'var(--text1)', fontFamily: 'monospace',
        }}>
          {score}
        </span>

        {/* Badge */}
        <span style={{
          flexShrink: 0, fontSize: '11px', fontWeight: 500,
          padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap',
          background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
          fontFamily: 'var(--font)',
        }}>
          {badge.label}
        </span>

        {/* Chevron */}
        <svg style={{
          width: '14px', height: '14px', flexShrink: 0, color: 'var(--text3)',
          transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none',
        }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Expanded */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--glass-border)',
          background: 'var(--glass)', padding: '16px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
        }}>
          <ScoreBreakdown result={result} />
          <UnitEconCard
            result={result} budget={budget} costPrice={costPrice}
            schema={schema} targetDrr={targetDrr}
          />
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ScoringPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [paths,        setPaths]        = useState(DEFAULT_PATHS)
  const [budget,       setBudget]       = useState('150000')
  const [cogs,         setCogs]         = useState('400')
  const [schema,       setSchema]       = useState('FBO')
  const [drr,          setDrr]          = useState('10')
  const [results,      setResults]      = useState([])
  const [progress,     setProgress]     = useState(null)
  const [done,         setDone]         = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [limits,       setLimits]       = useState(null)
  const [mpLimitError, setMpLimitError] = useState(false)

  useEffect(() => { fetchLimits().then(setLimits).catch(() => {}) }, [])

  useEffect(() => {
    const urlPath = searchParams.get('path')
    if (urlPath && !paths.includes(urlPath))
      setPaths(prev => [urlPath, ...prev.filter(p => p !== urlPath)])
    if (urlPath) setSearchParams({}, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const budgetN = parseInt(budget)  || 0
  const cogsN   = parseInt(cogs)    || 0
  const drrN    = parseFloat(drr)   || 0

  const allLoss = useMemo(() => {
    if (results.length === 0) return false
    const withData = results.filter(r => (r.metrics?.avg_price || 0) > 0)
    if (withData.length === 0) return false
    return withData.every(r => {
      const p = r.metrics.avg_price
      return p - p * (r.metrics.commission_rate || 0.15)
           - (r.metrics.logistics_cost || (schema === 'FBO' ? 200 : 80))
           - p * (drrN / 100) - cogsN < 0
    })
  }, [results, cogsN, schema, drrN])

  async function run(e) {
    e.preventDefault()
    if (paths.length === 0) return
    setLoading(true); setError(null); setResults([])
    setProgress(null); setDone(false); setMpLimitError(false)

    try {
      const stream = scoreStream({ paths, budget_rub: budgetN, avg_cogs_rub: cogsN, schema, target_drr: drrN })
      for await (const ev of stream) {
        if (ev.type === 'limits') {
          setLimits({ limit: ev.limit, used: ev.used, available: ev.available })
        } else if (ev.type === 'progress') {
          setProgress({ current: ev.current, total: ev.total, name: ev.name })
        } else if (ev.type === 'result') {
          setResults(prev => [...prev, ev].sort((a, b) => b.total_score - a.total_score))
        } else if (ev.type === 'timeout' || ev.type === 'error') {
          if (ev.code === 'limit_exceeded') setMpLimitError(true)
          else setError(ev.message)
          setDone(true)
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
  const bestResult = results[0]
  const drrHigh    = drrN > 30
  const limitsExhausted = limits && limits.available !== -1 && limits.available < 50

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.5px' }}>
            Скоринг категорий
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text2)', marginTop: '4px' }}>
            Введите параметры — алгоритм оценит привлекательность по 5 критериям
          </p>
        </div>
        {limits && limits.available !== -1 && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: '11px', color: 'var(--text3)' }}>Лимит MPStats</p>
            <p style={{
              fontSize: '14px', fontWeight: 600, fontFamily: 'monospace',
              color: limits.available < 50 ? 'var(--red)' : limits.available < 200 ? 'var(--amber)' : 'var(--green)',
            }}>
              {limits.available.toLocaleString('ru')} / {limits.limit.toLocaleString('ru')}
            </p>
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={run} className="apple-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <AppleInput label="Бюджет ₽" value={budget} onChange={setBudget} type="number" placeholder="150000" />
          <AppleInput label="Себестоимость ₽/ед." value={cogs} onChange={setCogs} type="number" placeholder="400" width="150px" />

          {/* FBO/FBS toggle */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text2)', marginBottom: '6px' }}>
              Схема работы
            </label>
            <div style={{
              display: 'flex', background: 'var(--bg3)', borderRadius: '10px',
              padding: '3px', gap: '2px',
            }}>
              {['FBO', 'FBS'].map(s => (
                <button key={s} type="button" onClick={() => setSchema(s)} style={{
                  padding: '7px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  border: 'none', fontFamily: 'var(--font)',
                  background: schema === s ? 'var(--blue)' : 'transparent',
                  color: schema === s ? 'white' : 'var(--text2)',
                  borderRadius: '8px',
                  transition: 'all 0.15s',
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <AppleInput label="Целевой ДРР %" value={drr} onChange={setDrr} type="number" placeholder="10" width="90px" />

          <button type="submit" disabled={loading || paths.length === 0 || !!limitsExhausted}
            className="btn-primary"
            style={{
              marginLeft: 'auto', alignSelf: 'flex-end', padding: '10px 24px', fontSize: '14px',
              opacity: (loading || paths.length === 0 || limitsExhausted) ? 0.5 : 1,
            }}>
            {loading
              ? <><span className="animate-spin" style={{
                  display: 'inline-block', width: '14px', height: '14px', marginRight: '8px',
                  border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%',
                }} />Рассчитываем…</>
              : `Рассчитать (${paths.length}) →`}
          </button>
        </div>

        {/* PathPicker */}
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
          <PathPicker selected={paths} onChange={setPaths} />
        </div>

        {/* Limits */}
        {limits && limits.available !== -1 && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--glass-border)' }}>
            <LimitsInfo limits={limits} />
          </div>
        )}

        {limitsExhausted && (
          <div style={{
            marginTop: '10px', padding: '10px 14px',
            background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)',
            borderRadius: '10px', fontSize: '12px', color: 'var(--red)',
          }}>
            ⛔ Лимит MPStats исчерпан (доступно {limits.available}). Скоринг недоступен до завтра.
          </div>
        )}
      </form>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: '12px', fontSize: '13px', color: 'var(--red)',
          background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div className="apple-card" style={{ padding: '16px' }}>
          <ProgressBar progress={progress} done={done} mpLimitError={mpLimitError} />
        </div>
      )}

      {/* Alerts */}
      {hasResults && (allLoss || drrHigh) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {allLoss && (
            <div style={{
              padding: '12px 16px', borderRadius: '12px', fontSize: '13px', color: 'var(--amber)',
              background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.2)',
            }}>
              ⚠ Себестоимость слишком высокая — попробуйте снизить или выбрать другие категории
            </div>
          )}
          {drrHigh && (
            <div style={{
              padding: '12px 16px', borderRadius: '12px', fontSize: '13px', color: 'var(--amber)',
              background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.2)',
            }}>
              ⚠ ДРР выше 30% — реклама съест всю маржу
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasResults && !error && !progress && (
        <div style={{ textAlign: 'center', padding: '72px 0', color: 'var(--text3)' }}>
          <p style={{ fontSize: '52px', marginBottom: '16px' }}>🎯</p>
          <p style={{ fontSize: '16px', color: 'var(--text2)', fontWeight: 500 }}>
            Настройте параметры и нажмите «Рассчитать»
          </p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>
            Алгоритм проверит каждую категорию по 5 критериям
          </p>
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <>
          <SummaryStrip results={results} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text1)' }}>
              Сравнение категорий{' '}
              <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '13px' }}>
                ({results.length}{loading && progress ? `/${progress.total}` : ''})
              </span>
            </span>
          </div>

          {/* Category list */}
          <div className="apple-card" style={{ overflow: 'hidden' }}>
            {results.map((r, i) => (
              <React.Fragment key={r.path}>
                {i > 0 && <div style={{ height: '1px', background: 'var(--glass-border)' }} />}
                <CategoryRow
                  result={r} isTop={i === 0}
                  budget={budgetN} costPrice={cogsN}
                  schema={schema} targetDrr={drrN}
                />
              </React.Fragment>
            ))}
          </div>

          {/* Recommendation */}
          {done && bestResult && (
            <RecommendationCard
              result={bestResult} budget={budgetN} costPrice={cogsN}
              schema={schema} targetDrr={drrN}
            />
          )}
        </>
      )}
    </div>
  )
}
