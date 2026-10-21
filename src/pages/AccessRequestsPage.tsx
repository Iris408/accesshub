import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchAccessRequestSummary,
  fetchMyAccessRequests,
  type AccessRequest,
} from "../api/client";
import { useAuth } from "../auth/context";
import { isAdminRole } from "../auth/roles";
import MyRequests from "../components/requests/MyRequests";
import NewRequestsBox from "../components/requests/NewRequestsBox";
import RequestForm from "../components/requests/RequestForm";
import RequestQueue from "../components/requests/RequestQueue";
import ReviewDialog from "../components/requests/ReviewDialog";
import Icon from "../components/ui/Icon";
import PageHeader from "../components/ui/PageHeader";
import StateMessage from "../components/ui/StateMessage";
import { useApiResource } from "../hooks/useApiResource";
import { useI18n } from "../i18n/context";

const MY_REQUESTS_LIMIT = 50;

function ReviewerSection({ version, onOpen }: { version: number; onOpen: (r: AccessRequest) => void }) {
  const queueHeadingRef = useRef<HTMLHeadingElement>(null);
  const [preset, setPreset] = useState<{ nonce: number; pendingOnly: boolean }>({
    nonce: 0,
    pendingOnly: false,
  });

  const summary = useApiResource(`summary:${version}`, (token, signal) =>
    fetchAccessRequestSummary(token, signal)
  );

  useEffect(() => {
    if (preset.nonce > 0) queueHeadingRef.current?.focus();
  }, [preset]);

  return (
    <>
      <NewRequestsBox
        state={summary.state}
        onReview={onOpen}
        onRetry={summary.reload}
        onViewAll={() => setPreset((current) => ({ nonce: current.nonce + 1, pendingOnly: true }))}
      />
      <RequestQueue
        key={preset.nonce}
        ref={queueHeadingRef}
        version={version}
        initialStatus={preset.pendingOnly ? "pending" : undefined}
        onOpen={onOpen}
      />
    </>
  );
}

function RequesterSection({ version, onSubmitted }: { version: number; onSubmitted: () => void }) {
  const mine = useApiResource(`mine:${version}`, (token, signal) =>
    fetchMyAccessRequests(token, 1, MY_REQUESTS_LIMIT, signal)
  );
  const pending =
    mine.state.status === "ready"
      ? mine.state.data.requests.find((request) => request.status === "pending")
      : undefined;

  return (
    <div className="ah-requests-grid">
      <RequestForm pending={pending} onSubmitted={onSubmitted} />
      <MyRequests state={mine.state} onRetry={mine.reload} />
    </div>
  );
}

/**
 * Own history for someone who can no longer submit (e.g. a Member whose
 * request for Viewer / Auditor was approved). Hidden when there is none.
 */
function HistorySection({ version }: { version: number }) {
  const mine = useApiResource(`history:${version}`, (token, signal) =>
    fetchMyAccessRequests(token, 1, MY_REQUESTS_LIMIT, signal)
  );
  if (mine.state.status !== "ready" || mine.state.data.requests.length === 0) return null;
  return <MyRequests state={mine.state} onRetry={mine.reload} />;
}

/**
 * Access requests. Reviewers (Manager, Admin) see new requests and the full
 * queue; requesters (Member, Manager) can ask for a different role. What each
 * person sees follows their permissions from the API, which enforces them.
 */
function AccessRequestsPage() {
  const { user, can } = useAuth();
  const { t, roleName } = useI18n();
  const canReview = can("access_requests:review");
  // Admins already have full access; the API refuses their requests.
  const canSubmit = can("access_requests:submit") && !isAdminRole(user?.role);

  const [version, setVersion] = useState(0);
  const [reviewing, setReviewing] = useState<AccessRequest | null>(null);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(() => setVersion((current) => current + 1), []);
  const open = useCallback((request: AccessRequest) => {
    setNotice("");
    setReviewing(request);
  }, []);

  return (
    <>
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={t("requests.title")}
        description={
          canReview
            ? t("requests.descriptionReviewer")
            : canSubmit
              ? t("requests.descriptionMember")
              : undefined
        }
      />

      <div className="ah-notice-region" role="status">
        {notice && (
          <div className="ah-notice ah-requests__notice">
            <Icon name="check" size={18} className="ah-notice__icon" />
            <span className="ah-notice__text">{notice}</span>
            <button
              type="button"
              className="ah-icon-btn ah-notice__close"
              onClick={() => setNotice("")}
              aria-label={t("common.dismiss")}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>

      {!canReview && !canSubmit && (
        <section className="ah-panel">
          <StateMessage icon="lock" tone="warning" title={t("requests.deniedTitle")}>
            {t("requests.deniedBody")}
          </StateMessage>
        </section>
      )}

      {!canReview && !canSubmit && (
        <div className="ah-requests-page">
          <HistorySection version={version} />
        </div>
      )}

      <div className="ah-requests-page">
        {canReview && <ReviewerSection version={version} onOpen={open} />}

        {canSubmit && (
          <RequesterSection
            version={version}
            onSubmitted={() => {
              setNotice(t("requests.submitted"));
              refresh();
            }}
          />
        )}
      </div>

      {reviewing && (
        <ReviewDialog
          request={reviewing}
          onClose={() => setReviewing(null)}
          onDecided={({ request }) => {
            // Refresh both after a decision and when it turned out to be stale.
            refresh();
            if (!request) return;
            setReviewing(null);
            setNotice(
              request.status === "approved"
                ? t("requests.approvedNotice", {
                    name: request.requester.username,
                    role: roleName(request.requested_role),
                  })
                : t("requests.declinedNotice", { name: request.requester.username })
            );
          }}
        />
      )}
    </>
  );
}

export default AccessRequestsPage;
