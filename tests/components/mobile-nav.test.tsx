import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileNav } from "@/components/shell/mobile-nav";

const links = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/lessons", label: "Aulas" },
];

describe("MobileNav", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("hamburger opens sheet with links and Sair", async () => {
    const user = userEvent.setup();
    render(<MobileNav links={links} user={{ name: "Ana" }} />);
    const trigger = screen.getByRole("button", { name: /abrir menu/i });
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText("Visão geral")).toBeInTheDocument();
      expect(screen.getByText("Aulas")).toBeInTheDocument();
      expect(screen.getByText("Sair")).toBeInTheDocument();
      expect(screen.getByText("Ana")).toBeInTheDocument();
    });
  });

  it("does not render hamburger inside md (uses md:hidden wrapper)", () => {
    const { container } = render(<MobileNav links={links} />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("md:hidden");
  });

  it("hides Sair when showLogout=false", async () => {
    const user = userEvent.setup();
    render(<MobileNav links={links} showLogout={false} />);
    await user.click(screen.getByRole("button", { name: /abrir menu/i }));
    await waitFor(() => {
      expect(screen.queryByText("Sair")).not.toBeInTheDocument();
    });
  });
});
