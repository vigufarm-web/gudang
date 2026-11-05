import test from 'node:test';
import assert from 'node:assert/strict';
import { gabungTiga } from '../js/data.js?v=8';

const sample=()=>({tabel:{material_masuk:[{id:1,material:'Semen',qty:10},{id:2,material:'Pasir',qty:20}],material_keluar:[],sppb:[],sppb_items:[]},web:{},settings:{}});
test('concurrent edits to the same transaction cannot overwrite each other',()=>{
  const base=sample(),local=structuredClone(base),remote=structuredClone(base);
  local.tabel.material_masuk[0].qty=11;remote.tabel.material_masuk[0].qty=12;
  assert.throws(()=>gabungTiga(base,local,remote),/diubah.*perangkat lain/i);
});
test('deletion cannot silently erase a concurrently revised transaction',()=>{
  const base=sample(),local=structuredClone(base),remote=structuredClone(base);
  local.tabel.material_masuk.shift();remote.tabel.material_masuk[0].qty=12;
  assert.throws(()=>gabungTiga(base,local,remote),/diubah.*perangkat lain/i);
});
test('a concurrent deletion cannot resurrect an edited transaction',()=>{
  const base=sample(),local=structuredClone(base),remote=structuredClone(base);
  local.tabel.material_masuk[0].qty=11;remote.tabel.material_masuk.shift();
  assert.throws(()=>gabungTiga(base,local,remote),/diubah.*perangkat lain/i);
});
test('unrelated changes merge without dropping either transaction',()=>{
  const base=sample(),local=structuredClone(base),remote=structuredClone(base);
  local.tabel.material_masuk[0].qty=11;remote.tabel.material_masuk[1].qty=21;
  const result=gabungTiga(base,local,remote);
  assert.equal(result.tabel.material_masuk[0].qty,11);
  assert.equal(result.tabel.material_masuk[1].qty,21);
});
