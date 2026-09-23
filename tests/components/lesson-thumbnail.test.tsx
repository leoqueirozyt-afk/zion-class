import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LessonThumbnail } from "@/components/dashboard/lesson-thumbnail";

describe("LessonThumbnail", () => {
  it("renders image with src", () => {
    render(<LessonThumbnail src="https://example.com/t.jpg" />);
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "https://example.com/t.jpg");
  });

  it("hides image on load error", () => {
    render(<LessonThumbnail src="https://example.com/broken.jpg" />);
    const img = document.querySelector("img")!;
    fireEvent.error(img);
    expect(img).toHaveStyle({ display: "none" });
  });

  it("is a client component (has use client directive)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = path.resolve(
      __dirname,
      "../../src/components/dashboard/lesson-thumbnail.tsx"
    );
    const src = fs.readFileSync(file, "utf8");
    expect(src.startsWith('"use client"')).toBe(true);
    expect(src).toContain("onError");
  });
});
