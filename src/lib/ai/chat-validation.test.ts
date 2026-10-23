import { describe, it, expect } from "vitest";
import { validateChatRequest, MAX_MESSAGE_LENGTH } from "./chat-validation";

describe("validateChatRequest — error handling at the request boundary", () => {
  it("rejects a non-object body", () => {
    expect(validateChatRequest(null).ok).toBe(false);
    expect(validateChatRequest("hello").ok).toBe(false);
    expect(validateChatRequest(42).ok).toBe(false);
  });

  it("rejects a missing or empty message", () => {
    expect(validateChatRequest({ accountId: "a" }).ok).toBe(false);
    expect(validateChatRequest({ message: "   ", accountId: "a" }).ok).toBe(false);
  });

  it("rejects an oversized message", () => {
    const result = validateChatRequest({ message: "x".repeat(MAX_MESSAGE_LENGTH + 1), accountId: "a" });
    expect(result.ok).toBe(false);
  });

  it("accepts a message right at the length limit", () => {
    const result = validateChatRequest({ message: "x".repeat(MAX_MESSAGE_LENGTH), accountId: "a" });
    expect(result.ok).toBe(true);
  });

  it("requires accountId unless aggregated is true", () => {
    expect(validateChatRequest({ message: "hi" }).ok).toBe(false);
    expect(validateChatRequest({ message: "hi", aggregated: true }).ok).toBe(true);
  });

  it("trims the message and normalizes accountId/aggregated on success", () => {
    const result = validateChatRequest({ message: "  what is my win rate?  ", accountId: "acc-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.message).toBe("what is my win rate?");
      expect(result.body.accountId).toBe("acc-1");
      expect(result.body.aggregated).toBe(false);
    }
  });

  it("does not trust a non-boolean aggregated value as true", () => {
    const result = validateChatRequest({ message: "hi", aggregated: "yes" });
    expect(result.ok).toBe(false); // aggregated !== true, so accountId is still required
  });
});
