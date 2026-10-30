// dashboard.js — kartu ringkasan, tabel stok (gudang / per divisi, filter
// kategori), dan daftar SPPB yang belum/sebagian direalisasi.

import * as D from './data.js?v=4';
import { el, kosongkan, taruh, tabel, angka, tanggal } from './ui.js?v=4';
import { spandukLokal } from './main.js?v=4';
import { kecil } from './form-util.js?v=4';

export async function halamanDashboard(wadah) {
  let kategori = '';
  let perDivisi = false;
  let kata = '';

  const semuaKategori = [...new Set([
    ...D.baris('master_kategori').map((r) => r.nama),
    ...D.baris('master_material').map((r) => r.kategori).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b, 'id'));

  // ------------------------------------------------------ kartu ringkasan
  const stokSemua = D.laporanStok();
  const sppb = D.laporanSppb();
  const belumLengkap = sppb.filter((s) => ['Belum Realisasi', 'Sebagian'].includes(s.status_keseluruhan));
  const minus = stokSemua.filter((s) => s.stok < 0).length;

  const kartu = el('div.angka-utama', { style: 'margin-bottom:1rem' }, [
    ['Jenis material tercatat', angka(stokSemua.length)],
    ['Baris material masuk', angka(D.baris('material_masuk').length)],
    ['Baris material keluar', angka(D.baris('material_keluar').length)],
    ['SPPB menunggu acc', angka(D.jumlahMenungguAcc())],
    ['SPPB belum lengkap', angka(belumLengkap.length)],
  ].map(([l, v]) => el('div', {}, [el('dl', {}, [el('dt', { teks: l }), el('dd', { teks: v })])])));

  // ------------------------------------------------------------ tabel stok
  const tempatStok = el('div');
  const gambarStok = () => {
    const data = (perDivisi ? D.laporanStokDivisi(kategori || null) : D.laporanStok(kategori || null))
      .filter((r) => !kata
        || kecil(r.material).includes(kecil(kata))
        || kecil(r.divisi || '').includes(kecil(kata)));
    const kolom = [
      perDivisi ? { l: 'Divisi', k: 'divisi' } : null,
      { l: 'Material', k: 'material' },
      { l: 'Kategori', k: 'kategori' },
      { l: 'Masuk', k: 'masuk', jenis: 'angka', pecahan: 2 },
      { l: 'Keluar', k: 'keluar', jenis: 'angka', pecahan: 2 },
      { l: 'Stok', nilai: (r) => el('strong', { style: r.stok < 0 ? 'color:var(--merah)' : '', teks: angka(r.stok, 2) }), rata: 'angka' },
      { l: 'Satuan', k: 'satuan' },
    ].filter(Boolean);
    kosongkan(tempatStok).append(tabel(kolom, data, { kosong: 'Tidak ada stok untuk filter ini.' }));
  };

  const pilihKategori = el('select', {
    'aria-label': 'Filter kategori',
    onchange: (e) => { kategori = e.target.value; gambarStok(); },
  }, [
    el('option', { value: '', teks: 'Semua kategori' }),
    ...semuaKategori.map((k) => el('option', { value: k, teks: k })),
  ]);
  const cari = el('input', {
    type: 'search', placeholder: 'Cari material…', style: 'min-width:12rem',
    oninput: (e) => { kata = e.target.value; gambarStok(); },
  });
  const tombolMode = (label, aktifkan) => el('button.tombol-kecil' + ((perDivisi === aktifkan) ? '' : '.tombol-samar'), {
    type: 'button', teks: label,
    onclick: () => { perDivisi = aktifkan; gambarUlangMode(); gambarStok(); },
  });
  const tempatMode = el('div', { style: 'display:flex;gap:.4rem' });
  const gambarUlangMode = () => kosongkan(tempatMode)
    .append(tombolMode('Stok gudang', false), tombolMode('Stok per divisi', true));
  gambarUlangMode();

  // ------------------------------------------------- SPPB belum realisasi
  const tabelSppb = tabel([
    { l: 'No. SPPB', k: 'no_sppb' },
    { l: 'Tanggal', nilai: (r) => tanggal(r.tanggal) },
    { l: 'Divisi pemohon', k: 'divisi_pemohon' },
    { l: 'Status', k: 'status_keseluruhan' },
    { l: 'Item belum selesai', nilai: (r) => r.items.filter((it) => it.status !== 'Selesai')
      .map((it) => `${it.material} (sisa ${angka(it.sisa, 2)} ${it.satuan || ''})`).join(', ') },
  ], belumLengkap, { kosong: 'Semua SPPB sudah selesai direalisasi. 🎉' });

  taruh(wadah,
    spandukLokal(),
    kartu,
    el('div.lembar', { style: 'margin-bottom:1rem' }, [el('div.lembar-isi', {}, [
      el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:.8rem' }, [
        el('h2', { teks: 'Stok saat ini' }),
        tempatMode,
        pilihKategori,
        cari,
      ]),
      tempatStok,
      el('p.bantuan', { style: 'margin-top:.6rem', teks:
        'Stok gudang = total masuk − total keluar per material. Stok per divisi = saldo material yang "dipegang" tiap divisi.' }),
    ])]),
    el('div.lembar', {}, [el('div.lembar-isi', {}, [
      el('h2', { style: 'margin-bottom:.6rem', teks: 'SPPB yang belum / sebagian direalisasi' }),
      tabelSppb,
    ])]),
  );
  gambarStok();
}
