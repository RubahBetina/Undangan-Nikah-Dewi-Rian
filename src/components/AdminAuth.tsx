import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, LogIn, UserPlus } from 'lucide-react';
import { dataService } from '../services/dataService.ts';
import type { AdminUser } from '../types/wedding.ts';

interface AdminAuthProps {
  onAuthenticated: (user: AdminUser) => void;
  registrationLocked?: boolean;
}

export function AdminAuth({
  onAuthenticated,
  registrationLocked = true,
}: AdminAuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const backendMode = dataService.getBackendMode();

  useEffect(() => {
    if (registrationLocked && mode === 'register') {
      setMode('login');
    }
  }, [registrationLocked, mode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === 'register' && registrationLocked) {
      setError('Pendaftaran akun admin baru sedang dikunci.');
      setMode('login');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const user = await dataService.login(email.trim(), password);
        onAuthenticated(user);
      } else {
        const res = await dataService.register(name.trim(), email.trim(), password);
        if (res.needsEmailConfirmation) {
          setNotice(
            'Akun berhasil dibuat! Cek email Anda (termasuk folder Spam) untuk mengklik tautan verifikasi dari Supabase, lalu masuk kembali. (Tips: agar langsung masuk tanpa verifikasi email, matikan "Confirm email" di Supabase Dashboard > Authentication > Providers > Email).',
          );
          setMode('login');
        } else {
          onAuthenticated(res.user);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autentikasi gagal.');
    } finally {
      setLoading(false);
    }
  };

  const fillSeededAccount = () => {
    setMode('login');
    setEmail('admin@atelierfleur.id');
    setPassword('floral2026');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#FBF8F6] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E6DFDB] bg-white p-8 md:p-10 shadow-[0_24px_60px_-24px_rgba(58,45,50,0.12)]">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 text-xs text-[#6B8E78] font-medium mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>
              Studio Admin
              <span className="mx-1.5" aria-hidden="true">
                ·
              </span>
              {backendMode === 'supabase' ? 'Supabase Auth' : 'Sesi Terenkripsi'}
            </span>
          </div>
          <h1 className="font-display text-4xl font-medium text-[#3A2D32] leading-tight">
            Atelier Fleur
          </h1>
          <p className="text-xs text-[#6E5D63] mt-1.5 leading-relaxed">
            Kelola elemen floral, kedalaman kanvas 3D, aset gambar, serta daftar RSVP tamu.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F4EEEC] mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setNotice(null);
            }}
            className={`py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-[#3A2D32] shadow-xs'
                : 'text-[#6E5D63] hover:text-[#3A2D32]'
            }`}
          >
            Masuk Admin
          </button>
          <button
            type="button"
            disabled={registrationLocked}
            title={
              registrationLocked
                ? 'Pendaftaran akun baru dikunci oleh Admin. Login terlebih dahulu untuk membuka kunci.'
                : 'Daftar Akun Baru'
            }
            onClick={() => {
              if (registrationLocked) return;
              setMode('register');
              setError(null);
              setNotice(null);
            }}
            className={`py-2 text-xs font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${
              registrationLocked
                ? 'text-[#9B8B90] opacity-60 cursor-not-allowed select-none'
                : mode === 'register'
                  ? 'bg-white text-[#3A2D32] shadow-xs cursor-pointer'
                  : 'text-[#6E5D63] hover:text-[#3A2D32] cursor-pointer'
            }`}
          >
            {registrationLocked && <Lock className="w-3 h-3 shrink-0" />}
            <span>Daftar Akun Baru</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-medium text-[#3A2D32] mb-1.5"
              >
                Nama Pengelola
              </label>
              <input
                id="auth-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap Anda"
                className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-4 py-2.5 text-sm text-[#3A2D32] focus:border-[#C47D8E] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-[#3A2D32] mb-1.5"
            >
              Alamat Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@atelierfleur.id"
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-4 py-2.5 text-sm text-[#3A2D32] focus:border-[#C47D8E] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-medium text-[#3A2D32] mb-1.5"
            >
              Kata Sandi
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] pl-4 pr-11 py-2.5 text-sm text-[#3A2D32] focus:border-[#C47D8E] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E5D63] hover:text-[#3A2D32] p-1 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {notice && (
            <p className="text-xs rounded-lg bg-[#ECF2ED] border border-[#CFE0D4] text-[#3B5B47] px-3.5 py-2.5 leading-relaxed">
              {notice}
            </p>
          )}

          {error && (
            <p className="text-xs rounded-lg bg-[#FBECEF] text-[#8F3A4E] px-3.5 py-2.5 leading-relaxed">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#C47D8E] px-5 py-3 text-sm font-medium text-white hover:bg-[#B46B7D] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Memproses...' : 'Masuk ke Studio'}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Mendaftarkan...' : 'Buat Akun Admin'}</span>
              </>
            )}
          </button>
        </form>

        {backendMode === 'express' ? (
          <div className="mt-6 pt-5 border-t border-[#EFE8E4] space-y-2.5">
            {registrationLocked && (
              <p className="text-[11px] text-[#6E5D63] flex items-center gap-1.5 leading-relaxed">
                <Lock className="w-3 h-3 text-[#C47D8E] shrink-0" />
                <span>
                  Pendaftaran akun baru dikunci. Masuk ke studio untuk membuka kunci sementara.
                </span>
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] text-[#6E5D63] leading-relaxed">
                Akun bawaan siap pakai:{' '}
                <span className="font-medium text-[#3A2D32]">admin@atelierfleur.id</span>
              </div>
              <button
                type="button"
                onClick={fillSeededAccount}
                className="text-xs font-medium text-[#C47D8E] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Isi Otomatis
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 pt-5 border-t border-[#EFE8E4] text-[11px] text-[#6E5D63] leading-relaxed">
            {registrationLocked ? (
              <span className="inline-flex items-start gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#C47D8E] shrink-0 mt-0.5" />
                <span>
                  Menu <span className="font-medium text-[#3A2D32]">Daftar Akun Baru</span> sedang dikunci untuk menjaga keamanan akses admin. Masuk dengan akun terdaftar untuk membuka kunci kapan saja.
                </span>
              </span>
            ) : (
              <>
                Terhubung ke <span className="font-medium text-[#3A2D32]">Supabase Auth</span>. Untuk membuat akun baru, gunakan tab{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                    setNotice(null);
                  }}
                  className="font-semibold text-[#C47D8E] hover:underline cursor-pointer"
                >
                  Daftar Akun Baru
                </button>{' '}
                dengan email Anda sendiri (jangan lupa kunci kembali setelah selesai).
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
