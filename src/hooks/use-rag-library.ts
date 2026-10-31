import { createId } from "@/lib/id";
import { withFreshSession } from "@/lib/rag-auth-request";
import { appendNativeRagFile } from "@/lib/rag-upload-file";
import { fetch } from "expo/fetch";
import { useAuth } from "@clerk/expo";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { getApiBaseUrl } from "@/lib/api-client";
import type { Source, SourceSelection, Verification } from "@/types/rag";

export function useRagLibrary() {
  const { getToken, userId } = useAuth();
  const auth = useRef({ getToken, userId });
  const generation = useRef(0);
  useLayoutEffect(() => {
    if (auth.current.userId !== userId) generation.current++;
    auth.current = { getToken, userId };
  }, [getToken, userId]);
  const controller = useRef<AbortController | null>(null);
  const picking = useRef(false);
  const paperFile = useRef<{ id: string; uri: string; name: string; mimeType?: string; size?: number } | null>(null);
  const clearPaperFile = useCallback(() => {
    if (paperFile.current && Platform.OS !== "web") {
      try { new File(paperFile.current.uri).delete(); } catch { /* temporary file already removed */ }
    }
    paperFile.current = null;
  }, []);
  const [sources, setSources] = useState<Source[]>([]);
  const [papers, setPapers] = useState<Source[]>([]);
  const [reports, setReports] = useState<Verification[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const request = useCallback(
    async <T>(
      path: string,
      method = "GET",
      body?: unknown,
      signal?: AbortSignal,
    ): Promise<T> => {
      const requestGeneration = generation.current;
      const requestOwner = auth.current.userId;
      const ensureCurrent = () => {
        if (
          signal?.aborted ||
          requestGeneration !== generation.current ||
          requestOwner !== auth.current.userId
        )
          throw new DOMException("Request cancelled", "AbortError");
      };
      const multipart = body instanceof FormData;
      const response = await withFreshSession(auth.current.getToken, (token) => fetch(`${getApiBaseUrl()}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(multipart ? {} : { "Content-Type": "application/json" }),
        },
        body:
          body === undefined
            ? undefined
            : multipart
              ? body
              : JSON.stringify(body),
        signal,
      }), ensureCurrent);
      const payload = await response.json().catch(() => ({
        error:
          response.status === 413
            ? "This file exceeds the server upload limit. Choose a smaller PDF or image."
            : `The server could not finish this step (${response.status}). Saved progress is kept; retry shortly.`,
      }));
      ensureCurrent();
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session needs refreshing. Please sign out and sign in again."
            : typeof payload.error === "string"
            ? payload.error
            : `Request failed (${response.status})`,
        );
      return payload as T;
    },
    [],
  );
  const task = useCallback(
    async <T>(
      work: (signal: AbortSignal) => Promise<T>,
    ): Promise<T | undefined> => {
      if (controller.current) return undefined;
      const active = new AbortController();
      controller.current = active;
      setBusy(true);
      setError(null);
      try {
        return await work(active.signal);
      } catch (e) {
        if (!active.signal.aborted)
          setError(e instanceof Error ? e.message : "Processing failed.");
      } finally {
        if (controller.current === active) {
          controller.current = null;
          setBusy(false);
          setProgress("");
        }
      }
    },
    [],
  );
  const replaceSource = useCallback((source: Source) => {
    if (source.kind === "paper")
      setPapers((old) => [source, ...old.filter((s) => s.id !== source.id)]);
    else
      setSources((old) => [source, ...old.filter((s) => s.id !== source.id)]);
  }, []);
  const process = useCallback(
    async (source: Source, signal: AbortSignal): Promise<Source> => {
      let current = source;
      while (current.status !== "ready" && !signal.aborted) {
        if (
          current.extractedCount < current.pageCount ||
          current.unresolvedCount
        )
          throw new Error(
            "Select the same file again to finish extraction. Unreadable pages need a clearer copy.",
          );
        setProgress(
          current.kind === "paper"
            ? `Preparing ${current.title} for review…`
            : `Indexing ${current.title}: ${current.embeddedCount}/${current.chunkCount} passages`,
        );
        current = (
          await request<{ source: Source }>(
            "/api/rag/sources",
            "PATCH",
            { id: current.id },
            signal,
          )
        ).source;
        if (signal.aborted) break;
        replaceSource(current);
      }
      return current;
    },
    [replaceSource, request],
  );
  const refresh = useCallback(
    () =>
      task(async (signal) => {
        const [library, history] = await Promise.all([
          request<{ sources: Source[] }>(
            "/api/rag/sources?includePapers=true",
            "GET",
            undefined,
            signal,
          ),
          request<{ verifications: Verification[] }>(
            "/api/rag/verify",
            "GET",
            undefined,
            signal,
          ),
        ]);
        if (signal.aborted) return;
        setSources(library.sources.filter((s) => s.kind === "reference"));
        setPapers(library.sources.filter((s) => s.kind === "paper"));
        setReports(history.verifications);
        for (const source of library.sources.filter(
          (s) =>
            !s.shared && s.kind !== "paper" &&
            (["pending", "processing"].includes(s.status) ||
              (s.status === "needs_reupload" &&
                s.extractedCount === s.pageCount &&
                !s.unresolvedCount)),
        ))
          await process(source, signal);
      }),
    [task, request, process],
  );
  useEffect(() => {
    const invalidateRequests = () => {
      generation.current++;
    };
    invalidateRequests();
    controller.current?.abort();
    controller.current = null;
    // Clear private account state before starting another account request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(false);
    setSources([]);
    setPapers([]);
    setReports([]);
    setVerification(null);
    setError(null);
    if (userId) void refresh();
    const listener = AppState.addEventListener("change", (state) => {
      if (picking.current) return; // Native file/camera UI is an expected temporary activity transition.
      if (state !== "active") {
        invalidateRequests();
        controller.current?.abort();
        controller.current = null;
        setBusy(false);
        setProgress("Paused. Reopen to continue.");
      } else if (auth.current.userId) void refresh();
    });
    return () => {
      invalidateRequests();
      clearPaperFile();
      controller.current?.abort();
      controller.current = null;
      listener.remove();
    };
  }, [userId, refresh, clearPaperFile]);
  const upload = useCallback(
    async (
      kind: Source["kind"],
      photo: boolean | "gallery" = false,
      resumeSource?: Source,
    ): Promise<Source | undefined> =>
      task(async (signal) => {
        let asset:
          | { uri: string; name: string; mimeType?: string; size?: number }
          | undefined;
        picking.current = true;
        try {
          if (photo) {
            if (
              photo === true &&
              !(await ImagePicker.requestCameraPermissionsAsync()).granted
            )
              throw new Error("Camera permission is required.");
            const picked =
              photo === "gallery"
                ? await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    quality: 0.9,
                  })
                : await ImagePicker.launchCameraAsync({ quality: 0.9 });
            if (picked.canceled) return;
            const image = picked.assets[0];
            asset = {
              uri: image.uri,
              name: image.fileName ?? "question-paper.jpg",
              mimeType: image.mimeType ?? "image/jpeg",
              size: image.fileSize,
            };
          } else {
            const picked = await DocumentPicker.getDocumentAsync({
              type: [
                "application/pdf",
                "image/jpeg",
                "image/png",
                "image/webp",
              ],
              copyToCacheDirectory: true,
              multiple: false,
            });
            if (picked.canceled) return;
            asset = picked.assets[0];
          }
        } finally {
          picking.current = false;
        }
        if (!asset) return;
        const uploadAttempt = createId();
        let retained = false;
        if (kind === "paper") clearPaperFile();
        try {
          if (signal.aborted) return;
          if (asset.size && asset.size > 10 * 1024 * 1024)
            throw new Error(
              "Upload at most 10 MiB. Split larger books by chapter.",
            );
          let source = resumeSource;
          do {
            const form = new FormData();
            if (Platform.OS === "web")
              form.append(
                "file",
                await (await fetch(asset.uri, { signal })).blob(),
                asset.name,
              );
            else appendNativeRagFile(form, asset);
            form.append("title", asset.name);
            form.append("kind", kind);
            if (kind === "paper") form.append("uploadAttempt", uploadAttempt);
            if (source) form.append("id", source.id);
            setProgress(
              `Reading pages ${source?.extractedCount ?? 0}/${source?.pageCount ?? "…"}…`,
            );
            source = (
              await request<{ source: Source }>(
                "/api/rag/sources",
                "POST",
                form,
                signal,
              )
            ).source;
            if (signal.aborted) return;
            replaceSource(source);
            if (kind === "paper") break; // Review original bytes directly; reference extraction is independent.
            if (source.unresolvedCount)
              throw new Error(
                "Some pages are unreadable. This source is not ready for retrieval.",
              );
          } while (source.extractedCount < source.pageCount && !signal.aborted);
          if (kind !== "paper") source = await process(source, signal);
          if (kind === "paper" && !signal.aborted)
            setPapers((old) => [
              source!,
              ...old.filter((p) => p.id !== source!.id),
            ]);
          if (kind === "paper" && !signal.aborted) {
            paperFile.current = { ...asset, id: source.id };
            retained = true;
          }
          return source;
        } finally {
          if (!retained && Platform.OS !== "web")
            try {
              new File(asset.uri).delete();
            } catch {
              /* OS may already have removed a temporary picker file. */
            }
        }
      }),
    [task, request, replaceSource, process, clearPaperFile],
  );
  const resume = useCallback(
    (source: Source) =>
      source.extractedCount < source.pageCount || source.unresolvedCount
        ? upload(source.kind, false, source)
        : task((signal) => process(source, signal)),
    [task, process, upload],
  );
  const remove = useCallback(
    (id: string) =>
      task(async (signal) => {
        await request(
          `/api/rag/sources?id=${encodeURIComponent(id)}`,
          "DELETE",
          undefined,
          signal,
        );
        if (!signal.aborted) {
          setSources((old) => old.filter((s) => s.id !== id));
          setPapers((old) => old.filter((s) => s.id !== id));
          if (paperFile.current?.id === id) clearPaperFile();
          setReports([]);
          setVerification(null);
          return true;
        }
        return false;
      }),
    [task, request, clearPaperFile],
  );
  const runVerification = useCallback(
    (paperId: string, selections: SourceSelection[], existingId?: string) =>
      task(async (signal) => {
        if (!existingId) {
          setProgress("Reviewing your paper…");
          const form = new FormData();
          form.append("id", paperId);
          form.append("selections", JSON.stringify(selections));
          const file = paperFile.current;
          if (file?.id === paperId) {
            if (Platform.OS === "web") form.append("file", await (await fetch(file.uri, {signal})).blob(), file.name);
            else appendNativeRagFile(form, file);
          }
          const { verification: reviewed } = await request<{verification: Verification}>("/api/rag/review", "POST", form, signal);
          if (!signal.aborted) {
            setVerification(reviewed);
            setReports(old => [reviewed, ...old.filter(r => r.id !== reviewed.id)]);
          }
          return reviewed;
        }
        let report = existingId
          ? (
              await request<{ verification: Verification }>(
                `/api/rag/verify?id=${existingId}`,
                "GET",
                undefined,
                signal,
              )
            ).verification
          : (
              await request<{ verification: Verification }>(
                "/api/rag/verify",
                "POST",
                { paperId, selections },
                signal,
              )
            ).verification;
        while (report.status !== "completed" && !signal.aborted) {
          setVerification(report);
          setProgress(
            `Checking paper: ${report.questions.length}/${report.totalQuestions || "…"} questions`,
          );
          report = (
            await request<{ verification: Verification }>(
              "/api/rag/verify",
              "PATCH",
              { id: report.id },
              signal,
            )
          ).verification;
        }
        if (!signal.aborted) {
          setVerification(report);
          setReports((old) => [
            report,
            ...old.filter((r) => r.id !== report.id),
          ]);
        }
      }),
    [task, request],
  );
  return {
    sources,
    papers,
    reports,
    busy,
    progress,
    error,
    verification,
    setVerification,
    refresh,
    upload,
    resume,
    remove,
    runVerification,
  };
}
