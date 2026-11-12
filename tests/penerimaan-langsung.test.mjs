import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../js/pengadaan-model.js';
import * as D from '../js/data.js?v=8';
const order={id:'ord-1',sppb_item_id:1,material:'Semen',supplier:'Supplier',qty_order:10,satuan_order:'sak',satuan_sppb:'sak',satuan_stok:'sak',faktor_order:1,faktor_stok:1};
const sample=()=>({tabel:{master_material:[{id:1,nama:'Semen',satuan_default:'sak'}],material_masuk:[{id:1,order_id:'ord-1',sppb_item_id:1,material:'Semen',satuan:'sak',qty:2,qty_sppb:2}],material_keluar:[],sppb:[{id:1,no_sppb:'UJI'}],sppb_items:[{id:1,sppb_id:1,material:'Semen',satuan:'sak',qty_diminta:10}]},web:{pengguna:{u:{nama:'Uji',admin:true,aktif:true,sandi:{hash:'fixture'}}},pesanan:{'ord-1':{...order}},accSppb:{'1':{kepala:{status:'disetujui'},ktu:{status:'disetujui'}}}}});
globalThis.sessionStorage={getItem:()=>JSON.stringify({id:'u',hash:'fixture'})};
globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
test('penerimaan langsung updates order and SPPB but never warehouse stock',()=>{
 D.state.data=sample();D.state.password='';const before=D.laporanStok()[0].stok;
 const direct=D.simpanPenerimaanLangsung({order_id:'ord-1',tanggal:'2026-11-04',qty_terima:3,satuan_terima:'sak',penerima:'Penerima uji',lokasi_tujuan:'Padi'});
 assert.equal(D.laporanStok()[0].stok,before);assert.equal(D.realisasiItem(1),5);assert.equal(B.ringkasOrder(D.state.data,order).menunggu,5);assert.equal(B.ringkasItem(D.state.data,D.state.data.tabel.sppb_items[0]).diterima,5);
 assert.equal(direct.langsung,true);assert.equal(direct.lokasi_tujuan,'Padi');assert.equal(D.state.data.tabel.material_masuk.length,1);
 assert.throws(()=>D.simpanPenerimaanLangsung({order_id:'ord-1',tanggal:'2026-11-04',qty_terima:6,satuan_terima:'sak',penerima:'Uji',lokasi_tujuan:'Padi'}),/melebihi/);
 assert.throws(()=>D.simpanPenerimaanLangsung({order_id:'ord-1',tanggal:'2026-11-04',qty_terima:1,satuan_terima:'sak',penerima:'',lokasi_tujuan:'Padi'}),/penerima/);
 D.simpanPenerimaanLangsung({order_id:'ord-1',tanggal:'2026-11-04',qty_terima:4,satuan_terima:'sak',penerima:'Uji',lokasi_tujuan:'Padi'},direct.id);
 assert.equal(D.realisasiItem(1),6);assert.equal(D.laporanStok()[0].stok,before);assert.ok(Object.values(D.state.data.web.jejakMutasi).some(x=>x.aksi==='Koreksi penerimaan langsung'));
});
test('concurrent revisions of the same direct receipt cannot overwrite each other',()=>{
 const base=sample();base.web.penerimaanLangsung={x:{id:'x',qty:1}};const local=structuredClone(base),remote=structuredClone(base);local.web.penerimaanLangsung.x.qty=2;remote.web.penerimaanLangsung.x.qty=3;
 assert.throws(()=>D.gabungTiga(base,local,remote),/Penerimaan langsung yang sama/);
});
test('pemasok tercatat; pemasok berbeda dan konversi belum lengkap tidak mengubah stok',()=>{
 D.state.data=sample();D.state.password='';const before=D.laporanStok()[0].stok;
 const raw={order_id:'ord-1',tanggal:'2026-11-04',qty_terima:3,satuan_terima:'sak'};
 assert.throws(()=>D.tambah('material_masuk',{...raw,supplier_aktual:'Pemasok lain'}),/Pemasok berbeda/);
 assert.equal(D.laporanStok()[0].stok,before);assert.equal(B.ringkasOrder(D.state.data,order).menunggu,8);
 D.state.data.web.pesanan['ord-1'].faktor_stok=null;
 assert.throws(()=>D.tambah('material_masuk',{...raw,supplier_aktual:'Supplier'}),/konversi/);
 D.state.data.web.pesanan['ord-1'].faktor_stok=1;
 const receipt=D.tambah('material_masuk',{...raw,supplier_aktual:'Supplier'});
 assert.equal(receipt.supplier_aktual,'Supplier');assert.equal(receipt.sumber,'Supplier');
 assert.equal(D.laporanStok()[0].stok,before+3);assert.equal(B.ringkasOrder(D.state.data,order).menunggu,5);
});
