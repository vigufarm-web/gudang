import * as D from './data.js?v=8';
import * as P from './pengguna.js?v=8';
import {simpanSekarang,bisaEdit,gambarUlang} from './main.js?v=8';
import {el,taruh,kosongkan,tabel,tanya,mintaTeks,pesan,tanggal,angka} from './ui.js?v=8';

export async function halamanPersetujuanHapus(wadah){
 if(!P.punya('ktu'))throw Error('Hanya admin atau KTU dapat melihat persetujuan penghapusan.');
 const konten=el('div');
 async function putus(r,setuju){
  let alasan='';if(setuju){if(!await tanya('Setujui penghapusan?','Transaksi akan dihapus setelah disimpan. Stok dan keterkaitan akan diperiksa ulang.',{ya:'Setujui hapus',bahaya:true}))return;}
  else {alasan=await mintaTeks('Tolak penghapusan','Jelaskan alasan penolakan.',{label:'Alasan',wajib:true});if(alasan==null)return;}
  try{D.putusHapus(r.id,setuju,alasan);await simpanSekarang('Web: keputusan permintaan hapus');if(D.state.belumDisimpan)pesan('Keputusan belum tersimpan ke GitHub.','awas',9);else pesan('Keputusan tersimpan.','sukses');gambarUlang();}catch(e){pesan(e.message,'galat',9);}
 }
 function gambar(){
  const w=D.web(),req=Object.values(w.permintaanHapus||{}).sort((a,b)=>String(b.waktu).localeCompare(String(a.waktu)));
  const riwayat=Object.values(w.riwayatHapus||{}).sort((a,b)=>String(b.waktu).localeCompare(String(a.waktu)));
  const detail=r=>`${r.snapshot?.material||'—'} · ${angka(r.snapshot?.qty,2)} ${r.snapshot?.satuan||''} · ${tanggal(r.snapshot?.tanggal)||'—'}`;
  kosongkan(konten).append(el('h2',{teks:'Menunggu persetujuan ('+req.filter(r=>r.status==='menunggu').length+')'}),tabel([
   {l:'Transaksi',nilai:r=>r.tabel==='material_masuk'?'Masuk':'Keluar'},{l:'Rincian',nilai:detail},{l:'Diminta oleh',k:'pemohon'},{l:'Alasan',k:'alasan'},
   {l:'Keputusan',nilai:r=>el('div',{},[el('button',{type:'button',teks:'Setujui hapus',disabled:!bisaEdit(),onclick:()=>putus(r,true)}),el('button.tombol-samar',{type:'button',teks:'Tolak',disabled:!bisaEdit(),onclick:()=>putus(r,false)})])}
  ],req.filter(r=>r.status==='menunggu'),{kosong:'Tidak ada permintaan hapus.'}),
  el('h2',{teks:'Riwayat transaksi dihapus',style:'margin-top:1.5rem'}),tabel([{l:'Waktu',k:'waktu'},{l:'Transaksi',nilai:r=>r.tabel==='material_masuk'?'Masuk':'Keluar'},{l:'Rincian',nilai:detail},{l:'Disetujui / dihapus oleh',k:'oleh'}],riwayat,{kosong:'Belum ada penghapusan yang tercatat oleh fitur ini.'}),
  el('h2',{teks:'Riwayat keputusan permintaan',style:'margin-top:1.5rem'}),tabel([{l:'Rincian',nilai:detail},{l:'Pemohon',k:'pemohon'},{l:'Alasan',k:'alasan'},{l:'Status',k:'status'},{l:'Diputus oleh',k:'diputus_oleh'},{l:'Catatan',k:'catatan'}],req.filter(r=>r.status!=='menunggu'),{kosong:'Belum ada keputusan.'}));
 }
 taruh(wadah,el('p.petunjuk',{teks:'Penghapusan material dan BBM perlu disetujui admin atau KTU. Penerimaan yang terkait order harus dikoreksi atau diretur, bukan dihapus.'}),konten);gambar();
}
