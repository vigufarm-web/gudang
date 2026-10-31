// pusat.js — monitoring Kantor Pusat (admin Semarang): order dari SPPB yang
// sudah FULL ACC. Admin Semarang MENCEKLIS item mana saja yang sudah diorder;
// admin gudang melihat ceklisannya, dan begitu barang datang (Material Masuk
// di-link ke item SPPB) sisanya berkurang otomatis. Tiap item ketahuan:
// Belum Diorder → Diorder → Sampai Sebagian → Sampai.

import * as D from './data.js?v=7';
import * as P from './pengguna.js?v=7';
import { el, kosongkan, taruh, pesan, tabel, angka, tanggal, waktu } from './ui.js?v=7';
import { bisaEdit, spandukLokal } from './main.js?v=7';
import { kecil } from './form-util.js?v=7';
import { bukaDetailSppb } from './sppb.js?v=7';

const chipOrder = (st) => el('span.chip' + (
  st === 'Sampai' || st === 'Sampai Semua' ? '.chip-ok'
    : st === 'Belum Diorder' ? '.chip-tolak' : '.chip-tunggu'
), { teks: st });

export async function halamanPusat(wadah) {
  let filterStatus = 'aktif';
  let filterDivisi = '';

  const tempatKartu = el('div.angka-utama', { style: 'margin-bottom:1rem' });
  const tempatDaftar = el('div');
  const tempatTunggu = el('div');

  const gambar = () => {
    const semua = D.laporanSppb().map((s) => ({ ...s, acc: D.statusAcc(s.id), order: null }));
    const full = semua.filter((s) => s.acc === D.STATUS_ACC.FULL);
    for (const s of full) s.order = D.statusOrderSppb(s);
    const menunggu = semua.filter((s) => [D.STATUS_ACC.MENUNGGU_KEPALA, D.STATUS_ACC.MENUNGGU_KTU].includes(s.acc));

    const semuaItem = full.flatMap((s) => s.items.filter((it) => !it.batal));
    const nItem = (st) => semuaItem.filter((it) => D.statusOrderItem(it) === st).length;
    kosongkan(tempatKartu).append(...[
      ['Order aktif (SPPB full acc)', angka(full.filter(s=>s.status_keseluruhan!=='Selesai').length)],
      ['Item belum diorder', angka(nItem('Belum Diorder'))],
      ['Item diorder, belum sampai', angka(nItem('Diorder'))],
      ['Item sampai', angka(nItem('Sampai') + nItem('Sampai Sebagian'))],
    ].map(([l, v]) => el('div', {}, [el('dl', {}, [el('dt', { teks: l }), el('dd', { teks: v })])])));

    const tampil = full
      .filter((s) => filterStatus==='aktif' ? s.status_keseluruhan!=='Selesai' : !filterStatus || s.order === filterStatus)
      .filter((s) => !filterDivisi || kecil(s.divisi_pemohon) === kecil(filterDivisi))
      .sort((a, b) => String(D.waktuFullAcc(b.id)).localeCompare(String(D.waktuFullAcc(a.id))));

    kosongkan(tempatDaftar);
    if (!tampil.length) {
      tempatDaftar.append(el('p.kosong', { teks: 'Belum ada order full acc pada filter ini.' }));
    }
    for (const s of tampil) {
      const kepala = D.kepalaDivisi(s.divisi_pemohon);
      tempatDaftar.append(
        el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin:1rem 0 .3rem' }, [
          el('h3', { teks: `SPPB ${s.no_sppb}` }),
          chipOrder(s.order),
          el('span.bantuan', {
            teks: `${s.divisi_pemohon || '–'}${kepala?.nama ? ` (${kepala.nama})` : ''}`
              + ` · tgl ${tanggal(s.tanggal)} · full acc ${waktu(D.waktuFullAcc(s.id).replace(' ', 'T'))}`,
          }),
          el('button.tombol-teks', {
            type: 'button', teks: 'Detail SPPB', style: 'margin-left:auto;font-size:.82rem',
            onclick: () => bukaDetailSppb(s.id, gambar),
          }),
        ]),
        tabel([
          {
            l: 'Diorder ✓',
            nilai: (it) => {
              const catatan = D.orderItem(it.id);
              const cek = el('input', { type: 'checkbox', style: 'width:1.15rem;height:1.15rem;accent-color:var(--hijau)' });
              cek.checked = !!catatan;
              cek.disabled = !bisaEdit() || !P.punya('order') || !P.cakupan(s.divisi_pemohon);
              cek.addEventListener('change', () => {
                D.setOrderItem(it.id, cek.checked, D.namaPengisi() || 'Admin Semarang');
                pesan(cek.checked
                  ? `"${it.material}" diceklis sudah diorder.`
                  : `Ceklis order "${it.material}" dibatalkan.`, 'sukses', 3);
                gambar();
              });
              return el('span', { style: 'display:inline-flex;gap:.4rem;align-items:center' }, [
                cek,
                catatan ? el('small.bantuan', { teks: `${catatan.oleh} · ${String(catatan.waktu).slice(0, 10)}` }) : null,
              ]);
            },
          },
          { l: 'Material', k: 'material' },
          { l: 'Diminta', nilai: (it) => angka(it.qty_disetujui ?? it.qty_diminta, 2), rata: 'angka' },
          { l: 'Satuan', k: 'satuan' },
          { l: 'Sampai di gudang', k: 'realisasi', jenis: 'angka', pecahan: 2 },
          { l: 'Sisa', k: 'sisa', jenis: 'angka', pecahan: 2 },
          { l: 'Brand', nilai: (it) => it.brand || '–' },
          { l: 'Status', nilai: (it) => chipOrder(D.statusOrderItem(it)) },
        ], s.items.filter((it) => !it.batal), {
          kosong: 'Semua item SPPB ini dibatalkan saat proses acc.',
        }),
      );
    }

    kosongkan(tempatTunggu).append(tabel([
      { l: 'No. SPPB', k: 'no_sppb' },
      { l: 'Tanggal', k: 'tanggal', jenis: 'tanggal' },
      { l: 'Divisi', k: 'divisi_pemohon' },
      { l: 'Menunggu', nilai: (s) => (s.acc === D.STATUS_ACC.MENUNGGU_KEPALA
        ? `Kepala Divisi ${s.divisi_pemohon || ''}`.trim() : 'KTU') },
    ], menunggu, { kosong: 'Tidak ada SPPB yang masih menunggu acc.' }));
  };

  const pilihStatus = el('select', {
    'aria-label': 'Filter status order',
    onchange: (e) => { filterStatus = e.target.value; gambar(); },
  }, [
    el('option', { value: 'aktif', teks: 'Aktif · belum selesai' }),
    el('option', { value: '', teks: 'Semua status order' }),
    ...['Belum Diorder', 'Diorder Sebagian', 'Sudah Diorder', 'Sampai Sebagian', 'Sampai Semua']
      .map((st) => el('option', { value: st, teks: st })),
  ]);
  const pilihDivisi = el('select', {
    'aria-label': 'Filter divisi',
    onchange: (e) => { filterDivisi = e.target.value; gambar(); },
  }, [
    el('option', { value: '', teks: 'Semua divisi' }),
    ...[...D.baris('master_divisi')].sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
      .map((d) => el('option', { value: d.nama, teks: d.nama })),
  ]);

  taruh(wadah,
    spandukLokal(),
    tempatKartu,
    el('div.lembar', { style: 'margin-bottom:1rem' }, [el('div.lembar-isi', {}, [
      el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap;align-items:center' }, [
        el('h2', { teks: 'Order dari SPPB full acc' }),
        pilihStatus, pilihDivisi,
        el('button.tombol-samar.tombol-kecil', { type: 'button', teks: 'Cetak', onclick: () => window.print() }),
      ]),
      el('p.bantuan', { style: 'margin-top:.3rem', teks:
        'Admin Semarang menceklis item yang sudah diorder. Kolom "Sampai di gudang" terisi otomatis '
        + 'dari Material Masuk yang di-link ke item SPPB-nya — sisa berkurang sendiri.' }),
      tempatDaftar,
    ])]),
    el('div.lembar', {}, [el('div.lembar-isi', {}, [
      el('h2', { style: 'margin-bottom:.6rem', teks: 'Belum masuk order — masih menunggu acc' }),
      tempatTunggu,
    ])]),
  );
  gambar();
}
