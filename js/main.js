import {halamanPermintaan,halamanOpname} from './workflow-ui.js?v=8';
import {halamanBbm} from './bbm.js?v=8';
// main.js — kerangka situs Data Gudang: layar kunci, menu, kepala halaman,
// simpan otomatis. Isi tiap halaman ada di modulnya masing-masing.

import * as D from './data.js?v=8';
import * as gh from './github.js?v=8';
import { el, kosongkan, taruh, pesan, tanya, isian, waktu, angka } from './ui.js?v=8';

import { halamanDashboard } from './dashboard.js?v=8';
import { halamanMasuk } from './masuk.js?v=8';
import { halamanKeluar } from './keluar.js?v=8';
import { halamanSppb } from './sppb.js?v=8';
import { halamanLaporan } from './laporan.js?v=8';
import { halamanMaster, MASTER } from './master.js?v=8';
import { halamanSistem, halamanRiwayat } from './sistem.js?v=8';
import { halamanPersetujuan } from './persetujuan.js?v=8';
import { halamanPusat } from './pusat.js?v=8';
import {halamanPengadaan} from './pengadaan-ui.js?v=8';
import * as P from './pengguna.js?v=8';
import { halamanPengguna } from './pengguna.js?v=8';

const akar = document.getElementById('akar');

const HALAMAN = {
  permintaan:{l:'Permintaan Mandor',sub:'Banyak blok · acc Kepala Divisi dan KTU · penyerahan Gudang',buat:halamanPermintaan},
  opname:{l:'Stok Opname',sub:'Hitung fisik Gudang · selisih · persetujuan KTU',buat:halamanOpname},
  dashboard: { l: 'Dashboard', sub: 'Stok saat ini dan SPPB yang belum lengkap', buat: halamanDashboard },
  pusat: { l: 'Kantor Pusat / Order', sub: 'Order bertahap, satuan supplier dan konversi', buat:w=>halamanPengadaan(w,false) },
  ditunggu:{l:'Barang ditunggu',sub:'Order terbuka dan penerimaan bertahap ke Gudang',buat:w=>halamanPengadaan(w,true)},
  laporan: { l: 'Laporan WA', sub: 'Teks laporan siap tempel ke WhatsApp', buat: halamanLaporan },
  bbm:{l:'BBM',sub:'Stok Gudang · Solar, Pertalite dan Pertamax',buat:halamanBbm},
  'bbm-masuk':{l:'BBM Masuk',sub:'Penerimaan BBM ke Gudang',buat:w=>halamanMasuk(w,true)},
  'bbm-keluar':{l:'BBM Keluar',sub:'Pemakaian BBM untuk divisi dan unit',buat:w=>halamanKeluar(w,true)},
  masuk: { l: 'Material Masuk', sub: 'Barang yang diterima gudang', buat: halamanMasuk },
  keluar: { l: 'Material Keluar', sub: 'Barang yang diambil dari gudang', buat: halamanKeluar },
  sppb: { l: 'SPPB', sub: 'Surat Permintaan Pembelian Barang & realisasinya', buat: halamanSppb },
  persetujuan: { l: 'Persetujuan SPPB', sub: 'Admin membuat → kepala divisi yang minta meng-acc → KTU memeriksa', buat: halamanPersetujuan },
  riwayat: { l: 'Riwayat perubahan', sub: 'Setiap penyimpanan tercatat di sini', buat: halamanRiwayat },
  sistem: { l: 'Pengaturan', sub: 'Mode edit, token, pejabat & ttd, profil perusahaan', buat: halamanSistem },
  pengguna: { l: 'Pengguna', sub: 'Admin/KTU, kepala divisi, dan hak akses per divisi', buat: halamanPengguna },
  sandi: {l:'Ganti password/PIN',sub:'Ubah password/PIN akun Anda sendiri',buat:P.halamanSandi},
};

const KELOMPOK = [
  { judul: 'Pantauan', item: ['dashboard', 'pusat', 'ditunggu', 'laporan'] },
  { judul: 'Input data', item: ['permintaan','masuk', 'keluar', 'sppb','opname'] },
  { judul: 'BBM', item: ['bbm','bbm-masuk','bbm-keluar'] },
  { judul: 'Kepala divisi & KTU', item: ['persetujuan'] },
];
const SISTEM = ['sandi', 'pengguna', 'riwayat', 'sistem'];

// Boleh mengubah data kalau ada token, ATAU kalau dibuka tanpa repo
// (ujicoba di komputer — hasil simpanannya diunduh sebagai berkas).
export const bisaEdit = () => !!P.siapa() && (!!gh.ambilToken() || D.modeLokal());
P.hubungkanAplikasi({bisaEdit,simpan:(...args) => simpanSekarang(...args)});

// ---------------------------------------------------------------------
// Simpan otomatis: beberapa detik setelah perubahan terakhir, data dikirim
// sendiri ke GitHub. Saat ujicoba lokal tetap manual (menyimpan = mengunduh).
// ---------------------------------------------------------------------
const KUNCI_AUTOSIMPAN = 'gudang.autosimpan';
export const autoSimpanAktif = () => localStorage.getItem(KUNCI_AUTOSIMPAN) !== '0';
export const setAutoSimpan = (aktif) => localStorage.setItem(KUNCI_AUTOSIMPAN, aktif ? '1' : '0');
let timerAutoSimpan = null;
let sedangAutoSimpan = false;
D.saatBerubah(() => {
  perbaruiKepalaStatus();
  if (!autoSimpanAktif() || D.modeLokal() || !bisaEdit()) return;
  clearTimeout(timerAutoSimpan);
  timerAutoSimpan = setTimeout(async () => {
    if (sedangAutoSimpan || D.state.gisSaving || !D.state.belumDisimpan) return;
    sedangAutoSimpan = true;
    try { await simpanSekarang('Web: simpan otomatis', { senyap: true }); }
    finally { sedangAutoSimpan = false; }
  }, 8000);
});

export async function simpanSekarang(judul = 'Web: simpan perubahan', { senyap = false } = {}) {
  try {
    const rev = await D.simpan(judul);
    if (D.modeLokal()) {
      pesan('Berkas gudang.json diunduh. Timpakan ke folder data\\ lalu muat ulang, '
        + 'atau impor ke gudang.db dengan tools/impor_gudang.py.', 'sukses', 7);
    } else if (!senyap) {
      pesan(`Tersimpan ke GitHub (rev ${rev}).`, 'sukses');
    } else if (D.state.gabungTerakhir) {
      pesan('Perubahan orang lain masuk duluan — sudah digabung dan tersimpan.', 'sukses', 6);
    }
    gambarKepalaSaja();
  } catch (e) {
    pesan(e.message, 'galat', 8);
    gambarKepalaSaja();
  }
}

export async function muatUlangData() {
  if (D.state.belumDisimpan
    && !await tanya('Muat ulang data?', 'Perubahan yang belum disimpan akan hilang.', { ya: 'Muat ulang', bahaya: true })) return;
  try {
    await D.muat(D.state.password);
    pesan('Data termuat ulang.', 'sukses');
    gambar();
  } catch (e) { pesan(e.message, 'galat', 8); }
}

// =====================================================================
// Layar kunci
// =====================================================================
async function layarKunci() {
  const kotak = el('div.kunci-kotak');
  kosongkan(akar).append(el('div.kunci', {}, [kotak]));

  const sandi = el('input', { type: 'password', autocomplete: 'current-password', required: true });
  const tempatGalat = el('div');
  const tempatMeta = el('div.kunci-meta', {}, [el('p', { teks: 'Mengambil keterangan data…' })]);

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      kosongkan(tempatGalat);
      const tombol = form.querySelector('button[type=submit]');
      tombol.disabled = true;
      tombol.textContent = 'Membuka…';
      try {
        await D.muat(sandi.value);
        sessionStorage.setItem('gudang.sandi', sandi.value);
        await bangunKerangka();
      } catch (err) {
        tempatGalat.append(el('div.kesalahan', { role: 'alert' }, [err.message]));
        tombol.disabled = false;
        tombol.textContent = 'Buka data';
        sandi.select();
      }
    },
  }, [
    isian('Password data', sandi, { bantuan: 'Password yang dipakai saat ekspor dari komputer gudang.' }),
    el('button.tombol-utama', { type: 'submit', teks: 'Buka data' }),
  ]);

  const logo = el('div.kunci-logo');
  logo.innerHTML = `
    <svg width="52" height="52" viewBox="0 0 52 52" role="img" aria-label="Lambang gudang">
      <circle cx="26" cy="26" r="25" fill="#eaf2ec" stroke="#bcd6c3"/>
      <path d="M13 20 26 12l13 8v14l-13 8-13-8z" fill="none" stroke="#2f6b3f" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M13 20l13 8 13-8M26 28v14" fill="none" stroke="#4b9b61" stroke-width="2.4" stroke-linejoin="round"/>
    </svg>`;
  taruh(kotak,
    logo,
    el('h1', { teks: 'Data Gudang' }),
    el('p.kunci-merek', { teks: 'PT VIGU FARM INDONESIA' }),
    tempatGalat,
    form,
    tempatMeta,
  );
  sandi.focus();

  async function muatKeterangan() {
    try {
      const meta = await D.intipMeta();
      kosongkan(tempatMeta);
      if (!meta) {
        tempatMeta.append(el('p', {
          teks: 'Belum ada file data. Jalankan tools\\ekspor_gudang.py di komputer gudang, '
            + 'hasilnya masuk ke folder data\\.',
        }));
        return;
      }
      const j = meta.jumlah || {};
      tempatMeta.append(el('dl', {}, [
        el('dt', { teks: 'Bagian' }), el('dd', { teks: meta.label || 'Gudang Material' }),
        el('dt', { teks: 'Diperbarui' }), el('dd', { teks: waktu(meta.diperbarui) }),
        el('dt', { teks: 'Oleh' }), el('dd', { teks: meta.dari || '–' }),
        el('dt', { teks: 'Isi' }), el('dd', {
          teks: `${angka(j.material)} material · ${angka(j.masuk)} masuk · ${angka(j.keluar)} keluar · ${angka(j.sppb)} SPPB`,
        }),
      ]));
    } catch (e) {
      kosongkan(tempatMeta).append(el('p', { teks: e.message }));
    }
  }
  if (!gh.lokasiRepo()) {
    kosongkan(tempatMeta).append(el('p', {
      teks: 'Ujicoba di komputer: data dibaca dari folder data/ di sebelah halaman ini.',
    }));
    muatKeterangan();
  } else {
    muatKeterangan();
  }
}

// =====================================================================
// Kerangka
// =====================================================================
let elIsi, elKepala, elSisi;

function rute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [nama, arg] = h.split('/');
  return { nama, arg };
}

async function bangunKerangka() {
  await P.masuk(akar);
  const draf = await D.drafTersimpan();
  if (draf) {
    const pulih = await tanya('Ada input yang belum tersimpan', el('div', {}, [
      el('p', { teks: `Perubahan terakhir ${waktu(draf.waktu)} belum sempat terkirim `
        + '(mis. listrik padam atau tab tertutup). Pulihkan dan lanjutkan dari situ?' }),
      el('p.bantuan', { teks: 'Kalau dibuang, data kembali persis seperti simpanan terakhir.' }),
    ]), { ya: 'Pulihkan', tidak: 'Buang' });
    if (pulih) D.pakaiDraf(draf);
    else D.hapusDraf();
  }
  if (!P.siapa()) await P.masuk(akar);
  elSisi = el('nav.sisi', { 'aria-label': 'Menu utama' });
  elKepala = el('header.kepala');
  elIsi = el('div.isi', { id: 'isi' });
  kosongkan(akar).append(el('div.kerangka', {}, [
    elSisi,
    el('main.utama', {}, [elKepala, elIsi]),
  ]));
  window.addEventListener('hashchange', gambar);
  window.addEventListener('gis-updated',()=>{if(!document.querySelector('[role=dialog]'))gambar();});
  window.addEventListener('beforeunload', (e) => {
    if (D.state.belumDisimpan) { e.preventDefault(); e.returnValue = ''; }
  });
  bangunMenu();
  gambar();
}

function bangunMenu() {
  kosongkan(elSisi);
  const tautan = (kunci, label) => {
    const a = el('a', { href: `#/${kunci}`, teks: label });
    if (kunci === 'persetujuan') {
      const n = D.jumlahMenungguAcc();
      if (n) a.append(el('span.lencana', { teks: String(n) }));
    }
    return a;
  };

  const kelompok = [];
  for (const g of KELOMPOK) {
    const visible=g.item.filter(k=>P.bolehHalaman(k));if(!visible.length)continue;
    kelompok.push(el('div.sisi-kelompok', { teks: g.judul }));
    for (const k of visible) kelompok.push(tautan(k, HALAMAN[k].l));
  }
  if(P.bolehHalaman('master'))kelompok.push(el('div.sisi-kelompok', { teks: 'Master data' }));
  for (const [t, def] of Object.entries(MASTER)) {
    if (P.bolehHalaman('master')) kelompok.push(el('a', { href: `#/master/${t}`, teks: def.judul }));
  }
  kelompok.push(el('div.sisi-kelompok', { teks: 'Sistem' }));
  for (const k of SISTEM) if (P.bolehHalaman(k)) kelompok.push(tautan(k, HALAMAN[k].l));

  taruh(elSisi,
    el('div.sisi-merek', {}, [
      el('strong', { teks: D.state.meta?.label || 'Gudang Material' }),
      el('span', { teks: P.mandor()?'Permintaan material':'Material masuk · keluar · SPPB' }),
    ]),
    el('div.sisi-menu', {}, kelompok),
    el('div.sisi-kaki', {}, [
      el('div', {teks:`${P.siapa()?.nama || ''}${P.admin() ? ' · Admin / KTU' : ''}`}),
      el('div', {
        teks: D.modeLokal() ? 'Ujicoba di komputer'
          : bisaEdit() ? `Mode edit — ${D.namaPengisi() || 'tanpa nama'}` : 'Mode lihat',
      }),
      el('button.tombol-samar.tombol-kecil', {
        type: 'button', teks: 'Keluar',
        onclick: async () => {
          if (D.state.belumDisimpan && !await tanya('Keluar tanpa menyimpan?',
            'Ada perubahan yang belum disimpan. Perubahan itu akan hilang.',
            { ya: 'Keluar', bahaya: true })) return;
          sessionStorage.removeItem('gudang.sandi');
          P.keluar();
          location.reload();
        },
      }),
    ]),
  );
}

function tandaiMenuAktif() {
  const { nama, arg } = rute();
  const target = arg ? `#/${nama}/${arg}` : `#/${nama || 'dashboard'}`;
  for (const a of elSisi.querySelectorAll('a')) {
    if (a.getAttribute('href') === target) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

let statusSinkron = null;
function perbaruiKepalaStatus() {
  if (!statusSinkron) return;
  kosongkan(statusSinkron).append(
    el('span.titik' + (D.state.belumDisimpan ? '.perlu-simpan' : '')),
    D.state.belumDisimpan ? 'Belum disimpan' : `Tersimpan · rev ${D.state.data?.rev ?? '–'}`,
  );
  const tombol = elKepala?.querySelector('[data-simpan]');
  if (tombol) tombol.style.display = D.state.belumDisimpan ? '' : 'none';
}

function gambarKepala(judul, sub) {
  kosongkan(elKepala);
  const tombolMenu = el('button.hamburger.tombol-samar', {
    type: 'button', 'aria-label': 'Buka menu', teks: '☰',
    onclick: () => elSisi.classList.toggle('buka'),
  });
  const aksi = el('div.kepala-aksi');
  aksi.append(el('button.tombol-utama', {
    type: 'button',
    teks: D.modeLokal() ? 'Simpan (unduh berkas)' : 'Simpan ke GitHub',
    'data-simpan': '',
    style: D.state.belumDisimpan ? '' : 'display:none',
    onclick: () => simpanSekarang(),
  }));
  aksi.append(el('button.tombol-samar.tombol-kecil', {
    type: 'button', teks: 'Muat ulang', onclick: () => muatUlangData(),
  }));
  statusSinkron = el('span.status-sinkron');
  aksi.append(statusSinkron);
  aksi.append(el('span.lencana-mode' + (bisaEdit() ? '.edit' : ''), {
    teks: D.modeLokal() ? 'Ujicoba di komputer' : bisaEdit() ? 'Bisa mengubah data' : 'Hanya melihat',
  }));
  elKepala.append(
    tombolMenu,
    el('div.kepala-judul', {}, [el('h1', { teks: judul }), sub ? el('p', { teks: sub }) : null]),
    aksi,
  );
  perbaruiKepalaStatus();
}

function gambarKepalaSaja() { perbaruiKepalaStatus(); }

export function spandukLokal() {
  if (!D.modeLokal()) return null;
  return el('div.petunjuk', { style: 'margin-bottom:1rem' }, [
    el('p', {
      teks: 'Ujicoba di komputer. Halaman ini belum terhubung ke repo GitHub: data dibaca '
        + 'dari folder data/ di sebelahnya, dan tombol Simpan akan MENGUNDUH berkas hasilnya.',
    }),
  ]);
}

async function gambar() {
  const { nama, arg } = rute();
  if (!P.siapa()) { location.reload(); return; }
  bangunMenu();   // lencana jumlah menunggu acc ikut tersegarkan
  elSisi.classList.remove('buka');
  tandaiMenuAktif();

  if (!P.bolehHalaman(nama || 'dashboard')) {
    gambarKepala('Akses dibatasi', 'Halaman ini tidak termasuk hak pengguna Anda.');
    kosongkan(elIsi).append(el('p.petunjuk',{teks:'Hubungi OJORA/KTU untuk mengubah hak akses.'}));
    return;
  }

  if (nama === 'master' && MASTER[arg]) {
    gambarKepala(MASTER[arg].judul, MASTER[arg].sub || 'Master data');
    kosongkan(elIsi);
    await halamanMaster(elIsi, arg);
    tandaiMenuAktif();
    return;
  }
  const h = HALAMAN[nama] || HALAMAN.dashboard;
  if (!HALAMAN[nama]) history.replaceState(null, '', '#/dashboard');
  gambarKepala(h.l,P.mandor()&&h===HALAMAN.dashboard?'Permintaan Anda dan informasi stok material':h.sub);
  kosongkan(elIsi);
  try {
    await h.buat(elIsi);
  } catch (e) {
    elIsi.append(el('div.kesalahan', { role: 'alert' }, [`Halaman gagal dibuka: ${e.message}`]));
    console.error(e);
  }
  tandaiMenuAktif();
}

export const gambarUlang = () => gambar();

// =====================================================================
// Mulai
// =====================================================================
(async () => {
  const sandi = sessionStorage.getItem('gudang.sandi');
  if (sandi) {
    try {
      await D.muat(sandi);
      await bangunKerangka();
      return;
    } catch { sessionStorage.removeItem('gudang.sandi'); }
  }
  await layarKunci();
})();
