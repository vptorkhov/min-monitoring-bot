# Папка server

Эта папка содержит код HTTP-сервера для служебных endpoints и мониторинга.

## Файлы

### `index.ts`

Модуль создания и запуска Express.js сервера. Предоставляет:

- **createServer()**: создание экземпляра Express приложения
    - Настройка middleware для JSON
    - Регистрация health check endpoint
- **startServer()**: запуск сервера на указанном порту

## Архитектура сервера

Сервер предназначен для:

- **Мониторинга**: health check endpoint `/health`
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
- Автоматического перезапуска при сбоях</content>
  <parameter name="filePath">d:\Vova\bots\min-monitoring-bot\tg-bot\src\server\README.md
