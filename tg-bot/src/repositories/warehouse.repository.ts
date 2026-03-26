// src/repositories/warehouse.repository.ts

import { Warehouse } from './types/warehouse.type';
import { getDatabase } from '../config/database';

export class WarehouseRepository {
    private db = getDatabase();

    // Получить все склады (включая отключенные)
    public async getAllWarehouses(): Promise<Warehouse[]> {
        const query = 'SELECT id, name, address, is_active FROM warehouse ORDER BY id';
        const { rows } = await this.db.query<Warehouse>(query);
        return rows;
    }

    // Получить все активные склады
    public async getActiveWarehouses(): Promise<Warehouse[]> {
        const query = 'SELECT id, name, address, is_active FROM warehouse WHERE is_active = true ORDER BY name';
        const { rows } = await this.db.query<Warehouse>(query);
        return rows;
    }

    // Получить склад по ID
    public async getById(id: number): Promise<Warehouse | null> {
        const query = 'SELECT id, name, address, is_active FROM warehouse WHERE id = $1 LIMIT 1';
        const { rows } = await this.db.query<Warehouse>(query, [id]);
        return rows[0] ?? null;
    }

    // Создать новый склад
    public async createWarehouse(name: string, address: string): Promise<Warehouse> {
        const query = `
            INSERT INTO warehouse (name, address, is_active)
            VALUES ($1, $2, true)
            RETURNING id, name, address, is_active
        `;
        const { rows } = await this.db.query<Warehouse>(query, [name, address]);
        return rows[0];
    }

    // Обновить название склада
    public async updateWarehouseName(id: number, name: string): Promise<Warehouse | null> {
        const query = `
            UPDATE warehouse
            SET name = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING id, name, address, is_active
        `;
        const { rows } = await this.db.query<Warehouse>(query, [id, name]);
        return rows[0] ?? null;
    }

    // Обновить адрес склада
    public async updateWarehouseAddress(id: number, address: string): Promise<Warehouse | null> {
        const query = `
            UPDATE warehouse
            SET address = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING id, name, address, is_active
        `;
        const { rows } = await this.db.query<Warehouse>(query, [id, address]);
        return rows[0] ?? null;
    }

    // Обновить статус склада
    public async updateWarehouseStatus(id: number, isActive: boolean): Promise<Warehouse | null> {
        const query = `
            UPDATE warehouse
            SET is_active = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING id, name, address, is_active
        `;
        const { rows } = await this.db.query<Warehouse>(query, [id, isActive]);
        return rows[0] ?? null;
    }

    // Проверить наличие активных сессий по складу
    public async hasActiveSessionsByWarehouseId(id: number): Promise<boolean> {
        const query = 'SELECT 1 FROM session WHERE warehouse_id = $1 AND is_active = true LIMIT 1';
        const { rowCount } = await this.db.query(query, [id]);
        return (rowCount ?? 0) > 0;
    }

    // Проверить наличие любых сессий по складу
    public async hasAnySessionsByWarehouseId(id: number): Promise<boolean> {
        const query = 'SELECT 1 FROM session WHERE warehouse_id = $1 LIMIT 1';
        const { rowCount } = await this.db.query(query, [id]);
        return (rowCount ?? 0) > 0;
    }

    // Удалить склад
    public async deleteWarehouse(id: number): Promise<boolean> {
        try {
            const query = 'DELETE FROM warehouse WHERE id = $1';
            const { rowCount } = await this.db.query(query, [id]);
            return (rowCount ?? 0) > 0;
        } catch {
            return false;
        }
    }
}