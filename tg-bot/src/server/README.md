# Папка server

Эта папка содержит код HTTP-сервера для служебных endpoints и мониторинга.

## Файлы

### `index.ts`

Модуль создания и запуска Express.js сервера. Предоставляет:

- **createServer({ bot, runtimeConfig })**: создание экземпляра Express приложения
    - Настройка middleware для JSON
    - Регистрация health check endpoint
	- В режиме webhook: регистрация `POST` endpoint по `runtimeConfig.webhookPath`
	- В режиме webhook: проверка заголовка `X-Telegram-Bot-Api-Secret-Token`
- **startServer()**: запуск сервера на указанном порту (возвращает HTTP Server)

## Архитектура сервера

Сервер предназначен для:

- **Мониторинга**: health check endpoint `/health`
- **Webhook-приема**: обработка входящих обновлений Telegram в webhook-режиме
- **Безопасности**: валидация secret token для webhook-запросов
- **Расширяемости**: готов к добавлению новых endpoints
- **Контейнеризации**: используется для проверки работоспособности в Docker

## Health Check

Endpoint `/health` возвращает:

```json
{
	"status": "ok",
	"timestamp": "2024-01-01T00:00:00.000Z",
	"service": "mobility-bot"
}
```

Используется для:

- Мониторинга состояния приложения
- Проверки доступности в оркестраторах
- Автоматического перезапуска при сбоях

## Webhook endpoint

В режиме `BOT_UPDATE_MODE=webhook` сервер дополнительно поднимает `POST` endpoint по пути `WEBHOOK_PATH`.

Особенности:

- Запросы без корректного `X-Telegram-Bot-Api-Secret-Token` получают `401`.
- Валидные обновления передаются в Telegram SDK через `processUpdate`.
- В режиме `polling` webhook endpoint не регистрируется.
