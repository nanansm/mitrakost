import bcrypt from 'bcryptjs';
import { createCookie } from 'react-router';
import { db } from './db.server';
import crypto from 'crypto';

export const sessionCookie = createCookie('mitrakost_session', {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
});

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'guard' | 'tenant';
  status: string;
  mustChangePassword?: number;
};

export async function login(email: string, password: string): Promise<User | null> {
  const user = db.prepare('SELECT * FROM User WHERE email = ?').get(email) as Record<string, unknown> | undefined;
  if (!user || user.status !== 'active' || !user.password) return null;
  const valid = await bcrypt.compare(password, user.password as string);
  if (!valid) return null;
  return {
    id: user.id as string,
    name: user.name as string,
    email: user.email as string,
    role: user.role as User['role'],
    status: user.status as string,
  };
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO Session (id, userId, expiresAt) VALUES (?, ?, ?)').run(sessionId, userId, expiresAt);
  return sessionId;
}

export async function getSession(request: Request): Promise<User | null> {
  const cookieHeader = request.headers.get('Cookie');
  const sessionId = await sessionCookie.parse(cookieHeader);
  if (!sessionId) return null;

  const session = db
    .prepare('SELECT * FROM Session WHERE id = ? AND expiresAt > ?')
    .get(sessionId, new Date().toISOString()) as Record<string, unknown> | undefined;
  if (!session) return null;

  const user = db
    .prepare('SELECT id, name, email, role, status, mustChangePassword FROM User WHERE id = ?')
    .get(session.userId as string) as User | undefined;
  return user ?? null;
}

export async function deleteSession(sessionId: string) {
  db.prepare('DELETE FROM Session WHERE id = ?').run(sessionId);
}

export async function requireUser(request: Request, allowedRoles?: string[]): Promise<User> {
  const user = await getSession(request);
  if (!user) throw new Response('Unauthorized', { status: 401 });
  if (allowedRoles && !allowedRoles.includes(user.role)) throw new Response('Forbidden', { status: 403 });
  const url = new URL(request.url);
  if (user.mustChangePassword === 1 && url.pathname !== '/change-password' && url.pathname !== '/logout') {
    throw new Response(null, { status: 302, headers: { Location: '/change-password' } });
  }
  return user;
}
