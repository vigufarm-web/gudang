# Data Gudang — PT VIGU FARM INDONESIA

Situs untuk melihat **dan mengisi** data aplikasi desktop Gudang (GudangApp):

| Menu                 | Isi                                                                                 |
|----------------------|-------------------------------------------------------------------------------------|
| **Dashboard**        | Kartu ringkasan, stok saat ini (gudang & per divisi, filter kategori), SPPB belum lengkap |
| **Kantor Pusat**     | Monitoring order: hanya SPPB yang sudah **full acc** (kepala divisi + KTU), lengkap % terpenuhi dari realisasi |
| **Laporan WA**       | Teks laporan masuk / keluar / stok per divisi / harian lengkap, siap tempel ke WhatsApp |
| **Material Masuk**   | Catat barang diterima, dengan link opsional ke item SPPB (realisasi otomatis)        |
| **Material Keluar**  | Catat barang diambil: blok, divisi, dan siapa yang mengambil (wajib)                 |
| **SPPB**             | Buat SPPB banyak item (ditandai **kepala divisi divisi mana** yang minta), monitoring realisasi, cetak surat ber-kop + ttd |
| **Persetujuan SPPB** | Acc berjenjang per divisi: Kepala Divisi → KTU → full acc, dengan PIN, tolak beralasan, dan jejak audit |
| **Master data**      | Material, Divisi, Kategori, Satuan, Blok                                             |

## Alur persetujuan SPPB

1. Admin gudang membuat SPPB dan mengisi **divisi pemohon** (Pisang, Padi, Infra, …) —
   itulah penanda kepala divisi mana yang minta.
2. SPPB masuk antrean **Persetujuan SPPB**, dikelompokkan per divisi. Kepala
   kebun divisi itu meng-**Acc** (atau **Tolak** dengan alasan — SPPB-nya tidak
   terhapus). Bisa dikunci **PIN** per kepala divisi.
3. Setelah acc kepala divisi, giliran **KTU** (KTU meng-acc semua divisi).
   Dua-duanya acc = **Full Acc** → otomatis muncul di monitoring **Kantor
   Pusat** sebagai order. Nomor SPPB di form **lanjut otomatis** dari nomor
   terakhir (2696 → 2697), tetap boleh diubah.
3b. **Admin Semarang (Kantor Pusat) menceklis** item mana saja yang sudah
   diorder — tercatat siapa & kapan, dan ceklisannya terlihat admin gudang di
   detail SPPB. Begitu barang tiba, gudang mencatat **Material Masuk** dengan
   link ke item SPPB-nya → sisa berkurang otomatis. Status tiap item:
   *Belum Diorder → Diorder → Sampai Sebagian → Sampai*. Revisi SPPB
   menggugurkan acc **dan** ceklis ordernya sekaligus.
4. **Tanda tangan**: di **Pengaturan → Kepala divisi, KTU & tanda tangan**, tiap
   pejabat menyimpan gambar ttd-nya (digambar langsung di layar atau unggah
   PNG/JPG). Surat SPPB yang dicetak otomatis menempelkan ttd tahap yang sudah
   acc + tanggal acc-nya; tahap yang belum acc dibiarkan kosong untuk ttd basah.
5. **Pengaman**: merevisi SPPB / itemnya **menggugurkan acc** — kembali ke
   antrean dari awal. Acc yang keliru bisa **dibatalkan** (tercatat siapa dan
   kenapa). Semua keputusan masuk **jejak audit** per SPPB (tombol "Jejak
   audit" di detail SPPB).
6. **SPPB lama tidak perlu di-acc.** Semua SPPB yang sudah ada saat fitur ini
   pertama dipasang ditandai "Lama" dan tidak masuk antrean — alur acc hanya
   berlaku untuk pengajuan baru sesudahnya. Batasnya ditetapkan otomatis
   sekali oleh `tools/ekspor_gudang.py` (atau saat data pertama dibuka).

Repo ini sekaligus jadi **database**: seluruh isi `gudang.db` dikemas jadi satu
file JSON **terenkripsi** di `data/gudang.json`. Tanpa password, isinya tidak
bisa dibaca siapa pun — termasuk orang yang membuka repo ini.

Tidak ada server, tidak ada `npm install`. Enkripsi memakai Web Crypto bawaan
peramban (PBKDF2 + AES-256-CTR + HMAC-SHA256), sama persis dengan situs
payroll (repo `payrol`).

---

## Pengguna seperti payroll

Setelah membuka data dengan password data, masuk lagi memakai username dan
password/PIN pengguna. Akun awal **OJORA** adalah **admin sekaligus KTU**.
Password admin disimpan sebagai hash PBKDF2-SHA256 dengan salt acak dan
600.000 iterasi di dalam berkas data terenkripsi, terpisah dari password data.

Admin membuka **Pengguna → Tambah pengguna**, menentukan nama, username,
password/PIN, divisi, dan hak akses. Pilihan peran: Kepala Divisi, Petugas Gudang,
Kantor Pusat, Lihat saja, serta Admin/KTU. Hak dapat disesuaikan: input,
revisi/hapus, persetujuan kepala divisi, persetujuan KTU, pembatalan, dan ceklis order.
Admin dapat menonaktifkan pengguna. Master, Pengguna, Pengaturan dan Riwayat hanya
untuk admin. Akun admin yang sedang masuk tidak dapat menonaktifkan atau menurunkan
perannya sendiri. Nama pelaku persetujuan mengikuti akun yang sedang masuk.

Semua pengguna aktif dapat membuka **Ganti password/PIN**. Password lama wajib
benar, password baru minimal 6 karakter dan diulang dua kali. Perubahan langsung
disimpan ke GitHub menggunakan token perangkat, terpisah dari simpan otomatis.
Password data, peran, divisi dan password pengguna lain tidak ikut berubah.
Jika penyimpanan gagal, password lama tetap berlaku. Simpan transaksi yang masih
tertunda sebelum mengganti password. Sesi perangkat lain diminta masuk ulang
ketika memuat ulang data terbaru.

Untuk menyimpan pengaturan pengguna dan transaksi, token GitHub tetap diperlukan:
**Pengaturan → Mode edit → Uji & simpan token**. Token hanya untuk repo `gudang`
dengan izin Contents: Read and write; jangan masukkan token ke file data.
Perangkat petugas yang menulis juga perlu dipasangi token secara langsung.

Ini mengikuti batasan sistem payroll: pembatasan operasional di browser, bukan
otorisasi server. Orang yang memegang password data dapat membaca seluruh berkas,
dan pemegang token tulis dapat mengubahnya melalui GitHub di luar aplikasi.
Daftar pengguna dan PIN tidak memisahkan kerahasiaan data antarkebun.
Supabase tidak dipakai untuk alur ini.

## 0. Coba dulu di komputer (tanpa GitHub)

1. Buka terminal/cmd di folder ini, lalu jalankan ekspor dari database desktop:

   ```
   python tools\ekspor_gudang.py
   ```

   Script mencari `gudang.db` sendiri (folder ini, folder induk, `dist\`).
   Kalau tidak ketemu: `python tools\ekspor_gudang.py --db "C:\lokasi\gudang.db"`.
   Password yang diisi di sini = password untuk membuka situs. **Catat baik-baik.**

   > Berkas `data/gudang.json` sudah dienkripsi ulang dengan password pemilik.
   > Password tidak disimpan di kode, README, atau konfigurasi GitHub.
   > Nama pengisi bawaan adalah **OJORA**, dapat diubah lewat Pengaturan.
   > Nama pengisi merupakan label pencatatan, bukan akun yang diverifikasi server.

2. Klik dua kali **`Jalankan.bat`**. Peramban terbuka di `http://localhost:8788`.
3. Masukkan password → semua menu bisa dicoba, termasuk form inputnya.

Saat dicoba begini, pojok kanan atas bertuliskan **"Ujicoba di komputer"**.
Tombol **Simpan** akan **mengunduh** berkas `gudang.json` (bukan mengirim ke
GitHub). Berkas itu bisa:

- ditimpakan ke `data\gudang.json` lalu halaman dimuat ulang — untuk melihat
  hasil input Anda, atau
- dimasukkan balik ke `gudang.db` aplikasi desktop:
  `python tools\impor_gudang.py` (database di-backup otomatis dulu).

> **Kenapa lewat `Jalankan.bat`, bukan klik dua kali `index.html`?** Halaman
> memuat JavaScript sebagai modul dan membaca berkas data; peramban melarang
> keduanya pada alamat `file://`. `Jalankan.bat` menyalakan server kecil
> bawaan Python. Tanpa Python, klik kanan `server.ps1` → *Run with PowerShell*.

---

## 1. Menyiapkan GitHub Pages (sekali saja)

1. Buat repo baru di GitHub, mis. `data-gudang`.
2. Upload seluruh isi folder ini (**Add file → Upload files**, atau `git push`).
   Folder `data` memang ikut ter-upload — isinya justru databasenya, dan sudah
   terenkripsi.
3. **Settings → Pages** → *Source*: **Deploy from a branch**, branch `main`,
   folder `/ (root)` → **Save**. Tunggu 1–2 menit, alamatnya muncul:
   `https://<akun>.github.io/data-gudang/`.

Owner dan nama repo **terdeteksi otomatis** dari alamat itu.

## 2. Token GitHub (untuk mengubah data dari situs)

Melihat cukup password. **Menyimpan** perlu token:

1. GitHub → **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**
2. *Repository access*: **Only select repositories** → repo ini saja.
   *Permissions → Contents*: **Read and write**.
3. Tempel token di situs: menu **Pengaturan → Mode edit → Uji & simpan token**.
   Token hanya tersimpan di perangkat itu, tidak ikut ter-upload.

## 3. Cara pakai sehari-hari

- **Melihat** — buka alamatnya, masukkan password.
- **Mengisi dari situs** — masuk mode edit (token), isi seperti biasa.
  Perubahan terkirim sendiri beberapa detik kemudian (simpan otomatis), atau
  tekan **Simpan ke GitHub**. Dua orang menyimpan hampir bersamaan? Perubahan
  digabung otomatis, tidak ada input yang hilang.
- **Dari aplikasi desktop** — input seperti biasa, lalu jalankan
  `python tools\ekspor_gudang.py` dan upload/commit `data\gudang.json` ke repo
  (lewat web GitHub: buka folder `data` → Upload files → timpa).
- **Menarik hasil input situs ke desktop** — unduh `data/gudang.json` dari repo
  (atau menu **Pengaturan → Unduh berkas terenkripsi**), taruh di folder
  `data\`, lalu `python tools\impor_gudang.py`.
- **Riwayat & pemulihan** — setiap penyimpanan = satu commit. Menu **Riwayat
  perubahan** menampilkan siapa menyimpan apa; satu klik memuat versi lama
  untuk dikembalikan.

> Jangan mengisi dari desktop dan situs bersamaan pada hari yang sama tanpa
> saling tarik dulu — ekspor desktop **menimpa** isi file di repo.

## 4. Isi folder

```
index.html            halaman utama
css/style.css         tampilan (sama dengan situs payroll)
js/kunci.js           buka/kunci data (PBKDF2 + AES-256-CTR + HMAC-SHA256)
js/github.js          baca & tulis file lewat GitHub API
js/ui.js              perkakas tabel, form, dialog
js/data.js            isi database di memori, stok, SPPB, simpan & gabung
js/main.js            kerangka, layar kunci, menu, simpan otomatis
js/dashboard.js       kartu ringkasan + stok + SPPB belum lengkap
js/masuk.js           form & tabel Material Masuk (+ link SPPB)
js/keluar.js          form & tabel Material Keluar
js/sppb.js            buat SPPB, monitoring realisasi, cetak surat ber-kop + ttd
js/persetujuan.js     acc berjenjang kepala divisi -> KTU, PIN, tolak, jejak audit
js/pusat.js           monitoring Kantor Pusat (order dari SPPB full acc)
js/laporan.js         laporan WA (masuk/keluar/stok/harian)
js/master.js          CRUD Material, Divisi, Kategori, Satuan, Blok
js/sistem.js          pengaturan, pejabat & tanda tangan, kop surat, riwayat
js/form-util.js       kendali form & filter bersama
tools/ekspor_gudang.py  gudang.db -> data/gudang.json (terenkripsi)
tools/impor_gudang.py   data/gudang.json -> gudang.db (backup otomatis)
tools/kunci_py.py       enkripsi sisi Python (identik dengan kunci.js)
data/                   file data terenkripsi
Jalankan.bat / server.ps1  ujicoba di komputer sendiri
.nojekyll               matikan pemrosesan Jekyll di GitHub Pages
```

## 5. Catatan teknis

- Data dibaca lewat **GitHub API** supaya selalu versi terbaru; kalau batas
  permintaan tercapai, otomatis jatuh ke berkas GitHub Pages.
- Enkripsi: PBKDF2-SHA256 200.000 iterasi → AES-256-CTR, keaslian dijaga
  HMAC-SHA256 (*encrypt-then-MAC*). `tools/kunci_py.py` menghasilkan byte yang
  identik dengan `js/kunci.js` (teruji dua arah).
- Password hilang = data di repo tidak bisa dibuka lagi oleh siapa pun. Itu
  memang maksud enkripsinya — simpan password di tempat aman.
- Profil perusahaan (kop surat + logo) ikut tersimpan di berkas data, dipakai
  menu **SPPB → Cetak surat permintaan**. Ekspor ulang dari `gudang.db` tidak
  menghapusnya (dibawa dari berkas lama).
- Kolom item tambahan di situs (qty disetujui, beban biaya, brand, keterangan
  tujuan) dan seluruh data persetujuan/ttd hidup di berkas situs, bukan di
  `gudang.db` — `impor_gudang.py` hanya menulis kolom yang dikenal desktop,
  dan ekspor ulang dari desktop MENIMPA isi item SPPB (kolom tambahan dari
  situs ikut hilang). Kalau SPPB sudah dikelola dari situs, jadikan situs
  sumber utamanya.

## Monitoring SPPB

Halaman SPPB mempertahankan tabel rinci, ditambah kartu ringkasan yang bisa diklik,
pencarian nomor/material, filter divisi dan tanggal, serta tab Semua, Menunggu
persetujuan, Siap order, Proses penerimaan dan Selesai. Persentase progres adalah
rata-rata pemenuhan tiap item aktif; satuan barang berbeda tidak dijumlahkan.
Klik baris membuka panel detail tanpa menghilangkan posisi daftar dan filter.

SPPB lama yang dikonfirmasi pemilik telah disetujui manual dicatat sebagai
Full Acc dengan sumber manual dan jejak pencatatan. Tanggal persetujuan asli
tetap kosong bila tidak diketahui. Catatan manual tidak menambah tanda tangan,
ceklis order, penerimaan, atau jumlah barang. Revisi tetap menggugurkan
persetujuan dan mengembalikan dokumen ke antrean. Kantor Pusat menampilkan order
aktif yang belum selesai secara bawaan; arsip selesai tersedia lewat filter.

## Order bertahap dan Gudang pusat

Kantor Pusat / Order mencatat setiap pemesanan dengan nomor ORD otomatis yang
unik (UUID), supplier, jumlah/satuan order, satuan SPPB, satuan stok, faktor
konversi, sumber konversi dan perkiraan datang. Satu item SPPB bisa memiliki
beberapa order. Konversi tidak boleh diubah setelah ada penerimaan. Untuk
kg/liter, gunakan massa jenis bahan dari dokumen supplier; tidak ada konversi
1:1 bawaan. Order tanpa konversi dapat dicatat, tetapi belum dapat diterima
atau dihitung sebagai pemenuhan.

Barang ditunggu menampilkan order terbuka. Penerimaan memilih order dan jumlah
yang datang, lalu menyimpan snapshot konversi; stok bertambah hanya ketika
penerimaan dicatat. Sistem meminta alasan jika jumlah order/penerimaan melebihi
sisa kebutuhan. Sisa order dapat ditutup dengan alasan, tanpa menganggapnya
sudah diterima. Koreksi memiliki jejak perubahan; retur supplier dicatat
terpisah dari penerimaan asal dan mengurangi stok/pemenuhan bersih.

Penerimaan baru masuk ke Gudang. Pengeluaran langsung menjadi pemakaian divisi
tujuan, dengan keperluan wajib, nama pengambil, kendaraan/mesin dan KM/HM
opsional. Dashboard memisahkan Stok Gudang dari Pemakaian per divisi. Tidak ada
stok divisi tambahan yang dihitung. Pertalite, Pertamax dan Solar adalah tiga
material terpisah dengan satuan stok Liter, bukan satu saldo BBM gabungan.
Riwayat lama tidak diklasifikasi ulang atau dikonversi otomatis.

Peran Petugas Gudang yang baru dipilih mendapat hak Kelola stok Gudang dan
pemakaian semua divisi. Hak pengguna lama tidak diperluas diam-diam; admin
dapat menambahkan hak Gudang lewat Pengguna. Token GitHub tetap diperlukan
pada setiap perangkat yang menulis. Ceklis order lama tetap ditandai sebagai
jumlah belum dirinci; tidak dianggap seluruh permintaan sudah dipesan.


## BBM terpisah

Menu BBM menampilkan stok Solar, Pertalite dan Pertamax. BBM Masuk/Keluar menyaring catatan yang sama pada material_masuk/material_keluar, bukan menyalinnya ke tabel lain. Daftar Material Masuk/Keluar menyembunyikan BBM. Transaksi lama bernama BBM tetap menjadi arsip tanpa menebak jenisnya. Penerimaan baru masuk Gudang, pemakaian memilih divisi tujuan, jenis unit, unit, pengambil dan keperluan. HM/KM tidak diminta; nilai historis tetap disimpan.

ALB dan kendaraan dapat memakai referensi unit aktif dari bagian Alat Berat & Kendaraan pada repo vigufarm-web/payrol. Admin memuat data terenkripsi memakai password bagian tersebut di perangkatnya atau memilih berkas terenkripsi; hanya id, kode, nama, kategori dan nomor polisi unit disalin ke data Gudang terenkripsi. Password, token, HM/KM, operator dan upah tidak disimpan. Referensi diperbarui lewat tombol Muat / perbarui unit payroll. Riwayat transaksi menyimpan ID dan label unit pada saat input. Input manual selalu tersedia; Alsintan manual. Tautan payroll membuka aplikasi asal, lalu pilih bagian Alat Berat & Kendaraan. Tidak ada penulisan transaksi ke payroll maupun sinkron HM/KM.


## Permintaan mandor dan stok opname

Peran Mandor memiliki hak minta, tanpa hak input Material Keluar. Admin menentukan divisi masing-masing pengguna. Permintaan satu divisi dapat berisi banyak material dan blok, memakai proporsi luas Master Blok atau jumlah manual. Luas acuan dan jumlah per blok disimpan dalam dokumen, tidak berubah mengikuti pembaruan master. Keperluan umum divisi tanpa blok tersedia. Persetujuan Kepala Divisi lalu KTU wajib berurutan, mencakup divisi terkait, dan pemohon tidak boleh menyetujui dokumennya sendiri. Pengurangan jumlah membutuhkan alasan. Revisi sebelum penyerahan menggugurkan persetujuan; setelah penyerahan rincian asal dikunci dan sisa dapat ditutup beralasan.

Gudang menyerahkan dari dokumen Full Acc, per blok dan boleh sebagian. Setiap penyerahan membuat satu kelompok baris Material Keluar/BBM Keluar dengan batch UUID, permintaan UUID, item UUID dan alokasi UUID; tidak membuat baris total tambahan. Pemeriksaan stok dilakukan atas total kelompok sebelum seluruh baris dicatat. Transaksi terhubung tidak boleh diedit/dihapus langsung. Input Material Keluar umum juga memiliki tombol Banyak blok dengan mesin pembagian yang sama. Jumlah satuan buah/unit/batang/lembar bulat; satuan lain 2 desimal untuk pembagian baru. Riwayat lama tidak dibulatkan ulang.

Petugas dengan hak opname atau gudang membuat penghitungan material terpilih, mengunci stok acuan dan jejak transaksi saat mulai. Hasil fisik 0 berbeda dari belum diisi. Setiap selisih wajib diberi alasan. KTU melihat stok acuan, fisik, selisih, alasan, stok terkini dan proyeksi setelah acc. Selisih diterapkan melalui web.stokOpname saat status Disetujui; bukan penerimaan supplier atau pemakaian divisi. Transaksi baru sesudah acuan tetap dihitung. Koreksi/penghapusan transaksi acuan dan penyesuaian opname lain memerlukan hitung ulang. Opname terbuka untuk material sama tidak boleh tumpang tindih. KTU dapat mengembalikan draf atau membatalkan penyesuaian beralasan; pembatalan diblokir bila ada opname baru yang bergantung padanya atau menyebabkan stok negatif.

web.permintaanMaterial dan web.stokOpname bersifat dokumen utuh. Perubahan bersamaan pada dokumen yang sama ditolak saat gabung tiga arah agar persetujuan tidak bercampur dengan jumlah yang berbeda. Dokumen berbeda masih digabung; batas jatah, stok dan tumpang tindih opname diperiksa lagi sebelum simpan. Hak baru hanya ditambahkan sebagai pilihan/preset; tidak otomatis diberikan ke pengguna yang telah ada. Pembatasan tetap pada aplikasi seperti payroll, bukan otorisasi server. Ekspor/impor aplikasi desktop belum menghitung penyesuaian web; gunakan web sebagai sumber stok bila opname telah dipakai.

Jika sisa permintaan Full Acc kekurangan stok, petugas Gudang dengan cakupan divisi dapat membuka Buat SPPB terkait. Form SPPB berisi usulan kekurangan dan nomor permintaan; petugas memeriksa order yang sudah ada dan merevisi jumlah sebelum mengajukan. SPPB tetap melalui alur persetujuan pembelian normal.


## BBM keluar banyak blok / lokasi

Form BBM Keluar baru menyediakan Tanpa blok/lokasi (bawaan), jumlah manual per blok/lokasi, dan proporsi luas Master Blok. Divisi tetap wajib. Lokasi bebas seperti bengkel dapat ditambahkan dalam mode manual tanpa membuat Master Blok baru. Total pembagian harus sama dengan total liter keluar; blok master harus sesuai divisi dan lokasi tidak boleh ganda. Kelompok disimpan atomik sebagai baris per blok/lokasi dengan batch yang sama, tanpa baris total tambahan. Unit ALB/kendaraan atau alsintan, penerima dan keperluan tetap dicatat pada semua baris. Koreksi riwayat tetap per baris/blok seperti aplikasi desktop; tidak mengubah pembagian baris lain.

Form permintaan mandor menampilkan stok Gudang dan satuan saat memilih material, termasuk saldo nol dan hasil opname. Jumlah yang melebihi stok diberi penanda kekurangan; pengajuan tidak diblokir karena masih dapat ditindaklanjuti pembelian. Angka berdasarkan data yang terakhir dimuat, bukan reservasi stok.


## Tampilan khusus Mandor

Mandor hanya membuka Dashboard, Permintaan Mandor dan Ganti password/PIN sendiri. Rute langsung ke halaman lainnya ditolak oleh pemeriksaan hak aplikasi. Dashboard mandor berisi ringkasan dan daftar permintaan sendiri serta pencarian stok material untuk pengajuan; tidak memuat transaksi umum, pemakaian divisi lain, SPPB, BBM atau stok opname. Daftar permintaan mandor hanya miliknya dan dalam cakupan divisinya. Kepala Divisi/KTU tetap melihat permintaan menurut cakupan divisi, petugas Gudang menurut hak Gudang. Akun peran Mandor tidak mendapat hak transaksi langsung/persetujuan meski ada flag operasional yang keliru; ganti peran jika petugas memang ditugaskan pada fungsi lain. Batas otorisasi tetap pada aplikasi, sesuai arsitektur payroll yang disepakati.
