// src/services/session.service.ts

import { CourierService } from './courier.service';
import {
    SessionRepository,
    SessionRecord
} from '../repositories/session.repository';
import { MobilityDeviceRepository } from '../repositories/mobility-device.repository';

export type DamageType = 'ok' | 'warning' | 'broken';

export interface EndSessionResult {
    success: boolean;
    error?: string;
    session?: SessionRecord;
}

export interface StartSessionResult {
    success: boolean;
    error?: string;
    session?: SessionRecord;
}

export interface ActiveWarehouseSessionView {
    courierFullName: string;
    courierNickname: string | null;
    deviceLabel: string;
    startDate: Date;
}

export interface WarehouseSessionHistoryView {
    courierFullName: string;
    courierNickname: string | null;
    deviceLabel: string;
    startDate: Date;
    endDate: Date | null;
    simStatusAfter: string | null;
    statusComment: string | null;
    isActive: boolean;
}

export class SessionService {
    private courierService: CourierService;
    private sessionRepo: SessionRepository;
    private deviceRepo: MobilityDeviceRepository;

    constructor(
        courierService?: CourierService,
        sessionRepo?: SessionRepository,
        deviceRepo?: MobilityDeviceRepository
    ) {
        this.courierService = courierService || new CourierService();
        this.sessionRepo = sessionRepo || new SessionRepository();
        this.deviceRepo = deviceRepo || new MobilityDeviceRepository();
    }

    /** Проверяет, есть ли у курьера активная сессия */
    public async hasActiveSession(telegramId: number): Promise<boolean> {
        const check = await this.courierService.checkCourierExists(telegramId);
        if (!check.exists || !check.courier) {
            return false;
        }
        const active = await this.sessionRepo.findActiveByCourier(check.courier.id);
        return !!active;
    }

    /**
     * Возвращает активную сессию курьера или null
     */
    public async getActiveSession(telegramId: number): Promise<SessionRecord | null> {
        const check = await this.courierService.checkCourierExists(telegramId);
        if (!check.exists || !check.courier) {
            return null;
        }
        return await this.sessionRepo.findActiveByCourier(check.courier.id);
    }

    /**
     * Проверяет, является ли текущее устройство личным
     */
    public async isActiveSessionPersonal(telegramId: number): Promise<boolean> {
        const session = await this.getActiveSession(telegramId);
        if (!session) return false;
        const device = await this.deviceRepo.findById(session.device_id);
        return !!device?.is_personal;
    }

    /** Запуск сессии: берет устройство в работу */
    public async startSession(telegramId: number, deviceId: number): Promise<StartSessionResult> {
        const check = await this.courierService.checkCourierExists(telegramId);
        if (!check.exists || !check.courier) {
            return { success: false, error: 'Курьер не найден' };
        }
        if (!check.isActive) {
            return { success: false, error: 'Курьер не активирован' };
        }

        const courier = check.courier;

        if (!courier.warehouse_id) {
            return { success: false, error: 'Курьер не привязан к складу' };
        }

        const already = await this.sessionRepo.findActiveByCourier(courier.id);
        if (already) {
            return { success: false, error: 'У вас уже есть активная сессия' };
        }

        // проверим, что устройство доступно и принадлежит складу
        const device = await this.deviceRepo.findById(deviceId);
        if (!device || !device.is_active) {
            return { success: false, error: 'Устройство не доступно' };
        }
        if (!device.is_personal && device.warehouse_id !== courier.warehouse_id) {
            return { success: false, error: 'Устройство не принадлежит вашему складу' };
        }

        const activeByDevice = await this.sessionRepo.hasActiveByDevice(deviceId);
        if (activeByDevice) {
            return { success: false, error: 'Этот Велосипед уже занят другим курьером' };
        }

        const session = await this.sessionRepo.createSession({
            courier_id: courier.id,
            device_id: deviceId,
            warehouse_id: courier.warehouse_id
        });

        return { success: true, session };
    }

    /** Завершение сессии. Передаётся тип повреждения и комментарий (если есть) */
    public async endSession(
        telegramId: number,
        damage: { type: DamageType; comment?: string } = { type: 'ok' }
    ): Promise<EndSessionResult> {
        const check = await this.courierService.checkCourierExists(telegramId);
        if (!check.exists || !check.courier) {
            return { success: false, error: 'Курьер не найден' };
        }
        if (!check.isActive) {
            return { success: false, error: 'Курьер не активирован' };
        }
        const courier = check.courier;

        const active = await this.sessionRepo.findActiveByCourier(courier.id);
        if (!active) {
            return { success: false, error: 'У вас нет активной сессии' };
        }

        // закрываем сессию с сохранением статуса и комментария
        await this.sessionRepo.closeSession(courier.id, new Date(), damage.type, damage.comment);

        // обновляем статус устройства (без комментария)
        const makeInactive = damage.type === 'broken';
        await this.deviceRepo.updateStatus(active.device_id, damage.type, makeInactive);

        return { success: true, session: active };
    }

    /** Получает текстовое представление устройства (номер или "Личный") */
    public async formatDeviceLabel(deviceId: number): Promise<string> {
        const device = await this.deviceRepo.findById(deviceId);
        if (!device) return 'неизвестный';
        return device.is_personal ? 'Личный' : device.device_number || 'без номера';
    }

    /** Получает все активные сессии по складу в формате для админского вывода */
    public async getActiveSessionsByWarehouse(warehouseId: number): Promise<ActiveWarehouseSessionView[]> {
        const sessions = await this.sessionRepo.findActiveByWarehouse(warehouseId);

        return sessions.map((session) => ({
            courierFullName: session.courier_full_name,
            courierNickname: session.courier_nickname,
            deviceLabel: session.device_is_personal
                ? 'Личный'
                : (session.device_number || 'без номера').toUpperCase(),
            startDate: session.start_date
        }));
    }

    /** Получает историю сессий склада по диапазону даты начала (UTC-границы дня) */
    public async getSessionsHistoryByWarehouseAndStartDateRange(
        warehouseId: number,
        startDateFromUtc: Date,
        startDateToUtc: Date,
    ): Promise<WarehouseSessionHistoryView[]> {
        const sessions = await this.sessionRepo.getHistoryByWarehouseAndStartDateRange(
            warehouseId,
            startDateFromUtc,
            startDateToUtc,
        );

        return sessions.map((session) => ({
            courierFullName: session.courier_full_name,
            courierNickname: session.courier_nickname,
            deviceLabel: session.device_is_personal
                ? 'Личный'
                : (session.device_number || 'без номера').toUpperCase(),
            startDate: session.start_date,
            endDate: session.end_date,
            simStatusAfter: session.sim_status_after,
            statusComment: session.status_comment,
            isActive: session.is_active,
        }));
    }
}
