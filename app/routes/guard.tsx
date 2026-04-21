import { redirect, useFetcher } from 'react-router';
import type { Route } from './+types/guard';
import { getSession } from '~/lib/auth.server';
import { db } from '~/lib/db.server';
import { LogOut, CheckSquare, Square, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import crypto from 'crypto';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSession(request);
  if (!user) return redirect('/login');
  if (user.role !== 'guard') return redirect('/login');

  const fullUser = db.prepare('SELECT * FROM User WHERE id = ?').get(user.id) as any;
  const location = fullUser?.locationId
    ? (db.prepare('SELECT * FROM Location WHERE id = ?').get(fullUser.locationId) as any)
    : null;

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dayOfMonth = now.getDate();

  const dailyTasks = db.prepare("SELECT * FROM KpiTask WHERE type = 'daily' ORDER BY taskOrder").all() as any[];
  const monthlyTasks = db.prepare("SELECT * FROM KpiTask WHERE type = 'monthly' ORDER BY taskOrder").all() as any[];

  // Get or create KpiLog
  let log = db.prepare('SELECT * FROM KpiLog WHERE guardId = ? AND month = ?').get(user.id, month) as any;
  if (!log) {
    const logId = crypto.randomUUID();
    db.prepare('INSERT INTO KpiLog (id, guardId, month, kpiScore, baseSalary, kpiBonus, takeHome) VALUES (?, ?, ?, 0, 900000, 0, 900000)')
      .run(logId, user.id, month);
    log = db.prepare('SELECT * FROM KpiLog WHERE id = ?').get(logId) as any;
  }

  // Get done items for today
  const doneTodayIds = new Set(
    (db.prepare("SELECT taskId FROM KpiLogItem WHERE kpiLogId = ? AND date = ? AND done = 1").all(log.id, today) as any[])
      .map((r: any) => r.taskId)
  );

  // Get done monthly items (any date in this month)
  const doneMonthlyIds = new Set(
    (db.prepare("SELECT taskId FROM KpiLogItem WHERE kpiLogId = ? AND date LIKE ? AND done = 1").all(log.id, `${month}%`) as any[])
      .filter((r: any) => monthlyTasks.some((t: any) => t.id === r.taskId))
      .map((r: any) => r.taskId)
  );

  // Compute KPI
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = dayOfMonth;
  const totalDailyTarget = dailyTasks.length * currentDay;
  const totalMonthlyTarget = monthlyTasks.length;
  const totalTarget = totalDailyTarget + totalMonthlyTarget;

  const totalDoneItems = (db.prepare("SELECT COUNT(*) as c FROM KpiLogItem WHERE kpiLogId = ? AND done = 1").get(log.id) as any).c;
  const kpiScore = totalTarget > 0 ? Math.min(totalDoneItems / totalTarget, 1) : 0;
  const kpiBonus = Math.floor(kpiScore * 270000);
  const takeHome = 900000 + kpiBonus;

  // Recent expenses (by this guard)
  const recentExpenses = db.prepare(
    "SELECT e.*, l.name as locationName FROM Expense e LEFT JOIN Location l ON l.id = e.locationId WHERE e.inputBy = ? ORDER BY e.createdAt DESC LIMIT 5"
  ).all(user.name) as any[];

  return {
    user,
    fullUser,
    location,
    dailyTasks,
    monthlyTasks,
    doneTodayIds: Array.from(doneTodayIds),
    doneMonthlyIds: Array.from(doneMonthlyIds),
    today,
    month,
    dayOfMonth,
    kpiScore,
    kpiBonus,
    takeHome,
    totalDoneItems,
    totalTarget,
    log,
    recentExpenses,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSession(request);
  if (!user || user.role !== 'guard') return redirect('/login');

  const formData = await request.formData();
  const intent = String(formData.get('intent'));

  if (intent === 'toggleTask') {
    const taskId = String(formData.get('taskId'));
    const logId = String(formData.get('logId'));
    const date = String(formData.get('date'));
    const done = formData.get('done') === '1';

    const existing = db.prepare('SELECT * FROM KpiLogItem WHERE kpiLogId = ? AND taskId = ? AND date = ?').get(logId, taskId, date) as any;
    if (existing) {
      db.prepare('UPDATE KpiLogItem SET done = ? WHERE id = ?').run(done ? 1 : 0, existing.id);
    } else {
      db.prepare('INSERT INTO KpiLogItem (id, kpiLogId, taskId, date, done) VALUES (?, ?, ?, ?, ?)').run(
        crypto.randomUUID(), logId, taskId, date, done ? 1 : 0
      );
    }
    return { ok: true };
  }

  if (intent === 'addExpense') {
    const category = String(formData.get('category'));
    const description = String(formData.get('description'));
    const amount = Number(formData.get('amount'));
    const date = String(formData.get('date'));
    const fullUser = db.prepare('SELECT * FROM User WHERE id = ?').get(user.id) as any;

    if (!fullUser?.locationId) return { error: 'Tidak ada lokasi terkait' };
    if (!amount || !description) return { error: 'Semua field wajib diisi' };

    db.prepare(
      "INSERT INTO Expense (id, locationId, category, description, amount, date, inputBy, inputRole) VALUES (?, ?, ?, ?, ?, ?, ?, 'guard')"
    ).run(crypto.randomUUID(), fullUser.locationId, category, description, amount, date, user.name);

    return { expenseSuccess: 'Pengeluaran disimpan' };
  }

  return null;
}

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

const CATEGORIES = ['listrik', 'air', 'maintenance', 'lainnya'];

export default function GuardDashboard({ loaderData, actionData }: Route.ComponentProps) {
  const {
    user, location, dailyTasks, monthlyTasks, doneTodayIds, doneMonthlyIds,
    today, month, dayOfMonth, kpiScore, kpiBonus, takeHome, totalDoneItems, totalTarget, log,
    recentExpenses,
  } = loaderData;

  const fetcher = useFetcher();
  const doneToday = new Set(doneTodayIds);
  const doneMonthly = new Set(doneMonthlyIds);

  const doneCount = doneToday.size;
  const pct = Math.round(kpiScore * 100);

  const toggleTask = (taskId: string, isDaily: boolean, currentDone: boolean) => {
    fetcher.submit({
      intent: 'toggleTask',
      taskId,
      logId: log.id,
      date: isDaily ? today : `${month}-01`,
      done: currentDone ? '0' : '1',
    }, { method: 'post' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/logo/logo.png" alt="Mitra Kost" className="h-8" />
            <div>
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{location?.name || 'Penjaga'} — {today}</p>
            </div>
          </div>
          <a href="/logout" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600">
            <LogOut className="w-4 h-4" />
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Summary */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-3">KPI Bulan Ini — {month}</h2>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 bg-gray-200 rounded-full h-3">
              <div
                className="h-3 bg-red-500 rounded-full transition-all"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-sm font-bold w-10 text-right">{pct}%</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">{totalDoneItems}/{totalTarget} tugas selesai</p>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">Gaji Pokok</p>
              <p className="font-bold">Rp 900.000</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">Tunjangan KPI</p>
              <p className="font-bold text-green-700">{formatRp(kpiBonus)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">Take Home</p>
              <p className="font-bold text-red-700">{formatRp(takeHome)}</p>
            </div>
          </div>
        </div>

        {/* Daily Checklist */}
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Checklist Harian — {today}</h2>
            <span className="text-xs text-gray-500">{doneCount}/{dailyTasks.length} selesai</span>
          </div>
          <div className="divide-y">
            {dailyTasks.map((task: any) => {
              const isDone = doneToday.has(task.id);
              return (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id, true, isDone)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                >
                  {isDone
                    ? <CheckSquare className="w-5 h-5 text-green-600 shrink-0" />
                    : <Square className="w-5 h-5 text-gray-300 shrink-0" />
                  }
                  <span className={`text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {task.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Monthly Checklist */}
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Checklist Bulanan — {month}</h2>
            <span className="text-xs text-gray-500">{doneMonthly.size}/{monthlyTasks.length} selesai</span>
          </div>
          <div className="divide-y">
            {monthlyTasks.map((task: any) => {
              const isDone = doneMonthly.has(task.id);
              return (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id, false, isDone)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                >
                  {isDone
                    ? <CheckSquare className="w-5 h-5 text-green-600 shrink-0" />
                    : <Square className="w-5 h-5 text-gray-300 shrink-0" />
                  }
                  <span className={`text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {task.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Pengeluaran */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-red-600" />
            <h2 className="font-semibold text-gray-900">Input Pengeluaran</h2>
          </div>

          {(actionData as any)?.expenseSuccess && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {(actionData as any).expenseSuccess}
            </div>
          )}
          {(actionData as any)?.error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {(actionData as any).error}
            </div>
          )}

          <fetcher.Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="addExpense" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm text-gray-600">Tanggal</label>
                <Input type="date" name="date" defaultValue={today} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-gray-600">Kategori</label>
                <select name="category" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Keterangan</label>
              <Input name="description" placeholder="Deskripsi pengeluaran" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Jumlah (Rp)</label>
              <Input type="number" name="amount" placeholder="50000" required />
            </div>
            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white">
              Simpan Pengeluaran
            </Button>
          </fetcher.Form>

          {recentExpenses.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase">5 Terakhir</h3>
              {recentExpenses.map((e: any) => (
                <div key={e.id} className="flex justify-between text-sm py-1.5 border-t">
                  <div>
                    <span className="capitalize text-gray-600">{e.category}</span>
                    <span className="text-gray-400 ml-1">— {e.description}</span>
                  </div>
                  <span className="font-medium">{formatRp(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
