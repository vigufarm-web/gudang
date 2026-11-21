import test from 'node:test';
import assert from 'node:assert/strict';
import {opnameCocokStatus} from '../js/opname-monitor.js';

test('opname berpindah dari belum ACC ke sudah ACC hanya setelah disetujui',()=>{
 const doc={status:'Draf'};
 assert.equal(opnameCocokStatus(doc,'belum'),true);
 doc.status='Diajukan';
 assert.equal(opnameCocokStatus(doc,'belum'),true);
 assert.equal(opnameCocokStatus(doc,'disetujui'),false);
 doc.status='Disetujui';
 assert.equal(opnameCocokStatus(doc,'belum'),false);
 assert.equal(opnameCocokStatus(doc,'disetujui'),true);
 doc.status='Dibatalkan';
 assert.equal(opnameCocokStatus(doc,'dibatalkan'),true);
 assert.equal(opnameCocokStatus(doc,'disetujui'),false);
 assert.equal(opnameCocokStatus(doc,'semua'),true);
});
