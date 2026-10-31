import { PDFDocument } from "pdf-lib";
import { nanoid } from "nanoid";
import { z } from "zod";
import { paperProbePng } from "./paper-probe-fixture";
import { startUpload, extractSourceStep } from "./upload";
import { processSource } from "./documents";
import { listSources, deleteSource } from "./repository";
import { createVerification, advanceVerification } from "./verification";

// Called only after the separate operator token check. The nonce addresses only
// synthetic probe owners, never teacher resources. Each call mirrors one app step.
export async function runtimeWorkflow(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const action = params.get("action") ?? "create";
  const run = z.string().regex(/^[A-Za-z0-9_-]{21}$/).parse(params.get("run") ?? nanoid());
  const owner = `runtime-probe-bounded-${run}`;
  const photo = params.get("fixture") === "photo";
  let bytes: Uint8Array;
  if (photo) bytes = new Uint8Array(Buffer.from(paperProbePng, "base64"));
  else {
    const pdf = await PDFDocument.create();
    pdf.setCreationDate(new Date("2026-01-01T00:00:00Z"));
    pdf.setModificationDate(new Date("2026-01-01T00:00:00Z"));
    pdf.addPage().drawText("Question 1: Explain why plants need water.", {size:12});
    bytes = await pdf.save();
  }
  const mime = photo ? "image/png" : "application/pdf";
  try {
    if (action === "create") {
      const source = await startUpload(owner, bytes, mime, {title:"Synthetic workflow paper",kind:"paper"});
      return Response.json({ok:true,run,id:source.id,status:source.status});
    }
    const record = {id:z.string().length(21).parse(params.get("id"))};
    if (action === "extract") {
      const source = await extractSourceStep(owner,record.id,bytes,mime);
      return Response.json({ok:source.extractedCount===source.pageCount,run,pages:source.extractedCount});
    }
    if (action === "publish") {
      const source = await processSource(owner,record.id);
      return Response.json({ok:source.status==="ready",run,status:source.status});
    }
    if (action === "start") {
      const book = photo ? (await listSources(owner)).find(s=>s.shared&&s.title==="Mridang") : undefined;
      if (photo && !book) throw new Error("Mridang missing");
      const review=await createVerification(owner,record.id,book?[{documentId:book.id,role:"syllabus"}]:[]);
      return Response.json({ok:true,run,checkId:review.id,status:review.status});
    }
    if (action === "advance") {
      const check={id:z.string().length(21).parse(params.get("checkId"))};
      const review=await advanceVerification(owner,check.id);
      return Response.json({ok:review.status!=="failed",run,status:review.status,questions:review.questions.map(q=>({status:q.status,evidence:q.evidenceSupport,citations:q.citations.map(c=>({title:c.title,page:c.page})),clarity:q.provisionalReview?.clarityScore}))});
    }
    if (action === "cleanup") {await deleteSource(owner,record.id);return Response.json({ok:true,run});}
    return Response.json({error:"Unknown probe action"},{status:400});
  } catch(error) {
    return Response.json({ok:false,action,name:error instanceof Error?error.name:"unknown",detail:error instanceof Error?error.message:"unknown"},{status:500});
  }
}
