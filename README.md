# Atelier Fleur — Undangan Pernikahan 3D Interaktif (Mental Canvas Style)

Website undangan pernikahan interaktif bertema floral pastel dengan kedalaman 3D berlapis ala **Mental Canvas** (Three.js), dipisahkan secara ketat menjadi dua antarmuka:

1. **Halaman Tamu (`/`)** — Undangan interaktif scroll-driven 3D tanpa tombol atau tautan admin apa pun. Mendukung sapaan nama tamu personal lewat parameter `?to=Nama+Tamu`.
2. **Studio Admin (`/admin`)** — Sistem autentikasi admin, manajemen aset gambar (upload PNG/JPG/WebP/SVG + fitur auto-cutout latar putih), editor kanvas 3D kedalaman berlapis dengan gizmo & kamera orbit/scrub, pengaturan tipografi/font, musik latar, Google Maps, rekening gift, serta manajemen RSVP & ucapan tamu.

---

## Arsitektur Backend (Dual-Mode: Built-in Express + Supabase Ready)

Aplikasi ini siap berjalan langsung secara lokal maupun dengan **Supabase** (Auth, PostgreSQL, Storage):

- **Tanpa konfigurasi Supabase**: Secara otomatis berjalan menggunakan backend Express (`/api/*`) dengan penyimpanan persisten lokal (`/data/db.json` & `/data/uploads/`).
- **Dengan Supabase**: Ketika `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` diisi di `.env` (atau Environment Variables Vercel), aplikasi otomatis menggunakan **Supabase Auth**, **Supabase Postgres**, dan **Supabase Storage (`wedding-assets`)**.

---

## Panduan Publish ke GitHub & Deploy ke Vercel

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

### 3. Deploy ke Vercel
1. Hubungkan repositori GitHub Anda di [vercel.com](https://vercel.com).
2. Masuk ke **Project Settings → Environment Variables**, lalu tambahkan:
   - `VITE_SUPABASE_URL` = URL proyek Supabase Anda
   - `VITE_SUPABASE_ANON_KEY` = Anon Key Supabase Anda
   - `VITE_GOOGLE_MAPS_API_KEY` = API Key Google Maps Platform *(opsional, untuk peta interaktif & autocomplete lokasi)*
3. Build Command: `vite build` · Output Directory: `dist` *(sudah otomatis terbaca dari `vercel.json`)*.
4. Klik **Deploy** dan buka `/admin` untuk mulai mengunggah elemen floral dan menata undangan Anda.

---

## Cara Menghubungkan / Mengganti Domain Sendiri (Custom Domain di Vercel)

Jika Anda sudah membeli domain sendiri dari penyedia luar (misalnya Niagahoster, DomaiNesia, Rumahweb, Namecheap, Cloudflare, atau GoDaddy), ikuti langkah berikut untuk memasangnya ke Vercel:

### Langkah 1: Tambahkan Domain di Vercel
1. Buka **Vercel Dashboard → pilih proyek undangan Anda → Settings → Domains**.
2. Ketik nama domain Anda (contoh: `dewirian.com` atau subdomain `undangan.dewirian.com`) lalu klik **Add**.
3. Vercel akan menampilkan DNS record yang perlu Anda masukkan.

### Langkah 2: Atur DNS di Penyedia Domain Anda
Masuk ke panel **DNS Management / DNS Zone** di tempat Anda membeli domain, lalu tambahkan record sesuai kebutuhan:

- **Jika memakai Domain Utama** (contoh: `dewirian.com`):
  - **A Record**: Name/Host `@` → Value/Target `76.76.21.21` *(atau IP yang ditampilkan Vercel)*
  - **CNAME Record**: Name/Host `www` → Value/Target `cname.vercel-dns.com`
- **Jika memakai Subdomain** (contoh: `undangan.dewirian.com`):
  - **CNAME Record**: Name/Host `undangan` → Value/Target `cname.vercel-dns.com`

*(Jika DNS domain Anda dikelola melalui Cloudflare, atur proxy ke **DNS Only / awan abu-abu** terlebih dahulu hingga SSL di Vercel aktif.)*

### Langkah 3: Tunggu Verifikasi & SSL Otomatis
Tunggu sekitar **5–30 menit** (maksimal 24 jam untuk propagasi DNS). Di dashboard Vercel, status domain akan otomatis berubah menjadi **Valid Configuration** dan sertifikat HTTPS (SSL) langsung aktif tanpa biaya tambahan.

### Langkah 4: Update Domain di Supabase & Google Maps
Agar fitur login Admin dan peta Google Maps tetap berjalan normal di domain baru:
1. **Supabase Dashboard** → *Authentication → URL Configuration*:
   - Ubah **Site URL** ke `https://domain-baru-anda.com`
   - Tambahkan `https://domain-baru-anda.com/**` ke daftar **Redirect URLs**.
2. **Google Cloud Console** *(jika memakai Google Maps & membatasi Website/HTTP Referrer)*:
   - Tambahkan `https://domain-baru-anda.com/*` ke daftar **Website restrictions** pada API Key Google Maps Anda.

---

## Panduan Google Maps Akurat & Peta Interaktif

Jika acara diadakan di **rumah pribadi** (misalnya *"Rumah Mempelai Wanita"*) yang tidak terdaftar sebagai tempat umum di Google Maps, **jangan hanya mengisi nama & alamat teks** — gunakan salah satu dari 3 cara berikut di `/admin` (**Pengaturan → Adegan 3 & 4**):

### 1. Agar Tombol "Buka Google Maps" & Pin Tepat ke Lokasi Rumah
- **Cara A — Tempel Link Google Maps (`maps.app.goo.gl` / URL Browser)**:
  1. Buka lokasi rumah di aplikasi Google Maps → pilih **Bagikan (Share)** → **Salin link**.
  2. Tempel ke kolom **Link Google Maps** di panel Admin, lalu klik **Ambil Pin** (sistem otomatis mengekstrak koordinat akurat dari tautan).
- **Cara B — Tempel Koordinat Langsung (Paling Akurat untuk Rumah)**:
  1. Buka Google Maps di HP, **tekan dan tahan tepat di titik rumah acara** hingga muncul pin merah.
  2. Salin angka koordinat yang muncul (contoh: `-7.234567, 108.345678`).
  3. Tempel ke kolom **Koordinat Pin Akurat (Latitude, Longitude)** di panel Admin, lalu klik **Simpan Semua Pengaturan**.
- **Cara C — Cari atau Geser Pin di Peta Admin** *(jika Peta Interaktif aktif)*:
  - Cari nama gedung via kolom pencarian Google Places, **atau** klik area peta / geser pin pink langsung ke titik rumah pada pratinjau peta di Admin.

### 2. Mengaktifkan Peta Interaktif (`Peta Interaktif`) di Vercel & Lokal
Tanpa `VITE_GOOGLE_MAPS_API_KEY`, tamu tetap bisa membuka rute lewat tombol **Buka Google Maps**, tetapi pratinjau **Peta Interaktif** di dalam website memerlukan Google Maps API Key:

1. Buka [Google Cloud Console](https://console.cloud.google.com/) dan pilih/buat proyek Google Cloud Anda (pastikan *Billing* aktif; Google menyediakan kuota gratis bulanan).
2. Buka **APIs & Services → Library**, lalu aktifkan dua API berikut:
   - **Maps JavaScript API**
   - **Places API (New)**
3. Buka **APIs & Services → Credentials → Create Credentials → API Key**.
4. Klik API Key yang baru dibuat, lalu atur keamanan:
   - **Application restrictions**: pilih **Websites (HTTP referrers)** dan masukkan domain Anda:
     - `https://<nama-proyek>.vercel.app/*`
     - `https://<domain-sendiri>.com/*`
     - `http://localhost:3000/*` *(untuk pengujian lokal)*
   - **API restrictions**: pilih **Restrict key** dan centang **Maps JavaScript API** serta **Places API (New)**.
5. Tambahkan variabel environment berikut di **Vercel → Project Settings → Environment Variables** *(dan di file `.env` untuk lokal)*:
   - Name: `VITE_GOOGLE_MAPS_API_KEY`
   - Value: `<API_KEY_GOOGLE_MAPS_ANDA>`
6. Lakukan **Redeploy** di Vercel *(Deployments → titik tiga → Redeploy)* karena variabel `VITE_*` dibaca saat proses `vite build`.

