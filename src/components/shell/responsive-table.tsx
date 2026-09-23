import * as React from "react";

export type ResponsiveTableColumn = {
  key: string;
  header: string;
  className?: string;
};

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  renderMobile,
  renderDesktopRow,
  emptyState,
  className,
}: {
  columns: ResponsiveTableColumn[];
  rows: T[];
  rowKey: (row: T) => string;
  renderMobile: (row: T) => React.ReactNode;
  renderDesktopRow: (row: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
}) {
  const empty = rows.length === 0;

  return (
    <div className={className}>
      <ul data-testid="responsive-mobile-list" className="md:hidden space-y-3">
        {empty
          ? emptyState
          : rows.map((row) => (
              <li
                key={rowKey(row)}
                className="rounded-lg border border-stone-200 bg-white p-3"
              >
                {renderMobile(row)}
              </li>
            ))}
      </ul>

      <div
        data-testid="responsive-desktop-table"
        className="hidden md:block overflow-x-auto rounded-lg border border-stone-200 bg-white"
      >
        {empty ? (
          emptyState
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`p-3 font-medium ${c.className ?? ""}`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-stone-100">
                  {renderDesktopRow(row)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
