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

// Inject foil animation keyframes once
if (typeof document !== "undefined" && !document.getElementById("tcg-foil-kf")) {
  const _s = document.createElement("style");
  _s.id = "tcg-foil-kf";
  _s.textContent = [
    "@keyframes tcgFoilLight{0%,100%{background-position:0% 50%}50%{background-position:200% 50%}}",
    "@keyframes tcgFoilHeavy{0%,100%{background-position:0% 50%}50%{background-position:300% 50%}}",
  ].join("");
  document.head.appendChild(_s);
}

// ─── SVG COLOR SYSTEM ─────────────────────────────────────────────────────────
const svgTextCache = {};
const preparedSvgCache = {};

async function loadSvgText(url) {
  if (!svgTextCache[url]) {
    svgTextCache[url] = await fetch(url).then(r => r.text());
  }
  return svgTextCache[url];
}

const normalizeSvgLabel = value => {
  const raw = (value || "").toString().trim().toLowerCase();
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
};
const nodeLabelParts = el => {
  const id = normalizeSvgLabel(el?.getAttribute?.("id") || "");
  const dataName = normalizeSvgLabel(el?.getAttribute?.("data-name") || "");
  return [id, dataName].filter(Boolean);
};
const hasAllTokens = (label, tokens) => tokens.every(token => label.includes(token));
const findElementsColorGroup = doc => {
  const direct = doc.getElementById("Elements_Color") || doc.getElementById("elements_color");
  if (direct) return direct;
  const groups = Array.from(doc.querySelectorAll("g"));
  const exactAliases = new Set(["elementscolor", "elements_colour", "elementcolor", "elements"]);
  for (const g of groups) {
    const labels = nodeLabelParts(g);
    if (labels.some(label => exactAliases.has(label))) return g;
  }
  return groups.find(g => nodeLabelParts(g).some(label => hasAllTokens(label, ["element", "color"]))) || null;
};
const findTextboxGroup = doc => {
  const direct = doc.getElementById("Zone_de_texte") || doc.getElementById("zone_de_texte") || doc.getElementById("textbox");
  if (direct) return direct;
  const groups = Array.from(doc.querySelectorAll("g"));
  const exactAliases = new Set(["zonedetexte", "zonetexte", "textbox", "textzone", "zoneetexte"]);
  for (const g of groups) {
    const labels = nodeLabelParts(g);
    if (labels.some(label => exactAliases.has(label))) return g;
  }
  return groups.find(g => nodeLabelParts(g).some(label =>
    hasAllTokens(label, ["zone", "texte"]) || hasAllTokens(label, ["text", "box"])
  )) || null;
};
const neutralizeTemplateTextbox = doc => {
  const boxGroup = findTextboxGroup(doc);
  if (!boxGroup) return;
  [boxGroup, ...boxGroup.querySelectorAll("rect")].forEach(el => {
    el.setAttribute("fill", "none");
    el.setAttribute("fill-opacity", "0");
    const style = el.getAttribute("style") || "";
    if (style && /(^|;)\s*fill\s*:/i.test(style)) {
      const next = style
        .replace(/(^|;)\s*fill\s*:[^;]*/ig, "$1 fill:none")
        .replace(/(^|;)\s*fill-opacity\s*:[^;]*/ig, "$1 fill-opacity:0");
      el.setAttribute("style", next);
    }
  });
};

function normalizeSvgLayout(svgText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    if (doc.querySelector("parsererror")) return svgText;
    neutralizeTemplateTextbox(doc);
    const root = doc.documentElement;
    const vb = (root.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
    if (vb.length === 4 && Math.abs(vb[2] - VW) < 1 && Math.abs(vb[3] - VH) < 1) {
      return new XMLSerializer().serializeToString(doc);
    }
    if (doc.getElementById("__normalized_card_root")) {
      return new XMLSerializer().serializeToString(doc);
    }

    // Prefer card-body anchors (Elements_Color) to keep border framing/weight consistent.
    let bx, by, bw, bh, target;
    const cardBodyGroup = findElementsColorGroup(doc);
    const cardBodyRect = cardBodyGroup?.querySelector("rect");
    if (cardBodyRect) {
      bx = Number(cardBodyRect.getAttribute("x"));
      by = Number(cardBodyRect.getAttribute("y"));
      bw = Number(cardBodyRect.getAttribute("width"));
      bh = Number(cardBodyRect.getAttribute("height"));
      target = { x: 0, y: 0, w: VW, h: VH };
    } else {
      // Fallback for templates without Elements_Color
      const textBoxRect = findTextboxGroup(doc)?.querySelector("rect");
      if (!textBoxRect) return svgText;
      bx = Number(textBoxRect.getAttribute("x"));
      by = Number(textBoxRect.getAttribute("y"));
      bw = Number(textBoxRect.getAttribute("width"));
      bh = Number(textBoxRect.getAttribute("height"));
      target = Z.textbox;
    }
    if (![bx, by, bw, bh].every(Number.isFinite) || bw <= 0 || bh <= 0) return svgText;

    const sx = target.w / bw;
    const sy = target.h / bh;
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx <= 0 || sy <= 0) return svgText;
    const tx = target.x - bx * sx;
    const ty = target.y - by * sy;

    const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("id", "__normalized_card_root");
    g.setAttribute("transform", `matrix(${sx} 0 0 ${sy} ${tx} ${ty})`);

    const toMove = Array.from(root.childNodes).filter(node => !(node.nodeType === 1 && node.nodeName.toLowerCase() === "defs"));
    toMove.forEach(node => g.appendChild(node));
    root.appendChild(g);
    root.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
    root.setAttribute("width", `${VW}`);
    root.setAttribute("height", `${VH}`);
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svgText;
  }
}

async function getPreparedSvgText(url) {
  if (!preparedSvgCache[url]) {
    preparedSvgCache[url] = loadSvgText(url).then(text => normalizeSvgLayout(text));
  }
  return preparedSvgCache[url];
}

function applyElementsColor(svgText, contourColor) {
  if (!contourColor) return svgText;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    if (doc.querySelector("parsererror")) return svgText;
    const group = findElementsColorGroup(doc);
    if (!group) return svgText;

    const normalizePaint = value => (value || "").trim().toLowerCase();
    const parseColor = value => {
      const normalized = normalizePaint(value);
      if (!normalized || normalized === "none" || normalized === "transparent" || normalized.startsWith("url(")) {
        return null;
      }
      if (normalized === "black") return { r: 0, g: 0, b: 0, a: 1 };
      if (normalized === "white") return { r: 255, g: 255, b: 255, a: 1 };
      const hex = normalized.match(/^#([0-9a-f]{3,8})$/i);
      if (hex) {
        const h = hex[1];
        if (h.length === 3 || h.length === 4) {
          const r = parseInt(h[0] + h[0], 16);
          const g = parseInt(h[1] + h[1], 16);
          const b = parseInt(h[2] + h[2], 16);
          const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1;
          return { r, g, b, a };
        }
        if (h.length === 6 || h.length === 8) {
          const r = parseInt(h.slice(0, 2), 16);
          const g = parseInt(h.slice(2, 4), 16);
          const b = parseInt(h.slice(4, 6), 16);
          const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
          return { r, g, b, a };
        }
      }
      const rgb = normalized.match(/^rgba?\(\s*([0-9.]+)\s*[, ]\s*([0-9.]+)\s*[, ]\s*([0-9.]+)(?:\s*[,/]\s*([0-9.]+))?\s*\)$/i);
      if (rgb) {
        const r = Number(rgb[1]);
        const g = Number(rgb[2]);
        const b = Number(rgb[3]);
        const a = rgb[4] == null ? 1 : Number(rgb[4]);
        if ([r, g, b, a].every(Number.isFinite)) return { r, g, b, a };
      }
      return null;
    };
    const isNearBlack = value => {
      const parsed = parseColor(value);
      if (!parsed || parsed.a <= 0) return false;
      const lum = 0.2126 * parsed.r + 0.7152 * parsed.g + 0.0722 * parsed.b;
      return lum <= 55;
    };
    const isPaintable = value => {
      const normalized = normalizePaint(value);
      return !!normalized && normalized !== "none" && normalized !== "transparent" && !normalized.startsWith("url(");
    };
    const extractUrlId = value => {
      const match = (value || "").match(/url\(\s*#([^)]+)\s*\)/i);
      return match ? match[1].trim() : "";
    };
    const parseInlineStyle = styleText => {
      const out = {};
      (styleText || "").split(";").forEach(chunk => {
        const idx = chunk.indexOf(":");
        if (idx === -1) return;
        const key = chunk.slice(0, idx).trim().toLowerCase();
        const value = chunk.slice(idx + 1).trim();
        if (key) out[key] = value;
      });
      return out;
    };
    const setInlineStyleProp = (el, prop, value) => {
      const styles = parseInlineStyle(el.getAttribute("style") || "");
      styles[prop] = value;
      const next = Object.entries(styles).map(([k, v]) => `${k}: ${v}`).join("; ");
      if (next) el.setAttribute("style", `${next};`);
    };
    const PAINTABLE_TAGS = new Set([
      "path", "rect", "circle", "ellipse", "polygon", "polyline", "line", "text", "use"
    ]);

    // Parse simple Illustrator/Canva class rules (.cls-*) to detect paint defined by CSS classes.
    const classRuleMap = new Map();
    const parseStyleTag = styleTag => {
      const css = styleTag.textContent || "";
      const classRuleRegex = /\.([_a-zA-Z][-\w]*)\s*\{([^}]*)\}/g;
      let ruleMatch;
      while ((ruleMatch = classRuleRegex.exec(css)) !== null) {
        const className = ruleMatch[1];
        const declarations = ruleMatch[2];
        const current = classRuleMap.get(className) || {};
        const fillMatch = declarations.match(/(?:^|;)\s*fill\s*:\s*([^;]+)\s*(?:;|$)/i);
        const strokeMatch = declarations.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)\s*(?:;|$)/i);
        const filterMatch = declarations.match(/(?:^|;)\s*filter\s*:\s*([^;]+)\s*(?:;|$)/i);
        if (fillMatch) current.fill = fillMatch[1].trim();
        if (strokeMatch) current.stroke = strokeMatch[1].trim();
        if (filterMatch) current.filter = filterMatch[1].trim();
        if (current.fill || current.stroke || current.filter) classRuleMap.set(className, current);
      }
    };
    doc.querySelectorAll("style").forEach(parseStyleTag);

    const getClassProp = (el, prop) => {
      const classAttr = el.getAttribute("class") || "";
      const classes = classAttr.split(/\s+/).filter(Boolean);
      for (const cls of classes) {
        const value = classRuleMap.get(cls)?.[prop];
        if (value != null) return value;
      }
      return null;
    };
    const getStyleProp = (el, prop) => {
      const styleAttr = el.getAttribute("style");
      if (!styleAttr) return "";
      return parseInlineStyle(styleAttr)[prop] || "";
    };
    const hasExplicitProp = (el, prop) => {
      if (el.getAttribute(prop) !== null) return true;
      if (getStyleProp(el, prop)) return true;
      return getClassProp(el, prop) != null;
    };
    const shouldRecolorProp = (el, prop) => {
      const attrVal = el.getAttribute(prop);
      if (attrVal !== null) return isPaintable(attrVal) && isNearBlack(attrVal);
      const styleVal = getStyleProp(el, prop);
      if (styleVal) return isPaintable(styleVal) && isNearBlack(styleVal);
      const classVal = getClassProp(el, prop);
      return isPaintable(classVal) && isNearBlack(classVal);
    };
    const DEFAULT_FILL_CONTOUR_TAGS = new Set(["path", "polygon", "polyline", "circle", "ellipse", "use", "text"]);
    const isDefaultBlackFillContour = el => {
      const tag = (el.tagName || "").toLowerCase();
      if (!DEFAULT_FILL_CONTOUR_TAGS.has(tag)) return false;
      // Contour exports often omit fill/stroke and rely on default SVG fill=black.
      return !hasExplicitProp(el, "fill") && !hasExplicitProp(el, "stroke");
    };
    const isContourElement = el => (
      shouldRecolorProp(el, "stroke") ||
      shouldRecolorProp(el, "fill") ||
      isDefaultBlackFillContour(el)
    );

    [group, ...group.querySelectorAll("*")].forEach(el => {
      const tag = (el.tagName || "").toLowerCase();
      if (!PAINTABLE_TAGS.has(tag) || !isContourElement(el)) return;
      if (shouldRecolorProp(el, "stroke")) {
        el.setAttribute("stroke", contourColor);
        setInlineStyleProp(el, "stroke", contourColor);
      }
      if (shouldRecolorProp(el, "fill") || isDefaultBlackFillContour(el)) {
        el.setAttribute("fill", contourColor);
        setInlineStyleProp(el, "fill", contourColor);
      }
    });

    // Keep drop-shadow floods black for filters referenced by #Elements_Color.
    const filterIds = new Set();
    [group, ...group.querySelectorAll("*")].forEach(el => {
      const attrFilter = el.getAttribute("filter");
      const styleFilter = getStyleProp(el, "filter");
      const classFilter = getClassProp(el, "filter");
      [attrFilter, styleFilter, classFilter].forEach(filterVal => {
        const id = extractUrlId(filterVal || "");
        if (id) filterIds.add(id);
      });
    });
    filterIds.forEach(id => {
      const filterEl = doc.getElementById(id);
      if (!filterEl) return;
      filterEl.querySelectorAll("feFlood").forEach(node => {
        node.setAttribute("flood-color", "#000000");
      });
    });
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svgText;
  }
}

function neutralizeFondImage(svgText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    if (doc.querySelector("parsererror")) return svgText;
    const fg = doc.getElementById("Fond_Image") || doc.getElementById("fond_image");
    if (!fg) return svgText;
    // Use display:none via inline style — overrides CSS class fill/opacity rules
    [fg, ...fg.querySelectorAll("*")].forEach(el => {
      el.setAttribute("style", "display:none");
    });
    return new XMLSerializer().serializeToString(doc);
  } catch { return svgText; }
}

function useDynamicSvg(svgUrl, contourColor, isFullArt = false) {
  const [blobUrl, setBlobUrl] = useState(null);
  useEffect(() => {
    let active = true, created = null;
    getPreparedSvgText(svgUrl).then(text => {
      if (!active) return;
      let nextText = contourColor ? applyElementsColor(text, contourColor) : text;
      if (isFullArt) nextText = neutralizeFondImage(nextText);
      const blob = new Blob([nextText], { type: "image/svg+xml" });
      created = URL.createObjectURL(blob);
      if (active) setBlobUrl(created);
    }).catch(() => {});
    return () => { active = false; if (created) URL.revokeObjectURL(created); };
  }, [svgUrl, contourColor, isFullArt]);
  return blobUrl;
}

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

// Coordonnées des textes overlay — calées sur les slots du SVG template
// slot-nom(52,7) slot-pv(530,40) slot-atk(11,776) slot-def(528,776) slot-famille(569,303) slot-textbox(41,516)
const T = {
  nom:    { x: 52,  y: 44,  size: 30, anchor: "start" },
  pvVal:  { x: 578, y: 46,  size: 30, anchor: "end"   },
  pvLbl:  { x: 578, y: 70,  size: 13, anchor: "end"   },
  atkLbl: { x: 55,  y: 771, size: 10, anchor: "middle" },
  atkVal: { x: 55,  y: 797, size: 24, anchor: "middle" },
  defLbl: { x: 560, y: 771, size: 10, anchor: "middle" },
  defVal: { x: 560, y: 797, size: 24, anchor: "middle" },
  fam:    { x: 600, y: 299, size: 18                   }, // rotation 90° — centre strip famille
};

const getTb=card=>({x:card.tbX??Z.textbox.x,y:card.tbY??Z.textbox.y,w:card.tbW??Z.textbox.w,h:card.tbH??Z.textbox.h,rx:Z.textbox.rx});
const getPos=card=>({
  nom:    {x:card.nomX??T.nom.x,   y:card.nomY??T.nom.y},
  atkLbl: {x:card.atkX??T.atkLbl.x,y:card.atkY??T.atkLbl.y},
  atkVal: {x:card.atkX??T.atkVal.x,y:(card.atkY??T.atkLbl.y)+(T.atkVal.y-T.atkLbl.y)},
  defLbl: {x:card.defX??T.defLbl.x,y:card.defY??T.defLbl.y},
  defVal: {x:card.defX??T.defVal.x,y:(card.defY??T.defLbl.y)+(T.defVal.y-T.defLbl.y)},
  fam:    {x:card.famX??T.fam.x,   y:card.famY??T.fam.y},
});

const RARITIES = [
  { id: "C", label: "Commune",    color: "#888888" },
  { id: "R", label: "Rare",       color: "#2196f3" },
  { id: "L", label: "Légendaire", color: "#ffd700" },
];
const DEFAULT_FAMILIES = ["Guerrier","Mage","Voleur","Berserker","Capitaine","Marine","Pirate","Chasseur","Génie","Robot","Sage"];
const PRESETS_MAIN   = ["#1a1a1a","#c0392b","#1565c0","#1b5e20","#7b1fa2","#e65100","#006064","#283593","#ad1457","#37474f","#bf8a00","#4a148c","#004d40","#880e4f","#b71c1c"];
const PRESETS_TB     = ["#000000","#0d0d0d","#1a1a2e","#0d1b2a","#1b1b1b","#2c1810","#0f0f23","#1a0a2e","#1a3a1a","#0a0a0a"];
const PRESETS_STROKE = ["#ffffff","#000000","#ffd700","#ff6b6b","#74b9ff","#a29bfe","#55efc4"];

const BLANK = {
  id:null,profileId:"",name:"",family:"",photoUrl:"",
  colorMap:{},contourColor:"",strokeColor:"#ffffff",strokeWidth:2,
  textBoxColor:"#000000",textBoxOpacity:0.85,
  rarityId:"C",isEvolution:false,evolutionFrom:"",
  hp:80,attack:50,defense:40,
  ability:"",abilityDesc:"",
  move1Name:"",move1Dmg:30,move1Desc:"",
  move2Name:"",move2Dmg:60,move2Desc:"",
  flavorText:"",cardNumber:"001",totalCards:"060",
  tbX:null,tbY:null,tbW:null,tbH:null,
  nomX:null,nomY:null,atkX:null,atkY:null,defX:null,defY:null,famX:null,famY:null,
};
const INIT_PROFILES = [{id:"lechich",name:"Le Chich",bio:"Dev boss.",photos:[]}];
const uid = () => Math.random().toString(36).slice(2,9);
const getContourColor = card => {
  if (card?.contourColor) return card.contourColor;
  const legacy = card?.colorMap && typeof card.colorMap === "object"
    ? Object.values(card.colorMap).find(v => typeof v === "string" && v.startsWith("#"))
    : "";
  return legacy || "";
};

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
function TCGCard({card,scale=1,svgUrl="./Card_TCG.svg",editable=false,onUpdateTextbox}) {
  const W=VW*scale, H=VH*scale;
  const clipId=`pc-${card.id||"p"}-${Math.round(scale*1000)}`;
  const tbCol=card.textBoxColor||"#000";
  const tbOp=card.textBoxOpacity??0.85;
  const stCol=card.strokeColor||"#fff";
  const stW=card.strokeWidth??2;
  const rar=RARITIES.find(r=>r.id===card.rarityId)||RARITIES[0];
  const isFullArt = ["R","L"].includes(card.rarityId);
  const isLegendary = card.rarityId === "L";
  const dynamicUrl=useDynamicSvg(svgUrl,getContourColor(card),isFullArt);
  const bgSrc=dynamicUrl||svgUrl;
  const svgRef=useRef();
  const dragRef=useRef(null);
  const cbRef=useRef(onUpdateTextbox);
  useEffect(()=>{cbRef.current=onUpdateTextbox;},[onUpdateTextbox]);
  const tb=getTb(card);
  const pos=getPos(card);

  useEffect(()=>{
    if(!editable)return;
    const pt=e=>{const r=svgRef.current?.getBoundingClientRect();if(!r)return{x:0,y:0};const p=e.touches?e.touches[0]:e;return{x:(p.clientX-r.left)*VW/r.width,y:(p.clientY-r.top)*VH/r.height};};
    const mv=e=>{
      const d=dragRef.current;if(!d)return;
      if(e.cancelable)e.preventDefault();
      const{x,y}=pt(e);const dx=x-d.sx,dy=y-d.sy;
      if(["move","se","sw","ne","nw"].includes(d.type)){
        let nx=d.ox,ny=d.oy,nw=d.ow,nh=d.oh;
        if(d.type==="move"){nx=d.ox+dx;ny=d.oy+dy;}
        else if(d.type==="se"){nw=Math.max(80,d.ow+dx);nh=Math.max(50,d.oh+dy);}
        else if(d.type==="sw"){nx=d.ox+dx;nw=Math.max(80,d.ow-dx);nh=Math.max(50,d.oh+dy);}
        else if(d.type==="ne"){ny=d.oy+dy;nw=Math.max(80,d.ow+dx);nh=Math.max(50,d.oh-dy);}
        else if(d.type==="nw"){nx=d.ox+dx;ny=d.oy+dy;nw=Math.max(80,d.ow-dx);nh=Math.max(50,d.oh-dy);}
        cbRef.current?.({tbX:Math.round(nx),tbY:Math.round(ny),tbW:Math.round(nw),tbH:Math.round(nh)});
      } else {
        cbRef.current?.({[`${d.type}X`]:Math.round(d.ox+dx),[`${d.type}Y`]:Math.round(d.oy+dy)});
      }
    };
    const up=()=>{dragRef.current=null;};
    window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);
    window.addEventListener("touchmove",mv,{passive:false});window.addEventListener("touchend",up);
    return()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);window.removeEventListener("touchmove",mv);window.removeEventListener("touchend",up);};
  },[editable]);

  const startDrag=(type,ox,oy,e)=>{
    e.preventDefault();e.stopPropagation();
    const r=svgRef.current?.getBoundingClientRect();if(!r)return;
    const p=e.touches?e.touches[0]:e;
    dragRef.current={type,sx:(p.clientX-r.left)*VW/r.width,sy:(p.clientY-r.top)*VH/r.height,ox,oy,ow:tb.w,oh:tb.h};
  };

  // Helper: texte avec stroke TCG
  const WT={fontFamily:"'Arial Black','Arial Bold',Arial,sans-serif",fontWeight:900,fill:"#ffffff",stroke:stCol,strokeWidth:stW,strokeLinejoin:"round",paintOrder:"stroke fill"};

  // Lignes textbox (coordonnées relatives à tb)
  const lines=[];let ty=tb.y+36;
  if(card.ability){lines.push({b:true,t:`[${card.ability}]`,x:tb.x+16,y:ty,s:16});ty+=24;if(card.abilityDesc){lines.push({t:card.abilityDesc,x:tb.x+16,y:ty,s:13});ty+=20;}}
  [[card.move1Name,card.move1Dmg,card.move1Desc],[card.move2Name,card.move2Dmg,card.move2Desc]].forEach(([name,dmg,desc])=>{
    if(!name)return;
    lines.push({b:true,t:name,x:tb.x+16,y:ty,s:16});
    if(dmg>0)lines.push({b:true,t:`+${dmg}`,x:tb.x+tb.w-16,y:ty,s:16,a:"end"});
    ty+=24;if(desc){lines.push({t:desc,x:tb.x+16,y:ty,s:13});ty+=19;}
  });
  if(card.flavorText)lines.push({it:true,t:`"${card.flavorText}"`,x:tb.x+tb.w/2,y:tb.y+tb.h-18,s:12,a:"middle"});
  if(!lines.length)lines.push({ph:true,t:"Zone de texte",x:tb.x+tb.w/2,y:tb.y+tb.h/2,s:14,a:"middle"});

  const HS=10;

  return(
    <div style={{position:"relative",width:W,height:H,flexShrink:0,display:"inline-block",borderRadius:Math.round(28*scale),overflow:"hidden"}}>
      {/* Full art: photo derrière le frame SVG */}
      {isFullArt&&card.photoUrl&&<img src={card.photoUrl} alt="" width={W} height={H} style={{position:"absolute",inset:0,display:"block",objectFit:"cover"}}/>}
      {/* SVG template (Fond_Image neutralisé en full art) */}
      <img src={bgSrc} alt="" width={W} height={H} style={{position:"absolute",inset:0,display:"block"}}/>
      {/* Foil overlay */}
      {isFullArt&&<div style={{
        position:"absolute",inset:0,
        background:isLegendary
          ?"linear-gradient(135deg,rgba(255,0,100,.28) 0%,rgba(255,190,0,.28) 17%,rgba(0,230,130,.28) 33%,rgba(0,90,255,.28) 50%,rgba(190,0,255,.28) 67%,rgba(255,0,100,.28) 100%)"
          :"linear-gradient(135deg,rgba(255,255,255,.03) 0%,rgba(255,215,120,.09) 25%,rgba(120,215,255,.07) 50%,rgba(255,255,255,.03) 75%,rgba(190,255,190,.07) 100%)",
        backgroundSize:isLegendary?"300% 300%":"200% 200%",
        animation:isLegendary?"tcgFoilHeavy 2s linear infinite":"tcgFoilLight 4s linear infinite",
        pointerEvents:"none",
        mixBlendMode:"screen",
        borderRadius:Math.round(28*scale),
      }}/>}

      {/* Overlay dynamique */}
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${VW} ${VH}`} xmlns="http://www.w3.org/2000/svg"
        style={{position:"absolute",inset:0,display:"block"}}>
        <defs>
          <clipPath id={clipId}>
            <rect x={Z.photo.x} y={Z.photo.y} width={Z.photo.w} height={Z.photo.h} rx={Z.photo.rx}/>
          </clipPath>
        </defs>

        {/* ── PHOTO (seulement en mode normal — full art utilise la couche img) ── */}
        {!isFullArt&&card.photoUrl&&<image href={card.photoUrl} x={Z.photo.x} y={Z.photo.y} width={Z.photo.w} height={Z.photo.h} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`}/>}

        {/* ── ONGLET ÉVOLUTION ── */}
        {card.isEvolution&&<>
          <text x={308} y={91} textAnchor="middle" dominantBaseline="middle" {...WT} fontSize={15} fontWeight={800}>
            {card.evolutionFrom?`Évolue de ${card.evolutionFrom}`:"ÉVOLUTION"}
          </text>
        </>}

        {/* ── FOND TEXTBOX (transparent en full art) ── */}
        <rect x={tb.x} y={tb.y} width={tb.w} height={tb.h} rx={tb.rx} fill={tbCol} fillOpacity={isFullArt?0:tbOp}/>

        {/* ── RARETÉ + NUMÉRO ── */}
        {card.rarityId==="C"?(
          <text x={308} y={820} textAnchor="middle" dominantBaseline="middle" fontFamily="Arial" fontSize={8} fill="rgba(255,255,255,0.28)" letterSpacing={1.5}>
            {card.cardNumber}/{card.totalCards}
          </text>
        ):(
          <>
            <rect x={228} y={795} width={160} height={16} rx={8} fill={rar.color} fillOpacity={0.8}/>
            <text x={308} y={803} textAnchor="middle" dominantBaseline="middle" fontFamily="Arial" fontWeight={900} fontSize={10} fill="#fff" letterSpacing={1.5}>
              {rar.label.toUpperCase()}
            </text>
            <text x={308} y={826} textAnchor="middle" dominantBaseline="middle" fontFamily="monospace" fontSize={9} fill="rgba(255,255,255,0.5)">
              {card.cardNumber}/{card.totalCards}
            </text>
          </>
        )}

        {/* ── NOM ── */}
        <text x={pos.nom.x} y={pos.nom.y} textAnchor={T.nom.anchor} dominantBaseline="middle" {...WT} fontSize={T.nom.size}>
          {(card.name||"Nom de la carte").slice(0,20)}
        </text>

        {/* ── PV ── */}
        <text x={T.pvVal.x} y={T.pvVal.y} textAnchor={T.pvVal.anchor} dominantBaseline="middle" {...WT} fontSize={T.pvVal.size}>{card.hp}</text>
        <text x={T.pvLbl.x} y={T.pvLbl.y} textAnchor="end" fontFamily="Arial" fontWeight={700} fontSize={T.pvLbl.size} fill="rgba(255,255,255,0.85)" stroke={stCol} strokeWidth={stW*0.5} paintOrder="stroke fill">PV</text>

        {/* ── FAMILLE ── */}
        {card.family&&<text x={pos.fam.x} y={pos.fam.y} textAnchor="middle" dominantBaseline="middle"
          transform={`rotate(90,${pos.fam.x},${pos.fam.y})`} {...WT} fontSize={T.fam.size}>
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
        <text x={pos.atkLbl.x} y={pos.atkLbl.y} textAnchor={T.atkLbl.anchor} fontFamily="Arial" fontWeight={700} fontSize={T.atkLbl.size} fill="rgba(255,255,255,0.85)" stroke={stCol} strokeWidth={stW*0.5} paintOrder="stroke fill">ATK</text>
        <text x={pos.atkVal.x} y={pos.atkVal.y} textAnchor={T.atkVal.anchor} dominantBaseline="middle" {...WT} fontSize={T.atkVal.size}>{card.attack}</text>

        {/* ── DEF ── */}
        <text x={pos.defLbl.x} y={pos.defLbl.y} textAnchor={T.defLbl.anchor} fontFamily="Arial" fontWeight={700} fontSize={T.defLbl.size} fill="rgba(255,255,255,0.85)" stroke={stCol} strokeWidth={stW*0.5} paintOrder="stroke fill">DEF</text>
        <text x={pos.defVal.x} y={pos.defVal.y} textAnchor={T.defVal.anchor} dominantBaseline="middle" {...WT} fontSize={T.defVal.size}>{card.defense}</text>

        {/* ── HANDLES DRAG/RESIZE (mode édition seulement) ── */}
        {editable&&<>
          <rect x={tb.x} y={tb.y} width={tb.w} height={tb.h} rx={tb.rx}
            fill="rgba(100,160,255,0.06)" stroke="rgba(100,160,255,0.85)" strokeWidth={2} strokeDasharray="10 5"
            style={{cursor:"move"}}
            onMouseDown={e=>startDrag("move",tb.x,tb.y,e)} onTouchStart={e=>startDrag("move",tb.x,tb.y,e)}/>
          {[["nw",tb.x,tb.y],["ne",tb.x+tb.w,tb.y],["sw",tb.x,tb.y+tb.h],["se",tb.x+tb.w,tb.y+tb.h]].map(([t,hx,hy])=>(
            <rect key={t} x={hx-HS} y={hy-HS} width={HS*2} height={HS*2} rx={3}
              fill="rgba(255,255,255,0.92)" stroke="#4a90d9" strokeWidth={1.5}
              style={{cursor:t==="nw"||t==="se"?"nwse-resize":"nesw-resize"}}
              onMouseDown={e=>startDrag(t,tb.x,tb.y,e)} onTouchStart={e=>startDrag(t,tb.x,tb.y,e)}/>
          ))}
          <rect x={pos.nom.x-8} y={pos.nom.y-26} width={230} height={36} rx={4}
            fill="rgba(255,200,80,0.06)" stroke="rgba(255,200,80,0.75)" strokeWidth={1.5} strokeDasharray="8 4"
            style={{cursor:"move"}}
            onMouseDown={e=>startDrag("nom",pos.nom.x,pos.nom.y,e)} onTouchStart={e=>startDrag("nom",pos.nom.x,pos.nom.y,e)}/>
          <rect x={pos.atkLbl.x-28} y={pos.atkLbl.y-6} width={56} height={40} rx={4}
            fill="rgba(255,100,100,0.06)" stroke="rgba(255,100,100,0.75)" strokeWidth={1.5} strokeDasharray="8 4"
            style={{cursor:"move"}}
            onMouseDown={e=>startDrag("atk",pos.atkLbl.x,pos.atkLbl.y,e)} onTouchStart={e=>startDrag("atk",pos.atkLbl.x,pos.atkLbl.y,e)}/>
          <rect x={pos.defLbl.x-28} y={pos.defLbl.y-6} width={56} height={40} rx={4}
            fill="rgba(100,220,100,0.06)" stroke="rgba(100,220,100,0.75)" strokeWidth={1.5} strokeDasharray="8 4"
            style={{cursor:"move"}}
            onMouseDown={e=>startDrag("def",pos.defLbl.x,pos.defLbl.y,e)} onTouchStart={e=>startDrag("def",pos.defLbl.x,pos.defLbl.y,e)}/>
          {card.family&&<rect x={pos.fam.x-16} y={pos.fam.y-70} width={32} height={140} rx={4}
            fill="rgba(180,100,255,0.06)" stroke="rgba(180,100,255,0.75)" strokeWidth={1.5} strokeDasharray="8 4"
            style={{cursor:"move"}}
            onMouseDown={e=>startDrag("fam",pos.fam.x,pos.fam.y,e)} onTouchStart={e=>startDrag("fam",pos.fam.x,pos.fam.y,e)}/>}
        </>}
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
  const rar=RARITIES.find(r=>r.id===card.rarityId)||RARITIES[0];
  const tb=getTb(card);const pos=getPos(card);
  const lines=[];let ty=tb.y+36;
  if(card.ability){lines.push({b:true,t:`[${card.ability}]`,x:tb.x+16,y:ty,s:16});ty+=24;if(card.abilityDesc){lines.push({t:card.abilityDesc,x:tb.x+16,y:ty,s:13});ty+=20;}}
  [[card.move1Name,card.move1Dmg,card.move1Desc],[card.move2Name,card.move2Dmg,card.move2Desc]].forEach(([name,dmg,desc])=>{if(!name)return;lines.push({b:true,t:name,x:tb.x+16,y:ty,s:16});if(dmg>0)lines.push({b:true,t:`+${dmg}`,x:tb.x+tb.w-16,y:ty,s:16,a:"end"});ty+=24;if(desc){lines.push({t:desc,x:tb.x+16,y:ty,s:13});ty+=19;}});
  if(card.flavorText)lines.push({it:true,t:`"${card.flavorText}"`,x:tb.x+tb.w/2,y:tb.y+tb.h-18,s:12,a:"middle"});
  const wt=(x,y,t,sz,an="start")=>`<text x="${x}" y="${y}" text-anchor="${an}" dominant-baseline="middle" font-family="Arial Black,Arial" font-weight="900" font-size="${sz}" fill="#fff" stroke="${stCol}" stroke-width="${stW}" stroke-linejoin="round" paint-order="stroke fill">${t}</text>`;
  const lx=lines.map(ln=>`<text x="${ln.x}" y="${ln.y}" text-anchor="${ln.a||"start"}" font-family="Arial,sans-serif" font-weight="${ln.b?900:600}" font-style="${ln.it?"italic":"normal"}" font-size="${ln.s||14}" fill="${ln.ph?"rgba(255,255,255,0.25)":"#fff"}" stroke="${ln.ph?"none":"#000"}" stroke-width="${ln.b?2.5:1.5}" stroke-linejoin="round" paint-order="stroke fill">${ln.t}</text>`).join("");
  const evo=card.isEvolution?`<rect x="180" y="70" width="256" height="38" rx="19" fill="#333"/>${wt(308,91,card.evolutionFrom?`Évolue de ${card.evolutionFrom}`:"ÉVOLUTION",15,"middle")}`:"";
  const svg=`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${VW}" height="${VH}" viewBox="0 0 ${VW} ${VH}"><defs>${card.photoUrl?'<clipPath id="ec"><rect x="'+Z.photo.x+'" y="'+Z.photo.y+'" width="'+Z.photo.w+'" height="'+Z.photo.h+'" rx="'+Z.photo.rx+'"/></clipPath>':""}</defs>${card.photoUrl?'<image href="'+card.photoUrl+'" x="'+Z.photo.x+'" y="'+Z.photo.y+'" width="'+Z.photo.w+'" height="'+Z.photo.h+'" preserveAspectRatio="xMidYMid slice" clip-path="url(#ec)"/>':""} ${evo}<rect x="${tb.x}" y="${tb.y}" width="${tb.w}" height="${tb.h}" rx="${tb.rx}" fill="${tbCol}" fill-opacity="${tbOp}"/>${card.rarityId==="C"?`<text x="308" y="820" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="8" fill="rgba(255,255,255,0.28)" letter-spacing="1.5">${card.cardNumber}/${card.totalCards}</text>`:`<rect x="228" y="795" width="160" height="16" rx="8" fill="${rar.color}" fill-opacity="0.8"/><text x="308" y="803" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-weight="900" font-size="10" fill="#fff" letter-spacing="1.5">${rar.label.toUpperCase()}</text><text x="308" y="826" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-size="9" fill="rgba(255,255,255,0.5)">${card.cardNumber}/${card.totalCards}</text>`}${wt(pos.nom.x,pos.nom.y,(card.name||"Nom de la carte").slice(0,20),T.nom.size,"start")}<text x="${T.pvVal.x}" y="${T.pvVal.y}" text-anchor="end" dominant-baseline="middle" font-family="Arial Black,Arial" font-weight="900" font-size="${T.pvVal.size}" fill="#fff" stroke="${stCol}" stroke-width="${stW}" stroke-linejoin="round" paint-order="stroke fill">${card.hp}</text><text x="${T.pvLbl.x}" y="${T.pvLbl.y}" text-anchor="end" font-family="Arial" font-weight="700" font-size="${T.pvLbl.size}" fill="rgba(255,255,255,0.85)" stroke="${stCol}" stroke-width="${stW*0.5}" paint-order="stroke fill">PV</text>${card.family?`<text x="${pos.fam.x}" y="${pos.fam.y}" text-anchor="middle" dominant-baseline="middle" transform="rotate(90,${pos.fam.x},${pos.fam.y})" font-family="Arial Black,Arial" font-weight="900" font-size="${T.fam.size}" fill="#fff" stroke="${stCol}" stroke-width="${stW}" stroke-linejoin="round" paint-order="stroke fill">${card.family}</text>`:""} ${lx}<text x="${pos.atkLbl.x}" y="${pos.atkLbl.y}" text-anchor="middle" font-family="Arial" font-weight="700" font-size="${T.atkLbl.size}" fill="rgba(255,255,255,0.85)" stroke="${stCol}" stroke-width="${stW*0.5}" paint-order="stroke fill">ATK</text>${wt(pos.atkVal.x,pos.atkVal.y,card.attack,T.atkVal.size,"middle")}<text x="${pos.defLbl.x}" y="${pos.defLbl.y}" text-anchor="middle" font-family="Arial" font-weight="700" font-size="${T.defLbl.size}" fill="rgba(255,255,255,0.85)" stroke="${stCol}" stroke-width="${stW*0.5}" paint-order="stroke fill">DEF</text>${wt(pos.defVal.x,pos.defVal.y,card.defense,T.defVal.size,"middle")}</svg>`;
  const overlayBlob=new Blob([svg],{type:"image/svg+xml"}),overlayUrl=URL.createObjectURL(overlayBlob);

  // Générer le SVG de fond normalisé (+ couleur éventuelle des contours)
  let bgBlobUrl=null,bgUrl=svgUrl;
  const contourColor = getContourColor(card);
  const preparedText=await getPreparedSvgText(svgUrl);
  const bgText=contourColor?applyElementsColor(preparedText,contourColor):preparedText;
  const bgBlob=new Blob([bgText],{type:"image/svg+xml"});
  bgBlobUrl=URL.createObjectURL(bgBlob);
  bgUrl=bgBlobUrl;

  try{
    const[bg,ov]=await Promise.all([load(bgUrl),load(overlayUrl)]);
    const cv=document.createElement("canvas");cv.width=W;cv.height=H;
    const ctx=cv.getContext("2d");ctx.drawImage(bg,0,0,W,H);ctx.drawImage(ov,0,0,W,H);
    const a=document.createElement("a");a.href=cv.toDataURL("image/png");
    a.download=`${(card.name||"carte").replace(/\s+/g,"_")}.png`;a.click();
  }finally{
    URL.revokeObjectURL(overlayUrl);
    if(bgBlobUrl)URL.revokeObjectURL(bgBlobUrl);
    onDone();
  }
}

// ─── SVG COLOR ZONES UI ───────────────────────────────────────────────────────
function SvgColorZones({contourColor,onChange}) {
  const current = contourColor || "#ffffff";
  return(
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontSize:12,color:"#555",flex:1,fontFamily:"sans-serif"}}>Couleur des contours</span>
      <input type="color" value={current}
        onChange={e=>onChange(e.target.value)}
        style={{width:42,height:34,borderRadius:6,border:"1.5px solid #ddd",cursor:"pointer",padding:2,flexShrink:0}}/>
      {!!contourColor&&(
        <button onClick={()=>onChange("")}
          style={{background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:16,lineHeight:1,padding:"0 2px"}}
          title="Réinitialiser">↺</button>
      )}
    </div>
  );
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
const SI={background:"#f5f5f5",border:"1.5px solid #e0e0e0",borderRadius:8,padding:"10px 12px",fontSize:14,color:"#1a1a1a",width:"100%",outline:"none",boxSizing:"border-box",fontFamily:"sans-serif"};
const SL={display:"block",fontSize:9,fontWeight:900,color:"#999",marginBottom:4,textTransform:"uppercase",letterSpacing:1.5,fontFamily:"sans-serif"};

function ColorRow({label,value,onChange,presets}){return(<div style={{marginBottom:14}}><label style={SL}>{label}</label><div style={{display:"flex",gap:8,alignItems:"center"}}><input type="color" value={value} onChange={e=>onChange(e.target.value)} style={{width:48,height:42,borderRadius:8,border:"2px solid #ddd",cursor:"pointer",padding:3,flexShrink:0}}/><div style={{display:"flex",flexWrap:"wrap",gap:6,flex:1}}>{presets.map(c=><div key={c} onClick={()=>onChange(c)} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",flexShrink:0,border:value===c?"3px solid #111":"2px solid rgba(0,0,0,0.15)",boxShadow:c==="#ffffff"?"inset 0 0 0 1px #ccc":"none"}}/>)}</div></div></div>);}
function Field({l,value,onChange,type="text",options,min,max,rows,placeholder}){return(<div style={{marginBottom:12}}><label style={SL}>{l}</label>{options?<select value={value} onChange={e=>onChange(e.target.value)} style={SI}>{options.map(o=><option key={o.id??o} value={o.id??o}>{o.label??o}</option>)}</select>:type==="range"?<div style={{display:"flex",gap:10,alignItems:"center"}}><input type="range" min={min} max={max} step={1} value={value} onChange={e=>onChange(Number(e.target.value))} style={{flex:1,height:4}}/><b style={{fontSize:14,minWidth:36,textAlign:"right"}}>{value}</b></div>:rows?<textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder} style={{...SI,resize:"vertical"}}/>:<input type={type} value={value} onChange={e=>onChange(e.target.value)} style={SI} placeholder={placeholder}/>}</div>);}
function Sec({label}){return<div style={{borderLeft:"3px solid #111",paddingLeft:10,margin:"20px 0 12px",fontSize:10,fontWeight:900,color:"#111",letterSpacing:2,textTransform:"uppercase",fontFamily:"sans-serif"}}>{label}</div>;}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App(){
  const SVG_URL="./Card_TCG.svg";
  const [role,setRole]=useState(null);
  const [profiles,setProfiles]=useState(()=>{try{return JSON.parse(localStorage.getItem("tcg_profiles")||JSON.stringify(INIT_PROFILES));}catch{return INIT_PROFILES;}});
  const [cards,setCards]=useState(()=>{try{return JSON.parse(localStorage.getItem("tcg_cards")||"[]");}catch{return [];}});
  const [families,setFamilies]=useState(()=>{try{return JSON.parse(localStorage.getItem("tcg_families")||JSON.stringify(DEFAULT_FAMILIES));}catch{return DEFAULT_FAMILIES;}});
  useEffect(()=>{localStorage.setItem("tcg_cards",JSON.stringify(cards));},[cards]);
  useEffect(()=>{localStorage.setItem("tcg_profiles",JSON.stringify(profiles));},[profiles]);
  useEffect(()=>{localStorage.setItem("tcg_families",JSON.stringify(families));},[families]);
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
      <Field l="Famille" value={form.family} onChange={v=>sf("family",v)} options={[{id:"",label:"— Aucune —"},...families.map(f=>({id:f,label:f}))]}/>
      <Field l="Rareté" value={form.rarityId} onChange={v=>sf("rarityId",v)} options={RARITIES.map(r=>({id:r.id,label:r.label}))}/>
      <Field l="Profil" value={form.profileId||""} onChange={v=>sf("profileId",v)} options={[{id:"",label:"— Aucun —"},...profiles.map(p=>({id:p.id,label:p.name}))]}/>
      <Sec label="Zones SVG"/>
      <SvgColorZones contourColor={getContourColor(form)} onChange={v=>sf("contourColor",v)}/>
      <Sec label="Textbox &amp; Textes"/>
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
      <div style={{fontSize:9,color:"#bbb",letterSpacing:3,textTransform:"uppercase",marginBottom:4,fontFamily:"sans-serif"}}>Aperçu temps réel</div>
      <div style={{fontSize:10,color:"#aaa",marginBottom:16,fontFamily:"sans-serif"}}>Glisse · Étire aux coins</div>
      {(()=>{const mw=Math.min(typeof window!=="undefined"?window.innerWidth-32:360,420);return<TCGCard card={form} scale={mw/VW} svgUrl={SVG_URL} editable={true} onUpdateTextbox={v=>setForm(p=>({...p,...v}))}/>;})()}
      {(form.tbX!=null||form.tbY!=null||form.tbW!=null||form.tbH!=null||form.nomX!=null||form.atkX!=null||form.defX!=null||form.famX!=null)&&
        <button onClick={()=>setForm(p=>({...p,tbX:null,tbY:null,tbW:null,tbH:null,nomX:null,nomY:null,atkX:null,atkY:null,defX:null,defY:null,famX:null,famY:null}))}
          style={{marginTop:16,background:"#fff",border:"1.5px solid #ddd",borderRadius:8,padding:"7px 18px",cursor:"pointer",fontSize:12,fontWeight:700,color:"#888",fontFamily:"sans-serif"}}>
          ↺ Réinitialiser position
        </button>
      }
      <div style={{marginTop:16,fontSize:9,color:"#bbb",letterSpacing:2,textAlign:"center",fontFamily:"sans-serif"}}>{Math.round(VW)} × {Math.round(VH)} px · SVG</div>
    </div>}
    <Nav/>
  </div>);

  if(view==="profiles")return(<div style={ps}><div style={{padding:"20px 16px 0"}}>
    <div style={{fontSize:20,fontWeight:900,color:"#111",letterSpacing:2,marginBottom:20,fontFamily:"sans-serif"}}>Profils</div>
    {isAdmin&&<FamiliesManager families={families} setFamilies={setFamilies}/>}
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

function FamiliesManager({families,setFamilies}){
  const [newFam,setNewFam]=useState("");
  const add=()=>{const v=newFam.trim();if(v&&!families.includes(v)){setFamilies(p=>[...p,v]);setNewFam("");}};
  return(
    <div style={{background:"#fff",borderRadius:14,padding:16,marginBottom:20,border:"1.5px solid #e8e4de"}}>
      <div style={{fontSize:13,fontWeight:700,color:"#444",marginBottom:12}}>Familles de cartes</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
        {families.map(f=>(
          <div key={f} style={{display:"flex",alignItems:"center",gap:4,background:"#f5f5f5",borderRadius:20,padding:"4px 10px",fontSize:13,border:"1.5px solid #e0e0e0"}}>
            <span>{f}</span>
            <span onClick={()=>setFamilies(p=>p.filter(x=>x!==f))} style={{cursor:"pointer",color:"#d95a5a",fontWeight:900,fontSize:14,lineHeight:1}}>×</span>
          </div>
        ))}
        {families.length===0&&<span style={{fontSize:12,color:"#ccc"}}>Aucune famille définie</span>}
      </div>
      <div style={{display:"flex",gap:8}}>
        <input value={newFam} onChange={e=>setNewFam(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Nouvelle famille…"
          style={{flex:1,background:"#f5f5f5",border:"1.5px solid #e0e0e0",borderRadius:8,padding:"8px 12px",fontSize:14,outline:"none"}}/>
        <button onClick={add} style={{background:"#111",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:14}}>+</button>
      </div>
    </div>
  );
}

function AddPI({onAdd}){const [name,setName]=useState(""),[bio,setBio]=useState("");const s={background:"#f5f5f5",border:"1.5px solid #e0e0e0",borderRadius:8,padding:"10px 12px",fontSize:14,color:"#1a1a1a",width:"100%",outline:"none",fontFamily:"sans-serif"};return(<div style={{display:"flex",flexDirection:"column",gap:8}}><input style={s} value={name} onChange={e=>setName(e.target.value)} placeholder="Pseudo (ex: Kévin)"/><input style={s} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Bio courte…"/><button onClick={()=>{if(name.trim()){onAdd(name.trim(),bio.trim());setName("");setBio("");}}} style={{cursor:"pointer",border:"none",borderRadius:10,padding:"11px 0",background:"#111",color:"#fff",fontSize:14,fontWeight:700}}>Créer le profil</button></div>);}

function PCard({profile,canEdit,cardCount,onPhoto,onDelPhoto}){return(<div style={{background:"#fff",borderRadius:14,padding:16,border:"1.5px solid #e8e4de",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}><div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>{profile.photos.length===0&&<div style={{width:56,height:56,borderRadius:10,background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:"#ddd"}}>👤</div>}{profile.photos.map((url,i)=><div key={i} style={{position:"relative",width:56,height:56}}><img src={url} alt="" style={{width:56,height:56,borderRadius:10,objectFit:"cover",border:"2px solid #eee",display:"block"}}/>{canEdit&&<div onClick={()=>onDelPhoto(i)} style={{position:"absolute",top:-5,right:-5,width:18,height:18,borderRadius:"50%",background:"#d95a5a",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontWeight:900}}>✕</div>}</div>)}</div><div style={{fontWeight:700,fontSize:16,color:"#111"}}>{profile.name}</div>{profile.bio&&<div style={{fontSize:12,color:"#aaa",marginTop:2,fontStyle:"italic"}}>{profile.bio}</div>}<div style={{fontSize:11,color:"#ccc",marginTop:4,marginBottom:canEdit?12:0}}>{cardCount} carte{cardCount!==1?"s":""}</div>{canEdit&&<><div style={{fontSize:9,color:"#bbb",fontWeight:900,letterSpacing:1.5,marginBottom:8,textTransform:"uppercase",fontFamily:"sans-serif"}}>Ajouter une photo</div><PhotoUploader onPhoto={onPhoto}/></>}</div>);}
