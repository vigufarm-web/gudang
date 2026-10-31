import * as D from './data.js?v=6';
import * as P from './pengguna.js?v=6';
import * as B from './pengadaan-model.js?v=6';
import {el,kosongkan,taruh,isian,tabel,panel,pesan,mintaTeks,hariIni,angka,tanggal} from './ui.js?v=6';
import {bisaEdit,simpanSekarang} from './main.js?v=6';
const jml=v=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:3}).format(Number(v)||0);
const positif=v=>Number(v)>0?Number(v):null;
const f=(nama,nilai='',type='text')=>el('input',{type,nilai,...(type==='number'?{step:'any',min:0}:{})});
const simpan=async(judul)=>{await simpanSekarang(judul);if(D.state.belumDisimpan)pesan('Perubahan masih di draf. Penyimpanan GitHub belum berhasil.','awas',9);};
const bolehOrder=it=>bisaEdit()&&P.punya('order')&&P.cakupan(D.cari('sppb',it.sppb_id)?.divisi_pemohon);
const bolehTerima=()=>bisaEdit()&&(P.admin()||P.punya('gudang'))&&P.punya('input');

export function formOrder(it,selesai,o=null) {
  if(!bolehOrder(it))throw Error('Tidak memiliki hak order pada divisi ini.');
  const supplier=f('supplier',o?.supplier||''),tgl=f('',o?.tanggal||hariIni(),'date'),eta=f('',o?.eta||'','date');
  const qty=f('',o?.qty_order||'','number'),sat=f('',o?.satuan_order||it.satuan);
  const faktor=f('',o?.faktor_order??1,'number'),stokUnit=D.satuanBawaan(it.material)||it.satuan;
  const faktorStok=f('',o?.faktor_stok??(B.samaUnit(stokUnit,it.satuan)?1:''),'number');
  const sumber=f('',o?.sumber_konversi||''),lebih=f('',o?.alasan_lebih||'');
  const jenis=B.norm(it.material)==='bbm'?el('select',{},[el('option',{value:'',teks:'Pilih jenis BBM…'}),...['Pertalite','Pertamax','Solar'].map(n=>el('option',{value:n,teks:n}))]):null;
  if(jenis)jenis.value=['Pertalite','Pertamax','Solar'].find(n=>B.norm(n)===B.norm(o?.material))||'';
  const density=f('','','number'),info=el('p.petunjuk'),galat=el('div',{role:'alert'});
  const update=()=>{info.textContent=`1 ${sat.value||'satuan order'} = ${faktor.value||'?'} ${it.satuan}; 1 ${it.satuan} = ${faktorStok.value||'?'} ${stokUnit}. Total order setara ${positif(qty.value)&&positif(faktor.value)?jml(qty.value*faktor.value,3):'belum dapat dihitung'} ${it.satuan}.`;};
  sat.addEventListener('input',()=>{faktor.value=B.samaUnit(sat.value,it.satuan)?1:'';update();});
  for(const inp of [qty,faktor,faktorStok])inp.addEventListener('input',update);
  density.addEventListener('input',()=>{const d=positif(density.value);if(!d)return;
    const konv=(a,b)=>B.unit(a)==='kg'&&B.unit(b)==='liter'?1/d:B.unit(a)==='liter'&&B.unit(b)==='kg'?d:B.samaUnit(a,b)?1:null;
    const a=konv(sat.value,it.satuan),b=konv(it.satuan,stokUnit);if(a)faktor.value=a;if(b)faktorStok.value=b;update();});
  const tombol=el('button.tombol-utama',{type:'submit',teks:'Simpan order'});let sibuk=false;
  const form=el('form',{onsubmit:async(e)=>{e.preventDefault();if(sibuk)return;sibuk=true;tombol.disabled=true;galat.textContent='';try{
    const raw={sppb_item_id:it.id,material_stok:jenis?.value,supplier:supplier.value.trim(),tanggal:tgl.value,eta:eta.value,qty_order:qty.value,satuan_order:sat.value.trim(),faktor_order:faktor.value,faktor_stok:faktorStok.value,sumber_konversi:sumber.value.trim(),alasan_lebih:lebih.value.trim()};
    if(o)D.ubahPesanan(o.id,raw);else D.tambahPesanan(raw);
    await simpan('Web: pemesanan bertahap');p.tutup();selesai();
  }catch(err){galat.textContent=err.message;}finally{sibuk=false;tombol.disabled=false;}}},[
    el('p',{teks:`SPPB ${D.cari('sppb',it.sppb_id)?.no_sppb} · ${it.material} · kebutuhan ${jml(it.qty_diminta,3)} ${it.satuan}`}),
    o?el('p',{teks:o.nomor}):el('p.bantuan',{teks:'Nomor order unik dibuat otomatis. Satu item boleh memiliki beberapa order.'}),
    jenis?isian('Jenis BBM untuk stok *',jenis):null,
    isian('Supplier *',supplier),el('div.baris-isian',{},[isian('Tanggal order *',tgl),isian('Perkiraan datang',eta)]),
    el('div.baris-isian',{},[isian('Jumlah order *',qty),isian('Satuan order *',sat)]),
    isian(`Konversi: 1 satuan order berapa ${it.satuan}?`,faktor,{bantuan:'Boleh kosong jika belum diketahui; penerimaan ditahan sampai konversi lengkap.'}),
    !B.samaUnit(stokUnit,it.satuan)?isian(`1 ${it.satuan} berapa ${stokUnit} untuk stok?`,faktorStok):null,
    ['kg','liter'].includes(B.unit(it.satuan))?isian('Massa jenis kg/liter (opsional untuk kg ↔ liter)',density,{bantuan:'Isi hanya dari spesifikasi bahan yang diketahui, bukan anggapan 1 kg = 1 liter.'}):null,
    isian('Sumber konversi / massa jenis',sumber,{bantuan:'Misalnya isi label kemasan atau dokumen supplier. Disimpan pada order.'}),info,
    isian('Alasan pengecualian jika melebihi kebutuhan',lebih),galat,tombol,
  ]);const p=panel(o?'Lengkapi / koreksi order':'Tambah order',form);update();
}

export function formTerimaOrder(o,selesai,lama=null) {
  if(!bolehTerima()||lama&&!P.punya('revisi'))throw Error('Memerlukan hak Gudang dan hak input/revisi.');
  const qty=f('',lama?.qty_terima||'','number'),tgl=f('',lama?.tanggal||hariIni(),'date');
  const sat=el('select',{},[...new Set([o.satuan_order,o.satuan_sppb,o.satuan_stok])].map(s=>el('option',{value:s,teks:s})));sat.value=lama?.satuan_terima||o.satuan_order;
  const lebih=f('',lama?.alasan_lebih||''),ket=el('textarea',{rows:2},[lama?.keterangan||'']),info=el('p.petunjuk'),galat=el('div',{role:'alert'});
  const update=()=>{try{const r=B.susunPenerimaan(D.state.data,{order_id:o.id,qty_terima:qty.value,satuan_terima:sat.value,alasan_lebih:lebih.value||'pratinjau'},lama?.id);info.textContent=`Stok Gudang bertambah ${jml(r.qty,3)} ${r.satuan}; pemenuhan SPPB ${jml(r.qty_sppb,3)} ${o.satuan_sppb}.`;}catch(e){info.textContent=e.message;}};
  for(const inp of [qty,sat])inp.addEventListener('change',update);
  const tombol=el('button.tombol-utama',{type:'submit',teks:lama?'Simpan koreksi penerimaan':'Catat penerimaan'});let sibuk=false;
  const form=el('form',{onsubmit:async(e)=>{e.preventDefault();if(sibuk)return;sibuk=true;tombol.disabled=true;galat.textContent='';try{
    if(!tgl.value)throw Error('Tanggal penerimaan wajib diisi.');
    const raw={order_id:o.id,tanggal:tgl.value,qty_terima:Number(qty.value),satuan_terima:sat.value,alasan_lebih:lebih.value.trim(),keterangan:ket.value.trim()};
    if(lama)D.ubah('material_masuk',lama.id,raw);else D.tambah('material_masuk',raw);
    await simpan('Web: penerimaan order');p.tutup();selesai();
  }catch(err){galat.textContent=err.message;}finally{sibuk=false;tombol.disabled=false;}}},[
    el('h3',{teks:o.nomor}),el('p',{teks:`${o.material} · ${o.supplier} → Gudang`}),isian('Tanggal diterima *',tgl),
    el('div.baris-isian',{},[isian('Jumlah diterima *',qty),isian('Satuan diterima',sat)]),info,
    isian('Alasan jika penerimaan melebihi sisa order',lebih),isian('Keterangan / alasan koreksi',ket),galat,tombol,
  ]);const p=panel(lama?'Koreksi penerimaan':'Terima barang dari order',form);update();
}

export async function formRetur(m,selesai) {
  const q=await mintaTeks('Retur ke supplier',`Penerimaan ${m.material}. Isi jumlah yang dikembalikan dalam ${m.satuan}.`,{label:'Jumlah retur',wajib:true});if(q==null)return;
  const alasan=await mintaTeks('Alasan retur','Catatan penerimaan asal tetap disimpan.',{label:'Alasan',wajib:true});if(alasan==null)return;
  D.returPenerimaan(m.id,Number(q.replace(',','.')),alasan);await simpan('Web: retur supplier');selesai();
}

export async function halamanPengadaan(wadah,ditunggu=false) {
  let cari='';const konten=el('div'),input=el('input',{type:'search',placeholder:'Cari nomor order, SPPB, material, supplier…','aria-label':'Cari order',oninput:e=>{cari=B.norm(e.target.value);gambar();}});
  const gambar=()=>{
    kosongkan(konten);
    const orders=D.daftarOrder().map(o=>({...o,r:D.ringkasPesanan(o),sppb:D.cari('sppb',D.cari('sppb_items',o.sppb_item_id)?.sppb_id)}))
      .filter(o=>!cari||B.norm([o.nomor,o.sppb?.no_sppb,o.material,o.supplier].join(' ')).includes(cari))
      .filter(o=>!ditunggu||!o.ditutup&&(o.r.menunggu==null||o.r.menunggu>1e-7)).sort((a,b)=>String(b.tanggal).localeCompare(a.tanggal));
    const aksi=o=>el('div',{style:'display:flex;gap:5px;flex-wrap:wrap'},[
      bolehTerima()&&!o.ditutup&&(o.r.menunggu==null||o.r.menunggu>0)?el('button.tombol-kecil',{teks:'Terima barang',onclick:()=>formTerimaOrder(o,gambar)}):null,
      bolehOrder(D.cari('sppb_items',o.sppb_item_id))&&!o.r.masuk.length&&!o.ditutup?el('button.tombol-kecil.tombol-samar',{teks:'Konversi / koreksi',onclick:()=>formOrder(D.cari('sppb_items',o.sppb_item_id),gambar,o)}):null,
      bolehOrder(D.cari('sppb_items',o.sppb_item_id))&&!o.ditutup&&(o.r.menunggu==null||o.r.menunggu>0)?el('button.tombol-kecil.tombol-samar',{teks:'Tutup sisa',onclick:async()=>{const alasan=await mintaTeks('Tutup sisa order','Sisa yang dibatalkan tidak dianggap diterima.',{label:'Alasan',wajib:true});if(alasan!=null){D.tutupSisaOrder(o.id,alasan);await simpan('Web: tutup sisa order');gambar();}}}):null,
      el('button.tombol-kecil.tombol-samar',{teks:'Riwayat terima',onclick:()=>{
        panel(`Penerimaan ${o.nomor}`,el('div',{},[
          tabel([{l:'Tanggal',k:'tanggal',jenis:'tanggal'},{l:'Diterima',nilai:m=>`${jml(m.qty_terima,3)} ${m.satuan_terima}`},{l:'Stok Gudang',nilai:m=>`${jml(m.qty,3)} ${m.satuan}`},{l:'Retur',nilai:m=>`${jml(B.returBaris(D.state.data,m.id),3)} ${m.satuan}`},{l:'Tindakan',nilai:m=>el('div',{},[
            bolehTerima()&&P.punya('revisi')?el('button.tombol-kecil',{teks:'Koreksi',onclick:()=>formTerimaOrder(o,gambar,m)}):null,
            bisaEdit()&&P.admin()?el('button.tombol-kecil.tombol-samar',{teks:'Retur',onclick:()=>formRetur(m,gambar)}):null,
          ])}],o.r.masuk,{kosong:'Belum ada penerimaan.'}),
          el('h3',{teks:'Jejak perubahan'}),...Object.values(D.web().jejakMutasi||{}).filter(j=>j.id===o.id||o.r.masuk.some(m=>m.id===j.id)).map(j=>el('p.bantuan',{teks:`${j.aksi} · ${j.oleh} · ${j.waktu}${j.alasan?' · '+j.alasan:''}`})),
        ]));
      }}),
    ]);
    konten.append(el('div.lembar',{},[el('div.lembar-isi',{},[
      el('h2',{teks:ditunggu?'Barang yang ditunggu':'Riwayat order bertahap'}),
      el('p.bantuan',{teks:'Jumlah diterima dan sisa ditampilkan dalam satuan SPPB. Stok tetap memakai satuan master material. Order tanpa konversi belum dihitung sebagai pemenuhan.'}),
      tabel([{l:'Order',nilai:o=>el('div',{},[el('strong',{teks:o.nomor}),el('small.monitor-tanggal',{teks:`${tanggal(o.tanggal)} · SPPB ${o.sppb?.no_sppb||'—'}`})])},
        {l:'Material / supplier',nilai:o=>`${o.material} · ${o.supplier}`},{l:'Dipesan',nilai:o=>`${jml(o.qty_order,3)} ${o.satuan_order}${o.r.total==null?' · konversi belum lengkap':` = ${jml(o.r.total,3)} ${o.satuan_sppb}`}`},
        {l:'Diterima',nilai:o=>`${jml(o.r.diterima,3)} ${o.satuan_sppb}`},{l:'Menunggu',nilai:o=>o.ditutup?'Sisa ditutup':o.r.menunggu==null?'Belum dapat dihitung':`${jml(o.r.menunggu,3)} ${o.satuan_sppb} · ${jml(o.r.menunggu/o.faktor_order,3)} ${o.satuan_order}`},
        {l:'Perkiraan datang',nilai:o=>o.eta?tanggal(o.eta):'Belum diisi'},
        {l:'Tindakan',nilai:aksi}],orders,{kosong:'Belum ada order pada daftar ini.'}),
    ])]));
    const legacy=Object.entries(D.web().orderItem||{}).filter(([id])=>!D.daftarOrder().some(o=>Number(o.sppb_item_id)===Number(id)));
    if(legacy.length)konten.append(el('p.petunjuk',{teks:`${legacy.length} ceklis order lama belum memiliki rincian jumlah. Tidak dianggap seluruh kebutuhan telah dipesan; lengkapi melalui Tambah order.`}));
    if(!ditunggu){
      const items=D.laporanSppb().filter(s=>D.statusAcc(s.id)===D.STATUS_ACC.FULL).flatMap(s=>s.items.filter(it=>!it.batal).map(it=>({...it,no:s.no_sppb,divisi:s.divisi_pemohon,s:D.ringkasPengadaan(it)})))
        .filter(it=>!cari||B.norm([it.no,it.material,it.divisi].join(' ')).includes(cari));
      konten.append(el('div.lembar',{style:'margin-top:1rem'},[el('div.lembar-isi',{},[
        el('h2',{teks:'Kebutuhan per item SPPB'}),tabel([{l:'SPPB / Divisi',nilai:it=>`${it.no} · ${it.divisi}`},{l:'Material',k:'material'},
          {l:'Diminta',nilai:it=>`${jml(it.qty_diminta,3)} ${it.satuan}`},{l:'Diterima bersih',nilai:it=>`${jml(it.s.diterima)} ${it.satuan}`},
          {l:'Menunggu datang',nilai:it=>it.s.menunggu==null?'Konversi belum lengkap':`${jml(it.s.menunggu)} ${it.satuan}`},
          {l:'Belum dipesan',nilai:it=>it.s.belum_dipesan==null?'Belum dapat dihitung':`${jml(it.s.belum_dipesan)} ${it.satuan}`},
          {l:'Order',nilai:it=>bolehOrder(it)?el('button.tombol-kecil.tombol-utama',{teks:'+ Tambah order',onclick:()=>formOrder(it,gambar)}):'—'}],items),
      ])]));
    }
  };
  taruh(wadah,el('p.petunjuk',{teks:'Order tidak menambah stok. Penerimaan masuk ke Gudang; pengeluaran ke divisi langsung menjadi pemakaian.'}),el('div.lembar',{style:'margin-bottom:1rem'},[el('div.lembar-isi',{},[isian('Cari nomor order, SPPB, material atau supplier',input)])]),konten);gambar();
}
