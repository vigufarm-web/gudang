import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../js/pengadaan-model.js?v=8';
import * as D from '../js/data.js?v=8';

const sample=()=>({tabel:{
  master_material:[{id:10,nama:'Primaquat',satuan_default:'Ltr'},{id:11,nama:'Prima-quat',satuan_default:'Liter'}, {id:12,nama:'Pipa 1-2',satuan_default:'Pcs'},{id:13,nama:'Pipa 12',satuan_default:'Pcs'}],
  master_satuan:[{id:1,nama:'Liter'},{id:2,nama:'Ltr'},{id:3,nama:'Pcs'}],
  material_masuk:[{id:1,material:'Prima-quat',satuan:'Liter',qty:20,divisi:'Pisang'},{id:2,material:'Primaquat',satuan:'Ltr',qty:5,divisi:'Padi'}],
  material_keluar:[{id:1,material:'Primaquat',satuan:'Ltr',qty:3,divisi:'Pisang'}],
  sppb:[{id:1,no_sppb:'LAMA',divisi_pemohon:'Pisang'}],sppb_items:[{id:1,sppb_id:1,material:'Primaquat',satuan:'Ltr',qty_diminta:10}]
},web:{}});

test('variasi Primaquat dan Liter dikenali sebagai stok yang sama tanpa mengubah riwayat',()=>{
 D.state.data=sample();const before=structuredClone(D.state.data);
 assert.equal(D.masterDenganNama('master_material','Primaquat').nama,'Prima-quat');
 assert.equal(D.satuanBawaan('primaquat'),'Liter');
 assert.equal(D.satuanMenurutMaterial('primaquat','Ltr'),'Liter');
 assert.equal(D.normalkanSatuan('Ltr'),'Liter');
 assert.deepEqual(D.laporanStok().map(({material,satuan,stok})=>({material,satuan,stok})),[{material:'Prima-quat',satuan:'Liter',stok:22}]);
 assert.equal(D.saldoMilik('Primaquat','Ltr','Pisang'),17);
 assert.equal(D.saldoMilik('Prima-quat','Liter','Padi'),5);
 assert.deepEqual(D.state.data,before);
});
test('SPPB lama memakai master dan satuan stok saat dibuat order',()=>{
 const d=sample();const order=B.susunOrder(d,{sppb_item_id:1,qty_order:10,satuan_order:'Ltr',supplier:'Uji',tanggal:'2026-11-20'},'order-1');
 assert.equal(order.material,'Prima-quat');assert.equal(order.satuan_stok,'Liter');
 assert.equal(order.faktor_order,1);assert.equal(order.faktor_stok,1);
 assert.equal(d.tabel.sppb_items[0].material,'Primaquat');
});
test('alias tidak menyatukan ukuran atau satuan yang berbeda',()=>{
 D.state.data=sample();
 assert.notEqual(D.masterDenganNama('master_material','Pipa 1-2').id,D.masterDenganNama('master_material','Pipa 12').id);
 assert.equal(D.satuanMenurutMaterial('Primaquat','Kg'),'Kg');
 assert.notEqual(B.norm('Prima-quat 276 SL'),B.norm('Primaquat 200 SL'));
 assert.equal(B.samaUnit('Ltr','Liter'),true);assert.equal(B.samaUnit('Kg','Liter'),false);
});
