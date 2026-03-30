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
    telegram_id: number;              // добавлено: поле присутствует в таблице
    full_name: string;
    nickname: string | null;
    phone_number: string;
    warehouse_id: number | null;
    is_active: boolean;
    notified_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface PendingCourierApprovalCandidate {
    id: number;
    telegram_id: number;
    full_name: string;
    nickname: string | null;
}

export interface EditableCourierCandidate {
    id: number;
    full_name: string;
    nickname: string | null;
    phone_number: string;
    warehouse_id: number | null;
    is_active: boolean;
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

    async findById(id: number): Promise<CourierFromDB | null> {
        const result = await this.pool.query<CourierFromDB>(
            'SELECT * FROM couriers WHERE id = $1',
            [id]
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

    async updateFullName(id: number, fullName: string): Promise<boolean> {
        const result = await this.pool.query(
            'UPDATE couriers SET full_name = $1 WHERE id = $2',
            [fullName, id]
        );

        return (result.rowCount ?? 0) > 0;
    }

    async findInactiveWithoutSessions(): Promise<PendingCourierApprovalCandidate[]> {
        const result = await this.pool.query<PendingCourierApprovalCandidate>(
            `SELECT c.id, c.telegram_id, c.full_name, c.nickname
             FROM couriers c
             WHERE c.is_active = false
               AND NOT EXISTS (
                   SELECT 1
                   FROM session s
                   WHERE s.courier_id = c.id
               )
             ORDER BY c.created_at ASC, c.id ASC`
        );

        return result.rows;
    }

    async deleteInactiveWithoutSessionsById(id: number): Promise<boolean> {
        const result = await this.pool.query(
            `DELETE FROM couriers c
             WHERE c.id = $1
               AND c.is_active = false
               AND NOT EXISTS (
                   SELECT 1
                   FROM session s
                   WHERE s.courier_id = c.id
               )`,
            [id]
        );

        return (result.rowCount ?? 0) > 0;
    }

    // Получить всех активированных курьеров
    async findAllActive(): Promise<CourierFromDB[]> {
        const result = await this.pool.query<CourierFromDB>(
            'SELECT * FROM couriers WHERE is_active = true'
        );
        return result.rows;
    }

    async findEditableByWarehouseId(warehouseId: number): Promise<EditableCourierCandidate[]> {
        const result = await this.pool.query<EditableCourierCandidate>(
            `SELECT id, full_name, nickname, phone_number, warehouse_id, is_active
             FROM couriers
             WHERE warehouse_id = $1
             ORDER BY full_name ASC, id ASC`,
            [warehouseId]
        );

        return result.rows;
    }

    async findAllEditable(): Promise<EditableCourierCandidate[]> {
        const result = await this.pool.query<EditableCourierCandidate>(
            `SELECT id, full_name, nickname, phone_number, warehouse_id, is_active
             FROM couriers
             ORDER BY full_name ASC, id ASC`
        );

        return result.rows;
    }

    // Получить активированных курьеров, которым ещё не отправлено уведомление
    async findActiveNotNotified(): Promise<CourierFromDB[]> {
        const result = await this.pool.query<CourierFromDB>(
            'SELECT * FROM couriers WHERE is_active = true AND notified_at IS NULL'
        );
        return result.rows;
    }

    // Обновить время отправки уведомления
    async updateNotifiedAt(id: number): Promise<void> {
        await this.pool.query(
            'UPDATE couriers SET notified_at = NOW() WHERE id = $1',
            [id]
        );
    }

    // --- Новый метод: обновление склада курьера ---
    async updateWarehouse(id: number, warehouseId: number | null): Promise<CourierFromDB | null> {
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