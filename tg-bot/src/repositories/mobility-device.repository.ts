// src/repositories/mobility-device.repository.ts

import { Pool } from 'pg';
import { getDatabase } from '../config/database';

export interface MobilityDevice {
    id: number;
    device_number: string | null;
    is_personal: boolean;
    status: string;
    status_comment: string | null;
    warehouse_id: number | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export class MobilityDeviceRepository {
    private db: Pool;

    constructor(pool?: Pool) {
        this.db = pool || getDatabase();
    }

    /**
     * Возвращает активные устройства для склада, личный в начало.
     * Личный СИМ отображается всегда, даже если warehouse_id отличается.
     */
    public async getAvailableDevices(warehouseId: number, courierPersonalDeviceId: number | null): Promise<MobilityDevice[]> {
        // courierPersonalDeviceId -- id "ЛИЧНЫЙ" устройства, если нужно сортировать
        // Эта функция реализуется в SQL/при вызове сервиса.
        const query = `
            SELECT *
            FROM mobility_devices
            WHERE is_active = true
              AND (is_personal = true OR warehouse_id = $1)
            ORDER BY is_personal DESC, id;
        `;
        const { rows } = await this.db.query<MobilityDevice>(query, [warehouseId]);
        return rows;
    }

    public async updateStatus(deviceId: number, status: string, statusComment?: string | null, makeInactive?: boolean): Promise<void> {
        const parts: string[] = [];
        const params: any[] = [];
        let idx = 1;

        parts.push(`status = $${idx++}`);
        params.push(status);

        if (statusComment !== undefined) {
            parts.push(`status_comment = $${idx++}`);
            params.push(statusComment);
        }

        if (makeInactive) {
            parts.push(`is_active = false`);
        }

        const query = `UPDATE mobility_devices SET ${parts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}`;
        params.push(deviceId);

        await this.db.query(query, params);
    }

    public async findById(id: number): Promise<MobilityDevice | null> {
        const query = 'SELECT * FROM mobility_devices WHERE id = $1 LIMIT 1';
        const { rows } = await this.db.query<MobilityDevice>(query, [id]);
        return rows[0] ?? null;
    }
}
