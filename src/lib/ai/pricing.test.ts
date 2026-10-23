import { describe, it, expect } from "vitest";
import { estimateCallCostUsd, computeActualCostUsd, estimateTokensFromText } from "./pricing";

describe("estimateCallCostUsd", () => {
  it("prices input and max output tokens at the Sonnet 5 rate", () => {
    // 1,000,000 input tokens @ $2/MTok + 1,000,000 output tokens @ $10/MTok
    expect(estimateCallCostUsd("claude-sonnet-5", 1_000_000, 1_000_000)).toBeCloseTo(12, 5);
  });

  it("is a true upper bound — uses maxOutputTokens, not an expected length", () => {
    const small = estimateCallCostUsd("claude-sonnet-5", 100, 100);
    const large = estimateCallCostUsd("claude-sonnet-5", 100, 10_000);
    expect(large).toBeGreaterThan(small);
  });
});

describe("computeActualCostUsd", () => {
  it("prices plain input + output tokens", () => {
    const cost = computeActualCostUsd("claude-sonnet-5", { input_tokens: 500_000, output_tokens: 100_000 });
    // 500k * (2/1e6) + 100k * (10/1e6) = 1 + 1 = 2
    expect(cost).toBeCloseTo(2, 5);
  });

  it("includes cache creation and cache read tokens in the input-priced total", () => {
    const withoutCache = computeActualCostUsd("claude-sonnet-5", { input_tokens: 1000, output_tokens: 0 });
    const withCache = computeActualCostUsd("claude-sonnet-5", {
      input_tokens: 1000,
      output_tokens: 0,
      cache_creation_input_tokens: 500,
      cache_read_input_tokens: 500,
    });
    expect(withCache).toBeGreaterThan(withoutCache);
  });

  it("treats missing cache fields as zero, not NaN", () => {
    const cost = computeActualCostUsd("claude-sonnet-5", { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: null, cache_read_input_tokens: null });
    expect(Number.isNaN(cost)).toBe(false);
    expect(cost).toBeGreaterThan(0);
  });
});

describe("estimateTokensFromText", () => {
  it("is deterministic and increases with text length", () => {
    expect(estimateTokensFromText("")).toBe(0);
    expect(estimateTokensFromText("abc")).toBe(1);
    expect(estimateTokensFromText("a".repeat(300))).toBe(100);
  });
});
