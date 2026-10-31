// master.js — CRUD master data: Material, Divisi, Kategori, Satuan, Blok.
// Sama seperti aplikasi desktop: menghapus master tidak menghapus transaksi
// lama yang memakai nama itu — namanya saja tidak muncul lagi di pilihan baru.

import * as D from './data.js?v=7';
import { el, kosongkan, taruh, pesan, tanya, panel, isian, tabel, angka, kesalahan } from './ui.js?v=7';
import { bisaEdit, spandukLokal } from './main.js?v=7';
import { miripMaster } from './form-util.js?v=7';

const rapikan = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const kecil = (s) => rapikan(s).toLowerCase();

export const MASTER = {
  master_material: {
    judul: 'Material',
    sub: 'Nama material, satuan default, dan kategorinya',
    f: [
      { k: 'nama', l: 'Nama material', t: 'text', wajib: true, unik: true },
      { k: 'satuan_default', l: 'Satuan default', t: 'datalist', sumber: 'master_satuan' },
      { k: 'kategori', l: 'Kategori', t: 'datalist', sumber: 'master_kategori' },
    ],
    kolom: [
      { l: 'Nama', k: 'nama' },
      { l: 'Satuan default', k: 'satuan_default' },
      { l: 'Kategori', k: 'kategori' },
    ],
    dipakai: (r) => hitungPakai((x) => kecil(x.material) === kecil(r.nama)),
  },
  master_divisi: {
    judul: 'Divisi',
    sub: 'Divisi / afdeling tujuan dan pemohon',
    f: [{ k: 'nama', l: 'Nama divisi', t: 'text', wajib: true, unik: true }],
    kolom: [{ l: 'Nama', k: 'nama' }],
    dipakai: (r) => hitungPakai((x) => kecil(x.divisi) === kecil(r.nama))
      + D.baris('sppb').filter((s) => kecil(s.divisi_pemohon) === kecil(r.nama)).length,
  },
  master_kategori: {
    judul: 'Kategori',
    sub: 'Kategori material (pupuk, pestisida, BBM, …)',
    f: [{ k: 'nama', l: 'Nama kategori', t: 'text', wajib: true, unik: true }],
    kolom: [{ l: 'Nama', k: 'nama' }],
    dipakai: (r) => D.baris('master_material').filter((m) => kecil(m.kategori) === kecil(r.nama)).length,
  },
  master_satuan: {
    judul: 'Satuan',
    sub: 'Satuan yang dipakai di form (Kg, Liter, Sak, …)',
    f: [{ k: 'nama', l: 'Nama satuan', t: 'text', wajib: true, unik: true }],
    kolom: [{ l: 'Nama', k: 'nama' }],
    dipakai: (r) => hitungPakai((x) => kecil(x.satuan) === kecil(r.nama)),
  },
  master_blok: {
    judul: 'Blok',
    sub: 'Blok / lokasi tujuan material keluar',
    f: [
      { k: 'nama', l: 'Nama blok', t: 'text', wajib: true, unik: true },
      { k: 'divisi', l: 'Divisi', t: 'datalist', sumber: 'master_divisi' },
      { k: 'luas_ha', l: 'Luas (ha)', t: 'num' },
    ],
    kolom: [
      { l: 'Nama', k: 'nama' },
      { l: 'Divisi', k: 'divisi' },
      { l: 'Luas (ha)', k: 'luas_ha', jenis: 'angka', pecahan: 2 },
    ],
    dipakai: (r) => D.baris('material_keluar').filter((x) => kecil(x.blok) === kecil(r.nama)).length,
  },
};

const hitungPakai = (cocok) => D.baris('material_masuk').filter(cocok).length
  + D.baris('material_keluar').filter(cocok).length
  + D.baris('sppb_items').filter(cocok).length;

function kendaliIsian(f, nilai) {
  if (f.t === 'num') {
    return el('input', { type: 'number', step: 'any', nilai: nilai ?? '' });
  }
  if (f.t === 'datalist') {
    const idList = 'dl' + Math.random().toString(36).slice(2, 9);
    const opsi = D.baris(f.sumber).map((r) => r.nama).sort((a, b) => a.localeCompare(b, 'id'));
    const dl = el('datalist', { id: idList }, opsi.map((n) => el('option', { value: n })));
    const inp = el('input', { type: 'text', list: idList, autocomplete: 'off', nilai: nilai ?? '' });
    inp._datalist = dl;
    return inp;
  }
  return el('input', { type: 'text', nilai: nilai ?? '' });
}

function formMaster(t, def, barisLama, saatSelesai) {
  const kendali = {};
  const tempatGalat = el('div');
  const isiForm = el('div', {}, def.f.map((f) => {
    kendali[f.k] = kendaliIsian(f, barisLama?.[f.k]);
    return isian(f.l + (f.wajib ? ' *' : ''), kendali[f.k]);
  }));

  const simpan = async () => {
    const nilai = {};
    const galat = [];
    for (const f of def.f) {
      let v = kendali[f.k].value;
      v = f.t === 'num' ? (v === '' ? null : Number(v)) : rapikan(v);
      if (f.wajib && (v === '' || v == null)) galat.push(`${f.l} wajib diisi.`);
      if (f.unik && v) {
        const kembar = D.baris(t).find((r) => kecil(r[f.k]) === kecil(v) && r !== barisLama);
        if (kembar) galat.push(`${f.l} "${v}" sudah ada.`);
      }
      nilai[f.k] = v;
    }
    kosongkan(tempatGalat);
    if (galat.length) { tempatGalat.append(kesalahan(galat)); return; }
    // anti-dobel: nama baru yang mirip (beda spasi/typo 1-2 huruf) dikonfirmasi dulu
    if (nilai.nama && nilai.nama !== rapikan(barisLama?.nama)) {
      const mirip = miripMaster(t, nilai.nama, barisLama?.id);
      if (mirip.length && !await tanya(`${def.judul} mirip yang sudah ada`,
        `"${nilai.nama}" mirip dengan "${mirip[0]}"${mirip.length > 1 ? ` (juga: ${mirip.slice(1, 3).join(', ')})` : ''} `
        + 'yang sudah terdaftar. Yakin ini memang nama yang BERBEDA, bukan typo?',
        { ya: 'Ya, memang beda', tidak: 'Batal, periksa lagi' })) return;
    }
    if (barisLama) D.ubah(t, barisLama.id, nilai);
    else D.tambah(t, nilai);
    pesan(barisLama ? 'Perubahan dicatat.' : `${def.judul} baru ditambahkan.`, 'sukses');
    saatSelesai();
  };

  const aksi = [el('button.tombol-utama', { type: 'button', teks: 'Simpan', onclick: simpan })];
  if (barisLama) {
    aksi.unshift(el('button.tombol-bahaya', {
      type: 'button', teks: 'Hapus',
      onclick: async () => {
        const n = def.dipakai ? def.dipakai(barisLama) : 0;
        const peringatan = n
          ? `Nama ini masih dipakai di ${angka(n)} baris data lama. Baris lama TIDAK ikut terhapus, `
            + 'hanya namanya tidak muncul lagi di pilihan input baru.'
          : 'Baris ini belum dipakai di data mana pun.';
        if (!await tanya(`Hapus ${def.judul.toLowerCase()} "${barisLama.nama}"?`, peringatan,
          { ya: 'Hapus', bahaya: true })) return;
        D.hapus(t, barisLama.id);
        pesan('Terhapus.', 'sukses');
        saatSelesai();
      },
    }));
  }
  const p = panel(barisLama ? `Ubah ${def.judul.toLowerCase()}` : `Tambah ${def.judul.toLowerCase()}`,
    el('div', {}, [tempatGalat, isiForm]), aksi);
  const asliSelesai = saatSelesai;
  saatSelesai = () => { p.tutup(); asliSelesai(); };
}

export async function halamanMaster(wadah, t) {
  const def = MASTER[t];
  let kataCari = '';

  const gambar = () => {
    kosongkan(wadah);
    const semua = [...D.baris(t)].sort((a, b) => String(a.nama).localeCompare(String(b.nama), 'id'));

    const cari = el('input', {
      type: 'search', placeholder: `Cari ${def.judul.toLowerCase()}…`, nilai: kataCari,
      oninput: (e) => { kataCari = e.target.value; gambarTabel(); },
      style: 'max-width:18rem',
    });

    const tempatTabel = el('div');
    const tempatJumlah = el('span.bantuan');
    const gambarTabel = () => {
      const data = kataCari
        ? semua.filter((r) => def.f.some((f) => kecil(r[f.k]).includes(kecil(kataCari))))
        : semua;
      tempatJumlah.textContent = `${angka(data.length)} dari ${angka(semua.length)} baris`;
      kosongkan(tempatTabel).append(tabel(
        [...def.kolom, { l: 'Dipakai di', nilai: (r) => angka(def.dipakai ? def.dipakai(r) : 0) + ' baris', rata: 'angka' }],
        data,
        {
          kosong: `Belum ada ${def.judul.toLowerCase()}.`,
          saatKlik: bisaEdit() ? (r) => formMaster(t, def, r, gambar) : null,
        },
      ));
    };

    taruh(wadah,
      spandukLokal(),
      el('div.lembar', {}, [
        el('div.lembar-isi', {}, [
          el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:.8rem' }, [
            cari,
            tempatJumlah,
            bisaEdit() ? el('button.tombol-utama', {
              type: 'button', teks: `+ Tambah ${def.judul.toLowerCase()}`,
              style: 'margin-left:auto',
              onclick: () => formMaster(t, def, null, gambar),
            }) : null,
          ]),
          tempatTabel,
          el('p.bantuan', { style: 'margin-top:.7rem', teks:
            'Nama baru yang diketik di form Material Masuk / Keluar / SPPB otomatis masuk '
            + 'ke master ini — halaman ini untuk melihat, merapikan, atau menghapus daftarnya.' }),
        ]),
      ]),
    );
    gambarTabel();
  };
  gambar();
}
