// Pembatasan operasional di browser, sama seperti payroll. Bukan otorisasi server.
export const normal = (v) => String(v || '').trim().toLowerCase();
export const HAK = [
  ['minta','Buat permintaan material mandor'],['opname','Catat stok opname Gudang'],
  ['sppb', 'Buat SPPB saja'], ['input', 'Input transaksi baru'], ['revisi', 'Revisi transaksi dan ajukan hapus'],
  ['kepala', 'Persetujuan kepala divisi'], ['ktu', 'Persetujuan KTU'],
  ['batal', 'Batalkan persetujuan'], ['order', 'Ceklis order kantor pusat'],
  ['gudang', 'Kelola stok Gudang dan pemakaian semua divisi'], ['bbm','Akses BBM masuk dan keluar'],
  ['laporan','Buat dan salin Laporan WA'],
  ['ekspor','Unduh Excel laporan Gudang lengkap'],
];
export const mandor=p=>!!p&&!p.admin&&(p.peran==='mandor'||(p.hak?.minta===true&&!['sppb','input','revisi','kepala','ktu','gudang','order','opname','bbm'].some(k=>p.hak?.[k])));
export const punya = (p, hak) => p?.aktif !== false && !!p && (p.admin === true || ((!mandor(p)||hak==='minta')&&p.hak?.[hak] === true));
export const cakupan = (p, divisi) => !!p && p.aktif !== false &&
  (p.admin === true || (Array.isArray(p.divisi) && p.divisi.some((d) => normal(d) === normal(divisi))));
export function bolehHalaman(p, halaman) {
  if (!p || p.aktif === false) return false;
  if (p.admin) return true;
  if (halaman==='ditunggu') return true;
  if (halaman==='laporan') return punya(p,'laporan');
  if(mandor(p))return ['dashboard','permintaan','sandi'].includes(halaman);
  if (['dashboard','sandi','material-lihat'].includes(halaman)) return true;
  if (halaman==='sppb') return ['sppb','input','revisi','kepala','ktu','order','gudang'].some(h=>punya(p,h));
  if (halaman==='permintaan') return ['minta','kepala','ktu','gudang'].some(h=>punya(p,h));
  if (halaman==='persetujuan') return ['kepala','ktu','batal'].some(h=>punya(p,h));
  if (halaman==='pusat') return punya(p,'order');
  if (halaman==='persetujuan-hapus') return punya(p,'ktu');
  if (['bbm','bbm-masuk','bbm-keluar'].includes(halaman)) return punya(p,'bbm')&&(punya(p,'input')||punya(p,'revisi'));
  if (['masuk','keluar'].includes(halaman)) return punya(p,'gudang') && (punya(p,'input') || punya(p,'revisi'));
  if (halaman==='opname') return punya(p,'opname') || punya(p,'ktu');
  return false;
}
export function bolehTransaksi(p, aksi, tabel, lama, baru, cariSppb) {
  if (!p || p.aktif === false) return false;
  if (p.admin) return true;
  if (tabel.startsWith('master_')) return false;
  const isBBM=(r)=>['solar','pertalite','pertamax','bbm'].includes(normal(r?.material));
  if (['material_masuk','material_keluar'].includes(tabel) && (isBBM(lama)||isBBM(baru)) && !punya(p,'bbm')) return false;
  const buatSppb = aksi === 'tambah' && ['sppb','sppb_items'].includes(tabel) && punya(p,'sppb');
  if (!buatSppb && !punya(p, aksi === 'tambah' ? 'input' : 'revisi')) return false;
  if(punya(p,'gudang')&&['material_masuk','material_keluar'].includes(tabel))return true;
  const divisi = (r) => tabel === 'sppb_items' ? cariSppb(r?.sppb_id)?.divisi_pemohon
    : tabel === 'sppb' ? r?.divisi_pemohon : r?.divisi;
  return (!lama || cakupan(p, divisi(lama))) && (!baru || cakupan(p, divisi(baru)));
}
const base64 = (b) => btoa(String.fromCharCode(...b));
const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function hashSandi(sandi, salt = base64(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(sandi), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({name:'PBKDF2', salt:bytes(salt), iterations:600000, hash:'SHA-256'}, key, 256);
  return {alg:'PBKDF2-SHA256', iter:600000, salt, hash:base64(new Uint8Array(hash))};
}
export async function periksaSandi(sandi, rekam) {
  if (rekam?.alg !== 'PBKDF2-SHA256' || rekam.iter !== 600000 || !rekam.salt || !rekam.hash) return false;
  try {
    const hasil = await hashSandi(sandi, rekam.salt);
    const a = bytes(hasil.hash), b = bytes(rekam.hash);
    if (a.length !== b.length) return false;
    let beda = 0;
    for (let i = 0; i < a.length; i++) beda |= a[i] ^ b[i];
    return beda === 0;
  } catch { return false; }
}
