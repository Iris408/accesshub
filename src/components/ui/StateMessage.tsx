import type { ReactNode } from "react";

import Icon, { type IconName } from "./Icon";

type StateMessageProps = {
  icon: IconName;
  title: string;
  children?: ReactNode;
  tone?: "neutral" | "danger" | "warning";
  action?: ReactNode;
  /** Use "alert" for errors so assistive tech announces them. */
  role?: "alert" | "status";
  compact?: boolean;
};

/** Shared layout for empty, error and access-denied states. */
function StateMessage({
  icon,
  title,
  children,
  tone = "neutral",
  action,
  role,
  compact = false,
}: StateMessageProps) {
  return (
    <div
      className={`ah-state ah-state--${tone}${compact ? " ah-state--compact" : ""}`}
      role={role}
    >
      <span className="ah-state__icon">
        <Icon name={icon} size={compact ? 20 : 24} />
      </span>
      <p className="ah-state__title">{title}</p>
      {children && <div className="ah-state__body">{children}</div>}
      {action && <div className="ah-state__action">{action}</div>}
    </div>
  );
}

export default StateMessage;
