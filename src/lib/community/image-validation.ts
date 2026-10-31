export const ACCEPTED_COMMUNITY_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".svg",
] as const;

export const ACCEPTED_COMMUNITY_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
] as const;

export const COMMUNITY_POST_IMAGE_MAX_BYTES = 5_242_880;
export const COMMUNITY_POST_IMAGE_MAX_COUNT = 4;

function getExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");

  if (dotIndex < 0) {
    return "";
  }

  return name.slice(dotIndex).toLowerCase();
}

function matchesAcceptedExtension(name: string): boolean {
  const extension = getExtension(name);

  return ACCEPTED_COMMUNITY_IMAGE_EXTENSIONS.some(
    (accepted) => accepted === extension,
  );
}

function matchesAcceptedMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) {
    return false;
  }

  const normalized = mimeType.toLowerCase();

  if (normalized.startsWith("image/")) {
    return true;
  }

  return ACCEPTED_COMMUNITY_IMAGE_MIMES.some(
    (accepted) =>
      accepted === normalized || normalized.startsWith(`${accepted};`),
  );
}

export function isAcceptedCommunityImage(
  name: string,
  mimeType?: string | null,
): boolean {
  return matchesAcceptedExtension(name) || matchesAcceptedMime(mimeType);
}

export function isWithinCommunityImageSizeLimit(
  sizeBytes: number | null | undefined,
): boolean {
  if (sizeBytes === null || sizeBytes === undefined) {
    return true;
  }

  return sizeBytes <= COMMUNITY_POST_IMAGE_MAX_BYTES;
}

export function extensionForMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();

  if (normalized.includes("png")) {
    return ".png";
  }

  if (normalized.includes("webp")) {
    return ".webp";
  }

  if (normalized.includes("heic")) {
    return ".heic";
  }

  if (normalized.includes("heif")) {
    return ".heif";
  }

  if (normalized.includes("gif")) {
    return ".gif";
  }

  if (normalized.includes("bmp")) {
    return ".bmp";
  }

  if (normalized.includes("tiff")) {
    return ".tiff";
  }

  if (normalized.includes("svg")) {
    return ".svg";
  }

  return ".jpg";
}
