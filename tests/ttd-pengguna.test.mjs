import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/data.js?v=8';
import * as P from '../js/pengguna.js?v=8';
import {gambarUntukAcc} from '../js/ttd-model.js';
let current='h';globalThis.sessionStorage={getItem:()=>JSON.stringify({id:current,hash:'x'})};globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const user=(nama,hak,admin=false)=>({nama,aktif:true,admin,divisi:['Infra'],hak,sandi:{hash:'x'}});
function setup(){current='h';D.state.password='';D.state.data={settings:{},tabel:{sppb:[{id:1,no_sppb:'UJI',divisi_pemohon:'Infra'}],sppb_items:[]},web:{pengguna:{h:user('Rizki',{kepala:true}),z:user('Ami',{kepala:true}),a:user('Admin',{},true)}}};}
test('setiap pengguna hanya mengubah ttd sendiri, admin boleh membantu',()=>{setup();P.setTtdPengguna('h','QUJD');assert.equal(P.ttdAktif('h'),'QUJD');assert.throws(()=>P.setTtdPengguna('z','REVG'),/Hanya pemilik atau admin/);current='a';P.setTtdPengguna('z','REVG');assert.equal(P.ttdAktif('z'),'REVG')});
test('ACC mengikat versi ttd orang yang benar dan tidak berubah saat ttd diganti',()=>{setup();P.setTtdPengguna('h','QUJD');D.setujuiSppb(1,'kepala');const acc=D.catatanAcc(1).kepala;assert.equal(acc.oleh_id,'h');assert.equal(gambarUntukAcc(D.state.data,acc,{}),'QUJD');P.setTtdPengguna('h','REVG');assert.equal(gambarUntukAcc(D.state.data,acc,{}),'QUJD');assert.equal(P.ttdAktif('h'),'REVG');P.setTtdPengguna('h','');assert.equal(gambarUntukAcc(D.state.data,acc,{}),'QUJD')});
test('ACC baru tanpa ttd tidak mengambil ttd orang lain; arsip manual tetap kosong',()=>{setup();D.setujuiSppb(1,'kepala');const acc=D.catatanAcc(1).kepala;assert.equal(gambarUntukAcc(D.state.data,acc,{nama:'Rizki',ttd:'SALAH'}),'');assert.equal(gambarUntukAcc(D.state.data,{status:'disetujui',sumber:'manual',oleh:'Rizki'},{nama:'Rizki',ttd:'SALAH'}),'')});
test('ttd lama hanya muncul jika nama pejabat cocok',()=>{setup();let a={status:'disetujui',oleh:'Rizki'};assert.equal(gambarUntukAcc(D.state.data,a,{nama:'rizki',ttd:'LAMA'}),'LAMA');assert.equal(gambarUntukAcc(D.state.data,a,{nama:'Ami',ttd:'SALAH'}),'')});
test('versi ttd milik akun lain tidak dapat ditampilkan',()=>{setup();current='a';P.setTtdPengguna('z','QUJD');let v=D.web().ttdPengguna.z.versi;let a={status:'disetujui',oleh_id:'h',ttd_versi:v};assert.equal(gambarUntukAcc(D.state.data,a,{}),'')});
