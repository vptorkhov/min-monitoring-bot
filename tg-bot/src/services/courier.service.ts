// src/services/courier.service.ts

import { CourierRepository, CreateCourierData, CourierFromDB } from '../repositories/courier.repository';
import { validatePhoneNumber, formatPhoneNumber } from '../validators/phone.validator';
import { extractUserDataFromMessage } from '../utils/telegram.utils';
import { getDatabase } from '../config/database'; // <-- импортируем функцию получения pool

// Интерфейс для результата проверки курьера
export interface CourierCheckResult {
    exists: boolean;
    courier?: CourierFromDB;
    isActive?: boolean;
}

// Интерфейс для результата регистрации
export interface RegistrationResult {
    success: boolean;
    courier?: CourierFromDB;
    error?: string;
}

export class CourierService {
    private repository: CourierRepository;

    constructor() { // <-- убрали параметр pool из конструктора
        // Получаем pool через getDatabase() и создаем репозиторий
        const pool = getDatabase();
        this.repository = new CourierRepository(pool);
    }

    // Проверка существования курьера по Telegram ID
    async checkCourierExists(telegramId: number): Promise<CourierCheckResult> {
        const courier = await this.repository.findByTelegramId(telegramId);

        if (!courier) {
            return { exists: false };
        }

        return {
            exists: true,
            courier,
            isActive: courier.is_active
        };
    }

    // Валидация и подготовка номера телефона
    validateAndPreparePhone(phone: string): { isValid: boolean; cleaned?: string; formatted?: string; error?: string } {
        if (!validatePhoneNumber(phone)) {
            return {
                isValid: false,
                error: 'Некорректный формат номера. Пожалуйста, введите номер в международном формате (например, +79001234567)'
            };
        }

        const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
        const formatted = formatPhoneNumber(phone);

        return {
            isValid: true,
            cleaned,
            formatted
        };
    }

    // Проверка, не занят ли номер телефона
    async isPhoneNumberTaken(phoneNumber: string): Promise<boolean> {
        return await this.repository.existsByPhoneNumber(phoneNumber);
    }

    // Регистрация нового курьера
    async registerCourier(data: {
        fullName: string;
        phoneNumber: string;
        telegramId: number;
        nickname?: string | null;
    }): Promise<RegistrationResult> {
        try {
            // Проверяем, не занят ли номер
            const isPhoneTaken = await this.isPhoneNumberTaken(data.phoneNumber);

            if (isPhoneTaken) {
                return {
                    success: false,
                    error: 'Этот номер телефона уже зарегистрирован в системе'
                };
            }

            // Создаем курьера
            const createData: CreateCourierData = {
                fullName: data.fullName,
                phoneNumber: data.phoneNumber,
                telegramId: data.telegramId,
                nickname: data.nickname
            };

            const courier = await this.repository.create(createData);

            return {
                success: true,
                courier
            };

        } catch (error) {
            console.error('Ошибка при регистрации курьера:', error);
            return {
                success: false,
                error: 'Произошла ошибка при регистрации. Пожалуйста, попробуйте позже'
            };
        }
    }

    // Извлечение данных из сообщения Telegram (обертка над утилитой)
    extractUserData(msg: any) {
        return extractUserDataFromMessage(msg);
    }
}