import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../js/pengadaan-model.js?v=8';
import * as D from '../js/data.js?v=8';
import {simpanSppbBaru} from '../js/sppb-baru.js?v=cek-material-20261120-2';
import {susunLaporanPengadaan} from '../js/ekspor-gudang-model.js?v=cek-material-20261120-2';
globalThis.sessionStorage={getItem:()=>JSON.stringify({id:'u',hash:'fixture'})};
globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const data=()=>({tabel:{master_material:[{id:1,nama:'Produk A',satuan_default:'Liter'}],master_satuan:[{id:1,nama:'Liter'}],master_divisi:[{id:1,nama:'Pisang'}],material_masuk:[],material_keluar:[],sppb:[{id:1,no_sppb:'UJI',divisi_pemohon:'Pisang'}],sppb_items:[{id:1,sppb_id:1,material:'Nama di SPPB',satuan:'Ltr',qty_diminta:10}]},web:{pengguna:{u:{nama:'Uji',admin:true,aktif:true,sandi:{hash:'fixture'}}},accSppb:{'1':{kepala:{status:'disetujui'},ktu:{status:'disetujui'}}},pesanan:{}}});
test('order beda nama harus memilih master dan mendapat konfirmasi, satuan Ltr tetap setara Liter',()=>{
 const d=data(),r={sppb_item_id:1,material_stok:'Produk A',qty_order:10,satuan_order:'Ltr',supplier:'A',tanggal:'2026-11-20'};
 assert.throws(()=>B.susunOrder(d,r,'o'),/centang konfirmasi/);
 assert.throws(()=>B.susunOrder(d,{...r,material_stok:'Barang tidak ada',sama_barang_disetujui:true},'o'),/Master Material/);
 assert.throws(()=>B.susunOrder(d,{...r,material_stok:'',sama_barang_disetujui:true},'o'),/Master Material/);
 const o=B.susunOrder(d,{...r,sama_barang_disetujui:true},'o');
 assert.equal(o.material,'Produk A');assert.equal(o.satuan_stok,'Liter');assert.equal(o.faktor_stok,1);
 assert.equal(d.tabel.sppb_items[0].material,'Nama di SPPB');
});
test('nama pada kemasan berbeda perlu konfirmasi dan tetap tercatat pada penerimaan',()=>{
 const d=data();d.web.pesanan.o={id:'o',sppb_item_id:1,material:'Produk A',supplier:'A',qty_order:10,satuan_order:'Ltr',satuan_sppb:'Ltr',satuan_stok:'Liter',faktor_order:1,faktor_stok:1};
 const raw={order_id:'o',tanggal:'2026-11-20',qty_terima:2,satuan_terima:'Ltr',supplier_aktual:'A',nama_barang_datang:'Nama pada kemasan'};
 assert.throws(()=>B.susunPenerimaan(d,raw),/centang konfirmasi/);
 assert.throws(()=>B.susunPenerimaan(d,{...raw,nama_barang_datang:''}),/wajib diisi/);
 const r=B.susunPenerimaan(d,{...raw,nama_barang_sama:true});
 assert.equal(r.material,'Produk A');assert.equal(r.nama_barang_datang,'Nama pada kemasan');assert.equal(r.qty,2);assert.equal(r.pemilik_stok,'Pisang');
 assert.throws(()=>B.susunPenerimaan(d,{...raw,nama_barang_sama:true,supplier_aktual:'B'}),/Pemasok berbeda/);
 d.tabel.master_material[0].satuan_default='Kg';assert.throws(()=>B.susunPenerimaan(d,{...raw,nama_barang_sama:true}),/Satuan stok pada order berbeda/);
 d.tabel.master_material=[];assert.throws(()=>B.susunPenerimaan(d,{...raw,nama_barang_sama:true}),/belum ada di Master/);
});
test('penerimaan manual memerlukan master dan konfirmasi nama tanpa mengubah stok saat ditolak',()=>{
 D.state.data=data();const base={tanggal:'2026-11-20',material:'Produk A',satuan:'Liter',qty:2,pemilik_stok:'Pisang',nama_barang_datang:'Label lain'};
 assert.throws(()=>D.tambah('material_masuk',base),/centang konfirmasi/);
 assert.throws(()=>D.tambah('material_masuk',{...base,material:'Nama baru',nama_barang_datang:'Nama baru'}),/Master Material/);
 assert.equal(D.baris('material_masuk').length,0);
 const r=D.tambah('material_masuk',{...base,nama_barang_sama:true});
 assert.equal(r.material,'Produk A');assert.equal(r.nama_barang_diperiksa_oleh,'Uji');assert.equal(D.laporanStok()[0].stok,2);
});
test('SPPB boleh menulis kebutuhan baru tanpa diam-diam menambah master material',()=>{
 D.state.data=data();
 simpanSppbBaru({no_sppb:'BARU',tanggal:'2026-11-20',divisi_pemohon:'Pisang'},[{material:'Nama kebutuhan baru',satuan:'Liter',qty_diminta:2}]);
 assert.equal(D.baris('master_material').length,1);
 assert.ok(D.baris('sppb_items').some(x=>x.material==='Nama kebutuhan baru'));
});
test('laporan menampilkan nama yang datang dan petugas yang memeriksanya',()=>{
 const d=data();d.web.pesanan.o={id:'o',nomor:'ORD-UJI',sppb_item_id:1,material:'Produk A',supplier:'A',qty_order:10,satuan_order:'Ltr',satuan_sppb:'Ltr',satuan_stok:'Liter',faktor_order:1,faktor_stok:1};
 d.tabel.material_masuk=[{id:1,order_id:'o',sppb_item_id:1,tanggal:'2026-11-20',material:'Produk A',satuan:'Liter',qty:2,qty_sppb:2,nama_barang_datang:'Label pemasok',nama_barang_diperiksa_oleh:'Etik'}];
 const docs=[{...d.tabel.sppb[0],items:d.tabel.sppb_items}];
 const r=susunLaporanPengadaan(d,docs).penerimaan[0];
 assert.equal(r.material,'Produk A');assert.equal(r.nama_barang_datang,'Label pemasok');assert.equal(r.nama_barang_diperiksa_oleh,'Etik');
});
