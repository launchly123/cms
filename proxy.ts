import { NextResponse, type NextRequest } from "next/server";
import { OWNER_COOKIE, verifyOwnerToken } from "@/lib/ownerAuth";

// Public routes: the owner login itself, and the client-facing editor
// (which has its own password gate in lib/clientAuth.ts).
const PUBLIC = [
  /^\/login(\/|$|\?)/,
  /^\/edit(\/|$)/,
  /^\/api\/client(\/|$)/,
  /^\/api\/owner(\/|$)/,
];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) {
    return NextResponse.next();
  }

  const ok = await verifyOwnerToken(req.cookies.get(OWNER_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
