// keluar.js — Material Keluar: form input + tabel. "Diambil oleh" wajib diisi,
// sama seperti aplikasi desktop.

import * as D from './data.js?v=5';
import * as P from './pengguna.js?v=5';
import { el, kosongkan, taruh, pesan, tanya, panel, isian, tabel, angka, tanggal, kesalahan } from './ui.js?v=5';
import { bisaEdit, spandukLokal } from './main.js?v=5';
import {
  rapikan, inputMaster, inputTanggal, inputAngka, namaFinal, kanonikRiwayat,
  filterPeriode, saring, urutTanggalTurun, BATAS_TAMPIL, catatanBatas,
} from './form-util.js?v=5';

function formKeluar(barisLama, saatSelesai) {
  if (barisLama && !P.bolehUbah('material_keluar',barisLama)) return;
  const tempatGalat = el('div');
  const kTanggal = inputTanggal(barisLama?.tanggal);
  const kMaterial = inputMaster('master_material', barisLama?.material || '', {
    tempat: 'Ketik untuk mencari / nama baru…',
    saatUbah: () => {
      const bawaan = D.satuanBawaan(kMaterial.value);
      if (bawaan) kSatuan.value = bawaan;
      tunjukkanStok();
    },
  });
  const kSatuan = inputMaster('master_satuan', barisLama?.satuan || '');
  const kQty = inputAngka(barisLama?.qty);
  const kBlok = inputMaster('master_blok', barisLama?.blok || '');
  const kDivisi = inputMaster('master_divisi', barisLama?.divisi || '');
  // saran nama pengambil dari riwayat, supaya ejaannya konsisten
  const idOleh = 'dlo' + Math.random().toString(36).slice(2, 9);
  const riwayatOleh = [...new Set(D.baris('material_keluar').map((r) => rapikan(r.diambil_oleh)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'id'));
  const dlOleh = el('datalist', { id: idOleh }, riwayatOleh.map((n) => el('option', { value: n })));
  const kOleh = el('input', { type: 'text', list: idOleh, autocomplete: 'off',
    nilai: barisLama?.diambil_oleh || '', placeholder: 'Nama pengambil' });
  kOleh._datalist = dlOleh;
  const kKet = el('textarea', { rows: 2 }, [barisLama?.keterangan || '']);
  const kPerlu=el('input',{type:'text',nilai:barisLama?.keperluan||'',required:true,placeholder:'Contoh: BBM pompa irigasi blok A'});
  const kUnit=el('input',{type:'text',nilai:barisLama?.unit_pemakai||'',placeholder:'Nomor kendaraan / kode mesin / alat'});
  const kMeter=el('input',{type:'text',nilai:barisLama?.meter_unit||'',placeholder:'Opsional: angka odometer / HM saat pengisian'});
  const kAlasan=el('input',{type:'text',nilai:barisLama?.alasan_stok||'',placeholder:'Hanya admin, bila perlu koreksi stok'});
  const infoStok = el('small.bantuan');

  function tunjukkanStok() {
    const nama = rapikan(kMaterial.value);
    if (!nama) { infoStok.textContent = ''; return; }
    const baris = D.laporanStok().find((s) => s.material.toLowerCase() === nama.toLowerCase());
    infoStok.textContent = baris
      ? `Stok gudang saat ini: ${angka(baris.stok, 2)} ${baris.satuan || ''}`
      : 'Material ini belum pernah tercatat masuk.';
  }
  tunjukkanStok();

  const simpan = async () => {
    const nilai = {
      tanggal: kTanggal.value,
      // anti-dobel: ejaan mengikuti master; nama baru yang mirip ditanyakan dulu
      material: await namaFinal('master_material', kMaterial.value, 'Material'),
      satuan: D.normalkanSatuan(kSatuan.value),
      qty: Number(kQty.value),
      blok: await namaFinal('master_blok', kBlok.value, 'Blok'),
      divisi: await namaFinal('master_divisi', kDivisi.value, 'Divisi'),
      // nama pengambil: beda kapital disamakan dengan ejaan yang paling sering
      diambil_oleh: kanonikRiwayat(kOleh.value, D.baris('material_keluar').map((r) => r.diambil_oleh)),
      keterangan: rapikan(kKet.value),
      keperluan:rapikan(kPerlu.value),unit_pemakai:rapikan(kUnit.value),meter_unit:rapikan(kMeter.value),alasan_stok:rapikan(kAlasan.value),
    };
    const galat = [];
    if (!nilai.tanggal) galat.push('Tanggal wajib diisi.');
    if (!nilai.material) galat.push('Material wajib diisi.');
    if (!(nilai.qty > 0)) galat.push('Qty harus lebih dari 0.');
    if (!nilai.diambil_oleh) galat.push('"Diambil oleh" wajib diisi.');
    if(!nilai.divisi||nilai.divisi.toLowerCase()==='gudang')galat.push('Pilih divisi pemakai selain Gudang.');
    if(!nilai.keperluan)galat.push('Keperluan pemakaian wajib diisi.');
    kosongkan(tempatGalat);
    if (galat.length) { tempatGalat.append(kesalahan(galat)); return; }
    P.jagaTransaksi(barisLama ? 'ubah' : 'tambah','material_keluar',barisLama,{...barisLama,...nilai});
    D.pastikanMaster('master_material', nilai.material, { satuan_default: nilai.satuan });
    if (nilai.divisi) D.pastikanMaster('master_divisi', nilai.divisi);
    if (nilai.blok) D.pastikanMaster('master_blok', nilai.blok, { divisi: nilai.divisi || null, luas_ha: null });
    if (barisLama) D.ubah('material_keluar', barisLama.id, nilai);
    else D.tambah('material_keluar', nilai);
    pesan(barisLama ? 'Perubahan dicatat.' : 'Material keluar dicatat.', 'sukses');
    p.tutup();
    saatSelesai();
  };

  const aksi = [el('button.tombol-utama', { type: 'button', teks: 'Simpan', onclick: simpan })];
  if (barisLama) {
    aksi.unshift(el('button.tombol-bahaya', {
      type: 'button', teks: 'Hapus',
      onclick: async () => {
        if (!await tanya('Hapus baris material keluar ini?',
          `${tanggal(barisLama.tanggal)} — ${barisLama.material}, ${angka(barisLama.qty, 2)} ${barisLama.satuan || ''}`,
          { ya: 'Hapus', bahaya: true })) return;
        D.hapus('material_keluar', barisLama.id);
        pesan('Terhapus.', 'sukses');
        p.tutup();
        saatSelesai();
      },
    }));
  }

  const p = panel(barisLama ? 'Ubah material keluar' : 'Catat material keluar', el('div', {}, [
    tempatGalat,
    el('div.baris-isian', {}, [
      isian('Tanggal *', kTanggal),
      isian('Qty *', kQty),
    ]),
    isian('Material *', kMaterial),
    infoStok,
    el('div.baris-isian', { style: 'margin-top:.6rem' }, [
      isian('Satuan', kSatuan),
      isian('Divisi pemakai *', kDivisi),
    ]),
    isian('Blok / lokasi', kBlok),
    isian('Diambil oleh *', kOleh),
    isian('Untuk keperluan apa? *',kPerlu),
    isian('Kendaraan / mesin / alat',kUnit),isian('KM / HM (opsional)',kMeter),
    P.admin()?isian('Alasan pengecualian stok',kAlasan):null,
    isian('Keterangan', kKet),
  ]), aksi);
}

export async function halamanKeluar(wadah) {
  const tempatTabel = el('div');
  const tempatRingkas = el('span.bantuan');

  const gambarTabel = () => {
    const semua = [...D.baris('material_keluar')].sort(urutTanggalTurun);
    const tampil = saring(semua, filter.ambil(), ['material', 'divisi', 'blok', 'diambil_oleh', 'keterangan', 'satuan']);
    tempatRingkas.textContent = `${angka(tampil.length)} baris`;
    kosongkan(tempatTabel).append(
      tabel([
        { l: 'Tanggal', k: 'tanggal', jenis: 'tanggal' },
        { l: 'Material', k: 'material' },
        { l: 'Qty', k: 'qty', jenis: 'angka', pecahan: 2, total: true },
        { l: 'Satuan', k: 'satuan' },
        { l: 'Blok', k: 'blok' },
        { l: 'Divisi', k: 'divisi' },
        { l: 'Diambil oleh', k: 'diambil_oleh' },
        { l:'Keperluan',k:'keperluan' },{l:'Kendaraan / alat',k:'unit_pemakai'},
        { l: 'Keterangan', k: 'keterangan' },
      ], tampil.slice(0, BATAS_TAMPIL), {
        kosong: 'Tidak ada material keluar pada filter ini.',
        saatKlik: bisaEdit() ? (r) => { if (P.bolehUbah('material_keluar',r)) formKeluar(r,gambarTabel); else pesan('Tidak memiliki hak revisi untuk divisi ini.','awas'); } : null,
      }),
      catatanBatas(tampil.length),
    );
  };

  const filter = filterPeriode(gambarTabel, { kataTempat: 'Cari material / blok / pengambil…' });

  taruh(wadah,
    spandukLokal(),
    el('div.lembar', {}, [el('div.lembar-isi', {}, [
      el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:.6rem' }, [
        bisaEdit() && P.bolehInput() ? el('button.tombol-utama', {
          type: 'button', teks: '+ Catat material keluar',
          onclick: () => formKeluar(null, gambarTabel),
        }) : null,
        tempatRingkas,
      ]),
      filter.elemen,
      tempatTabel,
      el('p.bantuan', { style: 'margin-top:.7rem', teks: 'Klik satu baris untuk mengubah atau menghapusnya.' }),
    ])]),
  );
  gambarTabel();
}
