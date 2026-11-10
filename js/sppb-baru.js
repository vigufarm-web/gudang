import * as D from './data.js?v=8';
import * as P from './pengguna.js?v=8';

export function simpanSppbBaru(header, items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Minimal satu item material.');
  const divisi = D.masterDenganNama('master_divisi', header.divisi_pemohon);
  if (!divisi || !P.cakupan(divisi.nama)) throw new Error('Pilih divisi yang tersedia dan sesuai hak akses Anda.');
  if (items.some(it => !String(it.material || '').trim() || !(Number(it.qty_diminta) > 0))) throw new Error('Material dan jumlah setiap item wajib diisi.');
  P.jagaTransaksi('tambah', 'sppb', null, {...header, divisi_pemohon: divisi.nama});
  const pembuat = P.siapa();
  if (P.admin()) for (const it of items) D.pastikanMaster('master_material', it.material, {satuan_default:it.satuan});
  const s = D.tambah('sppb', {...header, divisi_pemohon:divisi.nama, dibuat_oleh:pembuat?.nama || '', dibuat_oleh_id:pembuat?.id || null, dibuat_ttd_versi:D.web().ttdPengguna?.[pembuat?.id]?.versi || null});
  for (const it of items) D.tambah('sppb_items', {sppb_id:s.id, ...it});
  return s;
}
