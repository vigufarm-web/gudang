import {adalahBbm,JENIS_BBM} from './bbm-model.js?v=8';
// masuk.js — Material Masuk: form input + tabel, dengan link opsional ke item SPPB.

import * as D from './data.js?v=8';
import * as P from './pengguna.js?v=8';
import {formTerimaOrder,formRetur} from './pengadaan-ui.js?v=8';
import { el, kosongkan, taruh, pesan, tanya, panel, isian, tabel, angka, tanggal, kesalahan } from './ui.js?v=8';
import { bisaEdit, spandukLokal } from './main.js?v=8';
import {
  rapikan, kecil, inputMaster, inputTanggal, inputAngka, namaFinal,
  filterPeriode, saring, urutTanggalTurun, BATAS_TAMPIL, catatanBatas,
} from './form-util.js?v=8';

function formMasuk(barisLama, saatSelesai, bbm=false) {
  if (barisLama && !P.bolehUbah('material_masuk',barisLama)) return;
  if(barisLama?.order_id)return formTerimaOrder(D.web().pesanan[barisLama.order_id],saatSelesai,barisLama);
  const tempatGalat = el('div');
  const kTanggal = inputTanggal(barisLama?.tanggal);
  const kMaterial = bbm ? el('select',{},[el('option',{value:'',teks:'Pilih jenis BBM…'}),...JENIS_BBM.map(n=>el('option',{value:D.masterDenganNama('master_material',n)?.nama||n,teks:n,selected:n.toLowerCase()===barisLama?.material?.toLowerCase()}))]) : inputMaster('master_material', barisLama?.material || '', {
    tempat: 'Ketik untuk mencari / nama baru…',
    saatUbah: () => {
      const bawaan = D.satuanBawaan(kMaterial.value);
      if (bawaan) kSatuan.value = bawaan;
      isiPilihanSppb();
    },
  });
  const kSatuan = bbm ? el('input',{nilai:'Liter',readonly:true}) : inputMaster('master_satuan', barisLama?.satuan || '');
  const kQty = inputAngka(barisLama?.qty);
  const kDivisi = el('input',{type:'text',nilai:bbm?'Gudang':barisLama?.divisi||'Gudang',readonly:true});
  const kSumber = el('input', { type: 'text', nilai: barisLama?.sumber || '', placeholder: 'Supplier / asal barang' });
  const kSppb = el('select');
  const kKet = el('textarea', { rows: 2 }, [barisLama?.keterangan || '']);

  function isiPilihanSppb() {
    const materi = rapikan(kMaterial.value);
    const pilihanLama = barisLama?.sppb_item_id ?? kSppb.value;
    kosongkan(kSppb).append(el('option', { value: '', teks: 'Tanpa SPPB' }));
    if(bbm&&!materi)return;
    // tampilkan item SPPB dengan material sama yang masih ada sisa (plus item
    // yang sudah terpilih di baris ini, supaya tidak hilang saat mengubah)
    const daftar = D.itemSppbTerbuka(materi || null, barisLama?.sppb_item_id);
    for (const it of daftar) {
      const o = el('option', {
        value: it.sppb_item_id,
        teks: `${it.no_sppb} | ${it.material} | sisa ${angka(it.sisa, 2)} ${it.satuan || ''}`.trim(),
      });
      if (String(it.sppb_item_id) === String(pilihanLama)) o.selected = true;
      kSppb.append(o);
    }
  }
  isiPilihanSppb();
  if(bbm)kMaterial.addEventListener('change',isiPilihanSppb);

  const simpan = async () => {
    const nilai = {
      tanggal: kTanggal.value,
      // anti-dobel: ejaan mengikuti master; nama baru yang mirip ditanyakan dulu
      material: await namaFinal('master_material', kMaterial.value, 'Material'),
      satuan: D.normalkanSatuan(kSatuan.value),
      qty: Number(kQty.value),
      divisi: barisLama?.divisi||'Gudang',
      sumber: rapikan(kSumber.value),
      sppb_item_id: kSppb.value ? Number(kSppb.value) : null,
      keterangan: rapikan(kKet.value),
    };
    const galat = [];
    if (!nilai.tanggal) galat.push('Tanggal wajib diisi.');
    if (!nilai.material) galat.push('Material wajib diisi.');
    if(!bbm&&adalahBbm(nilai))galat.push('Catat transaksi BBM melalui menu BBM Masuk.');
    if (!(nilai.qty > 0)) galat.push('Qty harus lebih dari 0.');
    kosongkan(tempatGalat);
    if (galat.length) { tempatGalat.append(kesalahan(galat)); return; }
    P.jagaTransaksi(barisLama ? 'ubah' : 'tambah','material_masuk',barisLama,{...barisLama,...nilai});
    D.pastikanMaster('master_material', nilai.material, { satuan_default: nilai.satuan });
    if (nilai.divisi) D.pastikanMaster('master_divisi', nilai.divisi);
    if (barisLama) D.ubah('material_masuk', barisLama.id, nilai);
    else D.tambah('material_masuk', nilai);
    pesan(barisLama ? 'Perubahan dicatat.' : 'Material masuk dicatat.', 'sukses');
    p.tutup();
    saatSelesai();
  };

  const aksi = [el('button.tombol-utama', { type: 'button', teks: 'Simpan', onclick: simpan })];
  if (barisLama) {
    if(P.admin())aksi.push(el('button.tombol-samar',{type:'button',teks:'Retur ke supplier',onclick:()=>formRetur(barisLama,()=>{p.tutup();saatSelesai();})}));
    aksi.unshift(el('button.tombol-bahaya', {
      type: 'button', teks: 'Hapus',
      onclick: async () => {
        if (!await tanya('Hapus baris material masuk ini?',
          `${tanggal(barisLama.tanggal)} — ${barisLama.material}, ${angka(barisLama.qty, 2)} ${barisLama.satuan || ''}`,
          { ya: 'Hapus', bahaya: true })) return;
        D.hapus('material_masuk', barisLama.id);
        pesan('Terhapus.', 'sukses');
        p.tutup();
        saatSelesai();
      },
    }));
  }

  const p = panel(bbm ? (barisLama?'Ubah BBM masuk':'Catat BBM masuk') : (barisLama ? 'Ubah material masuk' : 'Catat material masuk'), el('div', {}, [
    tempatGalat,
    el('div.baris-isian', {}, [
      isian('Tanggal *', kTanggal),
      isian(bbm?'Jumlah liter *':'Qty *', kQty),
    ]),
    isian(bbm?'Jenis BBM *':'Material *', kMaterial, { bantuan: bbm?'Solar, Pertalite dan Pertamax dicatat terpisah dalam liter.':'Nama baru otomatis masuk ke Master Material.' }),
    el('div.baris-isian', {}, [
      isian('Satuan', kSatuan),
      isian('Lokasi stok', kDivisi),
    ]),
    isian('Sumber / supplier', kSumber),
    el('a',{href:'#/ditunggu',teks:'Ada order supplier? Buka Barang ditunggu → Terima barang',style:'display:block;margin:.6rem 0'}),
    isian('Link ke SPPB lama / tanpa order (opsional)', kSppb, {
      bantuan: 'Hanya SPPB dengan material sama yang masih ada sisa. Kosongkan kalau tidak terkait SPPB.',
    }),
    isian('Keterangan', kKet),
  ]), aksi);
}

export async function halamanMasuk(wadah, bbm=false) {
  const tempatTabel = el('div');
  const tempatRingkas = el('span.bantuan');

  const gambarTabel = () => {
    const semua = D.baris('material_masuk').filter(r=>adalahBbm(r)===bbm).sort(urutTanggalTurun);
    const tampil = saring(semua, filter.ambil(), ['material', 'divisi', 'sumber', 'keterangan', 'satuan']);
    tempatRingkas.textContent = `${angka(tampil.length)} baris`;
    kosongkan(tempatTabel).append(
      tabel([
        { l: 'Tanggal', k: 'tanggal', jenis: 'tanggal' },
        { l: 'Material', k: 'material' },
        { l: 'Qty', k: 'qty', jenis: 'angka', pecahan: 2, total: true },
        { l: 'Satuan', k: 'satuan' },
        bbm?{l:'Lokasi stok',nilai:()=> 'Gudang'}:{ l: 'Divisi', k: 'divisi' },
        { l: 'Sumber', k: 'sumber' },
        {l:'No. order',nilai:r=>D.web().pesanan?.[r.order_id]?.nomor||'—'},
        { l: 'SPPB', nilai: (r) => D.nomorSppbDariItem(r.sppb_item_id) || '–' },
        { l: 'Keterangan', k: 'keterangan' },
      ], tampil.slice(0, BATAS_TAMPIL), {
        kosong: 'Tidak ada material masuk pada filter ini.',
        saatKlik: bisaEdit() ? (r) => { if (P.bolehUbah('material_masuk',r)) formMasuk(r,gambarTabel,bbm); else pesan('Tidak memiliki hak revisi untuk divisi ini.','awas'); } : null,
      }),
      catatanBatas(tampil.length),
    );
  };

  const filter = filterPeriode(gambarTabel, { kataTempat: 'Cari material / divisi / sumber…' });

  taruh(wadah,
    spandukLokal(),
    el('div.lembar', {}, [el('div.lembar-isi', {}, [
      el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:.6rem' }, [
        bisaEdit() && P.bolehInput() ? el('button.tombol-utama', {
          type: 'button', teks: bbm?'+ Catat BBM masuk':'+ Catat material masuk',
          onclick: () => formMasuk(null, gambarTabel,bbm),
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
