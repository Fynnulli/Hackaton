import { expect, test } from "vitest";
import { formatBytes } from "../../src/lib/format-bytes";

test("formatBytes", () => {
  expect(formatBytes(null)).toBe("");
  expect(formatBytes(512)).toBe("512 B");
  expect(formatBytes(1536)).toBe("1,5 KB");
  expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB");
});
