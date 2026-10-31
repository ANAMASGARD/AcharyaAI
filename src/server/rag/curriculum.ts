import type {
  CurriculumBookSummary,
  CurriculumChapterSummary,
} from "../../types/question-paper";
import { query } from "./db";
export async function listCurriculumBooks(
  owner: string,
  input: { classLevel: string; subject: string },
): Promise<CurriculumBookSummary[]> {
  return query<CurriculumBookSummary>(
    `SELECT d.id AS "bookId",d.title,d.class_level AS "classLevel",d.subject,jsonb_array_length(d.files)::int AS "chapterCount",(d.owner IS NULL) AS "isPreloaded" FROM acharya_rag.documents d JOIN acharya_rag.sources s ON s.id=d.source_id AND s.active_version=d.id AND s.deleted_at IS NULL WHERE (d.owner=$1 OR d.owner IS NULL) AND d.kind='reference' AND d.status='ready' AND d.class_level=$2 AND lower(d.subject)=lower($3) AND COALESCE(d.catalog_key,'') NOT LIKE 'pilot:%' ORDER BY d.title`,
    [owner, input.classLevel, input.subject],
  );
}
export async function getChaptersForBook(
  owner: string,
  id: string,
): Promise<CurriculumChapterSummary[]> {
  return query<CurriculumChapterSummary>(
    `SELECT f->>'id' AS "chapterId",f->>'title' AS title,(ordinality-1)::int AS index FROM acharya_rag.documents d JOIN acharya_rag.sources s ON s.id=d.source_id AND s.active_version=d.id AND s.deleted_at IS NULL CROSS JOIN jsonb_array_elements(d.files) WITH ORDINALITY AS f WHERE d.id=$1 AND (d.owner=$2 OR d.owner IS NULL) ORDER BY ordinality`,
    [id, owner],
  );
}
export async function listCurriculumAvailability(
  owner: string,
): Promise<{ classLevel: string; subject: string }[]> {
  return query(
    `SELECT DISTINCT d.class_level AS "classLevel",lower(d.subject) subject FROM acharya_rag.documents d JOIN acharya_rag.sources s ON s.id=d.source_id AND s.active_version=d.id AND s.deleted_at IS NULL WHERE (d.owner=$1 OR d.owner IS NULL) AND d.kind='reference' AND d.status='ready' AND d.class_level IS NOT NULL AND d.subject IS NOT NULL AND COALESCE(d.catalog_key,'') NOT LIKE 'pilot:%' ORDER BY "classLevel",subject`,
    [owner],
  );
}
