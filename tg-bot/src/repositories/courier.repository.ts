// src/repositories/courier.repository.ts

import { Pool } from 'pg';

// Интерфейс для создания нового курьера
export interface CreateCourierData {
    fullName: string;
    phoneNumber: string;
    telegramId: number;
    nickname?: string | null;
}

// Интерфейс для данных курьера из БД
export interface CourierFromDB {
    id: number;
    full_name: string;
    nickname: string | null;
    phone_number: string;
    warehouse_id: number | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export class CourierRepository {
    constructor(private pool: Pool) { }

    // Поиск курьера по Telegram ID
    async findByTelegramId(telegramId: number): Promise<CourierFromDB | null> {
        const result = await this.pool.query<CourierFromDB>(
            'SELECT * FROM couriers WHERE telegram_id = $1',
            [telegramId]
        );

        return result.rows[0] || null;
    }

    // Создание нового курьера
    async create(data: CreateCourierData): Promise<CourierFromDB> {
        const { fullName, phoneNumber, telegramId, nickname } = data;

        const result = await this.pool.query<CourierFromDB>(
            `INSERT INTO couriers 
             (full_name, phone_number, telegram_id, nickname, is_active) 
             VALUES ($1, $2, $3, $4, false) 
             RETURNING *`,
            [fullName, phoneNumber, telegramId, nickname || null]
        );

        return result.rows[0];
    }

    // Проверка существования курьера по номеру телефона
    async existsByPhoneNumber(phoneNumber: string): Promise<boolean> {
        const result = await this.pool.query(
            'SELECT id FROM couriers WHERE phone_number = $1',
            [phoneNumber]
        );

        return (result.rowCount ?? 0) > 0;
    }

    // Обновление статуса активности (на будущее)
    async updateActiveStatus(id: number, isActive: boolean): Promise<boolean> {
        const result = await this.pool.query(
            'UPDATE couriers SET is_active = $1 WHERE id = $2',
            [isActive, id]
        );

        return (result.rowCount ?? 0) > 0;
    }

    // --- Новый метод: обновление склада курьера ---
    async updateWarehouse(id: number, warehouseId: number): Promise<CourierFromDB | null> {
        const result = await this.pool.query<CourierFromDB>(
            `UPDATE couriers 
             SET warehouse_id = $1, updated_at = NOW() 
             WHERE id = $2
             RETURNING *`,
            [warehouseId, id]
        );

        return result.rows[0] ?? null;
    }
}