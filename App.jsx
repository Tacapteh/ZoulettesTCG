/**
 * SQUAD TCG — Card Forge  v2
 * Mot de passe admin : "tcb"
 *
 * Setup Vite :
 *   npm create vite@latest squad-tcg -- --template react
 *   Copier App.jsx → src/App.jsx
 *   Copier Carte_template.svg → public/Carte_template.svg
 *   npm install && npm run dev
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "tcb";
const VW = 616.5;   // viewBox width du SVG template
const VH = 841.5;   // viewBox height

// Zones extraites par analyse du SVG (unités viewBox)
const Z = {
  photo:   { x: 13,  y: 88,  w: 555, h: 422, rx: 8  },
  textbox: { x: 41,  y: 516, w: 534, h: 197, rx: 29 },
  rarity:  { x: 41,  y: 504, w: 534, h: 18          },
};

// Coordonnées des textes overlay
const T = {
  nom:    { x: 52,  y: 46,  size: 32, anchor: "start" },
  pvVal:  { x: 600, y: 46,  size: 32, anchor: "end"   },
  pvLbl:  { x: 598, y: 72,  size: 15, anchor: "end"   },
  atkLbl: { x: 20,  y: 784, size: 13, anchor: "start" },
  atkVal: { x: 20,  y: 812, size: 32, anchor: "start" },
  defLbl: { x: 600, y: 784, size: 13, anchor: "end"   },
  defVal: { x: 600, y: 812, size: 32, anchor: "end"   },
  fam:    { x: 592, y: 300, size: 19                  }, // rotation 90°
  rar:    { x: 308, y: 513, size: 11, anchor: "middle"},
  num:    { x: 55,  y: 513, size: 10, anchor: "start" },
};

const RARITIES = [
  { id: "C",  label: "Commune",    color: "#888888" },
  { id: "R",  label: "Rare",       color: "#2196f3" },
  { id: "SR", label: "Super Rare", color: "#9c27b0" },
  { id: "E",  label: "Épique",     color: "#ff5722" },
  { id: "L",  label: "Légendaire", color: "#ffd700" },
];
const FAMILIES = ["","Guerrier","Mage","Voleur","Berserker","Capitaine","Marine","Pirate","Chasseur","Génie","Robot","Sage"];
const PRESETS_MAIN   = ["#1a1a1a","#c0392b","#1565c0","#1b5e20","#7b1fa2","#e65100","#006064","#283593","#ad1457","#37474f","#bf8a00","#4a148c","#004d40","#880e4f","#b71c1c"];
const PRESETS_TB     = ["#000000","#0d0d0d","#1a1a2e","#0d1b2a","#1b1b1b","#2c1810","#0f0f23","#1a0a2e","#1a3a1a","#0a0a0a"];
const PRESETS_STROKE = ["#ffffff","#000000","#ffd700","#ff6b6b","#74b9ff","#a29bfe","#55efc4"];

const BLANK = {
  id:null,profileId:"",name:"",family:"",photoUrl:"",
  color:"#1a1a1a",strokeColor:"#ffffff",strokeWidth:2,
  textBoxColor:"#000000",textBoxOpacity:0.85,
  rarityId:"C",isEvolution:false,evolutionFrom:"",
  hp:80,attack:50,defense:40,
  ability:"",abilityDesc:"",
  move1Name:"",move1Dmg:30,move1Desc:"",
  move2Name:"",move2Dmg:60,move2Desc:"",
  flavorText:"",cardNumber:"001",totalCards:"060",
};
const INIT_PROFILES = [{id:"lechich",name:"Le Chich",bio:"Dev boss.",photos:[]}];
const uid = () => Math.random().toString(36).slice(2,9);

// ─── CROP MODAL ───────────────────────────────────────────────────────────────
function CropModal({src,onDone,onCancel}) {
  const cvRef=useRef(),imgRef=useRef(null),dragRef=useRef(null);
  const F=300;
  const [pos,setPos]=useState({x:0,y:0}),[zoom,setZoom]=useState(1),[sz,setSz]=useState({w:1,h:1});
  useEffect(()=>{const i=new Image();i.onload=()=>{imgRef.current=i;setSz({w:i.naturalWidth,h:i.naturalHeight});const sc=Math.max(F/i.naturalWidth,F/i.naturalHeight);setZoom(sc);setPos({x:(F-i.naturalWidth*sc)/2,y:(F-i.naturalHeight*sc)/2});};i.src=src;},[src]);
  const cl=(p,z)=>({x:Math.min(0,Math.max(F-sz.w*z,p.x)),y:Math.min(0,Math.max(F-sz.h*z,p.y))});
  const dn=e=>{const cx=e.touches?.[0].clientX??e.clientX,cy=e.touches?.[0].clientY??e.clientY;dragRef.current={cx,cy,ox:pos.x,oy:pos.y};};
  const mv=e=>{if(!dragRef.current)return;const cx=e.touches?.[0].clientX??e.clientX,cy=e.touches?.[0].clientY??e.clientY;setPos(cl({x:dragRef.current.ox+(cx-dragRef.current.cx),y:dragRef.current.oy+(cy-dragRef.current.cy)},zoom));};
  const crop=()=>{const cv=cvRef.current;cv.width=600;cv.height=600;cv.getContext("2d").drawImage(imgRef.current,-pos.x/zoom,-pos.y/zoom,F/zoom,F/zoom,0,0,600,600);onDone(cv.toDataURL("image/jpeg",0.92));};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.97)",zIndex:9999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,fontFamily:"sans-serif",padding:16}}>
      <canvas ref={cvRef} style={{display:"none"}}/>
      <div style={{fontSize:10,color:"#555",letterSpacing:3,textTransform:"uppercase"}}>RECADRER LA PHOTO</div>
      <div style={{width:F,height:F,overflow:"hidden",position:"relative",cursor:"grab",userSelect:"none",outline:"2px solid #333",touchAction:"none"}}
        onMouseDown={dn} onMouseMove={mv} onMouseUp={()=>dragRef.current=null} onMouseLeave={()=>dragRef.current=null}
        onTouchStart={dn} onTouchMove={mv} onTouchEnd={()=>dragRef.current=null}>
        {imgRef.current&&<img src={src} alt="" draggable={false} style={{position:"absolute",left:pos.x,top:pos.y,width:sz.w*zoom,height:sz.h*zoom,userSelect:"none",pointerEvents:"none"}}/>}
        {[1,2].map(i=>[<div key={"v"+i} style={{position:"absolute",left:`${i*33.33}%`,top:0,bottom:0,width:1,background:"rgba(255,255,255,0.15)",pointerEvents:"none"}}/>,<div key={"h"+i} style={{position:"absolute",top:`${i*33.33}%`,left:0,right:0,height:1,background:"rgba(255,255,255,0.15)",pointerEvents:"none"}}/>])}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,width:F}}>
        <span style={{color:"#555"}}>−</span>
        <input type="range" min={0.3} max={4} step={0.05} value={zoom} onChange={e=>{const nz=+e.target.value;setPos(p=>cl(p,nz));setZoom(nz);}} style={{flex:1}}/>
        <span style={{color:"#555"}}>+</span>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={crop} style={{padding:"10px 28px",borderRadius:8,border:"none",cursor:"pointer",background:"#fff",color:"#000",fontWeight:700,fontSize:14}}>✓ Valider</button>
        <button onClick={onCancel} style={{padding:"10px 18px",borderRadius:8,border:"none",cursor:"pointer",background:"#222",color:"#666",fontSize:14}}>Annuler</button>
      </div>
    </div>
  );
}

// ─── PHOTO UPLOADER ───────────────────────────────────────────────────────────
function PhotoUploader({onPhoto}) {
  const fRef=useRef(),vRef=useRef();
  const [raw,setRaw]=useState(null),[cam,setCam]=useState(false),[stream,setStream]=useState(null);
  const read=f=>{if(!f)return;const r=new FileReader();r.onload=e=>setRaw(e.target.result);r.readAsDataURL(f);};
  const openCam=async()=>{try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});setStream(s);setCam(true);setTimeout(()=>{if(vRef.current)vRef.current.srcObject=s;},80);}catch{alert("Caméra non accessible.");}};
  const snap=()=>{const v=vRef.current;if(!v)return;const cv=document.createElement("canvas");cv.width=v.videoWidth;cv.height=v.videoHeight;cv.getContext("2d").drawImage(v,0,0);stream?.getTracks().forEach(t=>t.stop());setStream(null);setCam(false);setRaw(cv.toDataURL("image/jpeg",0.9));};
  return(<>
    <input ref={fRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>read(e.target.files[0])}/>
    <div style={{display:"flex",gap:8}}>
      <button onClick={()=>fRef.current.click()} style={{flex:1,cursor:"pointer",border:"none",borderRadius:8,padding:"10px 0",fontSize:13,fontWeight:700,background:"#e8f0fe",color:"#1a73e8"}}>📁 Galerie</button>
      <button onClick={openCam} style={{flex:1,cursor:"pointer",border:"none",borderRadius:8,padding:"10px 0",fontSize:13,fontWeight:700,background:"#e6f4ea",color:"#188038"}}>📷 Caméra</button>
    </div>
    {cam&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.97)",zIndex:9998,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <video ref={vRef} autoPlay playsInline style={{width:"min(90vw,480px)",borderRadius:12}}/>
      <div style={{display:"flex",gap:10}}>
        <button onClick={snap} style={{padding:"14px 36px",borderRadius:40,border:"none",cursor:"pointer",background:"#fff",fontWeight:700,fontSize:16}}>📸</button>
        <button onClick={()=>{stream?.getTracks().forEach(t=>t.stop());setStream(null);setCam(false);}} style={{padding:"14px 20px",borderRadius:40,border:"none",cursor:"pointer",background:"#222",color:"#888",fontSize:16}}>✕</button>
      </div>
    </div>}
    {raw&&<CropModal src={raw} onDone={u=>{onPhoto(u);setRaw(null);}} onCancel={()=>setRaw(null)}/>}
  </>);
}

// ─── CARTE TCG ────────────────────────────────────────────────────────────────
function TCGCard({card,scale=1,svgUrl="./Carte_template.svg"}) {
  const W=VW*scale, H=VH*scale;
  const clipId=`pc-${card.id||"p"}-${Math.round(scale*1000)}`;
  const col=card.color||"#1a1a1a";
  const tbCol=card.textBoxColor||"#000";
  const tbOp=card.textBoxOpacity??0.85;
  const stCol=card.strokeColor||"#fff";
  const stW=card.strokeWidth??2;
  const rar=RARITIES.find(r=>r.id===card.rarityId)||RARITIES[0];

  // Helper: texte avec stroke TCG
  const WT={fontFamily:"'Arial Black','Arial Bold',Arial,sans-serif",fontWeight:900,fill:"#ffffff",stroke:stCol,strokeWidth:stW,strokeLinejoin:"round",paintOrder:"stroke fill"};

  // Lignes textbox
  const lines=[];let ty=Z.textbox.y+36;
  if(card.ability){lines.push({b:true,t:`[${card.ability}]`,x:Z.textbox.x+16,y:ty,s:16});ty+=24;if(card.abilityDesc){lines.push({t:card.abilityDesc,x:Z.textbox.x+16,y:ty,s:13});ty+=20;}}
  [[card.move1Name,card.move1Dmg,card.move1Desc],[card.move2Name,card.move2Dmg,card.move2Desc]].forEach(([name,dmg,desc])=>{
    if(!name)return;
    lines.push({b:true,t:name,x:Z.textbox.x+16,y:ty,s:16});
    if(dmg>0)lines.push({b:true,t:`+${dmg}`,x:Z.textbox.x+Z.textbox.w-16,y:ty,s:16,a:"end"});
    ty+=24;if(desc){lines.push({t:desc,x:Z.textbox.x+16,y:ty,s:13});ty+=19;}
  });
  if(card.flavorText)lines.push({it:true,t:`"${card.flavorText}"`,x:Z.textbox.x+Z.textbox.w/2,y:Z.textbox.y+Z.textbox.h-18,s:12,a:"middle"});
  if(!lines.length)lines.push({ph:true,t:"Zone de texte",x:Z.textbox.x+Z.textbox.w/2,y:Z.textbox.y+Z.textbox.h/2,s:14,a:"middle"});

  return(
    <div style={{position:"relative",width:W,height:H,flexShrink:0,display:"inline-block"}}>
      {/* Fond = SVG template (décors, bandes, coins, bords) */}
      <img src={svgUrl} alt="" width={W} height={H} style={{position:"absolute",inset:0,display:"block"}}/>

      {/* Overlay dynamique */}
      <svg width={W} height={H} viewBox={`0 0 ${VW} ${VH}`} xmlns="http://www.w3.org/2000/svg"
        style={{position:"absolute",inset:0,display:"block"}}>
        <defs>
          <clipPath id={clipId}>
            <rect x={Z.photo.x} y={Z.photo.y} width={Z.photo.w} height={Z.photo.h} rx={Z.photo.rx}/>
          </clipPath>
        </defs>

        {/* ── PHOTO ── */}
        {card.photoUrl&&<image href={card.photoUrl} x={Z.photo.x} y={Z.photo.y} width={Z.photo.w} height={Z.photo.h} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`}/>}

        {/* ── ONGLET ÉVOLUTION ── */}
        {card.isEvolution&&<>
          <rect x={180} y={70} width={256} height={38} rx={19} fill={col}/>
          <text x={308} y={91} textAnchor="middle" dominantBaseline="middle" {...WT} fontSize={15} fontWeight={800}>
            {card.evolutionFrom?`Évolue de ${card.evolutionFrom}`:"ÉVOLUTION"}
          </text>
        </>}

        {/* ── FOND TEXTBOX ── */}
        <rect x={Z.textbox.x} y={Z.textbox.y} width={Z.textbox.w} height={Z.textbox.h} rx={Z.textbox.rx} fill={tbCol} fillOpacity={tbOp}/>

        {/* ── BANDE RARETÉ ── */}
        <rect x={Z.rarity.x} y={Z.rarity.y} width={Z.rarity.w} height={Z.rarity.h} fill={rar.color} fillOpacity={0.9}/>
        <text x={T.rar.x} y={T.rar.y+9} textAnchor="middle" dominantBaseline="middle" fontFamily="Arial" fontWeight={900} fontSize={T.rar.size} fill="#000" letterSpacing={1.5}>
          {rar.label.toUpperCase()}
        </text>
        <text x={T.num.x} y={T.rar.y+9} textAnchor="start" dominantBaseline="middle" fontFamily="monospace" fontSize={T.num.size} fill="#000" opacity={0.55}>
          {card.cardNumber}/{card.totalCards}
        </text>

        {/* ── NOM ── */}
        <text x={T.nom.x} y={T.nom.y} textAnchor={T.nom.anchor} dominantBaseline="middle" {...WT} fontSize={T.nom.size}>
          {(card.name||"Nom de la carte").slice(0,20)}
        </text>

        {/* ── PV ── */}
        <text x={T.pvVal.x} y={T.pvVal.y} textAnchor={T.pvVal.anchor} dominantBaseline="middle" {...WT} fontSize={T.pvVal.size}>{card.hp}</text>
        <text x={T.pvLbl.x} y={T.pvLbl.y} textAnchor="end" fontFamily="Arial" fontWeight={700} fontSize={T.pvLbl.size} fill="rgba(255,255,255,0.85)" stroke={stCol} strokeWidth={stW*0.5} paintOrder="stroke fill">PV</text>

        {/* ── FAMILLE ── */}
        {card.family&&<text x={T.fam.x} y={T.fam.y} textAnchor="middle" dominantBaseline="middle"
          transform={`rotate(90,${T.fam.x},${T.fam.y})`} {...WT} fontSize={T.fam.size}>
          {card.family}
        </text>}

        {/* ── CONTENU TEXTBOX ── */}
        {lines.map((ln,i)=>(
          <text key={i} x={ln.x} y={ln.y} textAnchor={ln.a||"start"}
            fontFamily="Arial,sans-serif" fontWeight={ln.b?900:600} fontStyle={ln.it?"italic":"normal"}
            fontSize={ln.s||14} fill={ln.ph?"rgba(255,255,255,0.25)":"#fff"}
            stroke={ln.ph?"none":"#000"} strokeWidth={ln.b?2.5:1.5} strokeLinejoin="round" paintOrder="stroke fill">
            {ln.t}
          </text>
        ))}

        {/* ── ATK ── */}
        <text x={T.atkLbl.x} y={T.atkLbl.y} textAnchor="start" fontFamily="Arial" fontWeight={700} fontSize={T.atkLbl.size} fill="rgba(255,255,255,0.85)" stroke={stCol} strokeWidth={stW*0.5} paintOrder="stroke fill">ATK</text>
        <text x={T.atkVal.x} y={T.atkVal.y} textAnchor="start" dominantBaseline="middle" {...WT} fontSize={T.atkVal.size}>{card.attack}</text>

        {/* ── DEF ── */}
        <text x={T.defLbl.x} y={T.defLbl.y} textAnchor="end" fontFamily="Arial" fontWeight={700} fontSize={T.defLbl.size} fill="rgba(255,255,255,0.85)" stroke={stCol} strokeWidth={stW*0.5} paintOrder="stroke fill">DEF</text>
        <text x={T.defVal.x} y={T.defVal.y} textAnchor="end" dominantBaseline="middle" {...WT} fontSize={T.defVal.size}>{card.defense}</text>
      </svg>
    </div>
  );
}

// ─── EXPORT PNG ───────────────────────────────────────────────────────────────
async function exportCard(card,svgUrl,onDone) {
  const SC=2,W=Math.round(VW*SC),H=Math.round(VH*SC);
  const load=src=>new Promise((res,rej)=>{const i=new Image();i.crossOrigin="anonymous";i.onload=()=>res(i);i.onerror=rej;i.src=src;});
  const stCol=card.strokeColor||"#fff",stW=card.strokeWidth??2;
  const tbCol=card.textBoxColor||"#000",tbOp=card.textBoxOpacity??0.85;
  const col=card.color||"#1a1a1a";
  const rar=RARITIES.find(r=>r.id===card.rarityId)||RARITIES[0];
  const lines=[];let ty=Z.textbox.y+36;
  if(card.ability){lines.push({b:true,t:`[${card.ability}]`,x:Z.textbox.x+16,y:ty,s:16});ty+=24;if(card.abilityDesc){lines.push({t:card.abilityDesc,x:Z.textbox.x+16,y:ty,s:13});ty+=20;}}
  [[card.move1Name,card.move1Dmg,card.move1Desc],[card.move2Name,card.move2Dmg,card.move2Desc]].forEach(([name,dmg,desc])=>{if(!name)return;lines.push({b:true,t:name,x:Z.textbox.x+16,y:ty,s:16});if(dmg>0)lines.push({b:true,t:`+${dmg}`,x:Z.textbox.x+Z.textbox.w-16,y:ty,s:16,a:"end"});ty+=24;if(desc){lines.push({t:desc,x:Z.textbox.x+16,y:ty,s:13});ty+=19;}});
  if(card.flavorText)lines.push({it:true,t:`"${card.flavorText}"`,x:Z.textbox.x+Z.textbox.w/2,y:Z.textbox.y+Z.textbox.h-18,s:12,a:"middle"});
  const wt=(x,y,t,sz,an="start")=>`<text x="${x}" y="${y}" text-anchor="${an}" dominant-baseline="middle" font-family="Arial Black,Arial" font-weight="900" font-size="${sz}" fill="#fff" stroke="${stCol}" stroke-width="${stW}" stroke-linejoin="round" paint-order="stroke fill">${t}</text>`;
  const lx=lines.map(ln=>`<text x="${ln.x}" y="${ln.y}" text-anchor="${ln.a||"start"}" font-family="Arial,sans-serif" font-weight="${ln.b?900:600}" font-style="${ln.it?"italic":"normal"}" font-size="${ln.s||14}" fill="${ln.ph?"rgba(255,255,255,0.25)":"#fff"}" stroke="${ln.ph?"none":"#000"}" stroke-width="${ln.b?2.5:1.5}" stroke-linejoin="round" paint-order="stroke fill">${ln.t}</text>`).join("");
  const evo=card.isEvolution?`<rect x="180" y="70" width="256" height="38" rx="19" fill="${col}"/>${wt(308,91,card.evolutionFrom?`Évolue de ${card.evolutionFrom}`:"ÉVOLUTION",15,"middle")}`:"";
  const photo=card.photoUrl?`<clipPath id="ec"><rect x="${Z.photo.x}" y="${Z.photo.y}" width="${Z.photo.w}" height="${Z.photo.h}" rx="${Z.photo.rx}"/></clipPath><image href="${card.photoUrl}" x="${Z.photo.x}" y="${Z.photo.y}" width="${Z.photo.w}" height="${Z.photo.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#ec)"/>`:"";
  const svg=`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${VW}" height="${VH}" viewBox="0 0 ${VW} ${VH}"><defs>${card.photoUrl?'<clipPath id="ec"><rect x="'+Z.photo.x+'" y="'+Z.photo.y+'" width="'+Z.photo.w+'" height="'+Z.photo.h+'" rx="'+Z.photo.rx+'"/></clipPath>':""}</defs>${card.photoUrl?'<image href="'+card.photoUrl+'" x="'+Z.photo.x+'" y="'+Z.photo.y+'" width="'+Z.photo.w+'" height="'+Z.photo.h+'" preserveAspectRatio="xMidYMid slice" clip-path="url(#ec)"/>':""} ${evo}<rect x="${Z.textbox.x}" y="${Z.textbox.y}" width="${Z.textbox.w}" height="${Z.textbox.h}" rx="${Z.textbox.rx}" fill="${tbCol}" fill-opacity="${tbOp}"/><rect x="${Z.rarity.x}" y="${Z.rarity.y}" width="${Z.rarity.w}" height="${Z.rarity.h}" fill="${rar.color}" fill-opacity="0.9"/><text x="${T.rar.x}" y="${T.rar.y+9}" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-weight="900" font-size="${T.rar.size}" fill="#000" letter-spacing="1.5">${rar.label.toUpperCase()}</text><text x="${T.num.x}" y="${T.rar.y+9}" text-anchor="start" dominant-baseline="middle" font-family="monospace" font-size="${T.num.size}" fill="#000" opacity="0.55">${card.cardNumber}/${card.totalCards}</text>${wt(T.nom.x,T.nom.y,(card.name||"Nom de la carte").slice(0,20),T.nom.size,"start")}<text x="${T.pvVal.x}" y="${T.pvVal.y}" text-anchor="end" dominant-baseline="middle" font-family="Arial Black,Arial" font-weight="900" font-size="${T.pvVal.size}" fill="#fff" stroke="${stCol}" stroke-width="${stW}" stroke-linejoin="round" paint-order="stroke fill">${card.hp}</text><text x="${T.pvLbl.x}" y="${T.pvLbl.y}" text-anchor="end" font-family="Arial" font-weight="700" font-size="${T.pvLbl.size}" fill="rgba(255,255,255,0.85)" stroke="${stCol}" stroke-width="${stW*0.5}" paint-order="stroke fill">PV</text>${card.family?`<text x="${T.fam.x}" y="${T.fam.y}" text-anchor="middle" dominant-baseline="middle" transform="rotate(90,${T.fam.x},${T.fam.y})" font-family="Arial Black,Arial" font-weight="900" font-size="${T.fam.size}" fill="#fff" stroke="${stCol}" stroke-width="${stW}" stroke-linejoin="round" paint-order="stroke fill">${card.family}</text>`:""} ${lx}<text x="${T.atkLbl.x}" y="${T.atkLbl.y}" text-anchor="start" font-family="Arial" font-weight="700" font-size="${T.atkLbl.size}" fill="rgba(255,255,255,0.85)" stroke="${stCol}" stroke-width="${stW*0.5}" paint-order="stroke fill">ATK</text>${wt(T.atkVal.x,T.atkVal.y,card.attack,T.atkVal.size,"start")}<text x="${T.defLbl.x}" y="${T.defLbl.y}" text-anchor="end" font-family="Arial" font-weight="700" font-size="${T.defLbl.size}" fill="rgba(255,255,255,0.85)" stroke="${stCol}" stroke-width="${stW*0.5}" paint-order="stroke fill">DEF</text>${wt(T.defVal.x,T.defVal.y,card.defense,T.defVal.size,"end")}</svg>`;
  const blob=new Blob([svg],{type:"image/svg+xml"}),url=URL.createObjectURL(blob);
  try{const[bg,ov]=await Promise.all([load(svgUrl),load(url)]);const cv=document.createElement("canvas");cv.width=W;cv.height=H;const ctx=cv.getContext("2d");ctx.drawImage(bg,0,0,W,H);ctx.drawImage(ov,0,0,W,H);const a=document.createElement("a");a.href=cv.toDataURL("image/png");a.download=`${(card.name||"carte").replace(/\s+/g,"_")}.png`;a.click();}finally{URL.revokeObjectURL(url);onDone();}
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
const SI={background:"#f5f5f5",border:"1.5px solid #e0e0e0",borderRadius:8,padding:"10px 12px",fontSize:14,color:"#1a1a1a",width:"100%",outline:"none",boxSizing:"border-box",fontFamily:"sans-serif"};
const SL={display:"block",fontSize:9,fontWeight:900,color:"#999",marginBottom:4,textTransform:"uppercase",letterSpacing:1.5,fontFamily:"sans-serif"};

function ColorRow({label,value,onChange,presets}){return(<div style={{marginBottom:14}}><label style={SL}>{label}</label><div style={{display:"flex",gap:8,alignItems:"center"}}><input type="color" value={value} onChange={e=>onChange(e.target.value)} style={{width:48,height:42,borderRadius:8,border:"2px solid #ddd",cursor:"pointer",padding:3,flexShrink:0}}/><div style={{display:"flex",flexWrap:"wrap",gap:6,flex:1}}>{presets.map(c=><div key={c} onClick={()=>onChange(c)} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",flexShrink:0,border:value===c?"3px solid #111":"2px solid rgba(0,0,0,0.15)",boxShadow:c==="#ffffff"?"inset 0 0 0 1px #ccc":"none"}}/>)}</div></div></div>);}
function Field({l,value,onChange,type="text",options,min,max,rows,placeholder}){return(<div style={{marginBottom:12}}><label style={SL}>{l}</label>{options?<select value={value} onChange={e=>onChange(e.target.value)} style={SI}>{options.map(o=><option key={o.id??o} value={o.id??o}>{o.label??o}</option>)}</select>:type==="range"?<div style={{display:"flex",gap:10,alignItems:"center"}}><input type="range" min={min} max={max} step={1} value={value} onChange={e=>onChange(Number(e.target.value))} style={{flex:1,height:4}}/><b style={{fontSize:14,minWidth:36,textAlign:"right"}}>{value}</b></div>:rows?<textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder} style={{...SI,resize:"vertical"}}/>:<input type={type} value={value} onChange={e=>onChange(e.target.value)} style={SI} placeholder={placeholder}/>}</div>);}
function Sec({label}){return<div style={{borderLeft:"3px solid #111",paddingLeft:10,margin:"20px 0 12px",fontSize:10,fontWeight:900,color:"#111",letterSpacing:2,textTransform:"uppercase",fontFamily:"sans-serif"}}>{label}</div>;}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App(){
  const SVG_URL="./Carte_Vierge.svg";
  const [role,setRole]=useState(null);
  const [profiles,setProfiles]=useState(INIT_PROFILES);
  const [cards,setCards]=useState([]);
  const [view,setView]=useState("collection");
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState({...BLANK});
  const [msg,setMsg]=useState("");
  const [pw,setPw]=useState(""),[pid,setPid]=useState(""),[err,setErr]=useState("");
  const [exporting,setExporting]=useState(false);
  const isAdmin=role==="admin";
  const sf=(k,v)=>setForm(p=>({...p,[k]:v}));
  const login=adm=>{if(adm){pw.trim()===ADMIN_PASSWORD?(setRole("admin"),setErr(""),setPw("")):setErr("❌ Mauvais mot de passe.");}else{const p=profiles.find(p=>p.id===pid);p?(setRole(p.id),setErr("")):setErr("Choisis un profil.");}};
  const openNew=()=>{const n=String(cards.length+1).padStart(3,"0");setForm({...BLANK,id:uid(),cardNumber:n,totalCards:String(Math.max(60,cards.length+1)).padStart(3,"0")});setEditId("new");setView("editor");};
  const openEdit=c=>{setForm({...c});setEditId(c.id);setView("editor");};
  const save=()=>{editId==="new"?setCards(p=>[...p,form]):setCards(p=>p.map(c=>c.id===editId?form:c));setEditId(null);setView("collection");};
  const del=id=>{if(window.confirm("Supprimer ?"))setCards(p=>p.filter(c=>c.id!==id));};
  const doExport=useCallback(card=>{setExporting(true);exportCard(card,SVG_URL,()=>{setExporting(false);setMsg("✅ Exporté !");setTimeout(()=>setMsg(""),3000);});},[]);

  if(!role)return(
    <div style={{minHeight:"100vh",background:"#0d0d0d",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"sans-serif"}}>
      <div style={{width:"100%",maxWidth:360,textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:8}}>🃏</div>
        <div style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:4,marginBottom:2}}>SQUAD TCG</div>
        <div style={{fontSize:10,color:"#333",letterSpacing:5,marginBottom:32}}>CARD FORGE</div>
        <div style={{background:"#141414",border:"1px solid #222",borderRadius:16,padding:22,marginBottom:12}}>
          <div style={{fontSize:9,color:"#555",fontWeight:900,letterSpacing:2,marginBottom:12,textAlign:"left"}}>ADMIN — CRÉATION</div>
          <input type="password" placeholder="Mot de passe…" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login(true)}
            style={{background:"#0d0d0d",border:"1px solid #222",borderRadius:8,padding:12,fontSize:16,color:"#eee",width:"100%",outline:"none",marginBottom:12,boxSizing:"border-box"}}/>
          <button onClick={()=>login(true)} style={{background:"#fff",color:"#000",border:"none",borderRadius:10,padding:"12px 0",width:"100%",fontSize:15,fontWeight:900,cursor:"pointer",letterSpacing:2}}>ENTRER →</button>
        </div>
        <div style={{color:"#222",fontSize:10,margin:"10px 0",letterSpacing:3}}>— ou —</div>
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:16,padding:22}}>
          <div style={{fontSize:9,color:"#333",fontWeight:900,letterSpacing:2,marginBottom:12,textAlign:"left"}}>POTE — VOIR LA COLLECTION</div>
          <select value={pid} onChange={e=>setPid(e.target.value)} style={{background:"#141414",border:"1px solid #222",borderRadius:8,padding:12,fontSize:16,color:"#888",width:"100%",outline:"none",marginBottom:12,boxSizing:"border-box"}}>
            <option value="">— Choisir ton profil —</option>
            {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={()=>login(false)} style={{background:"#1a1a1a",color:"#888",border:"none",borderRadius:10,padding:"12px 0",width:"100%",fontSize:15,fontWeight:700,cursor:"pointer"}}>ACCÉDER →</button>
        </div>
        {err&&<div style={{marginTop:12,color:"#e05030",fontSize:14}}>{err}</div>}
      </div>
    </div>
  );

  const myP=profiles.find(p=>p.id===role);
  const isEd=["editor","preview"].includes(view);
  const Nav=()=>(
    <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"1.5px solid #e8e4de",display:"flex",zIndex:100,boxShadow:"0 -2px 12px rgba(0,0,0,0.08)"}}>
      {[{id:"collection",icon:"🃏",label:"Cartes"},...(isAdmin?[{id:"editor",icon:"✏️",label:"Créer"}]:[]),{id:"profiles",icon:"👥",label:"Profils"}].map(tab=>(
        <button key={tab.id} onClick={()=>{tab.id==="editor"?(!editId?openNew():setView("editor")):setView(tab.id);}}
          style={{flex:1,border:"none",cursor:"pointer",padding:"10px 0 6px",background:(view===tab.id||(isEd&&tab.id==="editor"))?"#f0ece6":"transparent",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <span style={{fontSize:20}}>{tab.icon}</span>
          <span style={{fontSize:10,fontWeight:700,color:(view===tab.id||(isEd&&tab.id==="editor"))?"#111":"#aaa",fontFamily:"sans-serif"}}>{tab.label}</span>
        </button>
      ))}
      <button onClick={()=>{setRole(null);setView("collection");setEditId(null);}} style={{flex:1,border:"none",cursor:"pointer",padding:"10px 0 6px",background:"transparent",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <span style={{fontSize:20}}>🚪</span>
        <span style={{fontSize:10,fontWeight:700,color:"#aaa",fontFamily:"sans-serif"}}>{isAdmin?"Admin":myP?.name||"—"}</span>
      </button>
    </nav>
  );
  const ps={minHeight:"100vh",background:"#f0ece6",fontFamily:"sans-serif",paddingBottom:72};

  if(view==="collection")return(<div style={ps}><div style={{padding:"20px 16px 0"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div><div style={{fontSize:20,fontWeight:900,color:"#111",letterSpacing:2}}>Collection</div><div style={{fontSize:11,color:"#bbb"}}>{cards.length} carte{cards.length!==1?"s":""}</div></div>
      {msg&&<span style={{fontSize:12,color:"#2d8a4e",fontWeight:700}}>{msg}</span>}
    </div>
    {cards.length===0?<div style={{textAlign:"center",padding:"60px 0",color:"#ccc"}}><div style={{fontSize:52,marginBottom:12}}>🃏</div><div style={{fontSize:16}}>{isAdmin?"Crée ta première carte !":"Aucune carte pour l'instant."}</div></div>
    :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      {cards.map(card=>(
        <div key={card.id} style={{background:"#fff",borderRadius:12,padding:12,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:8,height:185,overflow:"hidden",alignItems:"center"}}>
            <TCGCard card={card} scale={0.22} svgUrl={SVG_URL}/>
          </div>
          <div style={{fontWeight:700,fontSize:13,color:"#111",marginBottom:6,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{card.name||"Sans nom"}</div>
          <div style={{display:"flex",gap:4}}>
            <button onClick={()=>doExport(card)} disabled={exporting} style={{flex:1,background:"#eef6ee",color:"#2d8a4e",border:"none",borderRadius:6,padding:"7px 0",cursor:"pointer",fontWeight:700,fontSize:11}}>⬇ PNG</button>
            {isAdmin&&<><button onClick={()=>openEdit(card)} style={{flex:1,background:"#f0f0f0",color:"#666",border:"none",borderRadius:6,padding:"7px 0",cursor:"pointer",fontWeight:700,fontSize:11}}>✏</button><button onClick={()=>del(card.id)} style={{background:"#fef0f0",color:"#d95a5a",border:"none",borderRadius:6,padding:"7px 8px",cursor:"pointer",fontWeight:700,fontSize:11}}>🗑</button></>}
          </div>
        </div>
      ))}
    </div>}
  </div><Nav/></div>);

  if(isEd&&isAdmin)return(<div style={{...ps,background:"#fff"}}>
    <div style={{padding:"14px 16px 0",borderBottom:"1.5px solid #eee",background:"#fff",position:"sticky",top:0,zIndex:50}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontWeight:900,fontSize:15,color:"#111"}}>{editId==="new"?"NOUVELLE CARTE":"MODIFIER"}</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setEditId(null);setView("collection");}} style={{background:"#f0ece6",color:"#888",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontWeight:700,fontSize:13}}>✕</button>
          <button onClick={save} style={{background:"#111",color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontWeight:900,fontSize:13}}>✓ Sauver</button>
        </div>
      </div>
      <div style={{display:"flex"}}>
        {[{id:"editor",l:"✏️ Formulaire"},{id:"preview",l:"👁 Aperçu"}].map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)} style={{flex:1,border:"none",background:"transparent",padding:"8px 0",fontWeight:700,fontSize:13,cursor:"pointer",borderBottom:view===t.id?"2.5px solid #111":"2.5px solid transparent",color:view===t.id?"#111":"#aaa",fontFamily:"sans-serif"}}>{t.l}</button>
        ))}
      </div>
    </div>
    {view==="editor"&&<div style={{padding:16}}>
      <Sec label="Identité"/>
      <Field l="Nom de la carte" value={form.name} onChange={v=>sf("name",v)} placeholder="Ex: Le Chich"/>
      <Field l="Famille" value={form.family} onChange={v=>sf("family",v)} options={FAMILIES.map(f=>({id:f,label:f||"— Aucune —"}))}/>
      <Field l="Rareté" value={form.rarityId} onChange={v=>sf("rarityId",v)} options={RARITIES.map(r=>({id:r.id,label:r.label}))}/>
      <Field l="Profil" value={form.profileId||""} onChange={v=>sf("profileId",v)} options={[{id:"",label:"— Aucun —"},...profiles.map(p=>({id:p.id,label:p.name}))]}/>
      <Sec label="Couleurs"/>
      <ColorRow label="🎨 Couleur principale" value={form.color||"#1a1a1a"} onChange={v=>sf("color",v)} presets={PRESETS_MAIN}/>
      <ColorRow label="📝 Fond textbox" value={form.textBoxColor||"#000"} onChange={v=>sf("textBoxColor",v)} presets={PRESETS_TB}/>
      <div style={{marginBottom:14}}><label style={SL}>Opacité textbox — {Math.round((form.textBoxOpacity??0.85)*100)}%</label><div style={{display:"flex",gap:10,alignItems:"center"}}><input type="range" min={0} max={100} step={1} value={Math.round((form.textBoxOpacity??0.85)*100)} onChange={e=>sf("textBoxOpacity",Number(e.target.value)/100)} style={{flex:1,height:4}}/><b style={{fontSize:14,minWidth:42,textAlign:"right"}}>{Math.round((form.textBoxOpacity??0.85)*100)}%</b></div></div>
      <ColorRow label="🖊 Bordure textes" value={form.strokeColor||"#fff"} onChange={v=>sf("strokeColor",v)} presets={PRESETS_STROKE}/>
      <Field l={`Épaisseur bordure — ${form.strokeWidth??2}px`} value={form.strokeWidth??2} onChange={v=>sf("strokeWidth",v)} type="range" min={0} max={8}/>
      <Sec label="Photo"/>
      {form.photoUrl&&<div style={{marginBottom:10,height:100,borderRadius:10,overflow:"hidden",border:"1.5px solid #eee",position:"relative"}}><img src={form.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/><button onClick={()=>sf("photoUrl","")} style={{position:"absolute",top:6,right:6,width:24,height:24,borderRadius:"50%",border:"none",background:"rgba(0,0,0,0.65)",color:"#fff",fontSize:12,cursor:"pointer",lineHeight:"24px"}}>✕</button></div>}
      <input style={{...SI,fontSize:13,marginBottom:8}} value={form.photoUrl} onChange={e=>sf("photoUrl",e.target.value)} placeholder="URL image…"/>
      <PhotoUploader onPhoto={url=>sf("photoUrl",url)}/>
      <Sec label="Évolution"/>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"10px 12px",background:"#f5f5f5",borderRadius:8}}>
        <input type="checkbox" id="evo" checked={form.isEvolution} onChange={e=>sf("isEvolution",e.target.checked)} style={{width:18,height:18,cursor:"pointer"}}/>
        <label htmlFor="evo" style={{fontSize:14,cursor:"pointer",fontWeight:600}}>Carte Évolution</label>
      </div>
      {form.isEvolution&&<Field l="Évolue depuis" value={form.evolutionFrom} onChange={v=>sf("evolutionFrom",v)} placeholder="Ex: Le Chich Base"/>}
      <Sec label="Stats"/>
      {[["hp","❤️ PV",10,300],["attack","⚔️ ATK",1,150],["defense","🛡 DEF",1,150]].map(([k,l,mn,mx])=>(<Field key={k} l={`${l} — ${form[k]}`} value={form[k]} onChange={v=>sf(k,v)} type="range" min={mn} max={mx}/>))}
      <Sec label="Capacité"/>
      <Field l="Nom" value={form.ability} onChange={v=>sf("ability",v)} placeholder="Ex: Haki des Rois"/>
      <Field l="Description" value={form.abilityDesc} onChange={v=>sf("abilityDesc",v)} rows={2}/>
      <Sec label="Attaque 1"/>
      <div style={{display:"flex",gap:8}}><div style={{flex:2}}><Field l="Nom" value={form.move1Name} onChange={v=>sf("move1Name",v)}/></div><div style={{flex:1}}><Field l="Dmg" value={form.move1Dmg} onChange={v=>sf("move1Dmg",+v)} type="number"/></div></div>
      <Field l="Description" value={form.move1Desc} onChange={v=>sf("move1Desc",v)} rows={1}/>
      <Sec label="Attaque 2"/>
      <div style={{display:"flex",gap:8}}><div style={{flex:2}}><Field l="Nom" value={form.move2Name} onChange={v=>sf("move2Name",v)}/></div><div style={{flex:1}}><Field l="Dmg" value={form.move2Dmg} onChange={v=>sf("move2Dmg",+v)} type="number"/></div></div>
      <Field l="Description" value={form.move2Desc} onChange={v=>sf("move2Desc",v)} rows={1}/>
      <Sec label="Finitions"/>
      <Field l="Flavor text" value={form.flavorText} onChange={v=>sf("flavorText",v)} rows={2} placeholder={`"Une phrase mémorable..."`}/>
      <div style={{display:"flex",gap:8}}><div style={{flex:1}}><Field l="N° carte" value={form.cardNumber} onChange={v=>sf("cardNumber",v)}/></div><div style={{flex:1}}><Field l="Total" value={form.totalCards} onChange={v=>sf("totalCards",v)}/></div></div>
      {msg&&<div style={{marginBottom:8,color:"#2d8a4e",fontWeight:700}}>{msg}</div>}
      <button onClick={()=>doExport(form)} disabled={exporting} style={{width:"100%",marginTop:8,background:exporting?"#eee":"#eef6ee",color:exporting?"#bbb":"#2d8a4e",border:"none",borderRadius:10,padding:"13px 0",cursor:exporting?"not-allowed":"pointer",fontWeight:700,fontSize:14}}>
        {exporting?"Export en cours…":"⬇ EXPORT PNG"}
      </button>
    </div>}
    {view==="preview"&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 16px 80px",background:"#e8e4de",minHeight:"calc(100vh - 100px)"}}>
      <div style={{fontSize:9,color:"#bbb",letterSpacing:3,textTransform:"uppercase",marginBottom:20,fontFamily:"sans-serif"}}>Aperçu temps réel</div>
      {(()=>{const mw=Math.min(typeof window!=="undefined"?window.innerWidth-32:360,420);return<TCGCard card={form} scale={mw/VW} svgUrl={SVG_URL}/>;})()}
      <div style={{marginTop:32,fontSize:9,color:"#bbb",letterSpacing:2,textAlign:"center",fontFamily:"sans-serif"}}>{Math.round(VW)} × {Math.round(VH)} px · SVG</div>
    </div>}
    <Nav/>
  </div>);

  if(view==="profiles")return(<div style={ps}><div style={{padding:"20px 16px 0"}}>
    <div style={{fontSize:20,fontWeight:900,color:"#111",letterSpacing:2,marginBottom:20,fontFamily:"sans-serif"}}>Profils</div>
    {isAdmin&&<div style={{background:"#fff",borderRadius:14,padding:16,marginBottom:20,border:"1.5px solid #e8e4de"}}>
      <div style={{fontSize:13,fontWeight:700,color:"#444",marginBottom:12}}>+ Nouveau profil</div>
      <AddPI onAdd={(name,bio)=>{const id=name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_")+"_"+uid().slice(0,3);setProfiles(p=>[...p,{id,name,bio,photos:[]}]);}}/>
    </div>}
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {profiles.map(p=><PCard key={p.id} profile={p} canEdit={isAdmin||role===p.id}
        cardCount={cards.filter(c=>c.profileId===p.id).length}
        onPhoto={url=>setProfiles(prev=>prev.map(x=>x.id===p.id?{...x,photos:[...x.photos,url]}:x))}
        onDelPhoto={idx=>setProfiles(prev=>prev.map(x=>x.id===p.id?{...x,photos:x.photos.filter((_,i)=>i!==idx)}:x))}/>)}
    </div>
  </div><Nav/></div>);

  return null;
}

function AddPI({onAdd}){const [name,setName]=useState(""),[bio,setBio]=useState("");const s={background:"#f5f5f5",border:"1.5px solid #e0e0e0",borderRadius:8,padding:"10px 12px",fontSize:14,color:"#1a1a1a",width:"100%",outline:"none",fontFamily:"sans-serif"};return(<div style={{display:"flex",flexDirection:"column",gap:8}}><input style={s} value={name} onChange={e=>setName(e.target.value)} placeholder="Pseudo (ex: Kévin)"/><input style={s} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Bio courte…"/><button onClick={()=>{if(name.trim()){onAdd(name.trim(),bio.trim());setName("");setBio("");}}} style={{cursor:"pointer",border:"none",borderRadius:10,padding:"11px 0",background:"#111",color:"#fff",fontSize:14,fontWeight:700}}>Créer le profil</button></div>);}

function PCard({profile,canEdit,cardCount,onPhoto,onDelPhoto}){return(<div style={{background:"#fff",borderRadius:14,padding:16,border:"1.5px solid #e8e4de",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}><div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>{profile.photos.length===0&&<div style={{width:56,height:56,borderRadius:10,background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:"#ddd"}}>👤</div>}{profile.photos.map((url,i)=><div key={i} style={{position:"relative",width:56,height:56}}><img src={url} alt="" style={{width:56,height:56,borderRadius:10,objectFit:"cover",border:"2px solid #eee",display:"block"}}/>{canEdit&&<div onClick={()=>onDelPhoto(i)} style={{position:"absolute",top:-5,right:-5,width:18,height:18,borderRadius:"50%",background:"#d95a5a",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontWeight:900}}>✕</div>}</div>)}</div><div style={{fontWeight:700,fontSize:16,color:"#111"}}>{profile.name}</div>{profile.bio&&<div style={{fontSize:12,color:"#aaa",marginTop:2,fontStyle:"italic"}}>{profile.bio}</div>}<div style={{fontSize:11,color:"#ccc",marginTop:4,marginBottom:canEdit?12:0}}>{cardCount} carte{cardCount!==1?"s":""}</div>{canEdit&&<><div style={{fontSize:9,color:"#bbb",fontWeight:900,letterSpacing:1.5,marginBottom:8,textTransform:"uppercase",fontFamily:"sans-serif"}}>Ajouter une photo</div><PhotoUploader onPhoto={onPhoto}/></>}</div>);}
