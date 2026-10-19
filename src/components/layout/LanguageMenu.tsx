import { useI18n } from "../../i18n/context";
import { LOCALES } from "../../i18n/locales";
import Icon from "../ui/Icon";
import MenuButton from "../ui/MenuButton";

/** Lists each language by its own name, always paired with its flag. */
function LanguageMenu() {
  const { locale, setLocale, t } = useI18n();
  const current = LOCALES.find((option) => option.code === locale) ?? LOCALES[0];

  return (
    <MenuButton
      label={`${t("language.label")}: ${current.name}`}
      menuLabel={t("language.menu")}
      triggerClassName="ah-lang__trigger"
      selection
      items={LOCALES.map((option) => ({
        key: option.code,
        checked: option.code === locale,
        onSelect: () => setLocale(option.code),
        label: (
          <>
            <span className="ah-lang__flag" aria-hidden="true">
              {option.flag}
            </span>
            <span lang={option.code}>{option.name}</span>
          </>
        ),
      }))}
    >
      <Icon name="globe" size={18} className="ah-lang__globe" />
      <span className="ah-lang__flag" aria-hidden="true">
        {current.flag}
      </span>
      <span className="ah-lang__name" lang={current.code}>
        {current.name}
      </span>
      <span className="ah-lang__code" aria-hidden="true">
        {current.short}
      </span>
      <Icon name="chevronDown" size={14} className="ah-lang__chevron" />
    </MenuButton>
  );
}

export default LanguageMenu;
