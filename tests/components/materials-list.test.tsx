import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MaterialsList } from "@/components/dashboard/materials-list";
import type { Material } from "@/db/schema";

const mats: Material[] = [
  {
    id: "m1",
    lessonId: "l1",
    title: "Apostila PDF",
    url: "/files/l1/m1.pdf",
    type: "PDF",
  },
  {
    id: "m2",
    lessonId: "l1",
    title: "Comentário",
    url: "https://exemplo.com/a",
    type: "LINK",
  },
];

describe("MaterialsList", () => {
  it("PDF link downloads in same tab (no target=_blank)", () => {
    render(<MaterialsList materials={mats} />);
    const a = screen.getByText("Apostila PDF").closest("a");
    expect(a).not.toHaveAttribute("target");
    expect(a).toHaveAttribute("href", "/files/l1/m1.pdf");
  });

  it("LINK opens in new tab", () => {
    render(<MaterialsList materials={mats} />);
    const a = screen.getByText("Comentário").closest("a");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
  });
});
