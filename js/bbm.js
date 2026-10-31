import * as D from './data.js?v=6';
import * as P from './pengguna.js?v=6';
import {samaUnit} from './pengadaan-model.js?v=6';
import {bukaAmplop} from './kunci.js?v=6';
import {el,taruh,kosongkan,isian,panel,pesan,angka} from './ui.js?v=6';
import {bisaEdit} from './main.js?v=6';
import {JENIS_BBM,unitDariPayroll,labelUnit,adalahBbm} from './bbm-model.js?v=6';
const PAYROLL='https://vigufarm-web.github.io/payrol/';
export function pilihanUnitBbm(lama){
 const refs=D.web().unitPayroll?.daftar||[];
 const jenis=el('select',{},['ALB','Kendaraan','Alsintan','Lainnya'].map(n=>el('option',{value:n,teks:n,selected:n===(lama?.jenis_unit||'ALB')})));
 const sumber=el('select',{},[el('option',{value:'manual',teks:'Isi manual'}),el('option',{value:'payroll',teks:'Pilih dari payroll',selected:!!lama?.payroll_unit_id})]);
 const daftar=el('select');const manual=el('input',{type:'text',nilai:lama?.unit_pemakai||'',placeholder:'Kode / nama alat atau nomor kendaraan'});
 let fPilihan,fManual;
 const atur=()=>{
  const id=daftar.value||String(lama?.payroll_unit_id||'');kosongkan(daftar);
  const cocok=refs.filter(r=>jenis.value==='ALB'?r.kategori==='ALAT BERAT':['KENDARAAN','DUMP TRUCK'].includes(r.kategori));
  daftar.append(el('option',{value:'',teks:'Pilih unit…'}));for(const r of cocok)daftar.append(el('option',{value:r.id,teks:labelUnit(r),selected:r.id===id}));
  if(jenis.value==='Alsintan'||jenis.value==='Lainnya')sumber.value='manual';
  sumber.disabled=['Alsintan','Lainnya'].includes(jenis.value);
  daftar.hidden=sumber.value!=='payroll';manual.hidden=sumber.value==='payroll';if(fPilihan)fPilihan.hidden=daftar.hidden;if(fManual)fManual.hidden=manual.hidden;
 };
 fPilihan=isian('Unit alat / kendaraan',daftar);fManual=isian('Unit manual',manual);
 jenis.addEventListener('change',atur);sumber.addEventListener('change',atur);atur();
 return {elemen:el('div',{},[isian('Jenis unit pemakai',jenis),isian('Sumber unit',sumber),fPilihan,fManual,el('small.bantuan',{teks:'Alsintan diisi manual. HM/KM tetap dicatat di payroll. Buka payroll lalu pilih bagian Alat Berat & Kendaraan.'}),el('a',{href:PAYROLL,target:'_blank',rel:'noopener',teks:'Buka ALB & kendaraan di payroll',style:'display:block;margin:.6rem 0'})]),ambil:()=>{
  if(sumber.value==='payroll'){
   const r=refs.find(r=>r.id===daftar.value);if(!r)throw Error('Pilih unit payroll atau gunakan input manual.');
   return {jenis_unit:jenis.value,unit_pemakai:labelUnit(r),sumber_unit:'payroll',payroll_unit_id:r.id,payroll_unit_kode:r.kode};
  }
  if(!manual.value.trim())throw Error('Isi nama alat / kendaraan pemakai BBM.');
  return {jenis_unit:jenis.value,unit_pemakai:manual.value.trim(),sumber_unit:'manual',payroll_unit_id:null,payroll_unit_kode:''};
 }};
}
function hubungkanPayroll(selesai){
 P.wajibAdmin();const sandi=el('input',{type:'password',autocomplete:'off'}),status=el('p.bantuan');
 const simpan=async amplop=>{
  const data=await bukaAmplop(amplop,sandi.value);const daftar=unitDariPayroll(data);sandi.value='';
  if(!daftar.length)throw Error('Tidak ada unit aktif; referensi sebelumnya dipertahankan.');
  D.web().unitPayroll={daftar,diperbarui:new Date().toISOString(),sumber:'vigufarm-web/payrol:data/alat-berat.json'};D.tandaiBerubah();p.tutup();selesai();pesan(`${daftar.length} unit payroll dimuat. Simpan perubahan Gudang.`,'sukses');
 };
 const file=el('input',{type:'file',accept:'.json,application/json',onchange:async()=>{try{if(!file.files[0])return;await simpan(JSON.parse(await file.files[0].text()));}catch(e){sandi.value='';status.textContent=e.message;}}});
 const p=panel('Referensi unit payroll',el('div',{},[el('p',{teks:'Hanya kode, nama, kategori dan nomor polisi unit aktif yang disalin ke data Gudang. Password, HM/KM, upah, operator dan token payroll tidak disimpan. Memuat ulang memperbarui pilihan tanpa mengubah riwayat pemakaian.'}),isian('Password data ALB & kendaraan',sandi),status,isian('Atau pilih berkas data ALB terenkripsi',file)]),[el('button.tombol-utama',{teks:'Muat unit dari payroll',onclick:async()=>{try{status.textContent='Memuat…';const r=await fetch('https://raw.githubusercontent.com/vigufarm-web/payrol/main/data/alat-berat.json',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('Data payroll belum bisa dimuat. Gunakan berkas terenkripsi atau input manual.');await simpan(await r.json());}catch(e){sandi.value='';status.textContent=e.message;}}})]);
}
export async function halamanBbm(wadah){
 const stok=D.laporanStok();taruh(wadah,el('p',{teks:'Penerimaan masuk ke Gudang tanpa divisi. Pengeluaran langsung menjadi pemakaian divisi tujuan. Satu catatan transaksi digunakan untuk seluruh laporan.'}),el('div',{style:'display:flex;gap:1rem;flex-wrap:wrap'},JENIS_BBM.map(n=>el('div.lembar',{style:'padding:1rem;flex:1;min-width:160px'},[el('h2',{teks:n}),el('strong',{teks:`${angka(stok.filter(r=>r.material.trim().toLowerCase()===n.toLowerCase()&&samaUnit(r.satuan,'Liter')).reduce((a,r)=>a+r.stok,0),2)} Liter`})]))),el('div',{style:'display:flex;gap:1rem;margin:1rem 0;flex-wrap:wrap'},[el('a.tombol.tombol-utama',{href:'#/bbm-masuk',teks:'BBM Masuk'}),el('a.tombol.tombol-utama',{href:'#/bbm-keluar',teks:'BBM Keluar'}),el('a',{href:PAYROLL,target:'_blank',rel:'noopener',teks:'ALB & kendaraan di payroll'})]),el('p.bantuan',{teks:D.web().unitPayroll?`Referensi payroll: ${D.web().unitPayroll.daftar.length} unit; diperbarui ${new Date(D.web().unitPayroll.diperbarui).toLocaleString('id-ID')}.`:'Referensi payroll belum dimuat. Input manual tetap tersedia.'}),P.admin()&&bisaEdit()?el('button',{teks:'Muat / perbarui unit payroll',onclick:()=>hubungkanPayroll(()=>{kosongkan(wadah);halamanBbm(wadah);})}):null);
 const lama=[...D.baris('material_masuk'),...D.baris('material_keluar')].filter(r=>adalahBbm(r)&&r.material.trim().toLowerCase()==='bbm').length;
 if(lama)wadah.append(el('p.bantuan',{teks:`${lama} transaksi lama bernama BBM tetap tersimpan sebagai arsip dan belum dimasukkan ke saldo jenis tertentu. Jenisnya perlu diperiksa sebelum dikoreksi.`}));
}
