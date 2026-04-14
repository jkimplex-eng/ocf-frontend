import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCategoriesTree } from '../api/client'

// ── Icons ─────────────────────────────────────────────────────────────────
const IconSearch   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
const IconChevron  = ({ open }) => <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
const IconFolder   = () => <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
const IconTag      = () => <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-7-7A.997.997 0 013 9V4a1 1 0 011-1h5a.997.997 0 01.707.293l7 7zM7 6a1 1 0 10-2 0 1 1 0 002 0z" clipRule="evenodd"/></svg>
const IconCopy     = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
const IconX        = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>

// ── Helpers ───────────────────────────────────────────────────────────────
function useDebounce(value, ms = 350) {
  const [d, setD] = useState(value)
  useEffect(() => { const t = setTimeout(() => setD(value), ms); return () => clearTimeout(t) }, [value, ms])
  return d
}

function highlight(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-gray-900 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── L3 leaf row ────────────────────────────────────────────────────────────
function LeafRow({ node, query, selected, onSelect }) {
  const [copied, setCopied] = useState(false)

  function copy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(node.path || node.name)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <li
      onClick={() => onSelect(node)}
      className={`group flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg cursor-pointer transition-colors
        ${selected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}
    >
      <IconTag />
      <span className={`flex-1 text-sm truncate ${selected ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
        {highlight(node.name, query)}
      </span>
      <button
        onClick={copy}
        title="Скопировать путь"
        className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200
          ${copied ? '!opacity-100 text-green-600' : 'text-gray-400'}`}
      >
        {copied ? <span className="text-xs font-medium">✓</span> : <IconCopy />}
      </button>
    </li>
  )
}

// ── L2 sub-section ─────────────────────────────────────────────────────────
function L2Node({ node, query, selectedId, onSelect, forceOpen }) {
  const [open, setOpen] = useState(false)
  const hasChildren = node.children?.length > 0

  useEffect(() => { if (forceOpen) setOpen(true) }, [forceOpen])

  return (
    <li>
      <button
        onClick={() => hasChildren && setOpen(o => !o)}
        disabled={!hasChildren}
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors
          ${hasChildren ? 'hover:bg-gray-100 cursor-pointer' : 'cursor-default opacity-60'}`}
      >
        {hasChildren && <IconChevron open={open} />}
        {!hasChildren && <span className="w-4"/>}
        <IconFolder />
        <span className="flex-1 text-sm font-medium text-gray-700 truncate">
          {highlight(node.name, query)}
        </span>
        {hasChildren && (
          <span className="text-xs text-gray-400 tabular-nums">{node.children.length}</span>
        )}
      </button>

      {open && hasChildren && (
        <ul className="mt-0.5 ml-6 space-y-0.5">
          {node.children.map(leaf => (
            <LeafRow
              key={leaf.id ?? leaf.path}
              node={leaf}
              query={query}
              selected={selectedId === (leaf.id ?? leaf.path)}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// ── L1 top-level section ────────────────────────────────────────────────────
function L1Node({ node, query, selectedId, onSelect, forceOpen }) {
  const [open, setOpen] = useState(false)
  const totalLeafs = node.children.reduce((s, c) => s + (c.children?.length || 0), 0)

  useEffect(() => { if (forceOpen) setOpen(true) }, [forceOpen])

  return (
    <li className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <IconChevron open={open} />
        <span className="flex-1 font-semibold text-gray-800 truncate">
          {highlight(node.name, query)}
        </span>
        <span className="text-xs text-gray-400 tabular-nums">
          {node.children.length} подразд. · {totalLeafs} кат.
        </span>
      </button>

      {open && (
        <ul className="px-2 pb-2 space-y-0.5 border-t border-gray-100 pt-1">
          {node.children.map(l2 => (
            <L2Node
              key={l2.path ?? l2.name}
              node={l2}
              query={query}
              selectedId={selectedId}
              onSelect={onSelect}
              forceOpen={forceOpen}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// ── Selected panel ──────────────────────────────────────────────────────────
function SelectedPanel({ node, onClose }) {
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()
  if (!node) return null

  function copy() {
    navigator.clipboard.writeText(node.path || node.name)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function goScore() {
    const path = node.path || node.name
    navigate(`/scoring?path=${encodeURIComponent(path)}`)
  }

  return (
    <div className="card p-4 flex items-start gap-3 bg-blue-50 border-blue-200">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-blue-500 font-medium uppercase tracking-wide mb-0.5">Выбрана категория</p>
        <p className="font-semibold text-blue-900 truncate">{node.name}</p>
        {node.path && (
          <p className="text-xs text-blue-600 mt-0.5 truncate font-mono">{node.path}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={goScore} className="btn-primary text-xs px-3 py-1.5">
          🎯 Скорить
        </button>
        <button onClick={copy} className="btn-secondary text-xs px-3 py-1.5">
          {copied ? '✓ Скопировано' : <><IconCopy /><span>Путь</span></>}
        </button>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-400">
          <IconX />
        </button>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function CategoryTreePage() {
  const [query,    setQuery]    = useState('')
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [selected, setSelected] = useState(null)

  const debouncedQuery = useDebounce(query, 350)
  const inputRef = useRef(null)

  const load = useCallback(async (q) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchCategoriesTree(q)
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(debouncedQuery) }, [debouncedQuery, load])

  const forceOpen = debouncedQuery.length > 0

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Выбор категории</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Найдите нужную категорию Ozon — {data ? `${data.total} категорий загружено` : 'загрузка...'}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <IconSearch />
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Поиск: сыворотка, крем для лица, маски..."
          className="input pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <IconX />
          </button>
        )}
      </div>

      {/* Selected category panel */}
      <SelectedPanel node={selected} onClose={() => setSelected(null)} />

      {/* States */}
      {loading && (
        <div className="text-center py-12 text-gray-400">
          <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"/>
          <p className="text-sm">Загрузка...</p>
        </div>
      )}

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">
          Ошибка: {error}
        </div>
      )}

      {!loading && !error && data && data.tree.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">Ничего не найдено</p>
          <p className="text-sm mt-1">Попробуйте другой запрос</p>
        </div>
      )}

      {/* Tree */}
      {!loading && data && data.tree.length > 0 && (
        <>
          {debouncedQuery && (
            <p className="text-xs text-gray-500">
              Найдено: <span className="font-medium text-gray-700">{data.total}</span> категорий
            </p>
          )}
          <ul className="space-y-2">
            {data.tree.map(node => (
              <L1Node
                key={node.name}
                node={node}
                query={debouncedQuery}
                selectedId={selected?.id ?? selected?.path}
                onSelect={setSelected}
                forceOpen={forceOpen}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
