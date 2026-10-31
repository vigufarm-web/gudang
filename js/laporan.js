// laporan.js — Laporan WA: teks siap tempel ke WhatsApp (*bold* / _italic_),
// padanan report_wa.py di aplikasi desktop.

import * as D from './data.js?v=6';
import { el, kosongkan, taruh, pesan, isian, hariIni } from './ui.js?v=6';
import { spandukLokal } from './main.js?v=6';
import { kecil, awalBulanIni } from './form-util.js?v=6';

// angka ala Indonesia: 1.250 / 12,5 (maks 2 desimal, tanpa ,00)
const fmt = (v) => {
  const n = Number(v) || 0;
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n);
};

const teksPeriode = (a, b) => (a === b ? a : `${a} s/d ${b}`);

const antara = (tabel, dari, sampai, divisi) => [...D.baris(tabel)]
  .filter((r) => r.tanggal >= dari && r.tanggal <= sampai)
  .filter((r) => !divisi || kecil(r.divisi) === kecil(divisi))
  .sort((x, y) => String(x.tanggal).localeCompare(String(y.tanggal)) || (x.id - y.id));

export function laporanMasuk(dari, sampai, divisi) {
  const rows = antara('material_masuk', dari, sampai, divisi);
  const b = ['*LAPORAN MATERIAL MASUK*', `Periode: ${teksPeriode(dari, sampai)}`];
  if (divisi) b.push(`Divisi: ${divisi}`);
  b.push('');
  if (!rows.length) { b.push('_Tidak ada data material masuk pada periode ini._'); return b.join('\n'); }
  rows.forEach((r, i) => {
    b.push(`${i + 1}. ${r.material} — ${fmt(r.qty)} ${r.satuan || ''}`.trimEnd());
    b.push(`   Divisi: ${r.divisi || '-'} | Sumber: ${r.sumber || '-'}`);
    const no = D.nomorSppbDariItem(r.sppb_item_id);
    if (no) b.push(`   SPPB: ${no}`);
    if(r.keperluan)b.push(`   Keperluan: ${r.keperluan}`);
    if(r.unit_pemakai)b.push(`   Kendaraan/alat: ${r.unit_pemakai}${r.meter_unit?' | KM/HM: '+r.meter_unit:''}`);
    if (r.keterangan) b.push(`   Ket: ${r.keterangan}`);
  });
  b.push('', `Total: ${rows.length} item`);
  return b.join('\n');
}

export function laporanKeluar(dari, sampai, divisi) {
  const rows = antara('material_keluar', dari, sampai, divisi);
  const b = ['*LAPORAN MATERIAL KELUAR*', `Periode: ${teksPeriode(dari, sampai)}`];
  if (divisi) b.push(`Divisi: ${divisi}`);
  b.push('');
  if (!rows.length) { b.push('_Tidak ada data material keluar pada periode ini._'); return b.join('\n'); }
  rows.forEach((r, i) => {
    b.push(`${i + 1}. ${r.material} — ${fmt(r.qty)} ${r.satuan || ''}`.trimEnd());
    b.push(`   Blok: ${r.blok || '-'} | Divisi: ${r.divisi || '-'}`);
    b.push(`   Diambil oleh: ${r.diambil_oleh || '-'}`);
    if(r.keperluan)b.push(`   Keperluan: ${r.keperluan}`);
    if(r.unit_pemakai)b.push(`   Kendaraan/alat: ${r.unit_pemakai}${r.meter_unit?' | KM/HM: '+r.meter_unit:''}`);
    if (r.keterangan) b.push(`   Ket: ${r.keterangan}`);
  });
  b.push('', `Total: ${rows.length} item`);
  return b.join('\n');
}

export function laporanStokDivisi(kategori) {
  const rows=D.laporanStok(kategori||null);
  const b=['*LAPORAN STOK GUDANG*',`Per tanggal: ${hariIni()}`];
  if(kategori)b.push(`Kategori: ${kategori}`);
  b.push('Stok hanya berada di Gudang; barang keluar menjadi pemakaian divisi.','');
  for(const r of rows)b.push(`• ${r.material}: ${fmt(r.stok)} ${r.satuan||''}`);
  if(!rows.length)b.push('_Tidak ada data stok._');
  return b.join('\n');
}

export function laporanHarian(dari, sampai, divisi, kategori) {
  const garis = '――――――――――――――――';
  return [
    laporanMasuk(dari, sampai, divisi), '', garis, '',
    laporanKeluar(dari, sampai, divisi), '', garis, '',
    laporanStokDivisi(kategori),
  ].join('\n');
}

const JENIS = [
  { k: 'harian', l: 'Laporan Harian Lengkap (masuk + keluar + stok)' },
  { k: 'masuk', l: 'Laporan Material Masuk' },
  { k: 'keluar', l: 'Laporan Material Keluar' },
  { k: 'stok', l: 'Laporan Stok Gudang' },
];

export async function halamanLaporan(wadah) {
  const kJenis = el('select', {}, JENIS.map((j) => el('option', { value: j.k, teks: j.l })));
  const kDari = el('input', { type: 'date', nilai: awalBulanIni() });
  const kSampai = el('input', { type: 'date', nilai: hariIni() });
  const kDivisi = el('select', {}, [
    el('option', { value: '', teks: 'Semua Divisi' }),
    ...[...D.baris('master_divisi')].sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
      .map((d) => el('option', { value: d.nama, teks: d.nama })),
  ]);
  const kKategori = el('select', {}, [
    el('option', { value: '', teks: 'Semua Kategori' }),
    ...[...D.baris('master_kategori')].sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
      .map((d) => el('option', { value: d.nama, teks: d.nama })),
  ]);
  const hasil = el('textarea', {
    rows: 18, readonly: true, spellcheck: 'false',
    style: 'width:100%;font-family:ui-monospace,Consolas,monospace;font-size:.86rem;white-space:pre',
    placeholder: 'Klik "Buat laporan" — hasilnya muncul di sini, tinggal copy ke WhatsApp.',
  });

  const buat = () => {
    const j = kJenis.value;
    const dari = kDari.value || '0000-01-01';
    const sampai = kSampai.value || '9999-12-31';
    const divisi = kDivisi.value;
    const kategori = kKategori.value;
    hasil.value = j === 'masuk' ? laporanMasuk(dari, sampai, divisi)
      : j === 'keluar' ? laporanKeluar(dari, sampai, divisi)
        : j === 'stok' ? laporanStokDivisi(kategori)
          : laporanHarian(dari, sampai, divisi, kategori);
  };

  const salin = async () => {
    if (!hasil.value) buat();
    try {
      await navigator.clipboard.writeText(hasil.value);
      pesan('Tersalin. Tinggal paste di chat/grup WhatsApp.', 'sukses');
    } catch {
      hasil.select();
      document.execCommand('copy');
      pesan('Tersalin.', 'sukses');
    }
  };

  taruh(wadah,
    spandukLokal(),
    el('div.lembar', {}, [el('div.lembar-isi', {}, [
      el('div.baris-isian', {}, [
        isian('Jenis laporan', kJenis),
        isian('Divisi', kDivisi),
        isian('Dari tanggal', kDari),
        isian('Sampai tanggal', kSampai),
        isian('Kategori (untuk stok)', kKategori),
      ]),
      el('div', { style: 'display:flex;gap:.6rem;margin:.4rem 0 .8rem' }, [
        el('button.tombol-utama', { type: 'button', teks: 'Buat laporan', onclick: buat }),
        el('button.tombol-samar', { type: 'button', teks: 'Copy ke clipboard', onclick: salin }),
      ]),
      hasil,
      el('p.bantuan', { style: 'margin-top:.6rem', teks:
        'Format *tebal* dan _miring_ mengikuti gaya WhatsApp — akan tampil rapi begitu ditempel di chat.' }),
    ])]),
  );
}
