import { AdminState } from '../constants/states.constant';

/** Проверяет, что пользователь в pre-auth admin потоке логина/регистрации. */
export function isAdminAuthFlowState(currentState?: string): boolean {
    return currentState === AdminState.REGISTER_AWAITING_LOGIN
        || currentState === AdminState.REGISTER_AWAITING_PASSWORD
        || currentState === AdminState.LOGIN_AWAITING_LOGIN
        || currentState === AdminState.LOGIN_AWAITING_PASSWORD;
}

/** Проверяет, что admin находится в гостевом или базовом авторизованном состоянии. */
export function isAdminGuestOrAuthenticatedState(currentState?: string): boolean {
    return currentState === AdminState.GUEST_MODE
        || currentState === AdminState.AUTHENTICATED
        || currentState === AdminState.AUTHENTICATED_WITH_WAREHOUSE;
}

/** Проверяет состояние выбора склада для админа. */
export function isSetWarehouseFlowState(currentState?: string): boolean {
    return currentState === AdminState.SET_WAREHOUSE_SELECTING;
}

/** Проверяет состояние создания склада. */
export function isCreateWarehouseFlowState(currentState?: string): boolean {
    return currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME
        || currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS;
}

/** Проверяет состояние смены пароля админа. */
export function isChangePasswordFlowState(currentState?: string): boolean {
    return currentState === AdminState.CHANGE_PASSWORD_AWAITING_NEW;
}

/** Проверяет entry-state редактирования склада. */
export function isEditWarehouseEntryFlowState(currentState?: string): boolean {
    return currentState === AdminState.EDIT_WAREHOUSES_SELECTING
        || currentState === AdminState.EDIT_WAREHOUSE_ACTION_SELECTING;
}

/** Проверяет subflow-state редактирования склада. */
export function isEditWarehouseSubflowState(currentState?: string): boolean {
    return currentState === AdminState.EDIT_WAREHOUSE_AWAITING_NAME
        || currentState === AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS
        || currentState === AdminState.EDIT_WAREHOUSE_AWAITING_STATUS
        || currentState === AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM;
}

/** Проверяет entry-state редактирования администраторов. */
export function isEditAdminsEntryFlowState(currentState?: string): boolean {
    return currentState === AdminState.EDIT_ADMINS_SELECTING;
}

/** Проверяет state выбора действия над администратором. */
export function isEditAdminActionFlowState(currentState?: string): boolean {
    return currentState === AdminState.EDIT_ADMIN_ACTION_SELECTING;
}

/** Проверяет subflow-state операций над администратором. */
export function isEditAdminSubflowState(currentState?: string): boolean {
    return currentState === AdminState.EDIT_ADMIN_AWAITING_STATUS
        || currentState === AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM
        || currentState === AdminState.EDIT_ADMIN_AWAITING_PASSWORD;
}

/** Проверяет state выбора неактивных курьеров для аппрува. */
export function isApplyRegistrationsSelectingState(currentState?: string): boolean {
    return currentState === AdminState.APPLY_REGISTRATIONS_SELECTING;
}

/** Проверяет state подтверждения аппрува курьера. */
export function isApplyRegistrationConfirmState(currentState?: string): boolean {
    return currentState === AdminState.APPLY_REGISTRATION_AWAITING_CONFIRM;
}

/** Проверяет state добавления СИМ. */
export function isAddSimFlowState(currentState?: string): boolean {
    return currentState === AdminState.ADD_SIM_AWAITING_NUMBER;
}

/** Проверяет state ввода даты истории сессий по складу. */
export function isSessionsHistoryDateState(currentState?: string): boolean {
    return currentState === AdminState.ADMIN_SESSIONS_HISTORY_AWAITING_DATE;
}

/** Проверяет state выбора СИМ из списка. */
export function isSimInteractionsSelectingState(currentState?: string): boolean {
    return currentState === AdminState.SIM_INTERACTIONS_SELECTING;
}

/** Проверяет subflow-state операций по СИМ. */
export function isSimInteractionSubflowState(currentState?: string): boolean {
    return currentState === AdminState.SIM_INTERACTION_ACTION_SELECTING
        || currentState === AdminState.SIM_INTERACTION_AWAITING_ACTIVE_STATUS
        || currentState === AdminState.SIM_INTERACTION_AWAITING_CONDITION_STATUS
        || currentState === AdminState.SIM_INTERACTION_AWAITING_DELETE_CONFIRM;
}

/** Проверяет state выбора курьера для редактирования. */
export function isEditCouriersSelectingState(currentState?: string): boolean {
    return currentState === AdminState.ADMIN_EDIT_COURIERS_SELECTING
        || currentState === AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING;
}

/** Проверяет state выбора действия над курьером. */
export function isEditCourierActionSelectingState(currentState?: string): boolean {
    return currentState === AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING
        || currentState === AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING;
}

/** Проверяет, что state выбора действия курьера относится к superadmin. */
export function isSuperadminEditCourierActionSelectingState(currentState?: string): boolean {
    return currentState === AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING;
}

/** Проверяет subflow-state редактирования курьера. */
export function isEditCourierSubflowState(currentState?: string): boolean {
    return currentState === AdminState.ADMIN_EDIT_COURIER_AWAITING_STATUS
        || currentState === AdminState.ADMIN_EDIT_COURIER_AWAITING_NAME
        || currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS
        || currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_NAME
        || currentState === AdminState.ADMIN_COURIER_HISTORY_AWAITING_FULL
        || currentState === AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL;
}

/** Проверяет, что subflow-state курьера относится к superadmin. */
export function isSuperadminEditCourierSubflowState(currentState?: string): boolean {
    return currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS
        || currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_NAME
        || currentState === AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL;
}