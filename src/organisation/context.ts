import { createContext, useContext } from "react";

import type { OrganisationSummary } from "../api/client";

/** Used until GET /organisation answers (and if it can't): today's behaviour. */
export const DEFAULT_ORGANISATION: OrganisationSummary = {
  organisation_name: null,
  timezone: null,
  access_requests: { enabled: true, requestable_roles: ["manager", "member", "viewer"] },
};

export type OrganisationContextValue = {
  organisation: OrganisationSummary;
  /** Re-read the organisation settings (e.g. after an Admin saves them). */
  refreshOrganisation: () => void;
};

export const OrganisationContext = createContext<OrganisationContextValue>({
  organisation: DEFAULT_ORGANISATION,
  refreshOrganisation: () => {},
});

export function useOrganisation(): OrganisationContextValue {
  return useContext(OrganisationContext);
}
