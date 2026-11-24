import * as N from './native.js';
const VERSION=__APP_VERSION__;

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY=864e5;
const pd=s=>{if(!s)return null;const[a,b,c]=String(s).split('-').map(Number);return a?new Date(a,b-1,c):null};
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const add=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const today=()=>{const t=new Date();return new Date(t.getFullYear(),t.getMonth(),t.getDate())};
const diff=(a,b)=>Math.round((a-b)/DAY);
const fmt=d=>d.toLocaleDateString('es-MX',{day:'numeric',month:'short'});
const fmtY=d=>d.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const safeImg=s=>typeof s==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(s)?s:'';
const PAW='<svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true"><g fill="currentColor" opacity=".35"><ellipse cx="32" cy="42" rx="13" ry="11"/><ellipse cx="17" cy="26" rx="6" ry="8"/><ellipse cx="47" cy="26" rx="6" ry="8"/><ellipse cx="25" cy="14" rx="5" ry="7"/><ellipse cx="39" cy="14" rx="5" ry="7"/></g></svg>';

let dogs=[],view='agenda',cur=null,notifState='?';
let saving=Promise.resolve(),resched=null;
function persist(){saving=saving.then(()=>N.saveDogs(dogs)).catch(()=>toast('No se pudo guardar en el teléfono'));clearTimeout(resched);resched=setTimeout(reschedule,800)}
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',2600)}
const q={};
function saveDog(d){d.updated=Date.now();const i=dogs.findIndex(x=>x.id===d.id);if(i<0)dogs.push(d);else dogs[i]=d;render();
  persist()}
function delDog(id){dogs=dogs.filter(x=>x.id!==id);persist();cur=null;view='perros';render()}
const byId=id=>dogs.find(d=>d.id===id);

/* ---- biología (estimaciones generales) ---- */
function age(b){const d=pd(b);if(!d)return'';const m=(today().getFullYear()-d.getFullYear())*12+today().getMonth()-d.getMonth()-(today().getDate()<d.getDate()?1:0);
  return m<12?m+(m===1?' mes':' meses'):Math.floor(m/12)+(Math.floor(m/12)===1?' año':' años')+(m%12?' '+m%12+' m':'')}
function heats(d){return(d.heats||[]).map(h=>pd(h.start)).filter(Boolean).sort((a,b)=>a-b)}
function interval(d){if(+d.interval>=90)return+d.interval;const h=heats(d);if(h.length<2)return 180;
  const ds=[];for(let i=1;i<h.length;i++){const x=diff(h[i],h[i-1]);if(x>=100&&x<=420)ds.push(x)}return ds.length?Math.round(ds.reduce((a,b)=>a+b)/ds.length):180}
function preg(d){return(d.breedings||[]).filter(b=>(b.status==='pendiente'||b.status==='confirmada')&&!b.birth&&pd(b.date)&&diff(today(),pd(b.date))<=72).sort((a,b)=>pd(b.date)-pd(a.date))[0]}
function phase(day){return day<=9?['Proestro','heat']:day<=14?['Estro · fértil','fert']:day<=70?['Diestro','']:['Anestro','']}
/* progesterona (ng/mL): <2 basal · ~2 pico LH · 5–10 ovulación · óvulos maduros ~2 días después */
const NMOL=3.18;
function progs(h){return(h.progs||[]).filter(p=>pd(p.date)&&isFinite(p.v)).sort((a,b)=>a.date.localeCompare(b.date))}
function heatFor(d,dt){return(d.heats||[]).filter(h=>{const n=diff(dt,pd(h.start));return n>=-3&&n<=30}).sort((a,b)=>b.start.localeCompare(a.start))[0]}
function ovul(h){if(!h)return null;const ps=progs(h);let lh=null,ov=null,late=false;
  for(let i=0;i<ps.length;i++){const p=ps[i],dt=pd(p.date);if(!lh&&p.v>=2)lh=dt;if(!ov&&p.v>=5){ov=p.v>10?add(dt,-1):dt;late=p.v>10||(i>0&&ps[i-1].v<2)}}
  if(!ov&&lh)ov=add(lh,2);const conf=ps.some(p=>p.v>=5);return lh||ov?{lh,ov,conf,late}:null}
function progRead(v){return v<1?['Basal','Repetir en 2–3 días.','']:v<2?['Subiendo','Repetir en 24–48 h: se acerca el pico de LH.','']:v<5?['Pico de LH','Ovulación en ~2 días. Repetir en 24–48 h.','fert']:v<=10?['Ovulación','Cruzar 2 y 4 días después de la ovulación.','heat']:['Óvulos maduros','Ventana fértil activa: cruza ya (natural o semen fresco).','heat']}
function base(d,b){const ov=ovul(heatFor(d,pd(b.date)));return ov&&ov.conf&&Math.abs(diff(pd(b.date),ov.ov))<=8?{d0:ov.ov,ov:1}:{d0:pd(b.date),ov:0}}
function gestSteps(d,b){const{d0,ov}=base(d,b);return[[25,'Ultrasonido de confirmación (días 25–30)'],[45,'Radiografía para contar cachorros (día 45+)'],[55,'Preparar paridera y cambiar a alimento de cachorro'],[57,'Tomar temperatura 2 veces al día (bajo 37.5 °C ≈ parto en 24 h)'],[ov?62:58,ov?'Inicia ventana de parto (62–64 días desde ovulación)':'Inicia ventana de parto (días 58–68)'],[63,'Fecha probable de parto'],[ov?65:68,'Si no hay parto, consulta al veterinario']].map(([n,t])=>({date:add(d0,n),t,n}))}
function events(d){const out=[],t=today();
  if(d.sex==='H'){const h=heats(d),p=preg(d);
    if(p){gestSteps(d,p).forEach(s=>out.push({date:s.date,t:s.t,k:'gest',dog:d}))}
    else if(h.length){const last=h[h.length-1],L=interval(d);let day=diff(t,last)+1;let on=last;
      if(day>21){on=add(last,L);while(diff(on,t)<-21)on=add(on,L)}
      out.push({date:on,t:diff(on,t)<0?'Inició celo (registrado/estimado)':'Celo esperado',k:'heat',dog:d,est:on!==last});
      const ov=on===last?ovul(heatFor(d,last)):null;
      if(ov&&ov.ov){if(ov.lh)out.push({date:ov.lh,t:'Pico de LH (por progesterona)',k:'fert',dog:d});
        out.push({date:ov.ov,t:ov.conf?'Ovulación (por progesterona)':'Ovulación estimada (pico LH + 2 días)',k:'fert',dog:d});
        out.push({date:add(ov.ov,2),t:'Monta ideal #1 (ovulación + 2 días)',k:'fert',dog:d});
        out.push({date:add(ov.ov,4),t:'Monta ideal #2 (ovulación + 4 días)',k:'fert',dog:d})}
      else{const lp=on===last&&heatFor(d,last)?progs(heatFor(d,last)).pop():null;
      out.push({date:add(on,lp?Math.max(diff(t,on),0):4),t:lp?'Siguiente prueba de progesterona: '+progRead(lp.v)[1]:'Iniciar pruebas de progesterona (día 5 del celo)',k:'fert',dog:d});
      out.push({date:add(on,9),t:'Ventana de cruza: días 10–14 del celo',k:'fert',dog:d});
      out.push({date:add(on,10),t:'Monta ideal #1 (día 11)',k:'fert',dog:d});
      out.push({date:add(on,12),t:'Monta ideal #2 (día 13)',k:'fert',dog:d})}
      out.push({date:add(on,-14),t:'Aviso: celo en 2 semanas — agenda progesterona y al macho',k:'heat',dog:d})}}
  (d.breedings||[]).forEach(b=>{if(b.birth){const bd=pd(b.birth);out.push({date:add(bd,45),t:'Se abre trámite de pedigrí FCM (cachorros de 1½ meses)',k:'',dog:d});out.push({date:add(bd,255),t:'Últimos días para pedigrí FCM (antes de 9 meses)',k:'',dog:d})}});
  return out}
function allEvents(){return dogs.flatMap(events).filter(e=>diff(e.date,today())>=-2&&diff(e.date,today())<=365).sort((a,b)=>a.date-b.date)}

/* ---- anillo ---- */
function arc(r,a0,a1,col,w){const C=2*Math.PI*r,len=Math.max(0,a1-a0)*C;return`<circle cx="60" cy="60" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-dasharray="${len} ${C}" stroke-dashoffset="${-a0*C}" transform="rotate(-90 60 60)"/>`}
function ring(d){const t=today(),p=preg(d),h=heats(d);
  if(p){const b0=base(d,p).d0,n=diff(t,b0),f=Math.max(0,Math.min(1,n/63)),ang=f*2*Math.PI;
    return{svg:`<svg viewBox="0 0 120 120">${arc(46,0,1,'var(--line)',14)}${arc(46,0,f,'var(--gest)',14)}${arc(46,58/63,68/63>1?1:1,'#13958f55',14)}<circle class="mk" cx="${60+46*Math.sin(ang)}" cy="${60-46*Math.cos(ang)}" r="9" fill="var(--bg)" stroke="var(--gest)" stroke-width="4"/><text x="60" y="58" text-anchor="middle" font-size="22" font-weight="900" fill="currentColor">${n}</text><text x="60" y="76" text-anchor="middle" font-size="11" fill="currentColor">de 63 días</text></svg>`,
      lab:'Gestación',k:'gest',sub:'Parto probable '+fmt(add(b0,63))}}
  if(!h.length)return{svg:`<svg viewBox="0 0 120 120">${arc(46,0,1,'var(--line)',14)}<text x="60" y="66" text-anchor="middle" font-size="13" font-weight="800" fill="currentColor">Sin datos</text></svg>`,lab:'Registra su último celo',k:'',sub:'para calcular el siguiente'};
  const L=interval(d),last=h[h.length-1];let day=diff(t,last)+1;const over=day>L;const pos=Math.min(day,L)/L,ang=pos*2*Math.PI;
  const [lab,k]=over?['Celo atrasado','heat']:phase(day);const next=add(last,L);
  return{svg:`<svg viewBox="0 0 120 120">${arc(46,0,1,'var(--line)',14)}${arc(46,0,9/L,'var(--heat)',14)}${arc(46,9/L,14/L,'var(--fert)',14)}${arc(46,14/L,70/L,'#b58fb3',14)}<circle class="mk" cx="${60+46*Math.sin(ang)}" cy="${60-46*Math.cos(ang)}" r="9" fill="var(--bg)" stroke="currentColor" stroke-width="4"/><text x="60" y="58" text-anchor="middle" font-size="22" font-weight="900" fill="currentColor">${over?'+'+(day-L):day}</text><text x="60" y="76" text-anchor="middle" font-size="11" fill="currentColor">${over?'días tarde':'día del ciclo'}</text></svg>`,
    lab,k,sub:(diff(next,t)>0?'Próximo celo ~'+fmt(next)+' · en '+diff(next,t)+' días':'Revisa si ya inició su celo')}}

/* ---- vistas ---- */
function photo(d){const s=safeImg(d.photo);return s?`<img src="${esc(s)}" alt="">`:PAW}
function rel(dt){const n=diff(dt,today());return n===0?'hoy':n===1?'mañana':n===-1?'ayer':n<0?'hace '+(-n)+' d':'en '+n+' días'}
function vAgenda(){const fem=dogs.filter(d=>d.sex==='H');const ev=allEvents();
  if(!dogs.length)return`<h2>Tu agenda de cría</h2><div class="empty">${PAW}<h3>Agrega a tu primera hembra</h3><p class="note">Registra la fecha de su último celo y la app calcula el siguiente, la ventana de cruza y, si la cruzas, la fecha de parto.</p><button class="btn" data-act="new">Agregar perro</button></div>`;
  return`<div class="row" style="justify-content:space-between"><h2>Tu agenda de cría</h2>${ev.length?'<button class="btn ghost" data-act="ics">Agregar avisos a mi calendario</button>':''}</div>
  ${fem.length?`<div class="rings">${fem.map(d=>{const r=ring(d);return`<button class="ring" data-dog="${esc(d.id)}">${r.svg}<div><b>${esc(d.name)}</b><span class="chip ${r.k}">${esc(r.lab)}</span><div class="note" style="margin-top:6px">${esc(r.sub)}</div></div></button>`}).join('')}</div>`:'<p class="note">Agrega hembras para ver sus ciclos.</p>'}
  <h3>Próximos eventos</h3>${ev.length?`<ul class="ev">${ev.slice(0,14).map(e=>`<li><div class="d">${fmt(e.date)}<span>${rel(e.date)}</span></div><div><span class="dot" style="background:${e.k==='heat'?'var(--heat)':e.k==='fert'?'var(--fert)':e.k==='gest'?'var(--gest)':'#4a78c9'}"></span><b>${esc(e.dog.name)}</b> — ${esc(e.t)}${e.est?' <span class="note">(estimado)</span>':''}</div><span class="chip ${e.k}">${e.k==='heat'?'Celo':e.k==='fert'?'Cruza':e.k==='gest'?'Gestación':'Pedigrí'}</span></li>`).join('')}</ul>`:'<p class="note">Sin eventos próximos. Registra celos o cruzas en la ficha de cada perro.</p>'}
  ${N.canNotify&&notifState!=='granted'?'<div class="card"><b>Activa las notificaciones</b><p class="note">Para avisarte de celos, pruebas, cruzas y partos aunque no abras la app.</p><button class="btn sm" data-act="notif">Activar avisos</button></div>':''}`}
function vPerros(){return`<div class="row" style="justify-content:space-between"><h2>Mis perros</h2><button class="btn" data-act="new">Agregar perro</button></div>
  ${dogs.length?`<div class="dogs">${[...dogs].sort((a,b)=>a.name.localeCompare(b.name)).map(d=>{const r=d.sex==='H'?ring(d):null;return`<button class="dog" data-dog="${esc(d.id)}"><div class="ph">${photo(d)}</div><div class="t"><b>${esc(d.name)}</b> <span class="chip">${d.sex==='H'?'Hembra':'Macho'}</span><div class="note">${esc(d.breed||'Sin raza')}${d.birth?' · '+age(d.birth):''}</div>${r?`<div style="margin-top:6px"><span class="chip ${r.k}">${esc(r.lab)}</span></div>`:''}</div></button>`}).join('')}</div>`:`<div class="empty">${PAW}<p>Aún no hay perros registrados.</p></div>`}`}
function vAyuda(){return`<h2>Respaldo y ajustes</h2>
  <div class="card"><h3>Respaldo</h3><p>Tus datos viven solo en este teléfono. Exporta un respaldo de vez en cuando (guárdalo en Drive, WhatsApp o correo) y úsalo para pasar tus perros a otro teléfono.</p>
  <div class="row"><button class="btn" data-act="backup">Exportar respaldo</button><label class="btn ghost" style="margin:0;display:inline-flex;align-items:center">Importar respaldo<input type="file" id="rFile" accept="application/json,.json" hidden></label></div></div>
  <div class="card"><h3>Avisos</h3>${N.canNotify?`<p>Notificaciones: <b>${notifState==='granted'?'activadas':'desactivadas'}</b>. Te avisan a las 9:00 el día de cada evento, y la noche anterior al celo esperado, a la monta ideal y al parto probable.</p><div class="row">${notifState!=='granted'?'<button class="btn" data-act="notif">Activar avisos</button>':''}<button class="btn ghost" data-act="testnotif">Probar aviso</button></div>`:'<p>En iPhone la app web no puede programar notificaciones. Usa «Agregar avisos a mi calendario» en la Agenda: tu calendario te avisará.</p>'}
  <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="ics">Exportar eventos al calendario (.ics)</button></div></div>
  <p class="note">Versión ${esc(VERSION)} · ${esc(N.platform)}</p>
  <h2 style="margin-top:30px">Cómo calcula la app</h2>
  <div class="card"><h3>Ciclo de celo</h3><p>El día 1 es el primer día de sangrado. Proestro ≈ días 1–9; estro (receptiva) ≈ días 10–14, con ovulación hacia el día 12. Se sugieren dos montas con 48 h de diferencia (días 11 y 13). El intervalo entre celos se promedia de los que registres; si hay menos de dos, se asume 6 meses (lo normal va de 5 a 12 según raza).</p><p class="note">Cada perra varía mucho. La prueba de progesterona con tu veterinario es la forma precisa de ubicar la ovulación.</p></div>
  <div class="card"><h3>Progesterona</h3><p>Registra cada prueba en la ficha de la hembra (en ng/mL o nmol/L; 1 ng/mL ≈ 3.18 nmol/L). Referencias usuales: menos de 2 ng/mL basal; ≈2 pico de LH; 5–10 ovulación; los óvulos maduran unos 2 días después. Cuando hay lecturas, la app cambia las fechas de cruza a ovulación + 2 y + 4 días, y calcula el parto a 63 días de la ovulación (62–64), que es más preciso que contar desde la monta.</p><p class="note">Los rangos varían entre laboratorios y para inseminación con semen refrigerado o congelado el momento cambia: confírmalo con tu veterinario.</p></div>
  <div class="card"><h3>Gestación</h3><p>Se cuenta desde la primera monta: parto probable al día 63, normal entre 58 y 68. Hitos: ultrasonido días 25–30, radiografía día 45+, temperatura desde el día 57.</p></div>
  
  <div class="card"><h3>FCM y árbol genealógico</h3><p>La Federación Canófila Mexicana no ofrece una base pública ni API para consultar genealogías. Sí tiene un cotejo en línea que confirma si un registro existe, con el número completo (tatuaje, p. ej. FCMX0000-A) y la fecha de nacimiento.</p><p><a href="https://fcm.mx/cotejar-registro-ante-fcm/" target="_blank" rel="noopener">Abrir cotejo de registro FCM ↗</a></p><p>Por eso el árbol se arma con los datos impresos en el pedigrí (3 generaciones). Si vinculas a un padre o madre que ya tengas en la app, se copian sus ancestros automáticamente.</p></div>`}
function vDog(d){const r=d.sex==='H'?ring(d):null;const h=(d.heats||[]).slice().sort((a,b)=>b.start.localeCompare(a.start));
  const males=dogs.filter(x=>x.sex==='M'&&x.id!==d.id);
  return`<button class="btn ghost sm" data-act="back">← Volver</button>
  <div class="head" style="margin-top:14px"><div class="ph">${photo(d)}</div><div><h2>${esc(d.name)}</h2><div class="row" style="margin-top:6px"><span class="chip">${d.sex==='H'?'Hembra':'Macho'}</span>${r?`<span class="chip ${r.k}">${esc(r.lab)}</span>`:''}</div>
  <div class="row" style="margin-top:10px"><button class="btn sm" data-act="edit">Editar datos</button></div></div></div>
  <div class="facts"><div><span>Raza</span>${esc(d.breed||'—')}</div><div><span>Nacimiento</span>${d.birth?fmtY(pd(d.birth))+' · '+age(d.birth):'—'}</div><div><span>Registro FCM</span>${esc(d.reg||'—')}</div><div><span>Microchip</span>${esc(d.chip||'—')}</div><div><span>Color</span>${esc(d.color||'—')}</div>${d.sex==='H'?`<div><span>Intervalo entre celos</span>${interval(d)} días${+d.interval>=90?' (fijo)':''}</div>`:''}</div>
  ${d.notes?`<p class="note">${esc(d.notes)}</p>`:''}
  ${d.reg?`<p><a href="https://fcm.mx/cotejar-registro-ante-fcm/" target="_blank" rel="noopener">Cotejar ${esc(d.reg)} en la FCM ↗</a></p>`:''}
  ${d.sex==='H'?`<section class="sec"><h3>Celos</h3><div class="row" style="margin-top:10px"><input type="date" id="hDate" value="${iso(today())}" style="max-width:200px"><button class="btn" data-act="heat">Registrar inicio de celo</button></div>
    ${h.length?`<ul class="tl">${h.map(x=>`<li><b>${fmtY(pd(x.start))}</b><span>${esc(x.notes||'')}${(x.progs||[]).length?' · '+x.progs.length+' prueba'+(x.progs.length>1?'s':'')+' de progesterona':''}</span><button class="btn del sm" data-act="delheat" data-v="${esc(x.start)}">Quitar</button></li>`).join('')}</ul>${progCard(d)}`:'<p class="note">Registra el primer día de sangrado de su último celo.</p>'}
    ${r&&!preg(d)&&heats(d).length?`<div class="card"><b>Mejores fechas de cruza del próximo celo</b>${(()=>{const e=events(d).filter(x=>x.k==='fert');return`<ul class="tl">${e.map(x=>`<li><b>${fmt(x.date)}</b>${esc(x.t)}</li>`).join('')}</ul>`})()}<p class="note">Confirma con prueba de progesterona: el día real puede moverse varios días.</p></div>`:''}</section>
  <section class="sec"><h3>Cruzas y partos</h3>
    ${(d.breedings||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)).map(b=>brCard(d,b)).join('')||'<p class="note">Sin cruzas registradas.</p>'}
    <div class="card"><b>Registrar cruza</b><div class="g2"><div><label for="bD1">Primera monta</label><input type="date" id="bD1" value="${iso(today())}"></div><div><label for="bD2">Segunda monta (opcional)</label><input type="date" id="bD2"></div></div>
    <label for="bM">Macho</label><select id="bM">${males.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}${m.reg?' · '+esc(m.reg):''}</option>`).join('')}<option value="_">Otro macho (externo)</option></select>
    <div class="g2" id="bExt"${males.length?' hidden':''}><div><label for="bMN">Nombre del macho</label><input id="bMN"></div><div><label for="bMR">Registro FCM</label><input id="bMR"></div></div>
    <div style="margin-top:12px"><button class="btn" data-act="breed">Guardar cruza</button></div></div></section>`:''}
  <section class="sec"><h3>Árbol genealógico</h3><p class="note">Toca una casilla para escribir nombre y registro, o vincular a un perro tuyo.</p><div class="scroll">${tree(d)}</div></section>
  <section class="sec"><button class="btn del" data-act="del">Eliminar a ${esc(d.name)}</button></section>`}
let selHeat=null,progUnit='ng';
function progCard(d){const hs=(d.heats||[]).slice().sort((a,b)=>b.start.localeCompare(a.start));const h=hs.find(x=>x.start===selHeat)||hs[0];const s0=pd(h.start),ps=progs(h),ov=ovul(h);
  const mx=Math.max(20,...ps.map(p=>p.v));
  return`<div class="card"><div class="row" style="justify-content:space-between"><b>Pruebas de progesterona</b>${hs.length>1?`<select data-act="pheat" style="max-width:230px">${hs.map(x=>`<option value="${esc(x.start)}"${x===h?' selected':''}>Celo del ${fmtY(pd(x.start))}</option>`).join('')}</select>`:`<span class="note">Celo del ${fmtY(s0)}</span>`}</div>
  ${ps.length?`<div class="pl">${ps.map(p=>{const r=progRead(p.v);return`<div class="pr"><div><b>${fmt(pd(p.date))}</b><span class="note"> día ${diff(pd(p.date),s0)+1}</span></div><div class="pb"><i style="width:${Math.max(3,p.v/mx*100)}%;background:${r[2]==='heat'?'var(--heat)':r[2]==='fert'?'var(--fert)':'#b58fb3'}"></i></div><div class="pv">${(+p.v).toFixed(1)}</div><span class="chip ${r[2]}">${r[0]}</span><button class="btn del sm" data-act="delprog" data-v="${esc(p.id)}" aria-label="Quitar prueba">×</button></div>`}).join('')}</div>
  <p class="note" style="margin:6px 0 0">Valores en ng/mL. ${esc(progRead(ps[ps.length-1].v)[1])}</p>`:'<p class="note">Empieza hacia el día 5 del celo y repite cada 2–3 días; cada 24–48 h cuando pase de 2 ng/mL.</p>'}
  ${ov?`<ul class="tl" style="margin-top:10px">${ov.lh?`<li><b>${fmt(ov.lh)}</b>Pico de LH (≈2 ng/mL)</li>`:''}<li><b>${fmt(ov.ov)}</b>${ov.conf?'Ovulación (5–10 ng/mL)':'Ovulación estimada (LH + 2 días)'}</li><li><b>${fmt(add(ov.ov,2))}</b>Monta ideal #1 (ovulación + 2)</li><li><b>${fmt(add(ov.ov,4))}</b>Monta ideal #2 (ovulación + 4)</li><li><b>${fmt(add(ov.ov,63))}</b>Parto probable si queda gestante (62–64 días)</li></ul>${ov.late?'<p class="note">Faltan lecturas alrededor del cambio de valores; la ovulación es aproximada (±1–2 días).</p>':''}`:''}
  <div class="row" style="margin-top:12px"><input type="date" id="pD" value="${iso(today())}" aria-label="Fecha de la prueba" style="max-width:170px"><input type="number" id="pV" step="0.1" min="0" inputmode="decimal" placeholder="Valor" aria-label="Valor" style="max-width:110px"><select id="pU" data-act="punit" aria-label="Unidad" style="max-width:120px"><option value="ng"${progUnit==='ng'?' selected':''}>ng/mL</option><option value="nmol"${progUnit==='nmol'?' selected':''}>nmol/L</option></select><input id="pN" placeholder="Lab o nota (opcional)" aria-label="Nota" style="max-width:220px"><button class="btn" data-act="prog">Agregar prueba</button></div></div>`}
function brCard(d,b){const m=b.maleId&&byId(b.maleId);const mn=m?m.name:(b.maleName||'Macho sin nombre');const B=base(d,b),d0=B.d0;const n=diff(today(),d0);
  const active=(b.status==='pendiente'||b.status==='confirmada')&&!b.birth;
  return`<div class="card"><div class="row" style="justify-content:space-between"><div><b>${fmtY(pd(b.date))}${b.date2?' y '+fmt(pd(b.date2)):''}</b> con ${esc(mn)}${!m&&b.maleReg?' <span class="note">'+esc(b.maleReg)+'</span>':''}</div>
  <select data-act="bstat" data-b="${esc(b.id)}" style="max-width:170px">${[['pendiente','Por confirmar'],['confirmada','Gestación confirmada'],['parto','Parto'],['fallida','No quedó gestante']].map(([v,l])=>`<option value="${v}"${b.status===v?' selected':''}>${l}</option>`).join('')}</select></div>
  ${active?`<div class="bar"><i style="width:${Math.min(100,Math.max(0,n/63*100))}%"></i></div><div class="note">Día ${n} de 63 ${B.ov?'desde la ovulación':'desde la monta'} · parto probable <b>${fmtY(add(d0,63))}</b> (entre ${fmt(add(d0,B.ov?62:58))} y ${fmt(add(d0,B.ov?64:68))})${B.ov?' · calculado con progesterona':''}</div><ul class="tl">${gestSteps(d,b).map(s=>`<li class="${diff(s.date,today())<0?'past':''}"><b>${fmt(s.date)}</b>${esc(s.t)}</li>`).join('')}</ul>`:''}
  ${b.status==='parto'||b.birth?`<div class="g2"><div><label>Fecha de parto</label><input type="date" data-act="bbirth" data-b="${esc(b.id)}" value="${esc(b.birth||'')}"></div><div><label>Cachorros (machos / hembras)</label><div class="row"><input type="number" min="0" data-act="bpm" data-b="${esc(b.id)}" value="${esc(b.pm??'')}" style="width:80px"><input type="number" min="0" data-act="bph" data-b="${esc(b.id)}" value="${esc(b.ph??'')}" style="width:80px"></div></div></div>
  ${b.birth?`<p class="note">Pedigrí FCM: entre ${fmtY(add(pd(b.birth),45))} y ${fmtY(add(pd(b.birth),270))}.</p><button class="btn ghost sm" data-act="pup" data-b="${esc(b.id)}">Agregar cachorro de esta camada</button>`:''}`:''}
  <div><button class="btn del sm" data-act="delbr" data-b="${esc(b.id)}">Quitar cruza</button></div></div>`}

/* ---- pedigrí ---- */
const POS=[['S',1,4,2,'Padre'],['D',5,4,2,'Madre'],['SS',1,2,3,'Abuelo pat.'],['SD',3,2,3,'Abuela pat.'],['DS',5,2,3,'Abuelo mat.'],['DD',7,2,3,'Abuela mat.'],
 ['SSS',1,1,4],['SSD',2,1,4],['SDS',3,1,4],['SDD',4,1,4],['DSS',5,1,4],['DSD',6,1,4],['DDS',7,1,4],['DDD',8,1,4]];
function slotData(d,k){const s=(d.ped||{})[k];if(!s)return null;const l=s.dogId&&byId(s.dogId);return l?{name:l.name,reg:l.reg,linked:1}:s}
function tree(d){return`<div class="tree"><div class="slot me" style="grid-row:1/9;grid-column:1"><b>${esc(d.name)}</b><em>${esc(d.reg||'')}</em></div>${POS.map(([k,r,sp,c,lab])=>{const s=slotData(d,k);
  return`<button class="slot ${k.slice(-1)==='S'?'s':'d'} ${s?'':'nil'}" data-act="slot" data-k="${k}" style="grid-row:${r}/span ${sp};grid-column:${c}">${s?`<b>${esc(s.name||'—')}</b><em>${esc(s.reg||'')}${s.linked?' · en la app':''}</em>`:`<em>${lab||(k.slice(-1)==='S'?'Bisabuelo':'Bisabuela')}</em>+ Agregar`}</button>`}).join('')}</div>`}
function linkInto(ped,k,dogId){const src=byId(dogId);if(!src)return;ped[k]={dogId};Object.entries(src.ped||{}).forEach(([kk,v])=>{if((k+kk).length<=3)ped[k+kk]=JSON.parse(JSON.stringify(v))})}

/* ---- formularios ---- */
function open(html){$('#sheet').innerHTML=html;$('#ov').classList.add('on');const f=$('#sheet input,#sheet select');f&&f.focus()}
function close(){$('#ov').classList.remove('on')}
let pendingPhoto=null,preset=null;
function dogForm(d){pendingPhoto=d?d.photo||null:null;d=d||{sex:'H',...(preset||{})};
  open(`<h2>${d.id?'Editar '+esc(d.name):'Nuevo perro'}</h2><form id="df">
  <div class="row" style="margin-top:12px"><div class="ph" id="pv" style="width:96px;height:96px;border-radius:18px">${photo({photo:pendingPhoto})}</div><label class="btn ghost sm" style="margin:0">Elegir foto<input type="file" id="fP" accept="image/*" hidden></label></div>
  <label for="fN">Nombre</label><input id="fN" required value="${esc(d.name||'')}">
  <div class="g2"><div><label for="fS">Sexo</label><select id="fS"><option value="H"${d.sex==='H'?' selected':''}>Hembra</option><option value="M"${d.sex==='M'?' selected':''}>Macho</option></select></div><div><label for="fB">Nacimiento</label><input type="date" id="fB" value="${esc(d.birth||'')}"></div></div>
  <div class="g2"><div><label for="fR">Raza</label><input id="fR" value="${esc(d.breed||'')}"></div><div><label for="fC">Color</label><input id="fC" value="${esc(d.color||'')}"></div></div>
  <div class="g2"><div><label for="fG">Registro FCM (pedigrí)</label><input id="fG" placeholder="FCMX0000-A" value="${esc(d.reg||'')}"></div><div><label for="fM">Microchip</label><input id="fM" inputmode="numeric" value="${esc(d.chip||'')}"></div></div>
  <label for="fI">Intervalo entre celos fijo, en días (opcional)</label><input id="fI" type="number" min="90" max="420" placeholder="Se calcula solo" value="${esc(d.interval||'')}">
  <label for="fT">Notas</label><textarea id="fT" rows="2">${esc(d.notes||'')}</textarea>
  <div class="row" style="margin-top:18px"><button class="btn" type="submit">Guardar</button><button class="btn ghost" type="button" data-act="close">Cancelar</button></div></form>`);
  $('#fP').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,360/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);pendingPhoto=c.toDataURL('image/jpeg',.8);$('#pv').innerHTML=photo({photo:pendingPhoto})};im.src=rd.result};rd.readAsDataURL(f)};
  $('#df').onsubmit=e=>{e.preventDefault();const n=$('#fN').value.trim();if(!n)return;const base=d.id?JSON.parse(JSON.stringify(byId(d.id))):{id:uid(),heats:[],breedings:[],ped:d.ped||{}};
    Object.assign(base,{name:n,sex:$('#fS').value,birth:$('#fB').value,breed:$('#fR').value.trim(),color:$('#fC').value.trim(),reg:$('#fG').value.trim(),chip:$('#fM').value.trim(),interval:+$('#fI').value||null,notes:$('#fT').value.trim(),photo:pendingPhoto||null});
    preset=null;close();cur=base.id;view='dog';saveDog(base);toast('Guardado')}}
function slotForm(d,k){const s=(d.ped||{})[k]||{};const others=dogs.filter(x=>x.id!==d.id&&x.sex===(k.slice(-1)==='S'?'M':'H'));
  open(`<h3>${k.length===1?(k==='S'?'Padre':'Madre'):'Ancestro'} de ${esc(d.name)}</h3>
  ${others.length?`<label for="sL">Vincular a uno de mis perros</label><select id="sL"><option value="">— No, escribir datos —</option>${others.map(o=>`<option value="${esc(o.id)}"${s.dogId===o.id?' selected':''}>${esc(o.name)}</option>`).join('')}</select>`:''}
  <label for="sN">Nombre</label><input id="sN" value="${esc(s.name||'')}"><label for="sR">Registro FCM / título</label><input id="sR" value="${esc(s.reg||'')}">
  <div class="row" style="margin-top:16px"><button class="btn" data-act="slotok" data-k="${k}">Guardar</button>${s.name||s.dogId?`<button class="btn del" data-act="slotdel" data-k="${k}">Borrar</button>`:''}<button class="btn ghost" data-act="close">Cancelar</button></div>`)}

/* ---- .ics ---- */
async function ics(){const ev=allEvents().filter(e=>diff(e.date,today())>=0);if(!ev.length)return toast('No hay eventos próximos');
  const D=x=>iso(x).replace(/-/g,''),st=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z',cl=s=>s.replace(/[\\,;]/g,m=>'\\'+m).replace(/\n/g,' ');
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Celos y Camadas//ES','CALSCALE:GREGORIAN'];
  ev.forEach((e,i)=>{L.push('BEGIN:VEVENT','UID:'+D(e.date)+'-'+i+'-'+e.dog.id+'@celos','DTSTAMP:'+st,'DTSTART;VALUE=DATE:'+D(e.date),'DTEND;VALUE=DATE:'+D(add(e.date,1)),'SUMMARY:'+cl('🐾 '+e.dog.name+': '+e.t));
    (e.k==='heat'&&/esperado/.test(e.t)?['-P7D','-PT15H']:['-PT15H']).forEach(tr=>L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+cl(e.dog.name+': '+e.t),'TRIGGER:'+tr,'END:VALARM'));L.push('END:VEVENT')});
  L.push('END:VCALENDAR');try{await N.shareFile('celos-y-camadas.ics',L.join('\r\n'),'text/calendar');toast(N.isNative?'Elige tu app de Calendario':'Abre el archivo para agregarlo a tu calendario')}catch(e){toast('No se pudo exportar')}}

/* ---- render y eventos ---- */
function render(){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===view||(view==='dog'&&b.dataset.v==='perros')));
  const d=cur&&byId(cur);$('#app').innerHTML=view==='dog'&&d?vDog(d):view==='perros'?vPerros():view==='ayuda'?vAyuda():vAgenda();
  const sel=$('#bM');if(sel)sel.onchange=()=>{$('#bExt').hidden=sel.value!=='_'}}
document.querySelector('nav').onclick=e=>{const b=e.target.closest('button');if(!b)return;view=b.dataset.v;cur=null;render();scrollTo(0,0)};
$('#addDog').onclick=()=>dogForm(null);
$('#ov').onclick=e=>{if(e.target.id==='ov')close()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
document.addEventListener('click',e=>{const dg=e.target.closest('[data-dog]');if(dg){cur=dg.dataset.dog;view='dog';render();scrollTo(0,0);return}
  const a=e.target.closest('[data-act]');if(!a||a.tagName==='SELECT'||a.tagName==='INPUT')return;const act=a.dataset.act;const d=cur&&byId(cur);const cl=d&&JSON.parse(JSON.stringify(d));
  if(act==='new')return dogForm(null);if(act==='close')return close();if(act==='ics')return ics();
  if(act==='backup')return backup();if(act==='rmerge')return doRestore(false);if(act==='rrep')return doRestore(true);
  if(act==='notif'){N.notifyPermission(true).then(r=>{notifState=r;render();if(r==='granted'){reschedule();toast('Avisos activados')}else toast('Actívalas en Ajustes del teléfono › Apps › Celos y Camadas')});return}
  if(act==='testnotif'){N.testNotification().then(ok=>toast(ok?'Llegará en 3 segundos':'Sin permiso de notificaciones'));return}
  if(act==='back'){view='perros';cur=null;return render()}
  if(!d)return;
  if(act==='edit')return dogForm(d);
  if(act==='del'){if(a.dataset.sure)return delDog(d.id);a.dataset.sure=1;a.textContent='Toca otra vez para confirmar';return}
  if(act==='heat'){const v=$('#hDate').value;if(!v)return;cl.heats=cl.heats||[];if(!cl.heats.some(h=>h.start===v))cl.heats.push({start:v});saveDog(cl);return toast('Celo registrado')}
  if(act==='prog'){const v=parseFloat($('#pV').value),dt=$('#pD').value;if(!dt||!isFinite(v)||v<0)return toast('Escribe fecha y valor');
    const hs=cl.heats.slice().sort((a,b)=>b.start.localeCompare(a.start));const h=hs.find(x=>x.start===selHeat)||hs[0];
    const ng=Math.round((progUnit==='nmol'?v/NMOL:v)*100)/100;(h.progs=h.progs||[]).push({id:uid(),date:dt,v:ng,note:$('#pN').value.trim()});
    saveDog(cl);return toast(progRead(ng)[0]+': '+progRead(ng)[1])}
  if(act==='delprog'){cl.heats.forEach(h=>{if(h.progs)h.progs=h.progs.filter(p=>p.id!==a.dataset.v)});return saveDog(cl)}
  if(act==='delheat'){cl.heats=cl.heats.filter(h=>h.start!==a.dataset.v);return saveDog(cl)}
  if(act==='breed'){const d1=$('#bD1').value;if(!d1)return;const m=$('#bM').value;const b={id:uid(),date:d1,date2:$('#bD2').value||'',status:'pendiente'};
    if(m==='_'){b.maleName=$('#bMN').value.trim();b.maleReg=$('#bMR').value.trim()}else b.maleId=m;
    cl.breedings=cl.breedings||[];cl.breedings.push(b);cl.heats=cl.heats||[];
    if(!cl.heats.some(h=>Math.abs(diff(pd(d1),pd(h.start)))<=21))cl.heats.push({start:iso(add(pd(d1),-10)),notes:'Estimado desde la cruza'});
    saveDog(cl);return toast('Cruza registrada · parto probable '+fmt(add(pd(d1),63)))}
  if(act==='delbr'){cl.breedings=cl.breedings.filter(b=>b.id!==a.dataset.b);return saveDog(cl)}
  if(act==='pup'){const b=d.breedings.find(x=>x.id===a.dataset.b);const ped={};linkInto(ped,'D',d.id);
    if(b.maleId)linkInto(ped,'S',b.maleId);else if(b.maleName)ped.S={name:b.maleName,reg:b.maleReg||''};
    preset={birth:b.birth,breed:d.breed,ped};return dogForm(null)}
  if(act==='slot')return slotForm(d,a.dataset.k);
  if(act==='slotok'||act==='slotdel'){const k=a.dataset.k;cl.ped=cl.ped||{};const was=cl.ped[k]&&cl.ped[k].dogId;const l=act==='slotok'&&$('#sL')?$('#sL').value:'';
    const clear=all=>Object.keys(cl.ped).forEach(x=>{if(x===k||(all&&x.startsWith(k)))delete cl.ped[x]});
    if(act==='slotdel')clear(!!was);
    else if(l){clear(true);linkInto(cl.ped,k,l)}
    else{clear(!!was);const n=$('#sN').value.trim();if(n)cl.ped[k]={name:n,reg:$('#sR').value.trim()}}
    close();return saveDog(cl)}
});
document.addEventListener('change',e=>{if(e.target.id==='rFile'&&e.target.files[0]){restore(e.target.files[0]);e.target.value='';return}const a=e.target.closest('[data-act]');if(!a)return;
  if(a.dataset.act==='pheat'){selHeat=a.value;return render()}if(a.dataset.act==='punit'){progUnit=a.value;return}const d=cur&&byId(cur);if(!d)return;const cl=JSON.parse(JSON.stringify(d));const b=(cl.breedings||[]).find(x=>x.id===a.dataset.b);if(!b)return;
  const act=a.dataset.act;if(act==='bstat'){b.status=a.value}else if(act==='bbirth'){b.birth=a.value;if(a.value)b.status='parto'}else if(act==='bpm'){b.pm=a.value===''?null:+a.value}else if(act==='bph'){b.ph=a.value===''?null:+a.value}else return;saveDog(cl)});

/* ---- notificaciones, respaldo, botón atrás ---- */
function notifItems(){const out=[];allEvents().forEach(e=>{const at=new Date(e.date.getFullYear(),e.date.getMonth(),e.date.getDate(),9,0);out.push({at,title:'🐾 '+e.dog.name,body:e.t});
  if(/Celo esperado|Fecha probable de parto|Monta ideal #1/.test(e.t))out.push({at:new Date(e.date.getFullYear(),e.date.getMonth(),e.date.getDate()-1,20,0),title:'🐾 Mañana: '+e.dog.name,body:e.t})});return out}
async function reschedule(){if(!N.canNotify)return;try{await N.scheduleAll(notifItems())}catch(e){}}
async function backup(){const data=JSON.stringify({app:'celos-y-camadas',version:VERSION,exported:new Date().toISOString(),dogs},null,1);
  try{await N.shareFile('celos-respaldo-'+iso(today())+'.json',data,'application/json');toast('Respaldo listo')}catch(e){toast('No se pudo exportar')}}
function restore(file){const rd=new FileReader();rd.onload=()=>{let v;try{v=JSON.parse(rd.result)}catch(e){return toast('Archivo no válido')}
  const list=Array.isArray(v)?v:v&&Array.isArray(v.dogs)?v.dogs:null;if(!list||!list.every(x=>x&&typeof x.id==='string'&&typeof x.name==='string'))return toast('Archivo no válido');
  open(`<h3>Restaurar respaldo</h3><p>El archivo tiene <b>${list.length}</b> perro(s). Tienes ${dogs.length} en este teléfono.</p><div class="row"><button class="btn" data-act="rmerge">Combinar</button><button class="btn ghost" data-act="rrep">Reemplazar todo</button><button class="btn ghost" data-act="close">Cancelar</button></div><p class="note">Combinar conserva la versión más reciente de cada perro.</p>`);
  restore.list=list};rd.readAsText(file)}
function doRestore(replace){const list=restore.list||[];if(replace)dogs=list;else list.forEach(x=>{const i=dogs.findIndex(y=>y.id===x.id);if(i<0)dogs.push(x);else if((x.updated||0)>(dogs[i].updated||0))dogs[i]=x});
  close();persist();view='perros';cur=null;render();toast('Respaldo restaurado')}
N.onBack(()=>{if($('#ov').classList.contains('on')){close();return true}if(view==='dog'){view='perros';cur=null;render();return true}if(view!=='agenda'){view='agenda';render();return true}return false});
(async()=>{dogs=await N.loadDogs();notifState=await N.notifyPermission(false).catch(()=>'?');render();reschedule()})();
render();