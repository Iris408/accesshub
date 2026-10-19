import type { MessageKey } from "../../i18n/messages/en";

export type ProjectLink = {
  label: MessageKey;
  href: string;
};

// Verified destinations (all public). The API link is the Swagger UI of the
// deployed backend that this frontend calls.
export const PROJECT_LINKS: ProjectLink[] = [
  { label: "footer.github", href: "https://github.com/Iris408/accesshub" },
  { label: "footer.api", href: "https://mini-user-api.onrender.com/docs" },
  { label: "footer.docs", href: "https://github.com/Iris408/accesshub/tree/main/docs" },
];
