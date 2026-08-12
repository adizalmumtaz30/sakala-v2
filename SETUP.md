# SAKALA V2 — Setup dari Nol

Panduan ini asumsi kamu **pakai akun GitHub, Supabase, Vercel yang sudah ada**
(tidak perlu akun baru) — tinggal buat *project/repo baru* di dalam akun itu.
Saya tidak bisa menjalankan langkah-langkah ini langsung dari sisi saya (tidak
ada akses jaringan/kredensial ke akun kamu), jadi ikuti urut-urutan di bawah.

---

## 0. Yang perlu di-install dulu di komputer kamu

| Tool | Versi minimum | Cek dengan |
|---|---|---|
| Node.js | **22.x** (Node 20 sudah EOL per 30 Apr 2026) | `node -v` |
| npm | ikut bawaan Node 22 | `npm -v` |
| Git | terbaru | `git -v` |
| GitHub CLI (opsional, mempercepat) | terbaru | `gh --version` |
| Vercel CLI (opsional) | terbaru | `vercel --version` |
| Supabase CLI (opsional) | terbaru | `supabase --version` |

Kalau Node kamu masih versi 18/20, update dulu (pakai [nvm](https://github.com/nvm-sh/nvm)):
```bash
nvm install 22
nvm use 22
```

---

## 1. Buat folder project & extract ZIP

```bash
mkdir -p ~/Projects
cd ~/Projects
# extract ZIP yang saya kirim ke sini, hasilnya folder "sakala-v2"
cd sakala-v2
npm install
```

---

## 2. Hubungkan ke GitHub (akun lama)

```bash
git init
git add .
git commit -m "chore: foundation, shell, core data guru (Fase 1)"

# Opsi A — pakai GitHub CLI (paling cepat, sudah login ke akun lamamu)
gh repo create sakala-v2 --private --source=. --remote=origin --push

# Opsi B — manual lewat web
# 1. Buka github.com/new di akun lamamu, buat repo "sakala-v2" (private)
# 2. Lalu:
git remote add origin https://github.com/<username-lamamu>/sakala-v2.git
git branch -M main
git push -u origin main
```

---

## 3. Buat project Supabase baru (akun lama)

1. Login ke [supabase.com/dashboard](https://supabase.com/dashboard) pakai akun lamamu.
2. **New Project** → beri nama `sakala-v2` → pilih region terdekat (Singapore
   kalau di Indonesia) → catat *database password*-nya di tempat aman.
3. Setelah project jadi, buka **Settings → API Keys**:
   - Kalau ada tab **API Keys** (bukan Legacy) → klik **Create new API Keys**
     → copy **Publishable key** (`sb_publishable_...`).
   - Kalau belum ada, pakai **Legacy API Keys** → copy `anon` key untuk sementara.
4. Copy juga **Project URL**-nya.
5. Buka **SQL Editor** → tempel isi file `database/migrations/0001_core_data.sql`
   dari ZIP ini → **Run**.
6. **PENTING** (kebijakan Supabase berubah 30 Mei 2026 — tabel baru tidak lagi
   otomatis ter-expose): buka **Table Editor**, pastikan tabel `guru`,
   `mata_pelajaran`, `kelas`, `ruangan` sudah ter-expose ke Data API. Kalau
   belum ada toggle-nya di situ, cek **Project Settings → Data API → Exposed
   schemas** dan pastikan schema `public` termasuk.

---

## 4. Isi environment variable lokal

```bash
cp .env.example .env.local
```

Edit `.env.local`, isi dengan URL & publishable key dari langkah 3:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
```

Jalankan lokal:
```bash
npm run dev
```
Buka `http://localhost:3000` → harus muncul halaman **Status Build**, klik
**Guru** untuk coba tambah/edit/hapus data guru (langsung ke Supabase).

---

## 5. Deploy ke Vercel (akun lama)

```bash
# Opsi A — Vercel CLI (sudah login ke akun lamamu)
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add NEXT_PUBLIC_APP_ENV production
vercel --prod
```

**Opsi B — manual lewat web**
1. Buka [vercel.com/new](https://vercel.com/new) pakai akun lamamu.
2. **Import** repo GitHub `sakala-v2` yang baru kamu push.
3. Di step **Environment Variables**, isi 3 variabel yang sama seperti
   `.env.local` (untuk environment **Production**, **Preview**, dan
   **Development** sekalian).
4. **Deploy**.

---

## 6. Kalau kamu mau PAKAI ULANG project Supabase/Vercel lama (bukan bikin baru)

Boleh — tapi karena schema tabel `guru`, `mata_pelajaran`, `kelas`, `ruangan`
di V2 ini didesain ulang dari nol (lihat `database/migrations/0001_core_data.sql`),
sebaiknya jalankan migration ini di **schema/project yang kosong** dulu supaya
tidak bentrok dengan tabel V1 yang mungkin sudah ada dengan struktur berbeda.
Kalau kamu mau saya bantu bikin migration yang aman untuk project lama
(cek dulu tabel existing, baru tambah/ubah), bilang saja.

---

## Checklist singkat

- [ ] Node 22+ terinstall
- [ ] `npm install` sukses
- [ ] Repo GitHub baru sudah ke-push
- [ ] Project Supabase baru sudah dibuat + migration SQL sudah dijalankan
- [ ] Tabel sudah di-expose ke Data API
- [ ] `.env.local` terisi, `npm run dev` jalan, CRUD Guru berhasil
- [ ] Vercel project sudah connect ke repo + env var terisi + deploy sukses
