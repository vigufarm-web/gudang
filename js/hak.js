// Pembatasan operasional di browser, sama seperti payroll. Bukan otorisasi server.
export const normal = (v) => String(v || '').trim().toLowerCase();
export const HAK = [
  ['input', 'Input transaksi baru'], ['revisi', 'Revisi dan hapus transaksi'],
  ['kepala', 'Persetujuan kepala divisi'], ['ktu', 'Persetujuan KTU'],
  ['batal', 'Batalkan persetujuan'], ['order', 'Ceklis order kantor pusat'],
  ['gudang', 'Kelola stok Gudang dan pemakaian semua divisi'],
];
export const punya = (p, hak) => p?.aktif !== false && !!p && (p.admin === true || p.hak?.[hak] === true);
export const cakupan = (p, divisi) => !!p && p.aktif !== false &&
  (p.admin === true || (Array.isArray(p.divisi) && p.divisi.some((d) => normal(d) === normal(divisi))));
export function bolehHalaman(p, halaman) {
  if (!p || p.aktif === false) return false;
  if (p.admin) return true;
  if (['pengguna', 'sistem', 'riwayat', 'master'].includes(halaman)) return false;
  if (['masuk', 'keluar', 'bbm-masuk', 'bbm-keluar', 'sppb'].includes(halaman)) return punya(p, 'input') || punya(p, 'revisi');
  if (halaman === 'persetujuan') return punya(p, 'kepala') || punya(p, 'ktu') || punya(p, 'batal');
  return true;
}
export function bolehTransaksi(p, aksi, tabel, lama, baru, cariSppb) {
  if (!p || p.aktif === false) return false;
  if (p.admin) return true;
  if (tabel.startsWith('master_')) return false;
  if (!punya(p, aksi === 'tambah' ? 'input' : 'revisi')) return false;
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
