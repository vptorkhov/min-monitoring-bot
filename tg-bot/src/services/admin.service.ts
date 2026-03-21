import { createHash } from 'crypto';
import { AdminRepository } from '../repositories/admin.repository';

export interface AdminRegistrationResult {
    success: boolean;
    error?: string;
    duplicateInsensitive?: boolean;
}

export interface AdminLoginCandidate {
    id: number;
    nickname: string;
    passwordHash: string;
    permissionsLevel: number;
    isActive: boolean;
}

export interface AdminChangePasswordResult {
    success: boolean;
    reason?: string;
}

export interface EditableAdmin {
    id: number;
    nickname: string;
    permissionsLevel: number;
    isActive: boolean;
}

export interface AdminMutateResult {
    success: boolean;
    reason?: string;
}

export class AdminService {
    private repository: AdminRepository;

    constructor(repository?: AdminRepository) {
        this.repository = repository || new AdminRepository();
    }

    validateLogin(login: string): { isValid: boolean; error?: string } {
        const trimmed = login.trim();

        if (trimmed.length < 3) {
            return {
                isValid: false,
                error: 'Логин должен содержать минимум 3 символа.'
            };
        }

        if (!/^[A-Za-z0-9_]+$/.test(trimmed)) {
            return {
                isValid: false,
                error: 'Логин должен содержать только латинские буквы, цифры или символ _.'
            };
        }

        if (!/[A-Za-z]/.test(trimmed)) {
            return {
                isValid: false,
                error: 'Логин должен содержать хотя бы одну латинскую букву.'
            };
        }

        return { isValid: true };
    }

    validatePassword(password: string): { isValid: boolean; error?: string } {
        if (password.length < 6) {
            return {
                isValid: false,
                error: 'Пароль не соответствует требованиям: минимум 6 символов.'
            };
        }

        return { isValid: true };
    }

    async isLoginTakenInsensitive(login: string): Promise<boolean> {
        return this.repository.existsByNicknameInsensitive(login.trim());
    }

    hashPassword(password: string): string {
        return createHash('sha256')
            .update(`${password}mim`)
            .digest('hex');
    }

    async registerPendingAdmin(login: string, password: string): Promise<AdminRegistrationResult> {
        const normalizedLogin = login.trim();
        const passwordHash = this.hashPassword(password);
        const created = await this.repository.createPendingAdmin(normalizedLogin, passwordHash);

        if (!created) {
            return {
                success: false,
                duplicateInsensitive: true,
                error: 'Администратор с таким логином уже существует (без учета регистра).'
            };
        }

        return { success: true };
    }

    async getLoginCandidate(login: string): Promise<AdminLoginCandidate | null> {
        const admin = await this.repository.getByNicknameInsensitive(login.trim());
        if (!admin) {
            return null;
        }

        return {
            id: admin.id,
            nickname: admin.nickname,
            passwordHash: admin.password_hash,
            permissionsLevel: admin.permissions_level,
            isActive: admin.is_active
        };
    }

    verifyPassword(password: string, expectedHash: string): boolean {
        return this.hashPassword(password) === expectedHash;
    }

    async setLoginStatus(adminId: number, isLogin: boolean): Promise<void> {
        await this.repository.updateLoginStatus(adminId, isLogin);
    }

    async changePassword(adminId: number, newPassword: string): Promise<AdminChangePasswordResult> {
        const validation = this.validatePassword(newPassword);
        if (!validation.isValid) {
            return {
                success: false,
                reason: validation.error
            };
        }

        const passwordHash = this.hashPassword(newPassword);
        const updated = await this.repository.updatePasswordHash(adminId, passwordHash);
        if (!updated) {
            return {
                success: false,
                reason: 'Не удалось обновить пароль администратора.'
            };
        }

        return { success: true };
    }

    async getEditableAdmins(): Promise<EditableAdmin[]> {
        const admins = await this.repository.getEditableAdmins();

        return admins.map((admin) => ({
            id: admin.id,
            nickname: admin.nickname,
            permissionsLevel: admin.permissions_level,
            isActive: admin.is_active
        }));
    }

    async getAdminById(adminId: number): Promise<EditableAdmin | null> {
        const admin = await this.repository.getById(adminId);
        if (!admin) {
            return null;
        }

        return {
            id: admin.id,
            nickname: admin.nickname,
            permissionsLevel: admin.permissions_level,
            isActive: admin.is_active
        };
    }

    async changeAdminActiveStatus(adminId: number, isActive: boolean): Promise<AdminMutateResult> {
        const updated = await this.repository.updateActiveStatus(adminId, isActive);

        if (!updated) {
            return {
                success: false,
                reason: 'Не удалось изменить статус администратора.'
            };
        }

        return { success: true };
    }

    async deleteAdmin(adminId: number): Promise<AdminMutateResult> {
        const deleted = await this.repository.deleteById(adminId);

        if (!deleted) {
            return {
                success: false,
                reason: 'Не удалось удалить администратора.'
            };
        }

        return { success: true };
    }
}
