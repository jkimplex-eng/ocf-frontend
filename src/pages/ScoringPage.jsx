import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { scoreStream, fetchLimits } from '../api/client'

// ── Dark theme palette ────────────────────────────────────────────────────────
const D = {
  bg0:    '#0f1117',
  bg1:    '#1a1d27',
  bg2:    '#22263a',
  border: 'rgba(255,255,255,0.08)',
  text1:  '#f1f5f9',
  text2:  '#94a3b8',
  text3:  '#475569',
  accent: '#6366f1',
  green:  '#22c55e',
  red:    '#ef4444',
  amber:  '#f59e0b',
  teal:   '#14b8a6',
}

// ── Format ────────────────────────────────────────────────────────────────────
const rub = v => {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)} тыс ₽`
  return `${n.toLocaleString('ru')} ₽`
}
const pct = (v, d = 1) => v == null ? '—' : `${Number(v).toFixed(d)}%`

// ── Component score keys ──────────────────────────────────────────────────────
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

// ── Small UI helpers ──────────────────────────────────────────────────────────
function DarkField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', color: D.text2, marginBottom: '6px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function DarkInput({ value, onChange, type = 'text', placeholder, width = '130px' }) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        width, boxSizing: 'border-box',
        background: D.bg2, border: `1px solid ${D.border}`,
        borderRadius: '8px', color: D.text1,
        padding: '8px 12px', fontSize: '13px', fontFamily: 'monospace', outline: 'none',
      }}
    />
  )
}

// ── Score bar (horizontal) ────────────────────────────────────────────────────
function HBar({ value, max = 100, height = 8, color }) {
  const fill = Math.min(100, Math.max(0, (value / max) * 100))
  const c = color || (fill > 70 ? D.green : fill >= 40 ? D.accent : D.red)
  return (
    <div style={{ flex: 1, height, background: 'rgba(255,255,255,0.06)', borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{ width: `${fill}%`, height: '100%', background: c, borderRadius: height / 2, transition: 'width 0.7s ease' }} />
    </div>
  )
}

// ── PathPicker (dark) ─────────────────────────────────────────────────────────
function PathPicker({ selected, onChange }) {
  const [input, setInput] = useState('')

  const add = path => {
    if (path && !selected.includes(path) && selected.length < 20)
      onChange([...selected, path])
  }
  const remove = path => onChange(selected.filter(p => p !== path))

  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', color: D.text2, marginBottom: '10px' }}>
        Категории для анализа <span style={{ color: D.text3 }}>(макс. 20)</span>
      </label>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
        {QUICK_PATHS.map(p => {
          const active = selected.includes(p)
          return (
            <button key={p} type="button" onClick={() => active ? remove(p) : add(p)}
              style={{
                fontSize: '12px', padding: '4px 10px', borderRadius: '9999px',
                cursor: 'pointer', border: `1px solid ${active ? D.accent : D.border}`,
                background: active ? D.accent + '28' : 'transparent',
                color: active ? D.accent : D.text2, transition: 'all 0.15s',
              }}>
              {p.split('/').pop()}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input.trim()); setInput('') } }}
          placeholder="Красота и здоровье/Парфюмерия"
          style={{
            flex: 1, background: D.bg2, border: `1px solid ${D.border}`,
            borderRadius: '8px', color: D.text1, padding: '8px 12px',
            fontSize: '13px', outline: 'none',
          }}
        />
        <button type="button" onClick={() => { add(input.trim()); setInput('') }}
          disabled={!input.trim() || selected.length >= 20}
          style={{
            padding: '8px 12px', background: D.bg2, border: `1px solid ${D.border}`,
            borderRadius: '8px', color: D.text2, fontSize: '13px', cursor: 'pointer',
          }}>
          + Добавить
        </button>
      </div>

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
          {selected.map(p => (
            <span key={p} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: D.accent + '22', border: `1px solid ${D.accent}55`,
              borderRadius: '9999px', padding: '3px 8px 3px 10px',
              fontSize: '12px', color: D.accent,
            }}>
              <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.split('/').pop()}
              </span>
              <button onClick={() => remove(p)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: D.accent, padding: '0 2px', fontSize: '15px', lineHeight: 1,
              }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Progress header ───────────────────────────────────────────────────────────
function ProgressHeader({ progress, done, mpLimitError }) {
  const fillPct = progress.total > 0 ? Math.round(progress.current / progress.total * 100) : 0
  return (
    <div style={{ background: D.bg1, border: `1px solid ${D.border}`, borderRadius: '14px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', color: done ? D.green : D.text2, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!done && <span className="animate-spin" style={{ display: 'inline-block', width: '14px', height: '14px', border: `2px solid ${D.accent}`, borderTopColor: 'transparent', borderRadius: '50%' }} />}
          {done
            ? '✓ Анализ завершён'
            : <>Анализируем <strong style={{ color: D.text1 }}>{progress.name}</strong>… {progress.current}/{progress.total}</>
          }
        </span>
        <span style={{ fontSize: '13px', fontFamily: 'monospace', color: D.text2 }}>{fillPct}%</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          width: `${fillPct}%`, height: '100%', borderRadius: '3px',
          background: done ? D.green : D.accent, transition: 'width 0.5s ease',
        }} />
      </div>
      {mpLimitError && (
        <div style={{ marginTop: '12px', padding: '8px 12px', background: D.amber + '18', border: `1px solid ${D.amber}44`, borderRadius: '8px', fontSize: '12px', color: D.amber }}>
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
  const color = available < 50 ? D.red : available < 200 ? D.amber : D.green
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: D.text3 }}>
      <span>Лимит MPStats: <strong style={{ color: D.text2 }}>{limit.toLocaleString('ru')}</strong></span>
      <span>использовано: <strong style={{ color: D.text2 }}>{used.toLocaleString('ru')}</strong></span>
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
        { label: 'Средний скор', value: avg,    unit: 'из 100', color: D.accent },
        { label: 'Входить',      value: green,  unit: 'кат.',   color: D.green  },
        { label: 'Мониторить',   value: yellow, unit: 'кат.',   color: D.amber  },
        { label: 'Избегать',     value: red,    unit: 'кат.',   color: D.red    },
      ].map(item => (
        <div key={item.label} style={{
          background: D.bg1, border: `1px solid ${D.border}`,
          borderRadius: '12px', padding: '14px 16px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '11px', color: D.text3, marginBottom: '4px' }}>{item.label}</p>
          <p style={{ fontSize: '26px', fontWeight: 700, color: item.color, fontFamily: 'monospace' }}>{item.value}</p>
          <p style={{ fontSize: '11px', color: D.text3 }}>{item.unit}</p>
        </div>
      ))}
    </div>
  )
}

// ── Score breakdown (left detail card) ────────────────────────────────────────
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
    <div style={{ background: D.bg1, border: `1px solid ${D.border}`, borderRadius: '12px', padding: '16px' }}>
      <p style={{ fontSize: '12px', color: D.text2, marginBottom: '14px' }}>
        Разбор скора{' '}
        <span style={{ fontSize: '20px', fontWeight: 700, color: D.text1, fontFamily: 'monospace' }}>{score}</span>
        <span style={{ color: D.text3 }}>/100</span>
      </p>

      {components.length === 0 && (
        <p style={{ fontSize: '12px', color: D.text3 }}>Компоненты недоступны</p>
      )}

      {components.map(({ key, label, weight, comp }) => {
        const fillPct = comp.pct ?? Math.round((comp.score / comp.max) * 100)
        const barColor = fillPct > 70 ? D.green : fillPct >= 40 ? D.accent : D.amber
        return (
          <div key={key} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '12px', color: D.text2 }}>{label}</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: D.text1 }}>
                  {comp.score}/{comp.max}
                </span>
                <span style={{ fontSize: '10px', color: D.text3 }}>вес {weight}%</span>
              </div>
            </div>
            <HBar value={fillPct} height={8} color={barColor} />
          </div>
        )
      })}

      {weakest && (
        <div style={{
          marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${D.border}`,
          fontSize: '11px', color: D.amber, lineHeight: 1.5,
        }}>
          ↓ Слабое место: <strong style={{ color: D.text1 }}>{weakest.label}</strong>
          {' — '}{weakest.comp.signal || WEAKNESS_HINT[weakest.key] || 'требует внимания'}
        </div>
      )}
    </div>
  )
}

// ── Unit economics (right detail card) ────────────────────────────────────────
function UnitEconCard({ result, budget, costPrice, schema, targetDrr }) {
  const avg_price = result.metrics?.avg_price || 0

  if (!avg_price) {
    return (
      <div style={{
        background: D.bg1, border: `1px solid ${D.border}`,
        borderRadius: '12px', padding: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <p style={{ color: D.text3, fontSize: '13px' }}>Нет данных MPStats</p>
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
    { label: 'Средняя цена в категории',               value: rub(avg_price),        color: D.text1 },
    { label: `Комиссия Ozon (${(commission_rate * 100).toFixed(0)}%)`, value: `-${rub(commission)}`, color: D.red },
    { label: `Логистика ${schema}`,                    value: `-${rub(logistics)}`,  color: D.red },
    { label: `Реклама (ДРР ${targetDrr}%)`,            value: `-${rub(ad_spend)}`,   color: D.accent },
    { label: 'Себестоимость',                          value: `-${rub(costPrice)}`,  color: D.amber },
    null,
    { label: 'Прибыль с единицы',  value: rub(profit_per_unit), color: isLoss ? D.red : D.green, bold: true, large: true },
    { label: 'Маржа',              value: `${margin_pct}%`,     color: isLoss ? D.red : D.green },
    { label: 'Партий на бюджет',   value: `${units.toLocaleString('ru')} шт`, color: D.text1 },
    { label: 'Потенциальная прибыль', value: rub(total_profit), color: isLoss ? D.red : D.green },
    ...(payback_days != null ? [{ label: 'Окупаемость', value: `${payback_days} дней`, color: D.text2 }] : []),
  ]

  return (
    <div style={{ background: D.bg1, border: `1px solid ${D.border}`, borderRadius: '12px', padding: '16px' }}>
      <p style={{ fontSize: '12px', color: D.text2, marginBottom: '14px' }}>Unit экономика</p>

      {isLoss && (
        <div style={{
          padding: '8px 12px', marginBottom: '12px',
          background: D.red + '18', border: `1px solid ${D.red}44`,
          borderRadius: '8px', fontSize: '12px', color: D.red,
        }}>
          ⚠ Убыточно при текущих параметрах
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {rows.map((row, i) => {
          if (!row) return (
            <hr key={i} style={{ border: 'none', borderTop: `1px solid ${D.border}`, margin: '3px 0' }} />
          )
          return (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: D.text3, flexShrink: 0 }}>{row.label}</span>
              <span style={{
                fontSize: row.large ? '15px' : '12px', fontFamily: 'monospace',
                fontWeight: row.bold ? 700 : 400, color: row.color,
                textAlign: 'right',
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

// ── Recommendation card (bottom, best category) ───────────────────────────────
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
    text = `Категория растёт, маржинальность высокая (${marginPct.toFixed(1)}%). Рекомендуем входить в ближайшие 1-2 месяца. ДРР ${targetDrr}% вписывается в юнит-экономику — конкуренция управляема.`
  else if (score > 70)
    text = `Категория перспективная, но маржа под давлением (${marginPct.toFixed(1)}%). Входить можно — важно снизить себестоимость или ДРР. Рассмотрите FBO для снижения логистики.`
  else if (score >= 40)
    text = `Категория умеренная (скор ${score}/100), входить с осторожностью. Проведите дополнительный анализ конкурентов перед запуском. Маржа ${marginPct.toFixed(1)}%.`
  else
    text = `Высокие риски входа: скор ${score}/100 указывает на насыщенный рынок или слабый рост. Рассмотрите альтернативные категории или дождитесь изменения конъюнктуры.`

  const btns = [
    { label: 'Топ товары →',           onClick: () => navigate(`/categories?path=${encodeURIComponent(result.path)}`) },
    { label: 'Анализ конкурентов →',   onClick: () => navigate('/brands') },
    { label: 'Создать гипотезу →',     onClick: () => navigate(`/hypotheses?category=${encodeURIComponent(result.name)}`) },
  ]

  return (
    <div style={{
      background: D.bg1, borderRadius: '14px',
      border: `1px solid ${D.border}`, borderLeft: `3px solid ${D.green}`,
      padding: '20px',
    }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: D.text1, marginBottom: '8px' }}>
        ★ Рекомендация: входить в «{name}»
      </h3>
      <p style={{ fontSize: '13px', color: D.text2, lineHeight: 1.65, marginBottom: '16px' }}>{text}</p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {btns.map(btn => (
          <button key={btn.label} onClick={btn.onClick}
            style={{
              padding: '8px 16px', background: 'transparent',
              border: `1px solid ${D.border}`, borderRadius: '8px',
              color: D.text2, fontSize: '13px', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = D.accent; e.currentTarget.style.color = D.text1 }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = D.border;  e.currentTarget.style.color = D.text2 }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Category row (comparison bar + expandable detail) ─────────────────────────
function CategoryRow({ result, isTop, budget, costPrice, schema, targetDrr }) {
  const [expanded, setExpanded] = useState(false)

  const score    = result.total_score
  const barColor = score > 70 ? D.green : score >= 40 ? D.accent : D.red
  const badge    = score > 70
    ? { label: 'Входить',    color: D.green }
    : score >= 40
    ? { label: 'Мониторить', color: D.amber }
    : { label: 'Избегать',   color: D.red   }

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setExpanded(p => !p)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px', cursor: 'pointer', border: 'none',
          background: expanded ? D.bg2 : 'transparent',
          textAlign: 'left', transition: 'background 0.2s',
        }}
      >
        {/* Star */}
        <span style={{ width: '16px', flexShrink: 0, color: '#fbbf24', fontSize: '14px', textAlign: 'center' }}>
          {isTop ? '★' : ''}
        </span>

        {/* Name */}
        <span style={{
          width: '160px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 500, color: D.text1,
        }} title={result.name}>
          {result.name.split('/').pop()}
        </span>

        {/* Bar */}
        <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${score}%`, height: '100%', background: barColor, borderRadius: '4px', transition: 'width 0.8s ease' }} />
        </div>

        {/* Score number */}
        <span style={{ width: '36px', flexShrink: 0, textAlign: 'right', fontSize: '16px', fontWeight: 700, color: barColor, fontFamily: 'monospace' }}>
          {score}
        </span>

        {/* Badge */}
        <span style={{
          flexShrink: 0, fontSize: '11px', fontFamily: 'monospace',
          padding: '2px 8px', borderRadius: '9999px', whiteSpace: 'nowrap',
          background: badge.color + '22', color: badge.color, border: `1px solid ${badge.color}55`,
        }}>
          {badge.label}
        </span>

        {/* Chevron */}
        <svg style={{
          width: '14px', height: '14px', flexShrink: 0, color: D.text3,
          transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none',
        }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${D.border}`,
          background: D.bg2, padding: '16px',
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

  const [paths,       setPaths]       = useState(DEFAULT_PATHS)
  const [budget,      setBudget]      = useState('150000')
  const [cogs,        setCogs]        = useState('400')
  const [schema,      setSchema]      = useState('FBO')
  const [drr,         setDrr]         = useState('10')
  const [results,     setResults]     = useState([])
  const [progress,    setProgress]    = useState(null)
  const [done,        setDone]        = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [limits,      setLimits]      = useState(null)
  const [mpLimitError,setMpLimitError]= useState(false)

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
    <div
      style={{ background: D.bg0, color: D.text1, minHeight: 'calc(100vh - 56px)' }}
      className="-mx-4 sm:-mx-6 -my-6 px-4 sm:px-6 py-6"
    >
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: D.text1 }}>Скоринг категорий</h1>
            <p style={{ fontSize: '14px', color: D.text2, marginTop: '4px' }}>
              Введите параметры — алгоритм оценит привлекательность каждой категории по 5 критериям
            </p>
          </div>
          {limits && limits.available !== -1 && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '11px', color: D.text3 }}>Лимит MPStats</p>
              <p style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', color: limits.available < 50 ? D.red : limits.available < 200 ? D.amber : D.green }}>
                {limits.available.toLocaleString('ru')} / {limits.limit.toLocaleString('ru')}
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={run} style={{ background: D.bg1, border: `1px solid ${D.border}`, borderRadius: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <DarkField label="Бюджет ₽">
              <DarkInput value={budget} onChange={setBudget} type="number" placeholder="150000" />
            </DarkField>

            <DarkField label="Себестоимость ₽/ед.">
              <DarkInput value={cogs} onChange={setCogs} type="number" placeholder="400" />
            </DarkField>

            <DarkField label="Схема работы">
              <div style={{ display: 'flex', border: `1px solid ${D.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                {['FBO', 'FBS'].map(s => (
                  <button key={s} type="button" onClick={() => setSchema(s)}
                    style={{
                      padding: '8px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none',
                      background: schema === s ? D.accent : 'transparent',
                      color: schema === s ? 'white' : D.text2,
                      borderRight: s === 'FBO' ? `1px solid ${D.border}` : 'none',
                      transition: 'background 0.15s',
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </DarkField>

            <DarkField label="Целевой ДРР %">
              <DarkInput value={drr} onChange={setDrr} type="number" placeholder="10" width="90px" />
            </DarkField>

            <button type="submit" disabled={loading || paths.length === 0 || !!limitsExhausted}
              style={{
                marginLeft: 'auto', alignSelf: 'flex-end',
                padding: '10px 22px', background: D.accent, border: 'none',
                borderRadius: '10px', color: 'white', fontSize: '14px',
                fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                opacity: (loading || paths.length === 0 || limitsExhausted) ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
              {loading
                ? <><span className="animate-spin" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />Рассчитываем…</>
                : `Рассчитать скор (${paths.length}) →`}
            </button>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${D.border}` }}>
            <PathPicker selected={paths} onChange={setPaths} />
          </div>

          {limits && limits.available !== -1 && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${D.border}` }}>
              <LimitsInfo limits={limits} />
            </div>
          )}

          {limitsExhausted && (
            <div style={{ marginTop: '10px', padding: '10px 14px', background: D.red + '18', border: `1px solid ${D.red}44`, borderRadius: '8px', fontSize: '12px', color: D.red }}>
              ⛔ Лимит MPStats исчерпан (доступно {limits.available} запросов). Скоринг недоступен до завтра.
            </div>
          )}
        </form>

        {/* Error */}
        {error && (
          <div style={{ background: D.red + '18', border: `1px solid ${D.red}44`, borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: D.red }}>
            ⚠️ {error}
          </div>
        )}

        {/* Progress */}
        {progress && (
          <ProgressHeader progress={progress} done={done} mpLimitError={mpLimitError} />
        )}

        {/* Alerts (after results appear) */}
        {hasResults && (allLoss || drrHigh) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allLoss && (
              <div style={{ background: D.amber + '18', border: `1px solid ${D.amber}44`, borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: D.amber }}>
                ⚠ Себестоимость слишком высокая для этих категорий — попробуйте снизить или выбрать другие категории
              </div>
            )}
            {drrHigh && (
              <div style={{ background: D.amber + '18', border: `1px solid ${D.amber}44`, borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: D.amber }}>
                ⚠ ДРР выше 30% — реклама съест всю маржу
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasResults && !error && !progress && (
          <div style={{ textAlign: 'center', padding: '72px 0', color: D.text3 }}>
            <p style={{ fontSize: '52px', marginBottom: '16px' }}>🎯</p>
            <p style={{ fontSize: '16px', color: D.text2, fontWeight: 500 }}>Настройте параметры и нажмите «Рассчитать скор»</p>
            <p style={{ fontSize: '13px', color: D.text3, marginTop: '6px' }}>Алгоритм проверит каждую категорию по 5 критериям</p>
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <>
            <SummaryStrip results={results} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: D.text1 }}>
                Сравнение категорий{' '}
                <span style={{ color: D.text3, fontWeight: 400, fontSize: '13px' }}>
                  ({results.length}{loading && progress ? `/${progress.total}` : ''})
                </span>
              </span>
            </div>

            {/* Comparison bars container */}
            <div style={{ background: D.bg1, border: `1px solid ${D.border}`, borderRadius: '14px', overflow: 'hidden' }}>
              {results.map((r, i) => (
                <React.Fragment key={r.path}>
                  {i > 0 && <div style={{ height: '1px', background: D.border }} />}
                  <CategoryRow
                    result={r}
                    isTop={i === 0}
                    budget={budgetN}
                    costPrice={cogsN}
                    schema={schema}
                    targetDrr={drrN}
                  />
                </React.Fragment>
              ))}
            </div>

            {/* Recommendation — shown after streaming ends */}
            {done && bestResult && (
              <RecommendationCard
                result={bestResult}
                budget={budgetN}
                costPrice={cogsN}
                schema={schema}
                targetDrr={drrN}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
