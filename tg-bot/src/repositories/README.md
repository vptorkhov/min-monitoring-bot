# Папка repositories

Эта папка содержит слой работы с базой данных — репозитории для выполнения SQL-запросов к различным таблицам.

## Файлы

### `courier.repository.ts`

Репозиторий для работы с таблицей `couriers`. Предоставляет методы:

- `findByTelegramId()` — поиск курьера по Telegram ID
- `create()` — создание нового курьера
- `updateWarehouse()` — обновление привязки к складу
- `activate()` — активация учетной записи

### `warehouse.repository.ts`

Репозиторий для работы с таблицей `warehouses`. Реализует:

- `findAllActive()` — получение всех активных складов
- `findById()` — поиск склада по ID

### `mobility-device.repository.ts`

Репозиторий для работы с таблицей `mobility_devices`. Предоставляет:

- `findAvailableByWarehouse()` — доступные устройства на складе
- `findById()` — поиск устройства по ID
- `updateStatus()` — обновление статуса устройства

### `session.repository.ts`

Репозиторий для работы с таблицей `sessions`. Реализует:

- `create()` — создание новой сессии
- `findActiveByCourier()` — поиск активной сессии курьера
- `close()` — завершение сессии

## Архитектура репозиториев

Каждый репозиторий:

- Принимает пул соединений в конструкторе
- Использует параметризованные запросы для безопасности
- Возвращает типизированные данные
- Обрабатывает ошибки подключения

## Вложенная папка types

### `warehouse.type.ts`

Содержит интерфейс `Warehouse` для типизации данных склада.</content>
<parameter name="filePath">d:\Vova\bots\min-monitoring-bot\tg-bot\src\repositories\README.md
