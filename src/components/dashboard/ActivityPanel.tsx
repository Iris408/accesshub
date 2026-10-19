import { useI18n } from "../../i18n/context";
import StateMessage from "../ui/StateMessage";

/**
 * Placeholder until the API exposes sign-in / audit events. Deliberately shows
 * no sample events so nothing reads as live data.
 */
function ActivityPanel() {
  const { t } = useI18n();

  return (
    <section className="ah-panel ah-panel--activity" aria-labelledby="activity-title">
      <div className="ah-panel__header">
        <div>
          <h2 id="activity-title" className="ah-panel__title">
            {t("activity.title")}
          </h2>
          <p className="ah-panel__description">{t("activity.description")}</p>
        </div>
        <span className="ah-chip">{t("activity.notConnected")}</span>
      </div>

      <StateMessage icon="activity" title={t("activity.unavailableTitle")}>
        {t("activity.unavailableBody")}
      </StateMessage>
    </section>
  );
}

export default ActivityPanel;
