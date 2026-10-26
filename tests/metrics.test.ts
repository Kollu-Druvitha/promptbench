import { describe, expect, it } from "vitest";
import {
  exactMatch,
  rougeL,
  bleu,
  normalizeForMatch,
  referenceMetrics,
} from "@/lib/server/metrics";

describe("normalizeForMatch", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeForMatch("The Capital of France!")).toBe("the capital of france");
  });

  it("collapses repeated whitespace", () => {
    expect(normalizeForMatch("a   b\n\tc")).toBe("a b c");
  });
});

describe("exactMatch", () => {
  it("returns 1 for identical (modulo case/punctuation) strings", () => {
    expect(exactMatch("The capital of France is Paris.", "the capital of france is paris!")).toBe(1);
  });

  it("returns 0 for different strings", () => {
    expect(exactMatch("Paris", "London")).toBe(0);
  });

  it("returns 0 for an empty reference", () => {
    expect(exactMatch("anything", "   ")).toBe(0);
  });
});

describe("rougeL", () => {
  it("scores a verbatim match as 1", () => {
    expect(rougeL("hello world", "hello world")).toBeCloseTo(1, 5);
  });

  it("scores a partial overlap between 0 and 1", () => {
    // pred: [the, quick, brown, fox]  ref: [the, quick, fox]
    // LCS = 3 -> P = 3/4, R = 3/3 -> F1 = 2*0.75*1 / 1.75 ≈ 0.8571
    expect(rougeL("the quick brown fox", "the quick fox")).toBeCloseTo(0.8571, 3);
  });

  it("handles empty inputs", () => {
    expect(rougeL("", "hello")).toBe(0);
    expect(rougeL("hello", "")).toBe(0);
  });

  it("rewards ordering (LCS is order-sensitive)", () => {
    const inOrder = rougeL("the quick brown fox", "the quick brown fox");
    const scrambled = rougeL("fox brown quick the", "the quick brown fox");
    expect(inOrder).toBeGreaterThan(scrambled);
  });
});

describe("bleu", () => {
  it("scores a verbatim match as 1", () => {
    expect(bleu("the cat sat on the mat", "the cat sat on the mat")).toBeCloseTo(1, 5);
  });

  it("scores a total mismatch as low", () => {
    expect(bleu("hello", "completely different words here")).toBeLessThan(0.3);
  });

  it("handles empty inputs", () => {
    expect(bleu("", "hello")).toBe(0);
    expect(bleu("hello", "")).toBe(0);
  });

  it("rewards longer n-gram overlap over simple word overlap", () => {
    const exact = bleu("one two three four", "one two three four");
    const shuffled = bleu("four three two one", "one two three four");
    expect(exact).toBeGreaterThan(shuffled);
  });
});

describe("referenceMetrics", () => {
  it("returns all three deterministic metrics", () => {
    const m = referenceMetrics("The capital of France is Paris.", "the capital of france is paris");
    expect(m.exactMatch).toBe(1);
    expect(m.rougeL).toBeCloseTo(1, 4);
    expect(m.bleu).toBeCloseTo(1, 4);
  });

  it("returns zeros for completely unrelated text", () => {
    const m = referenceMetrics("zzz qqq", "aaa bbb ccc");
    expect(m.exactMatch).toBe(0);
    expect(m.rougeL).toBe(0);
    expect(m.bleu).toBeLessThan(0.2);
  });
});
