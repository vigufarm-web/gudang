// Kelompok tampilan tidak mengubah dokumen ataupun status persetujuannya.
export function opnameCocokStatus(opname, pilihan) {
  if (pilihan === 'semua') return true;
  if (pilihan === 'belum') return ['Draf', 'Diajukan'].includes(opname.status);
  if (pilihan === 'disetujui') return opname.status === 'Disetujui';
  if (pilihan === 'dibatalkan') return opname.status === 'Dibatalkan';
  return false;
}
