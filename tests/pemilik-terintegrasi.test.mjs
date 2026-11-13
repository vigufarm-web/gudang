import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/data.js?v=8';

globalThis.sessionStorage={getItem:()=>JSON.stringify({id:'u',hash:'test'})};
globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const setup=()=>{
 D.state.data={tabel:{master_material:[{id:1,nama:'Pupuk',satuan_default:'Kg'}],master_divisi:[{id:1,nama:'Pisang'},{id:2,nama:'Padi'}],master_satuan:[{id:1,nama:'Kg'}],master_blok:[],sppb:[],sppb_items:[],material_masuk:[{id:1,material:'Pupuk',satuan:'Kg',qty:10,divisi:'Pisang'},{id:2,material:'Pupuk',satuan:'Kg',qty:4,divisi:'Padi'}],material_keluar:[]},web:{pengguna:{u:{nama:'Uji',admin:true,aktif:true,sandi:{hash:'test'}}}}};
};
const keluar=(qty,owner='Pisang')=>({tanggal:'2026-11-13',material:'Pupuk',satuan:'Kg',qty,divisi:'Padi',pemilik_stok:owner,diambil_oleh:'Uji',keperluan:'Pemakaian'});
test('pengeluaran lintas divisi mengurangi saldo pemilik, bukan pemakai',()=>{
 setup();const r=D.tambah('material_keluar',keluar(3));assert.equal(r.pemilik_stok,'Pisang');
 assert.equal(D.saldoMilik('Pupuk','Kg','Pisang'),7);assert.equal(D.saldoMilik('Pupuk','Kg','Padi'),4);assert.equal(D.laporanStok()[0].stok,11);
 assert.throws(()=>D.tambah('material_keluar',keluar(8)),/Stok milik Pisang tidak cukup/);
});
test('total banyak blok tidak boleh menghabiskan saldo pemilik yang sama dua kali',()=>{
 setup();const sebelum=structuredClone(D.state.data.tabel.material_keluar);
 assert.throws(()=>D.tambahBatchKeluar([keluar(6),keluar(6)]),/Total pembagian melebihi stok milik Pisang/);
 assert.deepEqual(D.state.data.tabel.material_keluar,sebelum);
});
test('penerimaan manual tanpa SPPB menyimpan pemilik dan fisiknya tetap Gudang',()=>{
 setup();const r=D.tambah('material_masuk',{tanggal:'2026-11-13',material:'Pupuk',satuan:'Kg',qty:2,pemilik_stok:'Padi'});
 assert.equal(r.pemilik_stok,'Padi');assert.equal(r.divisi,'Gudang');assert.equal(D.saldoMilik('Pupuk','Kg','Padi'),6);
});
