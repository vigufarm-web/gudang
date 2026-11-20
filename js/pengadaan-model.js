// Alias disatukan hanya untuk barang yang telah dikonfirmasi sama.
// Jangan menghapus tanda baca pada semua nama: ukuran/varian bisa berbeda.
export const norm=v=>{const n=String(v||'').trim().toLowerCase();return /^prima[\s-]*quat$/.test(n)?'primaquat':n;};
export function masterMaterial(rows,nama){
  const key=norm(nama),matches=(rows||[]).filter(r=>norm(r.nama)===key);
  if(!key)return null;
  if(key==='primaquat')return matches.find(r=>String(r.nama||'').trim().toLowerCase()==='prima-quat')||matches[0]||null;
  return matches[0]||null;
}
export const unit=v=>({ltr:'liter',l:'liter',litre:'liter',liters:'liter',kilogram:'kg',pcs:'buah',pc:'buah',bh:'buah'}[norm(v)]||norm(v));
export const samaUnit=(a,b)=>unit(a)===unit(b);
const num=v=>Number(v)||0;
export const semuaOrder=d=>Object.values(d.web?.pesanan||{});
export const semuaPenerimaanLangsung=d=>Object.values(d.web?.penerimaanLangsung||{});
export const returBaris=(d,id)=>Object.values(d.web?.returPenerimaan||{}).filter(r=>String(r.masuk_id)===String(id)).reduce((n,r)=>n+num(r.qty_stok),0);
export const qtyBersih=(d,r)=>Math.max(0,num(r.qty)-returBaris(d,r.id));
export const qtySppb=(d,r)=>num(r.qty_sppb??r.qty)*(num(r.qty)>0?qtyBersih(d,r)/num(r.qty):0);
export function periksaNamaDatang(material,raw) {
  const nama=String(raw.nama_barang_datang==null?material:raw.nama_barang_datang).trim();
  if(!nama)throw Error('Nama barang yang diterima wajib diisi.');
  if(nama.toLocaleLowerCase('id-ID')!==String(material||'').trim().toLocaleLowerCase('id-ID')&&raw.nama_barang_sama!==true)
    throw Error('Nama barang yang datang berbeda dari material stok. Periksa spesifikasi dan centang konfirmasi jika benar barang yang sama.');
  return nama;
}
export function ringkasOrder(d,o,kecuali=null) {
  const masuk=[...(d.tabel?.material_masuk||[]),...semuaPenerimaanLangsung(d)].filter(r=>r.order_id===o.id&&String(r.id)!==String(kecuali));
  const diterima=masuk.reduce((n,r)=>n+qtySppb(d,r),0);
  const total=o.faktor_order>0?o.qty_order*o.faktor_order:null;
  const batal=num(o.batal_qty_order)*(o.faktor_order||0);
  return {total,diterima,batal,menunggu:o.ditutup?0:total==null?null:Math.max(0,total-batal-diterima),masuk};
}
export function ringkasItem(d,it,kecualiOrder=null) {
  const daftar=semuaOrder(d).filter(o=>Number(o.sppb_item_id)===Number(it.id)&&o.id!==kecualiOrder);
  const diterima=[...(d.tabel?.material_masuk||[]),...semuaPenerimaanLangsung(d)].filter(r=>Number(r.sppb_item_id)===Number(it.id)).reduce((n,r)=>n+qtySppb(d,r),0);
  const unknown=daftar.some(o=>ringkasOrder(d,o).menunggu==null && !o.ditutup);
  const menunggu=daftar.reduce((n,o)=>n+(ringkasOrder(d,o).menunggu||0),0);
  return {daftar,diterima,menunggu:unknown?null:menunggu,belum_dipesan:unknown?null:Math.max(0,num(it.qty_diminta)-diterima-menunggu),unknown};
}
export function susunOrder(d,raw,id) {
  const it=d.tabel.sppb_items.find(r=>Number(r.id)===Number(raw.sppb_item_id));
  if(!it)throw Error('Item SPPB tidak ditemukan.');
  const bahan=String(raw.material_stok==null?it.material:raw.material_stok).trim();
  if(norm(it.material)==='bbm'&&!['pertalite','pertamax','solar'].includes(norm(bahan)))throw Error('SPPB BBM harus dirinci: pilih Pertalite, Pertamax atau Solar untuk order ini.');
  const master=masterMaterial(d.tabel.master_material,bahan);
  if(!master)throw Error('Pilih material stok yang sudah ada di Master Material. Jika benar-benar baru, minta admin menambahkannya dahulu.');
  if(norm(it.material)!=='bbm' && norm(master.nama)!==norm(it.material) && raw.sama_barang_disetujui!==true)
    throw Error('Nama SPPB dan material stok berbeda. Pastikan barang dan spesifikasinya sama, lalu centang konfirmasi.');
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
  const master=masterMaterial(d.tabel?.master_material,o.material);
  if(kecuali==null&&!master)throw Error('Material order belum ada di Master Material. Minta petugas Order memilih material stok yang benar sebelum penerimaan.');
  if(kecuali==null&&master?.satuan_default&&!samaUnit(master.satuan_default,o.satuan_stok))throw Error('Satuan stok pada order berbeda dari Master Material. Minta petugas Order memeriksa konversi sebelum penerimaan.');
  const namaDatang=periksaNamaDatang(o.material,raw);
  const item=(d.tabel?.sppb_items||[]).find(x=>String(x.id)===String(o.sppb_item_id));
  const sppb=item&&(d.tabel?.sppb||[]).find(x=>String(x.id)===String(item.sppb_id));
  // Penerimaan lama tidak dialokasikan ulang saat dikoreksi; hanya penerimaan
  // baru menyimpan divisi pemohon sebagai informasi kepemilikan.
  let pemilik=['solar','pertalite','pertamax'].includes(norm(o.material))?'':kecuali==null ? String(sppb?.divisi_pemohon||'').trim() : raw.pemilik_stok;
  if(norm(pemilik)==='cabai')pemilik='Gudang';
  const supplierAktual=String(raw.supplier_aktual??o.supplier??'').trim();
  if(!supplierAktual)throw Error('Isi pemasok yang menjual barang.');
  if(norm(supplierAktual)!==norm(o.supplier))throw Error('Pemasok berbeda dari order. Minta petugas Order koreksi order yang belum diterima, atau tutup sisa dan buat order baru agar harga dan FIFO benar.');
  if(o.ditutup)throw Error('Sisa order sudah ditutup.');
  if(!(o.faktor_order>0&&o.faktor_stok>0))throw Error('Lengkapi konversi order dan satuan stok sebelum menerima barang.');
  const q=Number(raw.qty_terima);if(!(q>0)||!Number.isFinite(q))throw Error('Jumlah diterima harus positif.');
  let basis;
  if(samaUnit(raw.satuan_terima,o.satuan_sppb))basis=q;
  else if(samaUnit(raw.satuan_terima,o.satuan_order))basis=q*o.faktor_order;
  else if(samaUnit(raw.satuan_terima,o.satuan_stok))basis=q/o.faktor_stok;
  else throw Error('Satuan penerimaan tidak sesuai order.');
  if(basis>ringkasOrder(d,o,kecuali).menunggu+1e-7&&!raw.alasan_lebih?.trim())throw Error('Penerimaan melebihi sisa order. Periksa jumlah atau isi alasan pengecualian.');
  return {...raw,nama_barang_datang:namaDatang,material:o.material,satuan:o.satuan_stok,qty:basis*o.faktor_stok,qty_sppb:basis,
    sppb_item_id:o.sppb_item_id,divisi:'Gudang',...(pemilik?{pemilik_stok:pemilik}:{}),sumber:supplierAktual,supplier_aktual:supplierAktual,
    snapshot_konversi:{faktor_order:o.faktor_order,faktor_stok:o.faktor_stok,satuan_order:o.satuan_order,satuan_sppb:o.satuan_sppb,satuan_stok:o.satuan_stok}};
}
