export const norm=v=>String(v||'').trim().toLowerCase();
export const unit=v=>({ltr:'liter',l:'liter',litre:'liter',liters:'liter',kilogram:'kg',pcs:'buah',pc:'buah',bh:'buah'}[norm(v)]||norm(v));
export const samaUnit=(a,b)=>unit(a)===unit(b);
const num=v=>Number(v)||0;
export const semuaOrder=d=>Object.values(d.web?.pesanan||{});
export const returBaris=(d,id)=>Object.values(d.web?.returPenerimaan||{}).filter(r=>String(r.masuk_id)===String(id)).reduce((n,r)=>n+num(r.qty_stok),0);
export const qtyBersih=(d,r)=>Math.max(0,num(r.qty)-returBaris(d,r.id));
export const qtySppb=(d,r)=>num(r.qty_sppb??r.qty)*(num(r.qty)>0?qtyBersih(d,r)/num(r.qty):0);
export function ringkasOrder(d,o,kecuali=null) {
  const masuk=(d.tabel?.material_masuk||[]).filter(r=>r.order_id===o.id&&String(r.id)!==String(kecuali));
  const diterima=masuk.reduce((n,r)=>n+qtySppb(d,r),0);
  const total=o.faktor_order>0?o.qty_order*o.faktor_order:null;
  const batal=num(o.batal_qty_order)*(o.faktor_order||0);
  return {total,diterima,batal,menunggu:o.ditutup?0:total==null?null:Math.max(0,total-batal-diterima),masuk};
}
export function ringkasItem(d,it,kecualiOrder=null) {
  const daftar=semuaOrder(d).filter(o=>Number(o.sppb_item_id)===Number(it.id)&&o.id!==kecualiOrder);
  const diterima=(d.tabel?.material_masuk||[]).filter(r=>Number(r.sppb_item_id)===Number(it.id)).reduce((n,r)=>n+qtySppb(d,r),0);
  const unknown=daftar.some(o=>ringkasOrder(d,o).menunggu==null && !o.ditutup);
  const menunggu=daftar.reduce((n,o)=>n+(ringkasOrder(d,o).menunggu||0),0);
  return {daftar,diterima,menunggu:unknown?null:menunggu,belum_dipesan:unknown?null:Math.max(0,num(it.qty_diminta)-diterima-menunggu),unknown};
}
export function susunOrder(d,raw,id) {
  const it=d.tabel.sppb_items.find(r=>Number(r.id)===Number(raw.sppb_item_id));
  if(!it)throw Error('Item SPPB tidak ditemukan.');
  const bahan=norm(it.material)==='bbm'?raw.material_stok:it.material;
  if(norm(it.material)==='bbm'&&!['pertalite','pertamax','solar'].includes(norm(bahan)))throw Error('SPPB BBM harus dirinci: pilih Pertalite, Pertamax atau Solar untuk order ini.');
  const master=d.tabel.master_material?.find(r=>norm(r.nama)===norm(bahan));
  const o={...raw,id,sppb_item_id:it.id,material:master?.nama||bahan,satuan_sppb:it.satuan,
    satuan_stok:master?.satuan_default||it.satuan,qty_order:Number(raw.qty_order),
    faktor_order:samaUnit(raw.satuan_order,it.satuan)?1:(raw.faktor_order?Number(raw.faktor_order):null),
    faktor_stok:samaUnit(master?.satuan_default||it.satuan,it.satuan)?1:(raw.faktor_stok?Number(raw.faktor_stok):null)};
  if(!(o.qty_order>0)||!Number.isFinite(o.qty_order)||!o.satuan_order?.trim()||!o.supplier?.trim()||!o.tanggal)throw Error('Tanggal, supplier, jumlah positif dan satuan order wajib diisi.');
  for(const k of ['faktor_order','faktor_stok'])if(o[k]!=null&&(!(o[k]>0)||!Number.isFinite(o[k])))throw Error('Faktor konversi harus positif.');
  if(samaUnit(o.satuan_order,o.satuan_stok)&&o.faktor_order&&o.faktor_stok&&Math.abs(o.faktor_order*o.faktor_stok-1)>1e-6)throw Error('Konversi satuan order dan stok yang sama harus saling berbalikan.');
  if((!samaUnit(o.satuan_order,o.satuan_sppb)&&o.faktor_order||!samaUnit(o.satuan_stok,o.satuan_sppb)&&o.faktor_stok)&&!o.sumber_konversi?.trim())throw Error('Isi sumber konversi, misalnya label kemasan atau spesifikasi supplier.');
  if(o.eta&&o.eta<o.tanggal)throw Error('Perkiraan datang tidak boleh sebelum tanggal order.');
  const r=ringkasItem(d,it,id),total=o.faktor_order?o.qty_order*o.faktor_order:null;
  if((r.unknown||(total!=null&&total>r.belum_dipesan+1e-7))&&!o.alasan_lebih?.trim())throw Error('Order berpotensi melebihi sisa kebutuhan atau ada order tanpa konversi. Periksa lalu isi alasan pengecualian jika tetap dilanjutkan.');
  return o;
}
export function susunPenerimaan(d,raw,kecuali=null) {
  const o=d.web?.pesanan?.[raw.order_id];
  if(!o)throw Error('Order tidak ditemukan.');
  if(o.ditutup)throw Error('Sisa order sudah ditutup.');
  if(!(o.faktor_order>0&&o.faktor_stok>0))throw Error('Lengkapi konversi order dan satuan stok sebelum menerima barang.');
  const q=Number(raw.qty_terima);if(!(q>0)||!Number.isFinite(q))throw Error('Jumlah diterima harus positif.');
  let basis;
  if(samaUnit(raw.satuan_terima,o.satuan_sppb))basis=q;
  else if(samaUnit(raw.satuan_terima,o.satuan_order))basis=q*o.faktor_order;
  else if(samaUnit(raw.satuan_terima,o.satuan_stok))basis=q/o.faktor_stok;
  else throw Error('Satuan penerimaan tidak sesuai order.');
  if(basis>ringkasOrder(d,o,kecuali).menunggu+1e-7&&!raw.alasan_lebih?.trim())throw Error('Penerimaan melebihi sisa order. Periksa jumlah atau isi alasan pengecualian.');
  return {...raw,material:o.material,satuan:o.satuan_stok,qty:basis*o.faktor_stok,qty_sppb:basis,
    sppb_item_id:o.sppb_item_id,divisi:'Gudang',sumber:o.supplier,
    snapshot_konversi:{faktor_order:o.faktor_order,faktor_stok:o.faktor_stok,satuan_order:o.satuan_order,satuan_sppb:o.satuan_sppb,satuan_stok:o.satuan_stok}};
}
