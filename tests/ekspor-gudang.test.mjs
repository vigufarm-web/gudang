import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/data.js?v=8';
import {siapkanLaporan} from '../js/ekspor-gudang.js';
import {buatXlsx} from '../js/xlsx-tulis.js';
globalThis.sessionStorage={getItem:()=>JSON.stringify({id:'u',hash:'test'})};
globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
function setup(admin=true){D.state.belumDisimpan=false;D.state.data={rev:42,tabel:{master_material:[],material_masuk:[{id:1,tanggal:'2026-11-01',material:'Solar',satuan:'Liter',qty:9}],material_keluar:[{id:2,tanggal:'2026-11-02',material:'Solar',satuan:'Liter',qty:2,divisi:'Infra'}],sppb:[],sppb_items:[]},web:{pengguna:{u:{nama:'Uji',admin,aktif:true,sandi:{hash:'test'}}}}};}
test('hasil XLSX memuat stok pemilik, BBM terpisah dan biaya untuk admin',async()=>{
 setup();const sheets=siapkanLaporan({dari:'2026-11-01',sampai:'2026-11-30'});
 assert.equal(sheets.length,11);assert.ok(sheets.some(s=>s.nama==='Stok Pemilik'));assert.equal(sheets[0].baris[4][6].v,7);
 assert.equal(sheets[1].baris.length,4);assert.equal(sheets[3].baris.length,5);
 const bytes=await buatXlsx(sheets);assert.ok(bytes.length>1000);
});
test('laporan lengkap memerlukan hak ekspor bagi pengguna non-admin',()=>{setup(false);assert.throws(()=>siapkanLaporan(),/tidak memiliki hak/);D.state.data.web.pengguna.u.hak={ekspor:true};const sheets=siapkanLaporan();assert.equal(sheets.length,9);assert.ok(sheets.some(s=>s.nama==='Stok Pemilik'));assert.ok(!sheets.some(s=>s.nama==='Biaya per Blok'));D.state.data.web.pengguna.u.aktif=false;assert.throws(()=>siapkanLaporan(),/tidak memiliki hak/)});
test('tanggal yang terbalik ditolak',()=>{setup();assert.throws(()=>siapkanLaporan({dari:'2026-11-30',sampai:'2026-11-01'}),/Tanggal awal/)});
