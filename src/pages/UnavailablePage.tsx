import { Link } from "react-router-dom";

import type { NavItem } from "../components/layout/navigation";
import PageHeader from "../components/ui/PageHeader";
import StateMessage from "../components/ui/StateMessage";
import { useI18n } from "../i18n/context";

type UnavailablePageProps = {
  item: NavItem;
};

/** Destination for sidebar sections the API doesn't support yet. */
function UnavailablePage({ item }: UnavailablePageProps) {
  const { t } = useI18n();
  const label = t(`nav.${item.id}.label`);

  return (
    <>
      <PageHeader
        eyebrow={t("unavailable.eyebrow")}
        title={label}
        description={t(`nav.${item.id}.description`)}
      />

      <section className="ah-panel">
        <StateMessage
          icon="clock"
          title={t("unavailable.title", { section: label })}
          action={
            <Link to="/dashboard" className="ah-btn ah-btn--secondary">
              {t("common.backToDashboard")}
            </Link>
          }
        >
          {t("unavailable.body")}
        </StateMessage>
      </section>
    </>
  );
}

export default UnavailablePage;
