import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// /edit/* is the client-facing editor — it has its own password-based auth
// (see lib/clientAuth.ts) and must NOT require a Clerk (owner) login.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/edit(.*)",
  "/api/client(.*)",
  "/api/client-auth(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
