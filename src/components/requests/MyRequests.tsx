import type { AccessRequest, AccessRequestPage } from "../../api/client";
import type { ResourceState } from "../../hooks/useApiResource";
import { useI18n } from "../../i18n/context";
import Icon from "../ui/Icon";
import RoleBadge from "../ui/RoleBadge";
import StateMessage from "../ui/StateMessage";
import RequestStatusBadge from "./RequestStatusBadge";

type MyRequestsProps = {
  state: ResourceState<AccessRequestPage>;
  onRetry: () => void;
};

function RequestCard({ request }: { request: AccessRequest }) {
  const { t, formatDateTime } = useI18n();

  return (
    <li className="ah-request-card">
      <div className="ah-request-card__head">
        <span className="ah-request-card__role">
          <RoleBadge role={request.requested_role} />
        </span>
        <RequestStatusBadge status={request.status} />
      </div>
      <p className="ah-request-reason">{request.reason}</p>
      <p className="ah-request-card__meta">
        {t("requests.mineSubmitted", { time: formatDateTime(new Date(request.submitted_at)) })}
      </p>
      {request.decision && (
        <div className="ah-request-card__decision">
          <p className="ah-request-card__meta">
            {t("requests.mineDecided", {
              time: formatDateTime(new Date(request.decision.decided_at)),
              name: request.decision.reviewer.username ?? "—",
            })}
          </p>
          {request.decision.note && <p className="ah-request-card__note">{request.decision.note}</p>}
        </div>
      )}
    </li>
  );
}

/** The signed-in user's own current and previous requests. */
function MyRequests({ state, onRetry }: MyRequestsProps) {
  const { t } = useI18n();

  return (
    <section className="ah-panel" aria-labelledby="my-requests-title">
      <div className="ah-panel__header">
        <div>
          <h2 id="my-requests-title" className="ah-panel__title">
            {t("requests.mineTitle")}
          </h2>
          <p className="ah-panel__description">{t("requests.mineDescription")}</p>
        </div>
      </div>

      {state.status === "loading" && (
        <div className="ah-loading" aria-busy="true">
          <p className="ah-sr-only" role="status">
            {t("requests.loading")}
          </p>
          <div className="ah-skeleton ah-skeleton--toolbar" />
        </div>
      )}

      {(state.status === "error" || state.status === "forbidden") && (
        <StateMessage
          icon="alert"
          tone="danger"
          title={t("requests.errorTitle")}
          role="alert"
          action={
            <button type="button" className="ah-btn ah-btn--primary" onClick={onRetry}>
              <Icon name="refresh" size={16} />
              {t("common.tryAgain")}
            </button>
          }
        >
          {state.status === "forbidden"
            ? t("requests.apiDeniedBody", { detail: state.detail })
            : state.reason === "network"
              ? t("requests.errorNetwork")
              : t("requests.errorServer")}
        </StateMessage>
      )}

      {state.status === "ready" &&
        (state.data.requests.length === 0 ? (
          <StateMessage icon="userPlus" title={t("requests.mineEmptyTitle")}>
            {t("requests.mineEmptyBody")}
          </StateMessage>
        ) : (
          <ul className="ah-request-list">
            {state.data.requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </ul>
        ))}
    </section>
  );
}

export default MyRequests;
