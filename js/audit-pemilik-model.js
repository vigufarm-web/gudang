// Usulan audit saja; tidak mengubah transaksi atau menetapkan saldo produksi.
import { norm, unit, qtyBersih } from './pengadaan-model.js?v=8';

const owner = value => {
  const name = String(value || '').trim();
  return !name || norm(name) === 'cabai' ? 'Gudang' : name;
};
export const namaPemilik = owner;

// Aggregate all materials in one pass for dashboards and exports.
export function auditSemuaPemilik(data) {
  const all=new Map(), items=new Map((data.tabel?.sppb_items||[]).map(x=>[String(x.id),x])),docs=new Map((data.tabel?.sppb||[]).map(x=>[String(x.id),x]));
  const get=r=>{const k=norm(r.material)+'|'+unit(r.satuan);if(!all.has(k))all.set(k,{baris:new Map(),penyesuaianBelumDibagi:0});return all.get(k);};
  const add=(r,nama,masuk,keluar)=>{const a=get(r),name=owner(nama),k=norm(name),row=a.baris.get(k)||{divisi:name,masuk:0,keluar:0};row.masuk+=masuk;row.keluar+=keluar;a.baris.set(k,row);};
  for(const r of data.tabel?.material_masuk||[]){if(!r.material||!r.satuan)continue;const item=items.get(String(r.sppb_item_id));add(r,r.pemilik_stok||docs.get(String(item?.sppb_id))?.divisi_pemohon||r.divisi,qtyBersih(data,r),0);}
  for(const r of data.tabel?.material_keluar||[])if(r.material&&r.satuan)add(r,r.pemilik_stok||r.divisi,0,Number(r.qty)||0);
  for(const o of Object.values(data.web?.stokOpname||{}))if(o.status==='Disetujui')for(const r of o.items||[])if(r.material&&r.satuan)get(r).penyesuaianBelumDibagi+=(Number(r.fisik)||0)-(Number(r.sistem)||0);
  for(const r of Object.values(data.web?.koreksiStok||{}))if(r.material&&r.satuan)get(r).penyesuaianBelumDibagi+=Number(r.qty)||0;
  for(const a of all.values()){a.baris=[...a.baris.values()].map(r=>({...r,saldo:r.masuk-r.keluar,perlu_diperiksa:r.masuk-r.keluar < -1e-7}));a.saldoRiwayat=a.baris.reduce((n,r)=>n+r.saldo,0);a.stokFisik=a.saldoRiwayat+a.penyesuaianBelumDibagi;a.perluDiperiksa=Math.abs(a.penyesuaianBelumDibagi)>1e-7||a.baris.some(r=>r.perlu_diperiksa);}
  return all;
}

export function auditPemilik(data, material, satuan) {
  const sama = row => norm(row.material) === norm(material) && unit(row.satuan) === unit(satuan);
  const balances = new Map();
  const add = (name, masuk, keluar) => {
    const nama = owner(name), key = norm(nama);
    const row = balances.get(key) || { divisi: nama, masuk: 0, keluar: 0 };
    row.masuk += masuk; row.keluar += keluar; balances.set(key, row);
  };
  const items = new Map((data.tabel?.sppb_items || []).map(x => [String(x.id), x]));
  const docs = new Map((data.tabel?.sppb || []).map(x => [String(x.id), x]));
  for (const r of data.tabel?.material_masuk || []) {
    if (!sama(r)) continue;
    const item = items.get(String(r.sppb_item_id));
    const divisi = r.pemilik_stok || docs.get(String(item?.sppb_id))?.divisi_pemohon || r.divisi;
    add(divisi, qtyBersih(data, r), 0);
  }
  for (const r of data.tabel?.material_keluar || []) {
    if (sama(r)) add(r.pemilik_stok || r.divisi, 0, Number(r.qty) || 0);
  }
  return [...balances.values()].map(r => ({...r, saldo: r.masuk - r.keluar,
    perlu_diperiksa: r.masuk - r.keluar < -1e-7}));
}

// Opname lama tidak menyebut pemilik. Selisih tetap ditunjukkan terpisah,
// sehingga tidak diam-diam mengubah kepemilikan atau menyembunyikan masalah.
export function auditSaldoFisik(data, material, satuan) {
  const baris = auditPemilik(data, material, satuan);
  const cocok = row => norm(row.material) === norm(material) && unit(row.satuan) === unit(satuan);
  const penyesuaianOpname = Object.values(data.web?.stokOpname || {})
    .filter(o => o.status === 'Disetujui')
    .flatMap(o => o.items || []).filter(cocok)
    .reduce((n, row) => n + (Number(row.fisik) || 0) - (Number(row.sistem) || 0), 0);
  const penyesuaian = penyesuaianOpname + Object.values(data.web?.koreksiStok || {}).filter(cocok).reduce((n,r)=>n+(Number(r.qty)||0),0);
  const saldoRiwayat = baris.reduce((n, row) => n + row.saldo, 0);
  return {baris, saldoRiwayat, penyesuaianBelumDibagi: penyesuaian,
    stokFisik: saldoRiwayat + penyesuaian,
    perluDiperiksa: Math.abs(penyesuaian) > 1e-7 || baris.some(row => row.perlu_diperiksa)};
}

// Saldo usulan riwayat memakai divisi yang tertulis untuk transaksi lama.
// Selisih opname yang belum dibagi ditampung sementara pada Gudang.
export function saldoPemilik(data, material, satuan, nama) {
  const audit = auditSaldoFisik(data, material, satuan);
  const key = norm(owner(nama));
  const saldo = audit.baris.find(r => norm(r.divisi) === key)?.saldo || 0;
  return saldo + (key === 'gudang' ? audit.penyesuaianBelumDibagi : 0);
}

// Prevent edits and concurrent merges from spending the same owner's stock or
// lowering an already-negative legacy balance further. Old discrepancies stay
// visible and do not prevent unrelated changes from being saved.
export function periksaPerubahanSaldo(basis, sekarang) {
  const keys=new Map(), remember=r=>{if(r?.material&&r?.satuan)keys.set(norm(r.material)+'|'+unit(r.satuan),[r.material,r.satuan]);};
  for(const table of ['material_masuk','material_keluar']){
    const before=basis?.tabel?.[table]||[],after=sekarang?.tabel?.[table]||[];
    const old=new Map(before.map(r=>[String(r.id),r])),next=new Map(after.map(r=>[String(r.id),r]));
    for(const id of new Set([...old.keys(),...next.keys()]))if(JSON.stringify(old.get(id))!==JSON.stringify(next.get(id))){remember(old.get(id));remember(next.get(id));}
  }
  for(const area of ['returPenerimaan','stokOpname','koreksiStok']){
    const old=basis?.web?.[area]||{},next=sekarang?.web?.[area]||{};
    for(const id of new Set([...Object.keys(old),...Object.keys(next)]))if(JSON.stringify(old[id])!==JSON.stringify(next[id])){
      for(const r of [old[id],next[id]]){remember(r);for(const item of r?.items||[])remember(item);}
    }
  }
  // A revised requester can change inferred ownership of legacy receipts.
  if(JSON.stringify(basis?.tabel?.sppb||[])!==JSON.stringify(sekarang?.tabel?.sppb||[])||JSON.stringify(basis?.tabel?.sppb_items||[])!==JSON.stringify(sekarang?.tabel?.sppb_items||[])){
    for(const r of [...(basis?.tabel?.material_masuk||[]),...(sekarang?.tabel?.material_masuk||[])])if(r.sppb_item_id&&!r.pemilik_stok)remember(r);
  }
  for(const [material,satuan] of keys.values()){
    if(['solar','pertalite','pertamax'].includes(norm(material)))continue;
    const old=auditSaldoFisik(basis,material,satuan),next=auditSaldoFisik(sekarang,material,satuan);
    const owners=new Set([...old.baris,...next.baris].map(r=>norm(r.divisi)));owners.add('gudang');
    for(const o of owners){const b=saldoPemilik(basis,material,satuan,o),n=saldoPemilik(sekarang,material,satuan,o);
      if(n < Math.min(0,b)-1e-7)throw Error(`Perubahan membuat saldo milik ${o} untuk ${material} bertambah negatif. Periksa penerimaan, pengeluaran dan hasil opname sebelum menyimpan.`);
    }
  }
}
