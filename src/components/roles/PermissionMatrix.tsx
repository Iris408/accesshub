import type { PermissionLockReason, RolePermissionMatrix } from "../../api/client";
import { useI18n } from "../../i18n/context";
import Icon from "../ui/Icon";
import { LOCK_LABELS, PERMISSION_LABELS } from "./permissionLabels";

type PermissionMatrixProps = {
  matrix: RolePermissionMatrix;
  /** Effective value of a cell, including unsaved changes. */
  valueOf: (permission: string, role: string) => boolean;
  isChanged: (permission: string, role: string) => boolean;
  onToggle: (permission: string, role: string, granted: boolean) => void;
  disabled: boolean;
  /** Rule number shown beside locked cells (matches the protected rules list). */
  ruleNumber: (reason: PermissionLockReason) => number;
  idPrefix: string;
};

/** Capabilities as rows, roles as columns; checkboxes for editable cells. */
function PermissionMatrix({
  matrix,
  valueOf,
  isChanged,
  onToggle,
  disabled,
  ruleNumber,
  idPrefix,
}: PermissionMatrixProps) {
  const { t, roleName } = useI18n();

  return (
    <div className="ah-table-scroll ah-perm-matrix" role="region" aria-label={t("roles.caption")} tabIndex={0}>
      <table className="ah-table">
        <caption className="ah-sr-only">{t("roles.caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("roles.columnCapability")}</th>
            {matrix.roles.map((role) => (
              <th key={role} scope="col" className="ah-perm-matrix__role">
                {roleName(role)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.permissions.map(({ permission, roles }) => {
            const labels = PERMISSION_LABELS[permission];
            const label = labels ? t(labels.label) : permission;
            const hintId = `${idPrefix}-${permission.replace(/\W/g, "-")}-hint`;

            return (
              <tr key={permission}>
                <th scope="row">
                  <span className="ah-perm-matrix__capability">
                    <span className="ah-perm-matrix__label">{label}</span>
                    {labels && (
                      <span id={hintId} className="ah-perm-matrix__hint">
                        {t(labels.hint)}
                      </span>
                    )}
                    <code className="ah-perm-matrix__code">{permission}</code>
                  </span>
                </th>

                {matrix.roles.map((role) => {
                  const cell = roles[role];
                  if (!cell) return <td key={role} className="ah-perm-matrix__cell">—</td>;

                  const granted = valueOf(permission, role);
                  const changed = isChanged(permission, role);
                  const stateText = granted ? t("roles.granted") : t("roles.notGranted");

                  if (!cell.editable) {
                    const reason = cell.lock_reason ?? "fixed";
                    return (
                      <td key={role} className="ah-perm-matrix__cell is-locked">
                        <span className={`ah-perm-state ${granted ? "is-on" : "is-off"}`}>
                          <Icon name={granted ? "check" : "minus"} size={16} />
                        </span>
                        <span className="ah-perm-matrix__lock" aria-hidden="true">
                          <Icon name="lock" size={12} />
                          {ruleNumber(reason)}
                        </span>
                        <span className="ah-sr-only">
                          {stateText}. {t("roles.lockedBecause", { reason: t(LOCK_LABELS[reason]) })}
                        </span>
                      </td>
                    );
                  }

                  return (
                    <td key={role} className={`ah-perm-matrix__cell${changed ? " is-changed" : ""}`}>
                      <label className="ah-perm-check">
                        <input
                          type="checkbox"
                          checked={granted}
                          disabled={disabled}
                          aria-describedby={labels ? hintId : undefined}
                          aria-label={t("roles.allow", { permission: label, role: roleName(role) })}
                          onChange={(event) => onToggle(permission, role, event.target.checked)}
                        />
                        <span className="ah-perm-check__text" aria-hidden="true">
                          {stateText}
                        </span>
                      </label>
                      {changed && <span className="ah-perm-matrix__changed">{t("roles.unsaved")}</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PermissionMatrix;
