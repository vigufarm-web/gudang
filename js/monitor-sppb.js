export function ringkasProgres(items) {
  const aktif=items.filter(it=>!it.batal);
  const selesai=aktif.filter(it=>Number(it.sisa)<=1e-9).length;
  const persen=aktif.length ? Math.round(aktif.reduce((n,it)=>n+Math.min(1,Math.max(0,(Number(it.realisasi)||0)/(Number(it.qty_diminta)||1))),0)/aktif.length*100) : 0;
  return {total:aktif.length,selesai,persen,diterima:aktif.some(it=>Number(it.realisasi)>0)};
}
export function tahapMonitoring(s,full,adaOrder) {
  const p=ringkasProgres(s.items);
  if(p.total>0 && p.selesai===p.total)return 'selesai';
  if(!full)return 'persetujuan';
  return p.diterima || adaOrder ? 'penerimaan' : 'order';
}
export function cocokFilter(s,{kata='',divisi='',dari='',sampai='',tahap='semua',status='semua'}={}) {
  if(divisi && s.divisi_pemohon!==divisi)return false;
  if(dari && String(s.tanggal)<dari)return false;
  if(sampai && String(s.tanggal)>sampai)return false;
  if(tahap!=='semua' && s.monitor!==tahap)return false;
  if(status!=='semua' && s.status_keseluruhan!==status)return false;
  const q=kata.trim().toLocaleLowerCase('id');
  return !q || [s.no_sppb,s.divisi_pemohon,s.keterangan,...s.items.map(it=>it.material)].join(' ').toLocaleLowerCase('id').includes(q);
}
