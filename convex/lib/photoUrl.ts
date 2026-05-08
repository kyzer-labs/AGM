/**
 * Normalise a user-pasted candidate photo URL into something the browser can
 * render directly with `<img src>`.
 *
 * Mostly turns Google Drive share URLs into the direct-content equivalent.
 * Anything that doesn't look like a Drive URL is returned unchanged after
 * being trimmed.
 */
export function normalisePhotoUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return trimmed;

  const driveFile = trimmed.match(
    /^https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  );
  if (driveFile && driveFile[1]) {
    return `https://drive.google.com/uc?export=view&id=${driveFile[1]}`;
  }

  const driveOpen = trimmed.match(
    /^https?:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  );
  if (driveOpen && driveOpen[1]) {
    return `https://drive.google.com/uc?export=view&id=${driveOpen[1]}`;
  }

  return trimmed;
}

export function isHttpUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}
