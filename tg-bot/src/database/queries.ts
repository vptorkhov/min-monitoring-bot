import { dbClient } from '../config/database';

export const DatabaseQueries = {
    // Проверка регистрации пользователя
    async checkUserRegistration(telegramId: number): Promise<boolean> {
        try {
            const result = await dbClient.query(
                'SELECT id FROM couriers WHERE telegram_id = $1',
                [telegramId.toString()]
            );
            return result.rows.length > 0;
        } catch (error) {
            console.error('❌ Ошибка проверки регистрации:', error);
            return false;
        }
    },

    // Получение информации о курьере
    async getCourierInfo(telegramId: number) {
        try {
            const result = await dbClient.query(
                `SELECT id, full_name, nickname, phone_number, 
                        is_active, created_at, updated_at 
                 FROM couriers 
                 WHERE telegram_id = $1 
                 LIMIT 1`,
                [telegramId.toString()]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('❌ Ошибка получения информации о курьере:', error);
            return null;
        }
    },

    // Получение всех средств
    async getAllDevices() {
        try {
            const result = await dbClient.query(
                `SELECT * FROM devices_with_status_view 
                 ORDER BY is_personal DESC, device_number`
            );
            return result.rows;
        } catch (error) {
            console.error('❌ Ошибка получения списка средств:', error);
            return [];
        }
    },

    // Получение свободных средств
    async getAvailableDevices() {
        try {
            const result = await dbClient.query(
                `SELECT * FROM available_company_devices_view 
                 ORDER BY device_number`
            );
            return result.rows;
        } catch (error) {
            console.error('❌ Ошибка получения свободных средств:', error);
            return [];
        }
    }
};

// Завершить сессию
export const finishSessionQuery = `
  UPDATE sessions
  SET is_active = false,
      ended_at = NOW()
  WHERE id = $1
  RETURNING device_id;
`;

// Активировать транспорт
export const activateDeviceQuery = `
  UPDATE devices
  SET is_active = true
  WHERE id = $1;
`;
