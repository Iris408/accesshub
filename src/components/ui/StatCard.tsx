import type { ReactNode } from "react";

import Icon, { type IconName } from "./Icon";

export type StatTone = "blue" | "green" | "violet" | "amber";

type StatCardProps = {
  label: string;
  value?: ReactNode;
  detail?: ReactNode;
  icon: IconName;
  tone?: StatTone;
  loading?: boolean;
};

function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "blue",
  loading = false,
}: StatCardProps) {
  return (
    <div className="ah-stat" aria-busy={loading || undefined}>
      <span className={`ah-stat__icon ah-stat__icon--${tone}`}>
        <Icon name={icon} size={22} />
      </span>

      <dl className="ah-stat__body">
        <dt className="ah-stat__label">{label}</dt>
        <dd className="ah-stat__value">
          {loading ? <span className="ah-skeleton ah-skeleton--value" /> : value}
        </dd>
        {detail && !loading && <dd className="ah-stat__detail">{detail}</dd>}
      </dl>
    </div>
  );
}

export default StatCard;
