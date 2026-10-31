import { authErrorResponse, requireAuth } from "@/server/rag/auth";
import { getChaptersForBook, listCurriculumBooks } from "@/server/rag/curriculum";

export async function GET(request: Request): Promise<Response> {
  try {
    const {userId}=await requireAuth(request);

    const url = new URL(request.url);
    const classLevel = url.searchParams.get("classLevel")?.trim();
    const subject = url.searchParams.get("subject")?.trim() ?? "english";
    const includeChapters = url.searchParams.get("includeChapters") === "true";

    if (!classLevel) {
      return Response.json(
        { error: { code: "invalid_request", message: "classLevel is required" } },
        { status: 400 },
      );
    }

    const books = await listCurriculumBooks(userId,{ classLevel, subject });

    if (!includeChapters) {
      return Response.json({ books });
    }

    const booksWithChapters = await Promise.all(
      books.map(async (book) => ({
        ...book,
        chapters: await getChaptersForBook(userId,book.bookId),
      })),
    );

    return Response.json({ books: booksWithChapters });
  } catch (error) {
    if (error instanceof Error && error.name === "ApiAuthError") {
      return authErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : "Failed to load books";
    return Response.json({ error: { code: "server_error", message } }, { status: 500 });
  }
}
