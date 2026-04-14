import React, { useState, useEffect } from 'react'
import { fetchOzonConfig, saveOzonConfig, deleteOzonConfig } from '../api/client'

// ── Status badge ────────────────────────────────────────────────────────────
function StatusBadge({ connected }) {
  return connected
    ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Подключено
      </span>
    : <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Не подключено
      </span>
}

// ── Eye icon ────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open
    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>
    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
      </svg>
}

// ── Instruction block ────────────────────────────────────────────────────────
function InstructionSteps() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-blue-800">Как получить ключи API</h3>
      <ol className="space-y-2 text-sm text-blue-700">
        <li className="flex gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center">1</span>
          <span>Войдите в <strong>личный кабинет Ozon Seller</strong> → меню «Настройки» → «API»</span>
        </li>
        <li className="flex gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center">2</span>
          <span>Скопируйте <strong>Client-ID</strong> — числовой идентификатор магазина</span>
        </li>
        <li className="flex gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center">3</span>
          <span>Создайте новый ключ с типом <strong>«Seller API»</strong> и скопируйте его</span>
        </li>
        <li className="flex gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center">4</span>
          <span>Вставьте оба значения в форму ниже и нажмите «Подключить»</span>
        </li>
      </ol>
      <p className="text-xs text-blue-600 border-t border-blue-200 pt-2 mt-1">
        Ключи хранятся в базе данных в зашифрованном виде (Fernet AES-128). Никуда не передаются.
      </p>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [config,    setConfig]    = useState(null)   // null = loading
  const [clientId,  setClientId]  = useState('')
  const [apiKey,    setApiKey]    = useState('')
  const [showKey,   setShowKey]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)
  const [success,   setSuccess]   = useState(null)
  const [disconnecting, setDisconnecting] = useState(false)

  // Загрузить текущий статус
  useEffect(() => {
    fetchOzonConfig()
      .then(cfg => {
        setConfig(cfg)
        if (cfg.client_id) setClientId(cfg.client_id)
      })
      .catch(() => setConfig({ connected: false, client_id: '', seller_name: '' }))
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (!clientId.trim() || !apiKey.trim()) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await saveOzonConfig(clientId.trim(), apiKey.trim())
      setConfig({ connected: true, client_id: result.client_id, seller_name: result.seller_name, updated_at: new Date().toISOString() })
      setSuccess(result.message || 'Магазин успешно подключён')
      setApiKey('')   // очистить поле ключа после сохранения
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Отключить магазин? Сохранённые ключи будут удалены.')) return
    setDisconnecting(true)
    setError(null)
    setSuccess(null)
    try {
      await deleteOzonConfig()
      setConfig({ connected: false, client_id: '', seller_name: '', updated_at: null })
      setClientId('')
      setApiKey('')
      setSuccess(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDisconnecting(false)
    }
  }

  const isConnected = config?.connected

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Настройки</h1>
        <p className="text-sm text-gray-500 mt-0.5">Подключение магазина Ozon для P&amp;L и аналитики</p>
      </div>

      {/* Status card */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Ozon Seller API</h2>
            {config === null
              ? <p className="text-xs text-gray-400 mt-0.5">Загрузка…</p>
              : isConnected
                ? <>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Client-ID: <span className="font-mono font-medium text-gray-700">{config.client_id}</span>
                    </p>
                    {config.updated_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Обновлено: {new Date(config.updated_at).toLocaleString('ru')}
                      </p>
                    )}
                  </>
                : <p className="text-xs text-gray-400 mt-0.5">Магазин не подключён</p>
            }
          </div>
          <div className="flex items-center gap-3">
            {config !== null && <StatusBadge connected={isConnected} />}
            {isConnected && (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
              >
                {disconnecting ? 'Отключаем…' : 'Отключить'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
          {success}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          ⚠️ {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">
          {isConnected ? 'Обновить ключи' : 'Подключить магазин'}
        </h2>

        {/* Client-ID */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Client-ID <span className="text-red-400">*</span>
          </label>
          <input
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="12345678"
            className="input font-mono"
            autoComplete="off"
            required
          />
          <p className="text-xs text-gray-400 mt-1">Числовой идентификатор из раздела «Настройки → API»</p>
        </div>

        {/* API-Key */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            API-Key <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              type={showKey ? 'text' : 'password'}
              placeholder={isConnected ? '••••••••  (оставьте пустым, чтобы не менять)' : 'Вставьте API-ключ'}
              className="input font-mono pr-10"
              autoComplete="new-password"
              required={!isConnected}
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              <EyeIcon open={showKey} />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {isConnected
              ? 'Оставьте поле пустым, чтобы сохранить текущий ключ'
              : 'Ключ хранится в зашифрованном виде, в ответах API не возвращается'}
          </p>
        </div>

        <button
          type="submit"
          disabled={saving || !clientId.trim() || (!apiKey.trim() && !isConnected)}
          className="btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving
            ? <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>Проверяем подключение…</>
            : isConnected ? 'Обновить подключение' : 'Подключить магазин'}
        </button>
      </form>

      {/* Instructions */}
      <InstructionSteps />

      {/* What's next */}
      {isConnected && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Что доступно после подключения</h3>
          <ul className="space-y-2">
            {[
              { icon: '📊', label: 'P&L калькулятор', desc: 'Выручка, комиссии, логистика, реклама, прибыль по дням' },
              { icon: '📦', label: 'Аналитика SKU', desc: 'Маржа по каждому товару с учётом реальных данных' },
              { icon: '📈', label: 'Динамика продаж', desc: 'День к дню и неделя к неделе со стрелками роста' },
            ].map(({ icon, label, desc }) => (
              <li key={label} className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
