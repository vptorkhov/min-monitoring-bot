// src/repositories/mobility-device.repository.ts

import { Pool } from 'pg';
import { getDatabase } from '../config/database';

export interface MobilityDevice {
    id: number;
    device_number: string | null;
    is_personal: boolean;
    status: string;
    warehouse_id: number | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface DeleteDeviceWithSessionsResult {
    deleted: boolean;
    blockedByActiveSession: boolean;
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
                        SELECT md.*
                        FROM mobility_devices md
                        WHERE md.is_active = true
                            AND (md.is_personal = true OR md.warehouse_id = $1)
                            AND NOT EXISTS (
                                    SELECT 1
                                    FROM session s
                                    WHERE s.device_id = md.id
                                        AND s.is_active = true
                            )
                        ORDER BY md.is_personal DESC, md.id;
        `;
        const { rows } = await this.db.query<MobilityDevice>(query, [warehouseId]);
        return rows;
    }

    public async updateStatus(deviceId: number, status: string, makeInactive?: boolean): Promise<void> {
        const parts: string[] = [];
        const params: any[] = [];
        let idx = 1;

        parts.push(`status = $${idx++}`);
        params.push(status);

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

    public async findByDeviceNumber(deviceNumber: string): Promise<MobilityDevice | null> {
        const query = 'SELECT * FROM mobility_devices WHERE device_number = $1 LIMIT 1';
        const { rows } = await this.db.query<MobilityDevice>(query, [deviceNumber]);
        return rows[0] ?? null;
    }

    public async createDevice(deviceNumber: string, warehouseId: number): Promise<MobilityDevice> {
        const query = `
            INSERT INTO mobility_devices (device_number, is_personal, status, is_active, warehouse_id)
            VALUES ($1, false, 'ok', true, $2)
            RETURNING *
        `;
        const { rows } = await this.db.query<MobilityDevice>(query, [deviceNumber, warehouseId]);
        return rows[0];
    }

    public async getDevicesForWarehouseWithoutPersonal(warehouseId: number): Promise<MobilityDevice[]> {
        const query = `
            SELECT *
            FROM mobility_devices
            WHERE warehouse_id = $1
              AND is_personal = false
            ORDER BY id ASC
        `;

        const { rows } = await this.db.query<MobilityDevice>(query, [warehouseId]);
        return rows;
    }

    public async findByDeviceNumberInWarehouse(warehouseId: number, deviceNumber: string): Promise<MobilityDevice | null> {
        const query = `
            SELECT *
            FROM mobility_devices
            WHERE warehouse_id = $1
              AND is_personal = false
              AND device_number = $2
            LIMIT 1
        `;

        const { rows } = await this.db.query<MobilityDevice>(query, [warehouseId, deviceNumber]);
        return rows[0] ?? null;
    }

    public async updateActiveById(deviceId: number, isActive: boolean): Promise<boolean> {
        const query = `
            UPDATE mobility_devices
            SET is_active = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `;

        const result = await this.db.query(query, [deviceId, isActive]);
        return (result.rowCount ?? 0) > 0;
    }

    public async updateConditionStatusById(deviceId: number, status: string): Promise<boolean> {
        const query = `
            UPDATE mobility_devices
            SET status = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `;

        const result = await this.db.query(query, [deviceId, status]);
        return (result.rowCount ?? 0) > 0;
    }

    public async deleteById(deviceId: number): Promise<boolean> {
        try {
            const query = 'DELETE FROM mobility_devices WHERE id = $1';
            const result = await this.db.query(query, [deviceId]);
            return (result.rowCount ?? 0) > 0;
        } catch {
            return false;
        }
    }

    /**
     * Удаляет СИМ вместе с историей его сессий.
     * Если по СИМ есть активная сессия, удаление блокируется.
     */
    public async deleteByIdWithSessions(deviceId: number): Promise<DeleteDeviceWithSessionsResult> {
        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            const activeCheck = await client.query(
                'SELECT 1 FROM session WHERE device_id = $1 AND is_active = true LIMIT 1',
                [deviceId]
            );

            if ((activeCheck.rowCount ?? 0) > 0) {
                await client.query('ROLLBACK');
                return { deleted: false, blockedByActiveSession: true };
            }

            await client.query('DELETE FROM session WHERE device_id = $1', [deviceId]);

            const deleteResult = await client.query(
                'DELETE FROM mobility_devices WHERE id = $1',
                [deviceId]
            );

            await client.query('COMMIT');
            return {
                deleted: (deleteResult.rowCount ?? 0) > 0,
                blockedByActiveSession: false,
            };
        } catch {
            await client.query('ROLLBACK');
            return { deleted: false, blockedByActiveSession: false };
        } finally {
            client.release();
        }
    }
}
