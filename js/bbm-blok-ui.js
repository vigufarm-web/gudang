import * as D from './data.js?v=8';
import {el,isian,kosongkan,angka} from './ui.js?v=8';
import {inputAngka} from './form-util.js?v=8';
import {susunPembagianBbm} from './bbm-model.js?v=8';
import {norm} from './pengadaan-model.js?v=8';
export function editorBlokBbm(divisi,total){
 const mode=el('select',{},[el('option',{value:'kosong',teks:'Tanpa blok / lokasi'}),el('option',{value:'manual',teks:'Isi jumlah per blok / lokasi'}),el('option',{value:'luas',teks:'Proporsi luas Master Blok'})]),tempat=el('div'),info=el('p.bantuan'),lokasi=el('div');let controls=[],extra=[];
 const raw=()=>({divisi:divisi.value,total:Number(total.value),mode:mode.value,alokasi:[...controls.filter(x=>x.check.checked).map(x=>({blok_id:x.id,qty:x.qty.value})),...extra.map(x=>({blok:x.nama.value,qty:x.qty.value}))]});
 function hitung(){
  const kosong=mode.value==='kosong',auto=mode.value==='luas';tempat.hidden=kosong;lokasi.hidden=kosong;add.hidden=kosong||auto;info.textContent=kosong?'Opsional: blok/lokasi boleh kosong. Divisi pemakai tetap dicatat.':'';
  for(const r of controls)r.qty.disabled=auto||!r.check.checked;
  for(const r of extra){r.qty.disabled=auto;r.nama.disabled=auto;}
  if(!kosong){try{const rows=susunPembagianBbm(raw(),D.baris('master_blok'));if(auto)controls.filter(r=>r.check.checked).forEach((r,i)=>r.qty.value=rows[i].qty);info.textContent=`Terbagi ${angka(rows.reduce((n,r)=>n+r.qty,0),2)} dari ${angka(total.value,2)} Liter · ${rows.length} blok/lokasi`;}catch(e){info.textContent=e.message;}}
 }
 function gambar(){
  const old=new Map(controls.map(x=>[String(x.id),{checked:x.check.checked,qty:x.qty.value}]));kosongkan(tempat);
  controls=D.baris('master_blok').filter(r=>norm(r.divisi)===norm(divisi.value)).map(r=>{const o=old.get(String(r.id)),check=el('input',{type:'checkbox',checked:o?.checked}),qty=inputAngka(o?.qty||'');qty.setAttribute('aria-label','Liter untuk '+r.nama);check.addEventListener('change',hitung);qty.addEventListener('input',hitung);return {id:r.id,nama:r.nama,luas:r.luas_ha,check,qty};});
  tempat.append(el('div.tabel-bungkus',{},[el('table.tabel',{},[el('thead',{},[el('tr',{},['Blok','Luas (ha)','Liter'].map(teks=>el('th',{teks})))]),el('tbody',{},controls.map(r=>el('tr',{},[el('td',{},[el('label',{},[r.check,' '+r.nama])]),el('td',{teks:angka(r.luas,2)}),el('td',{},[r.qty])])) )])]));hitung();
 }
 const add=el('button',{type:'button',teks:'+ Tambah lokasi manual',onclick:()=>{
  const nama=el('input',{type:'text',placeholder:'Contoh: Bengkel / Jalan utama'}),qty=inputAngka(''),r={nama,qty};extra.push(r);
  nama.addEventListener('input',hitung);qty.addEventListener('input',hitung);
  const card=el('div',{style:'border-bottom:1px solid var(--garis-tipis);padding:.5rem 0'},[isian('Nama lokasi manual',nama),isian('Liter lokasi manual',qty),el('button',{type:'button',teks:'Hapus lokasi',onclick:()=>{extra=extra.filter(x=>x!==r);card.remove();hitung();}})]);lokasi.append(card);hitung();
 }});
 divisi.addEventListener('change',gambar);total.addEventListener('input',hitung);mode.addEventListener('change',()=>{if(mode.value==='luas'&&extra.length){extra=[];kosongkan(lokasi);}hitung();});gambar();
 return {elemen:el('div',{},[isian('Blok / lokasi BBM (opsional)',mode),info,tempat,lokasi,add]),ambil:()=>susunPembagianBbm(raw(),D.baris('master_blok')),mode:()=>mode.value};
}
