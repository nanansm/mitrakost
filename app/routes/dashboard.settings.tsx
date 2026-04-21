import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/dashboard.settings';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import bcrypt from 'bcryptjs';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user || user.role !== 'owner') return redirect('/dashboard');

  const siteInfos = db.prepare('SELECT * FROM SiteInfo ORDER BY key').all() as any[];
  return { siteInfos, user };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || user.role !== 'owner') return redirect('/dashboard');

  const formData = await request.formData();
  const intent = String(formData.get('intent'));

  if (intent === 'updateSiteInfo') {
    for (const [key, value] of formData.entries()) {
      if (key === 'intent') continue;
      db.prepare(
        "UPDATE SiteInfo SET value = ?, updatedAt = CURRENT_TIMESTAMP WHERE key = ?"
      ).run(String(value), key);
    }
    return { success: 'Pengaturan disimpan' };
  }

  if (intent === 'changePassword') {
    const currentPassword = String(formData.get('currentPassword'));
    const newPassword = String(formData.get('newPassword'));
    const confirmPassword = String(formData.get('confirmPassword'));

    if (newPassword !== confirmPassword) return { error: 'Password baru tidak cocok' };
    if (newPassword.length < 8) return { error: 'Password minimal 8 karakter' };

    const dbUser = db.prepare('SELECT password FROM User WHERE id = ?').get(user.id) as any;
    const valid = await bcrypt.compare(currentPassword, dbUser?.password || '');
    if (!valid) return { error: 'Password lama salah' };

    const hashed = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE User SET password = ? WHERE id = ?').run(hashed, user.id);
    return { success: 'Password berhasil diubah' };
  }

  return null;
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { siteInfos } = loaderData;
  const fetcher = useFetcher();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Pengaturan informasi kost (hanya owner)</p>
      </div>

      {(actionData as any)?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {(actionData as any).success}
        </div>
      )}
      {(actionData as any)?.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(actionData as any).error}
        </div>
      )}

      {/* Site Info */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Informasi Kost</h2>
        <fetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="updateSiteInfo" />
          {siteInfos.map((info: any) => (
            <div key={info.key} className="grid grid-cols-3 gap-3 items-center">
              <label className="text-sm text-gray-600 col-span-1">{info.label}</label>
              <Input
                name={info.key}
                defaultValue={info.value}
                className="col-span-2"
              />
            </div>
          ))}
          <div className="pt-2">
            <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white">
              Simpan Pengaturan
            </Button>
          </div>
        </fetcher.Form>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Ganti Password</h2>
        <fetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="changePassword" />
          <div className="space-y-1.5">
            <label className="text-sm text-gray-600">Password Lama</label>
            <Input type="password" name="currentPassword" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-gray-600">Password Baru</label>
            <Input type="password" name="newPassword" required minLength={8} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-gray-600">Konfirmasi Password Baru</label>
            <Input type="password" name="confirmPassword" required />
          </div>
          <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white">
            Ganti Password
          </Button>
        </fetcher.Form>
      </div>
    </div>
  );
}
