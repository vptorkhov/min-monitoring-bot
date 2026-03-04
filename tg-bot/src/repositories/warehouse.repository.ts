// src/repositories/warehouse.repository.ts

import { Warehouse } from './types/warehouse.type';
import { getDatabase } from '../config/database';

export class WarehouseRepository {
    private db = getDatabase();

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
}