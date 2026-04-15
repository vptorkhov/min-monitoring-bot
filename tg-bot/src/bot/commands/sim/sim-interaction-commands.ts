import TelegramBot from 'node-telegram-bot-api';
import { SessionRepository } from '../../../repositories/session.repository';
import { isUserInAdminMode } from '../../admin/admin-mode';
import { stateManager } from '../../state-manager';
import { AdminState } from '../../../constants/states.constant';
import {
    getActiveStatusText as getSimActiveStatusText,
    getSimConditionStatusText
} from '../../../utils/admin-status.utils';
import {
    escapeHtml,
    formatSimHistoryRows
} from '../../../utils/admin-format.utils';
import { AdminSessionData, SimInteractionSessionItem } from '../admin.types';

type TryResolveSelectedSimDevice = (
    telegramId: number,
    chatId: number
) => Promise<{
    tempData: AdminSessionData;
    device: SimInteractionSessionItem;
} | null>;

type SendSimActionsMessage = (
    chatId: number,
    device: SimInteractionSessionItem
) => Promise<void>;

/** Регистрирует interaction-команды SIM в admin-flow. */
export function registerSimInteractionCommands(
    bot: TelegramBot,
    sessionRepository: SessionRepository,
    tryResolveSelectedSimDevice: TryResolveSelectedSimDevice,
    sendSimActionsMessage: SendSimActionsMessage
): void {
    bot.onText(/^\/admin_sim_change_active(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора СИМ через /admin_sim_interactions.'
            );
            return;
        }

        const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
        if (!resolved) {
            return;
        }

        const hasActiveSession = await sessionRepository.hasActiveByDevice(
            resolved.device.id
        );
        if (hasActiveSession) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна: по этому СИМ есть активная сессия.'
            );
            return;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.SIM_INTERACTION_AWAITING_ACTIVE_STATUS
        );
        await bot.sendMessage(
            chatId,
            `СИМ: <b>${escapeHtml(resolved.device.deviceNumber)}</b>\nТекущий статус: <b>${getSimActiveStatusText(resolved.device.isActive)}</b>\n\nВыберите статус:\n1. Активный\n2. Отключен\n\n/cancel - вернуться к списку СИМ.`,
            { parse_mode: 'HTML' }
        );
    });

    bot.onText(/^\/admin_sim_change_status(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора СИМ через /admin_sim_interactions.'
            );
            return;
        }

        const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
        if (!resolved) {
            return;
        }

        const hasActiveSession = await sessionRepository.hasActiveByDevice(
            resolved.device.id
        );
        if (hasActiveSession) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна: по этому СИМ есть активная сессия.'
            );
            return;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.SIM_INTERACTION_AWAITING_CONDITION_STATUS
        );
        await bot.sendMessage(
            chatId,
            `СИМ: <b>${escapeHtml(resolved.device.deviceNumber)}</b>\nТекущий статус исправности: <b>${getSimConditionStatusText(resolved.device.status)}</b>\n\nВыберите статус:\n1. Исправен\n2. Поврежден\n3. Сломан\n\n/cancel - вернуться к списку СИМ.`,
            { parse_mode: 'HTML' }
        );
    });

    bot.onText(/^\/admin_sim_story(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора СИМ через /admin_sim_interactions.'
            );
            return;
        }

        const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
        if (!resolved) {
            return;
        }

        const history = await sessionRepository.getHistoryByDevice(
            resolved.device.id
        );
        stateManager.setUserState(
            telegramId,
            AdminState.SIM_INTERACTION_ACTION_SELECTING
        );

        if (!history.length) {
            await bot.sendMessage(
                chatId,
                `История сессий для СИМ <b>${escapeHtml(resolved.device.deviceNumber)}</b> пуста.`,
                { parse_mode: 'HTML' }
            );
            await sendSimActionsMessage(chatId, resolved.device);
            return;
        }

        await bot.sendMessage(
            chatId,
            `История сессий СИМ <b>${escapeHtml(resolved.device.deviceNumber)}</b>:\n\n${formatSimHistoryRows(history)}`,
            { parse_mode: 'HTML' }
        );
        await sendSimActionsMessage(chatId, resolved.device);
    });

    bot.onText(/^\/admin_sim_delete(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId) {
            return;
        }

        if (!isUserInAdminMode(telegramId)) {
            await bot.sendMessage(
                chatId,
                '❌ Команда недоступна без выбора СИМ через /admin_sim_interactions.'
            );
            return;
        }

        const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
        if (!resolved) {
            return;
        }

        stateManager.setUserState(
            telegramId,
            AdminState.SIM_INTERACTION_AWAITING_DELETE_CONFIRM
        );
        await bot.sendMessage(
            chatId,
            'Вы уверены, что хотите удалить СИМ? Введите ДА\n\n/cancel - вернуться к списку СИМ.'
        );
    });
}
