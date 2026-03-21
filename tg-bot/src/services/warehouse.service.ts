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
}