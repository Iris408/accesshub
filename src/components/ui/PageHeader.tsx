import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="ah-page-header">
      <title>{`${title} · AccessHub`}</title>

      <div>
        {eyebrow && <p className="ah-page-header__eyebrow">{eyebrow}</p>}
        <h1 className="ah-page-header__title">{title}</h1>
        {description && (
          <p className="ah-page-header__description">{description}</p>
        )}
      </div>

      {actions && <div className="ah-page-header__actions">{actions}</div>}
    </header>
  );
}

export default PageHeader;
