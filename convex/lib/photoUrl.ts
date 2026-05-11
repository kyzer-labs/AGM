/**
 * Normalise a user-pasted candidate photo URL into something the browser can
 * render directly with `<img src>`.
 *
 * Mostly turns Google Drive share URLs into an app-local image URL so browser
 * rendering doesn't depend on Google's cross-origin thumbnail redirect path.
 * Anything that doesn't look like a Drive URL is returned unchanged after
 * being trimmed.
 */
export function normalisePhotoUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return trimmed;

  const driveFileId = extractDriveFileId(trimmed);
  if (driveFileId) {
    return `/api/drive-photo?id=${driveFileId}`;
  }

  return trimmed;
}

export function isHttpUrl(input: string): boolean {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) || isDrivePhotoProxyUrl(trimmed);
}

function extractDriveFileId(input: string): string | null {
  if (isDrivePhotoProxyUrl(input)) {
    try {
      const url = new URL(input, "https://agm.local");
      return url.searchParams.get("id");
    } catch {
      return null;
    }
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (url.hostname === "drive.google.com") {
    const fileMatch = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) return fileMatch[1];

    const id = url.searchParams.get("id");
    if (
      id &&
      (url.pathname === "/open" ||
        url.pathname === "/uc" ||
        url.pathname === "/thumbnail")
    ) {
      return id;
    }
  }

  if (url.hostname === "drive.usercontent.google.com") {
    const id = url.searchParams.get("id");
    if (id && url.pathname === "/download") return id;
  }

  if (url.hostname === "lh3.googleusercontent.com") {
    const match = url.pathname.match(/^\/d\/([a-zA-Z0-9_-]+)/);
    if (match?.[1]) return match[1];
  }

  return null;
}

function isDrivePhotoProxyUrl(input: string): boolean {
  try {
    const url = new URL(input, "https://agm.local");
    return (
      url.origin === "https://agm.local" &&
      url.pathname === "/api/drive-photo" &&
      /^[a-zA-Z0-9_-]{10,}$/.test(url.searchParams.get("id") ?? "")
    );
  } catch {
    return false;
  }
}
