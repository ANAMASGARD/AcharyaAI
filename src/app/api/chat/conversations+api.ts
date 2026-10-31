import { ApiAuthError, authErrorResponse, requireAuth } from "@/server/rag/auth";
import {
  createConversation,
  deleteConversationForTeacher,
  getConversationForTeacher,
  getLatestConversationForTeacher,
  listConversationsForTeacher,
  listMessages,
  updateConversationTitleForTeacher,
} from "@/server/rag/chat";

export async function GET(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const url = new URL(request.url);

    if (url.searchParams.get("list") === "1") {
      const conversations = await listConversationsForTeacher(userId);
      return Response.json({ conversations });
    }

    const conversationId = url.searchParams.get("conversationId");

    const conversation = conversationId?.trim()
      ? await getConversationForTeacher(userId, conversationId.trim())
      : await getLatestConversationForTeacher(userId);

    if (!conversation) {
      return Response.json({
        conversation: null,
        messages: [],
      });
    }

    const messages = await listMessages(
      userId,
      conversation.conversationId,
      50,
    );

    return Response.json({
      conversation,
      messages,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) return authErrorResponse(error);
    const message =
      error instanceof Error ? error.message : "Failed to load conversation";
    const status = message.includes("Authorization") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId")?.trim();

    if (!conversationId) {
      return Response.json(
        { error: "conversationId is required" },
        { status: 400 },
      );
    }

    const deleted = await deleteConversationForTeacher(userId, conversationId);

    if (!deleted) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiAuthError) return authErrorResponse(error);
    const message =
      error instanceof Error ? error.message : "Failed to delete conversation";
    const status = message.includes("Authorization") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const body = (await request.json()) as {
      conversationId?: string;
      title?: string;
    };

    const conversationId = body.conversationId?.trim();
    const title = body.title;

    if (!conversationId) {
      return Response.json(
        { error: "conversationId is required" },
        { status: 400 },
      );
    }

    if (typeof title !== "string") {
      return Response.json({ error: "title is required" }, { status: 400 });
    }

    const savedTitle = await updateConversationTitleForTeacher(
      userId,
      conversationId,
      title,
    );

    return Response.json({ ok: true, title: savedTitle });
  } catch (error) {
    if (error instanceof ApiAuthError) return authErrorResponse(error);
    const message =
      error instanceof Error ? error.message : "Failed to rename conversation";
    const status = message.includes("Authorization")
      ? 401
      : message.includes("not found")
        ? 404
        : message.includes("empty") || message.includes("80 characters")
          ? 400
          : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const conversation = await createConversation(userId);

    return Response.json({
      conversation,
      messages: [],
    });
  } catch (error) {
    if (error instanceof ApiAuthError) return authErrorResponse(error);
    const message =
      error instanceof Error ? error.message : "Failed to create conversation";
    const status = message.includes("Authorization") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
