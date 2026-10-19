import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import Icon, { type IconName } from "./Icon";

export type MenuItem = {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Short reason shown under a disabled item. */
  hint?: string;
  tone?: "danger";
  icon?: IconName;
  /** Selection menus only: marks the current choice. */
  checked?: boolean;
};

type MenuButtonProps = {
  /** Accessible name of the trigger button. */
  label: string;
  /** Accessible name of the menu. */
  menuLabel: string;
  items: MenuItem[];
  /** Trigger content. */
  children: ReactNode;
  triggerClassName: string;
  /** Render items as `menuitemradio` with `aria-checked`. */
  selection?: boolean;
};

const GAP = 6;

/**
 * WAI-ARIA menu button. Opens with click, Enter, Space or arrow keys; arrows,
 * Home and End move between items; selecting, Escape, Tab, scrolling or a
 * click outside closes it. The menu is positioned `fixed` to its trigger so
 * scroll containers (e.g. tables) never clip it.
 */
function MenuButton({
  label,
  menuLabel,
  items,
  children,
  triggerClassName,
  selection = false,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [initialFocus, setInitialFocus] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const lastIndex = items.length - 1;
  const checkedIndex = items.findIndex((item) => item.checked);
  const firstEnabled = Math.max(0, items.findIndex((item) => !item.disabled));

  function openMenu(focusIndex = checkedIndex >= 0 ? checkedIndex : firstEnabled) {
    setInitialFocus(focusIndex);
    setOpen(true);
  }

  function closeMenu(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function choose(item: MenuItem) {
    if (item.disabled) return;
    // Close first so focus is back on the trigger before the action runs
    // (e.g. a dialog opening will return focus there when it closes).
    closeMenu(true);
    item.onSelect();
  }

  // Place the menu below the trigger, right-aligned, flipping up if needed.
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!open || !trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const height = menu.offsetHeight;
    const below = rect.bottom + GAP;
    const fitsBelow = below + height <= window.innerHeight;
    const top = fitsBelow || rect.top - GAP - height < 0 ? below : rect.top - GAP - height;

    menu.style.top = `${Math.max(GAP, top)}px`;
    menu.style.right = `${Math.max(GAP, window.innerWidth - rect.right)}px`;
  }, [open]);

  useEffect(() => {
    if (open) itemRefs.current[initialFocus]?.focus({ preventScroll: true });
  }, [open, initialFocus]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: Event) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onViewportChange(event: Event) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(lastIndex);
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const elements = itemRefs.current;
    const index = elements.indexOf(document.activeElement as HTMLButtonElement);
    const focusItem = (next: number) => {
      event.preventDefault();
      elements[next]?.focus({ preventScroll: true });
    };

    switch (event.key) {
      case "ArrowDown":
        focusItem(index >= lastIndex ? 0 : index + 1);
        break;
      case "ArrowUp":
        focusItem(index <= 0 ? lastIndex : index - 1);
        break;
      case "Home":
        focusItem(0);
        break;
      case "End":
        focusItem(lastIndex);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        closeMenu(true);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div className="ah-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        {children}
      </button>

      {open && (
        <ul
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={menuLabel}
          className="ah-menu__list"
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, index) => (
            <li key={item.key} role="none">
              <button
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role={selection ? "menuitemradio" : "menuitem"}
                aria-checked={selection ? Boolean(item.checked) : undefined}
                aria-disabled={item.disabled || undefined}
                tabIndex={-1}
                className={`ah-menu__item${item.tone === "danger" ? " ah-menu__item--danger" : ""}`}
                onClick={() => choose(item)}
              >
                {item.icon && <Icon name={item.icon} size={16} className="ah-menu__icon" />}
                <span className="ah-menu__text">
                  {item.label}
                  {item.hint && <span className="ah-menu__hint">{item.hint}</span>}
                </span>
                {item.checked && <Icon name="check" size={16} className="ah-menu__check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MenuButton;
