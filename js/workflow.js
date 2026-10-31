import {bagiProporsi} from './blok-model.js?v=8';
export {bagiProporsi};
import * as D from './data.js?v=8';
import * as P from './pengguna.js?v=8';
import {norm,unit,samaUnit} from './pengadaan-model.js?v=8';
export const dokumen=()=>Object.values(D.web().permintaanMaterial||{});
export const permintaanTerlihat=()=>dokumen().filter(o=>P.mandor()?o.pemohon.id===P.siapa()?.id&&P.cakupan(o.divisi):P.admin()||P.punya('gudang')||P.cakupan(o.divisi));
export const opname=()=>Object.values(D.web().stokOpname||{});
const copy=v=>JSON.parse(JSON.stringify(v));
const uid=()=>crypto.randomUUID();
const waktu=()=>new Date().toISOString();
const actor=()=>{const p=P.siapa();if(!p)throw Error('Masuk pengguna terlebih dahulu.');return {id:p.id,nama:p.nama};};
const requireThat=(ok,msg)=>{if(!ok)throw Error(msg);};
export const presisi=s=>unit(s)==='buah'||['unit','batang','lembar'].includes(unit(s))?0:2;
export function susunItem(divisi,raw){
 requireThat(raw.umum||['luas','manual'].includes(raw.mode),'Pilih mode pembagian.');
 const master=D.masterDenganNama('master_material',raw.material);
 requireThat(master&&norm(master.nama)!=='bbm','Pilih material yang terdaftar; BBM harus memilih jenisnya.');
 const satuan=master.satuan_default;requireThat(satuan,'Lengkapi satuan stok pada Master Material.');
 const seen=new Set(),blocks=(raw.blok||[]).map(b=>{
  const m=D.baris('master_blok').find(x=>String(x.id)===String(b.id));
  requireThat(m&&norm(m.divisi)===norm(divisi)&&!seen.has(String(m.id)),'Blok harus unik dan berada pada divisi yang dipilih.');seen.add(String(m.id));
  return {blok_id:m.id,blok:m.nama,luas_ha:Number(m.luas_ha)||0,qty:Number(b.qty)};
 });
 requireThat(raw.umum||blocks.length,'Pilih minimal satu blok atau keperluan umum divisi.');
 requireThat(!raw.umum||!blocks.length,'Keperluan umum tidak digabung dengan blok pada item yang sama.');
 const parts=raw.umum?[{blok:'',blok_id:null,luas_ha:null,qty:Number(raw.total)}]:blocks;
 if(!raw.umum&&raw.mode==='luas')bagiProporsi(Number(raw.total),blocks.map(x=>x.luas_ha),presisi(satuan)).forEach((q,i)=>parts[i].qty=q);
 requireThat(parts.every(x=>Number.isFinite(x.qty)&&x.qty>0&&Math.abs(x.qty*10**presisi(satuan)-Math.round(x.qty*10**presisi(satuan)))<1e-6),'Jumlah tiap blok harus positif dan sesuai presisi satuan.');
 return {id:uid(),material:master.nama,satuan,mode:raw.umum?'umum':raw.mode,alokasi:parts.map(x=>({...x,id:uid(),diminta:x.qty,disetujui:x.qty}))};
}
function jejak(o,aksi,alasan=''){(o.jejak ||= []).push({aksi,alasan,...actor(),waktu:waktu()});o.versi=(o.versi||0)+1;D.tandaiBerubah();}
function jagaPemohon(o){requireThat(P.punya('minta')&&P.cakupan(o.divisi)&&(P.admin()||o.pemohon.id===actor().id),'Hanya pemohon atau admin dengan cakupan divisi ini boleh mengubah permintaan.');}
export function buatPermintaan(raw){
 requireThat(P.punya('minta')&&P.cakupan(raw.divisi)&&norm(raw.divisi)!=='gudang','Tidak berhak membuat permintaan pada divisi ini.');
 requireThat(raw.keperluan?.trim()&&raw.items?.length,'Keperluan dan minimal satu material wajib diisi.');
 const items=raw.items.map(x=>susunItem(raw.divisi,x));
 const id=uid(),o={id,nomor:'PM-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+id.slice(0,8).toUpperCase(),tanggal:raw.tanggal,divisi:raw.divisi,keperluan:raw.keperluan.trim(),pemohon:actor(),items,status:'Draf',dibuat:waktu()};
 requireThat(/^\d{4}-\d{2}-\d{2}$/.test(o.tanggal),'Tanggal wajib diisi.');(D.web().permintaanMaterial ||= {})[id]=o;jejak(o,'Buat draf');return o;
}
export function jumlahSerah(o,item,alokasi){return D.baris('material_keluar').filter(r=>r.permintaan_id===o.id&&r.permintaan_item_id===item.id&&r.alokasi_id===alokasi.id).reduce((s,r)=>s+Number(r.qty),0);}
export function rincian(o){return o.items.flatMap(it=>it.alokasi.map(a=>({item:it,alokasi:a,material:it.material,satuan:it.satuan,blok:a.blok||'Umum divisi',diminta:a.diminta,disetujui:a.disetujui,diserahkan:jumlahSerah(o,it,a),sisa:Math.max(0,a.disetujui-jumlahSerah(o,it,a))})));}
export function revisiPermintaan(id,raw){const o=D.web().permintaanMaterial[id];jagaPemohon(o);requireThat(!rincian(o).some(r=>r.diserahkan>0),'Sudah ada penyerahan. Tutup sisa dan buat permintaan baru bila perlu.');requireThat(raw.keperluan?.trim()&&raw.items?.length,'Keperluan dan material wajib diisi.');o.items=raw.items.map(x=>susunItem(o.divisi,x));o.keperluan=raw.keperluan.trim();o.status='Draf';delete o.kepala;delete o.ktu;jejak(o,'Revisi; persetujuan diulang');}
export function ajukanPermintaan(id){const o=D.web().permintaanMaterial[id];jagaPemohon(o);requireThat(o.status==='Draf','Hanya draf yang dapat diajukan.');o.status='Diajukan';jejak(o,'Ajukan ke Kepala Divisi');}
export function bolehPutus(o,tahap){return !!o&&o.pemohon.id!==P.siapa()?.id&&P.punya(tahap)&&P.cakupan(o.divisi)&&o.status===(tahap==='kepala'?'Diajukan':'Acc Kepala Divisi');}
export function putusPermintaan(id,tahap,setuju,nilai={},alasan=''){
 const o=D.web().permintaanMaterial[id];requireThat(['kepala','ktu'].includes(tahap)&&bolehPutus(o,tahap),'Tahap, hak, divisi, atau pemisahan pemohon dan pemberi acc tidak sesuai.');
 if(!setuju){requireThat(alasan.trim(),'Alasan penolakan wajib diisi.');o.status='Ditolak';jejak(o,'Ditolak '+tahap,alasan);return;}
 const rows=rincian(o);requireThat(rows.every(r=>{const v=Number(nilai[r.alokasi.id]??r.disetujui);return Number.isFinite(v)&&v>=0&&v<=r.disetujui+1e-7&&Math.abs(v*10**presisi(r.satuan)-Math.round(v*10**presisi(r.satuan)))<1e-6;}),'Jumlah acc tiap blok tidak boleh melampaui tahap sebelumnya dan harus sesuai satuan.');
 requireThat(rows.some(r=>Number(nilai[r.alokasi.id]??r.disetujui)>0),'Gunakan Tolak jika seluruh jumlah nol.');
 const berkurang=rows.some(r=>Number(nilai[r.alokasi.id]??r.disetujui)<r.disetujui-1e-7);requireThat(!berkurang||alasan.trim(),'Alasan pengurangan jumlah wajib diisi.');
 rows.forEach(r=>r.alokasi.disetujui=Number(nilai[r.alokasi.id]??r.disetujui));o[tahap]={...actor(),waktu:waktu(),alasan,jumlah:rows.map(r=>({id:r.alokasi.id,qty:r.alokasi.disetujui}))};o.status=tahap==='ktu'?'Full Acc':'Acc Kepala Divisi';jejak(o,'Acc '+tahap,alasan);
}
export function serahkan(id,qty,tanggal,penerima){
 const o=D.web().permintaanMaterial[id];requireThat(P.punya('gudang')&&P.punya('input')&&o?.status==='Full Acc','Penyerahan hanya oleh petugas Gudang setelah full acc.');requireThat(penerima?.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(tanggal),'Tanggal dan penerima wajib diisi.');
 const rows=rincian(o),batch=uid(),noSerah='SR-'+tanggal.replaceAll('-','')+'-'+batch.slice(0,8).toUpperCase(),daftar=[];
 for(const r of rows){const q=Number(qty[r.alokasi.id]||0);requireThat(Number.isFinite(q)&&q>=0&&q<=r.sisa+1e-7&&Math.abs(q*10**presisi(r.satuan)-Math.round(q*10**presisi(r.satuan)))<1e-6,'Jumlah penyerahan melebihi sisa per blok atau tidak sesuai satuan.');if(q>0)daftar.push({tanggal,material:r.material,satuan:r.satuan,qty:q,blok:r.alokasi.blok,divisi:o.divisi,diambil_oleh:penerima.trim(),keperluan:o.keperluan,permintaan_id:o.id,permintaan_item_id:r.item.id,alokasi_id:r.alokasi.id,batch_id:batch,no_penyerahan:noSerah,no_permintaan:o.nomor,keterangan:'Penyerahan '+o.nomor});}
 requireThat(daftar.length,'Isi jumlah penyerahan.');D.tambahBatchKeluar(daftar,true);jejak(o,'Penyerahan '+noSerah);return batch;
}
export function tutupPermintaan(id,alasan){const o=D.web().permintaanMaterial[id];requireThat(o&&(P.admin()||P.punya('gudang')||o.pemohon.id===actor().id),'Tidak berhak menutup permintaan.');requireThat(!['Ditutup','Ditolak'].includes(o.status)&&alasan?.trim(),'Alasan penutupan wajib diisi; dokumen tidak boleh ditutup dua kali.');o.status='Ditutup';jejak(o,'Tutup sisa / batalkan',alasan);}
export const adjustment=(d)=>Object.values(d?.web?.stokOpname||{}).filter(o=>o.status==='Disetujui').flatMap(o=>o.items.map(r=>({material:r.material,satuan:r.satuan,qty:r.fisik-r.sistem,opname_id:o.id})));
function basisJejak(material,satuan){const match=r=>norm(r.material)===norm(material)&&samaUnit(r.satuan,satuan),m={};for(const tab of ['material_masuk','material_keluar'])for(const r of D.baris(tab).filter(match))m[tab+':'+r.id]=JSON.stringify(r);for(const r of Object.values(D.web().returPenerimaan||{}).filter(match))m['retur:'+r.id]=JSON.stringify(r);for(const r of adjustment(D.state.data).filter(match))m['opname:'+r.opname_id]=JSON.stringify(r);return m;}
export function buatOpname(materials,tanggal){
 requireThat((P.punya('opname')||P.punya('gudang'))&&materials.length,'Hak opname dan minimal satu material diperlukan.');requireThat(/^\d{4}-\d{2}-\d{2}$/.test(tanggal),'Tanggal wajib diisi.');const ids=new Set();
 const items=materials.map(n=>{const m=D.masterDenganNama('master_material',n);requireThat(m?.satuan_default&&!ids.has(norm(m.nama)),'Material harus unik dan mempunyai satuan stok.');ids.add(norm(m.nama));requireThat(!opname().some(o=>['Draf','Diajukan'].includes(o.status)&&o.items.some(r=>norm(r.material)===norm(m.nama))),'Material sedang dihitung dalam opname lain. Selesaikan atau batalkan terlebih dahulu.');const stok=D.laporanStok().find(r=>norm(r.material)===norm(m.nama)&&samaUnit(r.satuan,m.satuan_default));return {id:uid(),material:m.nama,satuan:m.satuan_default,sistem:stok?.stok||0,fisik:null,alasan:'',basis:basisJejak(m.nama,m.satuan_default)};});
 const id=uid(),o={id,nomor:'SO-'+tanggal.replaceAll('-','')+'-'+id.slice(0,8).toUpperCase(),tanggal,status:'Draf',items,penghitung:actor(),mulai:waktu()};(D.web().stokOpname ||= {})[id]=o;jejak(o,'Mulai penghitungan; stok acuan dikunci');return o;
}
function jagaOpname(o){requireThat(o&&(P.admin()||((P.punya('opname')||P.punya('gudang'))&&o.penghitung.id===actor().id)),'Tidak berhak mengisi opname ini.');}
function periksaBasis(o){for(const r of o.items){const now=basisJejak(r.material,r.satuan);requireThat(Object.keys(now).filter(k=>k.startsWith('opname:')&&k!=='opname:'+o.id).every(k=>r.basis[k]!==undefined),'Ada penyesuaian opname lain setelah acuan diambil. Hitung ulang.');requireThat(Object.entries(r.basis).every(([k,v])=>now[k]===v),'Transaksi yang sudah menjadi acuan opname dikoreksi/dihapus. Batalkan dan hitung ulang opname.');}}
export function isiOpname(id,nilai,ajukan=false){const o=D.web().stokOpname[id];jagaOpname(o);requireThat(o.status==='Draf','Hanya draf opname yang dapat diisi.');const rows=o.items.map(r=>{const n=nilai[r.id];requireThat(n&&n.fisik!==''&&n.fisik!=null&&Number.isFinite(Number(n.fisik))&&Number(n.fisik)>=0,'Isi hasil fisik semua material, termasuk angka 0 bila kosong.');requireThat(Math.abs(Number(n.fisik)*10**presisi(r.satuan)-Math.round(Number(n.fisik)*10**presisi(r.satuan)))<1e-6,'Hasil fisik harus sesuai presisi satuan.');requireThat(Math.abs(Number(n.fisik)-r.sistem)<1e-7||n.alasan?.trim(),'Alasan setiap selisih wajib diisi.');return {...r,fisik:Number(n.fisik),alasan:n.alasan?.trim()||''};});periksaBasis(o);o.items=rows;if(ajukan)o.status='Diajukan';jejak(o,ajukan?'Ajukan opname ke KTU':'Simpan hasil hitung');}
export function putusOpname(id,setuju,alasan=''){
 const o=D.web().stokOpname[id];requireThat(P.punya('ktu')&&o?.status==='Diajukan','Hanya KTU dapat memutuskan opname yang diajukan.');
 if(!setuju){requireThat(alasan.trim(),'Alasan pengembalian wajib diisi.');o.status='Draf';jejak(o,'Dikembalikan KTU',alasan);return;}
 periksaBasis(o);for(const r of o.items){const s=D.laporanStok().find(x=>norm(x.material)===norm(r.material)&&samaUnit(x.satuan,r.satuan));requireThat((s?.stok||0)+r.fisik-r.sistem>=-1e-7,'Transaksi setelah penghitungan menyebabkan hasil penyesuaian negatif. Hitung ulang.');}
 for(const r of o.items){const s=D.laporanStok().find(x=>norm(x.material)===norm(r.material)&&samaUnit(x.satuan,r.satuan));r.stok_sebelum_acc=s?.stok||0;r.stok_setelah_acc=r.stok_sebelum_acc+r.fisik-r.sistem;}
 o.status='Disetujui';o.ktu={...actor(),waktu:waktu()};jejak(o,'Acc KTU; selisih diterapkan');
}
export function batalkanOpname(id,alasan){const o=D.web().stokOpname[id];jagaOpname(o);requireThat(o.status!=='Disetujui'&&o.status!=='Dibatalkan'&&alasan?.trim(),'Opname yang sudah disetujui dikoreksi melalui pembatalan KTU. Alasan wajib.');o.status='Dibatalkan';jejak(o,'Batalkan penghitungan',alasan);}
export function balikkanOpname(id,alasan){const o=D.web().stokOpname[id];requireThat(P.punya('ktu')&&o?.status==='Disetujui'&&alasan?.trim(),'Hanya KTU boleh membatalkan penyesuaian dengan alasan.');requireThat(!opname().some(x=>x.id!==o.id&&x.status==='Disetujui'&&(x.ktu.waktu>o.ktu.waktu||x.items.some(r=>r.basis?.['opname:'+o.id]!==undefined))&&x.items.some(r=>o.items.some(a=>norm(a.material)===norm(r.material)))),'Ada opname lebih baru pada material ini. Koreksi melalui opname baru.');for(const r of o.items){const s=D.laporanStok().find(x=>norm(x.material)===norm(r.material)&&samaUnit(x.satuan,r.satuan));requireThat((s?.stok||0)-(r.fisik-r.sistem)>=-1e-7,'Pembatalan membuat stok negatif. Gunakan opname baru.');}o.status='Dibatalkan';jejak(o,'KTU membatalkan penyesuaian',alasan);}
export function auditWorkflow(){
 for(const o of dokumen())for(const r of rincian(o))requireThat(r.diserahkan<=r.disetujui+1e-7,'Penyerahan bersamaan melebihi jatah per blok. Muat ulang data.');
 const used=new Set();for(const o of opname())if(['Draf','Diajukan'].includes(o.status))for(const r of o.items){const k=norm(r.material)+'|'+unit(r.satuan);requireThat(!used.has(k),'Ada opname bersamaan untuk material yang sama. Muat ulang data.');used.add(k);}
}
export function jagaGabungWorkflow(dasar,lokal,remote){
 for(const bagian of ['permintaanMaterial','stokOpname'])for(const [id,l] of Object.entries(lokal.web?.[bagian]||{})){const b=dasar.web?.[bagian]?.[id],r=remote.web?.[bagian]?.[id];if(JSON.stringify(l)!==JSON.stringify(b)&&JSON.stringify(r)!==JSON.stringify(b)&&JSON.stringify(l)!==JSON.stringify(r))throw Error('Dokumen permintaan/opname yang sama telah diubah perangkat lain. Simpan draf sebagai referensi lalu muat ulang sebelum mengulangi tindakan.');}
}

export function validasiSimpanWorkflow(basis){
 auditWorkflow();
 for(const o of opname()){
  const lama=basis.web?.stokOpname?.[o.id];if(JSON.stringify(o)===JSON.stringify(lama))continue;
  if(o.status!=='Disetujui'&&lama?.status!=='Disetujui')continue;
  if(o.status==='Disetujui')periksaBasis(o);
  else requireThat(!opname().some(x=>x.id!==o.id&&x.status==='Disetujui'&&x.items.some(r=>r.basis?.['opname:'+o.id]!==undefined)),'Ada opname baru yang bergantung pada penyesuaian ini. Gunakan opname baru.');
  for(const r of o.items){requireThat(r.fisik!==null&&Number.isFinite(r.fisik)&&r.fisik>=0,'Hasil fisik opname tidak valid.');const s=D.laporanStok().find(x=>norm(x.material)===norm(r.material)&&samaUnit(x.satuan,r.satuan));requireThat(s&&s.stok>=-1e-7,'Penyesuaian bersamaan membuat stok negatif. Muat ulang dan hitung kembali.');}
 }
}
