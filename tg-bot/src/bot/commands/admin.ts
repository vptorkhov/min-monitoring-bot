import TelegramBot from "node-telegram-bot-api";
import { RegistrationHandler } from "../handlers/registration.handler";
import { CourierService } from "../../services/courier.service";
import { SessionService } from "../../services/session.service";
import { AdminService } from "../../services/admin.service";
import { WarehouseService } from "../../services/warehouse.service";
import { WarehouseRepository } from "../../repositories/warehouse.repository";
import { MobilityDeviceRepository } from "../../repositories/mobility-device.repository";
import {
  SessionHistoryByDeviceRecord,
  SessionHistoryByCourierRecord,
  SessionRepository,
} from "../../repositories/session.repository";
import { CourierRepository } from "../../repositories/courier.repository";
import {
  enterAdminMode,
  exitAdminMode,
  isUserInAdminMode,
} from "../admin/admin-mode";
import {
  getAdminCommandListMessage,
  isAuthenticatedAdminState,
} from "../admin/admin-command-hints";
import { sendCourierMainKeyboard } from "../keyboards/courier-main-keyboard";
import { stateManager } from "../state-manager";
import { isCommand } from "../../constants/commands.constant";
import { AdminState } from "../../constants/states.constant";
import { Warehouse } from "../../repositories/types/warehouse.type";
import { validateSimNumber } from "../../validators/sim-number.validator";
import { getDatabase } from "../../config/database";

const HIDE_REPLY_KEYBOARD: TelegramBot.ReplyKeyboardRemove = {
  remove_keyboard: true,
};

type AdminSessionData = {
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

type EditableAdminSessionItem = {
  id: number;
  nickname: string;
  isActive: boolean;
};

type SimInteractionSessionItem = {
  id: number;
  deviceNumber: string;
  isActive: boolean;
  status: string;
};

type PendingCourierApprovalSessionItem = {
  id: number;
  fullName: string;
  nickname: string | null;
};

type EditableCourierSessionItem = {
  id: number;
  fullName: string;
  nickname: string | null;
  phoneNumber: string;
  warehouseId: number | null;
  isActive: boolean;
};

function escapeMarkdown(text: string): string {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getWarehouseStatusText(isActive: boolean): string {
  return isActive ? "Активный" : "Отключен";
}

function parseWarehouseStatusInput(input: string): boolean | null {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");

  if (
    normalized === "1" ||
    normalized === "1." ||
    normalized === "активный" ||
    normalized === "1 активный" ||
    normalized === "1. активный"
  ) {
    return true;
  }

  if (
    normalized === "2" ||
    normalized === "2." ||
    normalized === "отключен" ||
    normalized === "2 отключен" ||
    normalized === "2. отключен"
  ) {
    return false;
  }

  return null;
}

function getAdminStatusText(isActive: boolean): string {
  return isActive ? "Активный" : "Отключен";
}

function parseAdminStatusInput(input: string): boolean | null {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");

  if (
    normalized === "1" ||
    normalized === "1." ||
    normalized === "активный" ||
    normalized === "1 активный" ||
    normalized === "1. активный"
  ) {
    return true;
  }

  if (
    normalized === "2" ||
    normalized === "2." ||
    normalized === "отключен" ||
    normalized === "2 отключен" ||
    normalized === "2. отключен"
  ) {
    return false;
  }

  return null;
}

function getAuthenticatedAdminWelcomeMessage(
  adminPermissionsLevel: number,
  isWarehouseSelected: boolean,
): string {
  return getAdminCommandListMessage(adminPermissionsLevel, isWarehouseSelected);
}

function getSimActiveStatusText(isActive: boolean): string {
  return isActive ? "Активный" : "Отключен";
}

function getSimConditionStatusText(status: string): string {
  if (status === "ok") {
    return "Исправен";
  }

  if (status === "warning") {
    return "Поврежден";
  }

  if (status === "broken") {
    return "Сломан";
  }

  return status;
}

function parseSimActiveStatusInput(input: string): boolean | null {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");

  if (
    normalized === "1" ||
    normalized === "1." ||
    normalized === "активный" ||
    normalized === "1 активный" ||
    normalized === "1. активный"
  ) {
    return true;
  }

  if (
    normalized === "2" ||
    normalized === "2." ||
    normalized === "отключен" ||
    normalized === "2 отключен" ||
    normalized === "2. отключен"
  ) {
    return false;
  }

  return null;
}

function parseSimConditionStatusInput(input: string): "ok" | "warning" | "broken" | null {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");

  if (
    normalized === "1" ||
    normalized === "1." ||
    normalized === "исправен" ||
    normalized === "1 исправен" ||
    normalized === "1. исправен"
  ) {
    return "ok";
  }

  if (
    normalized === "2" ||
    normalized === "2." ||
    normalized === "поврежден" ||
    normalized === "2 поврежден" ||
    normalized === "2. поврежден"
  ) {
    return "warning";
  }

  if (
    normalized === "3" ||
    normalized === "3." ||
    normalized === "сломан" ||
    normalized === "3 сломан" ||
    normalized === "3. сломан"
  ) {
    return "broken";
  }

  return null;
}

function formatMoscowTime(date: Date | null): string {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

function formatMoscowDateTime(date: Date | null): string {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

function parseMoscowDateRangeInput(
  input: string,
): { displayDate: string; startUtc: Date; endUtc: Date } | null {
  const match = input.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  const checkDate = new Date(Date.UTC(year, month - 1, day));
  if (
    checkDate.getUTCFullYear() !== year ||
    checkDate.getUTCMonth() !== month - 1 ||
    checkDate.getUTCDate() !== day
  ) {
    return null;
  }

  // Пользователь вводит московскую дату; переводим границы дня в UTC.
  const moscowOffsetMs = 3 * 60 * 60 * 1000;
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - moscowOffsetMs;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;

  return {
    displayDate: `${match[1]}.${match[2]}.${match[3]}`,
    startUtc: new Date(startUtcMs),
    endUtc: new Date(endUtcMs),
  };
}

function formatSimHistoryRows(history: SessionHistoryByDeviceRecord[]): string {
  return history
    .map((row, index) => {
      const start = formatMoscowTime(row.start_date);
      const end = formatMoscowTime(row.end_date);
      const simStatus = row.end_date
        ? getSimConditionStatusText(row.sim_status_after || "-")
        : "-";
      const comment = row.end_date
        ? escapeHtml((row.status_comment || "").trim() || "-")
        : "-";

      return [
        `${index + 1}. Начало: <b>${start}</b>`,
        `Окончание: <b>${end}</b>`,
        `Курьер: <b>${escapeHtml(row.courier_full_name)}</b>`,
        `Состояние СИМ после сессии: <b>${escapeHtml(simStatus)}</b>`,
        `Комментарий: <b>${comment}</b>`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatCourierHistoryRows(history: SessionHistoryByCourierRecord[]): string {
  return history
    .map((row, index) => {
      const start = formatMoscowDateTime(row.start_date);
      const end = row.end_date ? formatMoscowDateTime(row.end_date) : "-";
      const deviceNumber = escapeHtml((row.device_number || "-").toUpperCase());

      return `${index + 1}. <b>${deviceNumber}</b> начало:<b>${start}</b> конец:<b>${end}</b>`;
    })
    .join("\n");
}

function formatActiveSessionsByWarehouseRows(
  sessions: { courierFullName: string; deviceLabel: string }[],
): string {
  return sessions
    .map(
      (session, index) =>
        `${index + 1}. <b>${escapeHtml(session.courierFullName)}</b> - <b>${escapeHtml(session.deviceLabel)}</b>`,
    )
    .join("\n");
}

function formatSessionsHistoryByWarehouseRows(
  sessions: {
    courierFullName: string;
    deviceLabel: string;
    startDate: Date;
    endDate: Date | null;
    simStatusAfter: string | null;
    statusComment: string | null;
  }[],
): string {
  return sessions
    .map((session, index) => {
      const statusText = session.simStatusAfter
        ? getSimConditionStatusText(session.simStatusAfter)
        : "-";
      const commentText = (session.statusComment || "").trim() || "-";

      return [
        `${index + 1}. <b>${escapeHtml(session.courierFullName)}</b>`,
        `СИМ: <b>${escapeHtml(session.deviceLabel)}</b>`,
        `Дата начала: <b>${formatMoscowDateTime(session.startDate)}</b>`,
        `Дата конца: <b>${formatMoscowDateTime(session.endDate)}</b>`,
        `Статус СИМ после сессии: <b>${escapeHtml(statusText)}</b>`,
        `Комментарий состояния: <b>${escapeHtml(commentText)}</b>`,
      ].join("\n");
    })
    .join("\n\n");
}

async function restoreCourierFlowAfterExitAdmin(
  bot: TelegramBot,
  chatId: number,
  telegramId: number,
  courierService: CourierService,
  registrationHandler: RegistrationHandler,
  sessionService: SessionService,
): Promise<void> {
  const check = await courierService.checkCourierExists(telegramId);

  if (!check.exists) {
    await registrationHandler.startRegistration(chatId, telegramId);
    return;
  }

  if (!check.isActive) {
    await bot.sendMessage(
      chatId,
      "⏳ Ваш курьерский аккаунт ещё не активирован администратором. Доступные команды: /start и /admin.",
    );
    return;
  }

  await sendCourierMainKeyboard(
    bot,
    chatId,
    telegramId,
    courierService,
    sessionService,
  );
}

export function registerAdminModeCommands(
  bot: TelegramBot,
  courierService: CourierService,
  registrationHandler: RegistrationHandler,
  sessionService: SessionService,
) {
  const adminService = new AdminService();
  const warehouseService = new WarehouseService(new WarehouseRepository());
  const mobilityDeviceRepository = new MobilityDeviceRepository();
  const sessionRepository = new SessionRepository();
  const courierRepository = new CourierRepository(getDatabase());

  const isInAuthenticatedOrSubflow = (currentState?: string) => {
    return (
      currentState === AdminState.AUTHENTICATED ||
      currentState === AdminState.AUTHENTICATED_WITH_WAREHOUSE ||
      currentState === AdminState.CHANGE_PASSWORD_AWAITING_NEW ||
      currentState === AdminState.SET_WAREHOUSE_SELECTING ||
      currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME ||
      currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS ||
      currentState === AdminState.EDIT_WAREHOUSES_SELECTING ||
      currentState === AdminState.EDIT_WAREHOUSE_ACTION_SELECTING ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_NAME ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_STATUS ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM ||
      currentState === AdminState.EDIT_ADMINS_SELECTING ||
      currentState === AdminState.EDIT_ADMIN_ACTION_SELECTING ||
      currentState === AdminState.EDIT_ADMIN_AWAITING_STATUS ||
      currentState === AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM ||
      currentState === AdminState.EDIT_ADMIN_AWAITING_PASSWORD ||
      currentState === AdminState.APPLY_REGISTRATIONS_SELECTING ||
      currentState === AdminState.APPLY_REGISTRATION_AWAITING_CONFIRM ||
      currentState === AdminState.ADMIN_SESSIONS_HISTORY_AWAITING_DATE ||
      currentState === AdminState.ADD_SIM_AWAITING_NUMBER ||
      currentState === AdminState.SIM_INTERACTIONS_SELECTING ||
      currentState === AdminState.SIM_INTERACTION_ACTION_SELECTING ||
      currentState === AdminState.SIM_INTERACTION_AWAITING_ACTIVE_STATUS ||
      currentState === AdminState.SIM_INTERACTION_AWAITING_CONDITION_STATUS ||
      currentState === AdminState.SIM_INTERACTION_AWAITING_DELETE_CONFIRM ||
      currentState === AdminState.ADMIN_EDIT_COURIERS_SELECTING ||
      currentState === AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING ||
      currentState === AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING ||
      currentState === AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING ||
      currentState === AdminState.ADMIN_EDIT_COURIER_AWAITING_STATUS ||
      currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS ||
      currentState === AdminState.ADMIN_COURIER_HISTORY_AWAITING_FULL ||
      currentState === AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL
    );
  };

  const restoreToAuthenticatedWithAdminContext = (
    telegramId: number,
    tempData: AdminSessionData,
    targetState?: string,
  ): string => {
    const resolvedState =
      targetState || tempData.editReturnState || AdminState.AUTHENTICATED;

    stateManager.setUserState(
      telegramId,
      resolvedState,
    );
    stateManager.resetUserTempData(telegramId);

    if (tempData.adminId && tempData.adminPermissionsLevel) {
      stateManager.setUserTempData(telegramId, {
        adminId: tempData.adminId,
        adminPermissionsLevel: tempData.adminPermissionsLevel,
      });
    }

    return resolvedState;
  };

  const sendAdminCommandsIfNeeded = async (
    chatId: number,
    adminPermissionsLevel: number | undefined,
    state: string,
  ) => {
    if (!adminPermissionsLevel || !isAuthenticatedAdminState(state)) {
      return;
    }

    await bot.sendMessage(
      chatId,
      getAdminCommandListMessage(
        adminPermissionsLevel,
        state === AdminState.AUTHENTICATED_WITH_WAREHOUSE,
      ),
    );
  };

  const sendWarehouseActionsMessage = async (
    chatId: number,
    warehouse: Warehouse,
  ) => {
    const safeName = escapeHtml(warehouse.name);
    const safeAddress = escapeHtml(warehouse.address || "-");
    const status = getWarehouseStatusText(warehouse.is_active);
    const commandsList = [
      "/superadmin_edit_warehouse_name",
      "/superadmin_edit_warehouse_address",
      "/superadmin_edit_warehouse_status",
      "/superadmin_edit_warehouse_delete",
    ].join("\n");

    await bot.sendMessage(
      chatId,
      `Выбран склад:\n<b>${safeName}</b> - <b>${safeAddress}</b>\nСтатус: <b>${status}</b>\n\nДоступные действия:\n${commandsList}`,
      { parse_mode: "HTML" },
    );
  };

  const formatWarehouseListForAdminSelection = (warehouses: Warehouse[]): string => {
    return warehouses
      .map(
        (warehouse, index) =>
          `${index + 1}. <b>${escapeHtml(warehouse.name)}</b> <b>${escapeHtml(warehouse.address || "-")}</b>`,
      )
      .join("\n");
  };

  const formatEditableAdminsList = (admins: EditableAdminSessionItem[]): string => {
    return admins
      .map((admin, index) => `${index + 1}. <b>${escapeHtml(admin.nickname)}</b>`)
      .join("\n");
  };

  const sendEditableAdminsListMessage = async (
    chatId: number,
    admins: EditableAdminSessionItem[],
  ) => {
    const listText = formatEditableAdminsList(admins);
    await bot.sendMessage(
      chatId,
      `Введите номер администратора:\n\n${listText}`,
      { parse_mode: "HTML" },
    );
  };

  const loadPendingCourierApprovals = async (): Promise<
    PendingCourierApprovalSessionItem[]
  > => {
    const couriers = await courierService.getPendingApprovalCouriers();

    return couriers.map((courier) => ({
      id: courier.id,
      fullName: courier.full_name,
      nickname: courier.nickname,
    }));
  };

  const formatPendingCourierApprovalsList = (
    couriers: PendingCourierApprovalSessionItem[],
  ): string => {
    return couriers
      .map((courier, index) => {
        const base = `${index + 1}. <b>${escapeHtml(courier.fullName)}</b>`;
        if (!courier.nickname) {
          return base;
        }

        return `${base} <b>${escapeHtml(courier.nickname)}</b>`;
      })
      .join("\n");
  };

  const sendPendingCourierApprovalsListMessage = async (
    chatId: number,
    couriers: PendingCourierApprovalSessionItem[],
  ) => {
    const listText = formatPendingCourierApprovalsList(couriers);

    await bot.sendMessage(chatId, `Выберите номер курьера:\n\n${listText}`, {
      parse_mode: "HTML",
    });
  };

  const sendAdminActionsMessage = async (
    chatId: number,
    admin: EditableAdminSessionItem,
  ) => {
    const commandsList = [
      "/superadmin_edit_admin_status",
      "/superadmin_edit_admin_delete",
      "/superadmin_edit_admin_password",
    ].join("\n");

    await bot.sendMessage(
      chatId,
      `Выбран администратор:\n<b>${escapeHtml(admin.nickname)}</b>\nСтатус: <b>${getAdminStatusText(admin.isActive)}</b>\n\nДоступные действия:\n${commandsList}`,
      { parse_mode: "HTML" },
    );
  };

  const loadEditableCouriersByWarehouse = async (
    warehouseId: number,
  ): Promise<EditableCourierSessionItem[]> => {
    const couriers = await courierRepository.findEditableByWarehouseId(warehouseId);

    return couriers.map((courier) => ({
      id: courier.id,
      fullName: courier.full_name,
      nickname: courier.nickname,
      phoneNumber: courier.phone_number,
      warehouseId: courier.warehouse_id,
      isActive: courier.is_active,
    }));
  };

  const loadAllEditableCouriers = async (): Promise<EditableCourierSessionItem[]> => {
    const couriers = await courierRepository.findAllEditable();

    return couriers.map((courier) => ({
      id: courier.id,
      fullName: courier.full_name,
      nickname: courier.nickname,
      phoneNumber: courier.phone_number,
      warehouseId: courier.warehouse_id,
      isActive: courier.is_active,
    }));
  };

  const formatEditableCouriersList = (
    couriers: EditableCourierSessionItem[],
  ): string => {
    return couriers
      .map((courier, index) => `${index + 1}. <b>${escapeHtml(courier.fullName)}</b>`)
      .join("\n");
  };

  const sendEditableCouriersListMessage = async (
    chatId: number,
    couriers: EditableCourierSessionItem[],
  ) => {
    await bot.sendMessage(
      chatId,
      `Введите номер курьера:\n\n${formatEditableCouriersList(couriers)}`,
      { parse_mode: "HTML" },
    );
  };

  const resolveWarehouseName = async (warehouseId: number | null): Promise<string> => {
    if (!warehouseId) {
      return "Не выбран";
    }

    const warehouse = await warehouseService.getWarehouseById(warehouseId);
    if (!warehouse) {
      return `ID ${warehouseId}`;
    }

    return warehouse.name;
  };

  const tryResolveSelectedEditCourier = async (
    telegramId: number,
    chatId: number,
    commandHint: string,
  ): Promise<{ tempData: AdminSessionData; courier: EditableCourierSessionItem } | null> => {
    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    let selectedEditCourierId = tempData.selectedEditCourierId;

    // Defensive recovery: if a subcommand arrives very quickly and only one courier is in context,
    // auto-select it to keep the flow stable.
    if (!selectedEditCourierId && (tempData.editCouriers?.length || 0) === 1) {
      selectedEditCourierId = tempData.editCouriers?.[0]?.id;
      if (selectedEditCourierId) {
        stateManager.setUserTempData(telegramId, {
          selectedEditCourierId,
        });
      }
    }

    if (!selectedEditCourierId) {
      await bot.sendMessage(
        chatId,
        `❌ Команда недоступна без выбора курьера через ${commandHint}.`,
      );
      return null;
    }

    const courierRow = await courierRepository.findById(selectedEditCourierId);
    if (!courierRow) {
      await bot.sendMessage(
        chatId,
        `❌ Курьер не найден. Запустите ${commandHint} заново.`,
      );
      return null;
    }

    const selectedWarehouseId = tempData.editCouriersWarehouseId;
    if (selectedWarehouseId && courierRow.warehouse_id !== selectedWarehouseId) {
      await bot.sendMessage(
        chatId,
        `❌ Выбранный курьер не относится к текущему складу. Запустите ${commandHint} заново.`,
      );
      return null;
    }

    return {
      tempData,
      courier: {
        id: courierRow.id,
        fullName: courierRow.full_name,
        nickname: courierRow.nickname,
        phoneNumber: courierRow.phone_number,
        warehouseId: courierRow.warehouse_id,
        isActive: courierRow.is_active,
      },
    };
  };

  const sendCourierActionsMessage = async (
    chatId: number,
    courier: EditableCourierSessionItem,
    isSuperadmin: boolean,
  ) => {
    const statusCmd = isSuperadmin
      ? "/superadmin_edit_courier_status"
      : "/admin_edit_courier_status";
    const historyCmd = isSuperadmin
      ? "/superadmin_courier_history"
      : "/admin_courier_history";
    const warehouseName = await resolveWarehouseName(courier.warehouseId);
    const activeSession = await sessionRepository.findActiveByCourierWithDevice(courier.id);

    const activeSessionText = activeSession
      ? `Да, СИМ: <b>${escapeHtml((activeSession.device_number || "-").toUpperCase())}</b>, начало: <b>${formatMoscowTime(activeSession.start_date)}</b>`
      : "Нет";
    const nicknameText = courier.nickname ? escapeHtml(courier.nickname) : "-";

    await bot.sendMessage(
      chatId,
      [
        `Курьер: <b>${escapeHtml(courier.fullName)}</b>`,
        `Телефон: <b>${escapeHtml(courier.phoneNumber)}</b>`,
        `Никнейм: <b>${nicknameText}</b>`,
        `Статус: <b>${getAdminStatusText(courier.isActive)}</b>`,
        `Склад: <b>${escapeHtml(warehouseName)}</b>`,
        `Активная сессия: ${activeSessionText}`,
        "",
        "Доступные команды:",
        statusCmd,
        historyCmd,
        "",
        "/cancel - вернуться к списку курьеров.",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
  };

  const loadWarehouseSimDevices = async (
    warehouseId: number,
  ): Promise<SimInteractionSessionItem[]> => {
    const devices =
      await mobilityDeviceRepository.getDevicesForWarehouseWithoutPersonal(
        warehouseId,
      );

    return devices
      .filter((device) => !!device.device_number)
      .map((device) => ({
        id: device.id,
        deviceNumber: (device.device_number || "").toUpperCase(),
        isActive: device.is_active,
        status: device.status,
      }));
  };

  const formatSimSelectionList = (devices: SimInteractionSessionItem[]): string => {
    return devices
      .map(
        (device, index) => `${index + 1}. <b>${escapeHtml(device.deviceNumber)}</b>`,
      )
      .join("\n");
  };

  const sendSimSelectionMessage = async (
    chatId: number,
    devices: SimInteractionSessionItem[],
  ) => {
    await bot.sendMessage(
      chatId,
      `Введите номер СИМ:\n\n${formatSimSelectionList(devices)}\n\n/cancel - вернуться в состояние выбранного склада.`,
      { parse_mode: "HTML" },
    );
  };

  const tryResolveSelectedSimDevice = async (
    telegramId: number,
    chatId: number,
  ): Promise<{ tempData: AdminSessionData; device: SimInteractionSessionItem } | null> => {
    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const selectedSimInteractionDeviceId = tempData.selectedSimInteractionDeviceId;

    if (!selectedSimInteractionDeviceId) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора СИМ через /admin_sim_interactions.",
      );
      return null;
    }

    const device = await mobilityDeviceRepository.findById(
      selectedSimInteractionDeviceId,
    );
    if (!device || device.is_personal || !device.device_number) {
      await bot.sendMessage(
        chatId,
        "❌ Выбранный СИМ не найден. Запустите /admin_sim_interactions заново.",
      );
      return null;
    }

    const warehouseId = tempData.simInteractionWarehouseId;
    if (!warehouseId || device.warehouse_id !== warehouseId) {
      await bot.sendMessage(
        chatId,
        "❌ Выбранный СИМ не относится к текущему складу. Запустите /admin_sim_interactions заново.",
      );
      return null;
    }

    return {
      tempData,
      device: {
        id: device.id,
        deviceNumber: device.device_number.toUpperCase(),
        isActive: device.is_active,
        status: device.status,
      },
    };
  };

  const sendSimActionsMessage = async (
    chatId: number,
    device: SimInteractionSessionItem,
  ) => {
    const activeSession = await sessionRepository.findActiveByDevice(device.id);
    const malfunctionComment =
      device.status === "warning" || device.status === "broken"
        ? await sessionRepository.getLastMalfunctionCommentByDevice(device.id)
        : null;

    const activeSessionText = activeSession
      ? `Да, <b>${escapeHtml(activeSession.courier_full_name)}</b>`
      : "Нет";
    const malfunctionText = malfunctionComment
      ? `<b>${escapeHtml(malfunctionComment)}</b>`
      : "-";
    const commandsList = [
      "/admin_sim_change_active",
      "/admin_sim_change_status",
      "/admin_sim_story",
      "/admin_sim_delete",
    ].join("\n");

    await bot.sendMessage(
      chatId,
      [
        `Выбран СИМ: <b>${escapeHtml(device.deviceNumber)}</b>`,
        `Статус активности: <b>${getSimActiveStatusText(device.isActive)}</b>`,
        `Статус исправности: <b>${getSimConditionStatusText(device.status)}</b>`,
        `Последнее сообщение о неисправности: ${malfunctionText}`,
        `Активная сессия: ${activeSessionText}`,
        "",
        "Доступные команды:",
        commandsList,
        "",
        "/cancel - вернуться к списку СИМ.",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
  };

  const tryResolveSelectedAdmin = async (
    telegramId: number,
    chatId: number,
  ): Promise<{ tempData: AdminSessionData; admin: EditableAdminSessionItem } | null> => {
    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const selectedEditAdminId = tempData.selectedEditAdminId;

    if (!selectedEditAdminId) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора администратора через /superadmin_edit_admins.",
      );
      return null;
    }

    const admin = await adminService.getAdminById(selectedEditAdminId);
    if (!admin || admin.permissionsLevel >= 2) {
      await bot.sendMessage(
        chatId,
        "❌ Выбранный администратор не найден. Запустите /superadmin_edit_admins заново.",
      );
      return null;
    }

    return {
      tempData,
      admin: {
        id: admin.id,
        nickname: admin.nickname,
        isActive: admin.isActive,
      },
    };
  };

  const loadEditableAdmins = async (): Promise<EditableAdminSessionItem[]> => {
    const admins = await adminService.getEditableAdmins();

    return admins
      .filter((admin) => admin.permissionsLevel < 2)
      .map((admin) => ({
        id: admin.id,
        nickname: admin.nickname,
        isActive: admin.isActive,
      }));
  };

  const tryResolveSelectedApplyCourier = async (
    telegramId: number,
    chatId: number,
  ): Promise<
    { tempData: AdminSessionData; courier: PendingCourierApprovalSessionItem } | null
  > => {
    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const selectedApplyCourierId = tempData.selectedApplyCourierId;

    if (!selectedApplyCourierId) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора курьера через /admin_apply_registrations.",
      );
      return null;
    }

    const candidates = await loadPendingCourierApprovals();
    const courier = candidates.find((item) => item.id === selectedApplyCourierId);

    if (!courier) {
      await bot.sendMessage(
        chatId,
        "❌ Выбранный курьер больше недоступен. Запустите /admin_apply_registrations заново.",
      );
      return null;
    }

    return { tempData, courier };
  };

  const tryResolveSelectedWarehouse = async (
    telegramId: number,
    chatId: number,
  ): Promise<{ tempData: AdminSessionData; warehouse: Warehouse } | null> => {
    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const selectedWarehouseId = tempData.selectedWarehouseId;

    if (!selectedWarehouseId) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
      );
      return null;
    }

    const warehouse =
      await warehouseService.getWarehouseById(selectedWarehouseId);
    if (!warehouse) {
      await bot.sendMessage(
        chatId,
        "❌ Выбранный склад не найден. Запустите /superadmin_edit_warehouses заново.",
      );
      return null;
    }

    return { tempData, warehouse };
  };

  const startAdminRegistrationFlow = async (
    chatId: number,
    telegramId: number,
  ) => {
    stateManager.setUserState(telegramId, AdminState.REGISTER_AWAITING_LOGIN);
    stateManager.resetUserTempData(telegramId);

    await bot.sendMessage(chatId, "Придумайте и введите логин");
  };

  const startAdminLoginFlow = async (chatId: number, telegramId: number) => {
    stateManager.setUserState(telegramId, AdminState.LOGIN_AWAITING_LOGIN);
    stateManager.resetUserTempData(telegramId);

    await bot.sendMessage(chatId, "Введите логин");
  };

  bot.onText(/^\/admin(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    const wasInAdminMode = isUserInAdminMode(telegramId);
    enterAdminMode(telegramId);

    await bot.sendMessage(
      chatId,
      wasInAdminMode
        ? "🛡 Вы уже в админском режиме. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin."
        : "🛡 Включен админский режим. Текущий курьерский сценарий остановлен. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.",
      { reply_markup: HIDE_REPLY_KEYBOARD },
    );
  });

  bot.onText(/^\/admin_logout(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    const tempData = stateManager.getUserTempData<{ adminId?: number }>(
      telegramId,
    );
    const adminId = tempData?.adminId;
    const wasAuthenticated =
      currentState === AdminState.AUTHENTICATED ||
      currentState === AdminState.AUTHENTICATED_WITH_WAREHOUSE ||
      currentState === AdminState.CHANGE_PASSWORD_AWAITING_NEW ||
      currentState === AdminState.SET_WAREHOUSE_SELECTING ||
      currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME ||
      currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS ||
      currentState === AdminState.EDIT_WAREHOUSES_SELECTING ||
      currentState === AdminState.EDIT_WAREHOUSE_ACTION_SELECTING ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_NAME ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_STATUS ||
      currentState === AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM ||
      currentState === AdminState.EDIT_ADMINS_SELECTING ||
      currentState === AdminState.EDIT_ADMIN_ACTION_SELECTING ||
      currentState === AdminState.EDIT_ADMIN_AWAITING_STATUS ||
      currentState === AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM ||
      currentState === AdminState.EDIT_ADMIN_AWAITING_PASSWORD ||
      currentState === AdminState.APPLY_REGISTRATIONS_SELECTING ||
      currentState === AdminState.APPLY_REGISTRATION_AWAITING_CONFIRM ||
      currentState === AdminState.ADMIN_SESSIONS_HISTORY_AWAITING_DATE ||
      currentState === AdminState.ADD_SIM_AWAITING_NUMBER ||
      currentState === AdminState.SIM_INTERACTIONS_SELECTING ||
      currentState === AdminState.SIM_INTERACTION_ACTION_SELECTING ||
      currentState === AdminState.SIM_INTERACTION_AWAITING_ACTIVE_STATUS ||
      currentState === AdminState.SIM_INTERACTION_AWAITING_CONDITION_STATUS ||
      currentState === AdminState.SIM_INTERACTION_AWAITING_DELETE_CONFIRM ||
      currentState === AdminState.ADMIN_EDIT_COURIERS_SELECTING ||
      currentState === AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING ||
      currentState === AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING ||
      currentState === AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING ||
      currentState === AdminState.ADMIN_EDIT_COURIER_AWAITING_STATUS ||
      currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS ||
      currentState === AdminState.ADMIN_COURIER_HISTORY_AWAITING_FULL ||
      currentState === AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL;

    if (wasAuthenticated && adminId) {
      await adminService.setLoginStatus(adminId, false);
    }

    stateManager.setUserState(telegramId, AdminState.GUEST_MODE);
    stateManager.resetUserTempData(telegramId);

    await bot.sendMessage(
      chatId,
      wasAuthenticated
        ? "✅ Вы вышли из авторизованного админ-режима и возвращены в предадминское состояние. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin."
        : "ℹ️ Вы уже находитесь в предадминском состоянии. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.",
    );
  });

  bot.onText(/^\/exit_admin(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(chatId, "ℹ️ Админский режим уже выключен.");
      return;
    }

    exitAdminMode(telegramId);
    await bot.sendMessage(
      chatId,
      "✅ Админский режим выключен. Возвращаем вас в курьерский режим...",
    );

    await restoreCourierFlowAfterExitAdmin(
      bot,
      chatId,
      telegramId,
      courierService,
      registrationHandler,
      sessionService,
    );
  });

  bot.onText(/^\/admin_login(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    await startAdminLoginFlow(chatId, telegramId);
  });

  bot.onText(/^\/admin_register(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    await startAdminRegistrationFlow(chatId, telegramId);
  });

  bot.onText(/^\/admin_change_password(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId);
    if (!tempData?.adminId) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.CHANGE_PASSWORD_AWAITING_NEW);
    await bot.sendMessage(chatId, "Введите новый пароль, не менее 6 символов");
  });

  bot.onText(/^\/admin_set_warehouse(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if (!tempData.adminId || !tempData.adminPermissionsLevel) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    const warehouses = await warehouseService.getActiveWarehouses();
    if (!warehouses.length) {
      await bot.sendMessage(chatId, "❌ Список активных складов пуст.");
      await sendAdminCommandsIfNeeded(
        chatId,
        tempData.adminPermissionsLevel,
        currentState || AdminState.AUTHENTICATED,
      );
      return;
    }

    const returnState =
      currentState === AdminState.SET_WAREHOUSE_SELECTING
        ? (tempData.adminSetReturnState || AdminState.AUTHENTICATED)
        : (currentState || AdminState.AUTHENTICATED);

    stateManager.setUserState(telegramId, AdminState.SET_WAREHOUSE_SELECTING);
    stateManager.setUserTempData(telegramId, {
      adminSetWarehouses: warehouses,
      adminSetReturnState: returnState,
    });

    await bot.sendMessage(
      chatId,
      `Выберите номер склада:\n\n${formatWarehouseListForAdminSelection(warehouses)}`,
      { parse_mode: "HTML" },
    );
  });

  bot.onText(/^\/admin_clear_warehouse(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if (!tempData.adminId || !tempData.adminPermissionsLevel) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    const currentWarehouseId = await adminService.getAdminWarehouseId(tempData.adminId);
    if (currentWarehouseId === undefined) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    if (currentWarehouseId === null) {
      await bot.sendMessage(
        chatId,
        "❌ Команда доступна только если склад уже выбран. Используйте /admin_set_warehouse.",
      );
      return;
    }

    const clearResult = await adminService.clearAdminWarehouse(tempData.adminId);
    if (!clearResult.success) {
      await bot.sendMessage(
        chatId,
        `❌ ${clearResult.reason || "Не удалось отвязаться от склада."}`,
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
    stateManager.resetUserTempData(telegramId);
    stateManager.setUserTempData(telegramId, {
      adminId: tempData.adminId,
      adminPermissionsLevel: tempData.adminPermissionsLevel,
    });

    await bot.sendMessage(chatId, "✅ Вы успешно отвязались от склада.");
    await bot.sendMessage(
      chatId,
      getAuthenticatedAdminWelcomeMessage(tempData.adminPermissionsLevel, false),
    );
  });

  bot.onText(/^\/superadmin_create_warehouse(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      return;
    }

    const currentState = stateManager.getUserState(telegramId);

    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<{
      adminPermissionsLevel?: number;
    }>(telegramId);
    const permissionsLevel = tempData?.adminPermissionsLevel ?? 0;

    if (permissionsLevel < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.CREATE_WAREHOUSE_AWAITING_NAME,
    );
    await bot.sendMessage(chatId, "Введите название склада");
  });

  bot.onText(/^\/superadmin_edit_warehouses(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const permissionsLevel = tempData.adminPermissionsLevel ?? 0;

    if (permissionsLevel < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const warehouses = await warehouseService.getAllWarehouses();
    if (!warehouses.length) {
      await bot.sendMessage(chatId, "❌ Список складов пуст.");
      await sendAdminCommandsIfNeeded(
        chatId,
        tempData.adminPermissionsLevel,
        currentState || AdminState.AUTHENTICATED,
      );
      return;
    }

    const listText = warehouses
      .map(
        (w, index) =>
          `${index + 1}. <b>${escapeHtml(w.name)}</b> - <b>${escapeHtml(w.address || "-")}</b>`,
      )
      .join("\n");

    stateManager.setUserState(telegramId, AdminState.EDIT_WAREHOUSES_SELECTING);
    stateManager.setUserTempData(telegramId, {
      editWarehouses: warehouses,
      selectedWarehouseId: undefined,
      editReturnState: currentState || AdminState.AUTHENTICATED,
    });

    await bot.sendMessage(
      chatId,
      `Введите номер склада, который хотите изменить:\n\n${listText}`,
      { parse_mode: "HTML" },
    );
  });

  bot.onText(/^\/superadmin_edit_admins(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const permissionsLevel = tempData.adminPermissionsLevel ?? 0;
    if (permissionsLevel < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const editableAdmins = await loadEditableAdmins();
    if (!editableAdmins.length) {
      await bot.sendMessage(chatId, "❌ Список администраторов пуст.");
      await sendAdminCommandsIfNeeded(
        chatId,
        tempData.adminPermissionsLevel,
        currentState || AdminState.AUTHENTICATED,
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.EDIT_ADMINS_SELECTING);
    stateManager.setUserTempData(telegramId, {
      editAdmins: editableAdmins,
      selectedEditAdminId: undefined,
      editReturnState: currentState || AdminState.AUTHENTICATED,
    });

    await sendEditableAdminsListMessage(chatId, editableAdmins);
  });

  bot.onText(/^\/superadmin_edit_admin_status(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора администратора через /superadmin_edit_admins.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(telegramId, AdminState.EDIT_ADMIN_AWAITING_STATUS);
    await bot.sendMessage(
      chatId,
      `Текущий статус администратора: ${getAdminStatusText(resolved.admin.isActive)}\n\nВыберите, какой статус должен быть у администратора:\n1. Активный\n2. Отключен`,
    );
  });

  bot.onText(/^\/superadmin_edit_admin_delete(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора администратора через /superadmin_edit_admins.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM,
    );
    await bot.sendMessage(
      chatId,
      "Вы уверены, что хотите удалить админа? Введите ДА",
    );
  });

  bot.onText(/^\/superadmin_edit_admin_password(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора администратора через /superadmin_edit_admins.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.EDIT_ADMIN_AWAITING_PASSWORD,
    );
    await bot.sendMessage(chatId, "Введите новый пароль, не менее 6 символов");
  });

  bot.onText(/^\/superadmin_edit_warehouse_name(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedWarehouse(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.EDIT_WAREHOUSE_AWAITING_NAME,
    );
    await bot.sendMessage(chatId, "Введите новое название склада");
  });

  bot.onText(/^\/superadmin_edit_warehouse_address(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedWarehouse(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS,
    );
    await bot.sendMessage(chatId, "Введите новый адрес склада");
  });

  bot.onText(/^\/superadmin_edit_warehouse_status(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedWarehouse(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.EDIT_WAREHOUSE_AWAITING_STATUS,
    );
    await bot.sendMessage(
      chatId,
      `Текущий статус склада: ${getWarehouseStatusText(resolved.warehouse.is_active)}\n\nВыберите, какой статус должен быть у склада:\n1. Активный\n2. Отключен`,
    );
  });

  bot.onText(/^\/superadmin_edit_warehouse_delete(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedWarehouse(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM,
    );
    await bot.sendMessage(
      chatId,
      "Вы уверены, что хотите удалить склад? Введите ДА",
    );
  });

  bot.onText(/^\/admin_apply_registrations(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if (!tempData.adminId || !tempData.adminPermissionsLevel) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    if (tempData.adminPermissionsLevel < 1) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const pendingCouriers = await loadPendingCourierApprovals();
    if (!pendingCouriers.length) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Нет неактивных курьеров без записей о сессиях.",
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.APPLY_REGISTRATIONS_SELECTING);
    stateManager.setUserTempData(telegramId, {
      applyRegistrations: pendingCouriers,
      selectedApplyCourierId: undefined,
      applyRegistrationsReturnState: currentState || AdminState.AUTHENTICATED,
    });

    await sendPendingCourierApprovalsListMessage(chatId, pendingCouriers);
  });

  bot.onText(/^\/admin_add_sim(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if (!tempData.adminId || !tempData.adminPermissionsLevel) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    const warehouseId = await adminService.getAdminWarehouseId(tempData.adminId);
    if (warehouseId === undefined) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    if (warehouseId === null) {
      await bot.sendMessage(
        chatId,
        "❌ Команда доступна только если выбран склад. Используйте /admin_set_warehouse.",
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.ADD_SIM_AWAITING_NUMBER);
    stateManager.setUserTempData(telegramId, {
      addSimWarehouseId: warehouseId,
    });

    await bot.sendMessage(chatId, "Введите номер СИМ");
  });

  bot.onText(/^\/admin_active_sessions(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if (!tempData.adminId || !tempData.adminPermissionsLevel) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    const warehouseId = await adminService.getAdminWarehouseId(tempData.adminId);
    if (warehouseId === undefined) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    if (warehouseId === null) {
      await bot.sendMessage(
        chatId,
        "❌ Команда доступна только если выбран склад. Используйте /admin_set_warehouse.",
      );
      return;
    }

    const activeSessions = await sessionService.getActiveSessionsByWarehouse(
      warehouseId,
    );

    if (!activeSessions.length) {
      await bot.sendMessage(
        chatId,
        "ℹ️ На выбранном складе сейчас нет активных сессий.",
      );
      if (currentState) {
        stateManager.setUserState(telegramId, currentState);
        await sendAdminCommandsIfNeeded(
          chatId,
          tempData.adminPermissionsLevel,
          currentState,
        );
      }
      return;
    }

    await bot.sendMessage(
      chatId,
      `Активные сессии выбранного склада:\n\n${formatActiveSessionsByWarehouseRows(activeSessions)}`,
      { parse_mode: "HTML" },
    );

    if (currentState) {
      stateManager.setUserState(telegramId, currentState);
      await sendAdminCommandsIfNeeded(
        chatId,
        tempData.adminPermissionsLevel,
        currentState,
      );
    }
  });

  bot.onText(/^\/admin_sessions_history(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if (!tempData.adminId || !tempData.adminPermissionsLevel) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    const warehouseId = await adminService.getAdminWarehouseId(tempData.adminId);
    if (warehouseId === undefined) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    if (warehouseId === null) {
      await bot.sendMessage(
        chatId,
        "❌ Команда доступна только если выбран склад. Используйте /admin_set_warehouse.",
      );
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.ADMIN_SESSIONS_HISTORY_AWAITING_DATE,
    );
    stateManager.setUserTempData(telegramId, {
      sessionsHistoryReturnState: currentState || AdminState.AUTHENTICATED,
      sessionsHistoryWarehouseId: warehouseId,
    });

    await bot.sendMessage(
      chatId,
      "Введите дату в формате ДД.ММ.ГГГГ для просмотра истории сессий",
    );
  });

  bot.onText(/^\/admin_sim_interactions(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData =
      stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if (!tempData.adminId || !tempData.adminPermissionsLevel) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    const warehouseId = await adminService.getAdminWarehouseId(tempData.adminId);
    if (warehouseId === undefined) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    if (warehouseId === null) {
      await bot.sendMessage(
        chatId,
        "❌ Команда доступна только если выбран склад. Используйте /admin_set_warehouse.",
      );
      return;
    }

    const devices = await loadWarehouseSimDevices(warehouseId);
    if (!devices.length) {
      stateManager.setUserState(
        telegramId,
        AdminState.AUTHENTICATED_WITH_WAREHOUSE,
      );
      stateManager.resetUserTempData(telegramId);
      stateManager.setUserTempData(telegramId, {
        adminId: tempData.adminId,
        adminPermissionsLevel: tempData.adminPermissionsLevel,
      });

      await bot.sendMessage(
        chatId,
        "❌ Список СИМ пуст. Вы возвращены в состояние выбранного склада.",
      );
      await sendAdminCommandsIfNeeded(
        chatId,
        tempData.adminPermissionsLevel,
        AdminState.AUTHENTICATED_WITH_WAREHOUSE,
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.SIM_INTERACTIONS_SELECTING);
    stateManager.setUserTempData(telegramId, {
      simInteractionWarehouseId: warehouseId,
      simInteractionDevices: devices,
      selectedSimInteractionDeviceId: undefined,
    });

    await sendSimSelectionMessage(chatId, devices);
  });

  bot.onText(/^\/admin_sim_change_active(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора СИМ через /admin_sim_interactions.",
      );
      return;
    }

    const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
    if (!resolved) {
      return;
    }

    const hasActiveSession = await sessionRepository.hasActiveByDevice(
      resolved.device.id,
    );
    if (hasActiveSession) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна: по этому СИМ есть активная сессия.",
      );
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.SIM_INTERACTION_AWAITING_ACTIVE_STATUS,
    );
    await bot.sendMessage(
      chatId,
      `СИМ: <b>${escapeHtml(resolved.device.deviceNumber)}</b>\nТекущий статус: <b>${getSimActiveStatusText(resolved.device.isActive)}</b>\n\nВыберите статус:\n1. Активный\n2. Отключен\n\n/cancel - вернуться к списку СИМ.`,
      { parse_mode: "HTML" },
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
        "❌ Команда недоступна без выбора СИМ через /admin_sim_interactions.",
      );
      return;
    }

    const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
    if (!resolved) {
      return;
    }

    const hasActiveSession = await sessionRepository.hasActiveByDevice(
      resolved.device.id,
    );
    if (hasActiveSession) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна: по этому СИМ есть активная сессия.",
      );
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.SIM_INTERACTION_AWAITING_CONDITION_STATUS,
    );
    await bot.sendMessage(
      chatId,
      `СИМ: <b>${escapeHtml(resolved.device.deviceNumber)}</b>\nТекущий статус исправности: <b>${getSimConditionStatusText(resolved.device.status)}</b>\n\nВыберите статус:\n1. Исправен\n2. Поврежден\n3. Сломан\n\n/cancel - вернуться к списку СИМ.`,
      { parse_mode: "HTML" },
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
        "❌ Команда недоступна без выбора СИМ через /admin_sim_interactions.",
      );
      return;
    }

    const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
    if (!resolved) {
      return;
    }

    const history = await sessionRepository.getHistoryByDevice(resolved.device.id);
    stateManager.setUserState(
      telegramId,
      AdminState.SIM_INTERACTION_ACTION_SELECTING,
    );

    if (!history.length) {
      await bot.sendMessage(
        chatId,
        `История сессий для СИМ <b>${escapeHtml(resolved.device.deviceNumber)}</b> пуста.`,
        { parse_mode: "HTML" },
      );
      await sendSimActionsMessage(chatId, resolved.device);
      return;
    }

    await bot.sendMessage(
      chatId,
      `История сессий СИМ <b>${escapeHtml(resolved.device.deviceNumber)}</b>:\n\n${formatSimHistoryRows(history)}`,
      { parse_mode: "HTML" },
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
        "❌ Команда недоступна без выбора СИМ через /admin_sim_interactions.",
      );
      return;
    }

    const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
    if (!resolved) {
      return;
    }

    stateManager.setUserState(
      telegramId,
      AdminState.SIM_INTERACTION_AWAITING_DELETE_CONFIRM,
    );
    await bot.sendMessage(
      chatId,
      "Вы уверены, что хотите удалить СИМ? Введите ДА\n\n/cancel - вернуться к списку СИМ.",
    );
  });

  bot.onText(/^\/admin_edit_couriers(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if (!tempData.adminId || !tempData.adminPermissionsLevel) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    const warehouseId = await adminService.getAdminWarehouseId(tempData.adminId);
    if (warehouseId === undefined) {
      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
      await bot.sendMessage(
        chatId,
        "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
      );
      return;
    }

    if (warehouseId === null) {
      await bot.sendMessage(
        chatId,
        "❌ Команда доступна только если выбран склад. Используйте /admin_set_warehouse.",
      );
      return;
    }

    const couriers = await loadEditableCouriersByWarehouse(warehouseId);
    if (!couriers.length) {
      await bot.sendMessage(chatId, "❌ Список курьеров выбранного склада пуст.");
      await sendAdminCommandsIfNeeded(
        chatId,
        tempData.adminPermissionsLevel,
        currentState || AdminState.AUTHENTICATED,
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.ADMIN_EDIT_COURIERS_SELECTING);
    stateManager.setUserTempData(telegramId, {
      editCouriers: couriers,
      selectedEditCourierId: undefined,
      editCouriersReturnState: currentState || AdminState.AUTHENTICATED,
      editCouriersWarehouseId: warehouseId,
    });

    await sendEditableCouriersListMessage(chatId, couriers);
  });

  bot.onText(/^\/superadmin_edit_couriers(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Сначала войдите в админский режим командой /admin.",
      );
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (!isInAuthenticatedOrSubflow(currentState)) {
      await bot.sendMessage(
        chatId,
        "🔒 Эта команда доступна только авторизованному администратору. Используйте /admin_login.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    const permissionsLevel = tempData.adminPermissionsLevel ?? 0;
    if (permissionsLevel < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const couriers = await loadAllEditableCouriers();
    if (!couriers.length) {
      await bot.sendMessage(chatId, "❌ Список курьеров пуст.");
      await sendAdminCommandsIfNeeded(
        chatId,
        tempData.adminPermissionsLevel,
        currentState || AdminState.AUTHENTICATED,
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING);
    stateManager.setUserTempData(telegramId, {
      editCouriers: couriers,
      selectedEditCourierId: undefined,
      editCouriersReturnState: currentState || AdminState.AUTHENTICATED,
      editCouriersWarehouseId: undefined,
    });

    await sendEditableCouriersListMessage(chatId, couriers);
  });

  bot.onText(/^\/admin_edit_courier_status(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора курьера через /admin_edit_couriers.",
      );
      return;
    }

    const resolved = await tryResolveSelectedEditCourier(
      telegramId,
      chatId,
      "/admin_edit_couriers",
    );
    if (!resolved) {
      return;
    }

    stateManager.setUserState(telegramId, AdminState.ADMIN_EDIT_COURIER_AWAITING_STATUS);
    await bot.sendMessage(
      chatId,
      `Курьер: <b>${escapeHtml(resolved.courier.fullName)}</b>\nТекущий статус: <b>${getAdminStatusText(resolved.courier.isActive)}</b>\n\nВыберите статус:\n1. Активный\n2. Отключен`,
      { parse_mode: "HTML" },
    );
  });

  bot.onText(/^\/superadmin_edit_courier_status(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора курьера через /superadmin_edit_couriers.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedEditCourier(
      telegramId,
      chatId,
      "/superadmin_edit_couriers",
    );
    if (!resolved) {
      return;
    }

    stateManager.setUserState(telegramId, AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS);
    await bot.sendMessage(
      chatId,
      `Курьер: <b>${escapeHtml(resolved.courier.fullName)}</b>\nТекущий статус: <b>${getAdminStatusText(resolved.courier.isActive)}</b>\n\nВыберите статус:\n1. Активный\n2. Отключен`,
      { parse_mode: "HTML" },
    );
  });

  bot.onText(/^\/admin_courier_history(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора курьера через /admin_edit_couriers.",
      );
      return;
    }

    const resolved = await tryResolveSelectedEditCourier(
      telegramId,
      chatId,
      "/admin_edit_couriers",
    );
    if (!resolved) {
      return;
    }

    const history = await sessionRepository.getHistoryByCourier(resolved.courier.id, 50);

    if (!history.length) {
      stateManager.setUserState(telegramId, AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING);
      await bot.sendMessage(
        chatId,
        `История сессий курьера <b>${escapeHtml(resolved.courier.fullName)}</b> пуста.`,
        { parse_mode: "HTML" },
      );
      await sendCourierActionsMessage(chatId, resolved.courier, false);
      return;
    }

    stateManager.setUserState(telegramId, AdminState.ADMIN_COURIER_HISTORY_AWAITING_FULL);

    await bot.sendMessage(
      chatId,
      [
        "История сессий курьера",
        "",
        formatCourierHistoryRows(history),
        "",
        "Если хотите увидеть полную историю, напишите ДА, если хотите выйти, напишите /cancel",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
  });

  bot.onText(/^\/superadmin_courier_history(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      return;
    }

    if (!isUserInAdminMode(telegramId)) {
      await bot.sendMessage(
        chatId,
        "❌ Команда недоступна без выбора курьера через /superadmin_edit_couriers.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
    if ((tempData.adminPermissionsLevel ?? 0) < 2) {
      await bot.sendMessage(chatId, "🚫 Нет прав на эту команду.");
      return;
    }

    const resolved = await tryResolveSelectedEditCourier(
      telegramId,
      chatId,
      "/superadmin_edit_couriers",
    );
    if (!resolved) {
      return;
    }

    const history = await sessionRepository.getHistoryByCourier(resolved.courier.id, 50);

    if (!history.length) {
      stateManager.setUserState(telegramId, AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING);
      await bot.sendMessage(
        chatId,
        `История сессий курьера <b>${escapeHtml(resolved.courier.fullName)}</b> пуста.`,
        { parse_mode: "HTML" },
      );
      await sendCourierActionsMessage(chatId, resolved.courier, true);
      return;
    }

    stateManager.setUserState(telegramId, AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL);

    await bot.sendMessage(
      chatId,
      [
        "История сессий курьера",
        "",
        formatCourierHistoryRows(history),
        "",
        "Если хотите увидеть полную историю, напишите ДА, если хотите выйти, напишите /cancel",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;
    if (!telegramId) {
      return;
    }

    const currentState = stateManager.getUserState(telegramId);
    if (
      currentState !== AdminState.REGISTER_AWAITING_LOGIN &&
      currentState !== AdminState.REGISTER_AWAITING_PASSWORD &&
      currentState !== AdminState.LOGIN_AWAITING_LOGIN &&
      currentState !== AdminState.LOGIN_AWAITING_PASSWORD &&
      currentState !== AdminState.CHANGE_PASSWORD_AWAITING_NEW &&
      currentState !== AdminState.SET_WAREHOUSE_SELECTING &&
      currentState !== AdminState.CREATE_WAREHOUSE_AWAITING_NAME &&
      currentState !== AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS &&
      currentState !== AdminState.EDIT_WAREHOUSES_SELECTING &&
      currentState !== AdminState.EDIT_WAREHOUSE_ACTION_SELECTING &&
      currentState !== AdminState.EDIT_WAREHOUSE_AWAITING_NAME &&
      currentState !== AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS &&
      currentState !== AdminState.EDIT_WAREHOUSE_AWAITING_STATUS &&
      currentState !== AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM &&
      currentState !== AdminState.EDIT_ADMINS_SELECTING &&
      currentState !== AdminState.EDIT_ADMIN_ACTION_SELECTING &&
      currentState !== AdminState.EDIT_ADMIN_AWAITING_STATUS &&
      currentState !== AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM &&
      currentState !== AdminState.EDIT_ADMIN_AWAITING_PASSWORD &&
      currentState !== AdminState.APPLY_REGISTRATIONS_SELECTING &&
      currentState !== AdminState.APPLY_REGISTRATION_AWAITING_CONFIRM &&
      currentState !== AdminState.ADMIN_SESSIONS_HISTORY_AWAITING_DATE &&
      currentState !== AdminState.ADD_SIM_AWAITING_NUMBER &&
      currentState !== AdminState.SIM_INTERACTIONS_SELECTING &&
      currentState !== AdminState.SIM_INTERACTION_ACTION_SELECTING &&
      currentState !== AdminState.SIM_INTERACTION_AWAITING_ACTIVE_STATUS &&
      currentState !== AdminState.SIM_INTERACTION_AWAITING_CONDITION_STATUS &&
      currentState !== AdminState.SIM_INTERACTION_AWAITING_DELETE_CONFIRM &&
      currentState !== AdminState.ADMIN_EDIT_COURIERS_SELECTING &&
      currentState !== AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING &&
      currentState !== AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING &&
      currentState !== AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING &&
      currentState !== AdminState.ADMIN_EDIT_COURIER_AWAITING_STATUS &&
      currentState !== AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS &&
      currentState !== AdminState.ADMIN_COURIER_HISTORY_AWAITING_FULL &&
      currentState !== AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL
    ) {
      return;
    }

    const text = msg.text || "";
    if (!text) {
      return;
    }

    // Команды в ходе регистрации не перехватываем, их обрабатывают command-handlers.
    if (isCommand(text)) {
      return;
    }

    if (currentState === AdminState.REGISTER_AWAITING_LOGIN) {
      const loginInput = text.trim();
      const loginValidation = adminService.validateLogin(loginInput);
      if (!loginValidation.isValid) {
        await bot.sendMessage(
          chatId,
          `${loginValidation.error}\nПопробуйте снова.\n\nПридумайте и введите логин`,
        );
        return;
      }

      const isTaken = await adminService.isLoginTakenInsensitive(loginInput);
      if (isTaken) {
        await bot.sendMessage(
          chatId,
          "Логин уже занят (без учета регистра). Выберите другой.\n\nПридумайте и введите логин",
        );
        return;
      }

      stateManager.setUserTempDataField(
        telegramId,
        "adminRegisterLogin",
        loginInput,
      );
      stateManager.setUserState(
        telegramId,
        AdminState.REGISTER_AWAITING_PASSWORD,
      );
      await bot.sendMessage(
        chatId,
        "Придумайте и введите пароль. Требования - не менее 6 символов.",
      );
      return;
    }

    if (currentState === AdminState.LOGIN_AWAITING_LOGIN) {
      const loginInput = text.trim();
      const loginValidation = adminService.validateLogin(loginInput);
      if (!loginValidation.isValid) {
        await bot.sendMessage(
          chatId,
          `${loginValidation.error}\nПопробуйте снова.\n\nВведите логин`,
        );
        return;
      }

      const adminCandidate = await adminService.getLoginCandidate(loginInput);
      if (!adminCandidate) {
        await bot.sendMessage(
          chatId,
          "Пользователь с таким логином не найден.\n\nВведите логин",
        );
        return;
      }

      stateManager.setUserTempData(telegramId, {
        adminLoginId: adminCandidate.id,
        adminLoginNickname: adminCandidate.nickname,
        adminLoginPasswordHash: adminCandidate.passwordHash,
        adminLoginPermissionsLevel: adminCandidate.permissionsLevel,
        adminLoginIsActive: adminCandidate.isActive,
        adminLoginWarehouseId: adminCandidate.warehouseId,
      });
      stateManager.setUserState(telegramId, AdminState.LOGIN_AWAITING_PASSWORD);
      await bot.sendMessage(chatId, "Введите пароль");
      return;
    }

    if (currentState === AdminState.LOGIN_AWAITING_PASSWORD) {
      const tempData = stateManager.getUserTempData<{
        adminLoginId?: number;
        adminLoginNickname?: string;
        adminLoginPasswordHash?: string;
        adminLoginPermissionsLevel?: number;
        adminLoginIsActive?: boolean;
        adminLoginWarehouseId?: number | null;
      }>(telegramId);

      const adminLoginId = tempData?.adminLoginId;
      const adminLoginPasswordHash = tempData?.adminLoginPasswordHash;
      const adminLoginPermissionsLevel = tempData?.adminLoginPermissionsLevel;
      const adminLoginIsActive = tempData?.adminLoginIsActive;
      const adminLoginWarehouseId = tempData?.adminLoginWarehouseId;

      if (
        !adminLoginId ||
        !adminLoginPasswordHash ||
        !adminLoginPermissionsLevel
      ) {
        await startAdminLoginFlow(chatId, telegramId);
        return;
      }

      if (!adminLoginIsActive) {
        await bot.sendMessage(
          chatId,
          "⏳ Ваш админ-аккаунт еще не активирован суперадминистратором.\n\nВведите логин",
        );
        stateManager.setUserState(telegramId, AdminState.LOGIN_AWAITING_LOGIN);
        stateManager.resetUserTempData(telegramId);
        return;
      }

      const isPasswordValid = adminService.verifyPassword(
        text,
        adminLoginPasswordHash,
      );
      if (!isPasswordValid) {
        await bot.sendMessage(chatId, "Неверный пароль\n\nВведите пароль");
        return;
      }

      await adminService.setLoginStatus(adminLoginId, true);
      stateManager.setUserState(
        telegramId,
        adminLoginWarehouseId
          ? AdminState.AUTHENTICATED_WITH_WAREHOUSE
          : AdminState.AUTHENTICATED,
      );
      stateManager.setUserTempData(telegramId, {
        adminId: adminLoginId,
        adminPermissionsLevel: adminLoginPermissionsLevel,
      });

      await bot.sendMessage(
        chatId,
        getAuthenticatedAdminWelcomeMessage(
          adminLoginPermissionsLevel,
          !!adminLoginWarehouseId,
        ),
      );

      return;
    }

    if (currentState === AdminState.CHANGE_PASSWORD_AWAITING_NEW) {
      const passwordInput = text.trim();
      const passwordValidation = adminService.validatePassword(passwordInput);
      if (!passwordValidation.isValid) {
        await bot.sendMessage(
          chatId,
          "❌ Пароль должен содержать минимум 6 символов.\n\nВведите новый пароль, не менее 6 символов",
        );
        return;
      }

      const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId);
      const adminId = tempData?.adminId;
      const adminPermissionsLevel = tempData?.adminPermissionsLevel;
      if (!adminId || !adminPermissionsLevel) {
        stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
        stateManager.resetUserTempData(telegramId);
        await bot.sendMessage(
          chatId,
          "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
        );
        return;
      }

      const result = await adminService.changePassword(adminId, passwordInput);
      if (!result.success) {
        await bot.sendMessage(
          chatId,
          `❌ ${result.reason || "Не удалось сменить пароль."}\n\nВведите новый пароль, не менее 6 символов`,
        );
        return;
      }

      const currentWarehouseId = await adminService.getAdminWarehouseId(adminId);
      const authenticatedState = currentWarehouseId
        ? AdminState.AUTHENTICATED_WITH_WAREHOUSE
        : AdminState.AUTHENTICATED;

      stateManager.setUserState(telegramId, authenticatedState);
      stateManager.resetUserTempData(telegramId);
      stateManager.setUserTempData(telegramId, {
        adminId,
        adminPermissionsLevel,
      });

      await bot.sendMessage(
        chatId,
        "✅ Пароль успешно изменен. Вы остаетесь в авторизованном админ-режиме.",
      );
      return;
    }

    if (currentState === AdminState.SET_WAREHOUSE_SELECTING) {
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const warehouses = tempData.adminSetWarehouses;
      const adminId = tempData.adminId;
      const adminPermissionsLevel = tempData.adminPermissionsLevel;

      if (!adminId || !adminPermissionsLevel) {
        stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
        stateManager.resetUserTempData(telegramId);
        await bot.sendMessage(
          chatId,
          "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
        );
        return;
      }

      if (!warehouses?.length) {
        const fallbackState =
          tempData.adminSetReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        stateManager.resetUserTempData(telegramId);
        stateManager.setUserTempData(telegramId, {
          adminId,
          adminPermissionsLevel,
        });
        await bot.sendMessage(
          chatId,
          "❌ Что-то пошло не так. Запустите /admin_set_warehouse заново.",
        );
        return;
      }

      if (!/^\d+$/.test(text.trim())) {
        await bot.sendMessage(
          chatId,
          "❌ Введите корректный номер склада из списка.",
        );
        return;
      }

      const index = parseInt(text.trim(), 10) - 1;
      if (index < 0 || index >= warehouses.length) {
        await bot.sendMessage(
          chatId,
          "❌ Склад с таким номером не найден. Введите номер из списка.",
        );
        return;
      }

      const selectedWarehouse = warehouses[index];
      const setWarehouseResult = await adminService.setAdminWarehouse(
        adminId,
        selectedWarehouse.id,
      );
      if (!setWarehouseResult.success) {
        await bot.sendMessage(
          chatId,
          `❌ ${setWarehouseResult.reason || "Не удалось выбрать склад."}`,
        );
        return;
      }

      stateManager.setUserState(telegramId, AdminState.AUTHENTICATED_WITH_WAREHOUSE);
      stateManager.resetUserTempData(telegramId);
      stateManager.setUserTempData(telegramId, {
        adminId,
        adminPermissionsLevel,
      });

      await bot.sendMessage(
        chatId,
        `✅ Вы успешно выбрали склад: <b>${escapeHtml(selectedWarehouse.name)}</b>.`,
        { parse_mode: "HTML" },
      );
      await bot.sendMessage(
        chatId,
        getAuthenticatedAdminWelcomeMessage(adminPermissionsLevel, true),
      );
      return;
    }

    if (currentState === AdminState.CREATE_WAREHOUSE_AWAITING_NAME) {
      const nameInput = text.trim();
      if (nameInput.length < 2) {
        await bot.sendMessage(
          chatId,
          "❌ Название должно содержать минимум 2 символа.\n\nВведите название склада",
        );
        return;
      }

      stateManager.setUserTempDataField(
        telegramId,
        "createWarehouseName",
        nameInput,
      );
      stateManager.setUserState(
        telegramId,
        AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS,
      );
      await bot.sendMessage(chatId, "Введите адрес склада");
      return;
    }

    if (currentState === AdminState.CREATE_WAREHOUSE_AWAITING_ADDRESS) {
      const addressInput = text.trim();
      if (addressInput.length < 2) {
        await bot.sendMessage(
          chatId,
          "❌ Адрес должен содержать минимум 2 символа.\n\nВведите адрес склада",
        );
        return;
      }

      const tempData = stateManager.getUserTempData<{
        adminId?: number;
        adminPermissionsLevel?: number;
        createWarehouseName?: string;
      }>(telegramId);
      const warehouseName = tempData?.createWarehouseName;
      const adminId = tempData?.adminId;
      const adminPermissionsLevel = tempData?.adminPermissionsLevel;

      if (!warehouseName) {
        stateManager.setUserState(
          telegramId,
          AdminState.CREATE_WAREHOUSE_AWAITING_NAME,
        );
        await bot.sendMessage(
          chatId,
          "⚠️ Что-то пошло не так. Введите название склада",
        );
        return;
      }

      const warehouse = await warehouseService.createWarehouse(
        warehouseName,
        addressInput,
      );

      const currentWarehouseId = adminId
        ? await adminService.getAdminWarehouseId(adminId)
        : null;
      const authenticatedState = currentWarehouseId
        ? AdminState.AUTHENTICATED_WITH_WAREHOUSE
        : AdminState.AUTHENTICATED;

      stateManager.setUserState(telegramId, authenticatedState);
      stateManager.resetUserTempData(telegramId);
      if (adminId && adminPermissionsLevel) {
        stateManager.setUserTempData(telegramId, {
          adminId,
          adminPermissionsLevel,
        });
      }

      await bot.sendMessage(
        chatId,
        `✅ Успешно создан склад *${warehouse.name}* по адресу *${warehouse.address}*`,
        { parse_mode: "Markdown" },
      );
      await sendAdminCommandsIfNeeded(
        chatId,
        adminPermissionsLevel,
        authenticatedState,
      );
      return;
    }

    if (currentState === AdminState.EDIT_ADMINS_SELECTING) {
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const admins = tempData.editAdmins;

      if (!admins?.length) {
        const restoredState = restoreToAuthenticatedWithAdminContext(telegramId, tempData);
        await bot.sendMessage(
          chatId,
          "❌ Что-то пошло не так. Запустите /superadmin_edit_admins заново.",
        );
        await sendAdminCommandsIfNeeded(
          chatId,
          tempData.adminPermissionsLevel,
          restoredState,
        );
        return;
      }

      if (!/^\d+$/.test(text.trim())) {
        await bot.sendMessage(
          chatId,
          "❌ Введите корректный номер администратора из списка.",
        );
        return;
      }

      const index = parseInt(text.trim(), 10) - 1;
      if (index < 0 || index >= admins.length) {
        await bot.sendMessage(
          chatId,
          "❌ Администратор с таким номером не найден. Введите номер из списка.",
        );
        return;
      }

      const selectedAdmin = admins[index];
      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_ADMIN_ACTION_SELECTING,
      );
      stateManager.setUserTempData(telegramId, {
        selectedEditAdminId: selectedAdmin.id,
      });

      await sendAdminActionsMessage(chatId, selectedAdmin);
      return;
    }

    if (currentState === AdminState.EDIT_ADMIN_ACTION_SELECTING) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Выберите действие командой: /superadmin_edit_admin_status, /superadmin_edit_admin_delete или /superadmin_edit_admin_password.",
      );
      return;
    }

    if (currentState === AdminState.EDIT_WAREHOUSES_SELECTING) {
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const warehouses = tempData.editWarehouses;

      if (!warehouses?.length) {
        const restoredState = restoreToAuthenticatedWithAdminContext(telegramId, tempData);
        await bot.sendMessage(
          chatId,
          "❌ Что-то пошло не так. Запустите /superadmin_edit_warehouses заново.",
        );
        await sendAdminCommandsIfNeeded(
          chatId,
          tempData.adminPermissionsLevel,
          restoredState,
        );
        return;
      }

      if (!/^\d+$/.test(text.trim())) {
        await bot.sendMessage(
          chatId,
          "❌ Введите корректный номер склада из списка.",
        );
        return;
      }

      const index = parseInt(text.trim(), 10) - 1;
      if (index < 0 || index >= warehouses.length) {
        await bot.sendMessage(
          chatId,
          "❌ Склад с таким номером не найден. Введите номер из списка.",
        );
        return;
      }

      const selectedWarehouse = warehouses[index];
      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_WAREHOUSE_ACTION_SELECTING,
      );
      stateManager.setUserTempData(telegramId, {
        selectedWarehouseId: selectedWarehouse.id,
      });

      await sendWarehouseActionsMessage(chatId, selectedWarehouse);
      return;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_ACTION_SELECTING) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Выберите действие командой: /superadmin_edit_warehouse_name, /superadmin_edit_warehouse_address, /superadmin_edit_warehouse_status или /superadmin_edit_warehouse_delete.",
      );
      return;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_AWAITING_NAME) {
      const nameInput = text.trim();
      if (nameInput.length < 2) {
        await bot.sendMessage(
          chatId,
          "❌ Название должно содержать минимум 2 символа.\n\nВведите новое название склада",
        );
        return;
      }

      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const selectedWarehouseId = tempData.selectedWarehouseId;
      if (!selectedWarehouseId) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
        );
        return;
      }

      const updated = await warehouseService.updateWarehouseName(
        selectedWarehouseId,
        nameInput,
      );
      if (!updated) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Склад не найден. Запустите /superadmin_edit_warehouses заново.",
        );
        return;
      }

      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_WAREHOUSE_ACTION_SELECTING,
      );
      await bot.sendMessage(
        chatId,
        `✅ Название склада изменено на <b>${escapeHtml(updated.name)}</b>`,
        {
          parse_mode: "HTML",
        },
      );
      await sendWarehouseActionsMessage(chatId, updated);
      return;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_AWAITING_ADDRESS) {
      const addressInput = text.trim();
      if (addressInput.length < 2) {
        await bot.sendMessage(
          chatId,
          "❌ Адрес должен содержать минимум 2 символа.\n\nВведите новый адрес склада",
        );
        return;
      }

      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const selectedWarehouseId = tempData.selectedWarehouseId;
      if (!selectedWarehouseId) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
        );
        return;
      }

      const updated = await warehouseService.updateWarehouseAddress(
        selectedWarehouseId,
        addressInput,
      );
      if (!updated) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Склад не найден. Запустите /superadmin_edit_warehouses заново.",
        );
        return;
      }

      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_WAREHOUSE_ACTION_SELECTING,
      );
      await bot.sendMessage(
        chatId,
        `✅ Адрес склада изменен на <b>${escapeHtml(updated.address || "-")}</b>`,
        {
          parse_mode: "HTML",
        },
      );
      await sendWarehouseActionsMessage(chatId, updated);
      return;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_AWAITING_STATUS) {
      const status = parseWarehouseStatusInput(text);
      if (status === null) {
        await bot.sendMessage(
          chatId,
          "❌ Некорректный выбор статуса. Введите 1 (Активный) или 2 (Отключен).",
        );
        return;
      }

      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const selectedWarehouseId = tempData.selectedWarehouseId;
      if (!selectedWarehouseId) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
        );
        return;
      }

      if (!status) {
        const hasActiveSessions =
          await warehouseService.hasActiveSessionsByWarehouseId(
            selectedWarehouseId,
          );
        if (hasActiveSessions) {
          await bot.sendMessage(
            chatId,
            "❌ Нельзя отключить склад: по нему есть активные сессии. Завершите сессии и повторите попытку.",
          );
          return;
        }
      }

      const updated = await warehouseService.updateWarehouseStatus(
        selectedWarehouseId,
        status,
      );
      if (!updated) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Склад не найден. Запустите /superadmin_edit_warehouses заново.",
        );
        return;
      }

      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_WAREHOUSE_ACTION_SELECTING,
      );
      await bot.sendMessage(
        chatId,
        `✅ Статус склада изменен на <b>${getWarehouseStatusText(updated.is_active)}</b>`,
        {
          parse_mode: "HTML",
        },
      );
      await sendWarehouseActionsMessage(chatId, updated);
      return;
    }

    if (currentState === AdminState.EDIT_WAREHOUSE_AWAITING_DELETE_CONFIRM) {
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const selectedWarehouseId = tempData.selectedWarehouseId;
      const fallbackState =
        tempData.editReturnState || AdminState.AUTHENTICATED;

      if (text.trim() !== "ДА") {
        await bot.sendMessage(
          chatId,
          "❌ Для удаления склада введите строго ДА.",
        );
        return;
      }

      if (!selectedWarehouseId) {
        stateManager.setUserState(telegramId, fallbackState);
        await bot.sendMessage(
          chatId,
          "❌ Команда недоступна без выбора склада через /superadmin_edit_warehouses.",
        );
        return;
      }

      const deleteResult =
        await warehouseService.deleteWarehouse(selectedWarehouseId);
      if (!deleteResult.success) {
        await bot.sendMessage(
          chatId,
          `❌ ${deleteResult.reason || "Не удалось удалить склад."}`,
        );
        return;
      }

      stateManager.setUserState(telegramId, fallbackState);
      stateManager.resetUserTempData(telegramId);
      if (tempData.adminId && tempData.adminPermissionsLevel) {
        stateManager.setUserTempData(telegramId, {
          adminId: tempData.adminId,
          adminPermissionsLevel: tempData.adminPermissionsLevel,
        });
      }

      await bot.sendMessage(chatId, "✅ Склад успешно удален.");
      return;
    }

    if (currentState === AdminState.EDIT_ADMIN_AWAITING_STATUS) {
      const status = parseAdminStatusInput(text);
      if (status === null) {
        await bot.sendMessage(
          chatId,
          "❌ Некорректный выбор статуса. Введите 1 (Активный) или 2 (Отключен).",
        );
        return;
      }

      const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
      if (!resolved) {
        return;
      }

      const changeResult = await adminService.changeAdminActiveStatus(
        resolved.admin.id,
        status,
      );
      if (!changeResult.success) {
        await bot.sendMessage(
          chatId,
          `❌ ${changeResult.reason || "Не удалось изменить статус администратора."}`,
        );
        return;
      }

      const updatedAdmin = await adminService.getAdminById(resolved.admin.id);
      if (!updatedAdmin || updatedAdmin.permissionsLevel >= 2) {
        await bot.sendMessage(
          chatId,
          "❌ Администратор не найден. Запустите /superadmin_edit_admins заново.",
        );
        return;
      }

      const updatedAdminForSession: EditableAdminSessionItem = {
        id: updatedAdmin.id,
        nickname: updatedAdmin.nickname,
        isActive: updatedAdmin.isActive,
      };

      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const updatedList = (tempData.editAdmins || []).map((admin) =>
        admin.id === updatedAdminForSession.id ? updatedAdminForSession : admin,
      );

      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_ADMIN_ACTION_SELECTING,
      );
      stateManager.setUserTempData(telegramId, {
        editAdmins: updatedList,
      });

      await bot.sendMessage(
        chatId,
        `✅ Статус администратора изменен на <b>${getAdminStatusText(updatedAdminForSession.isActive)}</b>`,
        { parse_mode: "HTML" },
      );
      await sendAdminActionsMessage(chatId, updatedAdminForSession);
      return;
    }

    if (currentState === AdminState.EDIT_ADMIN_AWAITING_DELETE_CONFIRM) {
      if (text.trim() !== "ДА") {
        await bot.sendMessage(
          chatId,
          "❌ Для удаления администратора введите строго ДА.",
        );
        return;
      }

      const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
      if (!resolved) {
        return;
      }

      const deleteResult = await adminService.deleteAdmin(resolved.admin.id);
      if (!deleteResult.success) {
        await bot.sendMessage(
          chatId,
          `❌ ${deleteResult.reason || "Не удалось удалить администратора."}`,
        );
        return;
      }

      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const editableAdmins = await loadEditableAdmins();
      if (!editableAdmins.length) {
        const fallbackState =
          tempData.editReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, fallbackState);
        stateManager.resetUserTempData(telegramId);
        if (tempData.adminId && tempData.adminPermissionsLevel) {
          stateManager.setUserTempData(telegramId, {
            adminId: tempData.adminId,
            adminPermissionsLevel: tempData.adminPermissionsLevel,
          });
        }

        await bot.sendMessage(
          chatId,
          "✅ Администратор успешно удален. Больше администраторов нет. Вы возвращены в предыдущее состояние.",
        );
        return;
      }

      stateManager.setUserState(telegramId, AdminState.EDIT_ADMINS_SELECTING);
      stateManager.setUserTempData(telegramId, {
        editAdmins: editableAdmins,
        selectedEditAdminId: undefined,
      });

      await bot.sendMessage(chatId, "✅ Администратор успешно удален.");
      await sendEditableAdminsListMessage(chatId, editableAdmins);
      return;
    }

    if (currentState === AdminState.EDIT_ADMIN_AWAITING_PASSWORD) {
      const passwordInput = text.trim();
      const passwordValidation = adminService.validatePassword(passwordInput);
      if (!passwordValidation.isValid) {
        await bot.sendMessage(
          chatId,
          "❌ Пароль должен содержать минимум 6 символов.\n\nВведите новый пароль, не менее 6 символов",
        );
        return;
      }

      const resolved = await tryResolveSelectedAdmin(telegramId, chatId);
      if (!resolved) {
        return;
      }

      const result = await adminService.changePassword(
        resolved.admin.id,
        passwordInput,
      );
      if (!result.success) {
        await bot.sendMessage(
          chatId,
          `❌ ${result.reason || "Не удалось сменить пароль."}\n\nВведите новый пароль, не менее 6 символов`,
        );
        return;
      }

      stateManager.setUserState(
        telegramId,
        AdminState.EDIT_ADMIN_ACTION_SELECTING,
      );
      await bot.sendMessage(chatId, "✅ Пароль администратора успешно изменен.");
      await sendAdminActionsMessage(chatId, resolved.admin);
      return;
    }

    if (currentState === AdminState.APPLY_REGISTRATIONS_SELECTING) {
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const pendingCouriers = tempData.applyRegistrations;

      if (!pendingCouriers?.length) {
        const refreshed = await loadPendingCourierApprovals();
        if (!refreshed.length) {
          const restoredState = restoreToAuthenticatedWithAdminContext(
            telegramId,
            tempData,
            tempData.applyRegistrationsReturnState,
          );
          await bot.sendMessage(
            chatId,
            "ℹ️ Нет неактивных курьеров без записей о сессиях.",
          );
          await sendAdminCommandsIfNeeded(
            chatId,
            tempData.adminPermissionsLevel,
            restoredState,
          );
          return;
        }

        stateManager.setUserTempData(telegramId, { applyRegistrations: refreshed });
        await sendPendingCourierApprovalsListMessage(chatId, refreshed);
        return;
      }

      if (!/^\d+$/.test(text.trim())) {
        await bot.sendMessage(
          chatId,
          "❌ Введите корректный номер курьера из списка.",
        );
        return;
      }

      const index = parseInt(text.trim(), 10) - 1;
      if (index < 0 || index >= pendingCouriers.length) {
        await bot.sendMessage(
          chatId,
          "❌ Курьер с таким номером не найден. Введите номер из списка.",
        );
        return;
      }

      const selectedCourier = pendingCouriers[index];
      stateManager.setUserState(
        telegramId,
        AdminState.APPLY_REGISTRATION_AWAITING_CONFIRM,
      );
      stateManager.setUserTempData(telegramId, {
        selectedApplyCourierId: selectedCourier.id,
      });

      await bot.sendMessage(
        chatId,
        'Вы принимаете регистрацию пользователя? Введите "Да" или "Нет"',
      );
      return;
    }

    if (currentState === AdminState.APPLY_REGISTRATION_AWAITING_CONFIRM) {
      const normalized = text.trim().toLowerCase();
      if (normalized !== "да" && normalized !== "нет") {
        await bot.sendMessage(
          chatId,
          '❌ Некорректный ответ. Введите "Да" или "Нет".',
        );
        return;
      }

      const resolved = await tryResolveSelectedApplyCourier(telegramId, chatId);
      if (!resolved) {
        return;
      }

      if (normalized === "да") {
        const activateResult = await courierService.activateCourier(
          resolved.courier.id,
        );
        if (!activateResult.success) {
          await bot.sendMessage(
            chatId,
            `❌ ${activateResult.reason || "Не удалось активировать курьера."}`,
          );
          return;
        }

        await bot.sendMessage(
          chatId,
          `✅ Регистрация курьера <b>${escapeHtml(resolved.courier.fullName)}</b> принята.`,
          { parse_mode: "HTML" },
        );
      } else {
        await bot.sendMessage(
          chatId,
          `ℹ️ Курьер <b>${escapeHtml(resolved.courier.fullName)}</b> остался неактивным.`,
          { parse_mode: "HTML" },
        );
      }

      const refreshed = await loadPendingCourierApprovals();
      if (!refreshed.length) {
        const restoredState = restoreToAuthenticatedWithAdminContext(
          telegramId,
          resolved.tempData,
          resolved.tempData.applyRegistrationsReturnState,
        );
        await bot.sendMessage(
          chatId,
          "ℹ️ Нет неактивных курьеров без записей о сессиях. Вы возвращены в предыдущее состояние.",
        );
        await sendAdminCommandsIfNeeded(
          chatId,
          resolved.tempData.adminPermissionsLevel,
          restoredState,
        );
        return;
      }

      stateManager.setUserState(telegramId, AdminState.APPLY_REGISTRATIONS_SELECTING);
      stateManager.setUserTempData(telegramId, {
        applyRegistrations: refreshed,
        selectedApplyCourierId: undefined,
      });
      await sendPendingCourierApprovalsListMessage(chatId, refreshed);
      return;
    }

    if (currentState === AdminState.ADMIN_SESSIONS_HISTORY_AWAITING_DATE) {
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const adminId = tempData.adminId;
      const adminPermissionsLevel = tempData.adminPermissionsLevel;

      if (!adminId || !adminPermissionsLevel) {
        stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
        stateManager.resetUserTempData(telegramId);
        await bot.sendMessage(
          chatId,
          "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
        );
        return;
      }

      const resolvedWarehouseId = await adminService.getAdminWarehouseId(adminId);
      if (resolvedWarehouseId === undefined) {
        stateManager.setUserState(telegramId, AdminState.AUTHENTICATED);
        stateManager.resetUserTempData(telegramId);
        stateManager.setUserTempData(telegramId, {
          adminId,
          adminPermissionsLevel,
        });
        await bot.sendMessage(
          chatId,
          "⚠️ Не удалось определить администратора. Выполните /admin_login повторно.",
        );
        return;
      }

      if (resolvedWarehouseId === null) {
        const returnState =
          tempData.sessionsHistoryReturnState || AdminState.AUTHENTICATED;
        stateManager.setUserState(telegramId, returnState);
        stateManager.resetUserTempData(telegramId);
        stateManager.setUserTempData(telegramId, {
          adminId,
          adminPermissionsLevel,
        });
        await bot.sendMessage(
          chatId,
          "❌ Команда доступна только если выбран склад. Используйте /admin_set_warehouse.",
        );
        return;
      }

      const warehouseId = resolvedWarehouseId;

      const parsedDateRange = parseMoscowDateRangeInput(text.trim());
      if (!parsedDateRange) {
        await bot.sendMessage(
          chatId,
          "❌ Некорректная дата. Используйте формат ДД.ММ.ГГГГ (например, 24.03.2026).\n\nВведите дату в формате ДД.ММ.ГГГГ для просмотра истории сессий",
        );
        return;
      }

      const history = await sessionService.getSessionsHistoryByWarehouseAndStartDateRange(
        warehouseId,
        parsedDateRange.startUtc,
        parsedDateRange.endUtc,
      );

      const returnState =
        tempData.sessionsHistoryReturnState || AdminState.AUTHENTICATED;
      stateManager.setUserState(telegramId, returnState);
      stateManager.resetUserTempData(telegramId);
      stateManager.setUserTempData(telegramId, {
        adminId,
        adminPermissionsLevel,
      });

      if (!history.length) {
        await bot.sendMessage(
          chatId,
          `ℹ️ За ${parsedDateRange.displayDate} по выбранному складу сессии не найдены.`,
        );
        await sendAdminCommandsIfNeeded(chatId, adminPermissionsLevel, returnState);
        return;
      }

      await bot.sendMessage(
        chatId,
        `История сессий выбранного склада за ${parsedDateRange.displayDate}:\n\n${formatSessionsHistoryByWarehouseRows(history)}`,
        { parse_mode: "HTML" },
      );
      return;
    }

    if (currentState === AdminState.ADD_SIM_AWAITING_NUMBER) {
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const adminId = tempData.adminId;
      const adminPermissionsLevel = tempData.adminPermissionsLevel;
      const addSimWarehouseId = tempData.addSimWarehouseId;

      if (!adminId || !adminPermissionsLevel || !addSimWarehouseId) {
        stateManager.setUserState(
          telegramId,
          AdminState.AUTHENTICATED_WITH_WAREHOUSE,
        );
        stateManager.resetUserTempData(telegramId);
        if (adminId && adminPermissionsLevel) {
          stateManager.setUserTempData(telegramId, {
            adminId,
            adminPermissionsLevel,
          });
        }
        await bot.sendMessage(
          chatId,
          "⚠️ Не удалось определить контекст. Выполните /admin_add_sim повторно.",
        );
        return;
      }

      const deviceNumber = text.trim().toUpperCase();
      if (!validateSimNumber(deviceNumber)) {
        await bot.sendMessage(
          chatId,
          "❌ Некорректный номер СИМ. Формат: 3 буквы (латинские или кириллица) и 3 цифры в произвольном порядке (например, АА000А).\n\nВведите номер СИМ",
        );
        return;
      }

      const existing =
        await mobilityDeviceRepository.findByDeviceNumber(deviceNumber);
      if (existing) {
        await bot.sendMessage(
          chatId,
          "❌ СИМ с таким номером уже существует. Введите другой номер СИМ",
        );
        return;
      }

      await mobilityDeviceRepository.createDevice(deviceNumber, addSimWarehouseId);

      stateManager.setUserState(
        telegramId,
        AdminState.AUTHENTICATED_WITH_WAREHOUSE,
      );
      stateManager.resetUserTempData(telegramId);
      stateManager.setUserTempData(telegramId, {
        adminId,
        adminPermissionsLevel,
      });

      await bot.sendMessage(
        chatId,
        `✅ СИМ <b>${escapeHtml(deviceNumber)}</b> успешно добавлен.`,
        { parse_mode: "HTML" },
      );
      await bot.sendMessage(
        chatId,
        getAuthenticatedAdminWelcomeMessage(adminPermissionsLevel, true),
      );
      return;
    }

    if (currentState === AdminState.SIM_INTERACTIONS_SELECTING) {
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const devices = tempData.simInteractionDevices;

      if (!devices?.length) {
        stateManager.setUserState(
          telegramId,
          AdminState.AUTHENTICATED_WITH_WAREHOUSE,
        );
        stateManager.resetUserTempData(telegramId);
        if (tempData.adminId && tempData.adminPermissionsLevel) {
          stateManager.setUserTempData(telegramId, {
            adminId: tempData.adminId,
            adminPermissionsLevel: tempData.adminPermissionsLevel,
          });
        }

        await bot.sendMessage(
          chatId,
          "❌ Что-то пошло не так. Запустите /admin_sim_interactions заново.",
        );
        await sendAdminCommandsIfNeeded(
          chatId,
          tempData.adminPermissionsLevel,
          AdminState.AUTHENTICATED_WITH_WAREHOUSE,
        );
        return;
      }

      const input = text.trim();
      let selectedDevice: SimInteractionSessionItem | undefined;

      if (/^\d+$/.test(input)) {
        const index = parseInt(input, 10) - 1;
        if (index >= 0 && index < devices.length) {
          selectedDevice = devices[index];
        }
      } else {
        const normalizedNumber = input.toUpperCase();
        selectedDevice = devices.find(
          (device) => device.deviceNumber.toUpperCase() === normalizedNumber,
        );
      }

      if (!selectedDevice) {
        await bot.sendMessage(
          chatId,
          "❌ СИМ не найден. Введите порядковый номер из списка или номер СИМ.",
        );
        return;
      }

      stateManager.setUserState(
        telegramId,
        AdminState.SIM_INTERACTION_ACTION_SELECTING,
      );
      stateManager.setUserTempData(telegramId, {
        selectedSimInteractionDeviceId: selectedDevice.id,
      });

      await sendSimActionsMessage(chatId, selectedDevice);
      return;
    }

    if (currentState === AdminState.SIM_INTERACTION_ACTION_SELECTING) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Выберите действие командой: /admin_sim_change_active, /admin_sim_change_status, /admin_sim_story или /admin_sim_delete.\n\n/cancel - вернуться к списку СИМ.",
      );
      return;
    }

    if (currentState === AdminState.SIM_INTERACTION_AWAITING_ACTIVE_STATUS) {
      const nextStatus = parseSimActiveStatusInput(text);
      if (nextStatus === null) {
        await bot.sendMessage(
          chatId,
          "❌ Некорректный выбор статуса. Введите 1 (Активный) или 2 (Отключен).",
        );
        return;
      }

      const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
      if (!resolved) {
        return;
      }

      const hasActiveSession = await sessionRepository.hasActiveByDevice(
        resolved.device.id,
      );
      if (hasActiveSession) {
        stateManager.setUserState(
          telegramId,
          AdminState.SIM_INTERACTION_ACTION_SELECTING,
        );
        await bot.sendMessage(
          chatId,
          "❌ Невозможно изменить статус активности: по СИМ есть активная сессия.",
        );
        await sendSimActionsMessage(chatId, resolved.device);
        return;
      }

      const updated = await mobilityDeviceRepository.updateActiveById(
        resolved.device.id,
        nextStatus,
      );
      if (!updated) {
        await bot.sendMessage(
          chatId,
          "❌ Не удалось изменить статус активности СИМ.",
        );
        return;
      }

      const refreshed = await mobilityDeviceRepository.findById(resolved.device.id);
      if (!refreshed || !refreshed.device_number) {
        await bot.sendMessage(
          chatId,
          "❌ СИМ не найден. Запустите /admin_sim_interactions заново.",
        );
        return;
      }

      const refreshedDevice: SimInteractionSessionItem = {
        id: refreshed.id,
        deviceNumber: refreshed.device_number.toUpperCase(),
        isActive: refreshed.is_active,
        status: refreshed.status,
      };
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const updatedList = (tempData.simInteractionDevices || []).map((device) =>
        device.id === refreshedDevice.id ? refreshedDevice : device,
      );

      stateManager.setUserState(
        telegramId,
        AdminState.SIM_INTERACTION_ACTION_SELECTING,
      );
      stateManager.setUserTempData(telegramId, {
        simInteractionDevices: updatedList,
      });

      await bot.sendMessage(
        chatId,
        `✅ Статус активности СИМ изменен на <b>${getSimActiveStatusText(refreshedDevice.isActive)}</b>.`,
        { parse_mode: "HTML" },
      );
      await sendSimActionsMessage(chatId, refreshedDevice);
      return;
    }

    if (currentState === AdminState.SIM_INTERACTION_AWAITING_CONDITION_STATUS) {
      const nextStatus = parseSimConditionStatusInput(text);
      if (nextStatus === null) {
        await bot.sendMessage(
          chatId,
          "❌ Некорректный выбор статуса. Введите 1 (Исправен), 2 (Поврежден) или 3 (Сломан).",
        );
        return;
      }

      const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
      if (!resolved) {
        return;
      }

      const hasActiveSession = await sessionRepository.hasActiveByDevice(
        resolved.device.id,
      );
      if (hasActiveSession) {
        stateManager.setUserState(
          telegramId,
          AdminState.SIM_INTERACTION_ACTION_SELECTING,
        );
        await bot.sendMessage(
          chatId,
          "❌ Невозможно изменить статус исправности: по СИМ есть активная сессия.",
        );
        await sendSimActionsMessage(chatId, resolved.device);
        return;
      }

      const updated = await mobilityDeviceRepository.updateConditionStatusById(
        resolved.device.id,
        nextStatus,
      );
      if (!updated) {
        await bot.sendMessage(
          chatId,
          "❌ Не удалось изменить статус исправности СИМ.",
        );
        return;
      }

      if (nextStatus === "broken") {
        const deactivated = await mobilityDeviceRepository.updateActiveById(
          resolved.device.id,
          false,
        );
        if (!deactivated) {
          await bot.sendMessage(
            chatId,
            "❌ Не удалось отключить СИМ после установки статуса Сломан.",
          );
          return;
        }
      }

      const refreshed = await mobilityDeviceRepository.findById(resolved.device.id);
      if (!refreshed || !refreshed.device_number) {
        await bot.sendMessage(
          chatId,
          "❌ СИМ не найден. Запустите /admin_sim_interactions заново.",
        );
        return;
      }

      const refreshedDevice: SimInteractionSessionItem = {
        id: refreshed.id,
        deviceNumber: refreshed.device_number.toUpperCase(),
        isActive: refreshed.is_active,
        status: refreshed.status,
      };
      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const updatedList = (tempData.simInteractionDevices || []).map((device) =>
        device.id === refreshedDevice.id ? refreshedDevice : device,
      );

      stateManager.setUserState(
        telegramId,
        AdminState.SIM_INTERACTION_ACTION_SELECTING,
      );
      stateManager.setUserTempData(telegramId, {
        simInteractionDevices: updatedList,
      });

      await bot.sendMessage(
        chatId,
        `✅ Статус исправности СИМ изменен на <b>${getSimConditionStatusText(refreshedDevice.status)}</b>.`,
        { parse_mode: "HTML" },
      );
      await sendSimActionsMessage(chatId, refreshedDevice);
      return;
    }

    if (currentState === AdminState.SIM_INTERACTION_AWAITING_DELETE_CONFIRM) {
      if (text.trim() !== "ДА") {
        await bot.sendMessage(
          chatId,
          "❌ Для удаления СИМ введите строго ДА.",
        );
        return;
      }

      const resolved = await tryResolveSelectedSimDevice(telegramId, chatId);
      if (!resolved) {
        return;
      }

      const hasActiveSession = await sessionRepository.hasActiveByDevice(
        resolved.device.id,
      );
      if (hasActiveSession) {
        stateManager.setUserState(
          telegramId,
          AdminState.SIM_INTERACTION_ACTION_SELECTING,
        );
        await bot.sendMessage(
          chatId,
          "❌ Невозможно удалить СИМ, пока по нему есть активная сессия.",
        );
        await sendSimActionsMessage(chatId, resolved.device);
        return;
      }

      const deleteResult = await mobilityDeviceRepository.deleteByIdWithSessions(
        resolved.device.id,
      );
      if (deleteResult.blockedByActiveSession) {
        stateManager.setUserState(
          telegramId,
          AdminState.SIM_INTERACTION_ACTION_SELECTING,
        );
        await bot.sendMessage(
          chatId,
          "❌ Невозможно удалить СИМ: по нему есть активная сессия.",
        );
        await sendSimActionsMessage(chatId, resolved.device);
        return;
      }

      if (!deleteResult.deleted) {
        await bot.sendMessage(
          chatId,
          "❌ Не удалось удалить СИМ. Попробуйте позже.",
        );
        return;
      }

      const tempData =
        stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const warehouseId = tempData.simInteractionWarehouseId;

      if (!warehouseId) {
        stateManager.setUserState(
          telegramId,
          AdminState.AUTHENTICATED_WITH_WAREHOUSE,
        );
        stateManager.resetUserTempData(telegramId);
        if (tempData.adminId && tempData.adminPermissionsLevel) {
          stateManager.setUserTempData(telegramId, {
            adminId: tempData.adminId,
            adminPermissionsLevel: tempData.adminPermissionsLevel,
          });
        }

        await bot.sendMessage(
          chatId,
          "✅ СИМ удален. Контекст выбора СИМ сброшен.",
        );
        await sendAdminCommandsIfNeeded(
          chatId,
          tempData.adminPermissionsLevel,
          AdminState.AUTHENTICATED_WITH_WAREHOUSE,
        );
        return;
      }

      const refreshedDevices = await loadWarehouseSimDevices(warehouseId);
      if (!refreshedDevices.length) {
        stateManager.setUserState(
          telegramId,
          AdminState.AUTHENTICATED_WITH_WAREHOUSE,
        );
        stateManager.resetUserTempData(telegramId);
        if (tempData.adminId && tempData.adminPermissionsLevel) {
          stateManager.setUserTempData(telegramId, {
            adminId: tempData.adminId,
            adminPermissionsLevel: tempData.adminPermissionsLevel,
          });
        }

        await bot.sendMessage(
          chatId,
          "✅ СИМ удален. Список СИМ пуст, вы возвращены в состояние выбранного склада.",
        );
        await sendAdminCommandsIfNeeded(
          chatId,
          tempData.adminPermissionsLevel,
          AdminState.AUTHENTICATED_WITH_WAREHOUSE,
        );
        return;
      }

      stateManager.setUserState(telegramId, AdminState.SIM_INTERACTIONS_SELECTING);
      stateManager.setUserTempData(telegramId, {
        simInteractionDevices: refreshedDevices,
        selectedSimInteractionDeviceId: undefined,
      });

      await bot.sendMessage(chatId, "✅ СИМ успешно удален.");
      await sendSimSelectionMessage(chatId, refreshedDevices);
      return;
    }

    if (
      currentState === AdminState.ADMIN_EDIT_COURIERS_SELECTING ||
      currentState === AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING
    ) {
      const isSuperadmin = currentState === AdminState.SUPERADMIN_EDIT_COURIERS_SELECTING;
      const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const couriers = tempData.editCouriers;

      if (!couriers?.length) {
        const restoredState = restoreToAuthenticatedWithAdminContext(
          telegramId,
          tempData,
          tempData.editCouriersReturnState,
        );
        await bot.sendMessage(
          chatId,
          `❌ Что-то пошло не так. Запустите ${isSuperadmin ? "/superadmin_edit_couriers" : "/admin_edit_couriers"} заново.`,
        );
        await sendAdminCommandsIfNeeded(
          chatId,
          tempData.adminPermissionsLevel,
          restoredState,
        );
        return;
      }

      if (!/^\d+$/.test(text.trim())) {
        await bot.sendMessage(
          chatId,
          "❌ Введите корректный номер курьера из списка.",
        );
        return;
      }

      const index = parseInt(text.trim(), 10) - 1;
      if (index < 0 || index >= couriers.length) {
        await bot.sendMessage(
          chatId,
          "❌ Курьер с таким номером не найден. Введите номер из списка.",
        );
        return;
      }

      const selectedCourier = couriers[index];
      const nextState = isSuperadmin
        ? AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
        : AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING;

      stateManager.setUserState(telegramId, nextState);
      stateManager.setUserTempData(telegramId, {
        selectedEditCourierId: selectedCourier.id,
      });

      await sendCourierActionsMessage(chatId, selectedCourier, isSuperadmin);
      return;
    }

    if (
      currentState === AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING ||
      currentState === AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
    ) {
      const isSuperadmin = currentState === AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING;
      const statusCmd = isSuperadmin ? "/superadmin_edit_courier_status" : "/admin_edit_courier_status";
      const historyCmd = isSuperadmin ? "/superadmin_courier_history" : "/admin_courier_history";
      await bot.sendMessage(
        chatId,
        `ℹ️ Выберите действие командой: ${statusCmd} или ${historyCmd}.\n\n/cancel - вернуться к списку курьеров.`,
      );
      return;
    }

    if (
      currentState === AdminState.ADMIN_EDIT_COURIER_AWAITING_STATUS ||
      currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS
    ) {
      const isSuperadmin = currentState === AdminState.SUPERADMIN_EDIT_COURIER_AWAITING_STATUS;
      const status = parseAdminStatusInput(text);
      if (status === null) {
        await bot.sendMessage(
          chatId,
          "❌ Некорректный выбор статуса. Введите 1 (Активный) или 2 (Отключен).",
        );
        return;
      }

      const commandHint = isSuperadmin ? "/superadmin_edit_couriers" : "/admin_edit_couriers";
      const resolved = await tryResolveSelectedEditCourier(telegramId, chatId, commandHint);
      if (!resolved) {
        return;
      }

      const updated = await courierRepository.updateActiveStatus(resolved.courier.id, status);
      if (!updated) {
        await bot.sendMessage(
          chatId,
          "❌ Не удалось изменить статус курьера.",
        );
        return;
      }

      const refreshedRow = await courierRepository.findById(resolved.courier.id);
      if (!refreshedRow) {
        await bot.sendMessage(
          chatId,
          `❌ Курьер не найден. Запустите ${commandHint} заново.`,
        );
        return;
      }

      const refreshedCourier: EditableCourierSessionItem = {
        id: refreshedRow.id,
        fullName: refreshedRow.full_name,
        nickname: refreshedRow.nickname,
        phoneNumber: refreshedRow.phone_number,
        warehouseId: refreshedRow.warehouse_id,
        isActive: refreshedRow.is_active,
      };

      const tempData = stateManager.getUserTempData<AdminSessionData>(telegramId) || {};
      const updatedList = (tempData.editCouriers || []).map((c) =>
        c.id === refreshedCourier.id ? refreshedCourier : c,
      );

      const nextState = isSuperadmin
        ? AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
        : AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING;

      stateManager.setUserState(telegramId, nextState);
      stateManager.setUserTempData(telegramId, {
        editCouriers: updatedList,
      });

      await bot.sendMessage(
        chatId,
        `✅ Статус курьера изменен на <b>${refreshedCourier.isActive ? "Активный" : "Отключен"}</b>.`,
        { parse_mode: "HTML" },
      );
      await sendCourierActionsMessage(chatId, refreshedCourier, isSuperadmin);
      return;
    }

    if (
      currentState === AdminState.ADMIN_COURIER_HISTORY_AWAITING_FULL ||
      currentState === AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL
    ) {
      const isSuperadmin = currentState === AdminState.SUPERADMIN_COURIER_HISTORY_AWAITING_FULL;
      const normalized = text.trim();

      if (normalized.toLowerCase() === "нет") {
        const commandHint = isSuperadmin ? "/superadmin_edit_couriers" : "/admin_edit_couriers";
        const resolved = await tryResolveSelectedEditCourier(telegramId, chatId, commandHint);
        const nextState = isSuperadmin
          ? AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
          : AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING;
        stateManager.setUserState(telegramId, nextState);
        if (resolved) {
          await sendCourierActionsMessage(chatId, resolved.courier, isSuperadmin);
        }
        return;
      }

      if (normalized !== "ДА") {
        await bot.sendMessage(
          chatId,
          "❌ Некорректный ввод. Напишите ДА для полной истории или /cancel для возврата.",
        );
        return;
      }

      const commandHint = isSuperadmin ? "/superadmin_edit_couriers" : "/admin_edit_couriers";
      const resolved = await tryResolveSelectedEditCourier(telegramId, chatId, commandHint);
      if (!resolved) {
        return;
      }

      const fullHistory = await sessionRepository.getHistoryByCourier(resolved.courier.id);
      const nextState = isSuperadmin
        ? AdminState.SUPERADMIN_EDIT_COURIER_ACTION_SELECTING
        : AdminState.ADMIN_EDIT_COURIER_ACTION_SELECTING;
      stateManager.setUserState(telegramId, nextState);

      if (!fullHistory.length) {
        await bot.sendMessage(
          chatId,
          `История сессий курьера <b>${escapeHtml(resolved.courier.fullName)}</b> пуста.`,
          { parse_mode: "HTML" },
        );
      } else {
        const historyText = formatCourierHistoryRows(fullHistory);
        await bot.sendMessage(
          chatId,
          `Полная история сессий курьера <b>${escapeHtml(resolved.courier.fullName)}</b>:\n\n${historyText}`,
          { parse_mode: "HTML" },
        );
      }

      await sendCourierActionsMessage(chatId, resolved.courier, isSuperadmin);
      return;
    }

    const passwordValidation = adminService.validatePassword(text);
    if (!passwordValidation.isValid) {
      await bot.sendMessage(
        chatId,
        "Пароль не соответствует требованиям.\nПридумайте и введите пароль. Требования - не менее 6 символов.",
      );
      return;
    }

    const tempData = stateManager.getUserTempData<{
      adminRegisterLogin?: string;
    }>(telegramId);
    const adminRegisterLogin = tempData?.adminRegisterLogin;

    if (!adminRegisterLogin) {
      await startAdminRegistrationFlow(chatId, telegramId);
      return;
    }

    const registrationResult = await adminService.registerPendingAdmin(
      adminRegisterLogin,
      text,
    );
    if (!registrationResult.success) {
      if (registrationResult.duplicateInsensitive) {
        await bot.sendMessage(
          chatId,
          "Логин уже занят (без учета регистра). Выберите другой.\n\nПридумайте и введите логин",
        );
        stateManager.setUserState(
          telegramId,
          AdminState.REGISTER_AWAITING_LOGIN,
        );
        stateManager.resetUserTempData(telegramId);
        return;
      }

      await bot.sendMessage(
        chatId,
        "❌ Не удалось зарегистрировать администратора. Попробуйте позже.",
      );
      return;
    }

    stateManager.setUserState(telegramId, AdminState.GUEST_MODE);
    stateManager.resetUserTempData(telegramId);

    await bot.sendMessage(
      chatId,
      "✅ Заявка администратора создана. Ожидайте одобрения суперадминистратором.\n\n🛡 Вы по-прежнему в админском режиме. Доступны: /admin_login, /admin_register, /admin_logout, /exit_admin.",
    );
  });
}
