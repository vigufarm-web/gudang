import {formSppbBaru} from './sppb.js?v=8';
import * as D from './data.js?v=8';
import * as P from './pengguna.js?v=8';
import * as W from './workflow.js?v=8';
import {el,kosongkan,isian,panel,tabel,angka,tanya,mintaTeks,pesan,taruh,hariIni} from './ui.js?v=8';
import {inputTanggal,inputAngka} from './form-util.js?v=8';
import {editorPembagian} from './blok-ui.js?v=8';
import {bisaEdit,simpanSekarang} from './main.js?v=8';
import {adalahBbm} from './bbm-model.js?v=8';
import {norm,samaUnit} from './pengadaan-model.js?v=8';
const button=(teks,fn)=>{const b=el('button',{type:'button',teks,onclick:async()=>{if(b.disabled)return;b.disabled=true;try{await fn();}finally{b.disabled=false;}}});return b;};
async function simpan(fn,repaint){fn();await simpanSekarang('Web: permintaan / stok opname');repaint();}
const jejak=o=>el('details',{},[el('summary',{teks:'Jejak tindakan'}),...(o.jejak||[]).map(j=>el('p.bantuan',{teks:`${new Date(j.waktu).toLocaleString('id-ID')} · ${j.nama} · ${j.aksi}${j.alasan?' · '+j.alasan:''}`}))]);
function formPermintaan(selesai,lama=null){
 const div=el('select',{},D.baris('master_divisi').filter(d=>norm(d.nama)!=='gudang'&&P.cakupan(d.nama)).map(d=>el('option',{value:d.nama,teks:d.nama,selected:d.nama===lama?.divisi})));if(lama)div.disabled=true;
 const tanggal=inputTanggal(lama?.tanggal),keperluan=el('textarea',{rows:2},[lama?.keperluan||'']),cards=el('div'),items=[];
 function add(old){const edit=editorPembagian(()=>div.value,old),card=el('div.lembar',{style:'padding:1rem;margin:.8rem 0'},[edit.elemen,button('Hapus material ini',()=>{const i=items.indexOf(edit);items.splice(i,1);card.remove();})]);items.push(edit);cards.append(card);}
 div.addEventListener('change',()=>items.forEach(x=>x.refresh()));if(lama)lama.items.forEach(add);else add();
 const p=panel(lama?'Revisi permintaan; acc diulang':'Permintaan material mandor',el('div',{},[isian('Tanggal permintaan *',tanggal),isian('Divisi pemohon *',div),isian('Keperluan pekerjaan *',keperluan),el('p.bantuan',{teks:'Pilih beberapa blok dari Master Blok. Setiap material boleh memiliki pembagian berbeda. Satu permintaan untuk satu divisi.'}),cards,button('+ Tambah material',()=>add())]),[button('Simpan draf',async()=>{const raw={tanggal:tanggal.value,divisi:div.value,keperluan:keperluan.value,items:items.map(x=>x.ambil())};await simpan(()=>lama?W.revisiPermintaan(lama.id,raw):W.buatPermintaan(raw),()=>{p.tutup();selesai();});})]);
}
export function formKeluarBanyakBlok(selesai){
 const div=el('select',{},D.baris('master_divisi').filter(d=>norm(d.nama)!=='gudang'&&(P.punya('gudang')||P.cakupan(d.nama))).map(d=>el('option',{value:d.nama,teks:d.nama}))),tanggal=inputTanggal(),oleh=el('input',{type:'text'}),keperluan=el('input',{type:'text'}),edit=editorPembagian(()=>div.value);
 div.addEventListener('change',()=>edit.refresh());const p=panel('Material keluar banyak blok',el('div',{},[isian('Tanggal *',tanggal),isian('Divisi pemakai *',div),isian('Diambil oleh *',oleh),isian('Keperluan *',keperluan),edit.elemen]),[button('Catat penyerahan',async()=>{const it=W.susunItem(div.value,edit.ambil()),batch=crypto.randomUUID();if(adalahBbm(it))throw Error('Gunakan BBM Keluar atau penyerahan permintaan untuk BBM.');await simpan(()=>D.tambahBatchKeluar(it.alokasi.map(a=>({tanggal:tanggal.value,material:it.material,satuan:it.satuan,qty:a.diminta,blok:a.blok,divisi:div.value,diambil_oleh:oleh.value.trim(),keperluan:keperluan.value.trim(),batch_id:batch,luas_acuan_ha:a.luas_ha,mode_pembagian:it.mode}))),()=>{p.tutup();selesai();});})]);
}
function detailPermintaan(o,repaint){
 const rows=W.rincian(o),jumlah=new Map(),isi=el('div',{},[el('p',{teks:`${o.nomor} · ${o.divisi} · ${o.pemohon.nama} · ${o.status}`}),el('p',{teks:o.keperluan})]);
 isi.append(tabel([{l:'Material',k:'material'},{l:'Blok',k:'blok'},{l:'Luas acuan (ha)',nilai:r=>angka(r.alokasi.luas_ha,2)},{l:'Satuan',k:'satuan'},{l:'Stok Gudang',nilai:r=>angka(D.laporanStok().find(s=>norm(s.material)===norm(r.material)&&samaUnit(s.satuan,r.satuan))?.stok||0,2)},{l:'Diminta',k:'diminta',jenis:'angka',pecahan:2},{l:'Jatah acc terakhir',nilai:r=>(o.kepala||o.ktu)?angka(r.disetujui,2):'Menunggu acc'},{l:'Diserahkan',k:'diserahkan',jenis:'angka',pecahan:2},{l:'Sisa jatah',nilai:r=>(o.kepala||o.ktu)?angka(r.sisa,2):'—'}],rows));
 const aksi=[],can=bisaEdit();let p;const done=()=>{p.tutup();repaint();};
 if(can){
  const pemohon=(P.admin()||o.pemohon.id===P.siapa()?.id)&&P.punya('minta')&&P.cakupan(o.divisi);
  if(pemohon&&!rows.some(r=>r.diserahkan>0)){aksi.push(button('Revisi permintaan',()=>{p.tutup();formPermintaan(repaint,o);}));if(o.status==='Draf')aksi.push(button('Ajukan ke Kepala Divisi',()=>simpan(()=>W.ajukanPermintaan(o.id),done)));}
  const tahap=W.bolehPutus(o,'kepala')?'kepala':W.bolehPutus(o,'ktu')?'ktu':null;
  if(tahap){
   isi.append(el('h3',{teks:'Jumlah yang disetujui per blok'}));for(const r of rows){const input=inputAngka(r.disetujui);jumlah.set(r.alokasi.id,input);isi.append(isian(`${r.material} · ${r.blok} (${r.satuan})`,input));}
   const alasan=el('textarea',{rows:2});isi.append(isian('Alasan pengurangan / penolakan',alasan));
   aksi.push(button('Acc '+(tahap==='ktu'?'KTU':'Kepala Divisi'),()=>simpan(()=>W.putusPermintaan(o.id,tahap,true,Object.fromEntries([...jumlah].map(([id,x])=>[id,x.value])),alasan.value),done)),button('Tolak',()=>simpan(()=>W.putusPermintaan(o.id,tahap,false,{},alasan.value),done)));
  }
  if(o.status==='Full Acc'&&P.punya('gudang')&&P.punya('input')&&rows.some(r=>r.sisa>0))aksi.push(button('Serahkan barang',()=>{
   const date=inputTanggal(),penerima=el('input',{type:'text',nilai:o.pemohon.nama}),body=el('div',{},[isian('Tanggal penyerahan *',date),isian('Penerima *',penerima)]),fields=new Map();
   for(const it of o.items){const detail=rows.filter(r=>r.item.id===it.id),total=inputAngka('');body.append(el('h3',{teks:it.material+' · '+it.satuan}),isian('Total penyerahan item ini (opsional)',total),button('Bagi menurut sisa jatah',()=>{const aktif=detail.filter(r=>r.sisa>0),parts=W.bagiProporsi(Number(total.value),aktif.map(r=>r.sisa),W.presisi(it.satuan));aktif.forEach((r,i)=>fields.get(r.alokasi.id).value=parts[i]);}));for(const r of detail){const x=inputAngka(0);x.max=r.sisa;fields.set(r.alokasi.id,x);body.append(isian(`${r.blok} · sisa ${angka(r.sisa,2)} ${it.satuan}`,x));}}
   const q=panel('Penyerahan '+o.nomor,body,[button('Catat Material Keluar',()=>simpan(()=>W.serahkan(o.id,Object.fromEntries([...fields].map(([id,x])=>[id,x.value])),date.value,penerima.value),()=>{q.tutup();done();}))]);
  }));
  if(o.status==='Full Acc'&&P.punya('gudang')&&P.punya('input')&&P.cakupan(o.divisi))aksi.push(button('Buat SPPB terkait',()=>{
   const grouped=new Map();for(const r of rows){const k=norm(r.material)+'|'+r.satuan;if(!grouped.has(k))grouped.set(k,{material:r.material,satuan:r.satuan,qty_diminta:0,keterangan:o.keperluan});grouped.get(k).qty_diminta+=r.sisa;}
   const items=[...grouped.values()].filter(r=>r.qty_diminta>0).map(r=>({...r,qty_diminta:Math.max(0,r.qty_diminta-(D.laporanStok().find(s=>norm(s.material)===norm(r.material)&&samaUnit(s.satuan,r.satuan))?.stok||0))})).filter(r=>r.qty_diminta>0);
   if(!items.length)throw Error('Tidak ada kekurangan stok untuk sisa permintaan.');p.tutup();formSppbBaru(()=>{pesan('SPPB terkait dibuat; lanjutkan persetujuan dan order melalui menu SPPB.','sukses');repaint();},{id:o.id,nomor:o.nomor,divisi:o.divisi,items});
  }));
  if(!['Ditutup','Ditolak'].includes(o.status)&&(P.admin()||P.punya('gudang')||o.pemohon.id===P.siapa()?.id))aksi.push(button('Tutup sisa / batalkan',async()=>{const alasan=await mintaTeks('Alasan penutupan');if(alasan)await simpan(()=>W.tutupPermintaan(o.id,alasan),done);}));
 }
 const linked=D.baris('sppb').filter(s=>s.permintaan_id===o.id);if(linked.length)isi.append(el('p',{teks:'SPPB terkait: '+linked.map(s=>s.no_sppb).join(', ')}));
 const serah=D.baris('material_keluar').filter(r=>r.permintaan_id===o.id);if(serah.length)isi.append(el('h3',{teks:'Riwayat penyerahan'}),tabel([{l:'Tanggal',k:'tanggal'},{l:'No. penyerahan',nilai:r=>r.no_penyerahan||r.batch_id},{l:'Material',k:'material'},{l:'Blok',k:'blok'},{l:'Jumlah',k:'qty',jenis:'angka',pecahan:2},{l:'Penerima',k:'diambil_oleh'}],serah));
 isi.append(jejak(o));p=panel(o.nomor,isi,aksi);
}
export async function halamanPermintaan(wadah){
 const search=el('input',{type:'search',placeholder:'Cari nomor, mandor, material atau blok…'}),list=el('div');
 const gambar=()=>{kosongkan(list);const q=norm(search.value),docs=W.permintaanTerlihat().filter(o=>!q||norm(JSON.stringify(o)).includes(q)).sort((a,b)=>b.dibuat.localeCompare(a.dibuat));list.append(tabel([{l:'Nomor',k:'nomor'},{l:'Tanggal',k:'tanggal'},{l:'Divisi',k:'divisi'},{l:'Mandor',nilai:o=>o.pemohon.nama},{l:'Status',nilai:o=>o.status==='Full Acc'?(W.rincian(o).every(r=>r.sisa<1e-7)?'Selesai':W.rincian(o).some(r=>r.diserahkan>0)?'Diserahkan sebagian':W.rincian(o).some(r=>r.sisa>(D.laporanStok().find(s=>norm(s.material)===norm(r.material)&&samaUnit(s.satuan,r.satuan))?.stok||0))?'Full Acc · menunggu stok':'Full Acc · siap diserahkan'):o.status},{l:'Material / blok',nilai:o=>o.items.map(it=>it.material+' ('+it.alokasi.map(a=>a.blok||'Umum').join(', ')+')').join('; ')}],docs,{kosong:'Belum ada permintaan.',saatKlik:o=>detailPermintaan(o,gambar)}));};search.addEventListener('input',gambar);
 taruh(wadah,el('p',{teks:'Mandor mengajukan → Kepala Divisi → KTU → Gudang menyerahkan. Acc belum mengurangi stok; penyerahan tercatat sekali di Material Keluar / BBM Keluar.'}),bisaEdit()&&P.punya('minta')?button('+ Permintaan mandor',()=>formPermintaan(gambar)):null,search,list);gambar();
}
function mulaiOpname(repaint){
 const selected=new Set(),list=el('div',{style:'max-height:340px;overflow:auto'}),tanggal=inputTanggal(),search=el('input',{type:'search',placeholder:'Cari material untuk dihitung…'});
 const rows=D.baris('master_material').filter(m=>m.satuan_default&&norm(m.nama)!=='bbm').sort((a,b)=>a.nama.localeCompare(b.nama)).map(m=>{const c=el('input',{type:'checkbox',onchange:()=>c.checked?selected.add(m.nama):selected.delete(m.nama)}),l=el('label',{style:'display:block;padding:.35rem'},[c,' '+m.nama+' ('+m.satuan_default+')']);list.append(l);return {m,l};});search.addEventListener('input',()=>rows.forEach(r=>r.l.hidden=!norm(r.m.nama).includes(norm(search.value))));
 const p=panel('Mulai stok opname Gudang',el('div',{},[el('p',{teks:'Tekan Mulai penghitungan ketika siap menghitung fisik. Stok sistem saat itu dikunci sebagai acuan. Transaksi baru setelahnya tetap diperhitungkan; koreksi transaksi acuan akan meminta hitung ulang.'}),isian('Tanggal penghitungan *',tanggal),search,list]),[button('Mulai penghitungan',()=>simpan(()=>W.buatOpname([...selected],tanggal.value),()=>{p.tutup();repaint();}))]);
}
function detailOpname(o,repaint){
 const isi=el('div',{},[el('p',{teks:`${o.nomor} · ${o.status} · Penghitung: ${o.penghitung.nama} · Mulai ${new Date(o.mulai).toLocaleString('id-ID')}`})]),fields=new Map(),rows=o.items;
 isi.append(tabel([{l:'Material',k:'material'},{l:'Satuan',k:'satuan'},{l:'Stok acuan',k:'sistem',jenis:'angka',pecahan:2},{l:'Fisik',nilai:r=>r.fisik==null?'Belum diisi':angka(r.fisik,2)},{l:'Selisih',nilai:r=>r.fisik==null?'—':(r.fisik-r.sistem>0?'+':'')+angka(r.fisik-r.sistem,2)},{l:'Alasan',k:'alasan'},{l:'Stok sekarang',nilai:r=>angka(D.laporanStok().find(x=>norm(x.material)===norm(r.material)&&samaUnit(x.satuan,r.satuan))?.stok||0,2)},{l:'Setelah acc',nilai:r=>r.fisik==null?'—':o.status==='Dibatalkan'?'Dibatalkan':o.status==='Disetujui'?angka(r.stok_setelah_acc,2):angka((D.laporanStok().find(x=>norm(x.material)===norm(r.material)&&samaUnit(x.satuan,r.satuan))?.stok||0)+r.fisik-r.sistem,2)}],rows));
 let p;const done=()=>{p.tutup();repaint();},aksi=[];
 if(bisaEdit()){
  if(o.status==='Draf'&&(P.admin()||o.penghitung.id===P.siapa()?.id)){
   for(const r of rows){const fisik=inputAngka(r.fisik??''),alasan=el('input',{type:'text',nilai:r.alasan||''}),selisih=el('p.bantuan');const update=()=>selisih.textContent=fisik.value===''?'Hasil fisik belum diisi':`Selisih: ${Number(fisik.value)-r.sistem>0?'+':''}${angka(Number(fisik.value)-r.sistem,2)} ${r.satuan}`;fisik.addEventListener('input',update);update();fields.set(r.id,{fisik,alasan});isi.append(el('h3',{teks:r.material}),isian('Hasil fisik ('+r.satuan+')',fisik),selisih,isian('Penjelasan selisih',alasan));}
   const nilai=()=>Object.fromEntries([...fields].map(([id,x])=>[id,{fisik:x.fisik.value,alasan:x.alasan.value}]));aksi.push(button('Simpan hasil hitung',()=>simpan(()=>W.isiOpname(o.id,nilai()),done)),button('Ajukan ke KTU',()=>simpan(()=>W.isiOpname(o.id,nilai(),true),done)));
  }
  if(o.status==='Diajukan'&&P.punya('ktu'))aksi.push(button('Acc KTU & terapkan selisih',async()=>{if(await tanya('Terapkan selisih opname?', 'Penyesuaian hanya sebesar selisih fisik terhadap stok acuan. Transaksi setelah penghitungan tetap dihitung.'))await simpan(()=>W.putusOpname(o.id,true),done);}),button('Kembalikan untuk diperiksa',async()=>{const alasan=await mintaTeks('Alasan pengembalian');if(alasan)await simpan(()=>W.putusOpname(o.id,false,alasan),done);}));
  if(['Draf','Diajukan'].includes(o.status)&&(P.admin()||o.penghitung.id===P.siapa()?.id))aksi.push(button('Batalkan penghitungan',async()=>{const alasan=await mintaTeks('Alasan pembatalan');if(alasan)await simpan(()=>W.batalkanOpname(o.id,alasan),done);}));
  if(o.status==='Disetujui'&&P.punya('ktu'))aksi.push(button('Batalkan penyesuaian KTU',async()=>{const alasan=await mintaTeks('Alasan pembatalan penyesuaian');if(alasan)await simpan(()=>W.balikkanOpname(o.id,alasan),done);}));
 }
 isi.append(jejak(o));p=panel(o.nomor,isi,aksi);
}
export async function halamanOpname(wadah){const list=el('div');const gambar=()=>{kosongkan(list).append(tabel([{l:'Nomor',k:'nomor'},{l:'Tanggal hitung',k:'tanggal'},{l:'Penghitung',nilai:o=>o.penghitung.nama},{l:'Status',k:'status'},{l:'Material berselisih',nilai:o=>o.items.filter(r=>r.fisik!=null&&Math.abs(r.fisik-r.sistem)>1e-7).length},{l:'Material',nilai:o=>o.items.map(r=>r.material).join(', ')}],W.opname().sort((a,b)=>b.mulai.localeCompare(a.mulai)),{kosong:'Belum ada stok opname.',saatKlik:o=>detailOpname(o,gambar)}));};taruh(wadah,el('p',{teks:'Stok fisik Gudang dibandingkan dengan acuan saat mulai menghitung. Hanya acc KTU yang membuat penyesuaian. Material yang tidak dihitung tetap utuh.'}),bisaEdit()&&(P.punya('opname')||P.punya('gudang'))?button('+ Mulai opname',()=>mulaiOpname(gambar)):null,list);gambar();}
