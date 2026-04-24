import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function RegisterPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== password2) { setError('Пароли не совпадают'); return }
    if (password.length < 8)    { setError('Пароль минимум 8 символов'); return }
    setLoading(true)
    try {
      // Регистрация
      const regRes = await fetch(`${BASE}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), password }),
      })
      if (!regRes.ok) {
        const data = await regRes.json().catch(() => ({}))
        throw new Error(data.detail || 'Ошибка регистрации')
      }

      // Автологин
      const form = new URLSearchParams()
      form.append('username', email.trim())
      form.append('password', password)
      const loginRes = await fetch(`${BASE}/auth/login`, { method: 'POST', body: form })
      const { access_token } = await loginRes.json()
      login(access_token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.logo}>OCF<span style={{ color: 'var(--blue)' }}>.</span></div>
        <p style={styles.subtitle}>Создайте аккаунт</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        <label style={styles.label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoFocus
          placeholder="seller@example.com"
          style={styles.input}
        />

        <label style={styles.label}>Пароль</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          placeholder="Минимум 8 символов"
          style={styles.input}
        />

        <label style={styles.label}>Повторите пароль</label>
        <input
          type="password"
          value={password2}
          onChange={e => setPassword2(e.target.value)}
          required
          placeholder="••••••••"
          style={styles.input}
        />

        <button type="submit" disabled={loading} style={styles.btn}>
          {loading ? 'Создаём...' : 'Зарегистрироваться'}
        </button>

        <p style={styles.footer}>
          Уже есть аккаунт?{' '}
          <Link to="/login" style={{ color: 'var(--blue)', textDecoration: 'none' }}>
            Войти
          </Link>
        </p>
      </form>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: '28px',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    background: 'var(--glass)',
    border: '1px solid var(--glass-border)',
    borderRadius: '22px',
    padding: '40px 36px',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  logo: {
    fontFamily: 'var(--font)',
    fontSize: '28px',
    fontWeight: 800,
    color: 'white',
    letterSpacing: '-0.5px',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text2)',
    margin: 0,
    marginBottom: '8px',
  },
  errorBox: {
    background: 'rgba(255,69,58,0.12)',
    border: '1px solid rgba(255,69,58,0.3)',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    color: 'var(--red)',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text2)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '-6px',
  },
  input: {
    background: 'var(--bg2)',
    border: '1px solid var(--glass-border)',
    borderRadius: '10px',
    padding: '11px 14px',
    fontSize: '14px',
    color: 'var(--text1)',
    fontFamily: 'var(--font)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  btn: {
    background: 'var(--blue)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'var(--font)',
    cursor: 'pointer',
    marginTop: '4px',
  },
  footer: {
    fontSize: '13px',
    color: 'var(--text2)',
    textAlign: 'center',
    margin: 0,
  },
}
