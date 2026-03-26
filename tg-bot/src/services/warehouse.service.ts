// src/services/warehouse.service.ts

import { Warehouse } from '../repositories/types/warehouse.type';
import { WarehouseRepository } from '../repositories/warehouse.repository';

export class WarehouseService {
    private warehouseRepository: WarehouseRepository;

    constructor(warehouseRepository: WarehouseRepository) {
        this.warehouseRepository = warehouseRepository;
    }

    // Получить все активные склады
    public async getActiveWarehouses(): Promise<Warehouse[]> {
        return await this.warehouseRepository.getActiveWarehouses();
    }

    // Получить все склады (включая отключенные)
    public async getAllWarehouses(): Promise<Warehouse[]> {
        return await this.warehouseRepository.getAllWarehouses();
    }

    // Получить склад по ID
    public async getWarehouseById(id: number): Promise<Warehouse | null> {
        return await this.warehouseRepository.getById(id);
    }

    // Проверить, что склад активен
    public async validateWarehouseIsActive(id: number): Promise<boolean> {
        const warehouse = await this.getWarehouseById(id);
        return warehouse !== null && warehouse.is_active;
    }

    // Создать новый склад
    public async createWarehouse(name: string, address: string): Promise<Warehouse> {
        return await this.warehouseRepository.createWarehouse(name, address);
    }

    // Обновить название склада
    public async updateWarehouseName(id: number, name: string): Promise<Warehouse | null> {
        return await this.warehouseRepository.updateWarehouseName(id, name);
    }

    // Обновить адрес склада
    public async updateWarehouseAddress(id: number, address: string): Promise<Warehouse | null> {
        return await this.warehouseRepository.updateWarehouseAddress(id, address);
    }

    // Обновить статус склада
    public async updateWarehouseStatus(id: number, isActive: boolean): Promise<Warehouse | null> {
        return await this.warehouseRepository.updateWarehouseStatus(id, isActive);
    }

    // Проверить наличие активных сессий по складу
    public async hasActiveSessionsByWarehouseId(id: number): Promise<boolean> {
        return await this.warehouseRepository.hasActiveSessionsByWarehouseId(id);
    }

    // Удалить склад (если отсутствуют связанные сессии)
    public async deleteWarehouse(id: number): Promise<{ success: boolean; reason?: string }> {
        try {
            const hasAnySessions = await this.warehouseRepository.hasAnySessionsByWarehouseId(id);
            if (hasAnySessions) {
                return {
                    success: false,
                    reason: 'Невозможно удалить склад, так как по нему есть история сессий.'
                };
            }

            const deleted = await this.warehouseRepository.deleteWarehouse(id);
            if (!deleted) {
                return {
                    success: false,
                    reason: 'Склад не найден, уже удален или связан с другими данными.'
                };
            }

            return { success: true };
        } catch {
            return {
                success: false,
                reason: 'Произошла ошибка при удалении склада. Попробуйте позже.'
            };
        }
    }
}