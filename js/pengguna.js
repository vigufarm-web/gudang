import * as D from './data.js?v=7';
import * as H from './hak.js?v=7';
import * as gh from './github.js?v=7';
import {bukaAmplop, kunciAmplop} from './kunci.js?v=7';
import {el, kosongkan, taruh, isian, pesan, tanya} from './ui.js?v=7';
let bisaEdit = () => false;
let simpanSekarang = async () => { throw new Error('Penyimpanan belum siap.'); };
export function hubungkanAplikasi(opsi) { bisaEdit = opsi.bisaEdit; simpanSekarang = opsi.simpan; }

const SESI = 'gudang.pengguna.v1';
export const daftar = () => Object.entries(D.state.data?.web?.pengguna || {}).map(([id,p]) => ({...p,id}));
export function siapa() {
  try {
    const sesi = JSON.parse(sessionStorage.getItem(SESI) || 'null');
    const p = daftar().find((p) => p.id === sesi?.id && p.aktif !== false);
    return p && sesi.hash === p.sandi?.hash ? p : null;
  } catch { return null; }
}
export function keluar() { sessionStorage.removeItem(SESI); }

export async function gantiSandiSendiri(lama, baru, ulang) {
  const pelaku = siapa();
  if (!pelaku) throw new Error('Masuk sebagai pengguna dulu.');
  if (!lama) throw new Error('Password/PIN lama wajib diisi.');
  if (baru.length < 6) throw new Error('Password/PIN baru minimal 6 karakter.');
  if (baru !== ulang) throw new Error('Ulangan password/PIN baru tidak sama.');
  if (baru === lama) throw new Error('Gunakan password/PIN yang berbeda dari sebelumnya.');
  if (D.state.belumDisimpan) throw new Error('Simpan perubahan data yang belum tersimpan terlebih dahulu.');
  if (!gh.lokasiRepo() || !gh.ambilToken()) throw new Error('Token GitHub pada perangkat ini diperlukan. Minta admin memasangnya melalui Pengaturan → Mode edit.');
  const sandi = await H.hashSandi(baru);
  for (let percobaan = 0; percobaan < 3; percobaan++) {
    const {isi,sha} = await gh.bacaFile(D.PATH);
    const terbaru = await bukaAmplop(isi,D.state.password);
    const pengguna = terbaru.web?.pengguna?.[pelaku.id];
    if (!pengguna || pengguna.aktif === false || pengguna.sandi?.hash !== pelaku.sandi.hash ||
        !await H.periksaSandi(lama,pengguna.sandi)) throw new Error('Password/PIN lama salah atau akun sudah berubah. Masuk ulang jika diperlukan.');
    if (siapa()?.id !== pelaku.id || D.state.belumDisimpan) throw new Error('Sesi atau data berubah. Coba kembali setelah menyimpan data.');
    terbaru.web.pengguna[pelaku.id] = {...pengguna,sandi};
    terbaru.rev = (Number(terbaru.rev) || 0) + 1;
    terbaru.dibuat = new Date().toISOString().slice(0,19);
    terbaru.dari = `Web — ${pengguna.nama}`;
    const meta = {...isi.meta,rev:terbaru.rev,diperbarui:terbaru.dibuat,dari:terbaru.dari};
    const amplop = await kunciAmplop(terbaru,D.state.password,meta);
    try {
      const shaBaru = await gh.tulisFile(D.PATH,amplop,sha,'Web: ganti password pengguna');
      const masihSama = siapa()?.id === pelaku.id;
      const adaInputBaru = D.state.belumDisimpan;
      const lokal = adaInputBaru ? D.gabungTiga(JSON.parse(D.state.dasarJson),D.state.data,terbaru) : terbaru;
      D.hapusDraf();
      Object.assign(D.state,{data:lokal,meta,sha:shaBaru,dasarJson:JSON.stringify(terbaru),belumDisimpan:adaInputBaru});
      if (masihSama) sessionStorage.setItem(SESI,JSON.stringify({id:pelaku.id,hash:sandi.hash}));
      if (adaInputBaru) D.tandaiBerubah();
      return terbaru.rev;
    } catch(e) {
      if (!e.bentrok || percobaan === 2) throw e;
    }
  }
}

export async function halamanSandi(wadah) {
  if (!siapa()) throw new Error('Masuk sebagai pengguna dulu.');
  const lama=el('input',{type:'password',autocomplete:'current-password',required:true});
  const baru=el('input',{type:'password',autocomplete:'new-password',minlength:6,required:true});
  const ulang=el('input',{type:'password',autocomplete:'new-password',minlength:6,required:true});
  const hasil=el('div',{role:'status','aria-live':'polite'});
  const tombol=el('button.tombol-utama',{type:'submit',teks:'Simpan password baru'});
  let sedang=false;
  const form=el('form',{onsubmit:async(e)=>{
    e.preventDefault(); if(sedang)return; sedang=true; tombol.disabled=true; hasil.textContent='';
    try {
      const rev=await gantiSandiSendiri(lama.value,baru.value,ulang.value);
      lama.value='';baru.value='';ulang.value='';
      hasil.className='petunjuk';hasil.textContent=`Password/PIN berhasil diganti dan tersimpan ke GitHub (rev ${rev}). Gunakan password/PIN baru saat masuk berikutnya.`;
    } catch(err) {hasil.className='kesalahan';hasil.textContent=err.message;}
    finally {sedang=false;tombol.disabled=false;}
  }},[
    el('p',{teks:'Ubah password/PIN akun yang sedang masuk. Password data tetap sama.'}),
    isian('Password / PIN lama',lama),isian('Password / PIN baru',baru,{bantuan:'Minimal 6 karakter.'}),
    isian('Ulangi password / PIN baru',ulang),hasil,tombol,
    el('p.bantuan',{teks:'Perubahan langsung disimpan ke GitHub dan memerlukan token pada perangkat ini. Tidak perlu menunggu simpan otomatis.'}),
  ]);
  kosongkan(wadah).append(el('div.lembar',{},[el('div.lembar-isi',{},[form])]));
}
export const admin = () => siapa()?.admin === true;
export const punya = (hak) => H.punya(siapa(), hak);
export const cakupan = (divisi) => H.cakupan(siapa(), divisi);
export const bolehHalaman = (halaman) => H.bolehHalaman(siapa(), halaman);
export const bolehInput = () => punya('input');
export function bolehUbah(tabel,r) { return H.bolehTransaksi(siapa(),'ubah',tabel,r,r,(id) => D.cari('sppb',id)); }
export function wajibAdmin() { if (!admin()) throw new Error('Hanya admin OJORA/KTU atau admin yang ditunjuk dapat mengubah pengaturan ini.'); }
export function jagaTransaksi(aksi, tabel, lama, baru) {
  if (!H.bolehTransaksi(siapa(), aksi, tabel, lama, baru, (id) => D.cari('sppb',id))) {
    throw new Error('Hak pengguna atau cakupan divisi tidak mengizinkan perubahan ini.');
  }
  if (!admin() && !punya('gudang') && tabel === 'material_masuk') {
    for (const r of [lama,baru]) if (r?.sppb_item_id) {
      const it = D.cari('sppb_items',r.sppb_item_id), s = it && D.cari('sppb',it.sppb_id);
      if (!s || !cakupan(s.divisi_pemohon)) throw new Error('Item SPPB yang dihubungkan berada di luar cakupan divisi Anda.');
    }
  }
}
export function jagaAcc(id, tahap, batal = false) {
  const s = D.cari('sppb',id);
  if (!s || !cakupan(s.divisi_pemohon) || !punya(tahap === 'ktu' ? 'ktu' : 'kepala') || (batal && !punya('batal'))) {
    throw new Error('Anda tidak berhak memberi keputusan pada tahap/divisi ini.');
  }
}
export function bolehAcc(s, tahap, batal = false) {
  try { jagaAcc(s.id, tahap, batal); return true; } catch { return false; }
}
export function jagaOrder(itemId) {
  const it = D.cari('sppb_items',itemId), s = it && D.cari('sppb',it.sppb_id);
  if (!s || !punya('order') || !cakupan(s.divisi_pemohon)) throw new Error('Tidak memiliki hak ceklis order untuk divisi ini.');
}

export async function masuk(wadah) {
  if (siapa()) return;
  return new Promise((selesai) => {
    const nama = el('input',{type:'text', autocomplete:'username', required:true, placeholder:'Nama pengguna'});
    const sandi = el('input',{type:'password', autocomplete:'current-password', required:true});
    const galat = el('div',{role:'alert'});
    const tombol = el('button.tombol-utama',{type:'submit',teks:'Masuk pengguna'});
    const form = el('form',{onsubmit:async(e) => {
      e.preventDefault(); tombol.disabled = true; kosongkan(galat);
      try {
        const p = daftar().find((p) => H.normal(p.username) === H.normal(nama.value) && p.aktif !== false);
        if (!p || !await H.periksaSandi(sandi.value,p.sandi)) throw new Error('Nama pengguna atau password/PIN salah.');
        sessionStorage.setItem(SESI,JSON.stringify({id:p.id,hash:p.sandi.hash}));
        sandi.value = ''; selesai();
      } catch(e) { galat.textContent = e.message; }
      finally { tombol.disabled = false; }
    }},[isian('Nama pengguna',nama),isian('Password / PIN pengguna',sandi),galat,tombol]);
    kosongkan(wadah).append(el('div.kunci',{},[el('div.kunci-kotak',{},[
      el('h1',{teks:'Masuk pengguna'}),el('p',{teks:'Data sudah terbuka. Masuk dengan identitas pengguna untuk melanjutkan.'}),form,
      el('p.bantuan',{teks:'Akses mengikuti pola payroll: pembatasan di aplikasi, bukan otorisasi server.'}),
      el('button.tombol-samar',{type:'button',teks:'Kembali ke password data',onclick:() => {keluar(); sessionStorage.removeItem('gudang.sandi'); location.reload();}}),
    ])]));
    nama.focus();
  });
}

export async function halamanPengguna(wadah) {
  wajibAdmin();
  const gambar = () => {
    kosongkan(wadah);
    const daftarIsi = el('div');
    for (const p of daftar().sort((a,b) => a.nama.localeCompare(b.nama,'id'))) {
      daftarIsi.append(el('div.lembar',{style:'margin-bottom:.8rem'},[el('div.lembar-isi',{},[
        el('h3',{teks:`${p.nama} (${p.username})`}),
        el('p',{teks:`${p.admin ? 'Admin / KTU · semua divisi' : `${p.peran || 'Pengguna'} · ${(p.divisi || []).join(', ') || 'belum ada divisi'}`} · ${p.aktif === false ? 'Nonaktif' : 'Aktif'}`}),
        el('p.bantuan',{teks:p.admin ? 'Semua hak, termasuk kelola pengguna.' : H.HAK.filter(([k]) => p.hak?.[k]).map(([,l]) => l).join(' · ') || 'Lihat saja'}),
        el('button.tombol-samar',{type:'button',teks:'Ubah pengguna & hak akses',disabled:!bisaEdit(),onclick:() => formPengguna(wadah,p,gambar)}),
      ])]));
    }
    taruh(wadah,el('h2',{teks:'Pengguna & hak akses'}),
      el('p.petunjuk',{teks:'OJORA adalah admin/KTU. Pengguna lain dapat diberi hak input, revisi, persetujuan, pembatalan, dan ceklis order per divisi. Semua pemegang password data dapat membaca isi berkas; pembatasan ini mengikuti pola payroll.'}),
      !bisaEdit() ? el('p.petunjuk',{teks:'Untuk menambah atau mengubah pengguna, pasang token GitHub di Pengaturan → Mode edit.'}) : null,
      el('button.tombol-utama',{type:'button',teks:'+ Tambah pengguna',disabled:!bisaEdit(),onclick:() => formPengguna(wadah,null,gambar)}),
      el('div',{style:'margin-top:1rem'},[daftarIsi]));
  };
  gambar();
}

function formPengguna(wadah,p,kembali) {
  wajibAdmin();
  const nama = el('input',{type:'text',nilai:p?.nama || '',required:true});
  const username = el('input',{type:'text',nilai:p?.username || '',required:true,autocomplete:'off',pattern:'[A-Za-z0-9_.-]{2,40}'});
  const password = el('input',{type:'password',autocomplete:'new-password',minlength:6,placeholder:p ? 'Kosongkan jika tetap' : 'Minimal 6 karakter',required:!p});
  const peran = el('select',{},[['mandor','Mandor'],['kepala','Kepala Divisi'],['gudang','Petugas Gudang'],['pusat','Kantor Pusat'],['lihat','Lihat saja'],['admin','Admin / KTU']].map(([v,l]) => el('option',{value:v,teks:l})));
  peran.value = p?.admin ? 'admin' : p?.peran || 'kepala';
  const aktif = el('input',{type:'checkbox',checked:p?.aktif !== false});
  const divisi = [...new Set([...D.baris('master_divisi').map((r) => r.nama), ...(p?.divisi || [])])].filter(Boolean).sort();
  const divInputs = divisi.map((d) => [d,el('input',{type:'checkbox',checked:p?.divisi?.some((v) => H.normal(v) === H.normal(d))})]);
  const hakInputs = H.HAK.map(([k,l]) => [k,l,el('input',{type:'checkbox',checked:p?.hak?.[k]})]);
  const terapkanPeran = () => {
    const preset = {mandor:['minta'],kepala:['kepala'],gudang:['input','revisi','gudang','opname'],pusat:['order'],lihat:[],admin:H.HAK.map(([k])=>k)}[peran.value];
    for (const [k,,inp] of hakInputs) inp.checked = preset.includes(k);
  };
  if (!p) terapkanPeran();
  peran.addEventListener('change',terapkanPeran);
  const galat = el('div',{role:'alert'});
  const tombol = el('button.tombol-utama',{type:'submit',teks:'Simpan pengguna'});
  const form = el('form',{onsubmit:async(e) => {
    e.preventDefault(); kosongkan(galat); tombol.disabled = true;
    try {
      wajibAdmin(); if (!bisaEdit()) throw new Error('Mode edit GitHub diperlukan.');
      if (!nama.value.trim() || !/^[A-Za-z0-9_.-]{2,40}$/.test(username.value.trim())) throw new Error('Nama wajib diisi; username 2–40 huruf/angka, titik, garis bawah, atau tanda minus.');
      if (daftar().some((r) => r.id !== p?.id && H.normal(r.username) === H.normal(username.value))) throw new Error('Username sudah dipakai.');
      if (password.value && password.value.length < 6) throw new Error('Password/PIN minimal 6 karakter.');
      if (!p && !password.value) throw new Error('Password/PIN wajib diisi.');
      if (p?.id === siapa()?.id && (!aktif.checked || peran.value !== 'admin')) throw new Error('Admin yang sedang masuk harus tetap aktif sebagai admin.');
      const dipilih = divInputs.filter(([,inp]) => inp.checked).map(([d]) => d);
      if (peran.value !== 'admin' && !dipilih.length) throw new Error('Pilih minimal satu divisi.');
      const sandi = password.value ? await H.hashSandi(password.value) : p.sandi;
      const nilai = {nama:nama.value.trim(),username:username.value.trim(),admin:peran.value === 'admin',peran:peran.value,aktif:aktif.checked,
        divisi:dipilih,hak:Object.fromEntries(hakInputs.map(([k,,inp]) => [k,inp.checked])),sandi};
      const users = D.web().pengguna ||= {};
      const sendiri = siapa()?.id;
      const id = p?.id || crypto.randomUUID();
      users[id] = nilai;
      if (id === sendiri) sessionStorage.setItem(SESI,JSON.stringify({id,hash:sandi.hash}));
      if (nilai.aktif && nilai.hak.kepala) {
        for (const d of dipilih) D.setKepalaDivisi(d,{nama:nilai.nama});
      }
      D.tandaiBerubah(); password.value = '';
      await simpanSekarang('Web: pengaturan pengguna');
      if (D.state.belumDisimpan) pesan('Pengguna tersimpan di draf perangkat; penyimpanan GitHub gagal. Coba tombol Simpan.', 'awas', 9);
      else pesan('Pengguna dan hak akses tersimpan.', 'sukses');
      kembali();
    } catch(e) { galat.textContent = e.message; }
    finally { tombol.disabled = false; }
  }},[
    el('h2',{teks:p ? 'Ubah pengguna' : 'Tambah pengguna'}),
    isian('Nama lengkap',nama),isian('Username',username),isian('Password / PIN',password),isian('Peran',peran),
    el('label',{},[aktif,' Aktif']),
    el('fieldset',{},[el('legend',{teks:'Divisi (admin mencakup semua divisi)'}),...divInputs.map(([d,inp]) => el('label',{style:'display:block'},[inp,` ${d}`]))]),
    el('fieldset',{},[el('legend',{teks:'Hak akses'}),...hakInputs.map(([,l,inp]) => el('label',{style:'display:block'},[inp,` ${l}`]))]),
    galat,el('div',{style:'display:flex;gap:.5rem;margin-top:1rem'},[tombol,el('button.tombol-samar',{type:'button',teks:'Batal',onclick:kembali})]),
  ]);
  kosongkan(wadah).append(el('div.lembar',{},[el('div.lembar-isi',{},[form])]));
}
