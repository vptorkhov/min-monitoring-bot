import { Warehouse } from '../repositories/types/warehouse.type';
import { escapeHtml } from './admin-format.utils';

type EditableAdminLike = {
    nickname: string;
};

type PendingCourierApprovalLike = {
    fullName: string;
    nickname: string | null;
};

type EditableCourierLike = {
    fullName: string;
};

type SimInteractionLike = {
    deviceNumber: string;
};

/** Форматирует plain-текст список администраторов для выбора. */
export function formatEditableAdminsPlainList(
    admins: EditableAdminLike[]
): string {
    return admins
        .map((admin, index) => `${index + 1}. ${admin.nickname}`)
        .join('\n');
}

/** Форматирует список складов для выбора администратором. */
export function formatWarehouseListForAdminSelection(
    warehouses: Warehouse[]
): string {
    return warehouses
        .map(
            (warehouse, index) =>
                `${index + 1}. <b>${escapeHtml(warehouse.name)}</b> ` +
                `<b>${escapeHtml(warehouse.address || '-')}</b>`
        )
        .join('\n');
}

/** Форматирует список администраторов для выбора. */
export function formatEditableAdminsList(admins: EditableAdminLike[]): string {
    return admins
        .map(
            (admin, index) =>
                `${index + 1}. <b>${escapeHtml(admin.nickname)}</b>`
        )
        .join('\n');
}

/** Форматирует список ожидающих одобрения курьеров. */
export function formatPendingCourierApprovalsList(
    couriers: PendingCourierApprovalLike[]
): string {
    return couriers
        .map((courier, index) => {
            const base = `${index + 1}. <b>${escapeHtml(courier.fullName)}</b>`;
            if (!courier.nickname) {
                return base;
            }

            return `${base} <b>${escapeHtml(courier.nickname)}</b>`;
        })
        .join('\n');
}

/** Форматирует plain-текст список ожидающих одобрения курьеров. */
export function formatPendingCourierApprovalsPlainList(
    couriers: PendingCourierApprovalLike[]
): string {
    return couriers
        .map((courier, index) => {
            const base = `${index + 1}. ${courier.fullName}`;
            return courier.nickname ? `${base} ${courier.nickname}` : base;
        })
        .join('\n');
}

/** Форматирует список курьеров для выбора. */
export function formatEditableCouriersList(
    couriers: EditableCourierLike[]
): string {
    return couriers
        .map(
            (courier, index) =>
                `${index + 1}. <b>${escapeHtml(courier.fullName)}</b>`
        )
        .join('\n');
}

/** Форматирует plain-текст список курьеров для выбора. */
export function formatEditableCouriersPlainList(
    couriers: EditableCourierLike[]
): string {
    return couriers
        .map((courier, index) => `${index + 1}. ${courier.fullName}`)
        .join('\n');
}

/** Форматирует список СИМ для выбора. */
export function formatSimSelectionList(devices: SimInteractionLike[]): string {
    return devices
        .map(
            (device, index) =>
                `${index + 1}. <b>${escapeHtml(device.deviceNumber)}</b>`
        )
        .join('\n');
}

/** Форматирует plain-текст список СИМ для выбора. */
export function formatSimSelectionPlainList(
    devices: SimInteractionLike[]
): string {
    return devices
        .map((device, index) => `${index + 1}. ${device.deviceNumber}`)
        .join('\n');
}
