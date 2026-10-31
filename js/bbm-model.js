import {bagiProporsi} from './blok-model.js?v=8';
export const JENIS_BBM=['Solar','Pertalite','Pertamax'];
const norm=v=>String(v??'').trim().toLowerCase();
export const jenisBbm=v=>JENIS_BBM.find(n=>norm(n)===norm(v))||'';
export const adalahBbm=r=>!!jenisBbm(r?.material)||norm(r?.material)==='bbm';
export function unitDariPayroll(data){
 if(data?.aplikasi!=='AlatBerat'||!Array.isArray(data?.tabel?.units))throw Error('Pilih data Alat Berat & Kendaraan dari payroll.');
 const ids=new Set();
 return data.tabel.units.filter(r=>!r.deleted_at&&r.aktif!==false&&Number(r.aktif??1)!==0).map(r=>{
  const id=String(r.id??'');if(!id||ids.has(id)||!String(r.kode||'').trim())throw Error('Referensi unit payroll tidak valid atau ID ganda.');ids.add(id);
  return {id,kode:String(r.kode).trim(),nama:String(r.nama||'').trim(),kategori:String(r.kategori||''),no_polisi:String(r.no_polisi||'')};
 });
}
export const labelUnit=r=>[r.kode,r.nama,r.no_polisi].filter(Boolean).join(' — ');

// One fuel issue may be allocated to multiple blocks/locations, or no location.
export function susunPembagianBbm({total,mode='kosong',alokasi=[],divisi},masterBlok=[]){
 const qty=Number(total);if(!Number.isFinite(qty)||qty<=0)throw Error('Jumlah BBM harus positif.');
 if(mode==='kosong')return [{blok:'',qty,blok_id:null,luas_acuan_ha:null}];
 if(!['manual','luas'].includes(mode)||!alokasi.length)throw Error('Pilih minimal satu blok/lokasi atau gunakan Tanpa blok / lokasi.');
 const seen=new Set();const rows=alokasi.map(a=>{
  const master=a.blok_id!=null?masterBlok.find(m=>String(m.id)===String(a.blok_id)):masterBlok.find(m=>norm(m.nama)===norm(String(a.blok||'').replace(/\s+/g,' ').trim()));
  if((a.blok_id!=null&&!master)||(master&&norm(master.divisi)!==norm(divisi)))throw Error('Blok harus berada pada divisi pemakai yang dipilih.');
  const blok=String(master?.nama??a.blok??'').replace(/\s+/g,' ').trim();if(!blok||seen.has(norm(blok)))throw Error('Nama blok/lokasi harus diisi dan tidak boleh berulang.');seen.add(norm(blok));
  return {blok,blok_id:master?.id??null,luas_acuan_ha:master?Number(master.luas_ha)||0:null,qty:Number(a.qty)};
 });
 if(mode==='luas'){
  if(rows.some(r=>r.blok_id===null))throw Error('Proporsi luas hanya untuk Master Blok. Lokasi lain memakai pembagian manual.');
  bagiProporsi(qty,rows.map(r=>r.luas_acuan_ha),2).forEach((q,i)=>rows[i].qty=q);
 }
 if(rows.some(r=>!Number.isFinite(r.qty)||r.qty<=0))throw Error('Jumlah tiap blok/lokasi harus lebih dari nol.');
 const sum=rows.reduce((s,r)=>s+r.qty,0);if(Math.abs(sum-qty)>1e-7)throw Error('Total pembagian blok/lokasi harus sama dengan jumlah BBM keluar.');
 return rows;
}
