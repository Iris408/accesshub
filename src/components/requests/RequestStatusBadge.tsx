import type { AccessRequestStatus } from "../../api/client";
import { useI18n } from "../../i18n/context";
import Icon, { type IconName } from "../ui/Icon";
import { STATUS_LABELS } from "./requestLabels";

const ICONS: Record<AccessRequestStatus, IconName> = {
  pending: "clock",
  approved: "check",
  declined: "close",
};

const TONES: Record<AccessRequestStatus, string> = {
  pending: "denied",
  approved: "success",
  declined: "failure",
};

/** Status with an icon and text, never colour alone. */
function RequestStatusBadge({ status }: { status: AccessRequestStatus }) {
  const { t } = useI18n();

  return (
    <span className={`ah-outcome ah-outcome--${TONES[status] ?? "unknown"}`}>
      <Icon name={ICONS[status] ?? "clock"} size={14} />
      {STATUS_LABELS[status] ? t(STATUS_LABELS[status]) : status}
    </span>
  );
}

export default RequestStatusBadge;
