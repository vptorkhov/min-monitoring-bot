import { Pool } from 'pg';
import { getDatabase } from '../config/database';

export interface AdminFromDB {
    id: number;
    nickname: string;
    password_hash: string;
    permissions_level: number;
    is_active: boolean;
    is_login: boolean;
    created_at: Date;
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
}
