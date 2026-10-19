import { useI18n } from "../../i18n/context";

const ROWS = [58, 150, 242];
const USER_TONES = ["strong", "mid", "soft"] as const;

/** Elbow connector from (x1, y1) to (x2, y2), turning at `xMid`. */
function connector(x1: number, y1: number, x2: number, y2: number, xMid: number) {
  const r = Math.min(10, Math.abs(y2 - y1) / 2);

  if (r === 0) return `M${x1} ${y1}H${x2}`;

  const dir = y2 > y1 ? 1 : -1;
  return [
    `M${x1} ${y1}`,
    `H${xMid - r}`,
    `Q${xMid} ${y1} ${xMid} ${y1 + dir * r}`,
    `V${y2 - dir * r}`,
    `Q${xMid} ${y2} ${xMid + r} ${y2}`,
    `H${x2}`,
  ].join(" ");
}

function PersonGlyph({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const s = size / 24;
  return (
    <g transform={`translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})`}>
      <circle cx="12" cy="8" r="4.2" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0z" />
    </g>
  );
}

/**
 * Decorative: people connected to roles, and roles to resources. Colours come
 * from theme tokens so it follows light/dark mode; the role labels use the
 * translated role names.
 */
function AccessIllustration() {
  const { roleName } = useI18n();
  const roles = [
    { label: roleName("admin"), icon: "team" as const },
    { label: roleName("manager"), icon: "shield" as const },
    { label: roleName("viewer"), icon: "person" as const },
  ];

  return (
    <svg
      className="ah-illustration"
      viewBox="0 0 600 320"
      aria-hidden="true"
      focusable="false"
    >
      {/* Kept inside the 600×320 view box so no edge is clipped. */}
      <circle className="ah-illustration__blob" cx="440" cy="160" r="140" />
      <circle className="ah-illustration__blob ah-illustration__blob--soft" cx="320" cy="228" r="88" />

      {/* Connectors: users → roles → resources */}
      <g className="ah-illustration__lines">
        <path d={connector(172, ROWS[0], 220, ROWS[0], 196)} />
        <path d={connector(172, ROWS[1], 220, ROWS[0], 196)} />
        <path d={connector(172, ROWS[1], 220, ROWS[1], 196)} />
        <path d={connector(172, ROWS[2], 220, ROWS[1], 196)} />
        <path d={connector(172, ROWS[2], 220, ROWS[2], 196)} />
        <path d={connector(440, ROWS[0], 492, ROWS[0], 466)} />
        <path d={connector(440, ROWS[0], 492, ROWS[1], 466)} />
        <path d={connector(440, ROWS[1], 492, ROWS[1], 466)} />
        <path d={connector(440, ROWS[1], 492, ROWS[2], 466)} />
      </g>

      {/* People */}
      {ROWS.map((y, index) => (
        <g key={`user-${y}`}>
          <rect className="ah-illustration__card" x="0" y={y - 38} width="172" height="76" rx="12" />
          <circle className={`ah-illustration__avatar ah-illustration__avatar--${USER_TONES[index]}`} cx="40" cy={y} r="24" />
          <g
            className={`ah-illustration__avatar-glyph ah-illustration__avatar-glyph--${USER_TONES[index]}`}
          >
            <PersonGlyph cx={40} cy={y + 2} size={30} />
          </g>
          <rect className="ah-illustration__bar" x="76" y={y - 12} width="72" height="9" rx="4.5" />
          <rect className="ah-illustration__bar ah-illustration__bar--soft" x="76" y={y + 5} width="48" height="9" rx="4.5" />
          <circle className="ah-illustration__dot" cx="172" cy={y} r="4" />
        </g>
      ))}

      {/* Roles */}
      {roles.map((role, index) => {
        const y = ROWS[index];
        return (
          <g key={role.icon}>
            <rect
              className={`ah-illustration__card${index === 0 ? " ah-illustration__card--accent" : ""}`}
              x="220"
              y={y - 28}
              width="220"
              height="56"
              rx="12"
            />
            <g className="ah-illustration__role-icon">
              {role.icon === "team" && (
                <>
                  <PersonGlyph cx={244} cy={y} size={18} />
                  <PersonGlyph cx={256} cy={y - 1} size={20} />
                  <PersonGlyph cx={268} cy={y} size={18} />
                </>
              )}
              {role.icon === "shield" && (
                <>
                  <path d={`M256 ${y - 13}l11 4v8c0 7-5 11-11 14-6-3-11-7-11-14v-8z`} />
                  <path
                    className="ah-illustration__check"
                    d={`M251 ${y + 1}l4 4 7-8`}
                  />
                </>
              )}
              {role.icon === "person" && <PersonGlyph cx={256} cy={y} size={22} />}
            </g>
            <text className="ah-illustration__label" x="286" y={y + 5}>
              {role.label}
            </text>
            <circle className="ah-illustration__dot" cx="220" cy={y} r="4" />
            <circle className="ah-illustration__dot" cx="440" cy={y} r="4" />
          </g>
        );
      })}

      {/* Resources: folder, database, settings */}
      {ROWS.map((y) => (
        <g key={`resource-${y}`}>
          <rect className="ah-illustration__card" x="492" y={y - 32} width="72" height="64" rx="12" />
          <circle className="ah-illustration__dot ah-illustration__dot--muted" cx="492" cy={y} r="4" />
        </g>
      ))}
      <g className="ah-illustration__resource">
        <path d={`M514 ${ROWS[0] - 10}h10l4 5h14a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-26a2 2 0 0 1-2-2v-20a2 2 0 0 1 2-2z`} />
        <g transform={`translate(514 ${ROWS[1] - 14})`}>
          <ellipse cx="14" cy="4" rx="14" ry="4" />
          <path d="M0 8c0 2.2 6.3 4 14 4s14-1.8 14-4v6c0 2.2-6.3 4-14 4S0 16.2 0 14z" />
          <path d="M0 18c0 2.2 6.3 4 14 4s14-1.8 14-4v6c0 2.2-6.3 4-14 4S0 26.2 0 24z" />
        </g>
        <g transform={`translate(513 ${ROWS[2] - 15})`}>
          <path d="M15 0l3 4 5-1 1 5 5 2-2 5 2 5-5 2-1 5-5-1-3 4-3-4-5 1-1-5-5-2 2-5-2-5 5-2 1-5 5 1z" />
          <circle className="ah-illustration__hole" cx="15" cy="15" r="5" />
        </g>
      </g>
    </svg>
  );
}

export default AccessIllustration;
