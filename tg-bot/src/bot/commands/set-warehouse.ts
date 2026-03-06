import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { WarehouseService } from '../../services/warehouse.service';
import { SessionService } from '../../services/session.service';
import { stateManager } from '../state-manager';
import { WarehouseState } from '../../constants/states.constant';
import { Warehouse } from '../../repositories/types/warehouse.type';
import { isCommand } from '../../constants/commands.constant';
import {
    KEYBOARD_BUTTON_TEXT,
    getWarehouseNumberSelectionKeyboard
} from '../keyboards/registration.keyboard';

/**
 * Команда /set_warehouse
 * Курьер выбирает склад по порядковому номеру
 */
export function registerSetWarehouseCommand(
    bot: TelegramBot,
    courierService: CourierService,
    warehouseService: WarehouseService
) {
    const WAREHOUSE_CALLBACK_PREFIX = 'warehouse_select_';
    const HIDE_REPLY_KEYBOARD: TelegramBot.ReplyKeyboardRemove = {
        remove_keyboard: true
    };

    const getWarehouseInlineKeyboard = (warehouseCount: number): TelegramBot.InlineKeyboardMarkup => {
        const buttons = Array.from({ length: warehouseCount }, (_, index) => ({
            text: String(index + 1),
            callback_data: `${WAREHOUSE_CALLBACK_PREFIX}${index + 1}`
        }));

        const chunkSize = 5;
        const rows: TelegramBot.InlineKeyboardButton[][] = [];
        for (let i = 0; i < buttons.length; i += chunkSize) {
            rows.push(buttons.slice(i, i + chunkSize));
        }

        return { inline_keyboard: rows };
    };

    const tryAssignWarehouseByNumber = async (
        chatId: number,
        telegramId: number,
        warehouseNumberText: string
    ): Promise<boolean> => {
        if (!/^\d+$/.test(warehouseNumberText)) {
            return false;
        }

        const index = parseInt(warehouseNumberText, 10) - 1;

        // Перед применением снова проверим, не появилась ли активная сессия.
        const sessionService = new SessionService();
        const hasSession = await sessionService.hasActiveSession(telegramId);
        if (hasSession) {
            await bot.sendMessage(chatId, '❌ У вас есть активная сессия. Сначала сдайте СИМ.', {
                reply_markup: HIDE_REPLY_KEYBOARD
            });
            stateManager.clearUser(telegramId);
            return true;
        }

        const tempData = stateManager.getUserTempData<{ warehouses: Warehouse[] }>(telegramId);
        const warehouses = tempData?.warehouses;

        if (!warehouses) {
            await bot.sendMessage(chatId, '❌ Произошла ошибка, попробуйте заново командой /set_warehouse.', {
                reply_markup: HIDE_REPLY_KEYBOARD
            });
            stateManager.clearUser(telegramId);
            return true;
        }

        if (index < 0 || index >= warehouses.length) {
            await bot.sendMessage(chatId, '❌ Номер вне диапазона, попробуйте снова.');
            return true;
        }

        const selectedWarehouse = warehouses[index];

        // Присоединяем курьера к выбранному складу.
        const result = await courierService.assignWarehouse(telegramId, selectedWarehouse.id, warehouseService);
        if (!result.success) {
            await bot.sendMessage(chatId, `❌ Не удалось прикрепиться к складу: ${result.message}`, {
                reply_markup: HIDE_REPLY_KEYBOARD
            });
        } else {
            await bot.sendMessage(chatId, `✅ Вы успешно прикрепились к складу: ${selectedWarehouse.name}`, {
                reply_markup: HIDE_REPLY_KEYBOARD
            });
        }

        // Очищаем состояние и данные пользователя.
        stateManager.clearUser(telegramId);
        return true;
    };

    const startWarehouseSelection = async (chatId: number, telegramId: number) => {
        // Входим в процесс выбора склада заново, если пользователь уже был в нём.
        stateManager.clearUser(telegramId);

        // Проверка курьера
        const check = await courierService.checkCourierExists(telegramId);
        if (!check.exists) {
            await bot.sendMessage(chatId, '❌ Вы не зарегистрированы. Используйте /start для регистрации.');
            return;
        }
        if (!check.isActive) {
            await bot.sendMessage(chatId, '❌ Ваша регистрация еще не подтверждена администратором.');
            return;
        }

        // запрет на смену, если есть активная сессия
        const sessionService = new SessionService();
        const hasSession = await sessionService.hasActiveSession(telegramId);
        if (hasSession) {
            await bot.sendMessage(chatId, '❌ У вас есть активная сессия. Сначала сдайте СИМ.');
            return;
        }

        // Получаем список активных складов
        const warehouses: Warehouse[] = await warehouseService.getActiveWarehouses();
        if (!warehouses.length) {
            await bot.sendMessage(chatId, '❌ Нет доступных складов для выбора.');
            return;
        }

        // Формируем нумерованный список складов
        const warehouseList = warehouses
            .map((w, index) => `${index + 1}. ${w.name}, ${w.address}`)
            .join('\n');

        await bot.sendMessage(chatId, `Введите порядковый номер склада для прикрепления:\n\n${warehouseList}`, {
            reply_markup: getWarehouseInlineKeyboard(warehouses.length)
        });

        await bot.sendMessage(chatId, 'Выберите номер кнопкой ниже или введите вручную:', {
            reply_markup: getWarehouseNumberSelectionKeyboard(warehouses.length)
        });

        // Сохраняем состояние и список складов пользователя
        stateManager.setUserState(telegramId, WarehouseState.SELECTING_WAREHOUSE);
        stateManager.setUserTempData(telegramId, { warehouses });
    };

    // Шаг 1: обработка команды /set_warehouse
    bot.onText(/\/set_warehouse/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        await startWarehouseSelection(chatId, telegramId);
    });

    // Запуск того же потока при нажатии inline-кнопки "🏠Выбрать склад"
    bot.on('callback_query', async (query) => {
        const callbackData = query.data;
        if (!callbackData) {
            return;
        }

        const chatId = query.message?.chat.id;
        const telegramId = query.from.id;

        await bot.answerCallbackQuery(query.id);

        if (!chatId) {
            return;
        }

        if (callbackData === 'set_warehouse') {
            await startWarehouseSelection(chatId, telegramId);
            return;
        }

        if (callbackData.startsWith(WAREHOUSE_CALLBACK_PREFIX)) {
            const selectedNumber = callbackData.replace(WAREHOUSE_CALLBACK_PREFIX, '');
            const state = stateManager.getUserState(telegramId);
            if (state !== WarehouseState.SELECTING_WAREHOUSE) {
                await bot.sendMessage(chatId, 'ℹ️ Сначала запустите выбор склада командой /set_warehouse.');
                return;
            }

            await tryAssignWarehouseByNumber(chatId, telegramId, selectedNumber);
            return;
        }

        return;
    });

    // Шаг 2: обработка текстового ввода пользователя при выборе склада
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        const text = msg.text?.trim();

        // Перехват reply-кнопки "🏠Выбрать склад" как эквивалента /set_warehouse
        if (text === KEYBOARD_BUTTON_TEXT.SELECT_WAREHOUSE) {
            await startWarehouseSelection(chatId, telegramId);
            return;
        }

        const state = stateManager.getUserState(telegramId);
        if (state !== WarehouseState.SELECTING_WAREHOUSE) return;

        if (text === KEYBOARD_BUTTON_TEXT.CANCEL) {
            stateManager.clearUser(telegramId);
            await bot.sendMessage(chatId, '❌ Действие отменено.', {
                reply_markup: HIDE_REPLY_KEYBOARD
            });
            return;
        }

        if (!text || isCommand(text)) {
            return; // любое сообщение, которое является командой, игнорируем здесь
        }

        const wasHandled = await tryAssignWarehouseByNumber(chatId, telegramId, text);
        if (!wasHandled) {
            await bot.sendMessage(chatId, '❌ Пожалуйста, введите корректный номер склада из списка выше.');
        }
    });
}