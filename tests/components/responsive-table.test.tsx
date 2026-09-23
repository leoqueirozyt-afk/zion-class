import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResponsiveTable } from "@/components/shell/responsive-table";

type Row = { id: string; name: string };

const columns = [
  { key: "name", header: "Nome" },
  { key: "actions", header: "Ações" },
];

const rows: Row[] = [{ id: "1", name: "Ana" }];

describe("ResponsiveTable", () => {
  it("renders mobile cards with renderMobile", () => {
    render(
      <ResponsiveTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        renderMobile={(r) => <div data-testid="mobile-card">{r.name}</div>}
        renderDesktopRow={(r) => <td className="p-3">{r.name}</td>}
      />
    );
    expect(screen.getByTestId("mobile-card")).toHaveTextContent("Ana");
  });

  it("renders desktop table headers and cell values", () => {
    render(
      <ResponsiveTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        renderMobile={(r) => <div>{r.name}</div>}
        renderDesktopRow={(r) => <td className="p-3">{r.name}</td>}
      />
    );
    expect(screen.getByText("Nome")).toBeInTheDocument();
    expect(screen.getAllByText("Ana").length).toBeGreaterThanOrEqual(1);
  });

  it("shows emptyState when rows empty", () => {
    render(
      <ResponsiveTable
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        renderMobile={() => null}
        renderDesktopRow={() => null}
        emptyState={<p>Nenhum registro.</p>}
      />
    );
    expect(screen.getAllByText("Nenhum registro.").length).toBeGreaterThanOrEqual(1);
  });
});
