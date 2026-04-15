import {
    SessionHistoryByCourierRecord,
    SessionHistoryByDeviceRecord
} from '../repositories/session.repository';
import { getSimConditionStatusText } from './admin-status.utils';
import { formatMoscowDateTime, formatMoscowTime } from './moscow-time.utils';

type WarehouseSessionRow = {
    courierFullName: string;
    courierNickname: string | null;
    deviceLabel: string;
};

type WarehouseHistorySessionRow = {
    courierFullName: string;
    courierNickname: string | null;
    deviceLabel: string;
    startDate: Date;
    endDate: Date | null;
    simStatusAfter: string | null;
    statusComment: string | null;
};

/** Экранирует строку для безопасного вывода в Markdown. */
export function escapeMarkdown(text: string): string {
    return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/** Экранирует строку для безопасного вывода в HTML parse_mode. */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Форматирует отображение курьера для HTML сообщений. */
export function formatCourierDisplayHtml(
    fullName: string,
    nickname?: string | null
): string {
    const normalizedNickname = (nickname || '').trim();
    if (!normalizedNickname) {
        return `<b>${escapeHtml(fullName)}</b>`;
    }

    const withoutAt = normalizedNickname.startsWith('@')
        ? normalizedNickname.slice(1)
        : normalizedNickname;
    if (!withoutAt) {
        return `<b>${escapeHtml(fullName)}</b>`;
    }

    return `<b>${escapeHtml(fullName)}</b> @<b>${escapeHtml(withoutAt)}</b>`;
}

/** Форматирует строки истории сессий выбранного СИМ. */
export function formatSimHistoryRows(
    history: SessionHistoryByDeviceRecord[]
): string {
    return history
        .map((row, index) => {
            const start = formatMoscowTime(row.start_date);
            const end = formatMoscowTime(row.end_date);
            const simStatus = row.end_date
                ? getSimConditionStatusText(row.sim_status_after || '-')
                : '-';
            const comment = row.end_date
                ? escapeHtml((row.status_comment || '').trim() || '-')
                : '-';

            return [
                `${index + 1}. Начало: <b>${start}</b>`,
                `Окончание: <b>${end}</b>`,
                `Курьер: ${formatCourierDisplayHtml(row.courier_full_name, row.courier_nickname)}`,
                `Состояние СИМ после сессии: <b>${escapeHtml(simStatus)}</b>`,
                `Комментарий: <b>${comment}</b>`
            ].join('\n');
        })
        .join('\n\n');
}

/** Форматирует строки истории выдач/возвратов для выбранного курьера. */
export function formatCourierHistoryRows(
    history: SessionHistoryByCourierRecord[]
): string {
    return history
        .map((row, index) => {
            const start = formatMoscowDateTime(row.start_date);
            const end = row.end_date ? formatMoscowDateTime(row.end_date) : '-';
            const deviceNumber = escapeHtml(
                (row.device_number || '-').toUpperCase()
            );

            return `${index + 1}. <b>${deviceNumber}</b> начало:<b>${start}</b> конец:<b>${end}</b>`;
        })
        .join('\n');
}

/** Форматирует список активных сессий по складу для HTML сообщений. */
export function formatActiveSessionsByWarehouseRows(
    sessions: WarehouseSessionRow[]
): string {
    return sessions
        .map(
            (session, index) =>
                `${index + 1}. ${formatCourierDisplayHtml(session.courierFullName, session.courierNickname)} - <b>${escapeHtml(session.deviceLabel)}</b>`
        )
        .join('\n');
}

/** Форматирует историю сессий по складу для HTML сообщений. */
export function formatSessionsHistoryByWarehouseRows(
    sessions: WarehouseHistorySessionRow[]
): string {
    return sessions
        .map((session, index) => {
            const statusText = session.simStatusAfter
                ? getSimConditionStatusText(session.simStatusAfter)
                : '-';
            const commentText = (session.statusComment || '').trim() || '-';

            return [
                `${index + 1}. ${formatCourierDisplayHtml(session.courierFullName, session.courierNickname)}`,
                `СИМ: <b>${escapeHtml(session.deviceLabel)}</b>`,
                `Дата начала: <b>${formatMoscowDateTime(session.startDate)}</b>`,
                `Дата конца: <b>${formatMoscowDateTime(session.endDate)}</b>`,
                `Статус СИМ после сессии: <b>${escapeHtml(statusText)}</b>`,
                `Комментарий состояния: <b>${escapeHtml(commentText)}</b>`
            ].join('\n');
        })
        .join('\n\n');
}
