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
