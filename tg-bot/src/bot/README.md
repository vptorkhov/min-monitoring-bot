# Папка bot

Папка `bot` содержит Telegram-слой приложения: инициализацию, роутинг команд/колбэков, middleware и управление состояниями пользователя.

## Состав

- `index.ts` — создание экземпляра Telegram-бота и запуск в режиме polling или webhook (через env).
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
2. В `index.ts` выбирается режим получения апдейтов:
	- `BOT_UPDATE_MODE=polling` (по умолчанию): запускается long polling.
	- `BOT_UPDATE_MODE=webhook`: регистрируется webhook через `WEBHOOK_BASE_URL + WEBHOOK_PATH`.
3. `init.ts` получает сервисы и подключает middleware.
4. Регистрируются команды из `commands/index.ts`.
5. Callback-сценарии централизуются через `callback-router.ts`.

## Переменные окружения Telegram-слоя

- `BOT_TOKEN` — токен бота.
- `BOT_UPDATE_MODE` — `polling` или `webhook`.
- `WEBHOOK_BASE_URL` — базовый HTTPS URL приложения (обязателен для webhook).
- `WEBHOOK_PATH` — путь webhook endpoint (по умолчанию `/webhook/telegram`).
- `WEBHOOK_SECRET_TOKEN` — секрет для заголовка `X-Telegram-Bot-Api-Secret-Token` (обязателен для webhook).
- `WEBHOOK_DELETE_ON_SHUTDOWN` — опционально, удалять ли webhook при graceful shutdown.

## Важно при изменениях

- Новые inline-сценарии подключайте через `callback-router`, а не отдельным глобальным `bot.on('callback_query')`.
- Новые многошаговые сценарии синхронизируйте со `state-manager`, `states.constant.ts` и `/cancel`.
- При изменении UX-потоков обновляйте соответствующие README в подпапках (`commands`, `keyboards`, `middlewares`).
