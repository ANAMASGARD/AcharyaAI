import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractPages, needsVision } from "@/server/rag/extraction";
import { structured } from "@/server/rag/openai";
vi.mock("@/server/rag/openai", () => ({ structured: vi.fn() }));
async function pdf(texts: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of texts) {
    const page = doc.addPage();
    if (text) page.drawText(text, { font, size: 12, x: 30, y: 700 });
  }
  return doc.save();
}
beforeEach(() => vi.mocked(structured).mockReset());
describe("Transient PDF extraction", () => {
  it("routes malformed Unicode through vision and refuses corrupt OCR", async () => {
    expect(
      needsVision(
        "A lengthy searchable paragraph about the water cycle.\u0000",
      ),
    ).toBe(true);
    expect(
      needsVision(
        "A lengthy searchable paragraph about the water cycle.\uD800",
      ),
    ).toBe(true);
    vi.mocked(structured).mockResolvedValue({
      pages: [{ number: 1, text: "Question\u0000one", state: "readable" }],
    });
    await expect(
      extractPages(await pdf([""]), "application/pdf"),
    ).rejects.toThrow("unreadable");
  });
  it("preserves searchable PDF pages without calling vision", async () => {
    const pages = await extractPages(
      await pdf([
        "Chapter one explains the water cycle and evaporation in detail.",
        "Question 2: Explain condensation and the formation of clouds.",
      ]),
      "application/pdf",
    );
    expect(pages.map((p) => p.number)).toEqual([1, 2]);
    expect(pages[1].text).toContain("Question 2");
    expect(structured).not.toHaveBeenCalled();
  });
  it("uses vision only for scanned pages and retains Hindi evidence", async () => {
    vi.mocked(structured).mockResolvedValue({
      pages: [
        {
          number: 2,
          text: "प्रश्न २: प्रकाश संश्लेषण क्या है?",
          state: "readable",
        },
      ],
    });
    const pages = await extractPages(
      await pdf([
        "This first page contains sufficiently long searchable English text.",
        "",
      ]),
      "application/pdf",
    );
    expect(pages[0].method).toBe("text");
    expect(pages[1]).toMatchObject({
      number: 2,
      method: "vision",
      text: "प्रश्न २: प्रकाश संश्लेषण क्या है?",
    });
    expect(structured).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(structured).mock.calls[0][2])).toContain("proofread");
  });
  it("rejects omitted, reordered or unreadable OCR pages", async () => {
    vi.mocked(structured).mockResolvedValue({
      pages: [{ number: 1, text: "", state: "unreadable" }],
    });
    await expect(
      extractPages(await pdf([""]), "application/pdf"),
    ).rejects.toThrow("unreadable");
    vi.mocked(structured).mockResolvedValue({ pages: [] });
    await expect(
      extractPages(await pdf([""]), "application/pdf"),
    ).rejects.toThrow("omitted");
  });
  it("rejects excessive size and page count before provider calls", async () => {
    await expect(
      extractPages(new Uint8Array(10 * 1024 * 1024 + 1), "application/pdf"),
    ).rejects.toThrow("10 MiB");
    await expect(
      extractPages(await pdf(Array(101).fill("")), "application/pdf"),
    ).rejects.toThrow("100 pages");
    expect(structured).not.toHaveBeenCalled();
  });
});
