import { Link } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import StateMessage from "../components/ui/StateMessage";
import { useI18n } from "../i18n/context";

function NotFoundPage() {
  const { t } = useI18n();

  return (
    <>
      <PageHeader title={t("notFound.title")} />

      <section className="ah-panel">
        <StateMessage
          icon="search"
          title={t("notFound.heading")}
          action={
            <Link to="/dashboard" className="ah-btn ah-btn--secondary">
              {t("common.backToDashboard")}
            </Link>
          }
        >
          {t("notFound.body")}
        </StateMessage>
      </section>
    </>
  );
}

export default NotFoundPage;
