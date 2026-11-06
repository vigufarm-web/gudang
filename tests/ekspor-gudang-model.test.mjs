import test from 'node:test';
import assert from 'node:assert/strict';
import {susunLaporanPengadaan,pisahBbm} from '../js/ekspor-gudang-model.js';

test('laporan membedakan diterima, menunggu, dan belum dipesan dalam satuan SPPB',()=>{
 const it={id:7,material:'Semen',satuan:'sak',qty_diminta:10};
 const d={tabel:{material_masuk:[{id:1,order_id:'o',sppb_item_id:7,material:'Semen',qty:2,qty_sppb:2,satuan:'sak'}]},web:{pesanan:{o:{id:'o',nomor:'ORD-1',sppb_item_id:7,material:'Semen',qty_order:5,faktor_order:1,satuan_order:'sak',satuan_sppb:'sak'}},returPenerimaan:{},penerimaanLangsung:{}}};
 const r=susunLaporanPengadaan(d,[{no_sppb:'1',items:[it]}]);
 assert.equal(r.item[0].diterima,2);assert.equal(r.item[0].menunggu,3);assert.equal(r.item[0].belum_dipesan,5);
 assert.equal(r.order[0].total_sppb,5);assert.equal(r.penerimaan.length,1);
});
test('order tanpa konversi tidak dilaporkan nol',()=>{
 const it={id:7,material:'Pupuk',satuan:'kg',qty_diminta:10};
 const d={tabel:{material_masuk:[]},web:{pesanan:{o:{id:'o',sppb_item_id:7,qty_order:1,faktor_order:null}},penerimaanLangsung:{}}};
 const r=susunLaporanPengadaan(d,[{no_sppb:'1',items:[it]}]);
 assert.equal(r.item[0].menunggu,null);assert.equal(r.item[0].belum_dipesan,null);
});
test('BBM dipisah tanpa menggabungkan namanya',()=>{
 const r=pisahBbm([{material:'Solar'},{material:'Pertalite'},{material:'Besi'}]);
 assert.deepEqual(r.bbm.map(x=>x.material),['Solar','Pertalite']);assert.equal(r.material.length,1);
});
