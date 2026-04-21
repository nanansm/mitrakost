import { type LoaderFunctionArgs } from 'react-router';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data/uploads');

export async function loader({ params }: LoaderFunctionArgs) {
  const filePath = params['*'];
  if (!filePath) return new Response('Not found', { status: 404 });

  // Security: prevent directory traversal
  const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(UPLOAD_DIR, normalized);

  if (!fs.existsSync(fullPath)) return new Response('Not found', { status: 404 });

  const ext = path.extname(fullPath).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };
  const contentType = contentTypeMap[ext] || 'application/octet-stream';

  const file = fs.readFileSync(fullPath);
  return new Response(file, { headers: { 'Content-Type': contentType } });
}
