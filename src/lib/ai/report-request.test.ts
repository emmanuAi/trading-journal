import { describe, it, expect } from "vitest";
import { validateGenerateReportRequest, resolveAndValidateWeek } from "./report-request";
import { getLocalWeekWindow } from "./weekly-snapshot";

describe("validateGenerateReportRequest", () => {
  it("rejects a non-object body", () => {
    expect(validateGenerateReportRequest(null).ok).toBe(false);
    expect(validateGenerateReportRequest("x").ok).toBe(false);
  });

  it("rejects a missing or malformed weekStart", () => {
    expect(validateGenerateReportRequest({ accountId: "a" }).ok).toBe(false);
    expect(validateGenerateReportRequest({ weekStart: "01/05/2026", accountId: "a" }).ok).toBe(false);
    expect(validateGenerateReportRequest({ weekStart: "2026-13-99", accountId: "a" }).ok).toBe(true); // shape-only check; semantic validity is resolveAndValidateWeek's job
  });

  it("requires accountId unless aggregated is true", () => {
    expect(validateGenerateReportRequest({ weekStart: "2026-01-05" }).ok).toBe(false);
    expect(validateGenerateReportRequest({ weekStart: "2026-01-05", aggregated: true }).ok).toBe(true);
  });

  it("defaults regenerate to false and normalizes fields on success", () => {
    const result = validateGenerateReportRequest({ weekStart: "2026-01-05", accountId: "acc-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toEqual({ weekStart: "2026-01-05", accountId: "acc-1", aggregated: false, regenerate: false });
    }
  });

  it("does not trust a non-boolean regenerate value as true", () => {
    const result = validateGenerateReportRequest({ weekStart: "2026-01-05", accountId: "acc-1", regenerate: "yes" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.regenerate).toBe(false);
  });
});

describe("resolveAndValidateWeek", () => {
  it("accepts a real Monday and returns its canonical window", () => {
    const result = resolveAndValidateWeek("2026-01-05", "Europe/Amsterdam"); // a real Monday
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.window.weekStart).toBe("2026-01-05");
      expect(result.window.weekEnd).toBe("2026-01-11");
    }
  });

  it("rejects a date that isn't the Monday of its week — the tamper/spoofing guard", () => {
    const result = resolveAndValidateWeek("2026-01-07", "Europe/Amsterdam"); // a Wednesday
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid date string", () => {
    const result = resolveAndValidateWeek("2026-99-99", "Europe/Amsterdam");
    expect(result.ok).toBe(false);
  });

  it("rejects a week that hasn't started yet", () => {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 5);
    const future = farFuture.toISOString().slice(0, 10);
    const result = resolveAndValidateWeek(future, "UTC");
    // Only assert rejection if the generated date actually isn't a Monday-aligned
    // coincidence that happens to equal the current week — astronomically unlikely
    // 5 years out, but keep the assertion meaningful rather than flaky.
    expect(result.ok).toBe(false);
  });

  it("accepts the current, still-in-progress week", () => {
    const currentMonday = getLocalWeekWindow(new Date(), "UTC", 0).weekStart;
    const result = resolveAndValidateWeek(currentMonday, "UTC");
    expect(result.ok).toBe(true);
  });
});
