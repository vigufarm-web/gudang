// persetujuan.js — Persetujuan SPPB berjenjang:
//   1. Kepala divisi divisi pemohon (Pisang, Padi, …) meng-acc permintaannya
//   2. KTU meng-acc (memeriksa)
//   3. Full acc → tampil di monitoring Kantor Pusat sebagai order
//
// Tiap kepala divisi & KTU bisa dipasangi PIN (menu Pengaturan) supaya acc
// Pisang tidak bisa ditekan orang Padi. Menolak wajib beralasan dan TIDAK
// menghapus SPPB. Acc yang telanjur diberikan bisa dibatalkan — tercatat
// siapa dan kenapa. Semua keputusan masuk jejak audit per SPPB.

import * as D from './data.js?v=7';
import { el, kosongkan, taruh, pesan, tanya, mintaTeks, isian, tabel, angka, tanggal, waktu } from './ui.js?v=7';
import { bisaEdit, spandukLokal } from './main.js?v=7';
import { kecil } from './form-util.js?v=7';
import { bukaDetailSppb } from './sppb.js?v=7';
import * as P from './pengguna.js?v=7';

const chipAcc = (st) => el('span.chip' + (
  st === D.STATUS_ACC.FULL ? '.chip-ok'
    : st === D.STATUS_ACC.DITOLAK ? '.chip-tolak' : '.chip-tunggu'
), { teks: st });

/** Dialog PIN. PIN kosong (belum dipasang) → langsung lolos, seperti payroll. */
export function mintaPin(judul, pinBenar, keterangan) {
  if (!String(pinBenar || '')) return Promise.resolve(true);
  return new Promise((selesai) => {
    const inp = el('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: 'PIN' });
    const galat = el('small.bantuan', { style: 'color:var(--merah);display:none', teks: 'PIN salah.' });
    const tutup = (jawab) => { latar.remove(); document.removeEventListener('keydown', tombol); selesai(jawab); };
    const kirim = () => {
      if (inp.value !== String(pinBenar)) { galat.style.display = ''; inp.select(); return; }
      tutup(true);
    };
    const tombol = (e) => {
      if (e.key === 'Escape') tutup(false);
      if (e.key === 'Enter') { e.preventDefault(); kirim(); }
    };
    const kotak = el('div.dialog', { role: 'dialog', 'aria-modal': 'true' }, [
      el('h2', { teks: judul }),
      el('p', { teks: keterangan }),
      el('div.isian', {}, [el('label', { teks: 'PIN' }), inp, galat]),
      el('div.dialog-aksi', {}, [
        el('button.tombol-samar', { type: 'button', onclick: () => tutup(false), teks: 'Batal' }),
        el('button.tombol-utama', { type: 'button', onclick: kirim, teks: 'Lanjutkan' }),
      ]),
    ]);
    const latar = el('div.latar-dialog', { onclick: (e) => { if (e.target === latar) tutup(false); } }, [kotak]);
    document.body.append(latar);
    document.addEventListener('keydown', tombol);
    inp.focus();
  });
}

const ringkasItem = (s) => {
  const aktif = s.items.filter((it) => !it.batal);
  const nBatal = s.items.length - aktif.length;
  return aktif.map((it) => `${it.material} ${angka(it.qty_diminta, 2)} ${it.satuan || ''}`.trim()).join(', ')
    + (nBatal ? ` · ${nBatal} item dibatalkan` : '');
};

async function aksiAcc(s, tahap, muatUlang) {
  if (!P.bolehAcc(s,tahap)) { pesan('Tidak memiliki hak persetujuan untuk tahap/divisi ini.','galat'); return; }
  const kepala = D.kepalaDivisi(s.divisi_pemohon);
  const pejabat = tahap === 'ktu' ? D.ktu() : kepala;
  const jabatan = tahap === 'ktu' ? 'KTU' : `Kepala Divisi ${s.divisi_pemohon || '(tanpa divisi)'}`;
  if (tahap === 'kepala' && !kepala?.nama) {
    pesan(`Kepala divisi untuk divisi "${s.divisi_pemohon || '(kosong)'}" belum dipasang. `
      + 'Isi dulu di Pengaturan → Kepala divisi & tanda tangan.', 'awas', 8);
    return;
  }
  if (tahap === 'ktu' && !D.ktu().nama) {
    pesan('Nama KTU belum dipasang. Isi dulu di Pengaturan → Kepala divisi & tanda tangan.', 'awas', 8);
    return;
  }
  const lolos = await mintaPin(`Acc ${jabatan}`, pejabat?.pin,
    `SPPB ${s.no_sppb} — ${ringkasItem(s) || 'tanpa item'}. `
    + `Acc atas nama ${pejabat?.nama}${pejabat?.ttd ? ' (tanda tangan ikut tertempel di surat)' : ''}.`);
  if (!lolos) return;
  try {
    D.setujuiSppb(s.id, tahap, pejabat.nama);
    pesan(`SPPB ${s.no_sppb} di-acc ${jabatan}.`, 'sukses');
  } catch (e) { pesan(e.message, 'galat', 7); }
  muatUlang();
}

async function aksiTolak(s, tahap, muatUlang) {
  if (!P.bolehAcc(s,tahap)) { pesan('Tidak memiliki hak penolakan untuk tahap/divisi ini.','galat'); return; }
  const pejabat = tahap === 'ktu' ? D.ktu() : D.kepalaDivisi(s.divisi_pemohon);
  const jabatan = tahap === 'ktu' ? 'KTU' : `Kepala Divisi ${s.divisi_pemohon || ''}`;
  const lolos = await mintaPin(`Tolak — ${jabatan}`, pejabat?.pin,
    `Menolak SPPB ${s.no_sppb}. SPPB-nya TIDAK terhapus, hanya ditandai Ditolak.`);
  if (!lolos) return;
  const alasan = await mintaTeks(`Tolak SPPB ${s.no_sppb}`,
    'Alasan wajib diisi supaya admin tahu apa yang harus diperbaiki.',
    { label: 'Alasan penolakan', ya: 'Tolak', wajib: true });
  if (alasan == null) return;
  try {
    D.tolakSppb(s.id, tahap, pejabat?.nama || 'Web', alasan);
    pesan(`SPPB ${s.no_sppb} ditolak. Admin bisa merevisi lalu mengajukan ulang.`, 'sukses', 6);
  } catch (e) { pesan(e.message, 'galat', 7); }
  muatUlang();
}

async function aksiBatalkan(s, muatUlang) {
  const c = D.catatanAcc(s.id);
  const tahap = c?.ktu?.status ? 'ktu' : 'kepala';
  if (!P.bolehAcc(s,tahap,true)) { pesan('Tidak memiliki hak pembatalan untuk tahap/divisi ini.','galat'); return; }
  const pejabat = tahap === 'ktu' ? D.ktu() : D.kepalaDivisi(s.divisi_pemohon);
  const lolos = await mintaPin('Batalkan keputusan', pejabat?.pin,
    `Keputusan terakhir pada SPPB ${s.no_sppb} dikembalikan ke antrean. `
    + 'Tercatat siapa yang membatalkan.');
  if (!lolos) return;
  const ket = await mintaTeks(`Batalkan keputusan SPPB ${s.no_sppb}`,
    'Sebutkan alasannya supaya jejaknya jelas.', { label: 'Alasan', ya: 'Batalkan', wajib: true });
  if (ket == null) return;
  D.batalkanAccSppb(s.id, tahap, pejabat?.nama || D.namaPengisi() || 'Web', ket);
  pesan('Keputusan dibatalkan — SPPB kembali ke antrean.', 'sukses');
  muatUlang();
}

/** Jejak audit satu SPPB (dipakai juga oleh detail SPPB). */
export function daftarJejak(sppbId) {
  const c = D.catatanAcc(sppbId);
  if (!c?.riwayat?.length) return el('p.bantuan', { teks: 'Belum ada keputusan apa pun pada SPPB ini.' });
  return el('div', {}, [...c.riwayat].reverse().map((j) => el('div', {
    style: 'padding:.3rem 0;border-bottom:1px solid var(--garis-tipis);font-size:.86rem',
  }, [
    el('strong', { teks: j.aksi }),
    ` — ${j.oleh}, ${waktu(j.waktu.replace(' ', 'T'))}`,
    j.ket ? el('div.bantuan', { teks: j.ket }) : null,
  ])));
}

export async function halamanPersetujuan(wadah) {
  const tempat = el('div');

  const gambar = () => {
    kosongkan(tempat);
    const semua = D.laporanSppb().map((s) => ({ ...s, acc: D.statusAcc(s.id) }));
    const lama = semua.filter((s) => s.acc === D.STATUS_ACC.LAMA);
    const tungguKepala = semua.filter((s) => s.acc === D.STATUS_ACC.MENUNGGU_KEPALA);
    const tungguKtu = semua.filter((s) => s.acc === D.STATUS_ACC.MENUNGGU_KTU);
    const ditolak = semua.filter((s) => s.acc === D.STATUS_ACC.DITOLAK);
    const full = semua.filter((s) => s.acc === D.STATUS_ACC.FULL);

    const kolomDasar = [
      { l: 'No. SPPB', k: 'no_sppb' },
      { l: 'Tanggal', k: 'tanggal', jenis: 'tanggal' },
      { l: 'Item yang diminta', nilai: ringkasItem },
    ];
    const lembar = (judul, bantuan, isi) => el('div.lembar', { style: 'margin-bottom:1rem' }, [
      el('div.lembar-isi', {}, [
        el('h2', { style: 'margin-bottom:.35rem', teks: judul }),
        bantuan ? el('p.bantuan', { style: 'margin-bottom:.6rem', teks: bantuan }) : null,
        ...[].concat(isi),
      ]),
    ]);
    const tombolAksi = (s, tahap) => !P.bolehAcc(s,tahap) ? 'Tidak memiliki hak' : el('div', { style: 'display:flex;gap:.35rem;flex-wrap:wrap' }, [
      el('button.tombol-kecil.tombol-utama', { type: 'button', teks: 'Acc', onclick: (e) => { e.stopPropagation(); aksiAcc(s, tahap, gambar); } }),
      el('button.tombol-kecil.tombol-bahaya', { type: 'button', teks: 'Tolak', onclick: (e) => { e.stopPropagation(); aksiTolak(s, tahap, gambar); } }),
    ]);

    // ---- antrean kepala divisi, dikelompokkan per divisi
    const perDivisi = new Map();
    for (const s of tungguKepala) {
      const k = kecil(s.divisi_pemohon) || '(tanpa divisi)';
      if (!perDivisi.has(k)) perDivisi.set(k, []);
      perDivisi.get(k).push(s);
    }
    const isiKepala = [];
    for (const [, daftar] of [...perDivisi.entries()].sort()) {
      const divisi = daftar[0].divisi_pemohon || '(tanpa divisi)';
      const kepala = D.kepalaDivisi(divisi);
      isiKepala.push(
        el('h3', { style: 'margin:.7rem 0 .3rem' }, [
          `${divisi} `,
          el('span.bantuan', {
            teks: kepala?.nama ? `— Kepala divisi: ${kepala.nama}${kepala.pin ? ' · PIN terpasang' : ' · tanpa PIN'}${kepala.ttd ? ' · ttd tersimpan' : ' · ttd belum ada'}`
              : '— kepala divisi belum dipasang (Pengaturan → Kepala divisi & tanda tangan)',
          }),
        ]),
        tabel([...kolomDasar, { l: 'Keterangan', k: 'keterangan' },
          bisaEdit() ? { l: 'Keputusan', nilai: (s) => tombolAksi(s, 'kepala') } : null].filter(Boolean),
        daftar, { saatKlik: (s) => bukaDetailSppb(s.id, gambar) }),
      );
    }
    if (!tungguKepala.length) isiKepala.push(el('p.kosong', { teks: 'Tidak ada SPPB menunggu acc kepala divisi.' }));

    taruh(tempat,
      lama.length ? el('p.petunjuk', { style: 'margin-bottom:1rem' }, [
        `${lama.length} SPPB lama (dibuat sebelum fitur persetujuan) tidak perlu di-acc dan tidak masuk `
        + 'antrean ini. Alur acc hanya berlaku untuk pengajuan baru.',
      ]) : null,
      lembar(`Menunggu acc kepala divisi (${tungguKepala.length})`,
        'SPPB baru dan SPPB yang direvisi masuk ke antrean ini. Klik baris untuk melihat detail & jejaknya.',
        isiKepala),
      lembar(`Menunggu acc KTU (${tungguKtu.length})`,
        D.ktu().nama ? `KTU: ${D.ktu().nama}${D.ktu().pin ? ' · PIN terpasang' : ' · tanpa PIN'}${D.ktu().ttd ? ' · ttd tersimpan' : ' · ttd belum ada'}`
          : 'Nama KTU belum dipasang (Pengaturan → Kepala divisi & tanda tangan).',
        tabel([
          ...kolomDasar,
          { l: 'Divisi', k: 'divisi_pemohon' },
          { l: 'Acc kepala', nilai: (s) => { const c = D.catatanAcc(s.id); return c?.kepala ? `${c.kepala.oleh} · ${waktu(c.kepala.waktu.replace(' ', 'T'))}` : '–'; } },
          bisaEdit() ? { l: 'Keputusan', nilai: (s) => tombolAksi(s, 'ktu') } : null,
        ].filter(Boolean), tungguKtu, {
          kosong: 'Tidak ada SPPB menunggu acc KTU.',
          saatKlik: (s) => bukaDetailSppb(s.id, gambar),
        })),
      lembar(`Ditolak (${ditolak.length})`,
        'SPPB yang ditolak tidak terhapus. Admin merevisi isinya → otomatis kembali ke antrean kepala divisi.',
        tabel([
          ...kolomDasar,
          { l: 'Divisi', k: 'divisi_pemohon' },
          { l: 'Ditolak oleh', nilai: (s) => {
            const c = D.catatanAcc(s.id);
            const t = c?.ktu?.status === 'ditolak' ? c.ktu : c?.kepala;
            return t ? `${t.oleh}: ${t.alasan || ''}` : '–';
          } },
        ], ditolak, {
          kosong: 'Tidak ada SPPB ditolak.',
          saatKlik: (s) => bukaDetailSppb(s.id, gambar),
        })),
      lembar(`Sudah full acc (${full.length})`,
        'Order di monitoring Kantor Pusat. Keliru acc? Batalkan di sini — tercatat siapa dan kenapa.',
        tabel([
          ...kolomDasar,
          { l: 'Divisi', k: 'divisi_pemohon' },
          { l: 'Full acc', nilai: (s) => waktu(D.waktuFullAcc(s.id).replace(' ', 'T')) },
          bisaEdit() ? { l: '', nilai: (s) => !P.bolehAcc(s,D.catatanAcc(s.id)?.ktu?.status ? 'ktu' : 'kepala',true) ? '' : el('button.tombol-kecil.tombol-samar', {
            type: 'button', teks: 'Batalkan acc',
            onclick: (e) => { e.stopPropagation(); aksiBatalkan(s, gambar); },
          }) } : null,
        ].filter(Boolean), full, {
          kosong: 'Belum ada SPPB yang full acc.',
          saatKlik: (s) => bukaDetailSppb(s.id, gambar),
        })),
    );
  };

  taruh(wadah, spandukLokal(), tempat);
  gambar();
}
