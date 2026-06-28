import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration } from "./format";

describe("format helpers", () => {
  it("formats durations as m:ss", () => {
    expect(formatDuration(0)).toBe("");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(undefined)).toBe("");
  });

  it("formats byte sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
