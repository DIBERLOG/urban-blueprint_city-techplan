# Urban Blueprint City Techplan

Интерактивный редактор технического генплана города на `React + TypeScript + SVG`.

Проект позволяет:

- редактировать зоны, дороги, магистрали, здания, ворота и служебные слои;
- двигать объекты прямо на схеме;
- сохранять карту локально и хранить версии;
- экспортировать карту в `JSON` и `PNG`;
- делиться картой по локальной ссылке и через публичные карты на Supabase;
- публиковать production-версию через Vercel.

## Production

- Сайт: `https://city-techplan-react.vercel.app`
- GitHub: `https://github.com/DIBERLOG/urban-blueprint_city-techplan`

## Stack

- React 18
- TypeScript
- Vite
- SVG editor surface
- Supabase для публичных карт
- Vercel для production-деплоя

## Локальный запуск

```bash
npm install
npm run dev
```

Сборка production:

```bash
npm run build
```

Предпросмотр production-сборки:

```bash
npm run preview
```

## Настройка Supabase

Создай `.env` по шаблону `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Дальше:

1. Создай проект в Supabase.
2. Выполни SQL из `supabase/maps.sql`.
3. Добавь те же env-переменные в Vercel.

## Деплой

Preview:

```bash
npm run deploy:preview
```

Production:

```bash
npm run deploy:prod
```

## GitHub Actions

В репозитории настроен CI-процесс:

- на `push` в `main`
- на `pull_request`

Он выполняет:

1. `npm ci`
2. `npm run build`

## Структура проекта

- `src/App.tsx` — основной редактор карты
- `src/cityData.ts` — базовое состояние карты и типы
- `src/sharedMap.ts` — работа с публичными картами через Supabase
- `src/styles.css` — интерфейс редактора
- `supabase/maps.sql` — схема таблицы и политики доступа
- `vercel.json` — конфигурация Vercel

## Состояние сброса

Кнопка `Сбросить` возвращает карту к базовому JSON-состоянию, зашитому в `src/cityData.ts`.

## Лицензия

Пока лицензия явно не задана. Если хочешь, можно отдельно добавить `MIT`.
