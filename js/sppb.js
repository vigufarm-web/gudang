// sppb.js — SPPB (Surat Permintaan Pembelian Barang): buat SPPB beberapa item,
// monitoring realisasi per item (dihitung otomatis dari Material Masuk yang
// di-link), dan cetak surat permintaan ber-kop untuk persetujuan Direktur.

import * as D from './data.js?v=6';
import * as P from './pengguna.js?v=6';
import { el, kosongkan, taruh, pesan, tanya, mintaTeks, panel, isian, tabel, angka, tanggal, waktu, namaBulan, kesalahan, hariIni } from './ui.js?v=6';
import { bisaEdit, spandukLokal } from './main.js?v=6';
import { rapikan, inputMaster, inputAngka, namaFinal } from './form-util.js?v=6';
import { daftarJejak } from './persetujuan.js?v=6';
import {ringkasProgres,tahapMonitoring,cocokFilter} from './monitor-sppb.js?v=6';

const chipStatus = (st) => el('span.chip' + (
  st === 'Selesai' ? '.chip-ok' : st === 'Sebagian' ? '.chip-tunggu' : st === 'Belum Realisasi' ? '.chip-tolak' : ''
), { teks: st });

const chipAcc = (st) => el('span.chip' + (
  st === D.STATUS_ACC.FULL ? '.chip-ok'
    : st === D.STATUS_ACC.DITOLAK ? '.chip-tolak'
      : st === D.STATUS_ACC.LAMA ? '' : '.chip-tunggu'
), { teks: st === D.STATUS_ACC.LAMA ? 'Lama — tanpa acc' : st });

/** Revisi menggugurkan acc — minta konfirmasi dulu kalau sudah ada acc. */
async function konfirmasiRevisi(sppbId, apa) {
  const c = D.catatanAcc(sppbId);
  const sudah = ['kepala', 'ktu'].filter((t) => c?.[t]?.status === 'disetujui')
    .map((t) => (t === 'ktu' ? 'KTU' : 'kepala divisi'));
  if (!sudah.length) return true;
  return tanya('Revisi menggugurkan acc', `SPPB ini sudah di-acc ${sudah.join(' & ')}. `
    + `Kalau ${apa}, acc-nya gugur dan SPPB kembali ke antrean persetujuan dari awal — tercatat di jejak.`,
  { ya: 'Lanjut revisi', bahaya: true });
}

// --------------------------------------------------------- form buat SPPB
function barisItem(item = {}) {
  const kMaterial = inputMaster('master_material', item.material || '', {
    tempat: 'Material…',
    saatUbah: () => {
      const bawaan = D.satuanBawaan(kMaterial.value);
      if (bawaan && !kSatuan.value) kSatuan.value = bawaan;
    },
  });
  const kSatuan = inputMaster('master_satuan', item.satuan || '');
  const kQty = inputAngka(item.qty_diminta);
  kQty.placeholder = 'Qty';
  const kBrand = el('input', { type: 'text', nilai: item.brand || '', placeholder: 'opsional' });
  const kKet = el('input', { type: 'text', nilai: item.keterangan || '', placeholder: 'mis. Untuk Perangkap Lalat Buah' });
  const wadah = el('div', { style: 'border-bottom:1px solid var(--garis-tipis);padding-bottom:.45rem;margin-bottom:.55rem' }, [
    el('div.baris-isian.tiga', { style: 'align-items:end' }, [
      isian('Material', kMaterial),
      isian('Satuan', kSatuan),
      isian('Qty diminta', kQty),
    ]),
    el('div.baris-isian', {}, [
      isian('Keterangan tujuan pemakaian', kKet),
      isian('Brand', kBrand),
    ]),
  ]);
  return {
    wadah,
    ambil: () => ({
      material: rapikan(kMaterial.value),
      satuan: D.normalkanSatuan(kSatuan.value),
      qty_diminta: Number(kQty.value),
      brand: rapikan(kBrand.value),
      keterangan: rapikan(kKet.value),
    }),
    kosong: () => !rapikan(kMaterial.value) && !kQty.value,
  };
}

function formSppbBaru(saatSelesai) {
  const tempatGalat = el('div');
  // nomor lanjut otomatis dari yang terakhir (2696 → 2697); tetap bisa diubah
  const kNo = el('input', { type: 'text', nilai: D.nomorSppbBerikut(), placeholder: 'mis. 2697' });
  const kTanggal = el('input', { type: 'date', nilai: hariIni() });
  const kDivisi = inputMaster('master_divisi', '');
  const kKet = el('textarea', { rows: 2 });

  const daftarItem = [barisItem(), barisItem()];
  const tempatItem = el('div');
  const gambarItem = () => {
    kosongkan(tempatItem);
    for (const it of daftarItem) tempatItem.append(it.wadah);
  };
  gambarItem();

  const simpan = async () => {
    const no = rapikan(kNo.value);
    const items = daftarItem.filter((it) => !it.kosong()).map((it) => it.ambil());
    // anti-dobel: nama material tiap item disamakan dengan master / ditanyakan
    for (const it of items) it.material = await namaFinal('master_material', it.material, 'Material');
    const galat = [];
    if (!no) galat.push('No. SPPB wajib diisi.');
    else if (D.baris('sppb').some((s) => rapikan(s.no_sppb).toLowerCase() === no.toLowerCase())) {
      galat.push(`No. SPPB "${no}" sudah ada.`);
    }
    if (!kTanggal.value) galat.push('Tanggal wajib diisi.');
    if (!rapikan(kDivisi.value)) galat.push('Divisi pemohon wajib diisi — acc kepala divisi dialamatkan dari sini.');
    if (!items.length) galat.push('Minimal satu item material.');
    items.forEach((it, i) => {
      if (!it.material) galat.push(`Item ${i + 1}: material wajib diisi.`);
      if (!(it.qty_diminta > 0)) galat.push(`Item ${i + 1}: qty harus lebih dari 0.`);
    });
    kosongkan(tempatGalat);
    if (galat.length) { tempatGalat.append(kesalahan(galat)); return; }

    const divisi = await namaFinal('master_divisi', kDivisi.value, 'Divisi');
    if (divisi) D.pastikanMaster('master_divisi', divisi);
    for (const it of items) D.pastikanMaster('master_material',it.material,{satuan_default:it.satuan});
    const s = D.tambah('sppb', { no_sppb: no, tanggal: kTanggal.value, divisi_pemohon: divisi, keterangan: rapikan(kKet.value) });
    for (const it of items) {
      D.pastikanMaster('master_material', it.material, { satuan_default: it.satuan });
      D.tambah('sppb_items', { sppb_id: s.id, ...it });
    }
    pesan(`SPPB ${no} dibuat dengan ${items.length} item.`, 'sukses');
    p.tutup();
    saatSelesai();
  };

  const p = panel('Buat SPPB baru', el('div', {}, [
    tempatGalat,
    el('div.baris-isian', {}, [
      isian('No. SPPB *', kNo, { bantuan: 'Lanjut otomatis dari nomor terakhir — boleh diubah.' }),
      isian('Tanggal *', kTanggal),
    ]),
    isian('Divisi pemohon (kebun yang minta) *', kDivisi, {
      bantuan: 'Pisang, Padi, Infra, … — SPPB baru masuk antrean acc kepala divisi divisi ini.',
    }),
    isian('Keterangan', kKet),
    el('h3', { style: 'margin:.8rem 0 .4rem', teks: 'Item material' }),
    tempatItem,
    el('button.tombol-samar.tombol-kecil', {
      type: 'button', teks: '+ Tambah baris item',
      onclick: () => { daftarItem.push(barisItem()); gambarItem(); },
    }),
  ]), [el('button.tombol-utama', { type: 'button', teks: 'Simpan SPPB', onclick: simpan })]);
}

// ---------------------------------------------------- detail & ubah SPPB
function formItem(sppbId, itemLama, saatSelesai) {
  const tempatGalat = el('div');
  const kMaterial = inputMaster('master_material', itemLama?.material || '', {
    saatUbah: () => {
      const bawaan = D.satuanBawaan(kMaterial.value);
      if (bawaan && !kSatuan.value) kSatuan.value = bawaan;
    },
  });
  const kSatuan = inputMaster('master_satuan', itemLama?.satuan || '');
  const kQty = inputAngka(itemLama?.qty_diminta);
  const kDisetujui = inputAngka(itemLama?.qty_disetujui ?? '');
  kDisetujui.placeholder = 'kosong = belum ditetapkan';
  const kBeban = el('input', { type: 'text', nilai: itemLama?.beban || '', placeholder: 'opsional' });
  const kBrand = el('input', { type: 'text', nilai: itemLama?.brand || '', placeholder: 'opsional' });
  const kKetItem = el('input', { type: 'text', nilai: itemLama?.keterangan || '', placeholder: 'mis. Untuk Ikat Ajir Ke Tanaman' });

  const simpan = async () => {
    const nilai = {
      material: await namaFinal('master_material', kMaterial.value, 'Material'),
      satuan: D.normalkanSatuan(kSatuan.value),
      qty_diminta: Number(kQty.value),
      qty_disetujui: kDisetujui.value === '' ? null : Number(kDisetujui.value),
      beban: rapikan(kBeban.value),
      brand: rapikan(kBrand.value),
      keterangan: rapikan(kKetItem.value),
    };
    const galat = [];
    if (!nilai.material) galat.push('Material wajib diisi.');
    if (!(nilai.qty_diminta > 0)) galat.push('Qty harus lebih dari 0.');
    kosongkan(tempatGalat);
    if (galat.length) { tempatGalat.append(kesalahan(galat)); return; }
    if (!await konfirmasiRevisi(sppbId, itemLama ? 'item ini diubah' : 'item baru ditambahkan')) return;
    D.pastikanMaster('master_material', nilai.material, { satuan_default: nilai.satuan });
    if (itemLama) D.ubah('sppb_items', itemLama.id, nilai);
    else D.tambah('sppb_items', { sppb_id: sppbId, ...nilai });
    p.tutup();
    saatSelesai();
  };

  const aksi = [el('button.tombol-utama', { type: 'button', teks: 'Simpan', onclick: simpan })];
  if (itemLama) {
    aksi.unshift(el('button.tombol-bahaya', {
      type: 'button', teks: 'Hapus item',
      onclick: async () => {
        const n = D.realisasiItem(itemLama.id);
        if (!await tanya(`Hapus item "${itemLama.material}"?`,
          n > 0 ? `Sudah ada realisasi ${angka(n, 2)} ${itemLama.satuan || ''}. Material masuk yang tercatat TIDAK ikut terhapus — hanya link-nya dilepas.`
            : 'Item ini belum ada realisasinya.', { ya: 'Hapus', bahaya: true })) return;
        if (!await konfirmasiRevisi(sppbId, 'item ini dihapus')) return;
        D.hapus('sppb_items', itemLama.id);
        p.tutup();
        saatSelesai();
      },
    }));
  }
  const p = panel(itemLama ? 'Ubah item SPPB' : 'Tambah item SPPB', el('div', {}, [
    tempatGalat,
    isian('Material *', kMaterial),
    el('div.baris-isian', {}, [
      isian('Satuan', kSatuan),
      isian('Qty diminta *', kQty),
    ]),
    el('div.baris-isian', {}, [
      isian('Qty disetujui', kDisetujui, { bantuan: 'Diisi saat acc kalau jumlahnya dikoreksi.' }),
      isian('Beban biaya', kBeban),
    ]),
    el('div.baris-isian', {}, [
      isian('Brand', kBrand),
      isian('Keterangan tujuan pemakaian', kKetItem),
    ]),
  ]), aksi);
}

export function bukaDetailSppb(sppbId, saatSelesai) {
  const muatS = () => D.laporanSppb().find((x) => Number(x.id) === Number(sppbId));
  let s = muatS();
  if (!s) return;

  const kNo = el('input', { type: 'text', nilai: s.no_sppb });
  const kTanggal = el('input', { type: 'date', nilai: s.tanggal });
  const kDivisi = inputMaster('master_divisi', s.divisi_pemohon || '');
  const kKet = el('textarea', { rows: 2 }, [s.keterangan || '']);
  const tempatGalat = el('div');
  const tempatItem = el('div');

  const gambarItem = () => {
    s = muatS();
    if (!s) return;
    kosongkan(tempatItem).append(
      el('div', { style: 'display:flex;align-items:center;gap:.6rem;margin:.8rem 0 .4rem' }, [
        el('h3', { teks: 'Item & realisasi' }),
        chipStatus(s.status_keseluruhan),
        bisaEdit() && P.bolehInput() && P.cakupan(s.divisi_pemohon) ? el('button.tombol-samar.tombol-kecil', {
          type: 'button', teks: '+ Tambah item', style: 'margin-left:auto',
          onclick: () => formItem(s.id, null, () => { gambarItem(); saatSelesai(); }),
        }) : null,
      ]),
      tabel([
        { l: 'Material', nilai: (r) => (r.batal
          ? el('span', { style: 'text-decoration:line-through;color:var(--tinta-samar)', teks: r.material })
          : r.material) },
        { l: 'Diminta', k: 'qty_diminta', jenis: 'angka', pecahan: 2 },
        { l: 'Disetujui', nilai: (r) => (r.qty_disetujui == null ? '–' : angka(r.qty_disetujui, 2)), rata: 'angka' },
        { l: 'Realisasi', k: 'realisasi', jenis: 'angka', pecahan: 2 },
        { l: 'Sisa', k: 'sisa', jenis: 'angka', pecahan: 2 },
        { l: 'Satuan', k: 'satuan' },
        { l: 'Ket. tujuan / brand', nilai: (r) => [r.keterangan, r.brand].filter(Boolean).join(' · ') || '–' },
        { l: 'Diorder (Semarang)', nilai: (r) => {
          const o = D.orderItem(r.id);
          return o ? el('span', {}, ['✔ ', el('small.bantuan', { teks: `${o.oleh} · ${String(o.waktu).slice(0, 10)}` })]) : '–';
        } },
        { l: 'Status', nilai: (r) => (r.batal
          ? el('span', {}, [el('span.chip', { teks: 'Dibatalkan' }),
            el('div.bantuan', { style: 'font-size:.74rem', teks: `${r.batal.oleh}: ${r.batal.alasan || ''}` })])
          : chipStatus(r.status)) },
        bisaEdit() && P.punya('batal') && (P.punya('kepala') || P.punya('ktu')) && P.cakupan(s.divisi_pemohon) ? { l: '', nilai: (r) => el('button.tombol-kecil.tombol-samar', {
          type: 'button',
          teks: r.batal ? 'Pulihkan' : 'Batal',
          title: r.batal ? 'Pulihkan item ini' : 'Batalkan item ini — tidak perlu diorder',
          onclick: async (e) => {
            e.stopPropagation();
            const oleh = D.kepalaDivisi(s.divisi_pemohon)?.nama || D.namaPengisi() || 'Web';
            if (r.batal) {
              if (!await tanya(`Pulihkan item "${r.material}"?`,
                'Item kembali ikut diorder, dihitung di realisasi, dan tercetak di surat.',
                { ya: 'Pulihkan' })) return;
              D.setItemBatal(r.id, false, oleh);
            } else {
              const alasan = await mintaTeks(`Batalkan item "${r.material}"?`,
                'Item tidak perlu diorder: keluar dari surat, dari ceklis order Semarang, dan dari hitungan '
                + 'realisasi. Acc yang sudah ada TIDAK gugur. Bisa dipulihkan kapan saja.',
                { label: 'Alasan pembatalan', ya: 'Batalkan item', wajib: true });
              if (alasan == null) return;
              try { D.setItemBatal(r.id, true, oleh, alasan); } catch (err) { pesan(err.message, 'galat'); return; }
            }
            gambarItem();
            saatSelesai();
          },
        }) } : null,
      ].filter(Boolean), s.items, {
        kosong: 'Belum ada item.',
        saatKlik: bisaEdit() && P.bolehUbah('sppb',s) ? (r) => formItem(s.id, D.cari('sppb_items', r.id), () => { gambarItem(); saatSelesai(); }) : null,
      }),
      el('p.bantuan', { teks: 'Realisasi dihitung otomatis dari Material Masuk yang di-link ke item itu. '
        + 'Tombol "Batal" = keputusan saat acc (item tidak perlu diorder) — berbeda dari revisi, acc tidak gugur.' }),
    );
  };
  gambarItem();

  const simpanKepala = async () => {
    const no = rapikan(kNo.value);
    const galat = [];
    if (!no) galat.push('No. SPPB wajib diisi.');
    else if (D.baris('sppb').some((x) => Number(x.id) !== Number(s.id)
      && rapikan(x.no_sppb).toLowerCase() === no.toLowerCase())) galat.push(`No. SPPB "${no}" sudah dipakai.`);
    if (!kTanggal.value) galat.push('Tanggal wajib diisi.');
    const divisi = await namaFinal('master_divisi', kDivisi.value, 'Divisi');
    if (!divisi) galat.push('Divisi pemohon wajib diisi — acc kepala divisi dialamatkan dari sini.');
    kosongkan(tempatGalat);
    if (galat.length) { tempatGalat.append(kesalahan(galat)); return; }
    const berubah = no !== rapikan(s.no_sppb) || kTanggal.value !== s.tanggal
      || divisi !== rapikan(s.divisi_pemohon) || rapikan(kKet.value) !== rapikan(s.keterangan);
    if (berubah && !await konfirmasiRevisi(s.id, 'data SPPB ini diubah')) return;
    D.pastikanMaster('master_divisi', divisi);
    if (berubah) {
      D.ubah('sppb', s.id, { no_sppb: no, tanggal: kTanggal.value, divisi_pemohon: divisi, keterangan: rapikan(kKet.value) });
      pesan('Perubahan SPPB dicatat.', 'sukses');
    }
    p.tutup();
    saatSelesai();
  };

  const aksi = [
    el('button.tombol-samar', { type: 'button', teks: 'Cetak surat permintaan', onclick: () => cetakSurat(s.id) }),
    el('button.tombol-utama', { type: 'button', teks: 'Simpan', onclick: simpanKepala }),
  ];
  if (bisaEdit() && P.bolehUbah('sppb',s)) {
    aksi.unshift(el('button.tombol-bahaya', {
      type: 'button', teks: 'Hapus SPPB',
      onclick: async () => {
        if (!await tanya(`Hapus SPPB ${s.no_sppb}?`,
          'Material Masuk yang sudah tercatat TIDAK ikut terhapus — hanya link ke SPPB ini yang dilepas.',
          { ya: 'Hapus', bahaya: true })) return;
        D.hapus('sppb', s.id);
        pesan('SPPB terhapus.', 'sukses');
        p.tutup();
        saatSelesai();
      },
    }));
  }

  // ----- status persetujuan + jejak audit
  const stAcc = D.statusAcc(s.id);
  const c = D.catatanAcc(s.id);
  const barisTahap = (label, t, pejabat) => {
    const kep = c?.[t];
    let teks;
    if (kep?.status === 'disetujui') teks = kep.sumber==='manual' ? '✔ Disetujui manual (arsip) · tanggal asli tidak tersedia' : `✔ ${kep.oleh} · ${waktu(kep.waktu.replace(' ', 'T'))}`;
    else if (kep?.status === 'ditolak') teks = `✖ Ditolak ${kep.oleh}: ${kep.alasan || ''}`;
    else teks = pejabat?.nama ? `menunggu — ${pejabat.nama}` : 'menunggu — pejabatnya belum dipasang di Pengaturan';
    return el('div', { style: 'display:flex;gap:.5rem;font-size:.88rem;padding:.15rem 0' }, [
      el('span', { style: 'min-width:9.5rem;color:var(--tinta-samar)', teks: label }),
      el('span', { teks }),
    ]);
  };
  const jejak = el('div', { style: 'display:none;margin-top:.4rem' }, [daftarJejak(s.id)]);
  const blokAcc = el('div', { style: 'border:1px solid var(--garis);border-radius:8px;padding:.6rem .8rem;margin:.6rem 0' }, [
    el('div', { style: 'display:flex;gap:.6rem;align-items:center;margin-bottom:.3rem' }, [
      el('strong', { teks: 'Persetujuan' }), chipAcc(stAcc),
      el('button.tombol-teks', {
        type: 'button', teks: 'Jejak audit', style: 'margin-left:auto;font-size:.82rem',
        onclick: () => { jejak.style.display = jejak.style.display === 'none' ? '' : 'none'; },
      }),
    ]),
    ...(stAcc === D.STATUS_ACC.LAMA
      ? [el('p.bantuan', { style: 'margin:.2rem 0 0', teks:
        'SPPB ini dibuat sebelum fitur persetujuan ada, jadi tidak perlu di-acc. '
        + 'Alur acc kepala divisi → KTU hanya berlaku untuk pengajuan baru.' })]
      : [
        barisTahap(`Kepala Divisi ${s.divisi_pemohon || ''}`.trim(), 'kepala', D.kepalaDivisi(s.divisi_pemohon)),
        barisTahap('KTU', 'ktu', D.ktu()),
        el('p.bantuan', { style: 'margin:.3rem 0 0', teks: 'Keputusan acc/tolak dilakukan di menu Persetujuan. '
          + 'Merevisi SPPB menggugurkan acc yang sudah ada.' }),
      ]),
    jejak,
  ]);

  const p = panel(`SPPB ${s.no_sppb}`, el('div', {}, [
    tempatGalat,
    el('div.baris-isian', {}, [
      isian('No. SPPB *', kNo),
      isian('Tanggal *', kTanggal),
    ]),
    isian('Divisi pemohon (kebun yang minta) *', kDivisi, {
      bantuan: D.kepalaDivisi(s.divisi_pemohon)?.nama
        ? `Kepala divisi terdaftar: ${D.kepalaDivisi(s.divisi_pemohon).nama}` : null,
    }),
    isian('Keterangan', kKet),
    blokAcc,
    tempatItem,
  ]), bisaEdit() && P.bolehUbah('sppb',s) ? aksi : [aksi[0]]);
}

// --------------------------------------------------------- cetak surat
const amanHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function cetakSurat(sppbId) {
  const s = D.laporanSppb().find((x) => Number(x.id) === Number(sppbId));
  if (!s) return;
  const atur = D.pengaturan();
  const kepala = D.kepalaDivisi(s.divisi_pemohon);
  const dataKtu = D.ktu();
  const c = D.catatanAcc(sppbId);
  const stAcc = D.statusAcc(sppbId);
  const kepalaAcc = c?.kepala?.status === 'disetujui' ? c.kepala : null;
  const ktuAcc = c?.ktu?.status === 'disetujui' ? c.ktu : null;

  // Peran di surat: ADMIN GUDANG yang membuat, KEPALA KEBUN divisi pemohon
  // yang meminta, KTU yang memeriksa, Direktur menyetujui di atas kertas.
  // Tanda tangan tahap yang sudah acc ikut tertempel otomatis di suratnya.
  const kAdmin = el('input', { type: 'text',
    nilai: atur.default_nama_admin || D.namaPengisi() || '', placeholder: 'Nama admin gudang' });
  const kSetuju = el('input', { type: 'text', nilai: atur.default_nama_disetujui || '', placeholder: 'Nama direktur' });
  const lanjut = await new Promise((selesai) => {
    const p = panel('Cetak surat permintaan SPPB', el('div', {}, [
      el('p.bantuan', { teks: `Surat resmi 1 halaman untuk SPPB ${s.no_sppb} mengikuti format SPPB perusahaan: `
        + 'kop + logo, kolom Jumlah Diminta/Disetujui, Beban Biaya, Brand, Keterangan Tujuan Pemakaian, '
        + 'dan 5 kolom ttd: Dibuat, Diminta, Diperiksa, Mengetahui, Diterima.' }),
      el('p', { teks: `Status acc: ${stAcc}. `
        + (kepalaAcc?.sumber==='manual' ? 'Persetujuan kepala divisi dari arsip manual; gambar tanda tangan tidak ditempel. ' : kepalaAcc ? `Ttd kepala divisi${kepala?.ttd ? ' tertempel otomatis' : ' (gambar ttd belum tersimpan — kolomnya kosong untuk ttd basah)'}. ` : 'Kolom kepala divisi kosong untuk ttd basah. ')
        + (ktuAcc?.sumber==='manual' ? 'Persetujuan KTU dari arsip manual; gambar tanda tangan tidak ditempel.' : ktuAcc ? `Ttd KTU${dataKtu?.ttd ? ' tertempel otomatis.' : ' (gambar ttd belum tersimpan).'}` : 'Kolom KTU kosong untuk ttd basah.') }),
      isian('Dibuat — Admin Gudang', kAdmin),
      isian(`Diminta — Kepala Divisi ${s.divisi_pemohon || ''}`.trim(),
        el('input', { type: 'text', nilai: kepalaAcc?.oleh || kepala?.nama || '', disabled: true }),
        { bantuan: 'Nama & ttd mengikuti acc / Pengaturan → Kepala divisi & tanda tangan.' }),
      isian('Diperiksa — KTU', el('input', { type: 'text', nilai: ktuAcc?.oleh || dataKtu?.nama || '', disabled: true })),
      isian('Mengetahui', kSetuju, { bantuan: 'Kolom "Diterima" dibiarkan kosong untuk ttd penerima barang.' }),
    ]), [el('button.tombol-utama', { type: 'button', teks: 'Buka pratinjau cetak', onclick: () => { p.tutup(); selesai(true); } })]);
  });
  if (!lanjut) return;

  if (bisaEdit() && P.admin()) {
    if ((atur.default_nama_disetujui || '') !== kSetuju.value.trim()) {
      D.setPengaturan('default_nama_disetujui', kSetuju.value.trim());
    }
    if ((atur.default_nama_admin || '') !== kAdmin.value.trim()) {
      D.setPengaturan('default_nama_admin', kAdmin.value.trim());
    }
  }

  // ---- kop & judul — mengikuti format surat SPPB asli perusahaan
  const namaPerusahaan = atur.company_nama || 'PT VIGU FARM INDONESIA';
  const alamat1 = atur.company_alamat || 'Kebun Banjaranyar, Kec.Balapulang';
  const alamat2 = atur.company_kontak || 'Kab. Tegal, Jawa Tengah 52464';
  const logo = atur.company_logo_base64
    ? `<img src="data:image/png;base64,${atur.company_logo_base64}" alt="logo" style="height:110px">` : '';

  const p2 = (n) => String(n).padStart(2, '0');
  const [th, bl, hr] = String(s.tanggal).split('-').map(Number);
  const tanggalPenuh = `${p2(hr)} ${namaBulan(bl)} ${th}`;
  const barisNomor = /sppb/i.test(s.no_sppb)
    ? `Nomor : &nbsp; ${amanHtml(s.no_sppb)} &nbsp; ${tanggalPenuh}`
    : `Nomor : &nbsp; ${amanHtml(s.no_sppb)} &nbsp; /SPPB/ &nbsp; ${tanggalPenuh}`;

  const fmtQ = (v) => (v == null || v === '' ? '' : angka(v, 2).replace(/,00$/, ''));
  // item yang dibatalkan kepala divisi tidak ikut tercetak di surat
  const itemAktif = s.items.filter((it) => !it.batal);
  const nBatal = s.items.length - itemAktif.length;
  const barisItem = itemAktif.map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${amanHtml(it.material)}</td>
      <td style="text-align:center">${amanHtml(it.satuan || '')}</td>
      <td style="text-align:center">${fmtQ(it.qty_diminta)}</td>
      <td style="text-align:center">${fmtQ(it.qty_disetujui)}</td>
      <td style="text-align:center">${amanHtml(it.beban || '')}</td>
      <td style="text-align:center">${amanHtml(it.brand || '')}</td>
      <td>${amanHtml(it.keterangan || '')}</td>
    </tr>`).join('');

  // kolom ttd: tahap yang sudah acc + punya gambar ttd → gambarnya ditempel;
  // selain itu ruang kosong untuk ttd basah. Nama kosong → garis titik.
  const ttd = (jabatan, nama, gambarTtd = '') => `
    <td style="width:20%;text-align:center;vertical-align:bottom">
      <div style="font-weight:700">${jabatan}</div>
      <div style="height:78px;display:flex;align-items:center;justify-content:center">
        ${gambarTtd ? `<img src="data:image/png;base64,${gambarTtd}" alt="ttd" style="max-height:74px;max-width:95%">` : ''}
      </div>
      <div style="font-weight:700;border-bottom:1.5px solid #111;display:inline-block;min-width:80%;padding:0 4px">
        ${amanHtml(nama) || '&nbsp;'}
      </div>
    </td>`;

  const w = window.open('', '_blank');
  if (!w) { pesan('Pop-up dicekal peramban. Izinkan pop-up untuk situs ini.', 'galat', 6); return; }
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8">
    <title>SPPB ${amanHtml(s.no_sppb)}</title>
    <style>
      body{font-family:Calibri,Arial,Helvetica,sans-serif;color:#111;margin:26px;font-size:14px}
      table.isi{width:100%;border-collapse:collapse;margin:6px 0 2px}
      table.isi th,table.isi td{border:1.4px solid #111;padding:3px 7px;font-size:13.5px}
      table.isi th{font-weight:700;text-align:center}
      @media print{ body{margin:10mm} .noprint{display:none} }
    </style></head><body>

    <div style="position:relative;min-height:120px;margin-bottom:4px">
      <div style="position:absolute;left:0;top:0">${logo}</div>
      <div style="text-align:center;padding:4px 120px 0">
        <div style="font-size:23px;font-weight:800">${amanHtml(namaPerusahaan)}</div>
        <div style="font-size:16px;font-weight:700;font-style:italic">${amanHtml(alamat1)}</div>
        <div style="font-size:13px;font-weight:700;font-style:italic">${amanHtml(alamat2)}</div>
      </div>
    </div>
    <div style="border-top:1.6px solid #111;margin:4px 0 0"></div>
    <div style="text-align:center;margin:5px 0 10px">
      <div style="font-weight:800">SURAT PERMOHONAN PEMBELIAN BARANG (SPPB)</div>
      <div style="font-weight:700;margin-top:2px">${barisNomor}</div>
    </div>

    <table class="isi">
      <thead>
        <tr>
          <th rowspan="2" style="width:30px">No</th>
          <th rowspan="2">Nama &amp; Spesifikasi Barang</th>
          <th rowspan="2" style="width:58px">Sat</th>
          <th colspan="2" style="width:130px">Jumlah</th>
          <th rowspan="2" style="width:60px">Beban<br>Biaya</th>
          <th rowspan="2" style="width:92px">Brand</th>
          <th rowspan="2" style="width:200px">Keterangan Tujuan Pemakaian</th>
        </tr>
        <tr>
          <th style="width:65px">Diminta</th>
          <th style="width:65px">Disetujui</th>
        </tr>
      </thead>
      <tbody>${barisItem}</tbody>
    </table>
    ${s.keterangan ? `<div style="font-size:13px;margin-top:2px">Keterangan: ${amanHtml(s.keterangan)}</div>` : ''}
    ${nBatal ? `<div style="font-size:12px;margin-top:2px;color:#444">Catatan: ${nBatal} item dibatalkan saat proses persetujuan dan tidak tercantum di surat ini.</div>` : ''}

    <table style="width:100%;margin-top:30px"><tr>
      ${ttd('Dibuat', kAdmin.value.trim())}
      ${ttd('Diminta', kepalaAcc?.oleh || kepala?.nama || '', kepalaAcc && kepalaAcc.sumber!=='manual' ? (kepala?.ttd || '') : '')}
      ${ttd('Diperiksa', ktuAcc?.oleh || dataKtu?.nama || '', ktuAcc && ktuAcc.sumber!=='manual' ? (dataKtu?.ttd || '') : '')}
      ${ttd('Mengetahui', kSetuju.value.trim())}
      ${ttd('Diterima', '')}
    </tr></table>

    <p class="noprint" style="margin-top:24px"><button onclick="print()">Cetak / simpan PDF</button></p>
    </body></html>`);
  w.document.close();
}

// --------------------------------------------------------------- halaman
export async function halamanSppb(wadah) {
  const filter={kata:'',divisi:'',dari:'',sampai:'',tahap:'semua',status:'semua'};
  const ringkasan=el('div.monitor-ringkasan');
  const tab=el('div.monitor-tab',{'aria-label':'Tahap monitoring'});
  const hasil=el('div.monitor-hasil');
  const jumlah=el('p.bantuan',{'aria-live':'polite'});
  const galat=el('p.kesalahan',{hidden:true});
  const tahapLabel=[['semua','Semua'],['persetujuan','Menunggu persetujuan'],['order','Siap order'],['penerimaan','Proses penerimaan'],['selesai','Selesai']];
  const cari=el('input',{type:'search',placeholder:'Cari nomor SPPB atau material…','aria-label':'Cari SPPB atau material',oninput:e=>{filter.kata=e.target.value;gambar();}});
  const divisi=el('select',{'aria-label':'Filter divisi',onchange:e=>{filter.divisi=e.target.value;gambar();}},[
    el('option',{value:'',teks:'Semua divisi'}),
    ...[...new Set(D.baris('sppb').map(s=>s.divisi_pemohon).filter(Boolean))].sort().map(d=>el('option',{value:d,teks:d})),
  ]);
  const dari=el('input',{type:'date','aria-label':'Dari tanggal',onchange:e=>{filter.dari=e.target.value;gambar();}});
  const sampai=el('input',{type:'date','aria-label':'Sampai tanggal',onchange:e=>{filter.sampai=e.target.value;gambar();}});
  function gambar() {
    const semua=D.laporanSppb().map(s=>{
      const c=D.catatanAcc(s.id),acc=D.statusAcc(s.id),p=ringkasProgres(s.items);
      const adaOrder=s.items.some(it=>!it.batal && D.orderItem(it.id));
      return {...s,acc,progres:p,manual:c?.kepala?.sumber==='manual' && c?.ktu?.sumber==='manual',
        monitor:tahapMonitoring(s,acc===D.STATUS_ACC.FULL,adaOrder),adaOrder};
    });
    kosongkan(ringkasan);
    for(const [label,st,warna] of [['Total SPPB','semua','hijau'],['Belum realisasi','Belum Realisasi','merah'],['Sebagian','Sebagian','kuning'],['Selesai','Selesai','hijau']]) {
      const n=st==='semua'?semua.length:semua.filter(s=>s.status_keseluruhan===st).length;
      ringkasan.append(el('button.monitor-kartu.'+warna,{type:'button','aria-pressed':filter.status===st,
        onclick:()=>{filter.status=st;filter.tahap='semua';gambar();}},[
        el('span',{teks:label}),el('strong',{teks:angka(n)}),el('small',{teks:st==='semua'?'Seluruh dokumen':'Klik untuk memfilter'}),
      ]));
    }
    kosongkan(tab);
    for(const [k,label] of tahapLabel) tab.append(el('button'+(filter.tahap===k?'.aktif':''),{type:'button','aria-pressed':filter.tahap===k,
      onclick:()=>{filter.tahap=k;filter.status='semua';gambar();}},[label,el('span',{teks:String(k==='semua'?semua.length:semua.filter(s=>s.monitor===k).length)})]));
    galat.hidden=!(filter.dari && filter.sampai && filter.dari>filter.sampai);
    galat.textContent=galat.hidden?'':'Tanggal awal harus sebelum atau sama dengan tanggal akhir.';
    const tampil=galat.hidden?semua.filter(s=>cocokFilter(s,filter)):[];
    jumlah.textContent=`Menampilkan ${tampil.length} dari ${semua.length} SPPB${filter.status!=='semua'?' · '+filter.status:''}. Klik baris untuk rincian material dan penerimaan.`;
    kosongkan(hasil).append(tabel([
      {l:'SPPB',nilai:s=>el('div',{},[el('strong',{teks:s.no_sppb}),el('small.monitor-tanggal',{teks:tanggal(s.tanggal)})])},
      {l:'Divisi',k:'divisi_pemohon'},
      {l:'Persetujuan',nilai:s=>el('div',{},[chipAcc(s.acc),s.manual?el('small.monitor-manual',{teks:'Disetujui manual · arsip',title:'Persetujuan terdahulu dikonfirmasi pemilik. Tanggal asli tidak tersedia; tanggal pencatatan ada di jejak audit.'}):null])},
      {l:'Progres penerimaan',nilai:s=>el('div.monitor-progres',{},[
        el('div',{},[el('strong',{teks:`${s.progres.persen}%`}),el('span',{teks:`${s.progres.selesai}/${s.progres.total} item selesai`})]),
        el('progress',{max:100,value:s.progres.persen,'aria-label':`Pemenuhan SPPB ${s.no_sppb}`,title:'Rata-rata pemenuhan per item; tidak menjumlahkan satuan material yang berbeda.'}),chipStatus(s.status_keseluruhan),
      ])},
      {l:'Alur proses',nilai:s=>{
        const c=D.catatanAcc(s.id);
        return el('div.monitor-alur',{},[
          ['Kepala Divisi',c?.kepala?.status==='disetujui'],['KTU',c?.ktu?.status==='disetujui'],
          ['Order',s.adaOrder],['Diterima',s.progres.total>0&&s.progres.selesai===s.progres.total],
        ].map(([label,ok])=>el('span'+(ok?'.selesai':''),{teks:`${ok?'✓':'○'} ${label}`})));
      }},
      {l:'Keterangan',nilai:s=>el('span.monitor-catatan',{teks:s.keterangan||'—'})},
    ],tampil,{kosong:'Tidak ada SPPB yang cocok. Ubah pencarian atau reset filter.',saatKlik:s=>bukaDetailSppb(s.id,gambar)}));
  }
  const reset=()=>{
    Object.assign(filter,{kata:'',divisi:'',dari:'',sampai:'',tahap:'semua',status:'semua'});
    cari.value='';divisi.value='';dari.value='';sampai.value='';gambar();
  };
  taruh(wadah,spandukLokal(),el('div.monitor-pengantar',{},[
    el('div',{},[el('h2',{teks:'Monitoring SPPB'}),el('p',{teks:'Pantau persetujuan, pemesanan, dan penerimaan material dalam satu daftar.'})]),
    el('div.monitor-aksi',{},[
      bisaEdit()&&P.bolehInput()?el('button.tombol-utama',{type:'button',teks:'+ Buat SPPB',onclick:()=>formSppbBaru(gambar)}):null,
      el('button.tombol-samar',{type:'button',teks:'Cetak monitoring',onclick:()=>window.print()}),
    ]),
  ]),ringkasan,el('div.lembar.monitor-lembar',{},[el('div.lembar-isi',{},[
    tab,el('div.monitor-filter',{},[isian('Pencarian',cari),isian('Divisi',divisi),isian('Dari tanggal',dari),isian('Sampai tanggal',sampai),
      el('button.tombol-samar',{type:'button',teks:'Reset filter',onclick:reset})]),galat,jumlah,hasil,
  ])]));
  gambar();
}
