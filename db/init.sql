-- Таблица для хранения информации о складах
CREATE TABLE IF NOT EXISTS warehouse (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE warehouse IS 'Склады';
COMMENT ON COLUMN warehouse.id IS 'Уникальный идентификатор склада';
COMMENT ON COLUMN warehouse.name IS 'Название склада';
COMMENT ON COLUMN warehouse.address IS 'Адрес склада';
COMMENT ON COLUMN warehouse.created_at IS 'Дата создания записи';
COMMENT ON COLUMN warehouse.updated_at IS 'Дата последнего обновления';
COMMENT ON COLUMN warehouse.is_active IS 'Активен ли склад';

-- Индекс для поиска по названию склада
CREATE INDEX idx_warehouse_name ON warehouse(name);

-- Индекс для фильтрации по активности
CREATE INDEX idx_warehouse_is_active ON warehouse(is_active);

-- Таблица для хранения информации о средствах индивидуальной мобильности
CREATE TABLE IF NOT EXISTS mobility_devices (
    id SERIAL PRIMARY KEY,
    device_number VARCHAR(20),
    is_personal BOOLEAN NOT NULL,
    status VARCHAR(20),
    status_comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true,
    warehouse_id INTEGER,
    CONSTRAINT fk_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouse(id) ON DELETE SET NULL
);

INSERT INTO mobility_devices (device_number, is_personal, status, is_active) 
VALUES ('ЛИЧНЫЙ', true, 'ok', true);

-- Комментарии к таблице и колонкам (опционально)
COMMENT ON TABLE mobility_devices IS 'Средства индивидуальной мобильности';
COMMENT ON COLUMN mobility_devices.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN mobility_devices.device_number IS 'Номер устройства (может быть пустым)';
COMMENT ON COLUMN mobility_devices.is_personal IS 'Признак личного устройства';
COMMENT ON COLUMN mobility_devices.status IS 'Статус устройства';
COMMENT ON COLUMN mobility_devices.status_comment IS 'Подробное описание статуса';
COMMENT ON COLUMN mobility_devices.created_at IS 'Дата создания записи';
COMMENT ON COLUMN mobility_devices.updated_at IS 'Дата последнего обновления';
COMMENT ON COLUMN mobility_devices.is_active IS 'Активна ли запись';
COMMENT ON COLUMN mobility_devices.warehouse_id IS 'ID склада, к которому привязано устройство';

-- Индексы для оптимизации запросов
CREATE INDEX idx_mobility_devices_status ON mobility_devices(status);
CREATE INDEX idx_mobility_devices_is_active ON mobility_devices(is_active);
CREATE INDEX idx_mobility_devices_is_personal ON mobility_devices(is_personal);

-- Таблица для хранения информации о курьерах
CREATE TABLE IF NOT EXISTS couriers (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    nickname VARCHAR(100) UNIQUE,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    warehouse_id INTEGER,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_courier_warehouse FOREIGN KEY (warehouse_id) 
        REFERENCES warehouse(id) ON DELETE SET NULL
);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE couriers IS 'Курьеры';
COMMENT ON COLUMN couriers.id IS 'Уникальный идентификатор курьера';
COMMENT ON COLUMN couriers.full_name IS 'Полное имя курьера';
COMMENT ON COLUMN couriers.nickname IS 'Псевдоним (никнейм) курьера';
COMMENT ON COLUMN couriers.phone_number IS 'Номер телефона';
COMMENT ON COLUMN couriers.warehouse_id IS 'ID склада, к которому привязан курьер';
COMMENT ON COLUMN couriers.is_active IS 'Активен ли курьер';
COMMENT ON COLUMN couriers.created_at IS 'Дата создания записи';
COMMENT ON COLUMN couriers.updated_at IS 'Дата последнего обновления';
COMMENT ON COLUMN couriers.telegram_id IS 'ID пользователя в Telegram';

-- Индексы для оптимизации запросов
CREATE INDEX idx_couriers_warehouse_id ON couriers(warehouse_id);
CREATE INDEX idx_couriers_phone_number ON couriers(phone_number);
CREATE INDEX idx_couriers_is_active ON couriers(is_active);
CREATE INDEX idx_couriers_nickname ON couriers(nickname);

-- Таблица для хранения информации о курьерских сессиях
CREATE TABLE IF NOT EXISTS session (
    id SERIAL PRIMARY KEY,
    courier_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    is_active BOOLEAN GENERATED ALWAYS AS (end_date IS NULL) STORED,
    CONSTRAINT fk_session_courier FOREIGN KEY (courier_id) 
        REFERENCES couriers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_session_device FOREIGN KEY (device_id) 
        REFERENCES mobility_devices(id) ON DELETE RESTRICT,
    CONSTRAINT fk_session_warehouse FOREIGN KEY (warehouse_id) 
        REFERENCES warehouse(id) ON DELETE RESTRICT
);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE session IS 'Курьерские сессии (рабочие смены)';
COMMENT ON COLUMN session.id IS 'Уникальный идентификатор сессии';
COMMENT ON COLUMN session.courier_id IS 'ID курьера';
COMMENT ON COLUMN session.device_id IS 'ID устройства (средства мобильности)';
COMMENT ON COLUMN session.warehouse_id IS 'ID склада, с которого стартовала сессия';
COMMENT ON COLUMN session.start_date IS 'Дата и время начала сессии';
COMMENT ON COLUMN session.end_date IS 'Дата и время окончания сессии (NULL если активна)';
COMMENT ON COLUMN session.is_active IS 'Генерируемое поле: true если сессия активна (end_date IS NULL)';

-- Индексы для оптимизации запросов
CREATE INDEX idx_session_courier_id ON session(courier_id);
CREATE INDEX idx_session_device_id ON session(device_id);
CREATE INDEX idx_session_warehouse_id ON session(warehouse_id);
CREATE INDEX idx_session_dates ON session(start_date, end_date);
CREATE INDEX idx_session_is_active ON session(is_active);

-- Индекс для поиска активных сессий по курьеру (часто используемый запрос)
CREATE INDEX idx_session_active_courier ON session(courier_id) WHERE is_active = true;

-- Таблица для хранения информации об администраторах
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    nickname VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(200) NOT NULL,
    permissions_level INTEGER DEFAULT 1,
    is_login BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE admins IS 'Администраторы системы';
COMMENT ON COLUMN admins.id IS 'Уникальный идентификатор администратора';
COMMENT ON COLUMN admins.nickname IS 'Никнейм администратора';
COMMENT ON COLUMN admins.password_hash IS 'Хеш пароля';
COMMENT ON COLUMN admins.permissions_level IS 'Уровень доступа (1 - обычный, 2 - суперадмин)';
COMMENT ON COLUMN admins.is_login IS 'Статус авторизации';
COMMENT ON COLUMN admins.created_at IS 'Дата создания записи';

-- Индекс для поиска по никнейму
CREATE INDEX idx_admins_nickname ON admins(nickname);

-- Индекс для поиска по уровню доступа
CREATE INDEX idx_admins_permissions ON admins(permissions_level);

-- Создание суперадмина
INSERT INTO admins (nickname, password_hash, permissions_level) 
VALUES ('superadmin', '28efb68dcba507ecd182bead31e4e2d159b0f9185861d1ebfe60a12dfb310300', 2);