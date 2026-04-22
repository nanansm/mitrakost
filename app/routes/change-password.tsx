import { redirect, data } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { getSession, sessionCookie, createSession, deleteSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import bcrypt from 'bcryptjs';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { KeyRound } from 'lucide-react';

export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get('Cookie');
  const sessionId = await sessionCookie.parse(cookieHeader);
  const user = await getSession(request);
  if (!user) return redirect('/login');
  return { user, sessionId };
}

export async function action({ request }: ActionFunctionArgs) {
  const cookieHeader = request.headers.get('Cookie');
  const sessionId = await sessionCookie.parse(cookieHeader);
  const user = await getSession(request);
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const newPassword = String(formData.get('newPassword') || '').trim();
  const confirmPassword = String(formData.get('confirmPassword') || '').trim();

  const errors: Record<string, string> = {};
  if (!newPassword || newPassword.length < 8) errors.newPassword = 'Password minimal 8 karakter';
  if (newPassword !== confirmPassword) errors.confirmPassword = 'Password tidak cocok';

  if (user.mustChangePassword !== 1) {
    const oldPassword = String(formData.get('oldPassword') || '').trim();
    if (!oldPassword) errors.oldPassword = 'Password lama wajib diisi';
    if (!errors.oldPassword) {
      const dbUser = db.prepare('SELECT password FROM User WHERE id = ?').get(user.id) as any;
      const valid = dbUser?.password ? await bcrypt.compare(oldPassword, dbUser.password) : false;
      if (!valid) errors.oldPassword = 'Password lama salah';
    }
  }

  if (Object.keys(errors).length > 0) {
    return data({ errors }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE User SET password = ?, mustChangePassword = 0 WHERE id = ?').run(hashed, user.id);

  // Invalidate current session and create new one
  if (sessionId) await deleteSession(sessionId);
  const newSessionId = await createSession(user.id);
  const cookie = await sessionCookie.serialize(newSessionId);

  const role = user.role;
  const redirectTo = role === 'owner' || role === 'admin' ? '/dashboard'
    : role === 'guard' ? '/guard'
    : role === 'tenant' ? '/tenant'
    : '/';

  return redirect(redirectTo, { headers: { 'Set-Cookie': cookie } });
}

export default function ChangePassword({ loaderData, actionData }: { loaderData: any; actionData: any }) {
  const { user } = loaderData;
  const errors = (actionData as any)?.errors || {};
  const isForced = user.mustChangePassword === 1;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-red-600 px-6 py-8 text-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Ganti Password</h1>
            {isForced && (
              <p className="text-red-200 text-sm mt-1">
                Anda harus mengganti password sebelum melanjutkan.
              </p>
            )}
          </div>

          <form method="post" className="p-6 space-y-4">
            {!isForced && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Password Lama</label>
                <Input type="password" name="oldPassword" placeholder="••••••••" required />
                {errors.oldPassword && <p className="text-xs text-red-500">{errors.oldPassword}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Password Baru</label>
              <Input type="password" name="newPassword" placeholder="Minimal 8 karakter" required minLength={8} />
              {errors.newPassword && <p className="text-xs text-red-500">{errors.newPassword}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Konfirmasi Password Baru</label>
              <Input type="password" name="confirmPassword" placeholder="Ulangi password baru" required />
              {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword}</p>}
            </div>

            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white min-h-[44px]">
              Simpan Password Baru
            </Button>

            {!isForced && (
              <a href="/dashboard" className="block text-center text-sm text-gray-500 hover:text-gray-700 mt-2">
                Batal
              </a>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
