import test from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../js/hak.js';
const user=(hak,divisi=['GIS'])=>({aktif:true,peran:'lihat',hak,divisi});
test('SPPB-only staff can create requests without inputting warehouse or fuel transactions',()=>{
 const p=user({sppb:true},['GIS','Pisang']);const find=()=>({divisi_pemohon:'GIS'});
 assert.equal(H.bolehHalaman(p,'sppb'),true);assert.equal(H.bolehHalaman(p,'masuk'),false);assert.equal(H.bolehHalaman(p,'keluar'),false);assert.equal(H.bolehHalaman(p,'bbm'),false);assert.equal(H.bolehHalaman(p,'pusat'),false);assert.equal(H.bolehHalaman(p,'dashboard'),true);
 assert.equal(H.bolehTransaksi(p,'tambah','sppb',null,{divisi_pemohon:'GIS'},find),true);
 assert.equal(H.bolehTransaksi(p,'tambah','sppb_items',null,{sppb_id:3},find),true);
 assert.equal(H.bolehTransaksi(p,'tambah','sppb',null,{divisi_pemohon:'Infra'},find),false);
 assert.equal(H.bolehTransaksi(p,'ubah','sppb',{divisi_pemohon:'GIS'},{divisi_pemohon:'GIS'},find),false);
 assert.equal(H.bolehTransaksi(p,'tambah','material_masuk',null,{divisi:'GIS'},find),false);
});
test('approval and order roles do not get full menus',()=>{
 const head=user({kepala:true},['Infra','GIS']);assert.equal(H.bolehHalaman(head,'sppb'),true);assert.equal(H.bolehHalaman(head,'persetujuan'),true);assert.equal(H.bolehHalaman(head,'masuk'),false);assert.equal(H.bolehHalaman(head,'pusat'),false);
 const order=user({order:true});assert.equal(H.bolehHalaman(order,'pusat'),true);assert.equal(H.bolehHalaman(order,'persetujuan'),false);assert.equal(H.bolehHalaman(order,'pengguna'),false);
 const store=user({gudang:true,input:true},['Gudang']);assert.equal(H.bolehHalaman(store,'masuk'),true);assert.equal(H.bolehHalaman(store,'keluar'),true);assert.equal(H.bolehHalaman(store,'bbm'),false);assert.equal(H.bolehHalaman(store,'pengguna'),false);
});
