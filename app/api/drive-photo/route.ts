import { NextResponse } from "next/server";

const DRIVE_FILE_ID_RE = /^[a-zA-Z0-9_-]{10,}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim() ?? "";

  if (!DRIVE_FILE_ID_RE.test(id)) {
    return new NextResponse("Invalid Drive file id.", { status: 400 });
  }

  const upstream = await fetch(
    `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800`,
    {
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      next: { revalidate: 86400 },
    },
  );

  if (!upstream.ok) {
    return new NextResponse("Candidate photo could not be loaded.", {
      status: upstream.status,
    });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return new NextResponse("Drive file is not an image.", { status: 415 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
