import { describe, expect, it } from "vitest";
import { thumbKeyFor } from "./opfsCache";

describe("thumbKeyFor", () => {
  it("produces filesystem-safe, variant-specific keys", () => {
    const key = thumbKeyFor("m_1", "albums/2024/My Photo.jpg", "grid");
    expect(key).toMatch(/\.grid\.webp$/);
    expect(key).not.toMatch(/[^a-zA-Z0-9._-]/);
  });

  it("differs by variant", () => {
    const grid = thumbKeyFor("m_1", "p.jpg", "grid");
    const preview = thumbKeyFor("m_1", "p.jpg", "preview");
    expect(grid).not.toBe(preview);
  });
});
