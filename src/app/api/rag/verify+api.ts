import { z } from "zod";
import { requireAuth } from "@/server/rag/auth";
import { selectionSchema } from "@/server/rag/contracts";
import { failure } from "@/server/rag/http";
import {
  advanceVerification,
  createVerification,
  getVerification,
  listVerifications,
} from "@/server/rag/verification";
export async function GET(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const id = new URL(request.url).searchParams.get("id");
    return Response.json(
      id
        ? { verification: await getVerification(userId, id) }
        : { verifications: await listVerifications(userId) },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const body = z
      .object({ paperId: z.string().length(21), selections: selectionSchema })
      .parse(await request.json());
    return Response.json({
      verification: await createVerification(
        userId,
        body.paperId,
        body.selections,
      ),
    });
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
      verification: await advanceVerification(userId, id, request.signal),
    });
  } catch (e) {
    return failure(e);
  }
}
