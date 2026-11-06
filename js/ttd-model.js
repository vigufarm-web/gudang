const normal=v=>String(v||'').trim().toLocaleLowerCase('id-ID');
// Keputusan baru mengikat pengguna dan versi tanda tangan pada waktu ACC.
// Keputusan lama hanya memakai ttd pejabat jika identitasnya cocok persis.
export function gambarUntukAcc(data,acc,pejabat){
 if(!acc||acc.status!=='disetujui'||acc.sumber==='manual')return '';
 if(Object.hasOwn(acc,'oleh_id')){
  const versi=acc.ttd_versi&&data.web?.ttdVersi?.[acc.ttd_versi];
  return versi&&versi.pemilik_id===acc.oleh_id?versi.gambar||'':'';
 }
 return normal(acc.oleh)&&normal(acc.oleh)===normal(pejabat?.nama)?pejabat?.ttd||'':'';
}
export function gambarUntukPembuat(data,s,namaCetak){
 if(!s?.dibuat_oleh_id||normal(namaCetak)!==normal(s.dibuat_oleh))return '';
 return gambarUntukAcc(data,{status:'disetujui',oleh_id:s.dibuat_oleh_id,ttd_versi:s.dibuat_ttd_versi},null);
}
