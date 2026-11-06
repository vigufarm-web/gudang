import test from 'node:test';
import assert from 'node:assert/strict';
import {rincianSppb,sheetSppb,htmlLaporanSppb} from '../js/laporan-sppb.js';
import {buatXlsx} from '../js/xlsx-tulis.js';
const docs=[{no_sppb:'2698',tanggal:'2026-11-03',divisi_pemohon:'Infra',status_keseluruhan:'Sebagian',acc:'Full Acc',items:[
 {material:'Besi',qty_diminta:10,realisasi:4,sisa:6,satuan:'Pcs',status:'Sebagian'},
 {material:'Semen',qty_diminta:3,realisasi:3,sisa:0,satuan:'Sak',status:'Selesai'},
 {material:'Kaca',qty_diminta:2,realisasi:0,sisa:2,satuan:'Lembar',status:'Belum Realisasi'},
 {material:'Batal',qty_diminta:1,realisasi:0,sisa:0,satuan:'Pcs',status:'Dibatalkan',batal:true}]}];
test('rincian memuat tanggal permintaan dan setiap status tanpa mencampur satuan',()=>{
 const rows=rincianSppb(docs);assert.equal(rows.length,4);assert.equal(rows[0].tanggal,'2026-11-03');assert.equal(rows[0].nomor,'2698');assert.deepEqual(rows.map(r=>[r.status,r.diminta,r.diterima,r.sisa]),[['Sebagian',10,4,6],['Selesai',3,3,0],['Belum Realisasi',2,0,2],['Dibatalkan',1,0,0]]);
});
test('Excel dan cetak menggunakan rincian yang sama dan teks cetak aman',async()=>{
 const copy=structuredClone(docs);copy[0].items[0].material='<Besi & alat>';const sh=sheetSppb(copy,'Filter Infra');assert.equal(sh.baris[4][5].v,'<Besi & alat>');assert.equal(sh.baris[4][7].v,4);const pdf=htmlLaporanSppb(copy,'Filter Infra');assert.match(pdf,/&lt;Besi &amp; alat&gt;/);assert.match(pdf,/2026-11-03/);assert.match(pdf,/Belum Realisasi/);const file=await buatXlsx([sh]);assert.ok(file.byteLength>0);
});
