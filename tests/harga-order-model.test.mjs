import test from 'node:test';
import assert from 'node:assert/strict';
import {hitungHargaOrder,biayaFifo} from '../js/harga-order-model.js';

test('harga satuan dan harga total menghasilkan nilai yang sama',()=>{
  assert.deepEqual(hitungHargaOrder({jumlah:5,cara:'satuan',nilai:20000}),{hargaSatuan:20000,totalBarang:100000});
  assert.deepEqual(hitungHargaOrder({jumlah:5,cara:'total',nilai:100000}),{hargaSatuan:20000,totalBarang:100000});
});
const norm=x=>String(x||'').toLowerCase();
test('FIFO membagi biaya berdasar jumlah per blok dan ongkir per unit',()=>{
 const d={tabel:{material_masuk:[{id:1,tanggal:'2026-01-01',material:'Pupuk',satuan:'kg',qty:10,order_id:'a'},{id:2,tanggal:'2026-01-02',material:'Pupuk',satuan:'kg',qty:10,order_id:'b'}],material_keluar:[{id:3,tanggal:'2026-01-03',material:'Pupuk',satuan:'kg',qty:6,blok:'A'},{id:4,tanggal:'2026-01-03',material:'Pupuk',satuan:'kg',qty:8,blok:'B'}]},web:{pesanan:{a:{qty_order:10,faktor_order:1,faktor_stok:1,harga_total_barang:100,ongkir_status:'terpisah',ongkir:20},b:{qty_order:10,faktor_order:1,faktor_stok:1,harga_total_barang:200,ongkir_status:'termasuk'}}}};
 d.tabel.material_keluar[1].tanggal='2026-01-04';const r=biayaFifo(d,norm,norm);assert.equal(r[0].nilai,72);assert.equal(r[1].nilai,128);assert.equal(r[1].qtyBelum,0);
});
test('harga lama tidak diketahui dan tanggal penerimaan ambigu tidak dianggap nol',()=>{
 const d={tabel:{material_masuk:[{id:1,tanggal:'2026-01-01',material:'P',satuan:'kg',qty:10}],material_keluar:[{id:2,tanggal:'2026-01-02',material:'P',satuan:'kg',qty:2}]},web:{}};
 let [r]=biayaFifo(d,norm,norm);assert.equal(r.qtyBelum,2);assert.match(r.alasan,/Harga/);
 d.tabel.material_keluar[0].tanggal='2026-01-01';[r]=biayaFifo(d,norm,norm);assert.equal(r.nilai,null);assert.match(r.alasan,/urutan/);
});
test('retur dan opname tidak menghasilkan biaya pasti palsu',()=>{
 const d={tabel:{material_masuk:[{id:1,tanggal:'2026-01-01',material:'P',satuan:'kg',qty:10,order_id:'a'}],material_keluar:[{id:2,tanggal:'2026-01-02',material:'P',satuan:'kg',qty:2}]},web:{pesanan:{a:{qty_order:10,faktor_order:1,faktor_stok:1,harga_total_barang:100,ongkir_status:'termasuk'}},returPenerimaan:{r:{material:'P',satuan:'kg',masuk_id:1,qty_stok:1}}}};
 assert.equal(biayaFifo(d,norm,norm)[0].nilai,null);
 delete d.web.returPenerimaan;d.web.stokOpname={x:{status:'Disetujui',items:[{material:'P',satuan:'kg',fisik:8,sistem:10}]}};
 assert.equal(biayaFifo(d,norm,norm)[0].nilai,null);
});
test('harga per unit stok mengikuti konversi kemasan',()=>{
 const d={tabel:{material_masuk:[{id:1,tanggal:'2026-01-01',material:'P',satuan:'kg',qty:20,order_id:'a'}],material_keluar:[{id:2,tanggal:'2026-01-02',material:'P',satuan:'kg',qty:4}]},web:{pesanan:{a:{qty_order:2,faktor_order:10,faktor_stok:1,harga_total_barang:200000,ongkir_status:'termasuk'}}}};
 assert.equal(biayaFifo(d,norm,norm)[0].nilai,40000);
});
test('FIFO mengikuti pemilik stok, termasuk pemakaian lintas divisi',()=>{
 const order=(harga)=>({qty_order:10,faktor_order:1,faktor_stok:1,harga_total_barang:harga,ongkir_status:'termasuk'});
 const d={tabel:{material_masuk:[{id:1,tanggal:'2026-01-01',material:'P',satuan:'kg',qty:10,order_id:'a',pemilik_stok:'Pisang'},{id:2,tanggal:'2026-01-02',material:'P',satuan:'kg',qty:10,order_id:'b',pemilik_stok:'Padi'}],material_keluar:[{id:3,tanggal:'2026-01-03',material:'P',satuan:'kg',qty:2,divisi:'Pisang',pemilik_stok:'Padi'}]},web:{pesanan:{a:order(100),b:order(200)}}};
 assert.equal(biayaFifo(d,norm,norm)[0].nilai,40);
});
test('harga belum diisi bukan nol',()=>{
  assert.deepEqual(hitungHargaOrder({jumlah:5,cara:'satuan',nilai:''}),{hargaSatuan:null,totalBarang:null});
  assert.deepEqual(hitungHargaOrder({jumlah:5,cara:'satuan',nilai:0}),{hargaSatuan:0,totalBarang:0});
});
test('jumlah dan harga tidak sah ditolak',()=>{
  assert.throws(()=>hitungHargaOrder({jumlah:0,cara:'total',nilai:1}));
  assert.throws(()=>hitungHargaOrder({jumlah:1,cara:'satuan',nilai:-1}));
  assert.throws(()=>hitungHargaOrder({jumlah:1,cara:'x',nilai:1}));
});
