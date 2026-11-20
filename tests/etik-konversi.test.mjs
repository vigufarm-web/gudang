import test from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../js/hak.js?v=8';
import * as D from '../js/data.js?v=8';
globalThis.sessionStorage={getItem:()=>JSON.stringify({id:'u',hash:'fixture'})};
globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const p={nama:'ETIK',aktif:true,divisi:[],hak:{gudang:true,input:true,revisi:true,master_material_tambah:true,konversi_satuan:true},sandi:{hash:'fixture'}};
function setup(){D.state.data={tabel:{master_material:[{id:1,nama:'Pupuk',satuan_default:'Kg'}],master_satuan:[],master_divisi:[],material_masuk:[],material_keluar:[],sppb:[{id:1,divisi_pemohon:'Padi'}],sppb_items:[{id:1,sppb_id:1,material:'Pupuk',satuan:'Kg',qty_diminta:100}]},web:{pengguna:{u:p},pesanan:{o:{id:'o',sppb_item_id:1,material:'Pupuk',material_stok:'Pupuk',qty_order:2,satuan_order:'Sak',satuan_sppb:'Kg',satuan_stok:'Kg',supplier:'Pemasok',tanggal:'2026-11-20',harga_total_barang:123,faktor_order:null,faktor_stok:1}}}};}
test('hak tambah material tidak membuka master lain, revisi, atau order',()=>{
 assert.equal(H.bolehTransaksi(p,'tambah','master_material',null,{},()=>{}),true);
 for(const [a,t] of [['ubah','master_material'],['hapus','master_material'],['tambah','master_satuan']])assert.equal(H.bolehTransaksi(p,a,t,{}, {},()=>{}),false);
 assert.equal(H.punya(p,'order'),false);
 setup();assert.throws(()=>D.tambah('master_material',{nama:'Pupuk',satuan_default:'Kg'}),/sudah ada/);
 assert.throws(()=>D.tambah('master_material',{nama:'Baru'}),/satuan/);
 assert.equal(D.tambah('master_material',{nama:'Baru',satuan_default:'Kg'}).nama,'Baru');
});
test('konversi perlu sumber, menjaga order, dan terkunci setelah diterima',()=>{
 setup();const o=D.web().pesanan.o;
 assert.throws(()=>D.lengkapiKonversi('o',{faktor_order:50,faktor_stok:1}),/sumber konversi/);
 D.lengkapiKonversi('o',{faktor_order:50,faktor_stok:1,sumber_konversi:'Label 50 kg',harga_total_barang:0});
 assert.equal(o.faktor_order,50);assert.equal(o.harga_total_barang,123);assert.equal(o.supplier,'Pemasok');
 D.state.data.tabel.material_masuk.push({id:1,order_id:'o',qty:50});
 assert.throws(()=>D.lengkapiKonversi('o',{faktor_order:1,faktor_stok:1,sumber_konversi:'x'}),/sudah diterima/);
 assert.equal(o.faktor_order,50);
});
