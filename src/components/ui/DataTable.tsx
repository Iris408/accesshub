import type { ReactNode } from "react";

import Icon from "./Icon";

export type SortDirection = "asc" | "desc";

export type SortState<K extends string> = {
  key: K;
  direction: SortDirection;
};

export type Column<T, K extends string = string> = {
  key: K;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  /** Applied to both the header and body cells of the column. */
  className?: string;
};

type DataTableProps<T, K extends string> = {
  caption: string;
  columns: Column<T, K>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  sort?: SortState<K>;
  onSortChange?: (sort: SortState<K>) => void;
};

function ariaSort<K extends string>(
  column: Pick<Column<unknown, K>, "key" | "sortable">,
  sort?: SortState<K>
) {
  if (!column.sortable) return undefined;
  if (sort?.key !== column.key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

/** Presentational table: callers own filtering, sorting and pagination. */
function DataTable<T, K extends string>({
  caption,
  columns,
  rows,
  getRowKey,
  sort,
  onSortChange,
}: DataTableProps<T, K>) {
  function toggleSort(key: K) {
    const direction: SortDirection =
      sort?.key === key && sort.direction === "asc" ? "desc" : "asc";
    onSortChange?.({ key, direction });
  }

  return (
    <div className="ah-table-scroll">
      <table className="ah-table">
        <caption className="ah-sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;

              return (
                <th
                  key={column.key}
                  scope="col"
                  className={column.className}
                  aria-sort={ariaSort(column, sort)}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      className={`ah-sort${active ? " is-active" : ""}`}
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.header}
                      <Icon
                        name={
                          !active
                            ? "sort"
                            : sort.direction === "asc"
                              ? "chevronUp"
                              : "chevronDown"
                        }
                        size={14}
                      />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
