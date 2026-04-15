import TelegramBot from 'node-telegram-bot-api';
import { stateManager } from '../../state-manager';
import { AdminSessionData, PendingCourierApprovalSessionItem } from '../admin.types';

type LoadPendingCourierApprovals = () => Promise<
    PendingCourierApprovalSessionItem[]
>;

/** Возвращает выбранного курьера для сценария одобрения регистрации. */
export async function tryResolveSelectedApplyCourier(
    bot: TelegramBot,
    telegramId: number,
    chatId: number,
    loadPendingCourierApprovals: LoadPendingCourierApprovals
): Promise<{
    tempData: AdminSessionData;
    courier: PendingCourierApprovalSessionItem;
} | null> {
    const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const selectedApplyCourierId = tempData.selectedApplyCourierId;

    if (!selectedApplyCourierId) {
        await bot.sendMessage(
            chatId,
            '❌ Команда недоступна без выбора курьера через /admin_apply_registrations.'
        );
        return null;
    }

    const candidates = await loadPendingCourierApprovals();
    const courier = candidates.find((item) => item.id === selectedApplyCourierId);

    if (!courier) {
        await bot.sendMessage(
            chatId,
            '❌ Выбранный курьер больше недоступен. Запустите /admin_apply_registrations заново.'
        );
        return null;
    }

    return { tempData, courier };
}
