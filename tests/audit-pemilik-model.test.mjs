import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPemilik,auditSaldoFisik,auditSemuaPemilik,periksaPerubahanSaldo} from '../js/audit-pemilik-model.js';

test('SPPB menjadi acuan pemohon, histori cabai ke Gudang, minus ditandai', () => {
  const data = {tabel: {sppb:[{id:1,divisi_pemohon:'Pisang'}],sppb_items:[{id:2,sppb_id:1}],
    material_masuk:[{id:10,material:'Bambu',satuan:'Batang',qty:5,divisi:'Gudang',sppb_item_id:2},
      {id:11,material:'Bambu',satuan:'Batang',qty:3,divisi:'Cabai'}],
    material_keluar:[{material:'Bambu',satuan:'Batang',qty:7,divisi:'Pisang'}]},web:{}};
  const before=JSON.stringify(data), result=auditPemilik(data,'bambu','Batang');
  assert.deepEqual(result.find(r=>r.divisi==='Pisang'),{divisi:'Pisang',masuk:5,keluar:7,saldo:-2,perlu_diperiksa:true});
  assert.equal(result.find(r=>r.divisi==='Gudang').saldo,3);
  assert.equal(JSON.stringify(data),before);
});

test('dua pengeluaran bersamaan tidak boleh menghabiskan saldo pemilik yang sama',()=>{
 const base={tabel:{material_masuk:[{id:1,material:'P',satuan:'Kg',qty:10,divisi:'Pisang'}],material_keluar:[]},web:{}};
 const merged=structuredClone(base);merged.tabel.material_keluar=[{id:2,material:'P',satuan:'Kg',qty:6,pemilik_stok:'Pisang',divisi:'Padi'},{id:3,material:'P',satuan:'Kg',qty:6,pemilik_stok:'Pisang',divisi:'Padi'}];
 assert.throws(()=>periksaPerubahanSaldo(base,merged),/bertambah negatif/);
 merged.tabel.material_keluar[1].qty=4;assert.doesNotThrow(()=>periksaPerubahanSaldo(base,merged));
});
test('pengurangan penerimaan dan opname tidak boleh membuat pemilik kekurangan',()=>{
 const base={tabel:{material_masuk:[{id:1,material:'P',satuan:'Kg',qty:10,divisi:'Pisang'}],material_keluar:[{id:2,material:'P',satuan:'Kg',qty:8,divisi:'Pisang'}]},web:{}};
 const changed=structuredClone(base);changed.tabel.material_masuk[0].qty=7;assert.throws(()=>periksaPerubahanSaldo(base,changed),/bertambah negatif/);
 const old=structuredClone(base);old.tabel.material_keluar[0].qty=12;const harmless=structuredClone(old);harmless.tabel.material_keluar[0].qty=11;assert.doesNotThrow(()=>periksaPerubahanSaldo(old,harmless));
});

test('opname disetujui ditampilkan terpisah, pemilik eksplisit tetap dipakai',()=>{
 const d={tabel:{sppb:[{id:1,divisi_pemohon:'Infra'}],sppb_items:[{id:2,sppb_id:1}],
 material_masuk:[{id:10,material:'Bambu',satuan:'Batang',qty:10,sppb_item_id:2,pemilik_stok:'Pisang'}],material_keluar:[]},
 web:{stokOpname:{a:{status:'Disetujui',items:[{material:'Bambu',satuan:'Batang',fisik:8,sistem:10}]},b:{status:'Draf',items:[{material:'Bambu',satuan:'Batang',fisik:0,sistem:10}]}}}};
 const r=auditSaldoFisik(d,'Bambu','Batang');assert.equal(r.baris[0].divisi,'Pisang');
 assert.equal(r.saldoRiwayat,10);assert.equal(r.penyesuaianBelumDibagi,-2);assert.equal(r.stokFisik,8);assert.equal(r.perluDiperiksa,true);
 assert.deepEqual(auditSemuaPemilik(d).get('bambu|batang'),r);
});
