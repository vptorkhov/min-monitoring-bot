import { AdminState } from '../../constants/states.constant';

export function getAdminCommandListMessage(
    adminPermissionsLevel: number,
    isWarehouseSelected: boolean
): string {
    if (adminPermissionsLevel >= 2 && isWarehouseSelected) {
        return [
            'Список команд:',
            '/admin_change_password - Сменить пароль',
            '/admin_add_sim - Добавить транспорт',
            '/admin_sim_interactions - Управление транспортом',
            '/admin_edit_couriers - Управление курьерами',
            '/admin_active_sessions - Показать активные сессии',
            '/admin_sessions_history - Показать историю сессий',
            '/admin_set_warehouse - Выбрать склад',
            '/admin_clear_warehouse - Отвязаться от склада',
            '/superadmin_create_warehouse - Создать склад',
            '/superadmin_edit_warehouses - Управление складами',
            '/superadmin_edit_admins - Управление админами',
            '/superadmin_edit_couriers - Управление ВСЕМИ курьерами',
            '/admin_apply_registrations - Принять регистрации курьеров',
            '/admin_logout - Выйти из учетной записи администратора',
            '/exit_admin - Выйти из админского режима'
        ].join('\n');
    }

    if (adminPermissionsLevel >= 2) {
        return [
            'Список команд:',
            '/admin_change_password - Сменить пароль',
            '/admin_set_warehouse - Выбрать склад',
            '/admin_apply_registrations - Принять регистрации курьеров',
            '/superadmin_create_warehouse - Создать склад',
            '/superadmin_edit_warehouses - Управление складами',
            '/superadmin_edit_admins - Управление админами',
            '/superadmin_edit_couriers - Управление ВСЕМИ курьерами',
            '/admin_logout - Выйти из учетной записи администратора',
            '/exit_admin - Выйти из админского режима'
        ].join('\n');
    }

    if (isWarehouseSelected) {
        return [
            'Список команд:',
            '/admin_change_password - Сменить пароль',
            '/admin_add_sim - Добавить транспорт',
            '/admin_sim_interactions - Управление транспортом',
            '/admin_edit_couriers - Управление курьерами',
            '/admin_active_sessions - Показать активные сессии',
            '/admin_sessions_history - Показать историю сессий',
            '/admin_set_warehouse - Выбрать склад',
            '/admin_clear_warehouse - Отвязаться от склада',
            '/admin_apply_registrations - Принять регистрации курьеров',
            '/admin_logout - Выйти из учетной записи администратора',
            '/exit_admin - Выйти из админского режима'
        ].join('\n');
    }

    return [
        'Список команд:',
        '/admin_change_password - Сменить пароль',
        '/admin_set_warehouse - Выбрать склад',
        '/admin_apply_registrations - Принять регистрации курьеров',
        '/admin_logout - Выйти из учетной записи администратора',
        '/exit_admin - Выйти из админского режима'
    ].join('\n');
}

export function isAuthenticatedAdminState(state: string | undefined): boolean {
    return (
        state === AdminState.AUTHENTICATED ||
        state === AdminState.AUTHENTICATED_WITH_WAREHOUSE
    );
}
