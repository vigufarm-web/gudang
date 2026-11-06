import * as D from './data.js?v=8';
import * as P from './pengguna.js?v=8';
import * as B from './pengadaan-model.js?v=8';
import {pisahBbm,susunLaporanPengadaan} from './ekspor-gudang-model.js?v=status-order-20261106';
import {S,GAYA,kolomHuruf,unduhXlsx} from './xlsx-tulis.js';
import {el,isian,pesan} from './ui.js?v=8';

const inRange=(r,a,b)=>r.tanggal?(!a||r.tanggal>=a)&&(!b||r.tanggal<=b):!a&&!b;
const val=v=>typeof v==='number'&&Number.isFinite(v)?{v,g:GAYA.angka}:S.teks(v==null?'':String(v));
function sheet(nama,judul,kolom,rows,meta){
 const last=kolomHuruf(kolom.length), headers=kolom.map(x=>S.kepala(x[0]));
 const body=rows.map(r=>kolom.map(([,fn])=>val(fn(r))));
 return {nama,lebar:kolom.map(([,,w])=>w||20),bekukan:4,filter:`A4:${last}${Math.max(4,body.length+4)}`,
   merges:[`A1:${last}1`,`A2:${last}2`,`A3:${last}3`],baris:[[S.judul(judul)],[S.kecil(meta)],[S.catatan('Nilai kosong berarti tidak tercatat atau belum dapat dihitung.')],headers,...body]};
}
export function siapkanLaporan({dari='',sampai=''}={}){
 if(!P.admin())throw Error('Laporan lengkap hanya tersedia untuk admin.');
 if(dari&&sampai&&dari>sampai)throw Error('Tanggal awal melebihi tanggal akhir.');
 const data=D.state.data, meta=`Dibuat ${new Date().toLocaleString('id-ID')} · revisi ${data.rev} · periode ${dari||'awal'} s.d. ${sampai||'akhir'} · ${D.state.belumDisimpan?'ada perubahan belum tersimpan':'data tersimpan'}`;
 const masuk=pisahBbm(D.baris('material_masuk').filter(x=>inRange(x,dari,sampai)));
 const keluar=pisahBbm(D.baris('material_keluar').filter(x=>inRange(x,dari,sampai)));
 const sppb=D.laporanSppb().filter(x=>inRange(x,dari,sampai)).map(x=>({...x,acc:D.statusAcc(x.id)}));const p=susunLaporanPengadaan(data,sppb);
 const c=(label,key,width)=>[label,r=>r[key],width];
 const ins=[c('Tanggal','tanggal',14),c('Material','material',30),c('Jumlah','qty',15),c('Satuan','satuan',14),['Retur',r=>B.returBaris(data,r.id),14],['Bersih',r=>B.qtyBersih(data,r),14],c('Sumber','sumber',24),['No. SPPB',r=>D.nomorSppbDariItem(r.sppb_item_id),18],['No. order',r=>data.web?.pesanan?.[r.order_id]?.nomor||'',18],c('Keterangan','keterangan',30)];
 const outs=[c('Tanggal','tanggal',14),c('Material','material',30),c('Jumlah','qty',15),c('Satuan','satuan',14),c('Divisi','divisi',18),c('Blok','blok',18),c('Penerima','diambil_oleh',22),c('Keperluan','keperluan',30),c('Unit','unit_pemakai',24),c('Keterangan','keterangan',30)];
 const stocks=[c('Material','material',30),c('Kategori','kategori',20),c('Satuan','satuan',15),c('Masuk bersih','masuk',16),c('Penyesuaian opname','penyesuaian',21),c('Keluar','keluar',16),c('Stok saat ini','stok',18)];
 const items=[c('No. SPPB','nomor',20),c('Tanggal SPPB','tanggal',16),c('Divisi','divisi',18),c('Persetujuan','status_acc',20),c('Material','material',30),c('Satuan','satuan',14),c('Diminta','diminta',15),c('Diterima bersih','diterima',18),c('Menunggu datang','menunggu',18),c('Belum dipesan','belum_dipesan',18),c('Status order','status_order',34),c('Status penerimaan','status_item',20),['Dibatalkan',r=>r.dibatalkan?'Ya':'Tidak',14],c('Catatan','catatan',35)];
 const orders=[c('SPPB','sppb',20),c('No. order','nomor',22),c('Tanggal order','tanggal',16),c('Supplier','supplier',26),c('Material','material',30),c('Jumlah order','jumlah',16),c('Satuan order','satuan_order',16),c('Faktor konversi','faktor',18),c('Satuan SPPB','satuan_sppb',16),c('Total setara SPPB','total_sppb',20),c('Diterima','diterima',15),c('Menunggu','menunggu',15),['Ditutup',r=>r.ditutup?'Ya':'Tidak',14],c('Perkiraan tiba','perkiraan',18),c('Sumber konversi','konversi',25)];
 const receipts=[c('SPPB','sppb',20),c('No. order','order',20),c('Tanggal','tanggal',15),c('Material','material',30),c('Jumlah','jumlah',15),c('Satuan','satuan',14),c('Retur','retur',15),c('Bersih','bersih',15),c('Diterima satuan SPPB','jumlah_sppb',22),c('Satuan SPPB','satuan_sppb',16),c('Lokasi penerimaan','lokasi',20),c('Tujuan','tujuan',20)];
 return [sheet('Stok','STOK GUDANG SAAT INI',stocks,D.laporanStok(),meta+' · stok tidak dibatasi periode'),sheet('Material Masuk','MATERIAL MASUK',ins,masuk.material,meta),sheet('Material Keluar','MATERIAL KELUAR',outs,keluar.material,meta),sheet('BBM Masuk','BBM MASUK',ins,masuk.bbm,meta),sheet('BBM Keluar','BBM KELUAR',outs,keluar.bbm,meta),sheet('SPPB Item','SPPB PER ITEM',items,p.item,meta),sheet('Order','ORDER PER PEMESANAN',orders,p.order,meta),sheet('Penerimaan Order','PENERIMAAN ORDER',receipts,p.penerimaan,meta)];
}
export function tombolLaporanExcel(){
 if(!P.admin())return null;
 const dari=el('input',{type:'date'}),sampai=el('input',{type:'date'});
 const tombol=el('button.tombol-samar',{type:'button',teks:'Unduh Excel laporan Gudang',onclick:async()=>{try{tombol.disabled=true;await unduhXlsx('Laporan-Gudang.xlsx',siapkanLaporan({dari:dari.value,sampai:sampai.value}));}catch(e){pesan(e.message,'galat',8);}finally{tombol.disabled=false;}}});
 return el('div.lembar',{style:'margin:1rem 0;padding:1rem'},[el('h2',{teks:'Unduh laporan Excel'}),el('p.bantuan',{teks:'Periode menyaring tanggal transaksi dan tanggal SPPB; order dan penerimaan mengikuti SPPB yang dipilih. Stok menunjukkan posisi saat ini. Kosongkan periode untuk seluruh data termasuk tanpa tanggal. Hanya admin dapat mengunduh laporan lengkap.'}),isian('Dari tanggal',dari),isian('Sampai tanggal',sampai),tombol]);
}
