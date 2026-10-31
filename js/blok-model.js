const requireThat=(ok,msg)=>{if(!ok)throw Error(msg);};
export function bagiProporsi(total,bobot,desimal=2){
 const scale=10**desimal,t=Math.round(Number(total)*scale);
 requireThat(Number.isFinite(Number(total))&&total>0&&Math.abs(total*scale-t)<1e-6,'Jumlah tidak sesuai presisi satuan.');
 requireThat(bobot.length&&bobot.every(x=>Number.isFinite(Number(x))&&x>0),'Luas semua blok harus terisi dan lebih dari nol. Gunakan mode manual bila belum lengkap.');
 const sum=bobot.reduce((a,b)=>a+Number(b),0),raw=bobot.map(x=>t*x/sum),parts=raw.map(Math.floor);
 const order=raw.map((x,i)=>({i,sisa:x-parts[i]})).sort((a,b)=>b.sisa-a.sisa||a.i-b.i);
 const sisa=t-parts.reduce((a,b)=>a+b,0);for(let i=0;i<sisa;i++)parts[order[i].i]++;
 return parts.map(x=>x/scale);
}
