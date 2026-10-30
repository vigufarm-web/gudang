// form-util.js — kendali form & filter yang dipakai halaman transaksi.

import * as D from './data.js?v=3';
import { el, hariIni, tanya } from './ui.js?v=3';

export const rapikan = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const kecil = (s) => rapikan(s).toLowerCase();
const padat = (s) => kecil(s).replace(/[^a-z0-9]/g, '');

// ---------------------------------------------------- anti-dobel & anti-typo
function lev(a, b, maks) {
  if (Math.abs(a.length - b.length) > maks) return maks + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = maks + 1;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > maks) return maks + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Nama final untuk disimpan — tiga lapis pengaman supaya tidak ada dobel
 * karena kapital, spasi, atau typo:
 *  1. Sudah ada di master (beda kapital/spasi saja) → EJAAN MASTER yang
 *     dipakai, diam-diam. "semen" tersimpan sebagai "Semen".
 *  2. Nama baru tapi MIRIP master (beda tanda baca saja, atau beda 1–2
 *     huruf) → ditanya dulu: pakai yang sudah ada, atau memang nama baru.
 *  3. Benar-benar baru → disimpan apa adanya (sudah dirapikan spasinya).
 */
/** Nama master yang MIRIP (beda spasi/tanda baca, atau typo 1–2 huruf) —
 *  beda angka dianggap varian ukuran, bukan typo. */
export function miripMaster(tabel, nama, kecualiId = null) {
  const b = kecil(nama);
  const bp = padat(nama);
  if (!b) return [];
  const mirip = [];
  for (const r of D.baris(tabel)) {
    if (kecualiId != null && Number(r.id) === Number(kecualiId)) continue;
    const n = kecil(r.nama);
    if (!n || n === b) continue;
    if (padat(r.nama) === bp) { mirip.unshift(r.nama); continue; }   // beda spasi/strip saja
    if (b.length >= 5) {
      const maks = b.length < 9 ? 1 : 2;
      // beda angka = varian ukuran (Polybag 10x20 vs 20x20), bukan typo
      const hurufA = b.replace(/[^a-z]/g, '');
      const hurufB = n.replace(/[^a-z]/g, '');
      if (hurufA === hurufB && b !== n) continue;
      if (lev(b, n, maks) <= maks) mirip.push(r.nama);
    }
  }
  return mirip;
}

export async function namaFinal(tabel, nama, label = 'Nama') {
  const bersih = rapikan(nama);
  if (!bersih) return bersih;
  const resmi = D.masterDenganNama(tabel, bersih);
  if (resmi) return resmi.nama;

  const mirip = miripMaster(tabel, bersih);
  if (mirip.length) {
    const pakai = await tanya(`${label} mirip yang sudah terdaftar`,
      `"${bersih}" mirip dengan "${mirip[0]}"${mirip.length > 1 ? ` (juga: ${mirip.slice(1, 3).join(', ')})` : ''} `
      + 'yang sudah ada di master. Pakai yang sudah ada supaya tidak dobel?',
      { ya: `Pakai "${mirip[0]}"`, tidak: `Tetap "${bersih}" (baru)` });
    if (pakai) return mirip[0];
  }
  return bersih;
}

/**
 * Samakan ejaan nilai bebas (mis. "diambil oleh") dengan riwayat yang sudah
 * ada: beda kapital → ikut ejaan yang paling sering dipakai. "rohmat" jadi
 * "Rohmat" kalau selama ini ditulis begitu.
 */
export function kanonikRiwayat(nilai, daftarLama) {
  const bersih = rapikan(nilai);
  if (!bersih) return bersih;
  const hitung = new Map();
  for (const v of daftarLama) {
    const x = rapikan(v);
    if (kecil(x) !== kecil(bersih)) continue;
    hitung.set(x, (hitung.get(x) || 0) + 1);
  }
  if (!hitung.size) return bersih;
  return [...hitung.entries()].sort((x, y) => y[1] - x[1])[0][0];
}

/** Input teks dengan daftar saran dari satu tabel master (boleh ketik nama baru). */
export function inputMaster(sumber, nilai = '', { tempat = '', saatUbah = null } = {}) {
  const idList = 'dl' + Math.random().toString(36).slice(2, 9);
  const opsi = D.baris(sumber).map((r) => r.nama).sort((a, b) => a.localeCompare(b, 'id'));
  const dl = el('datalist', { id: idList }, opsi.map((n) => el('option', { value: n })));
  const inp = el('input', {
    type: 'text', list: idList, autocomplete: 'off', placeholder: tempat, nilai,
    onchange: saatUbah, oninput: saatUbah,
  });
  inp._datalist = dl;
  return inp;
}

export const inputTanggal = (nilai = hariIni()) => el('input', { type: 'date', nilai, required: true });

export const inputAngka = (nilai = '') => el('input', {
  type: 'number', step: 'any', min: '0', inputmode: 'decimal', nilai: nilai ?? '',
});

const p2 = (n) => String(n).padStart(2, '0');
export function awalBulanIni() {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-01`;
}

/**
 * Baris filter periode + kata kunci. `saatUbah()` dipanggil tiap perubahan.
 * Mengembalikan { elemen, ambil() } — ambil() memberi { dari, sampai, kata }.
 */
export function filterPeriode(saatUbah, { kataTempat = 'Cari…', dari = awalBulanIni(), sampai = hariIni() } = {}) {
  const inpDari = el('input', { type: 'date', nilai: dari, onchange: saatUbah, 'aria-label': 'Dari tanggal' });
  const inpSampai = el('input', { type: 'date', nilai: sampai, onchange: saatUbah, 'aria-label': 'Sampai tanggal' });
  const inpKata = el('input', { type: 'search', placeholder: kataTempat, oninput: saatUbah, style: 'min-width:12rem;flex:1' });
  const elemen = el('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.8rem' }, [
    el('span.bantuan', { teks: 'Periode' }), inpDari, el('span.bantuan', { teks: 's/d' }), inpSampai,
    el('button.tombol-samar.tombol-kecil', {
      type: 'button', teks: 'Semua tanggal',
      onclick: () => { inpDari.value = ''; inpSampai.value = ''; saatUbah(); },
    }),
    inpKata,
  ]);
  return { elemen, ambil: () => ({ dari: inpDari.value, sampai: inpSampai.value, kata: inpKata.value }) };
}

/** Saring baris transaksi menurut hasil filterPeriode. */
export function saring(data, { dari, sampai, kata }, kolomCari) {
  let hasil = data;
  if (dari) hasil = hasil.filter((r) => String(r.tanggal) >= dari);
  if (sampai) hasil = hasil.filter((r) => String(r.tanggal) <= sampai);
  const k = kecil(kata);
  if (k) hasil = hasil.filter((r) => kolomCari.some((c) => kecil(r[c]).includes(k)));
  return hasil;
}

export const urutTanggalTurun = (a, b) => String(b.tanggal).localeCompare(String(a.tanggal)) || (b.id - a.id);

/** Batasi baris yang digambar supaya halaman tetap ringan. */
export const BATAS_TAMPIL = 400;
export function catatanBatas(total) {
  if (total <= BATAS_TAMPIL) return null;
  return el('p.bantuan', {
    teks: `Menampilkan ${BATAS_TAMPIL} baris terbaru dari ${total}. Persempit periode atau pakai kolom cari untuk melihat sisanya.`,
  });
}
