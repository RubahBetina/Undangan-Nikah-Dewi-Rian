# Atelier Fleur — Undangan Pernikahan 3D Interaktif (Mental Canvas Style)

Website undangan pernikahan interaktif bertema floral pastel dengan kedalaman 3D berlapis ala **Mental Canvas** (Three.js), dipisahkan secara ketat menjadi dua antarmuka:

1. **Halaman Tamu (`/`)** — Undangan interaktif scroll-driven 3D tanpa tombol atau tautan admin apa pun. Mendukung sapaan nama tamu personal lewat parameter `?to=Nama+Tamu`.
2. **Studio Admin (`/admin`)** — Sistem autentikasi admin, manajemen aset gambar (upload PNG/JPG/WebP/SVG + fitur auto-cutout latar putih), editor kanvas 3D kedalaman berlapis dengan gizmo & kamera orbit/scrub, pengaturan detail acara, serta manajemen RSVP & ucapan tamu.

---

## Arsitektur Backend (Dual-Mode: Built-in Express + Supabase Ready)

Aplikasi ini siap berjalan langsung secara lokal maupun dengan **Supabase** (Auth, PostgreSQL, Storage):

- **Tanpa konfigurasi Supabase**: Secara otomatis berjalan menggunakan backend Express (`/api/*`) dengan penyimpanan persisten lokal (`/data/db.json` & `/data/uploads/`).
- **Dengan Supabase**: Ketika `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` diisi di `.env` (atau Environment Variables Vercel/Netlify), aplikasi otomatis menggunakan **Supabase Auth**, **Supabase Postgres**, dan **Supabase Storage (`wedding-assets`)**.

---

## Panduan Publish ke GitHub & Terbitkan ke Vercel / Netlify

### 1. Push ke Repositori GitHub Anda
```bash
git init
git add .
git commit -m "Initial commit: Atelier Fleur 3D Wedding Invitation"
git branch -M main
git remote add origin https://github.com/<username-anda>/<nama-repo>.git
git push -u origin main
```

### 2. Setup Proyek Supabase
1. Buat proyek baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor** di dashboard Supabase, lalu salin dan jalankan seluruh isi file `supabase/schema.sql`.
3. Di menu **Authentication → Providers**, pastikan **Email** aktif (nonaktifkan *Confirm email* jika ingin login langsung setelah daftar).
4. Buka menu **Project Settings → API**, salin **Project URL** dan **anon public key**.

### 3. Deploy ke Vercel (atau Netlify / Railway)
1. Hubungkan repositori GitHub Anda di Vercel.
2. Tambahkan Environment Variables berikut:
   - `VITE_SUPABASE_URL` = URL proyek Supabase Anda
   - `VITE_SUPABASE_ANON_KEY` = Anon Key Supabase Anda
3. Build Command: `npm run build` · Output Directory: `dist`.
4. Klik **Deploy** dan buka `/admin` untuk mulai mengunggah elemen floral dan menata kedalaman 3D undangan Anda!
