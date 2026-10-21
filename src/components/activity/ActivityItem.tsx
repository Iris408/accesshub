import type { ActivityEvent } from "../../api/client";
import { useI18n } from "../../i18n/context";
import { EVENT_LABELS, REASON_LABELS } from "../audit/auditLabels";
import OutcomeBadge from "../audit/OutcomeBadge";
import Icon, { type IconName } from "../ui/Icon";

const OUTCOME_ICONS: Record<string, IconName> = {
  success: "check",
  failure: "close",
  denied: "lock",
};

type ActivityItemProps = {
  event: ActivityEvent;
  /** Show the date as well as the time (when items aren't grouped by day). */
  withDate?: boolean;
  onDetails?: (event: ActivityEvent) => void;
};

/** One scannable line of the activity feed. */
function ActivityItem({ event, withDate = false, onDetails }: ActivityItemProps) {
  const { t, roleName, formatTime, formatDateTime } = useI18n();
  const reason = event.details.reason;
  const when = new Date(event.occurred_at);
  const label = EVENT_LABELS[event.event_type] ? t(EVENT_LABELS[event.event_type]) : event.event_type;

  const target = event.target
    ? event.target.type === "role"
      ? t("audit.roleTarget", { role: roleName(event.target.username) })
      : event.target.username
    : null;

  return (
    <li className="ah-feed__item">
      <span className={`ah-feed__icon is-${event.outcome}`} aria-hidden="true">
        <Icon name={OUTCOME_ICONS[event.outcome] ?? "activity"} size={16} />
      </span>

      <div className="ah-feed__body">
        <p className="ah-feed__title">
          <span className="ah-feed__event">{label}</span>
          <OutcomeBadge outcome={event.outcome} />
        </p>
        <p className="ah-feed__meta">
          <span>
            {event.actor
              ? t("activityFeed.by", { name: event.actor.username })
              : t("audit.anonymous")}
          </span>
          {target && target !== event.actor?.username && (
            <span>{t("activityFeed.on", { name: target })}</span>
          )}
          {typeof reason === "string" && (
            <span>{REASON_LABELS[reason] ? t(REASON_LABELS[reason]) : reason}</span>
          )}
        </p>
      </div>

      <time className="ah-feed__time" dateTime={event.occurred_at}>
        {withDate ? formatDateTime(when) : formatTime(when)}
      </time>

      {onDetails && (
        <button
          type="button"
          className="ah-btn ah-btn--secondary ah-btn--small ah-feed__details"
          aria-label={t("audit.viewDetails", { id: event.id })}
          onClick={(clicked) => {
            clicked.currentTarget.focus();
            onDetails(event);
          }}
        >
          {t("audit.details")}
        </button>
      )}
    </li>
  );
}

export default ActivityItem;
