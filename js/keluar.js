import {editorBlokBbm} from './bbm-blok-ui.js?v=8';
import {formKeluarBanyakBlok} from './workflow-ui.js?v=8';
import {adalahBbm,JENIS_BBM} from './bbm-model.js?v=8';
import {pilihanUnitBbm} from './bbm.js?v=8';
// keluar.js — Material Keluar: form input + tabel. "Diambil oleh" wajib diisi,
// sama seperti aplikasi desktop.

import * as D from './data.js?v=8';
import * as P from './pengguna.js?v=8';
import { el, kosongkan, taruh, pesan, tanya, mintaTeks, panel, isian, tabel, angka, tanggal, kesalahan } from './ui.js?v=8';
import { bisaEdit, spandukLokal, simpanSekarang } from './main.js?v=8';
import {
  rapikan, inputMaster, inputTanggal, inputAngka, namaFinal, kanonikRiwayat,
  filterPeriode, saring, urutTanggalTurun, BATAS_TAMPIL, catatanBatas,
} from './form-util.js?v=8';

function formKeluar(barisLama, saatSelesai, bbm=false, banyakBlok=false) {
  if(barisLama?.permintaan_id){pesan('Penyerahan terhubung ke '+barisLama.no_permintaan+'. Buka Permintaan Mandor untuk melihat riwayatnya.','awas');return;}
  if (barisLama && !P.bolehUbah('material_keluar',barisLama)) return;
  const tempatGalat = el('div');
  const kTanggal = inputTanggal(barisLama?.tanggal);
  const kMaterial = bbm ? el('select',{},[el('option',{value:'',teks:'Pilih jenis BBM…'}),...JENIS_BBM.map(n=>el('option',{value:D.masterDenganNama('master_material',n)?.nama||n,teks:n,selected:n.toLowerCase()===barisLama?.material?.toLowerCase()}))]) : inputMaster('master_material', barisLama?.material || '', {
    tempat: 'Ketik untuk mencari / nama baru…',
    saatUbah: () => {
      const bawaan = D.satuanBawaan(kMaterial.value);
      if (bawaan) kSatuan.value = bawaan;
      tunjukkanStok();
    },
  });
  const kSatuan = bbm ? el('input',{nilai:'Liter',readonly:true}) : inputMaster('master_satuan', barisLama?.satuan || '');
  const kQty = inputAngka(barisLama?.qty);
  const kBlok = inputMaster('master_blok', barisLama?.blok || '');
  const kDivisi = inputMaster('master_divisi', barisLama?.divisi || '');
  const kPemilik=el('select',{},[el('option',{value:'',teks:'Pilih pemilik stok…'}),el('option',{value:'Gudang',teks:'Gudang (stok bersama)'}),...D.baris('master_divisi').filter(r=>!['gudang','cabai'].includes(rapikan(r.nama).toLowerCase())).map(r=>el('option',{value:r.nama,teks:r.nama}))]);
  kPemilik.value=barisLama?.pemilik_stok||barisLama?.divisi||'';
  const infoPemilik=el('small.bantuan');
  const blokBbm=bbm&&!barisLama?editorBlokBbm(kDivisi,kQty,{banyak:banyakBlok}):null;
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
  const unitBbm=bbm?pilihanUnitBbm(barisLama):null;
  const kAlasan=el('input',{type:'text',nilai:barisLama?.alasan_stok||'',placeholder:'Hanya admin, bila perlu koreksi stok'});
  const infoStok = el('small.bantuan');

  function tunjukkanStok() {
    const nama = rapikan(kMaterial.value);
    if (!nama) { infoStok.textContent = ''; return; }
    const baris = D.laporanStok().find((s) => s.material.toLowerCase() === nama.toLowerCase());
    infoStok.textContent = baris
      ? `Stok gudang saat ini: ${angka(baris.stok, 2)} ${baris.satuan || ''}`
      : 'Material ini belum pernah tercatat masuk.';
    if(!bbm&&kPemilik.value&&kSatuan.value){const audit=D.auditMilik(nama,kSatuan.value);infoPemilik.textContent=`Saldo milik ${kPemilik.value}: ${angka(D.saldoMilik(nama,kSatuan.value,kPemilik.value),2)} ${kSatuan.value}.${audit.perluDiperiksa?' Riwayat atau selisih opname perlu diperiksa.':''}`;}else infoPemilik.textContent='';
  }
  kPemilik.addEventListener('change',tunjukkanStok);kSatuan.addEventListener('change',tunjukkanStok);
  tunjukkanStok();
  if(bbm)kMaterial.addEventListener('change',tunjukkanStok);

  const simpan = async () => {
    const nilai = {
      tanggal: kTanggal.value,
      // anti-dobel: ejaan mengikuti master; nama baru yang mirip ditanyakan dulu
      material: await namaFinal('master_material', kMaterial.value, 'Material'),
      satuan: D.normalkanSatuan(kSatuan.value),
      qty: Number(kQty.value),
      blok: blokBbm?'':await namaFinal('master_blok', kBlok.value, 'Blok'),
      divisi: await namaFinal('master_divisi', kDivisi.value, 'Divisi'),
      ...(!bbm?{pemilik_stok:kPemilik.value}:{}),
      // nama pengambil: beda kapital disamakan dengan ejaan yang paling sering
      diambil_oleh: kanonikRiwayat(kOleh.value, D.baris('material_keluar').map((r) => r.diambil_oleh)),
      keterangan: rapikan(kKet.value),
      keperluan:rapikan(kPerlu.value),unit_pemakai:rapikan(kUnit.value),...(unitBbm?unitBbm.ambil():{}),alasan_stok:rapikan(kAlasan.value),
    };
    const galat = [];
    if (!nilai.tanggal) galat.push('Tanggal wajib diisi.');
    if (!nilai.material) galat.push('Material wajib diisi.');
    if(!bbm&&adalahBbm(nilai))galat.push('Catat transaksi BBM melalui menu BBM Keluar.');
    if (!(nilai.qty > 0)) galat.push('Qty harus lebih dari 0.');
    if (!nilai.diambil_oleh) galat.push('"Diambil oleh" wajib diisi.');
    if(!nilai.divisi||nilai.divisi.toLowerCase()==='gudang')galat.push('Pilih divisi pemakai selain Gudang.');
    if(!bbm&&!nilai.pemilik_stok)galat.push('Pilih divisi pemilik stok.');
    if(!nilai.keperluan)galat.push('Keperluan pemakaian wajib diisi.');
    kosongkan(tempatGalat);
    if (galat.length) { tempatGalat.append(kesalahan(galat)); return; }
    P.jagaTransaksi(barisLama ? 'ubah' : 'tambah','material_keluar',barisLama,{...barisLama,...nilai});
    D.pastikanMaster('master_material', nilai.material, { satuan_default: nilai.satuan });
    if (nilai.divisi) D.pastikanMaster('master_divisi', nilai.divisi);
    if (nilai.blok) D.pastikanMaster('master_blok', nilai.blok, { divisi: nilai.divisi || null, luas_ha: null });
    if (barisLama) D.ubah('material_keluar', barisLama.id, nilai);
    else if(blokBbm){
      const parts=blokBbm.ambil();
      if(blokBbm.mode()==='kosong')D.tambah('material_keluar',{...nilai,blok:''});
      else{const batch=crypto.randomUUID();D.tambahBatchKeluar(parts.map(r=>({...nilai,...r,batch_id:batch,mode_pembagian:blokBbm.mode()})));}
    }else D.tambah('material_keluar', nilai);
    p.tutup();
    saatSelesai();
    const sedang=pesan('Menyimpan ke GitHub…','info',30);
    const ok=await simpanSekarang('Web: simpan material / BBM keluar',{senyap:true});sedang.remove();
    if(ok&&!D.modeLokal())pesan('Tersimpan ke GitHub.','sukses');
    else if(!ok)pesan('Belum tersimpan ke GitHub. Jangan tutup halaman; periksa pesan kesalahan dan coba Simpan.','awas',12);
  };

  let sibuk=false;const aksi = [el('button.tombol-utama', { type: 'button', teks: 'Simpan', onclick:async(e)=>{if(sibuk)return;sibuk=true;e.currentTarget.disabled=true;const b=e.currentTarget;try{await simpan();}catch(err){kosongkan(tempatGalat).append(kesalahan([err.message]));}finally{sibuk=false;b.disabled=false;}} })];
  if (barisLama) {
    aksi.unshift(el('button.tombol-bahaya', {
      type: 'button', teks: P.admin()?'Hapus':'Ajukan hapus',
      onclick: async () => {
        if (!P.admin()) {const alasan=await mintaTeks('Ajukan hapus transaksi','Transaksi tetap tercatat sampai disetujui admin atau KTU.',{label:'Alasan',wajib:true});if(alasan==null)return;D.ajukanHapus('material_keluar',barisLama.id,alasan);pesan('Permintaan dicatat; tunggu tersimpan dan keputusan admin/KTU.','sukses');p.tutup();saatSelesai();return;}
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

  const p = panel(bbm ? (barisLama?'Ubah BBM keluar':'Catat BBM keluar') : (barisLama ? 'Ubah material keluar' : 'Catat material keluar'), el('div', {}, [
    tempatGalat,
    el('div.baris-isian', {}, [
      isian('Tanggal *', kTanggal),
      isian(bbm?'Jumlah liter *':'Qty *', kQty),
    ]),
    isian(bbm?'Jenis BBM *':'Material *', kMaterial),
    infoStok,
    el('div.baris-isian', { style: 'margin-top:.6rem' }, [
      isian('Satuan', kSatuan),
      isian('Divisi pemakai *', kDivisi),
    ]),
    !bbm?isian('Divisi pemilik stok *',kPemilik,{bantuan:'Jika berbeda dari divisi pemakai, transaksi dicatat sebagai pemakaian lintas divisi.'}):null,!bbm?infoPemilik:null,
    blokBbm?blokBbm.elemen:isian('Blok / lokasi (opsional)', kBlok),
    isian('Diambil oleh *', kOleh),
    isian('Untuk keperluan apa? *',kPerlu),
    unitBbm?unitBbm.elemen:isian('Kendaraan / mesin / alat',kUnit),
    P.admin()?isian('Alasan pengecualian stok',kAlasan):null,
    isian('Keterangan', kKet),
  ]), aksi);
}

export async function halamanKeluar(wadah, bbm=false) {
  const tempatTabel = el('div');
  const tempatRingkas = el('span.bantuan');

  const gambarTabel = () => {
    const semua = D.baris('material_keluar').filter(r=>adalahBbm(r)===bbm).sort(urutTanggalTurun);
    const tampil = saring(semua, filter.ambil(), ['material', 'divisi', 'blok', 'diambil_oleh', 'keterangan', 'satuan','keperluan','unit_pemakai']);
    tempatRingkas.textContent = `${angka(tampil.length)} baris`;
    kosongkan(tempatTabel).append(
      tabel([
        { l: 'Tanggal', k: 'tanggal', jenis: 'tanggal' },
        { l: 'Material', k: 'material' },
        {l:'Permintaan',k:'no_permintaan'},
        { l: 'Qty', k: 'qty', jenis: 'angka', pecahan: 2, total: true },
        { l: 'Satuan', k: 'satuan' },
        { l: 'Blok', k: 'blok' },
        { l: 'Divisi', k: 'divisi' },
        ...(!bbm?[{l:'Pemilik stok',nilai:r=>r.pemilik_stok||`${r.divisi||'Gudang'} (riwayat)`}]:[]),
        { l: 'Diambil oleh', k: 'diambil_oleh' },
        { l:'Keperluan',k:'keperluan' },{l:'Kendaraan / alat',k:'unit_pemakai'},
        { l: 'Keterangan', k: 'keterangan' },
      ], tampil.slice(0, BATAS_TAMPIL), {
        kosong: 'Tidak ada material keluar pada filter ini.',
        saatKlik: bisaEdit() ? (r) => { if (P.bolehUbah('material_keluar',r)) formKeluar(r,gambarTabel,bbm); else pesan('Tidak memiliki hak revisi untuk divisi ini.','awas'); } : null,
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
          type: 'button', teks: bbm?'+ Catat BBM keluar':'+ Catat material keluar',
          onclick: () => formKeluar(null, gambarTabel,bbm),
        }) : null,
        bisaEdit()&&P.bolehInput()?el('button',{teks:'+ Banyak blok',onclick:()=>bbm?formKeluar(null,gambarTabel,true,true):formKeluarBanyakBlok(gambarTabel)}):null,
        tempatRingkas,
      ]),
      filter.elemen,
      tempatTabel,
      el('p.bantuan', { style: 'margin-top:.7rem', teks: 'Klik satu baris untuk mengubah atau menghapusnya.' }),
    ])]),
  );
  gambarTabel();
}
