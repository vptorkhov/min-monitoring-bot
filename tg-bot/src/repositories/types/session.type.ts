export interface SessionRecord {
    id: number;
    courier_id: number;
    device_id: number;
    warehouse_id: number;
    start_date: Date;
    end_date: Date | null;
    sim_status_after: string | null;
    status_comment: string | null;
    is_active: boolean;
}

export interface ActiveSessionByDeviceRecord {
    id: number;
    courier_id: number;
    device_id: number;
    warehouse_id: number;
    start_date: Date;
    end_date: Date | null;
    sim_status_after: string | null;
    status_comment: string | null;
    is_active: boolean;
    courier_full_name: string;
}

export interface SessionHistoryByDeviceRecord {
    start_date: Date;
    end_date: Date | null;
    sim_status_after: string | null;
    status_comment: string | null;
    is_active: boolean;
    courier_full_name: string;
    courier_nickname: string | null;
}

export interface ActiveSessionByCourierWithDeviceRecord {
    id: number;
    courier_id: number;
    device_id: number;
    warehouse_id: number;
    start_date: Date;
    end_date: Date | null;
    sim_status_after: string | null;
    status_comment: string | null;
    is_active: boolean;
    device_number: string;
}

export interface ActiveSessionByWarehouseRecord {
    id: number;
    courier_id: number;
    device_id: number;
    warehouse_id: number;
    start_date: Date;
    end_date: Date | null;
    sim_status_after: string | null;
    status_comment: string | null;
    is_active: boolean;
    courier_full_name: string;
    courier_nickname: string | null;
    device_number: string | null;
    device_is_personal: boolean;
}

export interface SessionHistoryByWarehouseRecord {
    id: number;
    warehouse_id: number;
    start_date: Date;
    end_date: Date | null;
    sim_status_after: string | null;
    status_comment: string | null;
    is_active: boolean;
    courier_full_name: string;
    courier_nickname: string | null;
    device_number: string | null;
    device_is_personal: boolean;
}

export interface SessionHistoryByCourierRecord {
    start_date: Date;
    end_date: Date | null;
    device_number: string;
}
