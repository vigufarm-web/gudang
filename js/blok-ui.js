import * as D from './data.js?v=7';
import {el,isian,kosongkan,angka} from './ui.js?v=7';
import {inputMaster,inputAngka} from './form-util.js?v=7';
import {bagiProporsi,presisi} from './workflow.js?v=7';
import {norm} from './pengadaan-model.js?v=7';
export function editorPembagian(divisi,lama=null){
 const material=inputMaster('master_material',lama?.material||'',{saatUbah:()=>gambar()}),mode=el('select',{},[el('option',{value:'luas',teks:'Proporsi luas',selected:lama?.mode==='luas'}),el('option',{value:'manual',teks:'Isi jumlah per blok',selected:lama?.mode==='manual'})]);
 const total=inputAngka(lama?.alokasi?.reduce((s,a)=>s+a.diminta,0)||''),umum=el('input',{type:'checkbox',checked:lama?.mode==='umum'}),tempat=el('div'),info=el('p.bantuan');
 let controls=[];
 function gambar(){
  const old=new Map(controls.map(x=>[String(x.id),{checked:x.check.checked,qty:x.qty.value}]));
  kosongkan(tempat);controls=D.baris('master_blok').filter(r=>norm(r.divisi)===norm(divisi())).map(r=>{
   const saved=old.get(String(r.id)),awal=lama?.alokasi?.find(a=>String(a.blok_id)===String(r.id)),check=el('input',{type:'checkbox',checked:saved?.checked??!!awal}),qty=inputAngka(saved?.qty??awal?.diminta??'');qty.setAttribute('aria-label','Jumlah blok '+r.nama);
   check.addEventListener('change',hitung);qty.addEventListener('input',hitung);
   return {id:r.id,luas:Number(r.luas_ha)||0,check,qty,nama:r.nama};
  });
  tempat.append(el('div.tabel-bungkus',{},[el('table.tabel',{},[el('thead',{},[el('tr',{},['Pilih blok','Luas (ha)','Jumlah'].map(teks=>el('th',{teks})))]),el('tbody',{},controls.map(r=>el('tr',{},[el('td',{},[el('label',{},[r.check,' '+r.nama])]),el('td',{teks:angka(r.luas,2)}),el('td',{},[r.qty])])) )])]));hitung();
 }
 function hitung(){
  const aktif=controls.filter(x=>x.check.checked),unit=D.satuanBawaan(material.value),manual=mode.value==='manual';tempat.hidden=umum.checked;mode.disabled=umum.checked;total.disabled=manual&&!umum.checked;
  controls.forEach(x=>{x.qty.disabled=!manual||!x.check.checked;});
  if(!manual&&!umum.checked){try{const parts=bagiProporsi(Number(total.value),aktif.map(x=>x.luas),presisi(unit));aktif.forEach((r,i)=>r.qty.value=parts[i]);info.textContent=`Total ${angka(parts.reduce((s,x)=>s+x,0),2)} ${unit} · ${aktif.length} blok`;}catch(e){aktif.forEach(x=>x.qty.value='');info.textContent=e.message;}}
  else{const q=umum.checked?Number(total.value):aktif.reduce((s,x)=>s+Number(x.qty.value||0),0);info.textContent=`Total ${angka(q,2)} ${unit} · ${umum.checked?'umum divisi':aktif.length+' blok'}`;}
 }
 mode.addEventListener('change',hitung);total.addEventListener('input',hitung);umum.addEventListener('change',hitung);gambar();
 return {elemen:el('div',{},[isian('Material *',material),isian('Cara pembagian',mode),isian('Total jumlah *',total),el('label',{},[umum,' Keperluan umum divisi / tanpa blok']),info,tempat]),refresh:gambar,ambil:()=>({material:material.value,mode:mode.value,umum:umum.checked,total:Number(total.value),blok:umum.checked?[]:controls.filter(x=>x.check.checked).map(x=>({id:x.id,qty:Number(x.qty.value)}))})};
}
