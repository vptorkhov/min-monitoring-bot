import { Pool } from 'pg';
import { getDatabase } from '../config/database';

export interface AdminFromDB {
    id: number;
    nickname: string;
    password_hash: string;
    permissions_level: number;
    is_active: boolean;
    is_login: boolean;
    warehouse_id: number | null;
    created_at: Date;
}

export interface EditableAdminFromDB {
    id: number;
    nickname: string;
    permissions_level: number;
    is_active: boolean;
}

export class AdminRepository {
    private db: Pool;

    constructor(pool?: Pool) {
        this.db = pool || getDatabase();
    }

    async existsByNicknameInsensitive(nickname: string): Promise<boolean> {
        const result = await this.db.query<{ id: number }>(
            'SELECT id FROM admins WHERE LOWER(nickname) = LOWER($1) LIMIT 1',
            [nickname]
        );

        return (result.rowCount ?? 0) > 0;
    }

    async createPendingAdmin(nickname: string, passwordHash: string): Promise<AdminFromDB | null> {
        const result = await this.db.query<AdminFromDB>(
            `INSERT INTO admins (nickname, password_hash, permissions_level, is_active, is_login)
             SELECT $1::varchar, $2, 1, FALSE, FALSE
             WHERE NOT EXISTS (
                 SELECT 1 FROM admins WHERE LOWER(nickname) = LOWER($1::varchar)
             )
             RETURNING *`,
            [nickname, passwordHash]
        );

        return result.rows[0] || null;
    }

    async getByNicknameInsensitive(nickname: string): Promise<AdminFromDB | null> {
        const result = await this.db.query<AdminFromDB>(
            'SELECT * FROM admins WHERE LOWER(nickname) = LOWER($1) LIMIT 1',
            [nickname]
        );

        return result.rows[0] || null;
    }

    async updateLoginStatus(adminId: number, isLogin: boolean): Promise<void> {
        await this.db.query(
            'UPDATE admins SET is_login = $2 WHERE id = $1',
            [adminId, isLogin]
        );
    }

    async updatePasswordHash(adminId: number, passwordHash: string): Promise<boolean> {
        const result = await this.db.query(
            'UPDATE admins SET password_hash = $2 WHERE id = $1',
            [adminId, passwordHash]
        );

        return (result.rowCount ?? 0) > 0;
    }

    async updateWarehouse(adminId: number, warehouseId: number | null): Promise<boolean> {
        const result = await this.db.query(
            'UPDATE admins SET warehouse_id = $2 WHERE id = $1',
            [adminId, warehouseId]
        );

        return (result.rowCount ?? 0) > 0;
    }

    async getEditableAdmins(): Promise<EditableAdminFromDB[]> {
        const result = await this.db.query<EditableAdminFromDB>(
            `SELECT id, nickname, permissions_level, is_active
             FROM admins
             WHERE permissions_level < 2
             ORDER BY LOWER(nickname) ASC, id ASC`
        );

        return result.rows;
    }

    async getById(adminId: number): Promise<AdminFromDB | null> {
        const result = await this.db.query<AdminFromDB>(
            'SELECT * FROM admins WHERE id = $1 LIMIT 1',
            [adminId]
        );

        return result.rows[0] || null;
    }

    async updateActiveStatus(adminId: number, isActive: boolean): Promise<boolean> {
        const result = await this.db.query(
            'UPDATE admins SET is_active = $2 WHERE id = $1',
            [adminId, isActive]
        );

        return (result.rowCount ?? 0) > 0;
    }

    async deleteById(adminId: number): Promise<boolean> {
        try {
            const result = await this.db.query(
                'DELETE FROM admins WHERE id = $1',
                [adminId]
            );

            return (result.rowCount ?? 0) > 0;
        } catch {
            return false;
        }
    }
}
