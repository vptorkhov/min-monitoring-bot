# Папка repositories

Эта папка содержит слой работы с базой данных — репозитории для выполнения SQL-запросов к различным таблицам.

## Файлы

### `courier.repository.ts`

Репозиторий для работы с таблицей `couriers`. Предоставляет методы:

- `findByTelegramId()` — поиск курьера по Telegram ID
- `create()` — создание нового курьера
- `updateWarehouse()` — обновление привязки к складу
- `activate()` — активация учетной записи
- `findAllActive()` — получение всех активных курьеров
- `findActiveNotNotified()` — поиск активных курьеров, которым не отправлено уведомление
- `updateNotifiedAt()` — сохранение времени отправки уведомления

### `warehouse.repository.ts`

Репозиторий для работы с таблицей `warehouses`. Реализует:

- `findAllActive()` — получение всех активных складов
- `findById()` — поиск склада по ID

### `mobility-device.repository.ts`

Репозиторий для работы с таблицей `mobility_devices`. Предоставляет:

- `getAvailableDevices()` — доступные устройства на складе (личный СИМ в начале)
- `findById()` — поиск устройства по ID
- `updateStatus()` — обновление статуса устройства (параметры: `status`, опционально `makeInactive`)

### `admin.repository.ts`

Репозиторий для работы с таблицей `admins`. Реализует:

- `existsByNicknameInsensitive()` — проверка занятости логина без учета регистра
- `createPendingAdmin()` — создание неактивного администратора (`permissions_level = 1`, `is_active = false`) с защитой от case-insensitive дублей

### `session.repository.ts`

Репозиторий для работы с таблицей `session`. Реализует:

- `createSession()` — создание новой сессии
- `findActiveByCourier()` — поиск активной сессии курьера
- `closeSession()` — завершение сессии с сохранением статуса СИМ и комментария (параметры: `courierId`, опционально `endDate`, `simStatusAfter`, `statusComment`)
- `findById()` — поиск сессии по ID

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
