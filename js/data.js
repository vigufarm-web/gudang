// data.js — isi database gudang dipegang di memori, dibaca & disimpan ke repo GitHub.
//
// Satu file data = seluruh isi gudang.db aplikasi desktop, dikemas jadi satu
// amplop terenkripsi di data/gudang.json. Nomor `rev` dan `sha` menjaga agar
// perubahan orang lain tidak tertimpa.

import { bukaAmplop, kunciAmplop } from './kunci.js?v=4';
import * as gh from './github.js?v=4';
import { unduhTeks } from './ui.js?v=4';
import * as P from './pengguna.js?v=4';

const KUNCI_NAMA = 'app.nama';
export const PATH = 'data/gudang.json';

export const state = {
  path: PATH,
  data: null,       // { aplikasi:'Gudang', rev, tabel:{...}, settings:{...}, web:{...} }
  meta: null,
  sha: '',
  password: '',
  belumDisimpan: false,
  dasarJson: '',    // potret saat terakhir dimuat — dipakai penggabungan
  gabungTerakhir: 0,
};

export const TABEL_SEMUA = [
  'master_material', 'master_divisi', 'master_kategori', 'master_satuan', 'master_blok',
  'material_masuk', 'material_keluar', 'sppb', 'sppb_items',
];

export const namaPengisi = () => P.siapa()?.nama || localStorage.getItem(KUNCI_NAMA) || state.data?.settings?.default_nama_admin || 'OJORA';
export const setNamaPengisi = (n) => localStorage.setItem(KUNCI_NAMA, (n || '').trim());

const KOSONG = [];
export function baris(tabel) {
  const semua = state.data?.tabel;
  if (!semua) return KOSONG;
  if (!semua[tabel]) semua[tabel] = [];
  return semua[tabel];
}

export const cari = (tabel, id) => baris(tabel).find((r) => Number(r.id) === Number(id)) || null;

export const idBaru = (tabel) => baris(tabel).reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;

// Dipanggil setiap ada perubahan yang belum disimpan (app memasang pendengar
// untuk simpan-otomatis).
let pendengarBerubah = null;
export const saatBerubah = (fn) => { pendengarBerubah = fn; };
export function tandaiBerubah() {
  state.belumDisimpan = true;
  jadwalkanDraf();
  try { pendengarBerubah?.(); } catch { /* jangan ganggu alur input */ }
}

export function tambah(tabel, isi) {
  P.jagaTransaksi('tambah', tabel, null, isi);
  const r = { id: idBaru(tabel), ...isi };
  baris(tabel).push(r);
  // item baru pada SPPB yang sudah di-acc = isinya berubah → acc gugur
  if (tabel === 'sppb_items') gugurkanAcc(r.sppb_id, 'item ditambah');
  tandaiBerubah();
  return r;
}

export function ubah(tabel, id, tambalan) {
  const r = cari(tabel, id);
  if (!r) throw new Error('Baris tidak ditemukan.');
  P.jagaTransaksi('ubah', tabel, r, {...r,...tambalan});
  Object.assign(r, tambalan);
  if (tabel === 'sppb') gugurkanAcc(id, 'SPPB direvisi');
  if (tabel === 'sppb_items') gugurkanAcc(r.sppb_id, `item "${r.material}" direvisi`);
  tandaiBerubah();
  return r;
}

export function hapus(tabel, id) {
  const semua = baris(tabel);
  const i = semua.findIndex((r) => Number(r.id) === Number(id));
  if (i < 0) return false;
  P.jagaTransaksi('hapus', tabel, semua[i], null);
  if (tabel === 'sppb_items') {
    gugurkanAcc(semua[i].sppb_id, `item "${semua[i].material}" dihapus`);
    // ceklis order item ini ikut dibuang — id item bisa terpakai ulang
    if (state.data?.web?.orderItem) delete state.data.web.orderItem[String(id)];
  }
  semua.splice(i, 1);
  // ikut aturan aplikasi desktop: menghapus SPPB/itemnya tidak menghapus
  // material masuk yang sudah tercatat — hanya melepas link-nya.
  if (tabel === 'sppb_items') {
    for (const m of baris('material_masuk')) {
      if (Number(m.sppb_item_id) === Number(id)) m.sppb_item_id = null;
    }
  }
  if (tabel === 'sppb') {
    const anak = baris('sppb_items').filter((it) => Number(it.sppb_id) === Number(id));
    for (const it of anak) hapus('sppb_items', it.id);
    // catatan acc-nya ikut dibuang: id SPPB bisa terpakai ulang oleh SPPB
    // baru (id = terbesar + 1), dan SPPB baru TIDAK boleh mewarisi acc lama.
    if (state.data?.web?.accSppb) delete state.data.web.accSppb[String(id)];
  }
  tandaiBerubah();
  return true;
}

export function pengaturan() {
  if (!state.data) return {};
  state.data.settings ||= {};
  return state.data.settings;
}

export function setPengaturan(kunci, nilai) {
  P.wajibAdmin();
  pengaturan()[kunci] = nilai;
  tandaiBerubah();
}

export function web() {
  if (!state.data) return {};
  state.data.web ||= {};
  return state.data.web;
}

// =====================================================================
// PERSETUJUAN SPPB — acc berjenjang Kepala Divisi → KTU → full acc.
//
// Disimpan di bagian `web` berkas data (bukan tabel database), supaya
// aplikasi desktop tidak perlu diubah skemanya:
//   web.kepala  : { "<divisi kecil>": { divisi, nama, pin, ttd } }
//   web.ktu     : { nama, pin, ttd }
//   web.accSppb : { "<sppb id>": { kepala:{status,oleh,waktu,alasan?},
//                                  ktu:{...}, riwayat:[{aksi,oleh,waktu,ket}] } }
// `ttd` = gambar tanda tangan (base64 PNG) yang ditempel di surat cetak.
// =====================================================================

const sekarang = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export const STATUS_ACC = {
  MENUNGGU_KEPALA: 'Menunggu Kepala Divisi',
  MENUNGGU_KTU: 'Menunggu KTU',
  FULL: 'Full Acc',
  DITOLAK: 'Ditolak',
  LAMA: 'Lama',   // dibuat sebelum fitur acc ada — tidak perlu di-acc
};

/**
 * Batas SPPB lama: SPPB ber-id sampai angka ini (dan belum pernah disentuh
 * keputusan apa pun) dianggap LAMA — tidak perlu di-acc dan tidak masuk
 * antrean. Hanya PENGAJUAN BARU yang lewat alur kepala divisi → KTU.
 *
 * Angkanya ditetapkan sekali: saat ekspor pertama (tools/ekspor_gudang.py)
 * atau saat data pertama kali dibuka di situs, lalu ikut tersimpan.
 */
export function accBatasId() {
  const w = web();
  if (w.accBatasId == null) {
    // sengaja TIDAK menandai "belum disimpan" — ini penetapan diam-diam yang
    // ikut terbawa pada penyimpanan berikutnya
    w.accBatasId = baris('sppb').reduce((m, s) => Math.max(m, Number(s.id) || 0), 0);
  }
  return Number(w.accBatasId) || 0;
}

/** Daftar kepala divisi per divisi (kunci: nama divisi huruf kecil). */
export function daftarKepala() {
  const w = web();
  w.kepala ||= {};
  return w.kepala;
}

export const kepalaDivisi = (divisi) => daftarKepala()[kecil(divisi)] || null;

export function setKepalaDivisi(divisi, { nama, pin, ttd } = {}) {
  P.wajibAdmin();
  const k = kecil(divisi);
  if (!k) return;
  const lama = daftarKepala()[k] || {};
  daftarKepala()[k] = {
    divisi: rapikan(divisi),
    nama: nama !== undefined ? rapikan(nama) : (lama.nama || ''),
    pin: pin !== undefined ? String(pin || '') : (lama.pin || ''),
    ttd: ttd !== undefined ? (ttd || '') : (lama.ttd || ''),
  };
  tandaiBerubah();
}

export function hapusKepalaDivisi(divisi) {
  P.wajibAdmin();
  delete daftarKepala()[kecil(divisi)];
  tandaiBerubah();
}

export function ktu() {
  const w = web();
  w.ktu ||= { nama: '', pin: '', ttd: '' };
  return w.ktu;
}

export function setKtu({ nama, pin, ttd } = {}) {
  P.wajibAdmin();
  const k = ktu();
  if (nama !== undefined) k.nama = rapikan(nama);
  if (pin !== undefined) k.pin = String(pin || '');
  if (ttd !== undefined) k.ttd = ttd || '';
  tandaiBerubah();
}

export const catatanAcc = (sppbId) => web().accSppb?.[String(sppbId)] || null;

function catatanAccTulis(sppbId) {
  const w = web();
  w.accSppb ||= {};
  w.accSppb[String(sppbId)] ||= { riwayat: [] };
  const c = w.accSppb[String(sppbId)];
  c.riwayat ||= [];
  return c;
}

function catatJejak(c, aksi, oleh, ket = '') {
  c.riwayat.push({ aksi, oleh: rapikan(oleh) || 'Web', waktu: sekarang(), ket: rapikan(ket) });
  // jejak dibatasi 60 entri terakhir per SPPB supaya berkas tidak membengkak
  if (c.riwayat.length > 60) c.riwayat.splice(0, c.riwayat.length - 60);
}

/**
 * Status acc satu SPPB. SPPB lama (id <= accBatasId, tanpa keputusan) = LAMA:
 * tidak perlu di-acc dan tidak masuk antrean maupun Kantor Pusat. Sisanya:
 * Menunggu Kepala Divisi → Menunggu KTU → Full Acc, atau Ditolak.
 */
export function statusAcc(sppbId) {
  const c = catatanAcc(sppbId);
  // SPPB lama (dibuat sebelum fitur acc, belum pernah ada keputusan) tidak
  // perlu di-acc — alur persetujuan hanya untuk pengajuan baru.
  if (!c?.kepala && !c?.ktu && Number(sppbId) <= accBatasId()) return STATUS_ACC.LAMA;
  if (c?.kepala?.status === 'ditolak' || c?.ktu?.status === 'ditolak') return STATUS_ACC.DITOLAK;
  const kepalaOk = c?.kepala?.status === 'disetujui';
  const ktuOk = c?.ktu?.status === 'disetujui';
  if (kepalaOk && ktuOk) return STATUS_ACC.FULL;
  if (!kepalaOk) return STATUS_ACC.MENUNGGU_KEPALA;
  return STATUS_ACC.MENUNGGU_KTU;
}

/** Waktu full acc = waktu acc tahap terakhir (KTU). */
export const waktuFullAcc = (sppbId) => {
  const c = catatanAcc(sppbId);
  if (statusAcc(sppbId) !== STATUS_ACC.FULL) return '';
  return c?.ktu?.waktu || c?.kepala?.waktu || '';
};

/** tahap: 'kepala' | 'ktu'. KTU hanya boleh acc setelah kepala divisi. */
export function setujuiSppb(sppbId, tahap, oleh) {
  P.jagaAcc(sppbId,tahap);
  oleh = namaPengisi();
  if (!cari('sppb', sppbId)) throw new Error('SPPB tidak ditemukan.');
  if (tahap === 'ktu' && catatanAcc(sppbId)?.kepala?.status !== 'disetujui') {
    throw new Error('Acc KTU menunggu acc kepala divisi dulu.');
  }
  const c = catatanAccTulis(sppbId);
  if (c[tahap]?.status === 'ditolak') throw new Error('SPPB ini sudah ditolak. Kembalikan dulu ke antrean.');
  c[tahap] = { status: 'disetujui', oleh: rapikan(oleh), waktu: sekarang() };
  catatJejak(c, `acc ${tahap === 'ktu' ? 'KTU' : 'kepala divisi'}`, oleh);
  tandaiBerubah();
}

/** Menolak TIDAK menghapus SPPB — statusnya Ditolak, alasannya tercatat. */
export function tolakSppb(sppbId, tahap, oleh, alasan) {
  P.jagaAcc(sppbId,tahap);
  oleh = namaPengisi();
  const bersih = rapikan(alasan);
  if (!bersih) throw new Error('Alasan penolakan wajib diisi supaya koreksinya bisa ditelusuri.');
  const c = catatanAccTulis(sppbId);
  c[tahap] = { status: 'ditolak', oleh: rapikan(oleh), waktu: sekarang(), alasan: bersih };
  catatJejak(c, `tolak ${tahap === 'ktu' ? 'KTU' : 'kepala divisi'}`, oleh, bersih);
  tandaiBerubah();
}

/** Membatalkan acc/tolak satu tahap: kembali menunggu, tercatat siapa & kenapa.
 *  Batal acc kepala otomatis menggugurkan acc KTU (urutannya berjenjang). */
export function batalkanAccSppb(sppbId, tahap, oleh, ket = '') {
  P.jagaAcc(sppbId,tahap,true);
  oleh = namaPengisi();
  const c = catatanAccTulis(sppbId);
  const sebelum = c[tahap]?.status || 'menunggu';
  delete c[tahap];
  if (tahap === 'kepala' && c.ktu?.status === 'disetujui') {
    delete c.ktu;
    catatJejak(c, 'acc KTU ikut gugur', oleh, 'acc kepala divisi dibatalkan');
  }
  catatJejak(c, `batalkan ${sebelum} ${tahap === 'ktu' ? 'KTU' : 'kepala divisi'}`, oleh, ket);
  tandaiBerubah();
}

/** Dipanggil otomatis saat SPPB/itemnya direvisi: semua acc gugur, kembali
 *  ke antrean kepala divisi. Tidak ada revisi yang lolos tanpa acc ulang. */
export function gugurkanAcc(sppbId, ket) {
  const c = catatanAcc(sppbId);
  if (!c) return;
  const adaKeputusan = ['kepala', 'ktu'].some((t) => c[t]?.status);
  if (!adaKeputusan) return;
  const siapa = ['kepala', 'ktu'].filter((t) => c[t]?.status === 'disetujui')
    .map((t) => (t === 'ktu' ? 'KTU' : 'kepala divisi'));
  delete c.kepala;
  delete c.ktu;
  // ceklis order Semarang ikut gugur — isinya berubah, ordernya harus
  // ditinjau ulang setelah acc baru
  const w = web();
  let ceklisGugur = 0;
  if (w.orderItem) {
    for (const it of baris('sppb_items')) {
      if (Number(it.sppb_id) === Number(sppbId) && w.orderItem[String(it.id)]) {
        delete w.orderItem[String(it.id)];
        ceklisGugur++;
      }
    }
  }
  catatJejak(c, 'acc gugur karena revisi', namaPengisi() || 'Web',
    `${ket}${siapa.length ? ` — acc ${siapa.join(' & ')} dikembalikan ke antrean` : ''}`
    + `${ceklisGugur ? ` — ${ceklisGugur} ceklis order ikut dibersihkan` : ''}`);
  tandaiBerubah();
}

/** Jumlah SPPB yang masih menunggu acc (lencana menu). */
export const jumlahMenungguAcc = () => baris('sppb')
  .filter((s) => [STATUS_ACC.MENUNGGU_KEPALA, STATUS_ACC.MENUNGGU_KTU].includes(statusAcc(s.id))).length;

// =====================================================================
// CEKLIS ORDER ADMIN SEMARANG — setelah SPPB full acc, admin kantor pusat
// (Semarang) menceklis item mana saja yang SUDAH DIORDER. Admin gudang
// melihat ceklisannya; begitu barang datang dan Material Masuk di-link ke
// item SPPB, sisanya berkurang otomatis — jadi tiap item ketahuan:
// Belum Diorder → Diorder → Sampai Sebagian → Sampai.
//   web.orderItem : { "<sppb_item_id>": { oleh, waktu } }
// =====================================================================

export const orderItem = (itemId) => web().orderItem?.[String(itemId)] || null;

export function setItemBatal(itemId, batal, oleh, alasan = '') {
  const it = cari('sppb_items',itemId), s = it && cari('sppb',it.sppb_id);
  if (!s || !P.cakupan(s.divisi_pemohon) || !P.punya('batal') || !(P.punya('kepala') || P.punya('ktu'))) {
    throw new Error('Tidak memiliki hak pembatalan item untuk divisi ini.');
  }
  if (batal && !rapikan(alasan)) throw new Error('Alasan pembatalan wajib diisi.');
  const w = web(); w.batalItem ||= {};
  if (batal) w.batalItem[String(itemId)] = {oleh:namaPengisi(),waktu:sekarang(),alasan:rapikan(alasan)};
  else delete w.batalItem[String(itemId)];
  catatJejak(catatanAccTulis(s.id),batal ? 'batalkan item' : 'pulihkan item',namaPengisi(),`${it.material}: ${alasan}`);
  tandaiBerubah();
}

export function setOrderItem(itemId, diorder, oleh) {
  P.jagaOrder(itemId);
  oleh = namaPengisi();
  const w = web();
  w.orderItem ||= {};
  if (diorder) {
    w.orderItem[String(itemId)] = { oleh: rapikan(oleh) || 'Admin Semarang', waktu: sekarang() };
  } else {
    delete w.orderItem[String(itemId)];
  }
  tandaiBerubah();
}

/** Status order satu item (dari baris laporanSppb: punya realisasi & sisa). */
export function statusOrderItem(it) {
  const sampai = (Number(it.realisasi) || 0) > 0;
  if (sampai && it.sisa <= 0) return 'Sampai';
  if (sampai) return 'Sampai Sebagian';
  if (orderItem(it.id)) return 'Diorder';
  return 'Belum Diorder';
}

/** Status order satu SPPB (gabungan itemnya). */
export function statusOrderSppb(s) {
  const st = s.items.map(statusOrderItem);
  if (!st.length) return 'Tanpa Item';
  if (st.every((x) => x === 'Sampai')) return 'Sampai Semua';
  if (st.some((x) => x === 'Sampai' || x === 'Sampai Sebagian')) return 'Sampai Sebagian';
  if (st.every((x) => x === 'Diorder')) return 'Sudah Diorder';
  if (st.some((x) => x === 'Diorder')) return 'Diorder Sebagian';
  return 'Belum Diorder';
}

/** Nomor SPPB berikutnya: lanjut otomatis dari nomor angka terbesar
 *  (2696 → 2697). Nomor yang bukan angka murni diabaikan. */
export function nomorSppbBerikut() {
  let maks = 0;
  for (const s of baris('sppb')) {
    const n = String(s.no_sppb || '').trim();
    if (/^\d+$/.test(n)) maks = Math.max(maks, parseInt(n, 10));
  }
  return maks ? String(maks + 1) : '';
}

// ------------------------------------------------------------ teks & master
const rapikan = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const kecil = (s) => rapikan(s).toLowerCase();

/** Cari baris master berdasarkan nama (tanpa peduli besar kecil huruf). */
export const masterDenganNama = (tabel, nama) => baris(tabel).find((r) => kecil(r.nama) === kecil(nama)) || null;

/** Seperti ensure_material / ensure_divisi di aplikasi desktop: nama baru
 *  yang diketik di form otomatis masuk master. */
export function pastikanMaster(tabel, nama, ekstra = {}) {
  const bersih = rapikan(nama);
  if (!bersih) return null;
  let r = masterDenganNama(tabel, bersih);
  if (!r) {
    r = tambah(tabel, { nama: bersih, ...ekstra });
  } else if (P.admin() && tabel === 'master_material' && !r.satuan_default && ekstra.satuan_default) {
    r.satuan_default = ekstra.satuan_default;
    tandaiBerubah();
  }
  return r;
}

/** Normalisasi satuan ke ejaan master (mis. "liter" → "Liter"). */
export function normalkanSatuan(nama) {
  const bersih = rapikan(nama);
  if (!bersih) return '';
  const r = masterDenganNama('master_satuan', bersih);
  if (r) return r.nama;
  tambah('master_satuan', { nama: bersih });
  return bersih;
}

export const satuanBawaan = (material) => masterDenganNama('master_material', material)?.satuan_default || '';
export const kategoriMaterial = (material) => masterDenganNama('master_material', material)?.kategori || '';

const dekatNol = (v, batas = 0.005) => (Math.abs(v) < batas ? 0 : v);

// --------------------------------------------------------------- stok
/** Stok gudang per material (masuk − keluar), opsional difilter kategori. */
export function laporanStok(kategoriFilter = null) {
  const peta = new Map();   // kunci: material|satuan (huruf kecil)
  const ambil = (r) => {
    const k = `${kecil(r.material)}|${kecil(r.satuan)}`;
    if (!peta.has(k)) peta.set(k, { material: rapikan(r.material), satuan: rapikan(r.satuan), masuk: 0, keluar: 0 });
    return peta.get(k);
  };
  for (const r of baris('material_masuk')) ambil(r).masuk += Number(r.qty) || 0;
  for (const r of baris('material_keluar')) ambil(r).keluar += Number(r.qty) || 0;
  const hasil = [];
  for (const v of peta.values()) {
    const kategori = kategoriMaterial(v.material);
    if (kategoriFilter && kecil(kategori) !== kecil(kategoriFilter)) continue;
    hasil.push({ ...v, kategori, stok: dekatNol(v.masuk - v.keluar) });
  }
  hasil.sort((a, b) => a.material.localeCompare(b.material, 'id'));
  return hasil;
}

/** Saldo material per divisi = masuk ke divisi itu − keluar dari divisi itu. */
export function laporanStokDivisi(kategoriFilter = null) {
  const peta = new Map();
  const ambil = (r) => {
    const k = `${kecil(r.divisi)}|${kecil(r.material)}|${kecil(r.satuan)}`;
    if (!peta.has(k)) {
      peta.set(k, { divisi: rapikan(r.divisi), material: rapikan(r.material), satuan: rapikan(r.satuan), masuk: 0, keluar: 0 });
    }
    return peta.get(k);
  };
  for (const r of baris('material_masuk')) if (rapikan(r.divisi)) ambil(r).masuk += Number(r.qty) || 0;
  for (const r of baris('material_keluar')) if (rapikan(r.divisi)) ambil(r).keluar += Number(r.qty) || 0;
  const hasil = [];
  for (const v of peta.values()) {
    const kategori = kategoriMaterial(v.material);
    if (kategoriFilter && kecil(kategori) !== kecil(kategoriFilter)) continue;
    hasil.push({ ...v, kategori, stok: dekatNol(v.masuk - v.keluar) });
  }
  hasil.sort((a, b) => a.divisi.localeCompare(b.divisi, 'id') || a.material.localeCompare(b.material, 'id'));
  return hasil;
}

// --------------------------------------------------------------- SPPB
/** Realisasi satu item SPPB = total material masuk yang di-link ke item itu. */
export const realisasiItem = (itemId) => baris('material_masuk')
  .filter((m) => Number(m.sppb_item_id) === Number(itemId))
  .reduce((n, m) => n + (Number(m.qty) || 0), 0);

/** Semua SPPB + item + realisasi + sisa + status (padanan sppb_full_report). */
export function laporanSppb() {
  const hasil = [];
  const semuaItem = baris('sppb_items');
  const daftar = [...baris('sppb')].sort((a, b) =>
    String(b.tanggal).localeCompare(String(a.tanggal)) || (b.id - a.id));
  for (const s of daftar) {
    const items = semuaItem.filter((it) => Number(it.sppb_id) === Number(s.id)).map((it) => {
      const realisasi = realisasiItem(it.id);
      const diminta = Number(it.qty_diminta) || 0;
      const sisa = dekatNol(diminta - realisasi);
      const status = realisasi <= 0 ? 'Belum Realisasi' : sisa > 0 ? 'Sebagian' : 'Selesai';
      const batal = web().batalItem?.[String(it.id)] || null;
      return { ...it, realisasi, sisa:batal ? 0 : sisa, status:batal ? 'Dibatalkan' : status, batal };
    });
    const st = items.filter((it) => !it.batal).map((it) => it.status);
    const status_keseluruhan = !st.length ? 'Tanpa Item'
      : st.every((x) => x === 'Selesai') ? 'Selesai'
        : st.every((x) => x === 'Belum Realisasi') ? 'Belum Realisasi' : 'Sebagian';
    hasil.push({ ...s, items, status_keseluruhan });
  }
  return hasil;
}

/** Item SPPB yang sisanya > 0 — untuk dropdown link di form Material Masuk. */
export function itemSppbTerbuka(materialFilter = null, sertakanItemId = null) {
  const hasil = [];
  for (const s of laporanSppb()) {
    for (const it of s.items) {
      const terpilih = sertakanItemId != null && Number(it.id) === Number(sertakanItemId);
      if (it.batal && !terpilih) continue;
      if (it.sisa <= 1e-9 && !terpilih) continue;
      if (materialFilter && kecil(it.material) !== kecil(materialFilter) && !terpilih) continue;
      hasil.push({
        sppb_item_id: it.id,
        no_sppb: s.no_sppb,
        material: it.material,
        satuan: it.satuan,
        sisa: it.sisa,
      });
    }
  }
  return hasil;
}

export const nomorSppbDariItem = (itemId) => {
  const it = cari('sppb_items', itemId);
  return it ? (cari('sppb', it.sppb_id)?.no_sppb || '') : '';
};

// ----------------------------------------------------------- muat & simpan
export async function intipMeta() {
  const { isi } = await gh.bacaFile(state.path);
  state.metaIntip = isi?.meta || null;
  return state.metaIntip;
}

export async function muat(password) {
  const { isi, sha } = await gh.bacaFile(state.path);
  if (!isi) {
    throw new Error(`Belum ada file data (${state.path}). `
      + 'Jalankan tools/ekspor_gudang.py di komputer yang ada gudang.db-nya dulu.');
  }
  const data = await bukaAmplop(isi, password);
  if (data.aplikasi !== 'Gudang') throw new Error('Isi file data bukan data gudang.');
  data.tabel ||= {};
  for (const t of TABEL_SEMUA) data.tabel[t] ||= [];
  state.data = data;
  state.meta = isi.meta || null;
  state.sha = sha;
  state.password = password;
  state.belumDisimpan = false;
  state.dasarJson = JSON.stringify(data);
  gh.setTokenBersama(data.web?.token || '');
  return data;
}

function hitungIsi() {
  const tanggal = [
    ...baris('material_masuk').map((r) => r.tanggal),
    ...baris('material_keluar').map((r) => r.tanggal),
  ].filter(Boolean).sort();
  return {
    jumlah: {
      material: baris('master_material').length,
      masuk: baris('material_masuk').length,
      keluar: baris('material_keluar').length,
      sppb: baris('sppb').length,
    },
    tanggal,
  };
}

function susunMeta() {
  const { jumlah, tanggal } = hitungIsi();
  return {
    aplikasi: 'Gudang',
    label: state.meta?.label || 'Gudang Material',
    rev: Number(state.data.rev) || 0,
    diperbarui: new Date().toISOString().slice(0, 19),
    dari: namaPengisi() ? `Web — ${namaPengisi()}` : 'Web',
    jumlah,
    periode: { dari: tanggal[0] || '', sampai: tanggal.at(-1) || '' },
  };
}

/** Mode lokal: halaman dibuka tanpa repo GitHub (ujicoba di komputer). */
export const modeLokal = () => !gh.lokasiRepo();

export async function simpan(pesan) {
  if (!P.siapa()) throw new Error('Masuk sebagai pengguna dulu.');
  if (!state.data) throw new Error('Belum ada data yang dimuat.');
  if (!state.password) throw new Error('Password data belum dimasukkan.');
  state.gabungTerakhir = 0;
  const judul = namaPengisi() ? `${pesan} (${namaPengisi()})` : pesan;

  // Dua orang bisa menyimpan hampir bersamaan: yang kedua kena tolak (409).
  // Alih-alih menyerah, perubahan LOKAL digabungkan ke data TERBARU lalu
  // dicoba simpan lagi — tidak ada input siapa pun yang hilang.
  for (let percobaan = 0; ; percobaan++) {
    state.data.rev = (Number(state.data.rev) || 0) + 1;
    state.data.dibuat = new Date().toISOString().slice(0, 19);
    state.data.dari = namaPengisi() ? `Web — ${namaPengisi()}` : 'Web';
    const meta = susunMeta();
    const amplop = await kunciAmplop(state.data, state.password, meta);

    if (modeLokal()) {
      unduhTeks('gudang.json', JSON.stringify(amplop), 'application/json');
      state.meta = meta;
      state.belumDisimpan = false;
      hapusDraf();
      return state.data.rev;
    }

    try {
      state.sha = await gh.tulisFile(state.path, amplop, state.sha, judul);
      state.meta = meta;
      state.belumDisimpan = false;
      state.dasarJson = JSON.stringify(state.data);
      hapusDraf();
      return state.data.rev;
    } catch (e) {
      state.data.rev -= 1;
      if (!e.bentrok || percobaan >= 2) throw e;
      const { isi, sha } = await gh.bacaFile(state.path);
      if (!isi) throw e;
      const terbaru = await bukaAmplop(isi, state.password);
      const dasar = state.dasarJson ? JSON.parse(state.dasarJson) : terbaru;
      state.data = gabungTiga(dasar, state.data, terbaru);
      state.sha = sha;
      state.dasarJson = JSON.stringify(terbaru);
      state.gabungTerakhir++;
    }
  }
}

/**
 * Gabung tiga arah: `dasar` (saat terakhir dimuat), `lokal` (dengan perubahan
 * admin ini), `remote` (yang telanjur tersimpan orang lain).
 * - Baris BARU lokal diberi id baru supaya tidak menabrak baris orang lain
 *   (link sppb_item_id pada material masuk ikut dipetakan ulang).
 * - Baris yang DIUBAH lokal menimpa baris yang sama di remote.
 * - Baris yang DIHAPUS lokal dihapus juga dari remote.
 */
export function gabungTiga(dasar, lokal, remote) {
  const hasil = JSON.parse(JSON.stringify(remote));
  hasil.tabel ||= {};
  const beda = (a, b) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  const petaId = {};   // tabel -> Map(id lokal -> id final)

  for (const t of TABEL_SEMUA) {
    const bDasar = new Map((dasar.tabel?.[t] || []).map((r) => [Number(r.id), r]));
    const bLokal = lokal.tabel?.[t] || [];
    const idLokal = new Set(bLokal.map((r) => Number(r.id)));
    hasil.tabel[t] ||= [];
    const bHasil = hasil.tabel[t];
    const petaT = new Map();
    petaId[t] = petaT;

    // hapus: ada di dasar, hilang di lokal
    for (const id of bDasar.keys()) {
      if (!idLokal.has(id)) {
        const i = bHasil.findIndex((r) => Number(r.id) === id);
        if (i >= 0) bHasil.splice(i, 1);
      }
    }
    let idBerikut = bHasil.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
    for (const r of bLokal) {
      const id = Number(r.id);
      const asal = bDasar.get(id);
      if (!asal) {
        // baris baru lokal → id baru supaya tidak menabrak baris baru remote
        const salinan = { ...r, id: idBerikut++ };
        petaT.set(id, salinan.id);
        bHasil.push(salinan);
      } else if (beda(r, asal)) {
        const i = bHasil.findIndex((x) => Number(x.id) === id);
        if (i >= 0) bHasil[i] = { ...r };
        else bHasil.push({ ...r });   // remote menghapusnya; perubahan lokal menang
        petaT.set(id, id);
      } else {
        petaT.set(id, id);
      }
    }
  }

  // link material_masuk → sppb_items ikut pemetaan id baru
  const petaItem = petaId.sppb_items;
  const petaSppb = petaId.sppb;
  for (const m of hasil.tabel.material_masuk || []) {
    if (m.sppb_item_id != null && petaItem.has(Number(m.sppb_item_id))) {
      m.sppb_item_id = petaItem.get(Number(m.sppb_item_id));
    }
  }
  for (const it of hasil.tabel.sppb_items || []) {
    if (petaSppb.has(Number(it.sppb_id))) it.sppb_id = petaSppb.get(Number(it.sppb_id));
  }

  // settings & web: hanya kunci yang benar-benar diubah lokal yang menimpa.
  // Untuk nilai berupa objek (mis. web.accSppb), penggabungan turun per
  // sub-kunci — jadi dua orang yang meng-acc SPPB BERBEDA pada saat yang
  // sama tidak saling menghapus keputusan satu sama lain.
  const objekPolos = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  function gabungBagian(hasilB, dasarB, lokalB) {
    for (const k of new Set([...Object.keys(lokalB), ...Object.keys(dasarB)])) {
      const dl = lokalB[k];
      const dd = dasarB[k];
      if (!beda(dl, dd)) continue;   // tidak diubah lokal → ikut remote
      if (objekPolos(dl) && objekPolos(dd) && objekPolos(hasilB[k])) {
        gabungBagian(hasilB[k], dd, dl);
      } else if (dl === undefined) {
        delete hasilB[k];
      } else {
        hasilB[k] = JSON.parse(JSON.stringify(dl));
      }
    }
  }
  for (const bagian of ['settings', 'web']) {
    hasil[bagian] ||= {};
    gabungBagian(hasil[bagian], dasar[bagian] || {}, lokal[bagian] || {});
  }

  // catatan acc mengikuti id SPPB — kalau id SPPB baru lokal dipetakan ulang,
  // kunci catatannya ikut dipindah. (Kasus langka dua orang membuat SPPB
  // ber-id sama DAN meng-acc-nya sebelum tersimpan tetap dimenangkan lokal.)
  if (hasil.web?.accSppb && petaSppb.size) {
    const baru = {};
    for (const [k, v] of Object.entries(hasil.web.accSppb)) {
      const idFinal = petaSppb.has(Number(k)) ? petaSppb.get(Number(k)) : Number(k);
      baru[String(idFinal)] = v;
    }
    hasil.web.accSppb = baru;
  }
  // ceklis order mengikuti id ITEM — ikut pemetaan id item baru
  if (hasil.web?.orderItem && petaItem.size) {
    const baru = {};
    for (const [k, v] of Object.entries(hasil.web.orderItem)) {
      const idFinal = petaItem.has(Number(k)) ? petaItem.get(Number(k)) : Number(k);
      baru[String(idFinal)] = v;
    }
    hasil.web.orderItem = baru;
  }
  hasil.rev = Math.max(Number(remote.rev) || 0, Number(lokal.rev) || 0);
  return hasil;
}

// ---------------------------------------------------------------------
// DRAF CADANGAN LOKAL — pengaman mati listrik / tab tertutup. Beberapa detik
// setelah perubahan, seluruh data ditulis TERENKRIPSI ke penyimpanan peramban.
// Saat situs dibuka lagi dan drafnya belum terkirim (rev masih sama),
// pengguna ditawari memulihkannya. Dihapus begitu penyimpanan berhasil.
// ---------------------------------------------------------------------
const kunciDraf = () => `gudang.draf.${state.path}.${P.siapa()?.id || 'anonim'}`;
let timerDraf = null;
function jadwalkanDraf() {
  if (!state.password || !state.data) return;
  clearTimeout(timerDraf);
  timerDraf = setTimeout(async () => {
    try {
      const amp = await kunciAmplop(state.data, state.password, { draf: true });
      localStorage.setItem(kunciDraf(), JSON.stringify({
        rev: Number(state.data.rev) || 0, waktu: new Date().toISOString(), amp }));
    } catch { /* penyimpanan penuh / terblokir — lewati saja */ }
  }, 2500);
}

export function hapusDraf() {
  clearTimeout(timerDraf);
  try { localStorage.removeItem(kunciDraf()); } catch { /* abaikan */ }
}

export async function drafTersimpan() {
  try {
    const mentah = localStorage.getItem(kunciDraf());
    if (!mentah || !state.data) return null;
    const { rev, waktu, amp } = JSON.parse(mentah);
    if (Number(rev) !== (Number(state.data.rev) || 0)) {
      localStorage.removeItem(kunciDraf());
      return null;
    }
    const isi = await bukaAmplop(amp, state.password);
    return { waktu, data: isi };
  } catch { return null; }
}

export function pakaiDraf(draf) {
  state.data = draf.data;
  gh.setTokenBersama(draf.data.web?.token || '');
  tandaiBerubah();
}

/** Pulihkan isi data dari satu commit lama di GitHub (halaman Riwayat). */
export async function pulihkanVersiGitHub(ref) {
  P.wajibAdmin();
  const { isi } = await gh.bacaFilePadaRef(state.path, ref);
  if (!isi) throw new Error('Versi GitHub tidak ditemukan.');
  const data = await bukaAmplop(isi, state.password);
  if (data.aplikasi !== 'Gudang') throw new Error('Versi itu bukan data gudang.');
  data.rev = Math.max(Number(state.data?.rev) || 0, Number(data.rev) || 0);
  data.tabel ||= {};
  for (const t of TABEL_SEMUA) data.tabel[t] ||= [];
  state.data = data;
  gh.setTokenBersama(data.web?.token || '');
  tandaiBerubah();
  return data;
}
