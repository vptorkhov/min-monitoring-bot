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
    sim_status_after: string | null;
    status_comment: string | null;
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

    public async closeSession(courierId: number, endDate: Date = new Date(), simStatusAfter?: string, statusComment?: string): Promise<void> {
        const query = `
            UPDATE session
            SET end_date = $1, sim_status_after = $2, status_comment = $3
            WHERE courier_id = $4 AND is_active = true
        `;
        await this.db.query(query, [endDate.toISOString(), simStatusAfter || null, statusComment || null, courierId]);
    }

    public async findById(id: number): Promise<SessionRecord | null> {
        const query = `SELECT * FROM session WHERE id = $1 LIMIT 1`;
        const { rows } = await this.db.query<SessionRecord>(query, [id]);
        return rows[0] ?? null;
    }
}
