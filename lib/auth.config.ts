import type { NextAuthConfig } from "next-auth";

const protectedPaths = [
  "/dashboard",
  "/transactions",
  "/copilot",
  "/forecast",
  "/goals",
  "/report",
  "/billing",
];

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const pathname = nextUrl.pathname;
      const isProtected = protectedPaths.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
      );
      const isAuthPage = pathname === "/login" || pathname === "/signup";

      if (isProtected) {
        return isLoggedIn;
      }

      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
