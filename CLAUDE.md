# OCF Frontend — Ozon Category Finder

## Проект
SaaS для селлеров Ozon. React фронтенд.
Деплой: Vercel (автодеплой из ветки main при push).
Продакшн URL: https://ocf-frontend.vercel.app
Бэкенд: https://ozonfinderbackend-production.up.railway.app

## Стек
- React 18 + Vite
- React Router v6
- Recharts — графики
- SheetJS (xlsx) — импорт/экспорт Excel
- CSS переменные (не Tailwind)
- Локальный запуск: npm run dev (порт 5174)

## Дизайн-система — Apple Dark Style
Все цвета через CSS переменные в index.css:
--bg: #000000        — основной фон
--bg1: #0a0a0a       — карточки
--bg2: #141414       — инпуты, вторичные поверхности
--bg3: #1c1c1e       — переключатели
--bg4: #2c2c2e       — активные элементы переключателя
--glass: rgba(255,255,255,0.04)
--glass-border: rgba(255,255,255,0.08)
--blue: #0071e3      — акцент, кнопки
--blue-light: #409cff
--green: #30d158     — прибыль, позитив
--red: #ff453a       — расходы, негатив
--amber: #ffd60a     — маржа, предупреждения
--teal: #5ac8fa      — дополнительный акцент
--text1: #ffffff
--text2: rgba(255,255,255,0.6)
--text3: rgba(255,255,255,0.3)
--font: 'Plus Jakarta Sans', sans-serif

## Структура проекта
src/
  pages/
    PnLPage.jsx        — P&L калькулятор (главная страница)
    ScoringPage.jsx    — скоринг категорий
    SettingsPage.jsx   — настройки API ключей
    FunnelPage.jsx     — воронка продаж
    HypothesesPage.jsx — гипотезы
  components/
    Navbar.jsx         — навигация (горизонтальная, sticky)
    AlertsPanel.jsx    — панель алертов

## API интеграция
Базовый URL: import.meta.env.VITE_API_URL (из Vercel env vars)
Авторизация: Bearer токен в localStorage

Основные эндпоинты:
- GET /pl/summary?date_from=&date_to=&ad_spend= — итоги P&L
- GET /pl/sku?date_from=&date_to= — P&L по SKU
- GET /pl/daily?date_from=&date_to= — P&L по дням
- POST /categories/score/stream — скоринг (SSE стрим)
- GET /settings — настройки магазина
- POST /sku-costs/bulk — импорт себестоимости

## P&L структура ответа
{
  revenue: number,
  commission: number,      // отрицательное
  logistics: number,       // отрицательное
  storage: number,         // отрицательное
  ads: number,             // отрицательное
  returns: number,         // отрицательное
  compensations: number,   // положительное
  other_expenses: number,  // отрицательное
  profit: number,
  margin: number,          // в процентах
  sales_count: number,
  daily: [...],            // массив по дням
  sku_items: [...]         // массив по SKU
}

## Правила работы
- Никаких белых фонов — только тёмная тема
- Все числа через font-family: var(--font-mono) — 'DM Mono'
- Карточки: background var(--glass), border 1px solid var(--glass-border), border-radius 18px
- После изменений: npm run build (проверить что нет ошибок)
- Деплой: git add -A && git commit -m "описание" && git push
- Vercel деплоит автоматически, ждать 1-2 минуты

## Текущие баги и задачи
1. TODO: подключить Performance API — показывать рекламу в P&L
2. TODO: воронка продаж (FunnelPage.jsx) — данные из Ozon Analytics API
3. TODO: гипотезы (HypothesesPage.jsx) — трекер тестов
4. АКТИВНЫЙ БАГ: логистика не показывается — проблема на бэкенде
