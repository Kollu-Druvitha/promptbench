import { describe, expect, it } from "vitest";
import { parseDatasetFile, MAX_DATASET_ITEMS } from "@/lib/dataset";

describe("parseDatasetFile — JSON", () => {
  it("parses an array of objects with flexible column names", () => {
    const { items, errors } = parseDatasetFile(
      "data.json",
      JSON.stringify([
        { question: "What is 2+2?", reference: "4" },
        { prompt: "Summarize this", context: "Some context here." },
        { input: "Third prompt", ground_truth: "expected" },
      ])
    );
    expect(errors).toHaveLength(0);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      id: "item-1",
      question: "What is 2+2?",
      reference: "4",
      context: undefined,
    });
    expect(items[1].context).toBe("Some context here.");
    expect(items[2].question).toBe("Third prompt");
  });

  it("accepts a single object (not just an array)", () => {
    const { items } = parseDatasetFile("one.json", JSON.stringify({ question: "q" }));
    expect(items).toHaveLength(1);
    expect(items[0].question).toBe("q");
  });

  it("reports invalid JSON", () => {
    const { items, errors } = parseDatasetFile("bad.json", "{ not json");
    expect(items).toHaveLength(0);
    expect(errors.join(" ")).toMatch(/not valid JSON/);
  });

  it("skips rows without a question and reports them", () => {
    const { items, errors } = parseDatasetFile(
      "data.json",
      JSON.stringify([{ question: "ok" }, { reference: "no question here" }])
    );
    expect(items).toHaveLength(1);
    expect(errors.join(" ")).toMatch(/1 row/);
  });
});

describe("parseDatasetFile — CSV", () => {
  it("parses a header row with case-insensitive columns", () => {
    const csv = "Question,Reference,Context\nQ1,RefA,CtxA\nQ2,RefB,";
    const { items, errors } = parseDatasetFile("data.csv", csv);
    expect(errors).toHaveLength(0);
    expect(items).toHaveLength(2);
    expect(items[0].question).toBe("Q1");
    expect(items[0].reference).toBe("RefA");
    expect(items[0].context).toBe("CtxA");
    expect(items[1].reference).toBe("RefB");
  });

  it("handles quoted fields containing commas and newlines", () => {
    const csv = 'question,reference\n"Who are you?","Hello, world"\n"Second","Multi\nline"';
    const { items } = parseDatasetFile("data.csv", csv);
    expect(items).toHaveLength(2);
    expect(items[0].reference).toBe("Hello, world");
    expect(items[1].reference).toBe("Multi\nline");
  });

  it("handles escaped quotes inside quoted fields", () => {
    const csv = 'question,reference\nQ,"He said ""hi"""';
    const { items } = parseDatasetFile("data.csv", csv);
    expect(items[0].reference).toBe('He said "hi"');
  });
});

describe("parseDatasetFile — limits & errors", () => {
  it("caps datasets at MAX_DATASET_ITEMS and flags truncation", () => {
    const rows = Array.from({ length: MAX_DATASET_ITEMS + 5 }, (_, i) => ({
      question: `q${i}`,
    }));
    const { items, truncated, errors } = parseDatasetFile(
      "big.json",
      JSON.stringify(rows)
    );
    expect(items).toHaveLength(MAX_DATASET_ITEMS);
    expect(truncated).toBe(true);
    expect(errors.join(" ")).toMatch(/only the first/);
  });

  it("rejects unsupported content", () => {
    const { items, errors } = parseDatasetFile("data.txt", "just some prose");
    expect(items).toHaveLength(0);
    expect(errors.join(" ")).toMatch(/Unsupported dataset format/);
  });
});
