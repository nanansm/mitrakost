import { redirect } from "react-router";
import type { Route } from "./+types/logout";

export async function loader({ request }: Route.LoaderArgs) {
  const { sessionCookie, deleteSession } = await import("~/lib/auth.server");
  const cookieHeader = request.headers.get("Cookie");
  const sessionId = await sessionCookie.parse(cookieHeader);
  if (sessionId) await deleteSession(sessionId);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }),
    },
  });
}

export default function Logout() {
  return null;
}
