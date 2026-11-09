import test from 'node:test';import assert from 'node:assert/strict';
import {kunciAmplop} from '../js/kunci.js?v=8';

const values=new Map(),sessions=new Map();let quota=false;
globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(quota&&k.includes('.arsip.'))throw Error('quota');values.set(k,String(v));},removeItem:k=>values.delete(k)};
globalThis.sessionStorage={getItem:k=>sessions.get(k)??null,setItem:(k,v)=>sessions.set(k,String(v)),removeItem:k=>sessions.delete(k)};
globalThis.location={hostname:'vigufarm-web.github.io',pathname:'/gudang/'};
const D=await import('../js/data.js?v=8');
function init(rev){values.clear();sessions.clear();quota=false;sessions.set('gudang.pengguna.v1',JSON.stringify({id:'etik-test',hash:'fixture'}));D.state.data={aplikasi:'Gudang',rev,tabel:{},web:{pengguna:{'etik-test':{nama:'Etik Uji',sandi:{hash:'fixture'}}}}};D.state.password='password-uji';D.state.belumDisimpan=false;D.state.dasarJson=JSON.stringify(D.state.data);}
const key='gudang.draf.data/gudang.json.etik-test';
test('same revision draft can still be decrypted and recovered',async()=>{
 init(5);const data={aplikasi:'Gudang',rev:5,tabel:{material_masuk:[{id:7,qty:1}]}};const amp=await kunciAmplop(data,'password-uji',{},1000);values.set(key,JSON.stringify({rev:5,waktu:'2026-11-09T00:00:00Z',amp}));const d=await D.drafTersimpan();assert.equal(d.data.tabel.material_masuk[0].qty,1);assert.equal(values.has(key),true);
});
test('a stale draft is archived encrypted rather than silently deleted',async()=>{
 init(6);const raw=JSON.stringify({rev:5,waktu:'2026-11-09T00:00:00Z',amp:{data:'encrypted-fixture'}});values.set(key,raw);const d=await D.drafTersimpan();assert.equal(d.terlambat,true);assert.equal(d.diarsipkan,true);assert.equal(d.mentah,raw);assert.equal(values.has(key),false);const archive=[...values.keys()].find(k=>k.startsWith(key+'.arsip.'));assert.equal(values.get(archive),raw);
});
test('when storage is full the old draft is protected from deletion',async()=>{
 init(9);const raw=JSON.stringify({rev:8,waktu:'2026-11-09T00:00:00Z',amp:{data:'encrypted-fixture'}});values.set(key,raw);quota=true;const d=await D.drafTersimpan();assert.equal(d.terlambat,true);assert.equal(d.diarsipkan,false);D.hapusDraf();assert.equal(values.get(key),raw);
});
