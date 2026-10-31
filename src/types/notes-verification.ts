export type VerificationGapVariant = "coral" | "coralLight" | "neutral";

export type VerificationGap = Readonly<{
  id: string;
  title: string;
  body: string;
  variant: VerificationGapVariant;
}>;

export type UploadKind = "document" | "image";

export type NotesUploadFile = Readonly<{
  id?: string;
  name: string;
  uri: string;
  mimeType: string | null;
  sizeBytes: number | null;
  kind: UploadKind;
}>;

export type NotesUploadError = "unsupported_type" | "pick_failed" | "too_large";
