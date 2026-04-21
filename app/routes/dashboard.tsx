import { redirect } from "react-router";
import type { Route } from "./+types/dashboard";
import { getSession } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user) return redirect("/login");
  return { user };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white rounded-xl shadow-sm border">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-500">Coming soon - role: {user.role}</p>
        <p className="text-sm text-gray-400 mt-1">Logged in as {user.email}</p>
        <a href="/logout" className="mt-4 inline-block text-sm text-red-600 hover:underline">
          Logout
        </a>
      </div>
    </div>
  );
}
