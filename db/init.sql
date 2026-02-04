-- Создание базы данных и пользователя уже выполняется через переменными окружения
-- Создаем таблицы

-- Таблица: Средства индивидуальной мобильности (SIM - средства индивидуальной мобильности)
CREATE TABLE IF NOT EXISTS mobility_devices (
    id SERIAL PRIMARY KEY,
    device_type VARCHAR(100) NOT NULL,
    device_number VARCHAR(50) UNIQUE NOT NULL,
    is_personal BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица: Курьеры
CREATE TABLE IF NOT EXISTS couriers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    nickname VARCHAR(100) UNIQUE,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица: Сессии
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    device_id INTEGER NOT NULL REFERENCES mobility_devices(id) ON DELETE RESTRICT,
    start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    is_active BOOLEAN GENERATED ALWAYS AS (end_date IS NULL) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица: Администраторы
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    telegram_username VARCHAR(100),
    full_name VARCHAR(255),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    permissions_level INTEGER DEFAULT 1, -- 1: базовые, 2: средние, 3: полные
    notes TEXT
);

-- Создаем индексы для оптимизации запросов
CREATE INDEX idx_mobility_devices_device_number ON mobility_devices(device_number);
CREATE INDEX idx_mobility_devices_is_active ON mobility_devices(is_active);
CREATE INDEX idx_couriers_nickname ON couriers(nickname);
CREATE INDEX idx_couriers_phone_number ON couriers(phone_number);
CREATE INDEX idx_sessions_courier_id ON sessions(courier_id);
CREATE INDEX idx_sessions_device_id ON sessions(device_id);
CREATE INDEX idx_sessions_is_active ON sessions(is_active);
CREATE INDEX idx_sessions_dates ON sessions(start_date, end_date);

-- Добавляем индекс для быстрого поиска по telegram_id
CREATE INDEX IF NOT EXISTS idx_admins_telegram_id ON admins(telegram_id);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);

-- Создаем представление для получения информации о средствах с их статусом доступности
CREATE OR REPLACE VIEW devices_with_status_view AS
SELECT 
    md.id,
    md.device_type,
    md.device_number,
    md.is_personal,
    md.is_active,
    CASE
        WHEN md.is_personal THEN 'Личное'
        ELSE 'Компании'
    END as ownership_type,
    CASE
        -- Личные средства всегда считаются "занятыми" в контексте доступности
        WHEN md.is_personal THEN FALSE
        -- Проверяем, есть ли активная сессия у средства
        WHEN EXISTS (
            SELECT 1 FROM sessions s 
            WHERE s.device_id = md.id 
            AND s.end_date IS NULL
        ) THEN FALSE
        ELSE TRUE
    END as is_available,
    CASE
        WHEN md.is_personal THEN 'Личное средство'
        WHEN EXISTS (
            SELECT 1 FROM sessions s 
            WHERE s.device_id = md.id 
            AND s.end_date IS NULL
        ) THEN 'Занято'
        ELSE 'Свободно'
    END as availability_status
FROM mobility_devices md
WHERE md.is_active = TRUE
ORDER BY 
    md.is_personal DESC,
    md.device_type,
    md.device_number;

-- Создаем представление для получения только доступных средств компании
CREATE OR REPLACE VIEW available_company_devices_view AS
SELECT 
    id,
    device_type,
    device_number,
    ownership_type,
    availability_status
FROM devices_with_status_view
WHERE is_personal = FALSE 
    AND is_available = TRUE
ORDER BY device_number;

-- Создаем представление для получения текущего средства курьера
CREATE OR REPLACE VIEW courier_current_device_view AS
SELECT 
    c.id as courier_id,
    c.full_name,
    c.nickname,
    c.phone_number,
    md.id as device_id,
    md.device_number,
    md.device_type,
    s.start_date as session_start_date,
    s.id as session_id,
    CASE
        WHEN md.is_personal THEN 'Личное'
        ELSE 'Компании'
    END as device_ownership
FROM couriers c
JOIN sessions s ON c.id = s.courier_id
JOIN mobility_devices md ON s.device_id = md.id
WHERE s.end_date IS NULL
    AND c.is_active = TRUE
ORDER BY c.full_name;

-- Создаем представление для получения истории сессий
CREATE OR REPLACE VIEW sessions_history_view AS
SELECT 
    s.id,
    c.full_name,
    c.nickname,
    md.device_number,
    md.device_type,
    s.start_date,
    s.end_date,
    CASE 
        WHEN s.end_date IS NULL THEN 'Активна'
        ELSE 'Завершена'
    END as session_status,
    CASE
        WHEN md.is_personal THEN 'Личное'
        ELSE 'Компании'
    END as device_ownership,
    CASE
        WHEN s.end_date IS NULL THEN 'В работе'
        ELSE 'Завершено'
    END as device_status_in_session
FROM sessions s
JOIN couriers c ON s.courier_id = c.id
JOIN mobility_devices md ON s.device_id = md.id
ORDER BY s.start_date DESC;

-- Создаем функцию для обновления времени изменения записи
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_mobility_devices_updated_at 
    BEFORE UPDATE ON mobility_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_couriers_updated_at 
    BEFORE UPDATE ON couriers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Создаем функцию для проверки доступности средства перед началом сессии
CREATE OR REPLACE FUNCTION check_device_availability()
RETURNS TRIGGER AS $$
DECLARE
    v_is_personal BOOLEAN;
    v_is_device_busy BOOLEAN;
BEGIN
    -- Получаем информацию о средстве
    SELECT is_personal INTO v_is_personal
    FROM mobility_devices
    WHERE id = NEW.device_id;
    
    -- Если это средство компании (не личное), проверяем его доступность
    IF NOT v_is_personal THEN
        -- Проверяем, есть ли активная сессия у этого средства
        SELECT EXISTS(
            SELECT 1 FROM sessions 
            WHERE device_id = NEW.device_id 
            AND end_date IS NULL
        ) INTO v_is_device_busy;
        
        IF v_is_device_busy THEN
            RAISE EXCEPTION 'Средство с ID % уже используется в активной сессии', NEW.device_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для проверки доступности средства перед вставкой новой сессии
CREATE TRIGGER check_device_availability_before_insert
    BEFORE INSERT ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION check_device_availability();

-- Вставляем начальные данные: запись для личного средства
INSERT INTO mobility_devices (device_type, device_number, is_personal, is_active)
VALUES ('Личное средство', 'personal', TRUE, TRUE)
ON CONFLICT (device_number) DO NOTHING;

-- Комментарии к таблицам и полям
COMMENT ON TABLE mobility_devices IS 'Средства индивидуальной мобильности';
COMMENT ON COLUMN mobility_devices.device_type IS 'Тип средства (электросамокат, электровелосипед и т.д.)';
COMMENT ON COLUMN mobility_devices.device_number IS 'Идентификационный номер средства или "personal" для личного';
COMMENT ON COLUMN mobility_devices.is_personal IS 'Является ли средство личным курьера';
COMMENT ON COLUMN mobility_devices.is_active IS 'Активно ли средство для учета (false - не включать в списки)';

COMMENT ON TABLE couriers IS 'Курьеры';
COMMENT ON COLUMN couriers.full_name IS 'ФИО курьера';
COMMENT ON COLUMN couriers.nickname IS 'Уникальный псевдоним курьера';
COMMENT ON COLUMN couriers.phone_number IS 'Номер телефона курьера';

COMMENT ON TABLE sessions IS 'Сессии использования средств';
COMMENT ON COLUMN sessions.courier_id IS 'ID курьера (ссылка на couriers)';
COMMENT ON COLUMN sessions.device_id IS 'ID используемого средства (ссылка на mobility_devices)';
COMMENT ON COLUMN sessions.start_date IS 'Дата начала сессии';
COMMENT ON COLUMN sessions.end_date IS 'Дата окончания сессии (NULL для активной сессии)';

-- Комментарии к таблице admins
COMMENT ON TABLE admins IS 'Администраторы системы';
COMMENT ON COLUMN admins.telegram_id IS 'Telegram ID пользователя';
COMMENT ON COLUMN admins.telegram_username IS 'Telegram username (опционально)';
COMMENT ON COLUMN admins.full_name IS 'ФИО администратора';
COMMENT ON COLUMN admins.added_at IS 'Дата добавления';
COMMENT ON COLUMN admins.added_by IS 'Кто добавил (ссылка на admins.id)';
COMMENT ON COLUMN admins.is_active IS 'Активен ли администратор';
COMMENT ON COLUMN admins.permissions_level IS 'Уровень прав (1-3)';
COMMENT ON COLUMN admins.notes IS 'Заметки/комментарии';
