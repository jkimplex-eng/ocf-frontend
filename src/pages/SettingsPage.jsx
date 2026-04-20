import React, { useState, useEffect } from 'react'
import { fetchOzonConfig, saveOzonConfig, deleteOzonConfig } from '../api/client'

const S = {
  card: { background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: '18px', padding: '24px' },
  label: { display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text2)', marginBottom: '8px' },
  hint: { fontSize: '12px', color: 'var(--text3)', marginTop: '6px' },
  section: { fontSize: '15px', fontWeight: 600, color: 'var(--text1)', marginBottom: '18px' },
}

function StatusDot({ connected }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px',
      background: connected ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.06)',
      border: `1px solid ${connected ? 'rgba(48,209,88,0.3)' : 'var(--glass-border)'}`,
      borderRadius: '20px', padding: '4px 12px',
      fontSize: '12px', fontWeight: 600,
      color: connected ? 'var(--green)' : 'var(--text3)',
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--text3)',
        display: 'block', flexShrink: 0, animation: connected ? 'pulse 2.5s ease-in-out infinite' : 'none',
      }} />
      {connected ? 'Подключено' : 'Не подключено'}
    </span>
  )
}

function EyeBtn({ open, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px',
    }}>
      {open
        ? <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
          </svg>
      }
    </button>
  )
}

export default function SettingsPage() {
  const [config,        setConfig]        = useState(null)
  const [clientId,      setClientId]      = useState('')
  const [apiKey,        setApiKey]        = useState('')
  const [showKey,       setShowKey]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error,         setError]         = useState(null)
  const [success,       setSuccess]       = useState(null)

  useEffect(() => {
    fetchOzonConfig()
      .then(cfg => { setConfig(cfg); if (cfg.client_id) setClientId(cfg.client_id) })
      .catch(() => setConfig({ connected: false, client_id: '', seller_name: '' }))
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (!clientId.trim() || !apiKey.trim()) return
    setSaving(true); setError(null); setSuccess(null)
    try {
      const r = await saveOzonConfig(clientId.trim(), apiKey.trim())
      setConfig({ connected: true, client_id: r.client_id, seller_name: r.seller_name, updated_at: new Date().toISOString() })
      setSuccess(r.message || 'Магазин успешно подключён')
      setApiKey('')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function handleDisconnect() {
    if (!confirm('Отключить магазин? Ключи будут удалены.')) return
    setDisconnecting(true); setError(null); setSuccess(null)
    try {
      await deleteOzonConfig()
      setConfig({ connected: false, client_id: '', seller_name: '' })
      setClientId(''); setApiKey('')
    } catch (err) { setError(err.message) }
    finally { setDisconnecting(false) }
  }

  const isConnected = config?.connected

  return (
    <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div style={{ marginBottom: '8px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.5px' }}>Настройки</h1>
        <p style={{ fontSize: '14px', color: 'var(--text2)', marginTop: '4px' }}>
          Подключение магазина Ozon для P&amp;L и аналитики
        </p>
      </div>

      {/* Status card */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={S.section}>Ozon Seller API</p>
            {config === null
              ? <p style={S.hint}>Загрузка…</p>
              : isConnected
              ? <>
                  <p style={{ fontSize: '13px', color: 'var(--text2)' }}>
                    Client-ID: <span style={{ fontFamily: 'monospace', color: 'var(--text1)', fontWeight: 600 }}>{config.client_id}</span>
                  </p>
                  {config.updated_at && (
                    <p style={S.hint}>Обновлено: {new Date(config.updated_at).toLocaleString('ru')}</p>
                  )}
                </>
              : <p style={S.hint}>Магазин не подключён</p>
            }
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {config !== null && <StatusDot connected={isConnected} />}
            {isConnected && (
              <button onClick={handleDisconnect} disabled={disconnecting}
                style={{ fontSize: '13px', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {disconnecting ? 'Отключение…' : 'Отключить'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success */}
      {success && (
        <div style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.25)', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', color: 'var(--green)' }}>
          ✓ {success}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.25)', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', color: 'var(--red)' }}>
          ⚠ {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={S.section}>{isConnected ? 'Обновить ключи' : 'Подключить магазин'}</p>

        <div>
          <label style={S.label}>Client-ID <span style={{ color: 'var(--red)' }}>*</span></label>
          <input value={clientId} onChange={e => setClientId(e.target.value)}
            placeholder="12345678" className="input" style={{ fontFamily: 'monospace' }}
            autoComplete="off" required />
          <p style={S.hint}>Числовой идентификатор из раздела «Настройки → API»</p>
        </div>

        <div>
          <label style={S.label}>API-Key <span style={{ color: 'var(--red)' }}>*</span></label>
          <div style={{ position: 'relative' }}>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)}
              type={showKey ? 'text' : 'password'}
              placeholder={isConnected ? '•••••••• (оставьте пустым чтобы не менять)' : 'Вставьте API-ключ'}
              className="input" style={{ fontFamily: 'monospace', paddingRight: '40px' }}
              autoComplete="new-password" required={!isConnected} />
            <EyeBtn open={showKey} onClick={() => setShowKey(v => !v)} />
          </div>
          <p style={S.hint}>
            {isConnected
              ? 'Оставьте поле пустым, чтобы сохранить текущий ключ'
              : 'Ключ хранится в зашифрованном виде'}
          </p>
        </div>

        <button type="submit"
          disabled={saving || !clientId.trim() || (!apiKey.trim() && !isConnected)}
          className="btn-primary" style={{ justifyContent: 'center', padding: '12px', borderRadius: '12px' }}>
          {saving
            ? <><span className="animate-spin" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />Проверяем…</>
            : isConnected ? 'Обновить подключение' : 'Подключить магазин'}
        </button>
      </form>

      {/* Instructions */}
      <div style={{ background: 'rgba(0,113,227,0.08)', border: '1px solid rgba(0,113,227,0.2)', borderRadius: '18px', padding: '24px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--blue-light)', marginBottom: '16px' }}>Как получить ключи API</p>
        <ol style={{ display: 'flex', flexDirection: 'column', gap: '12px', listStyle: 'none', padding: 0, margin: 0 }}>
          {[
            'Войдите в личный кабинет Ozon Seller → «Настройки» → «API»',
            'Скопируйте Client-ID — числовой идентификатор магазина',
            'Создайте новый ключ с типом «Seller API» и скопируйте его',
            'Вставьте оба значения в форму выше и нажмите «Подключить»',
          ].map((text, i) => (
            <li key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{
                flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%',
                background: 'rgba(0,113,227,0.2)', color: 'var(--blue-light)',
                fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{i + 1}</span>
              <span style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: text }} />
            </li>
          ))}
        </ol>
        <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(0,113,227,0.15)' }}>
          Ключи хранятся в зашифрованном виде (Fernet AES-128). Никуда не передаются.
        </p>
      </div>

      {/* What's available */}
      {isConnected && (
        <div style={S.card}>
          <p style={S.section}>Доступно после подключения</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { icon: '📊', label: 'P&L калькулятор', desc: 'Выручка, комиссии, логистика, реклама, прибыль' },
              { icon: '📦', label: 'Аналитика SKU', desc: 'Маржа по каждому товару с реальными данными' },
              { icon: '📈', label: 'Динамика продаж', desc: 'Д/Д и Н/Н с трендами' },
            ].map(({ icon, label, desc }) => (
              <div key={label} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '22px', flexShrink: 0 }}>{icon}</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text1)' }}>{label}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
