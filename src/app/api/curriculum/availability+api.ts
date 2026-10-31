import { authErrorResponse, requireAuth } from "@/server/rag/auth";
import { listCurriculumAvailability } from "@/server/rag/curriculum";

export async function GET(request: Request): Promise<Response> {
  try {
    const {userId}=await requireAuth(request);
    const slots = await listCurriculumAvailability(userId);
    return Response.json({ slots });
  } catch (error) {
    if (error instanceof Error && error.name === "ApiAuthError") {
      return authErrorResponse(error);
    }

    const message =
      error instanceof Error ? error.message : "Failed to load curriculum availability";
    return Response.json({ error: { code: "server_error", message } }, { status: 500 });
  }
}
