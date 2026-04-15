import { Warehouse } from '../../repositories/types/warehouse.type';

export type AdminSessionData = {
    adminId?: number;
    adminPermissionsLevel?: number;
    createWarehouseName?: string;
    adminSetWarehouses?: Warehouse[];
    adminSetReturnState?: string;
    editWarehouses?: Warehouse[];
    selectedWarehouseId?: number;
    editAdmins?: EditableAdminSessionItem[];
    selectedEditAdminId?: number;
    editReturnState?: string;
    applyRegistrations?: PendingCourierApprovalSessionItem[];
    selectedApplyCourierId?: number;
    applyRegistrationsReturnState?: string;
    addSimWarehouseId?: number;
    sessionsHistoryReturnState?: string;
    sessionsHistoryWarehouseId?: number;
    simInteractionWarehouseId?: number;
    simInteractionDevices?: SimInteractionSessionItem[];
    selectedSimInteractionDeviceId?: number;
    editCouriers?: EditableCourierSessionItem[];
    selectedEditCourierId?: number;
    editCouriersReturnState?: string;
    editCouriersWarehouseId?: number;
};

export type EditableAdminSessionItem = {
    id: number;
    nickname: string;
    isActive: boolean;
};

export type SimInteractionSessionItem = {
    id: number;
    deviceNumber: string;
    isActive: boolean;
    status: string;
};

export type PendingCourierApprovalSessionItem = {
    id: number;
    fullName: string;
    nickname: string | null;
};

export type EditableCourierSessionItem = {
    id: number;
    fullName: string;
    nickname: string | null;
    phoneNumber: string;
    warehouseId: number | null;
    isActive: boolean;
};
