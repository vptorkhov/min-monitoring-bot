import { createHash } from 'crypto';
import { AdminRepository } from '../repositories/admin.repository';

export interface AdminRegistrationResult {
    success: boolean;
    error?: string;
    duplicateInsensitive?: boolean;
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
}
