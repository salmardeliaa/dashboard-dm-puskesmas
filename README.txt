DASHBOARD DM TIPE 2 + SUPABASE

1. Buat project Supabase.
2. Buka SQL Editor, paste isi database.sql, lalu Run.
3. Buka Authentication > Users > Add user.
4. Buat akun email + password untuk admin.
5. Buka js/config.js.
6. Isi:
   SUPABASE_URL = URL project kamu
   SUPABASE_ANON_KEY = Publishable/anon public key project kamu.
7. Jalankan index.html memakai VS Code Live Server.
8. Login memakai email/password yang dibuat di Supabase.

CATATAN KEAMANAN:
- Jangan pernah menaruh service_role/secret key di frontend.
- Data contoh hanya untuk demo.
- Sebelum dipakai untuk pasien nyata, tambahkan kontrol akses berbasis peran, audit log, validasi, backup, dan pengamanan data sesuai kebijakan fasilitas kesehatan.

FITUR:
- Login Supabase Auth
- Dashboard statistik
- Filter Puskesmas/status/nama
- Grafik status DM
- Progress indikator
- Database pasien Supabase
- Tambah pasien
- Follow-up
- Laporan
- Logout
