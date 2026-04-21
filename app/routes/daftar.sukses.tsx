import { CheckCircle, Home } from 'lucide-react';

export default function DaftarSukses() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl border p-8 shadow-sm">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pendaftaran Berhasil!</h1>
          <p className="text-gray-600 mb-2">
            Terima kasih telah mendaftar di Mitra Kost.
          </p>
          <p className="text-gray-500 text-sm mb-1">
            Tim admin akan memverifikasi pembayaran Anda dalam <strong>1x24 jam</strong>.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Anda akan menerima email konfirmasi beserta data login setelah disetujui.
          </p>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 mb-6">
            Pastikan email yang Anda daftarkan aktif untuk menerima notifikasi persetujuan.
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Kembali ke Beranda
          </a>
        </div>
      </div>
    </div>
  );
}
