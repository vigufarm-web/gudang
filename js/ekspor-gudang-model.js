// Data laporan terpisah dari tampilan supaya dapat diperiksa tanpa mengubah data.
import * as B from './pengadaan-model.js?v=8';
import {adalahBbm} from './bbm-model.js?v=8';

export function susunLaporanPengadaan(data, dokumen) {
  const item = [], order = [], penerimaan = [];
  for (const s of dokumen) for (const it of s.items || []) {
    const r = B.ringkasItem(data, it);
    item.push({nomor:s.no_sppb,tanggal:s.tanggal,divisi:s.divisi_pemohon,material:it.material,
      satuan:it.satuan,diminta:Number(it.qty_diminta)||0,diterima:r.diterima,status_acc:s.acc||'',status_item:it.status||'',
      menunggu:r.menunggu,belum_dipesan:r.belum_dipesan,dibatalkan:!!it.batal,
      catatan:r.unknown?'Konversi order belum diketahui':''});
    for (const o of r.daftar) {
      const q=B.ringkasOrder(data,o);
      order.push({sppb:s.no_sppb,nomor:o.nomor||o.id,tanggal:o.tanggal,supplier:o.supplier,
        material:o.material,jumlah:o.qty_order,satuan_order:o.satuan_order,satuan_sppb:o.satuan_sppb,
        faktor:o.faktor_order,total_sppb:q.total,diterima:q.diterima,menunggu:q.menunggu,
        ditutup:!!o.ditutup,perkiraan:o.eta,konversi:o.sumber_konversi});
      for (const m of q.masuk) penerimaan.push({sppb:s.no_sppb,order:o.nomor||o.id,tanggal:m.tanggal,
        material:m.material,jumlah:m.qty,satuan:m.satuan,retur:B.returBaris(data,m.id),
        bersih:B.qtyBersih(data,m),jumlah_sppb:B.qtySppb(data,m),satuan_sppb:o.satuan_sppb,
        lokasi:m.langsung?'Langsung ke lokasi':'Gudang',tujuan:m.lokasi_tujuan||''});
    }
  }
  return {item,order,penerimaan};
}

export function pisahBbm(rows) {
  return {material:rows.filter(r=>!adalahBbm(r)),bbm:rows.filter(adalahBbm)};
}
