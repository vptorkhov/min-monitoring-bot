import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { WarehouseService } from '../../../services/warehouse.service';
import { registerWarehouseContextCommands } from './warehouse-context-commands';
import { registerWarehouseSuperadminCommands } from './warehouse-superadmin-commands';

/** Регистрирует все команды управления складами в admin-mode. */
export function registerWarehouseCommands(
    bot: TelegramBot,
    adminService: AdminService,
    warehouseService: WarehouseService
): void {
    registerWarehouseContextCommands(bot, adminService, warehouseService);
    registerWarehouseSuperadminCommands(bot, warehouseService);
}
