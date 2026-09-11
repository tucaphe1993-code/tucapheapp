import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE_ORDER"
  | "UPDATE_ORDER"
  | "CANCEL_ORDER"
  | "ASSIGN_TASK"
  | "START_TASK"
  | "COMPLETE_TASK"
  | "UPLOAD_REPORT_IMAGE"
  | "ISSUE_INVENTORY"
  | "RECEIVE_INVENTORY"
  | "ADJUST_INVENTORY"
  | "CREATE_USER"
  | "UPDATE_USER"
  | "CREATE_CUSTOMER"
  | "UPDATE_CUSTOMER"
  | "DELETE_CUSTOMER"
  | "CREATE_PRODUCT"
  | "UPDATE_PRODUCT"
  | "CREATE_VARIANT"
  | "UPDATE_VARIANT"
  | "SET_CUSTOMER_PRICE"
  | "REMOVE_CUSTOMER_PRICE"
  | "RECORD_PAYMENT"
  | "UPDATE_PAYMENT_DUE_DATE"
  | "CREATE_INSTALLATION"
  | "SCHEDULE_INSTALLATION"
  | "START_INSTALLATION"
  | "UPDATE_INSTALLATION_CHECKLIST"
  | "COMPLETE_INSTALLATION"
  | "HANDOVER_INSTALLATION"
  | "RECEIVE_DEVICE"
  | "UPDATE_DEVICE"
  | "SELL_DEVICE"
  | "RELEASE_DEVICE"
  | "CREATE_PROTOCOL"
  | "UPDATE_PROTOCOL"
  | "UPDATE_PROTOCOL_CHECKLIST"
  | "START_PROTOCOL_INSTALL"
  | "SUBMIT_PROTOCOL_FOR_CONFIRMATION"
  | "SIGN_PROTOCOL"
  | "HANDOVER_PROTOCOL"
  | "ACTIVATE_PROTOCOL_WARRANTY"
  | "COMPLETE_PROTOCOL";

export async function writeAuditLog(params: {
  userId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, metadata) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      newId(),
      params.userId,
      params.action,
      params.entity,
      params.entityId ?? null,
      params.metadata ? JSON.stringify(params.metadata) : null
    )
    .run();
}
