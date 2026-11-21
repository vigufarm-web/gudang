import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/data.js?v=8';
import * as W from '../js/workflow.js?v=8';
import {periksaPerubahanSaldo} from '../js/audit-pemilik-model.js';
globalThis.sessionStorage={getItem:()=>JSON.stringify({id:'u',hash:'test'})};
globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
function setup(){D.state.data={tabel:{master_material:[{id:1,nama:'Himaquat',satuan_default:'Liter'}],master_divisi:[],master_satuan:[],master_blok:[],sppb:[],sppb_items:[],material_masuk:[{id:1,material:'Himaquat',satuan:'Liter',qty:20,divisi:'Padi'}],material_keluar:[{id:1,material:'Himaquat',satuan:'Liter',qty:80.01,divisi:'Cabai'}]},web:{pengguna:{u:{nama:'Uji',admin:true,aktif:true,sandi:{hash:'test'}}}}};}
test('koreksi mencatat alasan dan tidak mengubah stok Padi atau membuat opname fisik',()=>{setup();const basis=structuredClone(D.state.data);const r=W.koreksiSaldoGudang('Himaquat','Liter','Salah input menurut admin');assert.equal(r.qty,80.01);assert.equal(D.saldoMilik('Himaquat','Liter','Gudang'),0);assert.equal(D.saldoMilik('Himaquat','Liter','Padi'),20);assert.equal(D.laporanStok()[0].stok,20);assert.equal(W.opname().length,0);W.validasiSimpanWorkflow(basis);periksaPerubahanSaldo(basis,D.state.data);assert.throws(()=>W.koreksiSaldoGudang('Himaquat','Liter','Ulang'),/tidak negatif/);});
test('dua koreksi bersamaan tidak dapat menambahkan stok dua kali',()=>{setup();const basis=structuredClone(D.state.data);W.koreksiSaldoGudang('Himaquat','Liter','Koreksi satu');const lokal=structuredClone(D.state.data);D.state.data=structuredClone(basis);W.koreksiSaldoGudang('Himaquat','Liter','Koreksi dua');const remote=structuredClone(D.state.data);D.state.data=D.gabungTiga(basis,lokal,remote);assert.throws(()=>W.validasiSimpanWorkflow(remote),/Saldo acuan koreksi berubah/);});
test('ACC dan koreksi negatif akibat opname dapat disimpan bersama tanpa mengubah saldo pemilik lain',()=>{
 setup();D.state.data.tabel.material_keluar=[];D.state.data.tabel.material_masuk[0].qty=8;
 const opname=W.buatOpname(['Himaquat'],'2026-11-21');
 W.isiOpname(opname.id,{[opname.items[0].id]:{fisik:7.5,alasan:'Selisih hitung'}},true);
 const basis=structuredClone(D.state.data);
 W.putusOpname(opname.id,true);
 const koreksi=W.koreksiSaldoGudang('Himaquat','Liter','Nolkan saldo Gudang sesuai instruksi admin');
 assert.equal(koreksi.qty,0.5);assert.equal(D.saldoMilik('Himaquat','Liter','Gudang'),0);assert.equal(D.saldoMilik('Himaquat','Liter','Padi'),8);
 W.validasiSimpanWorkflow(basis);periksaPerubahanSaldo(basis,D.state.data);
 const dicampur=structuredClone(D.state.data);dicampur.web.koreksiStok[koreksi.id].qty=1;
 D.state.data=dicampur;assert.throws(()=>W.validasiSimpanWorkflow(basis),/Saldo acuan koreksi berubah/);
});
test('penyesuaian lama yang tidak ada dalam acuan tetap harus dihitung ulang',()=>{
 setup();D.state.data.tabel.material_keluar=[];D.state.data.tabel.material_masuk[0].qty=8;
 const opname=W.buatOpname(['Himaquat'],'2026-11-21');
 W.isiOpname(opname.id,{[opname.items[0].id]:{fisik:7.5,alasan:'Selisih'}},true);
 const basis=structuredClone(D.state.data);W.putusOpname(opname.id,true);
 const correction=W.koreksiSaldoGudang('Himaquat','Liter','Penyesuaian');
 basis.web.koreksiStok={[correction.id]:structuredClone(correction)};
 assert.throws(()=>W.validasiSimpanWorkflow(basis),/penyesuaian opname lain/);
});
