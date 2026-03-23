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

export interface ActiveSessionByDeviceRecord {
    id: number;
    courier_id: number;
    device_id: number;
    warehouse_id: number;
    start_date: Date;
    end_date: Date | null;
    sim_status_after: string | null;
    status_comment: string | null;
    is_active: boolean;
    courier_full_name: string;
}

export interface SessionHistoryByDeviceRecord {
    start_date: Date;
    end_date: Date | null;
    sim_status_after: string | null;
    status_comment: string | null;
    is_active: boolean;
    courier_full_name: string;
}

export interface ActiveSessionByCourierWithDeviceRecord {
    id: number;
    courier_id: number;
    device_id: number;
    warehouse_id: number;
    start_date: Date;
    end_date: Date | null;
    sim_status_after: string | null;
    status_comment: string | null;
    is_active: boolean;
    device_number: string;
}

export interface ActiveSessionByWarehouseRecord {
    id: number;
    courier_id: number;
    device_id: number;
    warehouse_id: number;
    start_date: Date;
    end_date: Date | null;
    sim_status_after: string | null;
    status_comment: string | null;
    is_active: boolean;
    courier_full_name: string;
    device_number: string | null;
    device_is_personal: boolean;
}

export interface SessionHistoryByCourierRecord {
    start_date: Date;
    end_date: Date | null;
    device_number: string;
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

    public async findActiveByDevice(deviceId: number): Promise<ActiveSessionByDeviceRecord | null> {
        const query = `
            SELECT
                s.*,
                c.full_name AS courier_full_name
            FROM session s
            INNER JOIN couriers c ON c.id = s.courier_id
            WHERE s.device_id = $1
              AND s.is_active = true
            ORDER BY s.start_date DESC, s.id DESC
            LIMIT 1
        `;

        const { rows } = await this.db.query<ActiveSessionByDeviceRecord>(query, [deviceId]);
        return rows[0] ?? null;
    }

    public async hasActiveByDevice(deviceId: number): Promise<boolean> {
        const query = `
            SELECT 1
            FROM session
            WHERE device_id = $1
              AND is_active = true
            LIMIT 1
        `;

        const result = await this.db.query<{ one: number }>(query, [deviceId]);
        return (result.rowCount ?? 0) > 0;
    }

    public async getHistoryByDevice(deviceId: number): Promise<SessionHistoryByDeviceRecord[]> {
        const query = `
            SELECT
                s.start_date,
                s.end_date,
                s.sim_status_after,
                s.status_comment,
                s.is_active,
                c.full_name AS courier_full_name
            FROM session s
            INNER JOIN couriers c ON c.id = s.courier_id
            WHERE s.device_id = $1
            ORDER BY s.start_date DESC, s.id DESC
        `;

        const { rows } = await this.db.query<SessionHistoryByDeviceRecord>(query, [deviceId]);
        return rows;
    }

    public async getLastMalfunctionCommentByDevice(deviceId: number): Promise<string | null> {
        const query = `
            SELECT status_comment
            FROM session
            WHERE device_id = $1
              AND sim_status_after IN ('warning', 'broken')
              AND status_comment IS NOT NULL
              AND TRIM(status_comment) <> ''
            ORDER BY end_date DESC NULLS LAST, id DESC
            LIMIT 1
        `;

        const { rows } = await this.db.query<{ status_comment: string }>(query, [deviceId]);
        return rows[0]?.status_comment ?? null;
    }

    public async findActiveByCourierWithDevice(courierId: number): Promise<ActiveSessionByCourierWithDeviceRecord | null> {
        const query = `
            SELECT
                s.*,
                d.device_number
            FROM session s
            INNER JOIN mobility_devices d ON d.id = s.device_id
            WHERE s.courier_id = $1
              AND s.is_active = true
            ORDER BY s.start_date DESC, s.id DESC
            LIMIT 1
        `;

        const { rows } = await this.db.query<ActiveSessionByCourierWithDeviceRecord>(query, [courierId]);
        return rows[0] ?? null;
    }

    public async findActiveByWarehouse(warehouseId: number): Promise<ActiveSessionByWarehouseRecord[]> {
        const query = `
            SELECT
                s.*,
                c.full_name AS courier_full_name,
                d.device_number,
                d.is_personal AS device_is_personal
            FROM session s
            INNER JOIN couriers c ON c.id = s.courier_id
            INNER JOIN mobility_devices d ON d.id = s.device_id
            WHERE s.warehouse_id = $1
              AND s.is_active = true
            ORDER BY c.full_name ASC, s.start_date DESC, s.id DESC
        `;

        const { rows } = await this.db.query<ActiveSessionByWarehouseRecord>(query, [warehouseId]);
        return rows;
    }

    public async getHistoryByCourier(courierId: number, limit?: number): Promise<SessionHistoryByCourierRecord[]> {
        const hasLimit = typeof limit === 'number' && Number.isFinite(limit) && limit > 0;

        const query = hasLimit
            ? `
                SELECT
                    s.start_date,
                    s.end_date,
                    d.device_number
                FROM session s
                INNER JOIN mobility_devices d ON d.id = s.device_id
                WHERE s.courier_id = $1
                ORDER BY s.start_date DESC, s.id DESC
                LIMIT $2
            `
            : `
                SELECT
                    s.start_date,
                    s.end_date,
                    d.device_number
                FROM session s
                INNER JOIN mobility_devices d ON d.id = s.device_id
                WHERE s.courier_id = $1
                ORDER BY s.start_date DESC, s.id DESC
            `;

        const params = hasLimit ? [courierId, Math.floor(limit as number)] : [courierId];
        const { rows } = await this.db.query<SessionHistoryByCourierRecord>(query, params);
        return rows;
    }
}
