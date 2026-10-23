import { describe, it, expect } from "vitest";
import { deriveConversationTitle } from "./conversation-title";

describe("deriveConversationTitle", () => {
  it("uses the full message when it's short", () => {
    expect(deriveConversationTitle("What's my win rate?")).toBe("What's my win rate?");
  });

  it("truncates a long message with an ellipsis, not mid-word silently overflowing the limit", () => {
    const long = "Can you give me a detailed breakdown of my EURUSD trades over the last three months including plan compliance";
    const title = deriveConversationTitle(long);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
  });

  it("collapses internal whitespace/newlines", () => {
    expect(deriveConversationTitle("hello\n\n  world")).toBe("hello world");
  });

  it("falls back to a generic title for an empty/whitespace-only message", () => {
    expect(deriveConversationTitle("   ")).toBe("New conversation");
  });
});
