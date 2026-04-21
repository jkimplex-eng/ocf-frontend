const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

/** GET /categories/tree?subcategory=... */
export function fetchCategoriesTree(subcategory = '') {
  const q = subcategory ? `?subcategory=${encodeURIComponent(subcategory)}` : ''
  return request(`/categories/tree${q}`)
}

/**
 * POST /categories/score/stream — SSE async generator
 * Yields: {type:"start"} | {type:"progress", current, total, name} |
 *         {type:"result", ...} | {type:"done"}
 */
export async function* scoreStream(body) {
  const res = await fetch(`${BASE}/categories/score/stream`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    const events = buf.split('\n\n')
    buf = events.pop() ?? ''

    for (const event of events) {
      for (const line of event.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try { yield JSON.parse(line.slice(6)) } catch { /* пропустить невалидный JSON */ }
      }
    }
  }
}

/**
 * GET /categories/score/limits
 */
export function fetchLimits() {
  return request('/categories/score/limits')
}

// ── P&L ─────────────────────────────────────────────────────────────────────

/** GET /pl/summary?date_from=&date_to= */
export function fetchPlSummary(date_from, date_to) {
  const q = new URLSearchParams({ date_from, date_to })
  return request(`/pl/summary?${q}`)
}

/** GET /pl/cogs */
export function fetchCogs() {
  return request('/pl/cogs')
}

/**
 * POST /pl/cogs
 * Принимает одну запись {sku_id, cost, name?} или массив.
 */
export function saveCogs(items) {
  return request('/pl/cogs', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(items),
  })
}

/**
 * POST /pl/cogs/bulk
 * Массовый импорт из Excel: [{article, cost_price, name?}, …]
 */
export function bulkSaveCogs(items) {
  return request('/pl/cogs/bulk', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(items),
  })
}

// ── Settings / Ozon store ────────────────────────────────────────────────────

/** GET /settings/ozon — статус подключения магазина */
export function fetchOzonConfig() {
  return request('/settings/ozon')
}

/** POST /settings/ozon — сохранить и проверить ключи */
export function saveOzonConfig(client_id, api_key) {
  return request('/settings/ozon', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ client_id, api_key }),
  })
}

/** DELETE /settings/ozon — отключить магазин */
export function deleteOzonConfig() {
  return request('/settings/ozon', { method: 'DELETE' })
}

/** GET /settings/performance — статус Performance API */
export function fetchPerfConfig() {
  return request('/settings/performance')
}

/** POST /settings/performance — сохранить Performance API ключи */
export function savePerfConfig(client_id, client_secret) {
  return request('/settings/performance', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ client_id, client_secret }),
  })
}

/** DELETE /settings/performance — отключить Performance API */
export function deletePerfConfig() {
  return request('/settings/performance', { method: 'DELETE' })
}

/**
 * GET /brands/{brand}/products
 * params: { date_from, date_to, item_id, limit }
 */
export function fetchBrandProducts(brand, params = {}) {
  const q = new URLSearchParams()
  if (params.date_from) q.set('date_from', params.date_from)
  if (params.date_to)   q.set('date_to',   params.date_to)
  if (params.item_id)   q.set('item_id',   params.item_id)
  if (params.limit)     q.set('limit',     params.limit)
  const qs = q.toString()
  return request(`/brands/${encodeURIComponent(brand)}/products${qs ? '?' + qs : ''}`)
}
