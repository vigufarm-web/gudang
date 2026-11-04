import test from 'node:test';
import assert from 'node:assert/strict';
import { blokDapatDipilih } from '../js/data.js';

test('block choices retain active GIS and general locations but hide inactive and duplicate masters', () => {
  const records = [
    { id: 1, nama: 'E01c', gis_active: true, gis_canonical_local_id: 1 },
    { id: 2, nama: 'E01d', gis_active: false },
    { id: 3, nama: 'Duplikat', gis_active: true, gis_canonical_local_id: 1 },
    { id: 4, nama: 'Bengkel' },
  ];
  assert.deepEqual(records.filter(blokDapatDipilih).map(r => r.nama), ['E01c', 'Bengkel']);
  assert.equal(records.length, 4);
});
