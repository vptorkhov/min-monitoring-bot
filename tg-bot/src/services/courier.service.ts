// src/services/courier.service.ts

import { CourierRepository, CreateCourierData, CourierFromDB } from '../repositories/courier.repository';
import { validatePhoneNumber, formatPhoneNumber } from '../validators/phone.validator';
import { extractUserDataFromMessage } from '../utils/telegram.utils';
import { getDatabase } from '../config/database';
import { WarehouseService } from './warehouse.service'; // Импорт сервиса складов
import { SessionRepository } from '../repositories/session.repository'; // проверка активной сессии

export interface CourierCheckResult {
    exists: boolean;
    courier?: CourierFromDB;
    isActive?: boolean;
}

export interface RegistrationResult {
    success: boolean;
    courier?: CourierFromDB;
    error?: string;
}

export class CourierService {
    private repository: CourierRepository;

    constructor() {
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

    // Получить список всех активных курьеров (для уведомления об активации)
    async getActiveCouriers(): Promise<CourierFromDB[]> {
        return await this.repository.findAllActive();
    }

    // Регистрация нового курьера
    async registerCourier(data: {
        fullName: string;
        phoneNumber: string;
        telegramId: number;
        nickname?: string | null;
    }): Promise<RegistrationResult> {
        try {
            const isPhoneTaken = await this.isPhoneNumberTaken(data.phoneNumber);

            if (isPhoneTaken) {
                return {
                    success: false,
                    error: 'Этот номер телефона уже зарегистрирован в системе'
                };
            }

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

    // Извлечение данных из сообщения Telegram
    extractUserData(msg: any) {
        return extractUserDataFromMessage(msg);
    }

    // --- Новый метод: прикрепление курьера к складу ---
    async assignWarehouse(
        telegramId: number,
        warehouseId: number,
        warehouseService: WarehouseService
    ): Promise<{ success: boolean; message?: string; courier?: CourierFromDB }> {

        // 1. Проверка существования курьера
        const check = await this.checkCourierExists(telegramId);
        if (!check.exists || !check.courier) {
            return { success: false, message: 'Курьер не найден' };
        }
        if (!check.isActive) {
            return { success: false, message: 'Курьер не активирован администратором' };
        }

        const courier = check.courier;

        // Запрет на смену склада, если у курьера есть активная сессия
        const sessionRepo = new SessionRepository();
        const hasActive = !!(await sessionRepo.findActiveByCourier(courier.id));
        if (hasActive) {
            return { success: false, message: 'У вас есть активная сессия, сначала сдайте СИМ' };
        }

        // 2. Проверка выбранного склада
        const isValidWarehouse = await warehouseService.validateWarehouseIsActive(warehouseId);
        if (!isValidWarehouse) {
            return { success: false, message: 'Выбранный склад не существует или не активен' };
        }

        // 3. Обновление склада в БД
        const updatedCourier = await this.repository.updateWarehouse(courier.id, warehouseId);
        if (!updatedCourier) {
            return { success: false, message: 'Не удалось обновить склад курьера' };
        }

        // 4. Возврат результата
        return { success: true, courier: updatedCourier };
    }
}