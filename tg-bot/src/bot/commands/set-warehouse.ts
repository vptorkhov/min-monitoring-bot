import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { WarehouseService } from '../../services/warehouse.service';
import { SessionService } from '../../services/session.service';
import { CallbackQueryHandler } from '../callback-router';
import { stateManager } from '../state-manager';
import { WarehouseState } from '../../constants/states.constant';
import { Warehouse } from '../../repositories/types/warehouse.type';
import { isCommand } from '../../constants/commands.constant';
import {
    INLINE_CALLBACK_DATA,
    KEYBOARD_BUTTON_TEXT,
    getCourierMainInlineKeyboard,
    getWarehouseNumberSelectionInlineKeyboard,
    getWarehouseNumberSelectionKeyboard
} from '../keyboards';
import { convertKeyboardButtonToCommand } from '../../utils/telegram.utils';
import { sendCourierMainKeyboard } from '../keyboards/courier-main-keyboard';
import { blockIfAdminGuestCommandNotAllowed } from '../admin/admin-mode';

/**
 * Команда /set_warehouse
 * Курьер выбирает склад по порядковому номеру
 */
export function registerSetWarehouseCommand(
    bot: TelegramBot,
    courierService: CourierService,
    warehouseService: WarehouseService,
    registerCallbackHandler: (handler: CallbackQueryHandler) => void
) {
    const sessionService = new SessionService(courierService);
    const HIDE_REPLY_KEYBOARD: TelegramBot.ReplyKeyboardRemove = {
        remove_keyboard: true
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
                reply_markup: getCourierMainInlineKeyboard()
            });

            await sendCourierMainKeyboard(bot, chatId, telegramId, courierService, sessionService);
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
            reply_markup: getWarehouseNumberSelectionInlineKeyboard(warehouses.length)
        });

        await bot.sendMessage(chatId, 'Выберите номер кнопкой ниже или введите вручную:', {
            reply_markup: getWarehouseNumberSelectionKeyboard(warehouses.length)
        });

        // Сохраняем состояние и список складов пользователя
        stateManager.setUserState(telegramId, WarehouseState.SELECTING_WAREHOUSE);
        stateManager.setUserTempData(telegramId, { warehouses });
    };

    // Шаг 1: обработка команды /set_warehouse
    bot.onText(/^\/set_warehouse(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        if (await blockIfAdminGuestCommandNotAllowed(bot, chatId, telegramId, msg.text)) {
            return;
        }

        await startWarehouseSelection(chatId, telegramId);
    });

    // Запуск того же потока при нажатии inline-кнопок
    registerCallbackHandler(async (query) => {
        const callbackData = query.data;
        if (!callbackData) {
            return false;
        }

        const chatId = query.message?.chat.id;
        const telegramId = query.from.id;

        if (!chatId) {
            return false;
        }

        if (callbackData === INLINE_CALLBACK_DATA.SET_WAREHOUSE) {
            if (await blockIfAdminGuestCommandNotAllowed(bot, chatId, telegramId, '/set_warehouse')) {
                return true;
            }

            await startWarehouseSelection(chatId, telegramId);
            return true;
        }

        if (callbackData.startsWith(INLINE_CALLBACK_DATA.WAREHOUSE_SELECT_PREFIX)) {
            const selectedNumber = callbackData.replace(INLINE_CALLBACK_DATA.WAREHOUSE_SELECT_PREFIX, '');
            const state = stateManager.getUserState(telegramId);
            if (state !== WarehouseState.SELECTING_WAREHOUSE) {
                await bot.sendMessage(chatId, 'ℹ️ Сначала запустите выбор склада командой /set_warehouse.');
                return true;
            }

            await tryAssignWarehouseByNumber(chatId, telegramId, selectedNumber);
            return true;
        }

        return false;
    });

    // Шаг 2: обработка текстового ввода пользователя при выборе склада
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        const text = msg.text?.trim();
        const textAsCommand = text ? convertKeyboardButtonToCommand(text) : '';

        // Перехват reply-кнопки выбора склада как эквивалента /set_warehouse.
        // Поддерживаем оба текста: новый и исторический без пробела.
        if (textAsCommand === '/set_warehouse' && text !== '/set_warehouse') {
            if (await blockIfAdminGuestCommandNotAllowed(bot, chatId, telegramId, text)) {
                return;
            }

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
            await sendCourierMainKeyboard(bot, chatId, telegramId, courierService, sessionService);
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