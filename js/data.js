import {finishSavedSnapshot} from './save-state.js';
import {rebaseGISOnly,gisOnlyChanges,assertGISMerge,captureGISSnapshot,assertGISMasterEdit,assertGISBlockActive,assertGISMasterStructure} from './gis-model.js?v=gis-pages-3';
import * as W from './workflow.js?v=8';
import {jenisBbm} from './bbm-model.js?v=8';
import {hitungHargaOrder} from './harga-order-model.js';
import {saldoPemilik,namaPemilik,auditSaldoFisik,auditSemuaPemilik,periksaPerubahanSaldo} from './audit-pemilik-model.js';
// data.js — isi database gudang dipegang di memori, dibaca & disimpan ke repo GitHub.
//
// Satu file data = seluruh isi gudang.db aplikasi desktop, dikemas jadi satu
// amplop terenkripsi di data/gudang.json. Nomor `rev` dan `sha` menjaga agar
// perubahan orang lain tidak tertimpa.

import { bukaAmplop, kunciAmplop } from './kunci.js?v=8';
import * as gh from './github.js?v=8';
import { unduhTeks } from './ui.js?v=8';
import * as P from './pengguna.js?v=8';
import * as B from './pengadaan-model.js?v=8';

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

// History remains in the master, but only the active GIS representative is offered for new input.
export const blokDapatDipilih = (r) => !!r && r.gis_active !== false &&
  (r.gis_canonical_local_id == null || String(r.gis_canonical_local_id) === String(r.id));

export const cari = (tabel, id) => baris(tabel).find((r) => Number(r.id) === Number(id)) || null;
export const saldoMilik = (material,satuan,pemilik) => saldoPemilik(state.data,material,satuan,pemilik);
export const auditMilik = (material,satuan) => auditSaldoFisik(state.data,material,satuan);

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
  assertGISMasterStructure(state.data,'gudang',tabel);
  if(tabel==='material_keluar')assertGISBlockActive(state.data,'gudang',isi);
  if(tabel==='material_keluar'&&isi.permintaan_id)throw Error('Penyerahan permintaan wajib melalui detail permintaan.');
  if(tabel==='material_masuk'&&isi.order_id){const o=web().pesanan?.[isi.order_id],it=o&&cari('sppb_items',o.sppb_item_id);if(!it||statusAcc(it.sppb_id)!==STATUS_ACC.FULL)throw Error('SPPB order ini belum disetujui / sedang menunggu persetujuan ulang.');}
  if(tabel==='material_masuk'&&isi.order_id){isi=B.susunPenerimaan(state.data,isi);if(!jenisBbm(isi.material)&&!isi.pemilik_stok)throw Error('Divisi pemohon SPPB belum tercatat. Periksa SPPB sebelum menerima barang.');}
  if(tabel==='material_masuk'&&!isi.order_id){
    if(!jenisBbm(isi.material)){
      const item=isi.sppb_item_id&&cari('sppb_items',isi.sppb_item_id),sppb=item&&cari('sppb',item.sppb_id);
      isi={...isi,pemilik_stok:namaPemilik(sppb?.divisi_pemohon||isi.pemilik_stok)};
    }
    isi={...isi,divisi:'Gudang'};validasiMasukBiasa(isi);
  }
  if(tabel==='material_keluar')validasiPengeluaran(isi);
  P.jagaTransaksi('tambah', tabel, null, isi);
  const r = { id: idBaru(tabel), ...isi };
  baris(tabel).push(r);
  if(tabel==='material_keluar')captureGISSnapshot(state.data,'gudang',tabel,r);
  // item baru pada SPPB yang sudah di-acc = isinya berubah → acc gugur
  if (tabel === 'sppb_items') gugurkanAcc(r.sppb_id, 'item ditambah');
  tandaiBerubah();
  return r;
}

export function ubah(tabel, id, tambalan) {
  assertGISMasterEdit(state.data,'gudang',tabel,id,tambalan);
  const r = cari(tabel, id);
  if(tabel==='material_keluar'&&r?.permintaan_id)throw Error('Transaksi penyerahan permintaan dikunci agar jatah per blok tetap akurat.');
  if (!r) throw new Error('Baris tidak ditemukan.');
  if(tabel==='sppb_items'&&daftarOrder().some(o=>Number(o.sppb_item_id)===Number(id))&&['material','satuan','sppb_id'].some(k=>tambalan[k]!==undefined&&String(tambalan[k])!==String(r[k])))throw Error('Material, satuan dan induk item yang sudah diorder tidak boleh diganti. Buat item baru.');
  if(tabel==='material_masuk'&&r.order_id) {
    if(B.returBaris(state.data,id)>0)throw Error('Penerimaan ini sudah memiliki retur. Jangan ubah catatan asal.');
    tambalan=B.susunPenerimaan(state.data,{...r,...tambalan},id);
  }
  if(tabel==='material_masuk'&&!r.order_id){if(B.returBaris(state.data,id)>0)throw Error('Penerimaan yang sudah diretur tidak boleh diubah.');validasiMasukBiasa({...r,...tambalan});}
  if(tabel==='material_keluar')validasiPengeluaran({...r,...tambalan},id);
  P.jagaTransaksi('ubah', tabel, r, {...r,...tambalan});
  if(tabel==='material_masuk'||tabel==='material_keluar')catatMutasi('Koreksi transaksi',tabel,id,{sebelum:{...r},sesudah:{...r,...tambalan}});
  const changedBlock=tabel==='material_keluar'&&'blok' in tambalan&&tambalan.blok!==r.blok;
  if(changedBlock)assertGISBlockActive(state.data,'gudang',{...r,...tambalan});
  Object.assign(r, tambalan);
  if(tabel==='material_keluar')captureGISSnapshot(state.data,'gudang',tabel,r,{replace:changedBlock});
  if (tabel === 'sppb') gugurkanAcc(id, 'SPPB direvisi');
  if (tabel === 'sppb_items') gugurkanAcc(r.sppb_id, `item "${r.material}" direvisi`);
  tandaiBerubah();
  return r;
}

export function hapus(tabel, id, persetujuanId = null) {
  assertGISMasterStructure(state.data,'gudang',tabel);
  const semua = baris(tabel);
  const i = semua.findIndex((r) => Number(r.id) === Number(id));
  if (i < 0) return false;
  if(tabel==='material_keluar'&&semua[i].permintaan_id)throw Error('Penyerahan permintaan tidak boleh dihapus dari Material Keluar.');
  const transaksi = ['material_masuk','material_keluar'].includes(tabel);
  const izin = persetujuanId && web().permintaanHapus?.[persetujuanId];
  if (transaksi && !P.admin()) {
    if (!P.punya('ktu') || !izin || izin.status !== 'menunggu' || izin.tabel !== tabel || Number(izin.baris_id) !== Number(id) || JSON.stringify(izin.snapshot) !== JSON.stringify(semua[i])) throw Error('Penghapusan memerlukan persetujuan admin atau KTU.');
  } else P.jagaTransaksi('hapus', tabel, semua[i], null);
  if(tabel==='sppb'&&B.semuaOrder(state.data).some(o=>baris('sppb_items').some(it=>Number(it.sppb_id)===Number(id)&&Number(o.sppb_item_id)===Number(it.id))))throw Error('SPPB sudah memiliki order. Tutup sisa order terlebih dahulu; riwayat SPPB tidak boleh dihapus.');
  if(tabel==='sppb_items'&&B.semuaOrder(state.data).some(o=>Number(o.sppb_item_id)===Number(id)))throw Error('Item sudah memiliki order dan tidak boleh dihapus.');
  if(tabel==='material_masuk'&&(semua[i].order_id||B.returBaris(state.data,id)>0))throw Error('Penerimaan order tidak boleh dihapus. Gunakan koreksi atau retur agar riwayat tetap utuh.');
  if(tabel==='material_masuk') {const row=semua[i],s=laporanStok().find(x=>B.norm(x.material)===B.norm(row.material)&&B.samaUnit(x.satuan,row.satuan));if((s?.stok||0)-B.qtyBersih(state.data,row)<-1e-7)throw Error('Penghapusan membuat stok negatif. Periksa transaksi dan gunakan koreksi.');}
  if (tabel === 'sppb_items') {
    gugurkanAcc(semua[i].sppb_id, `item "${semua[i].material}" dihapus`);
    // ceklis order item ini ikut dibuang — id item bisa terpakai ulang
    if (state.data?.web?.orderItem) delete state.data.web.orderItem[String(id)];
  }
  if(transaksi){const w=web();w.riwayatHapus ||= {};const k=crypto.randomUUID();w.riwayatHapus[k]={id:k,tabel,baris_id:id,snapshot:{...semua[i]},oleh:namaPengisi(),waktu:new Date().toISOString(),permintaan_id:persetujuanId||null};}
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

export function ajukanHapus(tabel,id,alasan) {
  if(!['material_masuk','material_keluar'].includes(tabel))throw Error('Jenis transaksi tidak didukung.');
  const r=cari(tabel,id), pelaku=P.siapa();if(!r||!pelaku)throw Error('Transaksi atau pengguna tidak ditemukan.');
  P.jagaTransaksi('hapus',tabel,r,null);
  if(!String(alasan||'').trim())throw Error('Alasan penghapusan wajib diisi.');
  if(tabel==='material_masuk'&&(r.order_id||B.returBaris(state.data,id)>0))throw Error('Penerimaan order/retur tidak dapat dihapus; gunakan koreksi atau retur.');
  if(tabel==='material_keluar'&&r.permintaan_id)throw Error('Penyerahan permintaan tidak dapat dihapus dari sini.');
  const w=web();w.permintaanHapus ||= {};
  if(Object.values(w.permintaanHapus).some(x=>x.status==='menunggu'&&x.tabel===tabel&&Number(x.baris_id)===Number(id)))throw Error('Transaksi ini sudah menunggu persetujuan hapus.');
  const key=crypto.randomUUID();w.permintaanHapus[key]={id:key,tabel,baris_id:id,snapshot:{...r},alasan:String(alasan).trim(),pemohon:pelaku.nama,pemohon_id:pelaku.id,waktu:new Date().toISOString(),status:'menunggu'};
  tandaiBerubah();return key;
}
export function putusHapus(id,setuju,alasan='') {
  if(!P.punya('ktu'))throw Error('Hanya admin atau KTU dapat memutuskan.');
  const r=web().permintaanHapus?.[id];if(!r||r.status!=='menunggu')throw Error('Permintaan tidak tersedia atau sudah diputuskan.');
  if(!setuju&&!String(alasan).trim())throw Error('Alasan penolakan wajib diisi.');
  if(setuju){const sekarang=cari(r.tabel,r.baris_id);if(!sekarang||JSON.stringify(sekarang)!==JSON.stringify(r.snapshot))throw Error('Transaksi sudah berubah atau terhapus. Tolak permintaan ini dan periksa ulang.');hapus(r.tabel,r.baris_id,id);}
  r.status=setuju?'disetujui':'ditolak';r.diputus_oleh=namaPengisi();r.diputus_pada=new Date().toISOString();r.catatan=String(alasan).trim();tandaiBerubah();
}

export function tambahBatchKeluar(rows,dariPermintaan=false){
  if(!Array.isArray(rows)||!rows.length)throw Error('Isi pembagian jumlah.');
  const totals=new Map(), owners=new Map();
  for(const r of rows){
    if(r.id!==undefined)throw Error('ID transaksi dibuat otomatis.');
    if(r.permintaan_id){
      const o=web().permintaanMaterial?.[r.permintaan_id],it=o?.items.find(x=>x.id===r.permintaan_item_id),a=it?.alokasi.find(x=>x.id===r.alokasi_id);
      if(!dariPermintaan||!P.punya('gudang')||!P.punya('input')||o?.status!=='Full Acc'||!a||o.divisi!==r.divisi||it.material!==r.material||!B.samaUnit(it.satuan,r.satuan)||a.blok!==r.blok)throw Error('Referensi penyerahan tidak valid.');
      const q=rows.filter(x=>x.alokasi_id===a.id).reduce((s,x)=>s+Number(x.qty),0)+W.jumlahSerah(o,it,a);if(q>a.disetujui+1e-7)throw Error('Penyerahan melebihi jatah per blok.');
    }else{if(dariPermintaan)throw Error('Referensi permintaan wajib.');P.jagaTransaksi('tambah','material_keluar',null,r);}
    if(!r.tanggal||!r.diambil_oleh?.trim())throw Error('Tanggal dan penerima wajib.');
    validasiPengeluaran(r);const k=B.norm(r.material)+'|'+B.unit(r.satuan);totals.set(k,(totals.get(k)||0)+Number(r.qty));
    if(!jenisBbm(r.material)&&r.pemilik_stok){const key=k+'|'+B.norm(namaPemilik(r.pemilik_stok)),v=owners.get(key)||{r,qty:0};v.qty+=Number(r.qty);owners.set(key,v);}
  }
  for(const [k,qty] of totals){const s=laporanStok().find(r=>B.norm(r.material)+'|'+B.unit(r.satuan)===k);if(qty>(s?.stok||0)+1e-7)throw Error('Total pembagian melebihi stok Gudang.');}
  for(const {r,qty} of owners.values())if(qty>saldoMilik(r.material,r.satuan,r.pemilik_stok)+1e-7)throw Error(`Total pembagian melebihi stok milik ${namaPemilik(r.pemilik_stok)}.`);
  const start=idBaru('material_keluar');const added=rows.map((r,i)=>({...r,id:start+i}));baris('material_keluar').push(...added);catatMutasi('Penyerahan banyak blok','material_keluar',rows[0].batch_id,{baris:added.length});tandaiBerubah();return added;
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
  const pelaku=P.siapa(), versi=web().ttdPengguna?.[pelaku.id]?.versi || null;
  c[tahap] = { status: 'disetujui', oleh: rapikan(oleh), waktu: sekarang(), oleh_id:pelaku.id, ttd_versi:versi };
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

export const orderItem = (itemId) => {
  const o=daftarOrder().find(o=>Number(o.sppb_item_id)===Number(itemId)&&!o.ditutup);
  return o?{oleh:o.oleh,waktu:o.dibuat,rinci:true}:web().orderItem?.[String(itemId)]||null;
};

export const daftarOrder=()=>B.semuaOrder(state.data);
export const ringkasPesanan=o=>B.ringkasOrder(state.data,o);
export const ringkasPengadaan=it=>B.ringkasItem(state.data,it);
function catatMutasi(aksi,tabel,id,detail={}) {
  const jejak=web().jejakMutasi ||= {};
  jejak[crypto.randomUUID()]={aksi,tabel,id,oleh:namaPengisi(),waktu:new Date().toISOString(),...detail};
}
export function tambahPesanan(raw) {
  P.jagaOrder(raw.sppb_item_id);
  const it=cari('sppb_items',raw.sppb_item_id);
  if(statusAcc(it.sppb_id)!==STATUS_ACC.FULL||web().batalItem?.[String(it.id)])throw Error('Order hanya untuk item aktif dari SPPB yang sudah full acc.');
  const id=crypto.randomUUID(),nomor=`ORD-${String(raw.tanggal||'').replaceAll('-','')}-${id.replaceAll('-','').slice(0,12).toUpperCase()}`;
  const o=B.susunOrder(state.data,{...raw,nomor,oleh:namaPengisi(),dibuat:new Date().toISOString()},id);
  if(daftarOrder().some(r=>r.nomor===nomor))throw Error('Nomor order bertabrakan. Coba simpan kembali.');
  (web().pesanan ||= {})[id]=o;catatMutasi('Tambah order','pesanan',id);tandaiBerubah();return o;
}
export function ubahPesanan(id,raw) {
  const o=web().pesanan?.[id];if(!o)throw Error('Order tidak ditemukan.');P.jagaOrder(o.sppb_item_id);
  if(B.ringkasOrder(state.data,o).masuk.length||o.ditutup)throw Error('Order sudah diterima/ditutup. Konversi dan jumlah asal tidak boleh diubah; gunakan order tambahan atau tutup sisa.');
  const baru=B.susunOrder(state.data,{...o,...raw,nomor:o.nomor,sppb_item_id:o.sppb_item_id},id);
  web().pesanan[id]=baru;catatMutasi('Koreksi order','pesanan',id,{sebelum:o,sesudah:baru});tandaiBerubah();
}
export function ubahHargaPesanan(id,harga) {
  const o=web().pesanan?.[id];if(!o)throw Error('Order tidak ditemukan.');P.jagaOrder(o.sppb_item_id);
  const nilai=harga.harga_total_barang;
  if(nilai!=null&&(!Number.isFinite(nilai)||nilai<0))throw Error('Harga tidak valid.');
  if(!['termasuk','terpisah','belum_diketahui'].includes(harga.ongkir_status))throw Error('Status ongkir tidak valid.');
  if(harga.ongkir_status==='terpisah'&&(!Number.isFinite(harga.ongkir)||harga.ongkir<0))throw Error('Ongkir tidak valid.');
  const baru={...o,...harga};web().pesanan[id]=baru;catatMutasi('Koreksi harga order','pesanan',id,{sebelum:o,sesudah:baru});tandaiBerubah();
}
export function tutupSisaOrder(id,alasan) {
  const o=web().pesanan?.[id];if(!o)throw Error('Order tidak ditemukan.');P.jagaOrder(o.sppb_item_id);
  if(o.ditutup)throw Error('Sisa order sudah ditutup.');
  if(!alasan?.trim())throw Error('Alasan penutupan sisa wajib diisi.');
  const r=B.ringkasOrder(state.data,o);
  o.batal_qty_order=o.faktor_order?r.menunggu/o.faktor_order:o.qty_order;o.ditutup=true;o.alasan_tutup=alasan.trim();
  catatMutasi('Tutup sisa order','pesanan',id,{alasan});tandaiBerubah();
}
// Penerimaan langsung tidak pernah dimasukkan ke tabel stok Gudang.
export function simpanPenerimaanLangsung(raw,id=null) {
  if(!(P.admin() || P.punya('gudang')) || !P.punya(id?'revisi':'input')) throw Error('Memerlukan hak Gudang dan hak input/revisi.');
  const lama=id?web().penerimaanLangsung?.[id]:null;
  if(id&&!lama)throw Error('Penerimaan langsung tidak ditemukan.');
  const order=web().pesanan?.[raw.order_id],item=order&&cari('sppb_items',order.sppb_item_id);
  if(!item||statusAcc(item.sppb_id)!==STATUS_ACC.FULL)throw Error('SPPB harus berstatus full acc.');
  if(lama&&lama.order_id!==raw.order_id)throw Error('Order penerimaan tidak boleh diganti.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw.tanggal||'')||!raw.penerima?.trim()||!raw.lokasi_tujuan?.trim())throw Error('Tanggal, nama penerima dan lokasi/divisi tujuan wajib diisi.');
  const nilai=B.susunPenerimaan(state.data,raw,id),key=id||crypto.randomUUID();
  const baru={...nilai,id:key,langsung:true,penerima:raw.penerima.trim(),lokasi_tujuan:raw.lokasi_tujuan.trim(),oleh:namaPengisi(),waktu:new Date().toISOString()};
  (web().penerimaanLangsung ||= {})[key]=baru;
  catatMutasi(id?'Koreksi penerimaan langsung':'Penerimaan langsung','penerimaanLangsung',key,id?{sebelum:lama,sesudah:baru}:{});tandaiBerubah();return baru;
}
export function returPenerimaan(masukId,qty,alasan) {
  P.wajibAdmin();const m=cari('material_masuk',masukId);qty=Number(qty);
  if(!m||!(qty>0)||!Number.isFinite(qty)||qty>B.qtyBersih(state.data,m)+1e-7||!alasan?.trim())throw Error('Jumlah retur harus positif, tidak melebihi penerimaan bersih, dan alasan wajib diisi.');
  const stok=laporanStok().find(s=>B.norm(s.material)===B.norm(m.material)&&B.samaUnit(s.satuan,m.satuan));
  if(qty>(stok?.stok||0)+1e-7)throw Error('Stok gudang tidak cukup untuk retur.');
  const id=crypto.randomUUID();(web().returPenerimaan ||= {})[id]={id,masuk_id:m.id,qty_stok:qty,material:m.material,satuan:m.satuan,alasan:alasan.trim(),oleh:namaPengisi(),waktu:new Date().toISOString()};
  catatMutasi('Retur supplier','material_masuk',m.id,{qty,alasan});tandaiBerubah();
}
function validasiPengeluaran(r,kecuali=null) {
  if(jenisBbm(r.material)&&r.jenis_unit){
    if(!['ALB','Kendaraan','Alsintan','Lainnya'].includes(r.jenis_unit)||!r.unit_pemakai?.trim())throw Error('Unit pemakai BBM wajib valid dan diisi.');
    if(r.sumber_unit==='payroll'){const u=web().unitPayroll?.daftar?.find(u=>String(u.id)===String(r.payroll_unit_id));if(!u||!['ALB','Kendaraan'].includes(r.jenis_unit)||(r.jenis_unit==='ALB'?u.kategori!=='ALAT BERAT':!['KENDARAAN','DUMP TRUCK'].includes(u.kategori)))throw Error('Referensi unit payroll tidak sesuai. Pilih ulang atau gunakan input manual.');}
  }
  if(B.norm(r.material)==='bbm')throw Error('Pilih jenis BBM yang sebenarnya: Pertalite, Pertamax atau Solar. Jangan gabungkan sebagai BBM.');
  if(!r.divisi?.trim()||B.norm(r.divisi)==='gudang')throw Error('Pilih divisi pemakai selain Gudang.');
  if(!r.keperluan?.trim())throw Error('Keperluan pemakaian wajib diisi.');
  if(!(Number(r.qty)>0)||!Number.isFinite(Number(r.qty)))throw Error('Jumlah keluar harus positif.');
  const master=masterDenganNama('master_material',r.material),acuan=master?.satuan_default;
  if(acuan&&!B.samaUnit(acuan,r.satuan))throw Error(`Pengeluaran harus memakai satuan stok ${acuan}. Jangan mencampur satuan tanpa konversi penerimaan.`);
  if(['pertalite','pertamax','solar'].includes(B.norm(r.material))&&!B.samaUnit(r.satuan,'Liter'))throw Error('BBM ini dicatat dalam liter. Jenis BBM tidak boleh digabung.');
  const s=laporanStok().find(s=>B.norm(s.material)===B.norm(r.material)&&B.samaUnit(s.satuan,r.satuan));
  const lama=kecuali?cari('material_keluar',kecuali):null;
  const tersedia=(s?.stok||0)+(lama&&B.norm(lama.material)===B.norm(r.material)&&B.samaUnit(lama.satuan,r.satuan)?Number(lama.qty)||0:0);
  if(Number(r.qty)>tersedia+1e-7&&!r.alasan_stok?.trim())throw Error('Jumlah melebihi stok Gudang. Periksa stok atau minta admin mencatat alasan koreksi.');
  if(Number(r.qty)>tersedia+1e-7&&!P.admin())throw Error('Hanya admin boleh memberi pengecualian stok dengan alasan.');
  if(!jenisBbm(r.material)&&r.pemilik_stok){
    const owner=namaPemilik(r.pemilik_stok);
    const dikembalikan=lama&&B.norm(lama.material)===B.norm(r.material)&&B.samaUnit(lama.satuan,r.satuan)&&B.norm(namaPemilik(lama.pemilik_stok||lama.divisi))===B.norm(owner)?Number(lama.qty)||0:0;
    if(Number(r.qty)>saldoMilik(r.material,r.satuan,owner)+dikembalikan+1e-7)throw Error(`Stok milik ${owner} tidak cukup. Periksa saldo dan riwayat sebelum pengeluaran.`);
  }
}
function validasiMasukBiasa(r) {
  if(!(Number(r.qty)>0)||!Number.isFinite(Number(r.qty)))throw Error('Jumlah penerimaan harus positif.');
  if(jenisBbm(r.material)&&!B.samaUnit(r.satuan,'Liter'))throw Error('Penerimaan BBM harus memakai liter.');
  if(B.norm(r.material)==='bbm')throw Error('Penerimaan BBM harus memilih Pertalite, Pertamax atau Solar. SPPB lama bertuliskan BBM dapat dirinci jenisnya saat menambah order.');
  const acuan=satuanBawaan(r.material);
  if(acuan&&!B.samaUnit(acuan,r.satuan))throw Error(`Penerimaan harus dicatat dalam ${acuan}, atau melalui order dengan konversi satuan.`);
  if(r.sppb_item_id) {
    if(daftarOrder().some(o=>Number(o.sppb_item_id)===Number(r.sppb_item_id)))throw Error('Item ini memiliki order. Catat penerimaan melalui Barang ditunggu agar sisa order akurat.');
    const it=cari('sppb_items',r.sppb_item_id);
    if(!it||B.norm(it.material)!==B.norm(r.material)||!B.samaUnit(it.satuan,r.satuan))throw Error('Material/satuan penerimaan harus sesuai item SPPB. Gunakan order bila perlu konversi.');
  }
}
export function laporanPemakaianDivisi(kategoriFilter=null) {
  const peta=new Map();
  for(const r of baris('material_keluar')) {
    const k=[B.norm(r.divisi),B.norm(r.material),B.unit(r.satuan)].join('|');
    if(!peta.has(k))peta.set(k,{divisi:r.divisi,material:r.material,satuan:r.satuan,kategori:kategoriMaterial(r.material),keluar:0});
    peta.get(k).keluar+=Number(r.qty)||0;
  }
  return [...peta.values()].filter(r=>!kategoriFilter||B.norm(r.kategori)===B.norm(kategoriFilter)).sort((a,b)=>a.divisi.localeCompare(b.divisi,'id')||a.material.localeCompare(b.material,'id'));
}

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
    const k = `${kecil(r.material)}|${B.unit(r.satuan)}`;
    if (!peta.has(k)) peta.set(k, { material: rapikan(r.material), satuan: rapikan(r.satuan), masuk: 0, keluar: 0, penyesuaian:0 });
    return peta.get(k);
  };
  for (const r of baris('material_masuk')) ambil(r).masuk += B.qtyBersih(state.data,r);
  for (const r of baris('material_keluar')) ambil(r).keluar += Number(r.qty) || 0;
  for(const r of W.adjustment(state.data))ambil(r).penyesuaian+=r.qty;
  const hasil = [];
  for (const v of peta.values()) {
    const kategori = kategoriMaterial(v.material);
    if (kategoriFilter && kecil(kategori) !== kecil(kategoriFilter)) continue;
    hasil.push({ ...v, kategori, stok: dekatNol(v.masuk - v.keluar + v.penyesuaian) });
  }
  hasil.sort((a, b) => a.material.localeCompare(b.material, 'id'));
  return hasil;
}

// Saldo lama merupakan usulan berbasis catatan divisi; ia bukan bukti pinjam
// yang mungkin tidak tercatat. Opname tanpa pemilik ditaruh sementara Gudang.
export function laporanKepemilikan(kategoriFilter = null) {
  const hasil=[],semua=auditSemuaPemilik(state.data);
  for(const stock of laporanStok(kategoriFilter)){
    if(jenisBbm(stock.material))continue;
    const audit=semua.get(B.norm(stock.material)+'|'+B.unit(stock.satuan))||{baris:[],penyesuaianBelumDibagi:0,perluDiperiksa:false}, rows=[...audit.baris];
    if(Math.abs(audit.penyesuaianBelumDibagi)>1e-7&&!rows.some(r=>B.norm(r.divisi)==='gudang'))rows.unshift({divisi:'Gudang',masuk:0,keluar:0,saldo:0});
    for(const row of rows){
      const opname=B.norm(row.divisi)==='gudang'?audit.penyesuaianBelumDibagi:0;
      hasil.push({material:stock.material,satuan:stock.satuan,kategori:stock.kategori,divisi:row.divisi,
        masuk:row.masuk,keluar:row.keluar,opname_sementara:opname,stok:row.saldo+opname,
        status:audit.perluDiperiksa?'Perlu periksa':'Usulan riwayat'});
    }
  }
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
export const realisasiItem = (itemId) => [...baris('material_masuk'),...B.semuaPenerimaanLangsung(state.data)]
  .filter((m) => Number(m.sppb_item_id) === Number(itemId))
  .reduce((n, m) => n + B.qtySppb(state.data,m), 0);

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

let saving;
export async function simpan(pesan,options={}) {
 if(saving){await saving;if(state.belumDisimpan)return simpan(pesan,options);return state.data?.rev;}
 const task=saveInternal(pesan,options);saving=task;try{return await task;}finally{if(saving===task)saving=null;}
}
async function saveInternal(pesan,{gisOnly=false}={}) {
  if (!P.siapa()) throw new Error('Masuk sebagai pengguna dulu.');
  if (!state.data) throw new Error('Belum ada data yang dimuat.');
  if (!state.password) throw new Error('Password data belum dimasukkan.');
  state.gabungTerakhir = 0;
  const judul = namaPengisi() ? `${pesan} (${namaPengisi()})` : pesan;

  // Dua orang bisa menyimpan hampir bersamaan: yang kedua kena tolak (409).
  // Alih-alih menyerah, perubahan LOKAL digabungkan ke data TERBARU lalu
  // dicoba simpan lagi — tidak ada input siapa pun yang hilang.
  for (let percobaan = 0; ; percobaan++) {
    if(!P.siapa())throw Error('Sesi pengguna berubah. Masuk ulang sebelum menyimpan.');
    const basis=state.dasarJson?JSON.parse(state.dasarJson):{};
    W.validasiSimpanWorkflow(basis);
    periksaPerubahanSaldo(basis,state.data);
    for(const o of daftarOrder()){
      const r=B.ringkasOrder(state.data,o),lama=basis.web?.pesanan?.[o.id];
      if(o.harga_nilai!=null){const hitung=hitungHargaOrder({jumlah:o.qty_order,cara:o.harga_cara,nilai:o.harga_nilai});if(o.harga_total_barang==null||Math.abs(hitung.totalBarang-o.harga_total_barang)>0.001)throw Error('Jumlah atau harga order berubah bersamaan. Muat ulang dan periksa kembali harga sebelum menyimpan.');}
      if(lama&&r.masuk.length&&['qty_order','satuan_order','satuan_sppb','satuan_stok','faktor_order','faktor_stok'].some(k=>o[k]!==lama[k]))throw Error('Ada penerimaan pada order ini. Konversi/jumlah asal tidak boleh ditimpa; muat ulang data.');
      if(o.ditutup&&r.total!=null&&r.batal>0&&r.batal+r.diterima>r.total+1e-7)throw Error('Penerimaan bersamaan mengubah sisa yang ditutup. Muat ulang lalu perbarui penutupan sisa.');
    }
    for(const o of daftarOrder())if(JSON.stringify(o)!==JSON.stringify(basis.web?.pesanan?.[o.id])&&!o.alasan_lebih){
      const it=cari('sppb_items',o.sppb_item_id),r=it&&B.ringkasItem(state.data,it);
      if(r&&!r.unknown&&r.diterima+r.menunggu>Number(it.qty_diminta)+1e-7)throw Error('Perubahan bersamaan menyebabkan kelebihan order. Koreksi jumlah atau catat alasan sebelum menyimpan.');
    }
    for(const m of [...baris('material_masuk'),...B.semuaPenerimaanLangsung(state.data)])if(m.order_id&&!m.alasan_lebih&&JSON.stringify(m)!==JSON.stringify(m.langsung?basis.web?.penerimaanLangsung?.[m.id]:basis.tabel?.material_masuk?.find(r=>Number(r.id)===Number(m.id)))){
      const o=web().pesanan?.[m.order_id],r=o&&B.ringkasOrder(state.data,o);
      if(r&&r.total!=null&&r.diterima>r.total-r.batal+1e-7)throw Error('Penerimaan bersamaan melebihi order. Koreksi atau catat alasan pengecualian.');
    }
    // Recheck after merging: two devices must not spend the same fuel balance.
    for(const r of baris('material_keluar'))if(JSON.stringify(r)!==JSON.stringify(basis.tabel?.material_keluar?.find(x=>Number(x.id)===Number(r.id))))validasiPengeluaran(r,r.id);
    state.data.rev = (Number(state.data.rev) || 0) + 1;
    state.data.dibuat = new Date().toISOString().slice(0, 19);
    state.data.dari = namaPengisi() ? `Web — ${namaPengisi()}` : 'Web';
    const meta = susunMeta();
    const saved={rev:state.data.rev,json:JSON.stringify(state.data),data:state.data,path:state.path,sha:state.sha,meta};
    const amplop = await kunciAmplop(saved.data, state.password, meta);

    if (modeLokal()) {
      unduhTeks('gudang.json', JSON.stringify(amplop), 'application/json');
      state.meta = meta;
      state.belumDisimpan = false;
      hapusDraf();
      return state.data.rev;
    }

    try {
      saved.sha = await gh.tulisFile(saved.path, amplop, saved.sha, judul);
      const finished=finishSavedSnapshot(state,saved);
      if(finished.current){if(finished.pending)tandaiBerubah();else hapusDraf();}
      return saved.rev;
    } catch (e) {
      if(state.data!==saved.data||state.path!==saved.path)throw e;
      state.data.rev -= 1;
      if (!e.bentrok || percobaan >= 2) throw e;
      const { isi, sha } = await gh.bacaFile(state.path);
      if (!isi) throw e;
      const terbaru = await bukaAmplop(isi, state.password);
      const dasar = state.dasarJson ? JSON.parse(state.dasarJson) : terbaru;
      state.data = gisOnly&&gisOnlyChanges(dasar,state.data,'gudang')?rebaseGISOnly(dasar,state.data,terbaru,'gudang'):gabungTiga(dasar, state.data, terbaru);
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
 * - Perubahan atau penghapusan baris yang sama secara bersamaan ditolak.
 */
export function gabungTiga(dasar, lokal, remote) {
  assertGISMerge(dasar,lokal,remote);
  W.jagaGabungWorkflow(dasar,lokal,remote);
  const hasil = JSON.parse(JSON.stringify(remote));
  hasil.tabel ||= {};
  const beda = (a, b) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  for (const [id, row] of Object.entries(lokal.web?.penerimaanLangsung || {})) {
    const before=dasar.web?.penerimaanLangsung?.[id], other=remote.web?.penerimaanLangsung?.[id];
    if(beda(row,before)&&beda(other,before)&&beda(row,other))throw Error('Penerimaan langsung yang sama telah diubah di perangkat lain. Muat ulang sebelum mengulangi.');
  }
  const petaId = {};   // tabel -> Map(id lokal -> id final)

  for (const t of TABEL_SEMUA) {
    const bDasar = new Map((dasar.tabel?.[t] || []).map((r) => [Number(r.id), r]));
    const bLokal = lokal.tabel?.[t] || [];
    const idLokal = new Set(bLokal.map((r) => Number(r.id)));
    const pLokal = new Map(bLokal.map(r => [Number(r.id), r]));
    const pRemote = new Map((remote.tabel?.[t] || []).map(r => [Number(r.id), r]));
    for (const [id, asal] of bDasar) {
      const perubahanLokal = pLokal.get(id), perubahanRemote = pRemote.get(id);
      if (beda(perubahanLokal, asal) && beda(perubahanRemote, asal) && beda(perubahanLokal, perubahanRemote)) {
        throw Error(`Data ${t} nomor ${id} sudah diubah di perangkat lain. Perubahan Anda belum disimpan; periksa dan muat ulang data sebelum mengulangi.`);
      }
    }
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
  for(const asal of lokal.tabel?.material_masuk||[]){
    const dasarRow=dasar.tabel?.material_masuk?.find(r=>Number(r.id)===Number(asal.id));
    if(!beda(asal,dasarRow))continue;
    const target=hasil.tabel.material_masuk.find(r=>Number(r.id)===petaId.material_masuk.get(Number(asal.id)));
    if(target&&petaItem.has(Number(asal.sppb_item_id)))target.sppb_item_id=petaItem.get(Number(asal.sppb_item_id));
  }
  for(const asal of lokal.tabel?.sppb_items||[]){
    const dasarRow=dasar.tabel?.sppb_items?.find(r=>Number(r.id)===Number(asal.id));if(!beda(asal,dasarRow))continue;
    const target=hasil.tabel.sppb_items.find(r=>Number(r.id)===petaItem.get(Number(asal.id)));
    if(target&&petaSppb.has(Number(asal.sppb_id)))target.sppb_id=petaSppb.get(Number(asal.sppb_id));
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
      if (objekPolos(dl) && (dd===undefined || objekPolos(dd)) && objekPolos(hasilB[k])) {
        gabungBagian(hasilB[k], dd || {}, dl);
      } else if (beda(hasilB[k], dd) && beda(hasilB[k], dl)) {
        throw Error('Pengaturan atau data yang sama sudah diubah di perangkat lain. Perubahan Anda belum disimpan; periksa dan muat ulang data.');
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
  for(const o of Object.values(hasil.web.pesanan||{}))if(!dasar.web?.pesanan?.[o.id]&&lokal.web?.pesanan?.[o.id]&&petaItem.has(Number(o.sppb_item_id)))o.sppb_item_id=petaItem.get(Number(o.sppb_item_id));
  for(const r of Object.values(hasil.web.penerimaanLangsung||{}))if(!dasar.web?.penerimaanLangsung?.[r.id]&&lokal.web?.penerimaanLangsung?.[r.id]&&petaItem.has(Number(r.sppb_item_id)))r.sppb_item_id=petaItem.get(Number(r.sppb_item_id));
  for(const r of Object.values(hasil.web.returPenerimaan||{}))if(!dasar.web?.returPenerimaan?.[r.id]&&lokal.web?.returPenerimaan?.[r.id]&&petaId.material_masuk.has(Number(r.masuk_id)))r.masuk_id=petaId.material_masuk.get(Number(r.masuk_id));

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
let lindungiDrafLama = false;
let generasiDraf = 0;
function jadwalkanDraf() {
  if (!state.password || !state.data || lindungiDrafLama) return;
  clearTimeout(timerDraf);
  const generasi=++generasiDraf, data=state.data, path=state.path, pemilik=P.siapa()?.id;
  timerDraf = setTimeout(async () => {
    try {
      // A save in flight temporarily increments data.rev. A draft must refer
      // to the last confirmed GitHub baseline, not that unconfirmed revision.
      const rev=state.dasarJson ? Number(JSON.parse(state.dasarJson).rev)||0 : Number(data.rev)||0;
      const snapshot=structuredClone(data);snapshot.rev=rev;
      const amp = await kunciAmplop(snapshot, state.password, { draf: true });
      if(generasi!==generasiDraf || !state.belumDisimpan || state.data!==data || state.path!==path || P.siapa()?.id!==pemilik)return;
      localStorage.setItem(kunciDraf(), JSON.stringify({
        rev, waktu: new Date().toISOString(), amp }));
    } catch { /* penyimpanan penuh / terblokir — lewati saja */ }
  }, 2500);
}

export function hapusDraf() {
  clearTimeout(timerDraf);
  generasiDraf++;
  if(lindungiDrafLama)return;
  try { localStorage.removeItem(kunciDraf()); } catch { /* abaikan */ }
}

export async function drafTersimpan() {
  try {
    const mentah = localStorage.getItem(kunciDraf());
    if (!mentah || !state.data) return null;
    const { rev, waktu, amp } = JSON.parse(mentah);
    if (Number(rev) !== (Number(state.data.rev) || 0)) {
      // A different user may have saved while this device was closed.  Never
      // apply an old whole-dataset snapshot over their newer data, and never
      // delete the only local copy. Keep an encrypted archive for review.
      const arsip=`${kunciDraf()}.arsip.${Number(rev)||0}.${Date.now()}`;
      let diarsipkan=false;
      try {localStorage.setItem(arsip,mentah);diarsipkan=localStorage.getItem(arsip)===mentah;if(diarsipkan)localStorage.removeItem(kunciDraf());} catch { /* keep original intact */ }
      lindungiDrafLama=!diarsipkan;
      return {waktu,terlambat:true,diarsipkan,mentah};
    }
    const isi = await bukaAmplop(amp, state.password);
    return { waktu, data: isi };
  } catch { return null; }
}

export function unduhDrafLama(draf) {
  if(!draf?.terlambat||!draf.mentah)throw Error('Draf terenkripsi tidak tersedia.');
  unduhTeks('draf-gudang-terenkripsi.json',draf.mentah,'application/json');
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

export async function simpanGIS(){if(state.gisSaving)return;state.gisSaving=true;try{return await simpan('Web: sinkron otomatis blok GIS',{gisOnly:true});}finally{state.gisSaving=false;}}
