import type { AccessRequest, AccessRequestSummary } from "../../api/client";
import type { ResourceState } from "../../hooks/useApiResource";
import { useI18n } from "../../i18n/context";
import Icon from "../ui/Icon";
import RoleBadge from "../ui/RoleBadge";
import StateMessage from "../ui/StateMessage";

type NewRequestsBoxProps = {
  state: ResourceState<AccessRequestSummary>;
  onReview: (request: AccessRequest) => void;
  onViewAll: () => void;
  onRetry: () => void;
};

/** Prominent pending-request count and the newest requests waiting for review. */
function NewRequestsBox({ state, onReview, onViewAll, onRetry }: NewRequestsBoxProps) {
  const { t, tp, formatNumber, formatDateTime } = useI18n();
  const summary = state.status === "ready" ? state.data : null;

  return (
    <section className="ah-panel ah-new-requests" aria-labelledby="new-requests-title">
      <div className="ah-panel__header">
        <div>
          <h2 id="new-requests-title" className="ah-panel__title">
            {t("requests.newTitle")}
          </h2>
          <p className="ah-panel__description">{t("requests.newDescription")}</p>
        </div>
        {summary && summary.pending_total > 0 && (
          <div className="ah-panel__actions">
            <button type="button" className="ah-btn ah-btn--secondary" onClick={onViewAll}>
              {t("requests.viewAllPending")}
            </button>
          </div>
        )}
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
          compact
          action={
            <button type="button" className="ah-btn ah-btn--secondary" onClick={onRetry}>
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

      {summary && (
        <div className="ah-new-requests__body">
          <p className="ah-new-requests__count" aria-live="polite">
            <span className="ah-new-requests__number">{formatNumber(summary.pending_total)}</span>
            <span>{tp("requests.pendingCount", summary.pending_total, {})}</span>
          </p>

          {summary.recent.length === 0 ? (
            <StateMessage icon="check" title={t("requests.noneWaitingTitle")} compact>
              {t("requests.noneWaitingBody")}
            </StateMessage>
          ) : (
            <ul className="ah-new-requests__list">
              {summary.recent.map((request) => (
                <li key={request.id} className="ah-new-requests__item">
                  <span className="ah-new-requests__who">
                    <span className="ah-audit__name">{request.requester.username}</span>
                    {request.is_seed && (
                      <span className="ah-badge ah-badge--demo">
                        {t("users.demoBadge")}
                        <span className="ah-sr-only"> ({t("users.demoBadgeLabel")})</span>
                      </span>
                    )}
                  </span>
                  <span className="ah-new-requests__meta">
                    <RoleBadge role={request.requested_role} />
                    <time dateTime={request.submitted_at}>
                      {formatDateTime(new Date(request.submitted_at))}
                    </time>
                  </span>
                  <button
                    type="button"
                    className="ah-btn ah-btn--primary ah-btn--small"
                    aria-label={t("requests.reviewFor", { name: request.requester.username })}
                    onClick={(event) => {
                      event.currentTarget.focus();
                      onReview(request);
                    }}
                  >
                    <Icon name="userPlus" size={14} />
                    {t("requests.review")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export default NewRequestsBox;
