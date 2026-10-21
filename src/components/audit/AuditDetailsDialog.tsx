import { useRef, type ReactNode } from "react";

import type { ActivityEvent, AuditEvent } from "../../api/client";
import { useI18n } from "../../i18n/context";
import Dialog from "../ui/Dialog";
import {
  CODE_DETAIL_KEYS,
  DETAIL_LABELS,
  EVENT_LABELS,
  METHOD_LABELS,
  REASON_LABELS,
  PERMISSION_LIST_DETAIL_KEYS,
  ROLE_DETAIL_KEYS,
  SETTING_LABELS,
} from "./auditLabels";
import { PERMISSION_LABELS } from "../roles/permissionLabels";
import OutcomeBadge from "./OutcomeBadge";

type AuditDetailsDialogProps = {
  /** An audit event, or the smaller activity projection of one. */
  event: AuditEvent | ActivityEvent;
  onClose: () => void;
};

/** Read-only view of every recorded field of one audit event. */
function AuditDetailsDialog({ event, onClose }: AuditDetailsDialogProps) {
  const { t, tp, roleName, formatFullDateTime, formatList } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);

  function person(
    value: { id?: number | null; username: string | null; role?: string | null; type?: string } | null
  ) {
    if (!value?.username) return t("audit.anonymous");
    // A role (e.g. permission changes) rather than an account.
    if (value.type === "role") return t("audit.roleTarget", { role: roleName(value.username) });

    const parts = [value.username];
    if (value.role) parts.push(roleName(value.role));
    // Activity items carry no IDs; audit events do.
    if (value.id != null) parts.push(`#${value.id}`);
    return parts.join(" · ");
  }

  /** A settings.changed value, in words for the setting it belongs to. */
  function settingValue(text: string): ReactNode {
    const setting = event.details.setting;
    if (text === "") return t("audit.notSet");
    if (setting === "access_requests_enabled") return text === "on" ? t("audit.on") : t("audit.off");
    if (setting === "requestable_roles") return formatList(text.split(",").map((role) => roleName(role)));
    if (setting === "session_minutes") return tp("settings.session.minutes", Number(text), { count: Number(text) });
    return text;
  }

  function detailValue(key: string, value: string | number | boolean | null): ReactNode {
    if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
    if (value === null) return "—";

    const text = String(value);

    if (ROLE_DETAIL_KEYS.has(key)) return roleName(text);
    if (key === "setting") return SETTING_LABELS[text] ? t(SETTING_LABELS[text]) : text;
    if (key === "from_value" || key === "to_value") return settingValue(text);
    if (PERMISSION_LIST_DETAIL_KEYS.has(key)) {
      const codes = text.split(",").filter(Boolean);
      if (codes.length === 0) return t("audit.noPermissions");
      return formatList(
        codes.map((code) => (PERMISSION_LABELS[code] ? t(PERMISSION_LABELS[code].label) : code))
      );
    }
    if (key === "reason" && REASON_LABELS[text]) return t(REASON_LABELS[text]);
    if (key === "method" && METHOD_LABELS[text]) return t(METHOD_LABELS[text]);
    if (CODE_DETAIL_KEYS.has(key) || key === "reason" || key === "method") {
      return <code className="ah-mono">{text}</code>;
    }
    return text;
  }

  const rows: Array<[string, ReactNode]> = [
    [t("audit.field.eventId"), <code className="ah-mono">#{event.id}</code>],
    [
      t("audit.field.time"),
      <time dateTime={event.occurred_at}>{formatFullDateTime(new Date(event.occurred_at))}</time>,
    ],
    [
      t("audit.field.event"),
      EVENT_LABELS[event.event_type] ? t(EVENT_LABELS[event.event_type]) : event.event_type,
    ],
    [t("audit.field.outcome"), <OutcomeBadge outcome={event.outcome} />],
    [t("audit.field.actor"), person(event.actor)],
    [t("audit.field.target"), event.target ? person(event.target) : "—"],
    ...Object.entries(event.details).map(
      ([key, value]): [string, ReactNode] => [
        DETAIL_LABELS[key] ? t(DETAIL_LABELS[key]) : key,
        detailValue(key, value),
      ]
    ),
  ];

  return (
    <Dialog
      title={t("audit.detailsTitle", { id: event.id })}
      icon="fileText"
      onClose={onClose}
      initialFocusRef={closeRef}
      footer={
        <button ref={closeRef} type="button" className="ah-btn ah-btn--secondary" onClick={onClose}>
          {t("common.close")}
        </button>
      }
    >
      <dl className="ah-detail-list">
        {rows.map(([label, value]) => (
          <div key={label} className="ah-detail-list__row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

export default AuditDetailsDialog;
