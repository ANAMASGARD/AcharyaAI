import { z } from "zod";
import { requireAuth } from "@/server/rag/auth";
import { MAX_UPLOAD_BYTES, RagError } from "@/server/rag/contracts";
import { startUpload, extractSourceStep } from "@/server/rag/upload";
import { failure } from "@/server/rag/http";
import { deleteSource, getSource, listSources } from "@/server/rag/repository";
import { processSource } from "@/server/rag/documents";

export async function GET(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const id = new URL(request.url).searchParams.get("id");
    return Response.json(
      id
        ? { source: await getSource(userId, id) }
        : { sources: await listSources(userId, new URL(request.url).searchParams.get("includePapers") === "true") },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const length = Number(request.headers.get("content-length"));
    if (length > MAX_UPLOAD_BYTES + 65536)
      throw new RagError("Upload a file up to 10 MiB.", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new RagError("A file is required.");
    const parts: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_UPLOAD_BYTES + 65536) {
          await reader.cancel();
          throw new RagError("Upload a file up to 10 MiB.", 413);
        }
        parts.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bounded = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      bounded.set(part, offset);
      offset += part.length;
    }
    const form = (await new Response(bounded, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData()) as unknown as globalThis.FormData;
    const file = form.get("file");
    if (!(file instanceof Blob)) throw new RagError("A file is required.");
    if (file.size > MAX_UPLOAD_BYTES)
      throw new RagError("Upload a file up to 10 MiB.", 413);
    const fields = z
      .object({
        uploadAttempt: z.string().length(21).optional(),
        title: z.string().trim().min(1).max(200),
        kind: z.enum(["reference", "paper"]),
        classLevel: z.string().max(50).optional(),
        subject: z.string().max(80).optional(),
      })
      .parse({
        uploadAttempt: form.get("uploadAttempt") || undefined,
        title:
          form.get("title") || ("name" in file ? file.name : "Uploaded source"),
        kind: form.get("kind") || "reference",
        classLevel: form.get("classLevel") || undefined,
        subject: form.get("subject") || undefined,
      });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const resumeId = form.get("id");
    const started = resumeId
      ? { id: z.string().length(21).parse(resumeId) }
      : await startUpload(userId, bytes, file.type, fields);
    // Register first; extraction starts in the next request. EAS Free permits
    // ten outbound subrequests, including auth, Neon and OpenAI.
    if (!resumeId) return Response.json({ source: started }, { status: 201 });
    const source = await extractSourceStep(
      userId,
      started.id,
      bytes,
      file.type,
      { signal: request.signal },
    );
    return Response.json({ source }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const { id } = z
      .object({ id: z.string().length(21) })
      .parse(await request.json());
    return Response.json({
      source: await processSource(userId, id, request.signal),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const id = z
      .string()
      .length(21)
      .parse(new URL(request.url).searchParams.get("id"));
    await deleteSource(userId, id);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
