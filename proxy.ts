import { NextResponse, type NextRequest } from "next/server";

// Signed-out visitors go to sign in and come back to the page they asked for.
// The session itself is checked by each layout; this only reads whether a cookie exists,
// and passes the path on so layouts can build the same "next" link for expired sessions.
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname + request.nextUrl.search;
  if (!request.cookies.has("sid")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  const headers = new Headers(request.headers);
  headers.set("x-path", path);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/ride/:path*", "/drive/:path*", "/admin/:path*"] };
