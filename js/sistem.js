import {mountGISPanel} from './gis-panel.js?v=gis-pages-3';
import * as GP from './pengguna.js?v=8';
// sistem.js — halaman Pengaturan (mode edit, token, profil perusahaan, status
// data) dan Riwayat perubahan (daftar commit + pemulihan versi lama).

import * as D from './data.js?v=8';
import * as gh from './github.js?v=8';
import { el, kosongkan, taruh, pesan, tanya, panel, isian, tabel, angka, waktu, unduhTeks } from './ui.js?v=8';
import { bisaEdit, spandukLokal, gambarUlang } from './main.js?v=8';
import { kecil } from './form-util.js?v=8';

const lembar = (judul, ...isi) => el('div.lembar', { style: 'margin-bottom:1rem' }, [
  el('div.lembar-isi', {}, [el('h2', { style: 'margin-bottom:.6rem', teks: judul }), ...isi]),
]);

export async function halamanSistem(wadah) {
  // ------------------------------------------------------- nama pengisi
  const kNama = el('input', { type: 'text', nilai: D.namaPengisi(), placeholder: 'mis. Admin Gudang' });
  const bagianNama = lembar('Nama pengisi',
    el('p.bantuan', { teks: 'Dicatat di tiap penyimpanan, supaya riwayat jelas siapa mengubah apa.' }),
    el('div', { style: 'display:flex;gap:.6rem;align-items:end;flex-wrap:wrap' }, [
      isian('Nama', kNama),
      el('button.tombol-utama', {
        type: 'button', teks: 'Simpan nama',
        onclick: () => { D.setNamaPengisi(kNama.value); pesan('Nama disimpan di perangkat ini.', 'sukses'); },
      }),
    ]),
  );

  // ----------------------------------------------------------- mode edit
  const kToken = el('input', { type: 'password', placeholder: 'ghp_… / github_pat_…', autocomplete: 'off' });
  const kOwner = el('input', { type: 'text', placeholder: 'akun GitHub' });
  const kRepo = el('input', { type: 'text', placeholder: 'nama repo' });
  const repoKini = gh.lokasiRepo();
  if (repoKini) { kOwner.value = repoKini.owner; kRepo.value = repoKini.repo; }

  const bagianEdit = lembar('Mode edit (token GitHub)',
    el('p.bantuan', { teks: 'Token dengan izin Contents: Read and write untuk repo ini. '
      + 'Hanya tersimpan di perangkat ini, tidak ikut ter-upload.' }),
    D.modeLokal() ? el('p.petunjuk', { teks: 'Sedang ujicoba di komputer — token belum diperlukan. '
      + 'Isi owner/repo & token setelah situs dibuka lewat alamat GitHub Pages, atau isi manual di bawah untuk mencoba kirim langsung.' }) : null,
    el('div.baris-isian', {}, [
      isian('Owner', kOwner, { bantuan: repoKini?.sumber === 'pages' ? 'Terdeteksi otomatis dari alamat situs.' : null }),
      isian('Repo', kRepo),
    ]),
    isian('Token', kToken, { bantuan: gh.adaTokenLokal() ? 'Sudah ada token tersimpan di perangkat ini.' : 'Belum ada token di perangkat ini.' }),
    el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap' }, [
      el('button.tombol-utama', {
        type: 'button', teks: 'Uji & simpan token',
        onclick: async (e) => {
          const tombol = e.target;
          tombol.disabled = true;
          try {
            if (kOwner.value.trim() && kRepo.value.trim()
              && (!repoKini || repoKini.owner !== kOwner.value.trim() || repoKini.repo !== kRepo.value.trim())) {
              gh.setLokasiRepo(kOwner.value.trim(), kRepo.value.trim());
            }
            const token = kToken.value.trim() || gh.ambilToken();
            if (!token) throw new Error('Isi tokennya dulu.');
            const nama = await gh.periksaToken(token);
            gh.simpanToken(token);
            pesan(`Token berlaku dan boleh menulis ke ${nama}. Mode edit aktif.`, 'sukses', 6);
            gambarUlang();
          } catch (err) { pesan(err.message, 'galat', 8); }
          finally { tombol.disabled = false; }
        },
      }),
      gh.adaTokenLokal() ? el('button.tombol-samar', {
        type: 'button', teks: 'Hapus token dari perangkat ini',
        onclick: () => { gh.simpanToken(''); pesan('Token dihapus.', 'sukses'); gambarUlang(); },
      }) : null,
    ]),
  );

  // ----------------------------------------------------- simpan otomatis
  const bagianAuto = (async () => {
    const { autoSimpanAktif, setAutoSimpan } = await import('./main.js?v=8');
    const cek = el('input', { type: 'checkbox' });
    cek.checked = autoSimpanAktif();
    cek.addEventListener('change', () => {
      setAutoSimpan(cek.checked);
      pesan(cek.checked ? 'Simpan otomatis dinyalakan.' : 'Simpan otomatis dimatikan.', 'sukses');
    });
    return lembar('Simpan otomatis',
      el('label', { style: 'display:flex;gap:.5rem;align-items:center' }, [
        cek, 'Kirim sendiri ke GitHub beberapa detik setelah perubahan terakhir',
      ]),
      el('p.bantuan', { teks: 'Saat ujicoba di komputer, penyimpanan tetap manual (tombol Simpan mengunduh berkas).' }),
    );
  })();

  // ------------------------------------------------- profil perusahaan
  const atur = D.pengaturan();
  const kPNama = el('input', { type: 'text', nilai: atur.company_nama || '' });
  const kPAlamat = el('textarea', { rows: 2 }, [atur.company_alamat || '']);
  const kPKontak = el('input', { type: 'text', nilai: atur.company_kontak || '' });
  const kLogo = el('input', { type: 'file', accept: 'image/png,image/jpeg' });
  const pratinjau = el('div', { style: 'margin:.4rem 0' });
  if (atur.company_logo_base64) {
    pratinjau.append(el('img', { src: `data:image/png;base64,${atur.company_logo_base64}`, alt: 'Logo', style: 'height:56px' }));
  }
  let logoBaru = null;
  kLogo.addEventListener('change', () => {
    const f = kLogo.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { pesan('Logo harus di bawah 2 MB.', 'galat'); kLogo.value = ''; return; }
    const r = new FileReader();
    r.onload = () => {
      logoBaru = String(r.result).split(',')[1];
      kosongkan(pratinjau).append(el('img', { src: r.result, alt: 'Logo baru', style: 'height:56px' }));
    };
    r.readAsDataURL(f);
  });
  const bagianProfil = lembar('Profil perusahaan (kop surat)',
    el('p.bantuan', { teks: 'Dipakai sebagai kop pada Surat Permintaan SPPB. Ikut tersimpan di berkas data, '
      + 'jadi otomatis sama di semua perangkat.' }),
    isian('Nama perusahaan', kPNama),
    isian('Alamat', kPAlamat),
    isian('Kontak', kPKontak),
    isian('Logo (PNG/JPG, < 2 MB)', kLogo),
    pratinjau,
    bisaEdit() ? el('button.tombol-utama', {
      type: 'button', teks: 'Simpan profil',
      onclick: () => {
        D.setPengaturan('company_nama', kPNama.value.trim());
        D.setPengaturan('company_alamat', kPAlamat.value.trim());
        D.setPengaturan('company_kontak', kPKontak.value.trim());
        if (logoBaru != null) D.setPengaturan('company_logo_base64', logoBaru);
        pesan('Profil dicatat — jangan lupa Simpan ke GitHub.', 'sukses');
      },
    }) : el('p.bantuan', { teks: 'Masuk mode edit dulu untuk mengubah profil.' }),
  );

  // ------------------------------------- kepala divisi, KTU & tanda tangan
  const tempatPejabat = el('div');
  const gambarPejabat = () => {
    // divisi dari master + yang sudah telanjur dipakai di SPPB + yang sudah
    // punya kepala — supaya tidak ada SPPB yang acc-nya tak bisa dialamatkan
    const terlihat = new Map();
    for (const nama of [
      ...D.baris('master_divisi').map((d) => d.nama),
      ...D.baris('sppb').map((s) => s.divisi_pemohon),
      ...Object.values(D.daftarKepala()).map((k) => k.divisi),
    ]) {
      const k = kecil(nama);
      if (k && !terlihat.has(k)) terlihat.set(k, String(nama).trim());
    }
    const divisiSemua = [...terlihat.values()].sort((a, b) => a.localeCompare(b, 'id'));
    const dataKtu = D.ktu();
    kosongkan(tempatPejabat).append(
      tabel([
        { l: 'Jabatan', nilai: (r) => (r.jenis === 'ktu' ? 'KTU' : `Kepala Divisi ${r.divisi}`) },
        { l: 'Nama', nilai: (r) => r.nama || '–' },
        { l: 'PIN', nilai: (r) => (r.pin ? 'terpasang' : '–') },
        { l: 'Tanda tangan', nilai: (r) => (r.ttd
          ? el('img', { src: `data:image/png;base64,${r.ttd}`, alt: 'ttd', style: 'height:28px' }) : '–') },
      ], [
        ...divisiSemua.map((d) => ({ jenis: 'kepala', divisi: d, ...(D.kepalaDivisi(d) || {}) })),
        { jenis: 'ktu', ...dataKtu },
      ], {
        saatKlik: bisaEdit() ? (r) => formPejabat(r, gambarPejabat) : null,
      }),
    );
  };
  const bagianPejabat = lembar('Kepala divisi, KTU & tanda tangan',
    el('p.bantuan', { teks: 'SPPB di-acc berjenjang: kepala divisi divisi pemohon → KTU → full acc (tampil di '
      + 'Kantor Pusat). Pasang nama tiap pejabat, PIN-nya (supaya acc Pisang tidak bisa ditekan orang lain), '
      + 'dan gambar tanda tangannya — ttd itu ditempel otomatis di surat SPPB yang sudah di-acc. '
      + 'Semuanya tersimpan DI DALAM berkas data terenkripsi.' }),
    tempatPejabat,
    el('p.bantuan', { style: 'margin-top:.5rem', teks: 'PIN adalah pengaman dari kekeliruan, bukan pengaman penuh: '
      + 'siapa pun yang memegang password data + token tetap bisa mengubah isi berkas. Klik baris untuk mengatur.' }),
  );
  gambarPejabat();

  // ------------------------------------------------- tautan situs lain
  const atur2 = D.pengaturan();
  const daftarTautan = Array.isArray(atur2.tautan_lain) ? [...atur2.tautan_lain] : [];
  const tempatTautan = el('div');
  const gambarTautan = () => {
    kosongkan(tempatTautan);
    for (const [i, t] of daftarTautan.entries()) {
      tempatTautan.append(el('div', { style: 'display:flex;gap:.5rem;align-items:center;margin-bottom:.4rem;flex-wrap:wrap' }, [
        el('input', { type: 'text', nilai: t.label || '', placeholder: 'Nama, mis. Laporan Kebun',
          oninput: (e) => { daftarTautan[i].label = e.target.value; }, style: 'width:14rem' }),
        el('input', { type: 'url', nilai: t.url || '', placeholder: 'https://akun.github.io/payrol/#/kebun',
          oninput: (e) => { daftarTautan[i].url = e.target.value; }, style: 'flex:1;min-width:16rem' }),
        el('button.tombol-samar.tombol-kecil', {
          type: 'button', teks: 'Hapus',
          onclick: () => { daftarTautan.splice(i, 1); gambarTautan(); },
        }),
      ]));
    }
    tempatTautan.append(el('button.tombol-samar.tombol-kecil', {
      type: 'button', teks: '+ Tambah tautan',
      onclick: () => { daftarTautan.push({ label: '', url: '' }); gambarTautan(); },
    }));
  };
  gambarTautan();
  const bagianTautan = lembar('Tautan situs lain',
    el('p.bantuan', { teks: 'Tautan ke situs/halaman lain milik perusahaan — mis. Laporan Kebun di situs '
      + 'Data Kebun (alamatnya boleh langsung ke halamannya: …github.io/payrol/#/kebun). Muncul di menu '
      + 'samping, ikut tersimpan di berkas data. Login tiap situs tetap sendiri-sendiri.' }),
    tempatTautan,
    bisaEdit() ? el('button.tombol-utama', {
      type: 'button', teks: 'Simpan tautan', style: 'margin-top:.5rem',
      onclick: () => {
        const bersih = daftarTautan
          .map((t) => ({ label: String(t.label || '').trim(), url: String(t.url || '').trim() }))
          .filter((t) => t.url && /^https?:\/\//i.test(t.url));
        D.setPengaturan('tautan_lain', bersih);
        pesan(`${bersih.length} tautan dicatat — jangan lupa Simpan ke GitHub. Menu samping ikut ter-update.`, 'sukses', 6);
        gambarUlang();
      },
    }) : el('p.bantuan', { teks: 'Masuk mode edit dulu untuk mengubah tautan.' }),
  );

  // ----------------------------------------------------------- status data
  const m = D.state.meta || {};
  const j = m.jumlah || {};
  const bagianStatus = lembar('Status data',
    el('dl', { style: 'display:grid;grid-template-columns:auto 1fr;gap:.2rem .8rem;margin:0' }, [
      el('dt', { teks: 'File data' }), el('dd', { teks: D.state.path }),
      el('dt', { teks: 'Revisi' }), el('dd', { teks: String(D.state.data?.rev ?? '–') }),
      el('dt', { teks: 'Diperbarui' }), el('dd', { teks: waktu(m.diperbarui) }),
      el('dt', { teks: 'Oleh' }), el('dd', { teks: m.dari || '–' }),
      el('dt', { teks: 'Isi' }), el('dd', {
        teks: `${angka(j.material)} material · ${angka(j.masuk)} masuk · ${angka(j.keluar)} keluar · ${angka(j.sppb)} SPPB`,
      }),
    ]),
    el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.7rem' }, [
      el('button.tombol-samar', {
        type: 'button', teks: 'Unduh salinan data (JSON terbuka)',
        onclick: async () => {
          if (!await tanya('Unduh data TANPA enkripsi?',
            'Berkas hasil unduhan bisa dibaca siapa pun yang memegangnya. Simpan di tempat aman.',
            { ya: 'Unduh' })) return;
          unduhTeks('gudang-terbuka.json', JSON.stringify(D.state.data, null, 1), 'application/json');
        },
      }),
      el('button.tombol-samar', {
        type: 'button', teks: 'Unduh berkas terenkripsi (gudang.json)',
        onclick: async () => {
          const { kunciAmplop } = await import('./kunci.js?v=8');
          const amp = await kunciAmplop(D.state.data, D.state.password, D.state.meta || {});
          unduhTeks('gudang.json', JSON.stringify(amp), 'application/json');
        },
      }),
    ]),
    el('p.bantuan', { style: 'margin-top:.6rem', teks:
      'Berkas gudang.json bisa dibawa balik ke komputer gudang dan dimasukkan ke gudang.db lewat tools/impor_gudang.py.' }),
  );

  taruh(wadah, spandukLokal(), bagianNama, bagianEdit, await bagianAuto, bagianPejabat, bagianProfil, bagianTautan, bagianStatus);
  mountGISPanel(wadah,{D,app:'gudang',isAdmin:GP.admin,canEdit:bisaEdit,markChanged:D.tandaiBerubah,save:D.simpanGIS});
}

// =====================================================================
// Form kepala divisi / KTU + pad tanda tangan
// =====================================================================

/**
 * Bersihkan foto tanda tangan: latar kertas (putih/abu, termasuk bayangan
 * foto HP) dibuat TRANSPARAN, coretan tintanya dipertahankan. Ambangnya
 * adaptif dari gambar itu sendiri, jadi foto agak gelap pun tetap bersih.
 * Mengembalikan base64 PNG transparan yang sudah dipangkas rapat.
 */
async function bersihkanFotoTtd(dataUrl) {
  const img = await new Promise((selesai, gagal) => {
    const i = new Image();
    i.onload = () => selesai(i);
    i.onerror = () => gagal(new Error('Gambar tidak terbaca.'));
    i.src = dataUrl;
  });
  const lebar = Math.min(800, img.width);
  const skala = lebar / img.width;
  const k = el('canvas', { width: lebar, height: Math.max(1, Math.round(img.height * skala)) });
  const ktx = k.getContext('2d', { willReadFrequently: true });
  ktx.drawImage(img, 0, 0, k.width, k.height);
  const data = ktx.getImageData(0, 0, k.width, k.height);
  const px = data.data;

  const lum = new Uint8Array(px.length / 4);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) | 0;
    lum[j] = v;
    hist[v]++;
  }
  const total = lum.length;
  const persentil = (p) => {
    let n = 0;
    for (let v = 0; v < 256; v++) { n += hist[v]; if (n >= total * p) return v; }
    return 255;
  };
  // tinta = sebagian sangat kecil piksel paling gelap; kertas = mayoritas terang
  const kertas = persentil(0.85);
  const tinta = persentil(0.005);
  const kontras = kertas - tinta;
  if (kontras < 30) return null;   // nyaris polos — bukan foto ttd yang jelas

  // latar LOKAL: gambar yang diburamkan kuat ≈ warna kertas di titik itu —
  // gradasi cahaya dan bayangan foto HP ikut terhapus, bukan cuma putih rata.
  const bk = el('canvas', { width: k.width, height: k.height });
  const bktx = bk.getContext('2d', { willReadFrequently: true });
  let bgLum = null;
  try {
    bktx.filter = `blur(${Math.max(16, Math.round(k.width / 28))}px)`;
    bktx.drawImage(k, 0, 0);
    const bg = bktx.getImageData(0, 0, k.width, k.height).data;
    bgLum = new Uint8Array(total);
    for (let i = 0, j = 0; i < bg.length; i += 4, j++) {
      bgLum[j] = (0.299 * bg[i] + 0.587 * bg[i + 1] + 0.114 * bg[i + 2]) | 0;
    }
  } catch { /* peramban tanpa ctx.filter → pakai ambang global */ }

  const d0 = Math.max(12, kontras * 0.10);   // beda < ini dari kertas → transparan
  const d1 = Math.max(40, kontras * 0.35);   // beda > ini → tinta penuh
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const latar = bgLum ? Math.max(bgLum[j], lum[j]) : kertas;
    const beda = latar - lum[j];
    let a;
    if (beda <= d0) a = 0;
    else if (beda >= d1) a = 255;
    else a = Math.round(255 * (beda - d0) / (d1 - d0));
    px[i + 3] = Math.min(px[i + 3], a);
    if (a > 0) {   // pekatkan goresan supaya tegas saat dicetak
      px[i] = Math.round(px[i] * 0.7);
      px[i + 1] = Math.round(px[i + 1] * 0.7);
      px[i + 2] = Math.round(px[i + 2] * 0.7);
    }
  }
  ktx.putImageData(data, 0, 0);

  // pangkas tepi transparan + sisakan sedikit tepi
  let x0 = k.width, y0 = k.height, x1 = 0, y1 = 0;
  for (let y = 0; y < k.height; y++) {
    for (let x = 0; x < k.width; x++) {
      if (px[(y * k.width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return null;
  const tepi = 8;
  x0 = Math.max(0, x0 - tepi); y0 = Math.max(0, y0 - tepi);
  x1 = Math.min(k.width - 1, x1 + tepi); y1 = Math.min(k.height - 1, y1 + tepi);
  const hasil = el('canvas', { width: x1 - x0 + 1, height: y1 - y0 + 1 });
  hasil.getContext('2d').drawImage(k, x0, y0, hasil.width, hasil.height, 0, 0, hasil.width, hasil.height);
  return hasil.toDataURL('image/png').split(',')[1];
}
function padTtd(ttdAwal) {
  const kanvas = el('canvas', {
    width: 440, height: 150,
    style: 'border:1px dashed var(--garis);border-radius:8px;background:#fff;touch-action:none;width:100%;max-width:440px',
  });
  const ktx = kanvas.getContext('2d');
  ktx.lineWidth = 2.4;
  ktx.lineCap = 'round';
  ktx.lineJoin = 'round';
  ktx.strokeStyle = '#1b2a60';
  let adaCoretan = false;
  let menggambar = false;
  const titik = (e) => {
    const r = kanvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (kanvas.width / r.width), (e.clientY - r.top) * (kanvas.height / r.height)];
  };
  kanvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    kanvas.setPointerCapture(e.pointerId);
    menggambar = true;
    adaCoretan = true;
    ktx.beginPath();
    ktx.moveTo(...titik(e));
    ktx.lineTo(...titik(e));
    ktx.stroke();
  });
  kanvas.addEventListener('pointermove', (e) => {
    if (!menggambar) return;
    e.preventDefault();
    ktx.lineTo(...titik(e));
    ktx.stroke();
  });
  const berhenti = () => { menggambar = false; };
  kanvas.addEventListener('pointerup', berhenti);
  kanvas.addEventListener('pointercancel', berhenti);

  let ttdUpload = null;   // base64 dari file upload (menang atas coretan)
  const pratinjau = el('div', { style: 'margin:.3rem 0' });
  if (ttdAwal) {
    pratinjau.append(el('span.bantuan', { teks: 'Ttd tersimpan saat ini: ' }),
      el('img', { src: `data:image/png;base64,${ttdAwal}`, alt: 'ttd', style: 'height:40px;vertical-align:middle' }));
  }
  const unggah = el('input', { type: 'file', accept: 'image/png,image/jpeg' });
  unggah.addEventListener('change', () => {
    const f = unggah.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { pesan('Gambar ttd harus di bawah 4 MB.', 'galat'); unggah.value = ''; return; }
    const r = new FileReader();
    r.onload = async () => {
      try {
        // foto ttd di kertas: latarnya otomatis dihapus (jadi transparan)
        const bersih = await bersihkanFotoTtd(String(r.result));
        if (bersih) {
          ttdUpload = bersih;
          kosongkan(pratinjau).append(
            el('span.bantuan', { teks: 'Ttd baru — latar kertas sudah dihapus otomatis: ' }),
            el('img', {
              src: `data:image/png;base64,${bersih}`, alt: 'ttd baru',
              style: 'height:44px;vertical-align:middle;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/14px 14px;border-radius:4px',
            }));
          return;
        }
      } catch { /* jatuh ke gambar apa adanya */ }
      // gagal dibersihkan (mis. gambar nyaris polos) → pakai apa adanya
      if (f.size > 512 * 1024) { pesan('Gambar tidak bisa dibersihkan otomatis dan terlalu besar (maks 500 KB).', 'galat'); unggah.value = ''; return; }
      ttdUpload = String(r.result).split(',')[1];
      kosongkan(pratinjau).append(el('span.bantuan', { teks: 'Ttd baru (dari file, tanpa pembersihan): ' }),
        el('img', { src: r.result, alt: 'ttd baru', style: 'height:40px;vertical-align:middle' }));
    };
    r.readAsDataURL(f);
  });
  const elemen = el('div', {}, [
    pratinjau,
    el('div.isian', {}, [el('label', { teks: 'Gambar ttd langsung di sini (mouse / layar sentuh)' }), kanvas]),
    el('div', { style: 'display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin:.3rem 0 .6rem' }, [
      el('button.tombol-samar.tombol-kecil', {
        type: 'button', teks: 'Bersihkan coretan',
        onclick: () => { ktx.clearRect(0, 0, kanvas.width, kanvas.height); adaCoretan = false; },
      }),
      el('span.bantuan', { teks: 'atau unggah foto/gambar ttd:' }),
      unggah,
    ]),
    el('small.bantuan', { teks: 'Boleh foto ttd di kertas dari kamera HP — latar kertasnya dihapus otomatis '
      + 'jadi transparan. Paling bagus: pulpen tebal di kertas putih, cahaya terang, crop rapat.' }),
  ]);
  return {
    elemen,
    // hasil: upload menang; lalu coretan baru; null = tidak diubah
    ambil: () => {
      if (ttdUpload) return ttdUpload;
      if (adaCoretan) return kanvas.toDataURL('image/png').split(',')[1];
      return null;
    },
  };
}

function formPejabat(r, saatSelesai) {
  const jabatan = r.jenis === 'ktu' ? 'KTU' : `Kepala Divisi ${r.divisi}`;
  const kNama = el('input', { type: 'text', nilai: r.nama || '', placeholder: 'Nama lengkap' });
  const kPin = el('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off',
    nilai: r.pin || '', placeholder: 'Kosongkan = tanpa PIN' });
  const pad = padTtd(r.ttd || '');

  const simpan = () => {
    const ttdBaru = pad.ambil();
    const isi = {
      nama: kNama.value,
      pin: kPin.value.trim(),
      ...(ttdBaru != null ? { ttd: ttdBaru } : {}),
    };
    if (r.jenis === 'ktu') D.setKtu(isi);
    else D.setKepalaDivisi(r.divisi, isi);
    pesan(`${jabatan} tersimpan — jangan lupa Simpan ke GitHub.`, 'sukses');
    p.tutup();
    saatSelesai();
  };
  const aksi = [el('button.tombol-utama', { type: 'button', teks: 'Simpan', onclick: simpan })];
  if (r.ttd) {
    aksi.unshift(el('button.tombol-samar', {
      type: 'button', teks: 'Hapus ttd tersimpan',
      onclick: async () => {
        if (!await tanya('Hapus tanda tangan tersimpan?',
          'Surat yang dicetak sesudah ini kembali memakai kolom ttd basah.', { ya: 'Hapus', bahaya: true })) return;
        if (r.jenis === 'ktu') D.setKtu({ ttd: '' });
        else D.setKepalaDivisi(r.divisi, { ttd: '' });
        p.tutup();
        saatSelesai();
      },
    }));
  }
  const p = panel(jabatan, el('div', {}, [
    isian('Nama', kNama),
    isian('PIN', kPin, { bantuan: 'Diminta setiap kali acc/tolak atas nama pejabat ini.' }),
    pad.elemen,
  ]), aksi);
}

// =====================================================================
export async function halamanRiwayat(wadah) {
  taruh(wadah, spandukLokal());
  if (D.modeLokal()) {
    wadah.append(el('div.lembar', {}, [el('div.lembar-isi', {}, [
      el('p', { teks: 'Riwayat perubahan dibaca dari riwayat commit repo GitHub, jadi baru tersedia '
        + 'setelah situs dibuka lewat alamat GitHub Pages-nya.' }),
    ])]));
    return;
  }
  const tempat = el('div.lembar', {}, [el('div.lembar-isi', {}, [el('p', { teks: 'Mengambil riwayat…' })])]);
  wadah.append(tempat);
  try {
    const daftar = await gh.daftarCommit(D.state.path, { batas: 40 });
    kosongkan(tempat.firstChild).append(
      el('p.bantuan', { style: 'margin-bottom:.6rem', teks:
        'Setiap penyimpanan adalah satu commit. Klik satu baris untuk memuat versi itu sebagai perubahan '
        + 'lokal — periksa dulu isinya, lalu tekan Simpan kalau memang mau dikembalikan.' }),
      tabel([
        { l: 'Waktu', nilai: (r) => waktu(r.waktu) },
        { l: 'Keterangan', k: 'pesan' },
        { l: 'Oleh', k: 'oleh' },
        { l: 'Commit', k: 'sha' },
      ], daftar, {
        kosong: 'Belum ada riwayat.',
        saatKlik: bisaEdit() ? async (r) => {
          if (!await tanya('Pulihkan versi ini?',
            `Data akan dimuat dari commit ${r.sha} (${waktu(r.waktu)}) sebagai perubahan lokal yang belum disimpan.`,
            { ya: 'Pulihkan' })) return;
          try {
            await D.pulihkanVersiGitHub(r.fullSha);
            pesan('Versi lama termuat. Periksa isinya, lalu Simpan untuk mengembalikannya.', 'sukses', 7);
            location.hash = '#/dashboard';
          } catch (e) { pesan(e.message, 'galat', 8); }
        } : null,
      }),
    );
  } catch (e) {
    kosongkan(tempat.firstChild).append(el('div.kesalahan', {}, [e.message]));
  }
}
