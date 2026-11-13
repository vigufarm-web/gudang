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
