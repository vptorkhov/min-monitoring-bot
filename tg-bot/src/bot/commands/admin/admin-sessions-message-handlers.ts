import TelegramBot from 'node-telegram-bot-api';
import { AdminService } from '../../../services/admin.service';
import { SessionService } from '../../../services/session.service';
import { parseMoscowDateRangeInput } from '../../../utils/moscow-time.utils';
import { formatSessionsHistoryByWarehouseRows } from '../../../utils/admin-format.utils';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import { AdminSessionData } from '../admin.types';

type SendAdminCommandsIfNeeded = (
    chatId: number,
    adminPermissionsLevel: number | undefined,
    state: string
) => Promise<void>;

export async function handleAdminSessionsHistoryMessage(
    bot: TelegramBot,
    adminService: AdminService,
    sessionService: SessionService,
    telegramId: number,
    chatId: number,
    text: string,
    currentState: string | undefined,
    sendAdminCommandsIfNeeded: SendAdminCommandsIfNeeded
): Promise<boolean> {
    if (currentState !== AdminState.ADMIN_SESSIONS_HISTORY_AWAITING_DATE) {
        return false;
    }

    const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const adminId = tempData.adminId;
    const adminPermissionsLevel = tempData.adminPermissionsLevel;

    if (!adminId || !adminPermissionsLevel) {
        stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
        stateManager.resetUserTempData(telegramId);
        await bot.sendMessage(
            chatId,
            '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
        );
        return true;
    }

    const resolvedWarehouseId = await adminService.getAdminWarehouseId(adminId);
    if (resolvedWarehouseId === undefined) {
        stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
        stateManager.resetUserTempData(telegramId);
        stateManager.setUserTempData(telegramId, {
            adminId,
            adminPermissionsLevel
        });
        await bot.sendMessage(
            chatId,
            '⚠️ Не удалось определить администратора. Выполните /admin_login повторно.'
        );
        return true;
    }

    if (resolvedWarehouseId === null) {
        const returnState =
            tempData.sessionsHistoryReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, returnState);
        stateManager.resetUserTempData(telegramId);
        stateManager.setUserTempData(telegramId, {
            adminId,
            adminPermissionsLevel
        });
        await bot.sendMessage(
            chatId,
            '❌ Команда доступна только если выбран склад. Используйте /admin_set_warehouse.'
        );
        return true;
    }

    const warehouseId = resolvedWarehouseId;

    const parsedDateRange = parseMoscowDateRangeInput(text.trim());
    if (!parsedDateRange) {
        await bot.sendMessage(
            chatId,
            '❌ Некорректная дата. Используйте формат ДД.ММ.ГГГГ (например, 24.03.2026).\n\nВведите дату в формате ДД.ММ.ГГГГ для просмотра истории сессий'
        );
        return true;
    }

    const history =
        await sessionService.getSessionsHistoryByWarehouseAndStartDateRange(
            warehouseId,
            parsedDateRange.startUtc,
            parsedDateRange.endUtc
        );

    const returnState =
        tempData.sessionsHistoryReturnState || AdminState.AUTHENTICATED;
    stateManager.setUserState(telegramId, returnState);
    stateManager.resetUserTempData(telegramId);
    stateManager.setUserTempData(telegramId, {
        adminId,
        adminPermissionsLevel
    });

    if (!history.length) {
        await bot.sendMessage(
            chatId,
            `ℹ️ За ${parsedDateRange.displayDate} по выбранному складу сессии не найдены.`
        );
        await sendAdminCommandsIfNeeded(
            chatId,
            adminPermissionsLevel,
            returnState
        );
        return true;
    }

    await bot.sendMessage(
        chatId,
        `История сессий выбранного склада за ${parsedDateRange.displayDate}:\n\n${formatSessionsHistoryByWarehouseRows(history)}`,
        { parse_mode: 'HTML' }
    );
    return true;
}
