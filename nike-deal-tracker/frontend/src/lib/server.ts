import "server-only";

export const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
export const SESSION_COOKIE = "ndt_session";
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "true" || (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false"),
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};
