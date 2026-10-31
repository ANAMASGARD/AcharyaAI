import { PDFDocument, StandardFonts } from "pdf-lib";
import { timingSafeEqual } from "node:crypto";
import { extractPages } from "@/server/rag/extraction";
import { hindiProbePng } from "@/server/rag/probe-fixture";
import { EXTRACTION_VERSION } from "@/server/rag/contracts";
import { runtimeWorkflow } from "@/server/rag/runtime-probe";
import { failure } from "@/server/rag/http";
async function fixture(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf
    .addPage()
    .drawText(
      "Acharya PDF runtime probe: water freezes at zero degrees Celsius.",
      { font, size: 12 },
    );
  return pdf.save();
}
// Public probe never accesses a user resource or makes paid provider calls.
export async function GET(): Promise<Response> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: await fixture() });
    try {
      const result = await parser.getText();
      const passed =
        result.pages.length === 1 &&
        result.pages[0].text.includes("water freezes");
      return Response.json(
        {
          ok: passed,
          pageParser: passed ? "supported" : "failed",
          pipeline: EXTRACTION_VERSION,
          dimensions: 1536,
        },
        { status: passed ? 200 : 503 },
      );
    } finally {
      await parser.destroy();
    }
  } catch {
    return Response.json(
      {
        ok: false,
        pageParser: "unavailable",
        pipeline: EXTRACTION_VERSION,
        visionFallback: "requires protected runtime probe",
      },
      { status: 503 },
    );
  }
}
// Optional preview-only operator probe: fixed synthetic fixtures; probe nonces cannot access teacher resources.
// Disabled unless a separate server-only diagnostic token is configured.
export async function POST(request: Request): Promise<Response> {
  const expected = process.env.RAG_DIAGNOSTIC_TOKEN;
  const actual = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (
    !expected ||
    !actual ||
    expected.length !== actual.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (new URL(request.url).searchParams.get("stage") === "bounded") return runtimeWorkflow(request);
    const english = await extractPages(await fixture(), "application/pdf");
    const hindi = await extractPages(
      new Uint8Array(Buffer.from(hindiProbePng, "base64")),
      "image/png",
    );
    const checks = {
      english: english[0].text.includes("water freezes"),
      hindi:
        hindi[0].text.includes("जल चक्र") &&
        hindi[0].text.includes("वाष्पीकरण"),
      vision: hindi[0].method === "vision",
    };
    const ok = Object.values(checks).every(Boolean);
    return Response.json(
      {
        ok,
        checks,
        englishMethod: english[0].method,
        pipeline: EXTRACTION_VERSION,
        dimensions: 1536,
      },
      { status: ok ? 200 : 422, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
