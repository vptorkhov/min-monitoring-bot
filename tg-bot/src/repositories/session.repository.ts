// src/repositories/session.repository.ts

import { Pool } from 'pg';
import { getDatabase } from '../config/database';

export interface SessionRecord {
    id: number;
    courier_id: number;
    device_id: number;
    warehouse_id: number;
    start_date: Date;
    end_date: Date | null;
    is_active: boolean;
}

export class SessionRepository {
    private db: Pool;

    constructor(pool?: Pool) {
        this.db = pool || getDatabase();
    }

    public async findActiveByCourier(courierId: number): Promise<SessionRecord | null> {
        const query = `SELECT * FROM session WHERE courier_id = $1 AND is_active = true LIMIT 1`;
        const { rows } = await this.db.query<SessionRecord>(query, [courierId]);
        return rows[0] ?? null;
    }

    public async createSession(data: {
        courier_id: number;
        device_id: number;
        warehouse_id: number;
    }): Promise<SessionRecord> {
        const query = `
            INSERT INTO session (courier_id, device_id, warehouse_id)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const { rows } = await this.db.query<SessionRecord>(query, [
            data.courier_id,
            data.device_id,
            data.warehouse_id
        ]);
        return rows[0];
    }

    public async closeSession(courierId: number, endDate: Date = new Date()): Promise<void> {
        const query = `
            UPDATE session
            SET end_date = $1
            WHERE courier_id = $2 AND is_active = true
        `;
        await this.db.query(query, [endDate.toISOString(), courierId]);
    }

    public async findById(id: number): Promise<SessionRecord | null> {
        const query = `SELECT * FROM session WHERE id = $1 LIMIT 1`;
        const { rows } = await this.db.query<SessionRecord>(query, [id]);
        return rows[0] ?? null;
    }
}
