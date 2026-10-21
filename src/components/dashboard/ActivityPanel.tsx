import { Link } from "react-router-dom";

import { fetchActivity } from "../../api/client";
import { useAuth } from "../../auth/context";
import { useApiResource } from "../../hooks/useApiResource";
import { useI18n } from "../../i18n/context";
import ActivityItem from "../activity/ActivityItem";
import Icon from "../ui/Icon";
import StateMessage from "../ui/StateMessage";

const RECENT_COUNT = 5;

function RecentActivity() {
  const { t } = useI18n();
  const { state, reload } = useApiResource("dashboard-activity", (token, signal) =>
    fetchActivity(token, { page: 1, pageSize: RECENT_COUNT }, signal)
  );

  if (state.status === "loading") {
    return (
      <div className="ah-loading" aria-busy="true">
        <p className="ah-sr-only" role="status">
          {t("activityFeed.loading")}
        </p>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="ah-skeleton-row">
            <span className="ah-skeleton ah-skeleton--text" />
          </div>
        ))}
      </div>
    );
  }

  if (state.status === "forbidden") {
    return (
      <StateMessage icon="lock" tone="warning" title={t("activityFeed.deniedTitle")} compact>
        {t("activityFeed.apiDeniedBody", { detail: state.detail })}
      </StateMessage>
    );
  }

  if (state.status === "error") {
    return (
      <StateMessage
        icon="alert"
        tone="danger"
        title={t("activityFeed.errorTitle")}
        role="alert"
        compact
        action={
          <button type="button" className="ah-btn ah-btn--secondary" onClick={reload}>
            {t("common.tryAgain")}
          </button>
        }
      >
        {state.reason === "network" ? t("activityFeed.errorNetwork") : t("activityFeed.errorServer")}
      </StateMessage>
    );
  }

  if (state.data.events.length === 0) {
    return (
      <StateMessage icon="activity" title={t("activityFeed.emptyTitle")} compact>
        {t("activityFeed.emptyBody")}
      </StateMessage>
    );
  }

  return (
    <ol className="ah-feed__list ah-feed__list--compact">
      {state.data.events.map((event) => (
        <ActivityItem key={event.id} event={event} withDate />
      ))}
    </ol>
  );
}

/** The latest recorded events, for people allowed to read activity. */
function ActivityPanel() {
  const { can } = useAuth();
  const { t } = useI18n();
  const allowed = can("activity:read");

  return (
    <section className="ah-panel ah-panel--activity" aria-labelledby="activity-title">
      <div className="ah-panel__header">
        <div>
          <h2 id="activity-title" className="ah-panel__title">
            {t("activity.title")}
          </h2>
          <p className="ah-panel__description">{t("activity.description")}</p>
        </div>
        {allowed && (
          <div className="ah-panel__actions">
            <Link to="/activity" className="ah-btn ah-btn--secondary ah-btn--small">
              {t("activity.viewAll")}
              <Icon name="chevronRight" size={14} />
            </Link>
          </div>
        )}
      </div>

      {allowed ? (
        <RecentActivity />
      ) : (
        <StateMessage icon="lock" title={t("activity.noAccessTitle")}>
          {t("activity.noAccessBody")}
        </StateMessage>
      )}
    </section>
  );
}

export default ActivityPanel;
