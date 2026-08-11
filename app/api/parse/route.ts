import { NextRequest, NextResponse } from "next/server";

// -----------------------------------------------------------------------
// Context-file parser.
//
// RAG context files used to be read client-side as plain text, which meant
// only text formats were supported and the browser bundled the parsing
// logic. Binary documents (PDF, DOCX) can't be read as text in the browser,
// so they are uploaded here and parsed server-side, then sent back as text
// so the rest of the pipeline (chunk -> retrieve -> augment) is unchanged.
//
// Size cap matches the client limit (see components/TestForm.tsx).
// -----------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const SUPPORTED_EXT = ["pdf", "doc", "docx", "txt", "md", "csv", "json", "log"];
// Binary formats handled by a real parser (not UTF-8 text).
const BINARY_EXT = ["pdf", "docx"];

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export async function POST(req: NextRequest) {
  let file: File | null = null;
  try {
    const form = await req.formData();
    const candidate = form.get("file");
    file = candidate instanceof File ? candidate : null;
  } catch {
    return NextResponse.json(
      { error: "Could not read the upload body." },
      { status: 400 }
    );
  }

  if (!file) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const ext = extOf(file.name);

  if (!SUPPORTED_EXT.includes(ext)) {
    return NextResponse.json(
      {
        error: `Unsupported file type '.${ext || "?"}' — use .txt, .md, .csv, .json, .log, .pdf, or .docx.`,
      },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 422 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File is too large — please use a file under 25 MB." },
      { status: 413 }
    );
  }

  // Legacy Word 97-2003 (.doc) is an OLE compound binary format with no
  // reliable pure-JS parser — make it an explicit, actionable error instead
  // of a silent failure.
  if (ext === "doc") {
    return NextResponse.json(
      {
        error:
          "Legacy .doc (Word 97-2003) isn't supported — please save the file as .docx or .pdf and re-upload.",
      },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (ext === "pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy().catch(() => {});
      const text = (result.text ?? "").trim();
      if (!text) {
        return NextResponse.json(
          {
            error:
              "No extractable text found in this PDF (it may be a scanned / image-only document).",
          },
          { status: 422 }
        );
      }
      return NextResponse.json({ fileName: file.name, text });
    } catch (err) {
      return NextResponse.json(
        {
          error: `Could not parse PDF: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
        { status: 422 }
      );
    }
  }

  if (ext === "docx") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value ?? "").trim();
      if (!text) {
        return NextResponse.json(
          {
            error:
              "No extractable text found in this Word document (it may only contain images).",
          },
          { status: 422 }
        );
      }
      return NextResponse.json({ fileName: file.name, text });
    } catch (err) {
      return NextResponse.json(
        {
          error: `Could not parse Word document: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
        { status: 422 }
      );
    }
  }

  // Plain-text formats: decode as UTF-8.
  const text = buffer.toString("utf8").trim();
  if (!text) {
    return NextResponse.json({ error: "File is empty." }, { status: 422 });
  }
  return NextResponse.json({ fileName: file.name, text });
}
