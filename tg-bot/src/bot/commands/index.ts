// src/bot/commands/index.ts

import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { RegistrationHandler } from '../handlers/registration.handler';
import { registerStartCommand } from './start';
import { BOT_COMMANDS } from '../../constants/commands.constant';
import { registerSetWarehouseCommand } from './set-warehouse';
import { registerClearWarehouseCommand } from './clear-warehouse';
import { WarehouseService } from '../../services/warehouse.service';
import { WarehouseRepository } from '../../repositories/warehouse.repository';
import { registerCancelCommand } from './cancel';
import { SessionService } from '../../services/session.service';
import { MobilityDeviceRepository } from '../../repositories/mobility-device.repository';
import { registerTakeSimCommand } from './take-sim';
import { registerReturnSimCommand } from './return-sim';
import { createCallbackRouter } from '../callback-router';

/**
 * Регистрация всех команд бота
 * @param bot - экземпляр Telegram бота
 * @param courierService - сервис курьеров
 * @param registrationHandler - обработчик регистрации
 */
export function registerAllCommands(
    bot: TelegramBot,
    courierService: CourierService,
    registrationHandler: RegistrationHandler
) {
    console.log('📝 Регистрация команд бота...');

    // Сессия и устройства
    const sessionService = new SessionService(courierService);
    const deviceRepository = new MobilityDeviceRepository();
    const callbackRouter = createCallbackRouter(bot);

    // Регистрируем только существующие команды
    registerStartCommand(bot, courierService, registrationHandler, sessionService);
    // Регистрируем команду /cancel
    registerCancelCommand(bot, registrationHandler, courierService, sessionService);
    // Создаём репозиторий и сервис складов
    const warehouseRepository = new WarehouseRepository();
    const warehouseService = new WarehouseService(warehouseRepository);

    // Регистрируем команду /set_warehouse
    registerSetWarehouseCommand(bot, courierService, warehouseService, callbackRouter.registerHandler);
    // Регистрируем команду /clear_warehouse
    registerClearWarehouseCommand(bot, courierService, callbackRouter.registerHandler);

    // Регистрируем команды для работы с СИМ
    registerTakeSimCommand(bot, courierService, sessionService, deviceRepository, callbackRouter.registerHandler);
    registerReturnSimCommand(bot, courierService, sessionService, callbackRouter.registerHandler);

    console.log('✅ Команды бота зарегистрированы');

    // Возвращаем список зарегистрированных команд
    return BOT_COMMANDS;
}