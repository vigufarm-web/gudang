// Nilai order per item. Harga kosong berbeda dari harga nol.
export function hitungHargaOrder({jumlah, cara, nilai}) {
  if (nilai === '' || nilai == null) return {hargaSatuan:null,totalBarang:null};
  const qty = Number(jumlah);
  const harga = Number(nilai);
  if (!(qty > 0) || !Number.isFinite(qty)) throw Error('Jumlah order harus lebih dari 0.');
  if (!Number.isFinite(harga) || harga < 0) throw Error('Harga harus berupa angka nol atau lebih.');
  if (cara !== 'satuan' && cara !== 'total') throw Error('Pilih harga per satuan atau total barang.');
  return cara === 'satuan'
    ? {hargaSatuan:harga,totalBarang:qty*harga}
    : {hargaSatuan:harga/qty,totalBarang:harga};
}

// FIFO dihitung ulang dari transaksi yang tersedia, bukan jurnal akuntansi terkunci.
export function biayaFifo(d, normal, satuan) {
  const kelompok = new Map(), hasil = [];
  const key = r => `${normal(r.material)}|${satuan(r.satuan)}`;
  const masuk = d.tabel?.material_masuk || [], keluar = d.tabel?.material_keluar || [];
  const ret = Object.values(d.web?.returPenerimaan || {});
  const opname = Object.values(d.web?.stokOpname || {}).filter(o => o.status === 'Disetujui');
  for (const r of [...masuk,...keluar]) {
    const k=key(r); if(!kelompok.has(k)) kelompok.set(k,[]);
    kelompok.get(k).push({jenis:masuk.includes(r)?'masuk':'keluar',r});
  }
  for (const [k,events] of kelompok) {
    // Retur dan opname membutuhkan urutan yang tidak selalu tersedia pada data lama.
    const rumit=ret.some(r=>key(r)===k)||opname.some(o=>(o.items||[]).some(r=>key(r)===k));
    const tanggalHilang=events.some(e=>!/^\d{4}-\d{2}-\d{2}$/.test(e.r.tanggal||''));
    const hariMasuk=new Map();
    for(const e of events.filter(x=>x.jenis==='masuk')) hariMasuk.set(e.r.tanggal,(hariMasuk.get(e.r.tanggal)||0)+1);
    const hariKeluar=new Map();for(const e of events.filter(x=>x.jenis==='keluar'))hariKeluar.set(e.r.tanggal,(hariKeluar.get(e.r.tanggal)||0)+1);
    const ambigu=events.some(e=>e.jenis==='keluar'&&((hariMasuk.get(e.r.tanggal)||0)>0||((hariKeluar.get(e.r.tanggal)||0)>1&&events.filter(x=>x.jenis==='masuk').length>1)));
    const tidakPasti=rumit||tanggalHilang||ambigu;
    events.sort((a,b)=>String(a.r.tanggal||'').localeCompare(String(b.r.tanggal||'')) || (a.jenis===b.jenis?String(a.r.id).localeCompare(String(b.r.id)):a.jenis==='masuk'?-1:1));
    const lapisan=[]; let negatif=false;
    for(const {jenis,r} of events) {
      const qty=Number(r.qty); if(!(qty>0))continue;
      if(jenis==='masuk') {
        const o=d.web?.pesanan?.[r.order_id], f=Number(o?.faktor_order)*Number(o?.faktor_stok);
        const barang=o?.harga_total_barang, status=o?.ongkir_status;
        const lengkap=barang!=null && Number.isFinite(Number(barang)) && f>0 && Number(o.qty_order)>0 && (status==='termasuk'||status==='terpisah'&&o.ongkir!=null&&Number.isFinite(Number(o.ongkir)));
        const harga=lengkap?(Number(barang)+(status==='terpisah'?Number(o.ongkir):0))/(Number(o.qty_order)*f):null;
        lapisan.push({sisa:qty,harga});
      } else {
        let sisa=qty, nilai=0, belum=0;
        for(const l of lapisan) {if(sisa<=1e-9)break;const q=Math.min(l.sisa,sisa);l.sisa-=q;sisa-=q;if(l.harga==null)belum+=q;else nilai+=q*l.harga;}
        if(sisa>1e-9){belum+=sisa;negatif=true;}
        hasil.push({baris:r,nilai:tidakPasti||negatif?null:Math.round(nilai),qtyBelum:tidakPasti||negatif?qty:belum,alasan:tidakPasti?'Riwayat retur, opname, tanggal, atau urutan penerimaan perlu diperiksa':negatif?'Riwayat stok tidak mencukupi':belum?'Harga belum tersedia':''});
      }
    }
  }
  return hasil;
}
