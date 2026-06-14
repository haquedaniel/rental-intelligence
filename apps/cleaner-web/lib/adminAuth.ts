import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_COOKIE_NAME = "cleaning_admin_session";

export async function requireAdmin() {
  const expectedToken = process.env.ADMIN_SESSION_TOKEN;

  if (!expectedToken) {
    throw new Error("Missing ADMIN_SESSION_TOKEN");
  }

  const cookieStore = await cookies();
  const actualToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (actualToken !== expectedToken) {
    redirect("/admin/login");
  }
}

export async function setAdminSession() {
  const expectedToken = process.env.ADMIN_SESSION_TOKEN;

  if (!expectedToken) {
    throw new Error("Missing ADMIN_SESSION_TOKEN");
  }

  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE_NAME, expectedToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
