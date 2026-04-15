# Папка bot

Папка `bot` содержит Telegram-слой приложения: инициализацию, роутинг команд/колбэков, middleware и управление состояниями пользователя.

## Состав

- `index.ts` — создание экземпляра Telegram-бота и старт polling.
- `init.ts` — сборка зависимостей и регистрация middleware/команд.
- `callback-router.ts` — единая регистрация и обработка `callback_query`.
- `state-manager.ts` — in-memory state и tempData для user-flow.
- `admin/` — переключение и подсказки админ-режима.
- `commands/` — регистрация и реализация команд (courier + admin).
- `handlers/` — специализированные обработчики сценариев (например, регистрация).
- `keyboards/` — reply/inline клавиатуры и утилиты для них.
- `middlewares/` — middleware-слой (`registration-state`, `update-logging`).

## Поток инициализации

1. Точка входа вызывает создание бота в `index.ts`.
2. `init.ts` получает сервисы и подключает middleware.
3. Регистрируются команды из `commands/index.ts`.
4. Callback-сценарии централизуются через `callback-router.ts`.

## Важно при изменениях

- Новые inline-сценарии подключайте через `callback-router`, а не отдельным глобальным `bot.on('callback_query')`.
- Новые многошаговые сценарии синхронизируйте со `state-manager`, `states.constant.ts` и `/cancel`.
- При изменении UX-потоков обновляйте соответствующие README в подпапках (`commands`, `keyboards`, `middlewares`).
