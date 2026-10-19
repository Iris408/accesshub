import Icon from "./Icon";

type PageItem = number | "gap-start" | "gap-end";

/** Always shows the first/last page and a window around the current one. */
function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const start = Math.max(2, Math.min(page - 1, pageCount - 4));
  const end = Math.min(pageCount - 1, Math.max(page + 1, 5));
  const items: PageItem[] = [1];

  if (start > 2) items.push("gap-start");
  for (let current = start; current <= end; current += 1) items.push(current);
  if (end < pageCount - 1) items.push("gap-end");
  items.push(pageCount);

  return items;
}

export type PaginationLabels = {
  navigation: string;
  previous: string;
  next: string;
  page: (page: number) => string;
};

const DEFAULT_LABELS: PaginationLabels = {
  navigation: "Pagination",
  previous: "Previous page",
  next: "Next page",
  page: (page) => `Page ${page}`,
};

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  labels?: PaginationLabels;
};

function Pagination({
  page,
  pageCount,
  onPageChange,
  labels = DEFAULT_LABELS,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav className="ah-pagination" aria-label={labels.navigation}>
      <button
        type="button"
        className="ah-page-btn"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label={labels.previous}
      >
        <Icon name="chevronLeft" size={16} />
      </button>

      {pageItems(page, pageCount).map((item) =>
        typeof item === "number" ? (
          <button
            key={item}
            type="button"
            className={`ah-page-btn${item === page ? " is-current" : ""}`}
            onClick={() => onPageChange(item)}
            aria-current={item === page ? "page" : undefined}
            aria-label={labels.page(item)}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="ah-page-gap" aria-hidden="true">
            …
          </span>
        )
      )}

      <button
        type="button"
        className="ah-page-btn"
        onClick={() => onPageChange(page + 1)}
        disabled={page === pageCount}
        aria-label={labels.next}
      >
        <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  );
}

export default Pagination;
