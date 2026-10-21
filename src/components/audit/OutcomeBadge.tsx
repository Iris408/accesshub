import type { AuditOutcome } from "../../api/client";
import { useI18n } from "../../i18n/context";
import Icon, { type IconName } from "../ui/Icon";
import { OUTCOME_LABELS } from "./auditLabels";

const ICONS: Record<AuditOutcome, IconName> = {
  success: "check",
  failure: "alert",
  denied: "lock",
};

/** Outcome with an icon and text, never colour alone. */
function OutcomeBadge({ outcome }: { outcome: AuditOutcome }) {
  const { t } = useI18n();
  const known = outcome in OUTCOME_LABELS;

  return (
    <span className={`ah-outcome ah-outcome--${known ? outcome : "unknown"}`}>
      {known && <Icon name={ICONS[outcome]} size={14} />}
      {known ? t(OUTCOME_LABELS[outcome]) : outcome}
    </span>
  );
}

export default OutcomeBadge;
