import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { BarChart, Bar, XAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { fetchPlSummary, saveCogs, bulkSaveCogs } from '../api/client'
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

// ── Linear trend ──────────────────────────────────────────────────────────────
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

// ── Date utils ────────────────────────────────────────────────────────────────
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

// ── SKU status ────────────────────────────────────────────────────────────────
function skuStatus(row) {
  if (!row.cost_per_unit)
    return { label: 'Нет данных', bg: 'rgba(255,255,255,0.06)', color: 'var(--text3)', border: 'var(--glass-border)' }
  if (row.profit < 0)
    return { label: 'Убыточный', bg: 'rgba(255,69,58,0.1)', color: 'var(--red)', border: 'rgba(255,69,58,0.3)' }
  if (row.margin_pct > 50 && row.units > 50)
    return { label: 'Звезда', bg: 'rgba(48,209,88,0.1)', color: 'var(--green)', border: 'rgba(48,209,88,0.3)' }
  if (row.returns != null && row.revenue > 0 && (row.returns / row.revenue) > 0.15)
    return { label: 'Возвраты', bg: 'rgba(255,159,10,0.1)', color: 'var(--amber)', border: 'rgba(255,159,10,0.3)' }
  if (row.margin_pct < 15)
    return { label: 'Под давлением', bg: 'rgba(255,214,10,0.1)', color: 'var(--amber)', border: 'rgba(255,214,10,0.3)' }
  return null
}

function SkuStatusBadge({ row }) {
  const s = skuStatus(row)
  if (!s) return <span style={{ fontSize: '11px', color: 'var(--text3)' }}>—</span>
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
      whiteSpace: 'nowrap', display: 'inline-block', fontWeight: 500,
    }}>
      {s.label}
    </span>
  )
}

// ── Delta ─────────────────────────────────────────────────────────────────────
function Delta({ v, isPp }) {
  if (v == null) return null
  const up = v >= 0
  return (
    <span style={{ fontSize: '12px', fontWeight: 500, color: up ? 'var(--green)' : 'var(--red)' }}>
      {up ? '▲' : '▼'} {Math.abs(v).toFixed(1)}{isPp ? ' п.п.' : '%'}
    </span>
  )
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function KpiCards({ s, prev }) {
  function deltaRel(cur, prevVal) {
    if (!prev || prevVal == null || prevVal === 0) return null
    return ((cur - prevVal) / Math.abs(prevVal)) * 100
  }
  function deltaPp(cur, prevVal) {
    if (!prev || prevVal == null) return null
    return cur - prevVal
  }

  const items = [
    { label: 'Выручка',  value: rub(s.revenue),         delta: deltaRel(s.revenue, prev?.revenue) },
    { label: 'Прибыль',  value: rub(s.profit),           delta: deltaRel(s.profit, prev?.profit),
      color: s.profit >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'Маржа',    value: pct(s.margin_pct),       delta: deltaPp(s.margin_pct, prev?.margin_pct),
      isPp: true, color: 'var(--amber)' },
    { label: 'Продажи',  value: `${num(s.units)} шт`,    delta: deltaRel(s.units, prev?.units) },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
      {items.map(({ label, value, delta, color, isPp }, i) => (
        <div key={label} className={`apple-card animate animate-${i + 1}`} style={{ padding: '20px' }}>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text2)', marginBottom: '10px' }}>
            {label}
          </p>
          <p style={{
            fontSize: '28px', fontWeight: 700, letterSpacing: '-1px',
            color: color || 'var(--text1)', lineHeight: 1,
          }}>
            {value}
          </p>
          {delta != null && (
            <div style={{ marginTop: '6px' }}>
              <Delta v={delta} isPp={isPp} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Gross Profit Chart ────────────────────────────────────────────────────────
const CHART_PERIODS = ['7д', '30д', '90д']

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--glass-border)',
      borderRadius: '10px', padding: '8px 14px', fontSize: '12px',
      fontFamily: 'var(--font)',
    }}>
      <p style={{ color: 'var(--text2)', marginBottom: '2px' }}>{label}</p>
      <p style={{ fontWeight: 700, color: 'var(--text1)' }}>{rub(payload[0].value)}</p>
    </div>
  )
}

function GrossProfitChart({ byDay }) {
  const [period, setPeriod] = useState('30д')

  const days = useMemo(() => {
    const n = period === '7д' ? 7 : period === '30д' ? 30 : 90
    return byDay.slice(-n)
  }, [byDay, period])

  const values   = days.map(d => d.profit || 0)
  const avg      = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0
  const best     = values.length ? Math.max(...values) : 0
  const worst    = values.length ? Math.min(...values) : 0
  const trend    = values.length >= 2 ? linearTrend(values) : { slope: 0 }
  const trendPct = avg !== 0 ? (trend.slope / Math.abs(avg) * 100) : 0

  const getBarColor = v => {
    if (v > avg) return 'rgba(48,209,88,0.7)'
    if (v >= 0)  return 'rgba(0,113,227,0.5)'
    return 'rgba(255,255,255,0.12)'
  }

  const chartData = days.map(d => ({ day: date(d.date), value: d.profit || 0 }))
  const xInterval = days.length > 30 ? 13 : days.length > 14 ? 4 : 0

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text1)' }}>Прибыль по дням</p>
          <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
            {days.length} дней · среднее {rub(avg)}
          </p>
        </div>
        <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
          {CHART_PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
              border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
              background: period === p ? 'var(--bg4)' : 'transparent',
              color: period === p ? 'var(--text1)' : 'var(--text2)',
              transition: 'all 0.2s',
            }}>{p}</button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={chartData} barCategoryGap="18%" margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="day"
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'var(--font)' }}
            axisLine={false} tickLine={false} interval={xInterval}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={getBarColor(entry.value)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
        marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)',
      }}>
        {[
          { label: 'Лучший день', value: rub(best),  color: 'var(--green)' },
          { label: 'Среднее',     value: rub(avg),   color: 'var(--text1)' },
          { label: 'Худший',      value: rub(worst), color: worst < 0 ? 'var(--red)' : 'var(--text1)' },
          { label: 'Тренд',       value: `${trendPct >= 0 ? '↑' : '↓'} ${Math.abs(trendPct).toFixed(1)}%`,
            color: trendPct >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>{label}</p>
            <p style={{ fontSize: '13px', fontWeight: 700, color, letterSpacing: '-0.3px' }}>{value}</p>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Decomposition Card ────────────────────────────────────────────────────────
function DecompositionCard({ s }) {
  const rows = [
    { label: 'Выручка',   value: rub(s.revenue),                                       color: 'var(--blue-light)' },
    { label: 'Комиссия',  value: s.commission  ? `-${rub(s.commission)}`  : '—',       color: 'var(--red)' },
    { label: 'Логистика', value: s.logistics   ? `-${rub(s.logistics)}`   : '—',       color: 'var(--red)' },
    { label: 'Возвраты',  value: s.returns     ? `-${rub(s.returns)}`     : '—',       color: 'var(--red)' },
    { label: 'Реклама',   value: s.ad_spend && Math.abs(s.ad_spend) > 0 ? `-${rub(Math.abs(s.ad_spend))}` : '—', color: 'var(--purple)' },
    null,
    { label: 'Прибыль',   value: rub(s.profit), color: s.profit >= 0 ? 'var(--green)' : 'var(--red)', bold: true },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {rows.map((row, i) => {
        if (!row) return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '4px 0' }} />
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text2)' }}>{row.label}</span>
            <span style={{
              fontSize: '13px', fontWeight: row.bold ? 700 : 500, color: row.color,
              fontFamily: 'monospace', letterSpacing: '-0.3px',
            }}>{row.value}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Top 3 SKU ─────────────────────────────────────────────────────────────────
function Top3Sku({ skus }) {
  const top3 = [...skus]
    .filter(s => s.cost_per_unit)
    .sort((a, b) => b.margin_pct - a.margin_pct)
    .slice(0, 3)

  if (top3.length === 0) return (
    <p style={{ fontSize: '12px', color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>
      Заполните себестоимость для анализа
    </p>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {top3.map((sku, i) => (
        <div key={sku.sku_id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
            background: 'var(--glass)', border: '1px solid var(--glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', color: 'var(--text3)', fontWeight: 600,
          }}>{i + 1}</span>
          <span style={{
            flex: 1, fontSize: '12px', color: 'var(--text1)', fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {sku.name || `SKU ${sku.sku_id}`}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>
            {pct(sku.margin_pct)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', bottom: '28px', right: '28px', zIndex: 500,
      background: 'rgba(48,209,88,0.14)', border: '1px solid rgba(48,209,88,0.35)',
      borderRadius: '14px', padding: '12px 20px',
      fontSize: '14px', fontWeight: 600, color: 'var(--green)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', gap: '8px',
      animation: 'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both',
      fontFamily: 'var(--font)',
    }}>
      ✓ {message}
    </div>
  )
}

// ── Excel parse helpers ───────────────────────────────────────────────────────
function detectColumns(firstRow) {
  const lower = {}
  Object.keys(firstRow).forEach(k => { lower[k.toLowerCase().trim()] = k })

  const articleKey =
    lower['артикул'] ?? lower['артикул продавца'] ?? lower['article'] ??
    lower['sku'] ?? lower['sku_id'] ?? lower['код товара'] ?? null

  const costKey =
    lower['себестоимость'] ?? lower['цена закупки'] ?? lower['закупочная цена'] ??
    lower['cost'] ?? lower['cost_price'] ?? lower['цена'] ?? null

  const nameKey =
    lower['название'] ?? lower['наименование'] ?? lower['название товара'] ??
    lower['name'] ?? lower['товар'] ?? null

  return { articleKey, costKey, nameKey }
}

function parseExcelRows(rows) {
  if (!rows.length) return []
  const { articleKey, costKey, nameKey } = detectColumns(rows[0])

  return rows.map((row, i) => {
    const article   = articleKey ? String(row[articleKey] ?? '').trim() : ''
    const rawCost   = costKey    ? row[costKey]                          : null
    const name      = nameKey    ? String(row[nameKey]  ?? '').trim()   : ''
    const cost_price = rawCost != null && rawCost !== '' ? parseFloat(String(rawCost).replace(',', '.')) : null
    const error =
      !article                         ? 'Нет артикула'      :
      cost_price == null || isNaN(cost_price) ? 'Нет себестоимости' : null
    return { _row: i + 2, article, cost_price: cost_price ?? 0, name, error }
  })
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ rows, onConfirm, onCancel, saving }) {
  const valid   = rows.filter(r => !r.error)
  const invalid = rows.filter(r =>  r.error)

  const thStyle = {
    padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '0.3px',
    borderBottom: '1px solid var(--glass-border)', textAlign: 'left',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--glass-border-md)',
        borderRadius: '20px', width: '580px', maxWidth: '100%',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        animation: 'fadeUp 0.3s cubic-bezier(0.22,1,0.36,1) both',
        fontFamily: 'var(--font)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid var(--glass-border)',
        }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text1)', margin: 0 }}>
              Импорт себестоимости · {valid.length} товаров
            </h2>
            {invalid.length > 0 && (
              <p style={{ fontSize: '12px', color: 'var(--red)', marginTop: '4px' }}>
                {invalid.length} строк с ошибками — они не будут сохранены
              </p>
            )}
          </div>
          <button onClick={onCancel} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', fontSize: '22px', lineHeight: 1, padding: '4px',
          }}>×</button>
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Артикул</th>
                <th style={thStyle}>Название</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Себестоимость ₽</th>
                <th style={thStyle}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: row.error ? 'rgba(255,69,58,0.06)' : 'transparent',
                }}>
                  <td style={{
                    padding: '8px 12px', fontSize: '12px', fontFamily: 'monospace',
                    color: row.error ? 'var(--red)' : 'var(--text1)',
                  }}>
                    {row.article || <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td style={{
                    padding: '8px 12px', fontSize: '12px', color: 'var(--text2)',
                    maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row.name || <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td style={{
                    padding: '8px 12px', fontSize: '12px', fontFamily: 'monospace',
                    textAlign: 'right',
                    color: row.error ? 'var(--text3)' : 'var(--text1)',
                    fontWeight: row.error ? 400 : 600,
                  }}>
                    {row.error === 'Нет себестоимости' ? '—' : `${Number(row.cost_price).toLocaleString('ru')} ₽`}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {row.error
                      ? <span style={{
                          fontSize: '11px', color: 'var(--red)',
                          background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.25)',
                          borderRadius: '8px', padding: '2px 8px',
                        }}>{row.error}</span>
                      : <span style={{
                          fontSize: '11px', color: 'var(--green)',
                          background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.25)',
                          borderRadius: '8px', padding: '2px 8px',
                        }}>Ок</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
          padding: '16px 24px', borderTop: '1px solid var(--glass-border)',
        }}>
          <button onClick={onCancel} className="btn-secondary" style={{ borderRadius: '12px' }}>
            Отмена
          </button>
          <button
            onClick={() => onConfirm(valid)}
            disabled={saving || valid.length === 0}
            className="btn-primary"
            style={{ borderRadius: '12px', padding: '9px 22px' }}
          >
            {saving
              ? <><span style={{
                  display: 'inline-block', width: '13px', height: '13px', marginRight: '8px',
                  border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                  borderRadius: '50%',
                }} className="animate-spin" />Сохраняем…</>
              : `Сохранить ${valid.length} товаров`
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── COGS editor ───────────────────────────────────────────────────────────────
function CogsEditor({ skus, onSaved }) {
  const [vals,        setVals]        = useState(() =>
    Object.fromEntries(skus.map(s => [s.sku_id, String(s.cost_per_unit ?? s.cost ?? 0)]))
  )
  const [saving,      setSaving]      = useState(false)
  const [flash,       setFlash]       = useState(false)
  const [importRows,  setImportRows]  = useState(null)   // null = modal closed
  const [importSaving,setImportSaving]= useState(false)
  const [toast,       setToast]       = useState(null)
  const fileRef = useRef(null)

  // Parse file when selected
  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''                        // allow re-select same file
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(new Uint8Array(buf), { type: 'array' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    setImportRows(parseExcelRows(rows))
  }

  // Confirm bulk save
  const handleImportConfirm = useCallback(async (validRows) => {
    setImportSaving(true)
    try {
      const items = validRows.map(r => ({
        article:    r.article,
        cost_price: r.cost_price,
        name:       r.name,
      }))
      const res = await bulkSaveCogs(items)
      setImportRows(null)
      const n = (res.updated ?? 0) + (res.created ?? 0)
      setToast(`Обновлено ${n} товаров`)
      onSaved()
    } catch (err) {
      setToast(`Ошибка: ${err.message}`)
    } finally {
      setImportSaving(false)
    }
  }, [onSaved])

  // Download template
  function downloadTemplate() {
    const data = skus.map(s => ({
      'Артикул':       s.sku_id,
      'Название':      s.name || '',
      'Себестоимость': s.cost_per_unit || '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Себестоимость')
    XLSX.writeFile(wb, 'cogs_template.xlsx')
  }

  // Manual save (per-row inputs)
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
    } finally { setSaving(false) }
  }

  if (!skus.length) return (
    <p style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center', padding: '24px 0' }}>
      Загрузите P&amp;L — SKU появятся здесь
    </p>
  )

  const btnGhost = {
    background: 'transparent', border: '1px solid var(--glass-border)',
    borderRadius: '12px', padding: '8px 18px',
    fontSize: '13px', fontWeight: 500, color: 'var(--text2)',
    cursor: 'pointer', fontFamily: 'var(--font)',
    transition: 'all 0.2s',
  }

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }} onChange={handleFileChange}
      />

      {/* Import modal */}
      {importRows && (
        <ImportModal
          rows={importRows}
          saving={importSaving}
          onConfirm={handleImportConfirm}
          onCancel={() => setImportRows(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* Header row: title + import/template buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text2)' }}>
          Укажите закупочную цену для каждого SKU
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={downloadTemplate}
            style={btnGhost}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass)'; e.currentTarget.style.color = 'var(--text1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            ↓ Скачать шаблон
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            style={btnGhost}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass)'; e.currentTarget.style.color = 'var(--text1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            ↑ Импорт из Excel
          </button>
        </div>
      </div>

      {/* SKU rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {skus.map(s => (
          <div key={s.sku_id} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text1)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name || s.sku_id}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'monospace', marginTop: '2px' }}>
                SKU {s.sku_id}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <input type="number" min="0" step="10"
                value={vals[s.sku_id] ?? 0}
                onChange={e => setVals(p => ({ ...p, [s.sku_id]: e.target.value }))}
                className="input"
                style={{ width: '96px', textAlign: 'right', padding: '6px 10px', fontSize: '13px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text3)', width: '32px' }}>₽/шт</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingTop: '12px' }}>
        <p style={{ fontSize: '12px', color: 'var(--text3)' }}>
          После сохранения P&amp;L пересчитается автоматически
        </p>
        <button onClick={save} disabled={saving} className="btn-primary"
          style={{ background: flash ? 'var(--green)' : 'var(--blue)', padding: '8px 20px', fontSize: '13px' }}>
          {saving ? 'Сохраняем…' : flash ? '✓ Сохранено' : 'Сохранить'}
        </button>
      </div>
    </>
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

  const xc = i => PX + (i  / (total - 1 || 1)) * (W - 2 * PX)
  const yc = v => PY + (1 - (v - minV) / vR)   * (H - 2 * PY)

  const histPath = historical.map((v, i) => `${i ? 'L' : 'M'}${xc(i).toFixed(1)},${yc(v).toFixed(1)}`).join('')
  const forecastPath = [
    `M${xc(historical.length - 1).toFixed(1)},${yc(historical.at(-1)).toFixed(1)}`,
    ...forecast.map((v, i) => `L${xc(historical.length + i).toFixed(1)},${yc(v).toFixed(1)}`),
  ].join('')
  const splitX  = xc(historical.length - 1)
  const areaPath = `${histPath} L${xc(historical.length - 1)},${H - PY} L${PX},${H - PY} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '120px' }}>
      <defs>
        <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--blue)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#fg)" />
      <path d={histPath}     fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d={forecastPath} fill="none" stroke="var(--blue)" strokeWidth="1.8"
        strokeDasharray="5 4" opacity="0.4" strokeLinejoin="round" />
      <line x1={splitX} y1={PY} x2={splitX} y2={H - PY}
        stroke="var(--glass-border-md)" strokeWidth="1" strokeDasharray="3 3" />
    </svg>
  )
}

// ── Forecast tab ──────────────────────────────────────────────────────────────
function ForecastTab({ byDay }) {
  if (!byDay || byDay.length < 3) return (
    <p style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center', padding: '32px 0' }}>
      Недостаточно данных — нужно минимум 3 дня
    </p>
  )

  const revenues = byDay.map(d => d.revenue || 0)
  const profits  = byDay.map(d => d.profit  || 0)
  const n = revenues.length

  const revTrend  = linearTrend(revenues)
  const profTrend = linearTrend(profits)

  const fcRevs  = Array.from({ length: 30 }, (_, i) => Math.max(0, revTrend.intercept  + revTrend.slope  * (n + i)))
  const fcProfs = Array.from({ length: 30 }, (_, i) => profTrend.intercept + profTrend.slope * (n + i))

  const totalFcRev  = fcRevs.reduce((s, v)  => s + v, 0)
  const totalFcProf = fcProfs.reduce((s, v) => s + v, 0)
  const avgCur      = revenues.reduce((s, v) => s + v, 0) / n
  const avgFc       = totalFcRev / 30
  const trendChange = avgCur > 0 ? ((avgFc - avgCur) / avgCur * 100) : 0
  const trendDown   = revTrend.slope < 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="apple-card" style={{ padding: '20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px' }}>
            Прогноз выручки (след. 30 дней)
          </p>
          <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--blue-light)', letterSpacing: '-0.5px' }}>
            {rub(totalFcRev)}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>
            ±15%: {rub(totalFcRev * 0.85)} — {rub(totalFcRev * 1.15)}
          </p>
        </div>
        <div className="apple-card" style={{ padding: '20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px' }}>
            Прогноз прибыли (след. 30 дней)
          </p>
          <p style={{
            fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px',
            color: totalFcProf >= 0 ? 'var(--green)' : 'var(--red)',
          }}>
            {rub(totalFcProf)}
          </p>
        </div>
      </div>

      <div style={{
        padding: '12px 16px', borderRadius: '12px', fontSize: '13px',
        background: trendDown ? 'rgba(255,69,58,0.08)' : 'rgba(48,209,88,0.08)',
        border: `1px solid ${trendDown ? 'rgba(255,69,58,0.2)' : 'rgba(48,209,88,0.2)'}`,
        color: trendDown ? 'var(--red)' : 'var(--green)',
      }}>
        {trendDown
          ? `↓ Тренд нисходящий — без изменений выручка упадёт на ${Math.abs(trendChange).toFixed(0)}%`
          : `↑ Тренд восходящий — при сохранении динамики вырастет на ${Math.abs(trendChange).toFixed(0)}%`
        }
      </div>

      <div className="apple-card" style={{ padding: '20px' }}>
        <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '12px' }}>
          График: факт + прогноз выручки
        </p>
        <TrendChart historical={revenues} forecast={fcRevs} />
        <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text3)' }}>
            <span style={{ display: 'inline-block', width: '18px', height: '2px', background: 'var(--blue)' }} />
            Факт
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text3)' }}>
            <span style={{ display: 'inline-block', width: '18px', height: '2px',
              background: 'repeating-linear-gradient(90deg,var(--blue) 0,var(--blue) 5px,transparent 5px,transparent 9px)',
              opacity: 0.5 }} />
            Прогноз
          </span>
        </div>
      </div>
    </div>
  )
}

// ── SKU Table ─────────────────────────────────────────────────────────────────
const SKU_COLS = [
  { key: 'name',       label: 'Товар',      align: 'left',  fmt: v => v || '—' },
  { key: 'units',      label: 'Продаж',     align: 'right', fmt: num },
  { key: 'revenue',    label: 'Выручка',    align: 'right', fmt: rub },
  { key: 'commission', label: 'Комиссия',   align: 'right', fmt: rub },
  { key: 'logistics',  label: 'Логист.',    align: 'right', fmt: rub },
  { key: 'cogs',       label: 'Себест.',    align: 'right', fmt: v => rub(-v) },
  { key: 'ads',        label: 'Реклама ₽', align: 'right', fmt: v => v > 0 ? `-${rub(v)}` : '—' },
  { key: 'drr_pct',    label: 'ДРР %',     align: 'right', fmt: v => v != null ? pct(v) : '—' },
  { key: 'profit',     label: 'Прибыль',   align: 'right', fmt: rub },
  { key: 'margin_pct', label: 'Маржа',     align: 'right', fmt: pct },
]

const FILTER_OPTS = [
  { id: 'all',      label: 'Все' },
  { id: 'stars',    label: 'Звёзды' },
  { id: 'pressure', label: 'Под давлением' },
  { id: 'loss',     label: 'Убыточные' },
]

function rowValueColor(row, key) {
  if (key === 'profit')
    return row.profit >= 0 ? 'var(--green)' : 'var(--red)'
  if (key === 'margin_pct')
    return row.margin_pct >= 15 ? 'var(--green)' : row.margin_pct >= 0 ? 'var(--amber)' : 'var(--red)'
  if (key === 'drr_pct') {
    if (row.drr_pct == null || row.drr_pct === 0) return 'var(--text3)'
    if (row.drr_pct < 10)  return 'var(--green)'
    if (row.drr_pct <= 20) return 'var(--amber)'
    return 'var(--red)'
  }
  if (key === 'ads') return row.ads > 0 ? 'var(--purple)' : 'var(--text3)'
  return 'var(--text1)'
}

function SkuTable({ rows, summary }) {
  const [filter, setFilter] = useState('all')

  // Распределить общие рекламные расходы по SKU пропорционально выручке
  const augmentedRows = useMemo(() => {
    const adTotal  = summary.ad_spend || 0
    const revTotal = summary.revenue  || 0
    return rows.map(row => {
      const ads     = revTotal > 0 ? adTotal * row.revenue / revTotal : 0
      const drr_pct = row.revenue > 0 ? ads / row.revenue * 100 : null
      const profit  = row.profit - ads
      return { ...row, ads: Math.round(ads), drr_pct: drr_pct != null ? Math.round(drr_pct * 10) / 10 : null, profit }
    })
  }, [rows, summary.ad_spend, summary.revenue])

  const filteredRows = useMemo(() => {
    if (filter === 'all') return augmentedRows
    return augmentedRows.filter(row => {
      const s = skuStatus(row)
      if (filter === 'stars')    return s?.label === 'Звезда'
      if (filter === 'pressure') return s?.label === 'Под давлением'
      if (filter === 'loss')     return s?.label === 'Убыточный'
      return true
    })
  }, [augmentedRows, filter])

  const totals = {
    name: 'ИТОГО', units: summary.units,
    revenue: summary.revenue, commission: summary.commission,
    logistics: summary.logistics, cogs: -summary.cogs,
    ads: summary.ad_spend || 0,
    drr_pct: summary.drr || 0,
    profit: summary.profit, margin_pct: summary.margin_pct,
  }

  const thStyle = {
    padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600,
    color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px',
    borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {FILTER_OPTS.map(opt => (
          <button key={opt.id} onClick={() => setFilter(opt.id)} style={{
            fontSize: '12px', padding: '5px 14px', borderRadius: '20px', cursor: 'pointer',
            fontFamily: 'var(--font)', fontWeight: 500,
            background: filter === opt.id ? 'rgba(0,113,227,0.15)' : 'var(--glass)',
            border: `1px solid ${filter === opt.id ? 'var(--blue)' : 'var(--glass-border)'}`,
            color: filter === opt.id ? 'var(--blue-light)' : 'var(--text2)',
            transition: 'all 0.2s',
          }}>
            {opt.label}
          </button>
        ))}
        <span style={{ fontSize: '12px', color: 'var(--text3)', alignSelf: 'center', marginLeft: '4px' }}>
          {filteredRows.length !== rows.length ? `${filteredRows.length} из ${rows.length}` : `${rows.length} SKU`}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle }}>Статус</th>
              {SKU_COLS.map(c => (
                <th key={c.key} style={{ ...thStyle, textAlign: c.align === 'right' ? 'right' : 'left' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => (
              <tr key={row.sku_id}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  <SkuStatusBadge row={row} />
                </td>
                {SKU_COLS.map(c => (
                  <td key={c.key} style={{
                    padding: '10px 12px', fontSize: '13px', whiteSpace: 'nowrap',
                    textAlign: c.align === 'right' ? 'right' : 'left',
                    color: rowValueColor(row, c.key),
                    fontWeight: (c.key === 'profit' || c.key === 'margin_pct') ? 600 : 400,
                    fontFamily: c.key !== 'name' ? 'monospace' : 'var(--font)',
                    maxWidth: c.key === 'name' ? '180px' : 'auto',
                    overflow: c.key === 'name' ? 'hidden' : 'visible',
                    textOverflow: c.key === 'name' ? 'ellipsis' : 'clip',
                  }} title={c.key === 'name' ? row.name : undefined}>
                    {c.key === 'name'
                      ? <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.fmt(row[c.key])}
                        </span>
                      : c.fmt(row[c.key])
                    }
                  </td>
                ))}
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={SKU_COLS.length + 1}
                  style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: 'var(--text3)' }}>
                  Нет SKU с таким статусом
                </td>
              </tr>
            )}

          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--glass-border)' }}>
              <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text3)' }}>—</td>
              {SKU_COLS.map(c => (
                <td key={c.key} style={{
                  padding: '10px 12px', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap',
                  textAlign: c.align === 'right' ? 'right' : 'left',
                  fontFamily: c.key !== 'name' ? 'monospace' : 'var(--font)',
                  color: c.key === 'profit'
                    ? (totals.profit >= 0 ? 'var(--green)' : 'var(--red)')
                    : c.key === 'margin_pct'
                    ? (totals.margin_pct >= 15 ? 'var(--green)' : totals.margin_pct >= 0 ? 'var(--amber)' : 'var(--red)')
                    : c.key === 'ads'
                    ? (totals.ads > 0 ? 'var(--purple)' : 'var(--text3)')
                    : c.key === 'drr_pct'
                    ? (totals.drr_pct < 10 ? 'var(--green)' : totals.drr_pct <= 20 ? 'var(--amber)' : 'var(--red)')
                    : 'var(--text1)',
                }}>
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

// ── Daily Table ───────────────────────────────────────────────────────────────
function DayTable({ rows }) {
  const headers = ['Дата','Выручка','Комиссия','Логист.','Возвраты','Себест.','Реклама','Прибыль','Маржа','ДРР']
  const thStyle = {
    padding: '10px 10px', fontSize: '11px', fontWeight: 600,
    color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px',
    borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap',
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={h} style={{ ...thStyle, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(d => {
            const pColor = d.profit >= 0 ? 'var(--green)' : 'var(--red)'
            const mColor = d.margin_pct >= 15 ? 'var(--green)' : d.margin_pct >= 0 ? 'var(--amber)' : 'var(--red)'
            return (
              <tr key={d.date}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--text2)' }}>
                  {date(d.date)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: 'var(--blue-light)' }}>
                  {rub(d.revenue)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: 'var(--text2)' }}>
                  {rub(d.commission)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: 'var(--text2)' }}>
                  {rub(d.logistics)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: 'var(--text2)' }}>
                  {rub(d.returns)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: 'var(--text2)' }}>
                  {rub(-d.cogs)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: 'var(--purple)' }}>
                  {d.ad_spend > 0 ? rub(-d.ad_spend) : '—'}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: pColor }}>
                  {rub(d.profit)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: mColor }}>
                  {pct(d.margin_pct)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: 'var(--purple)' }}>
                  {d.drr > 0 ? pct(d.drr) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const TABS = ['P&L по SKU', 'По дням', 'Прогноз', 'Себестоимость']

export default function PnLPage() {
  const [[df, dt]]    = useState(() => preset(30))
  const [dateFrom,    setDateFrom]    = useState(df)
  const [dateTo,      setDateTo]      = useState(dt)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [data,        setData]        = useState(null)
  const [tab,         setTab]         = useState(TABS[0])

  const [showCompare,    setShowCompare]    = useState(false)
  const [compareFrom,    setCompareFrom]    = useState('')
  const [compareTo,      setCompareTo]      = useState('')
  const [compareData,    setCompareData]    = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)

  const loadRef    = useRef(0)
  const cmpLoadRef = useRef(0)

  async function load() {
    const id = ++loadRef.current
    setLoading(true); setError(null)
    try {
      const result = await fetchPlSummary(dateFrom, dateTo)
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
      const result = await fetchPlSummary(compareFrom, compareTo)
      if (id === cmpLoadRef.current) setCompareData(result)
    } catch { /* ignore */ } finally {
      if (id === cmpLoadRef.current) setCompareLoading(false)
    }
  }

  function applyPreset(days) {
    const [f, t] = preset(days); setDateFrom(f); setDateTo(t)
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

  const labelStyle = { fontSize: '12px', fontWeight: 500, color: 'var(--text2)', marginBottom: '8px', display: 'block' }
  const inputStyle = {
    background: 'var(--bg3)', border: '1px solid var(--glass-border)',
    borderRadius: '10px', color: 'var(--text1)', padding: '9px 14px',
    fontSize: '13px', fontFamily: 'var(--font)', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Controls */}
      <div className="apple-card animate" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '20px' }}>

          {/* Presets */}
          <div>
            <span style={labelStyle}>Быстрый период</span>
            <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
              {presets.map(p => (
                <button key={p.label} type="button" onClick={p.fn} style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                  border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                  background: 'transparent', color: 'var(--text2)',
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg4)'; e.currentTarget.style.color = 'var(--text1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div>
            <span style={labelStyle}>Период</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ ...inputStyle, width: '140px' }}
                onFocus={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.2)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--glass-border)'; e.target.style.boxShadow = 'none' }}
              />
              <span style={{ color: 'var(--text3)', fontSize: '14px' }}>—</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ ...inputStyle, width: '140px' }}
                onFocus={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.2)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--glass-border)'; e.target.style.boxShadow = 'none' }}
              />
              <button
                onClick={() => { setShowCompare(p => !p); if (showCompare) setCompareData(null) }}
                style={{
                  ...inputStyle, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: showCompare ? 'rgba(0,113,227,0.15)' : 'var(--glass)',
                  borderColor: showCompare ? 'var(--blue)' : 'var(--glass-border)',
                  color: showCompare ? 'var(--blue-light)' : 'var(--text2)',
                }}>
                ⇄ Сравнить
              </button>
            </div>
          </div>

          <button onClick={load} disabled={loading} className="btn-primary"
            style={{ alignSelf: 'flex-end', padding: '10px 24px', fontSize: '14px' }}>
            {loading
              ? <><span style={{
                  display: 'inline-block', width: '14px', height: '14px',
                  border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                  borderRadius: '50%', marginRight: '8px',
                }} className="animate-spin" />Загрузка…</>
              : '↓ Загрузить P&L'
            }
          </button>
        </div>

        {/* Compare row */}
        {showCompare && (
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap',
            marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)',
          }}>
            <div>
              <span style={labelStyle}>Период сравнения</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="date" value={compareFrom} onChange={e => setCompareFrom(e.target.value)}
                  style={{ ...inputStyle, width: '140px' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.2)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--glass-border)'; e.target.style.boxShadow = 'none' }}
                />
                <span style={{ color: 'var(--text3)', fontSize: '14px' }}>—</span>
                <input type="date" value={compareTo} onChange={e => setCompareTo(e.target.value)}
                  style={{ ...inputStyle, width: '140px' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.2)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--glass-border)'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>
            <button onClick={loadCompare} disabled={compareLoading || !compareFrom || !compareTo}
              className="btn-secondary" style={{ alignSelf: 'flex-end' }}>
              {compareLoading ? 'Загрузка…' : 'Загрузить'}
            </button>
            {compareData && (
              <span style={{ fontSize: '12px', color: 'var(--green)', alignSelf: 'flex-end', paddingBottom: '2px' }}>
                ✓ Загружен
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '14px 18px', borderRadius: '14px', fontSize: '13px', color: 'var(--red)',
          background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text3)' }}>
          <p style={{ fontSize: '52px', marginBottom: '16px' }}>📊</p>
          <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text2)' }}>
            Выберите период и нажмите «Загрузить P&L»
          </p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>
            Данные берутся из транзакций вашего магазина Ozon
          </p>
        </div>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Alerts */}
          <AlertsPanel data={data} perfConnected={data.perf_connected} />

          {/* 4 KPI cards */}
          <KpiCards s={data.summary} prev={compareData?.summary} />

          {/* Main 2-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px' }}>

            {/* Left: chart */}
            <div className="apple-card animate animate-1" style={{ padding: '20px' }}>
              {data.by_day.length > 0
                ? <GrossProfitChart byDay={data.by_day} />
                : <p style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center', padding: '40px 0' }}>
                    Нет данных за период
                  </p>
              }
            </div>

            {/* Right: decomp + top3 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="apple-card animate animate-2" style={{ padding: '20px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text1)', marginBottom: '16px' }}>
                  Декомпозиция
                </p>
                <DecompositionCard s={data.summary} />
              </div>
              <div className="apple-card animate animate-3" style={{ padding: '20px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text1)', marginBottom: '14px' }}>
                  Топ-3 SKU по марже
                </p>
                <Top3Sku skus={data.by_sku} />
              </div>
            </div>
          </div>

          {/* Warnings */}
          {data.by_day.length === 0 && (
            <div style={{
              padding: '12px 16px', borderRadius: '12px', fontSize: '13px',
              background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.2)',
              color: 'var(--amber)',
            }}>
              За выбранный период транзакций не найдено. Проверьте даты или подключение магазина.
            </div>
          )}
          {data.by_sku.some(s => !s.cost_per_unit) && (
            <div style={{
              padding: '12px 16px', borderRadius: '12px', fontSize: '13px', display: 'flex',
              alignItems: 'center', gap: '8px',
              background: 'rgba(0,113,227,0.08)', border: '1px solid rgba(0,113,227,0.2)',
              color: 'var(--blue-light)',
            }}>
              <span>ℹ</span>
              <span>
                Для части SKU не указана себестоимость.{' '}
                <button onClick={() => setTab('Себестоимость')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--blue-light)', fontWeight: 600, fontFamily: 'var(--font)',
                    fontSize: '13px', textDecoration: 'underline' }}>
                  Заполнить
                </button>
              </span>
            </div>
          )}

          {/* Table section */}
          <div className="apple-card animate animate-4" style={{ overflow: 'hidden' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '0 20px' }}>
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '14px 16px', fontSize: '13px', fontWeight: 500,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  fontFamily: 'var(--font)', whiteSpace: 'nowrap',
                  color: tab === t ? 'var(--text1)' : 'var(--text2)',
                  borderBottom: tab === t ? '2px solid var(--blue)' : '2px solid transparent',
                  marginBottom: '-1px', transition: 'all 0.2s',
                }}>
                  {t}
                  {(t === 'P&L по SKU' && data.by_sku.length > 0) && (
                    <span style={{
                      marginLeft: '6px', fontSize: '10px', fontWeight: 600,
                      background: 'var(--glass)', border: '1px solid var(--glass-border)',
                      borderRadius: '10px', padding: '1px 6px', color: 'var(--text3)',
                    }}>{data.by_sku.length}</span>
                  )}
                  {(t === 'По дням' && data.by_day.length > 0) && (
                    <span style={{
                      marginLeft: '6px', fontSize: '10px', fontWeight: 600,
                      background: 'var(--glass)', border: '1px solid var(--glass-border)',
                      borderRadius: '10px', padding: '1px 6px', color: 'var(--text3)',
                    }}>{data.by_day.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: '20px' }}>
              {tab === 'P&L по SKU' && (
                data.by_sku.length === 0
                  ? <p style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center', padding: '32px 0' }}>Нет данных</p>
                  : <SkuTable rows={data.by_sku} summary={data.summary} />
              )}
              {tab === 'По дням' && (
                data.by_day.length === 0
                  ? <p style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center', padding: '32px 0' }}>Нет данных</p>
                  : <>
                      <p style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
                        Д/Д — динамика выручки день к дню
                      </p>
                      <DayTable rows={data.by_day} />
                      <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '12px',
                        paddingTop: '12px', borderTop: '1px solid var(--glass-border)',
                        fontSize: '13px', fontWeight: 600,
                      }}>
                        <span style={{ color: 'var(--text2)' }}>Итого:</span>
                        <span style={{ color: 'var(--blue-light)' }}>Выручка {rub(data.summary.revenue)}</span>
                        <span style={{ color: data.summary.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          Прибыль {rub(data.summary.profit)}
                        </span>
                        <span style={{ color: 'var(--amber)' }}>Маржа {pct(data.summary.margin_pct)}</span>
                      </div>
                    </>
              )}
              {tab === 'Прогноз' && (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>
                    Прогноз на 30 дней{' '}
                    <span style={{ fontSize: '12px', color: 'var(--text3)' }}>на основе линейного тренда</span>
                  </p>
                  <ForecastTab byDay={data.by_day} />
                </div>
              )}
              {tab === 'Себестоимость' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text1)' }}>Себестоимость по SKU</p>
                    <p style={{ fontSize: '12px', color: 'var(--text3)' }}>{skuEditorList.length} товаров</p>
                  </div>
                  <CogsEditor skus={skuEditorList} onSaved={load} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
