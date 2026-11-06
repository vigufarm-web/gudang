import {S,GAYA,unduhXlsx} from './xlsx-tulis.js';

// Satu baris per item, memakai angka yang sama dengan Monitoring SPPB.
export function rincianSppb(dokumen) {
 return dokumen.flatMap(s => (s.items?.length ? s.items : [null]).map(it => ({
  nomor:s.no_sppb||'', tanggal:s.tanggal||'', divisi:s.divisi_pemohon||'',
  statusDokumen:s.status_keseluruhan||'Tanpa Item', acc:s.acc||'',
  material:it?.material||'', diminta:it ? Number(it.qty_diminta)||0 : null,
  diterima:it ? Number(it.realisasi)||0 : null, sisa:it ? Number(it.sisa)||0 : null,
  satuan:it?.satuan||'', status:it?.status||'Tanpa item', catatan:it?.keterangan||''
 })));
}
const kolom=[['No. SPPB','nomor',20],['Tanggal diminta','tanggal',17],['Divisi','divisi',16],
 ['Status SPPB','statusDokumen',20],['Persetujuan','acc',20],['Material','material',32],
 ['Diminta','diminta',14],['Diterima bersih','diterima',18],['Sisa','sisa',14],
 ['Satuan','satuan',15],['Status item','status',20],['Keterangan','catatan',32]];
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const nilai=v=>v==null?'—':typeof v==='number'?new Intl.NumberFormat('id-ID',{maximumFractionDigits:3}).format(v):String(v);
export function sheetSppb(dokumen,meta) {
 const rows=rincianSppb(dokumen);
 return {nama:'Rincian SPPB',lebar:kolom.map(c=>c[2]),bekukan:4,filter:`A4:L${Math.max(4,rows.length+4)}`,
  merges:['A1:L1','A2:L2','A3:L3'],baris:[[S.judul('LAPORAN REALISASI SPPB')],[S.kecil(meta)],
   [S.catatan('Tanggal adalah tanggal permintaan SPPB. Sisa dibatalkan ditampilkan 0; status item dibatalkan.')],
   kolom.map(c=>S.kepala(c[0])),...rows.map(r=>kolom.map(([,k])=>typeof r[k]==='number'?{v:r[k],g:GAYA.angka}:S.teks(r[k]??''))) ]};
}
export async function unduhLaporanSppb(dokumen,meta){await unduhXlsx('Laporan-Realisasi-SPPB.xlsx',[sheetSppb(dokumen,meta)]);}
export function htmlLaporanSppb(dokumen,meta) {
 const rows=rincianSppb(dokumen);
 return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan realisasi SPPB</title><style>
 @page{size:A4 landscape;margin:10mm}body{font:11px Arial,sans-serif;color:#172e22}h1{font-size:18px}p{color:#40564a}table{border-collapse:collapse;width:100%}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:1px solid #cbd8cc;padding:5px;text-align:left;vertical-align:top}th{background:#e5efe7}@media print{button{display:none}}
 </style></head><body><h1>Laporan realisasi SPPB</h1><p>${esc(meta)}</p><p>Tanggal diminta mengikuti tanggal SPPB. Sisa item yang dibatalkan 0; lihat status item.</p><table><thead><tr>${kolom.map(c=>`<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${kolom.map(([,k])=>`<td>${esc(nilai(r[k]))}</td>`).join('')}</tr>`).join(''):'<tr><td colspan="12">Tidak ada SPPB yang sesuai filter.</td></tr>'}</tbody></table><p><button onclick="window.print()">Cetak / simpan sebagai PDF</button></p></body></html>`;
}
export function cetakLaporanSppb(dokumen,meta){
 const tab=window.open('','_blank');
 if(!tab)throw Error('Jendela cetak diblokir. Izinkan pop-up untuk aplikasi Gudang, lalu coba lagi.');
 tab.document.open();tab.document.write(htmlLaporanSppb(dokumen,meta));tab.document.close();
}
