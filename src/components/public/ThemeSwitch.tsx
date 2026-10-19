import type { Theme } from "../../hooks/useTheme";
import { useI18n } from "../../i18n/context";
import Icon from "../ui/Icon";

type ThemeSwitchProps = {
  theme: Theme;
  onToggle: () => void;
};

/**
 * "Dark theme" switch. The track shows both a sun and a moon (inline SVG);
 * the knob slides over and carries the icon of the active theme.
 */
function ThemeSwitch({ theme, onToggle }: ThemeSwitchProps) {
  const { t } = useI18n();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={t("theme.darkMode")}
      className="ah-switch"
      onClick={onToggle}
    >
      <Icon name="sun" size={15} className="ah-switch__icon ah-switch__icon--sun" />
      <Icon name="moon" size={15} className="ah-switch__icon ah-switch__icon--moon" />
      <span className="ah-switch__thumb">
        <Icon name={dark ? "moon" : "sun"} size={16} />
      </span>
    </button>
  );
}

export default ThemeSwitch;
