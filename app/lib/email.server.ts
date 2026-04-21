import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PASS) {
    console.log('[email] SMTP not configured, skip:', subject);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"Mitra Kost" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[email] failed:', err);
  }
}

export async function notifyAdminNewRegistration(data: {
  name: string;
  email: string;
  phone: string;
  roomNumber: string;
  roomType: string;
  locationName: string;
  occupation: string;
}) {
  const html = `
    <h2>Pendaftaran Baru Mitra Kost</h2>
    <p><strong>Nama:</strong> ${data.name}</p>
    <p><strong>Email:</strong> ${data.email}</p>
    <p><strong>HP:</strong> ${data.phone}</p>
    <p><strong>Kamar:</strong> ${data.roomNumber} (${data.roomType}) - ${data.locationName}</p>
    <p><strong>Pekerjaan:</strong> ${data.occupation}</p>
    <p>Login dashboard untuk approve/decline.</p>
  `;
  await sendEmail(
    process.env.ADMIN_EMAIL || 'mitrakostsumedang@gmail.com',
    'Pendaftaran Baru Mitra Kost',
    html
  );
}

export async function notifyTenantApproved(email: string, password: string) {
  const html = `
    <h2>Pendaftaran Anda Disetujui!</h2>
    <p>Selamat! Pendaftaran Anda di Mitra Kost telah disetujui.</p>
    <p>Login ke dashboard penghuni:</p>
    <p><strong>URL:</strong> ${process.env.PUBLIC_URL || 'https://mitrakost.essentiallyour.com'}/login</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Password:</strong> ${password}</p>
    <p>Mohon ganti password setelah login pertama.</p>
  `;
  await sendEmail(email, 'Pendaftaran Mitra Kost Disetujui', html);
}

export async function notifyTenantDeclined(email: string, reason?: string) {
  const html = `
    <h2>Pendaftaran Tidak Disetujui</h2>
    <p>Mohon maaf, pendaftaran Anda tidak dapat kami setujui.</p>
    ${reason ? `<p>Alasan: ${reason}</p>` : ''}
    <p>Hubungi admin untuk informasi lebih lanjut: +62 822-3300-5808</p>
  `;
  await sendEmail(email, 'Pendaftaran Mitra Kost', html);
}
