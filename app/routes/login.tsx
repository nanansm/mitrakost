import { redirect, data } from "react-router";
import type { Route } from "./+types/login";
import { login, createSession, sessionCookie, getSession } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (user) return redirect(getRoleRedirect(user.role));
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const user = await login(email, password);
  if (!user) {
    return data({ error: "Email atau password salah, atau akun belum aktif." }, { status: 401 });
  }

  const sessionId = await createSession(user.id);
  const cookie = await sessionCookie.serialize(sessionId);

  return redirect(getRoleRedirect(user.role), {
    headers: { "Set-Cookie": cookie },
  });
}

function getRoleRedirect(role: string) {
  if (role === "owner" || role === "admin") return "/dashboard";
  if (role === "guard") return "/guard";
  return "/tenant";
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="inline-block">
            <img src="/images/logo/logo.png" alt="Mitra Kost" className="h-16 mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Kos Premium Sumedang</p>
          </a>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Masuk</h1>
          <p className="text-sm text-gray-500 mb-6">Masuk ke akun Mitra Kost Anda</p>

          {actionData?.error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {actionData.error}
            </div>
          )}

          <form method="post" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="nama@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white">
              Masuk
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Belum punya akun?{" "}
            <a href="/#unit" className="text-red-600 hover:underline font-medium">
              Lihat kamar tersedia
            </a>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 Mitra Kost. Semua hak dilindungi.
        </p>
      </div>
    </div>
  );
}
