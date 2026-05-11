/**
 * Normalise a user-pasted candidate photo URL into something the browser can
 * render directly with `<img src>`.
 *
 * Mostly turns Google Drive share URLs into the final googleusercontent image
 * endpoint that Drive's thumbnail route redirects to. Anything that doesn't
 * look like a Drive URL is returned unchanged after being trimmed.
 */
export function normalisePhotoUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return trimmed;

  const driveFileId = extractDriveFileId(trimmed);
  if (driveFileId) {
    return `https://lh3.googleusercontent.com/d/${driveFileId}=w800`;
  }

  return trimmed;
}

export function isHttpUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

function extractDriveFileId(input: string): string | null {
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
