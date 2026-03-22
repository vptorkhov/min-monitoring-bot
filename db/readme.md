# База данных для управления средствами индивидуальной мобильности

Описание и схема находятся в скрипте `init.sql`. Ниже краткая документация по таблицам и основным полям.

## Таблицы

### `mobility_devices` — Средства индивидуальной мобильности

- **id** SERIAL PRIMARY KEY
- **device_number** VARCHAR(20) — номер устройства (может быть пустым)
- **is_personal** BOOLEAN NOT NULL — признак личного устройства
- **status** VARCHAR(20) — текущий статус
- **warehouse_id** INTEGER — внешний ключ на `warehouse(id)`, ON DELETE SET NULL
- **is_active** BOOLEAN NOT NULL DEFAULT true — активность записи
- **created_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- **updated_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP

При инициализации добавляется устройство с `device_number = 'ЛИЧНЫЙ'`.

Индексы:

- `idx_mobility_devices_status` (status)
- `idx_mobility_devices_is_active` (is_active)
- `idx_mobility_devices_is_personal` (is_personal)

### `warehouse` — Склады

- **id** SERIAL PRIMARY KEY
- **name** VARCHAR(100) NOT NULL
- **address** VARCHAR(200)
- **is_active** BOOLEAN NOT NULL DEFAULT true
- **created_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- **updated_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP

Индексы: `idx_warehouse_name`, `idx_warehouse_is_active`.

### `couriers` — Курьеры

- **id** SERIAL PRIMARY KEY
- **telegram_id** BIGINT UNIQUE
- **full_name** VARCHAR(255) NOT NULL
- **nickname** VARCHAR(100) UNIQUE
- **phone_number** VARCHAR(20) UNIQUE NOT NULL
- **warehouse_id** INTEGER REFERENCES warehouse(id) ON DELETE SET NULL
- **is_active** BOOLEAN DEFAULT FALSE
- **notified_at** TIMESTAMP NULL — время отправки уведомления об активации (NULL если не отправлено)
- **created_at**, **updated_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP

Индексы: `idx_couriers_warehouse_id`, `idx_couriers_phone_number`, `idx_couriers_is_active`, `idx_couriers_nickname`.

**Отслеживание уведомлений:** Поле `notified_at` используется фоновым процессом `ActivationNotifier` чтобы избежать отправки дублирующихся уведомлений при перезапуске бота.

### `session` — Курьерские сессии

- **id** SERIAL PRIMARY KEY
- **courier_id** INTEGER NOT NULL REFERENCES couriers(id) ON DELETE RESTRICT
- **device_id** INTEGER NOT NULL REFERENCES mobility_devices(id) ON DELETE RESTRICT
- **warehouse_id** INTEGER NOT NULL REFERENCES warehouse(id) ON DELETE RESTRICT
- **start_date** TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- **end_date** TIMESTAMP
- **sim_status_after** VARCHAR(20) — статус СИМ после завершения сессии
- **status_comment** TEXT — комментарий о состоянии СИМ (повреждения и т.д.)
- **is_active** BOOLEAN GENERATED ALWAYS AS (end_date IS NULL) STORED

Индексы: `idx_session_courier_id`, `idx_session_device_id`, `idx_session_warehouse_id`, `idx_session_dates`, `idx_session_is_active`, частичный `idx_session_active_courier` для активных сессий по курьеру, а также уникальный частичный `idx_session_active_courier_unique`.

Инвариант: у одного курьера может быть только одна активная сессия (`is_active = true`) одновременно.

### `admins` — Администраторы системы

- **id** SERIAL PRIMARY KEY
- **nickname** VARCHAR(50) NOT NULL UNIQUE
- **password_hash** VARCHAR(200) NOT NULL
- **permissions_level** INTEGER DEFAULT 1 (1 — обычный, 2 — суперадмин)
- **is_active** BOOLEAN NOT NULL DEFAULT FALSE — флаг допуска администратора (после одобрения суперадмином)
- **is_login** BOOLEAN DEFAULT FALSE
- **warehouse_id** INTEGER REFERENCES warehouse(id) ON DELETE SET NULL — привязка к складу (NULL если не выбран)
- **created_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP

Индексы: `idx_admins_nickname`, `idx_admins_permissions`, `idx_admins_is_active`, `idx_admins_warehouse_id`.

После инициализации создаётся суперадмин `superadmin` с предустановленным хешем пароля.

## Запуск

1. Убедитесь, что у вас установлены Docker и Docker Compose
2. Перейдите в папку `db` и выполните:

    ```bash
    docker-compose up -d
    ```

3. Для остановки и удаления контейнера:
    ```bash
    docker-compose down -v
    ```
