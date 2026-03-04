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

    // Регистрируем только существующие команды
    registerStartCommand(bot, courierService, registrationHandler);
    // Регистрируем команду /cancel
    registerCancelCommand(bot, registrationHandler);
    // Создаём репозиторий и сервис складов
    const warehouseRepository = new WarehouseRepository();
    const warehouseService = new WarehouseService(warehouseRepository);

    // Сессия и устройства
    const sessionService = new SessionService(courierService);
    const deviceRepository = new MobilityDeviceRepository();

    // Регистрируем команду /set_warehouse
    registerSetWarehouseCommand(bot, courierService, warehouseService);
    // Регистрируем команду /clear_warehouse
    registerClearWarehouseCommand(bot, courierService);

    // Регистрируем команды для работы с СИМ
    registerTakeSimCommand(bot, courierService, sessionService, deviceRepository);
    registerReturnSimCommand(bot, courierService, sessionService);

    // Устанавливаем список команд для отображения в меню Telegram
    // Включаем только реально существующие команды
    bot.setMyCommands([
        { command: 'start', description: '🚀 Начать работу с ботом' },
        { command: 'set_warehouse', description: '🏭 Выбрать склад' },
        { command: 'clear_warehouse', description: '🚫 Отвязаться от склада' },
        { command: 'take_sim', description: '🛴 Взять СИМ' },
        { command: 'return_sim', description: '🔄 Сдать СИМ' },
        { command: 'cancel', description: '❌ Отменить текущее действие' }
        // TODO: добавить /help когда будет реализован
    ]).then(() => {
        console.log('✅ Меню команд обновлено');
    }).catch((error) => {
        console.error('❌ Ошибка при обновлении меню команд:', error);
    });

    console.log('✅ Команды бота зарегистрированы');

    // Возвращаем список зарегистрированных команд
    return BOT_COMMANDS;
}