const PT = 72/25.4;                 // pt per mm
const PAPERS = { B5:[182,257], A4:[210,297], A5:[148,210], Letter:[215.9,279.4] };
const DASH = [1.2,1.8];             // 破線パターン(pt)

function $(id){ return document.getElementById(id); }

function readState(){
  return {
    paper:$('paper').value, orientation:$('orientation').value,
    customW:+$('customW').value, customH:+$('customH').value,
    type:document.querySelector('#typeTabs .active').dataset.type,
    spacing:+$('spacing').value, endsSolid:$('endsSolid').checked, ruledDash:$('ruledDash').checked,
    thinW:+$('thinW').value, thickW:+$('thickW').value,
    cell:+$('cell').value, gridDash:$('gridDash').checked, gridW:+$('gridW').value,
    dotGap:+$('dotGap').value, dotR:+$('dotR').value,
    lineColor:$('lineColor').value,
    hLeft:$('hLeft').value, hCenter:$('hCenter').value, hRight:$('hRight').value, headerSize:+$('headerSize').value,
    marginTop:+$('marginTop').value, marginBottom:+$('marginBottom').value,
    marginLeft:+$('marginLeft').value, marginRight:+$('marginRight').value,
    pages:Math.max(1, Math.min(100, +$('pages').value||1))
  };
}

function paperDims(s){
  let w,h;
  if(s.paper==='custom'){ w=s.customW; h=s.customH; } else { [w,h]=PAPERS[s.paper]; }
  if(s.orientation==='landscape'){ [w,h]=[h,w]; }
  return [w,h];
}

// すべての座標は「左上原点・mm単位」で計算
function buildGeometry(s){
  const [w,h]=paperDims(s);
  const L=s.marginLeft, R=w-s.marginRight, T=s.marginTop, B=h-s.marginBottom;
  const lines=[], dots=[];
  const eps=1e-6;
  if(s.type==='ruled' && s.spacing>0){
    const ys=[]; for(let y=T; y<=B+eps; y+=s.spacing) ys.push(y);
    ys.forEach((y,i)=>{
      const isEnd = (i===0 || i===ys.length-1);
      const solid = isEnd && s.endsSolid;
      lines.push({ x1:L,y1:y,x2:R,y2:y, w: solid?s.thickW:s.thinW, dash: solid?null:(s.ruledDash?DASH:null) });
    });
  } else if(s.type==='grid' && s.cell>0){
    for(let y=T;y<=B+eps;y+=s.cell) lines.push({x1:L,y1:y,x2:R,y2:y,w:s.gridW,dash:s.gridDash?DASH:null});
    for(let x=L;x<=R+eps;x+=s.cell) lines.push({x1:x,y1:T,x2:x,y2:B,w:s.gridW,dash:s.gridDash?DASH:null});
  } else if(s.type==='dots' && s.dotGap>0){
    for(let x=L;x<=R+eps;x+=s.dotGap) for(let y=T;y<=B+eps;y+=s.dotGap) dots.push({x,y,r:s.dotR});
  }
  return {w,h,L,R,T,B,lines,dots};
}

// ---------- SVG プレビュー ----------
function renderSVG(s, explicitSizeMm){
  const g=buildGeometry(s);
  const ptmm = 25.4/72; // pt -> mm (SVGはmm単位で描画)
  const size = explicitSizeMm ? `width="${g.w}mm" height="${g.h}mm"` : '';
  const ff = "font-family=\"'Zen Maru Gothic','Helvetica Neue',Helvetica,Arial,sans-serif\"";
  let out=`<svg ${size} viewBox="0 0 ${g.w} ${g.h}" xmlns="http://www.w3.org/2000/svg">`;
  out+=`<rect x="0" y="0" width="${g.w}" height="${g.h}" fill="#ffffff"/>`;
  for(const l of g.lines){
    const wmm=(l.w*ptmm).toFixed(3);
    const dash=l.dash ? ` stroke-dasharray="${(l.dash[0]*ptmm).toFixed(3)} ${(l.dash[1]*ptmm).toFixed(3)}"` : '';
    out+=`<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${s.lineColor}" stroke-width="${wmm}"${dash}/>`;
  }
  for(const d of g.dots){
    out+=`<circle cx="${d.x}" cy="${d.y}" r="${d.r}" fill="${s.lineColor}"/>`;
  }
  const fs=(s.headerSize*ptmm).toFixed(2), by=14;
  const esc=t=>t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  if(s.hLeft)   out+=`<text x="${g.L}" y="${by}" font-size="${fs}" fill="#000" ${ff}>${esc(s.hLeft)}</text>`;
  if(s.hCenter) out+=`<text x="${(g.L+g.R)/2}" y="${by}" text-anchor="middle" font-size="${fs}" fill="#000" ${ff}>${esc(s.hCenter)}</text>`;
  if(s.hRight)  out+=`<text x="${g.R}" y="${by}" text-anchor="end" font-size="${fs}" fill="#000" ${ff}>${esc(s.hRight)}</text>`;
  out+=`</svg>`;
  return out;
}

function render(){
  const s=readState();
  $('preview').innerHTML=renderSVG(s,true);
  const [w,h]=paperDims(s);
  $('note').textContent=`${s.paper==='custom'?'カスタム':s.paper} ${w}×${h}mm ／ ${s.pages}枚 （プレビューは1枚目）`;
}

// ---------- ヘッダーを canvas 画像化（PDF用・任意文字対応） ----------
function headerImage(s, g){
  if(!s.hLeft && !s.hCenter && !s.hRight) return null;
  const dpi=300, sc=dpi/25.4;
  const widthMm=g.R-g.L, heightMm=12, baseMm=5;
  const cv=document.createElement('canvas');
  cv.width=Math.round(widthMm*sc); cv.height=Math.round(heightMm*sc);
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#000';
  ctx.font=`${s.headerSize*(dpi/72)}px "Zen Maru Gothic","Helvetica Neue",Helvetica,Arial,sans-serif`;
  ctx.textBaseline='alphabetic';
  const by=baseMm*sc;
  if(s.hLeft){ ctx.textAlign='left'; ctx.fillText(s.hLeft,0,by); }
  if(s.hCenter){ ctx.textAlign='center'; ctx.fillText(s.hCenter,cv.width/2,by); }
  if(s.hRight){ ctx.textAlign='right'; ctx.fillText(s.hRight,cv.width,by); }
  return { dataUrl:cv.toDataURL('image/png'), xMm:g.L, topMm:9, wMm:widthMm, hMm:heightMm };
}

// ---------- PDF 生成 ----------
async function buildPDF(){
  const s=readState();
  const g=buildGeometry(s);
  const { PDFDocument, rgb }=PDFLib;
  const doc=await PDFDocument.create();
  const c=hexToRgb(s.lineColor);
  const col=rgb(c.r,c.g,c.b);
  // ヘッダーを canvas 化する前に Zen Maru Gothic の読み込みを待つ（未ロードだと代替フォントで描画されるため）
  if(document.fonts && document.fonts.load){
    try{ await document.fonts.load(`${s.headerSize}pt "Zen Maru Gothic"`); await document.fonts.ready; }catch(e){}
  }
  const hdr=headerImage(s,g);
  let hdrPng=null;
  if(hdr) hdrPng=await doc.embedPng(hdr.dataUrl);

  for(let p=0;p<s.pages;p++){
    const page=doc.addPage([g.w*PT, g.h*PT]);
    const H=g.h*PT;
    for(const l of g.lines){
      page.drawLine({
        start:{x:l.x1*PT, y:H-l.y1*PT}, end:{x:l.x2*PT, y:H-l.y2*PT},
        thickness:l.w, color:col, dashArray:l.dash?l.dash:undefined
      });
    }
    for(const d of g.dots){
      page.drawCircle({ x:d.x*PT, y:H-d.y*PT, size:d.r*PT, color:col });
    }
    if(hdrPng){
      page.drawImage(hdrPng,{
        x:hdr.xMm*PT, y:H-(hdr.topMm+hdr.hMm)*PT,
        width:hdr.wMm*PT, height:hdr.hMm*PT
      });
    }
  }
  return await doc.save();
}

function hexToRgb(hex){
  const m=hex.replace('#','');
  return { r:parseInt(m.substr(0,2),16)/255, g:parseInt(m.substr(2,2),16)/255, b:parseInt(m.substr(4,2),16)/255 };
}

async function downloadPDF(){
  const btn=$('btnPdf'); const t=btn.textContent; btn.textContent='生成中…'; btn.disabled=true;
  try{
    const bytes=await buildPDF();
    const blob=new Blob([bytes],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='ruled_paper.pdf'; a.click();
    URL.revokeObjectURL(url);
  }catch(e){ alert('PDF生成に失敗しました: '+e.message); }
  finally{ btn.textContent=t; btn.disabled=false; }
}

// ---------- ブラウザ印刷 ----------
function printPages(){
  const s=readState();
  const [w,h]=paperDims(s);
  let st=$('printStyle');
  if(!st){ st=document.createElement('style'); st.id='printStyle'; document.head.appendChild(st); }
  st.textContent=`@page{ size:${w}mm ${h}mm; margin:0; } .print-page{ width:${w}mm; height:${h}mm; overflow:hidden; }`;
  const svg=renderSVG(s,true);
  let html='';
  for(let i=0;i<s.pages;i++) html+=`<div class="print-page">${svg}</div>`;
  $('printArea').innerHTML=html;
  window.print();
}

// ---------- UI 配線 ----------
function bind(){
  document.querySelectorAll('.panel input, .panel select').forEach(el=>{
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });
  $('paper').addEventListener('change', ()=>{
    $('customWrap').style.display = $('paper').value==='custom' ? 'flex':'none';
  });
  document.querySelectorAll('#typeTabs button').forEach(b=>{
    b.addEventListener('click', ()=>{
      document.querySelectorAll('#typeTabs button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const t=b.dataset.type;
      document.querySelectorAll('.type-section').forEach(sec=>{
        sec.style.display = sec.dataset.for===t ? '' : 'none';
      });
      render();
    });
  });
  document.querySelectorAll('#spacingPresets button').forEach(b=>{
    b.addEventListener('click', ()=>{ $('spacing').value=b.dataset.v; markPreset(); render(); });
  });
  $('spacing').addEventListener('input', markPreset);
  $('btnPdf').addEventListener('click', downloadPDF);
  $('btnPrint').addEventListener('click', printPages);
  $('btnReset').addEventListener('click', resetDefaults);
  markPreset();
}

function markPreset(){
  const v=$('spacing').value;
  document.querySelectorAll('#spacingPresets button').forEach(b=>{
    b.classList.toggle('active', b.dataset.v===String(v));
  });
}

const DEFAULTS={ paper:'B5', orientation:'portrait', customW:182, customH:257, type:'ruled',
  spacing:7, endsSolid:true, ruledDash:true, thinW:0.6, thickW:0.9,
  cell:5, gridDash:false, gridW:0.6, dotGap:5, dotR:0.4, lineColor:'#B3CCE0',
  hLeft:'', hCenter:'', hRight:'No.　月　日', headerSize:11,
  marginTop:19, marginBottom:21, marginLeft:18, marginRight:18, pages:1 };

function resetDefaults(){
  const d=DEFAULTS;
  $('paper').value=d.paper; $('orientation').value=d.orientation;
  $('customW').value=d.customW; $('customH').value=d.customH; $('customWrap').style.display='none';
  $('spacing').value=d.spacing; $('endsSolid').checked=d.endsSolid; $('ruledDash').checked=d.ruledDash;
  $('thinW').value=d.thinW; $('thickW').value=d.thickW;
  $('cell').value=d.cell; $('gridDash').checked=d.gridDash; $('gridW').value=d.gridW;
  $('dotGap').value=d.dotGap; $('dotR').value=d.dotR; $('lineColor').value=d.lineColor;
  $('hLeft').value=d.hLeft; $('hCenter').value=d.hCenter; $('hRight').value=d.hRight; $('headerSize').value=d.headerSize;
  $('marginTop').value=d.marginTop; $('marginBottom').value=d.marginBottom;
  $('marginLeft').value=d.marginLeft; $('marginRight').value=d.marginRight; $('pages').value=d.pages;
  document.querySelectorAll('#typeTabs button').forEach(x=>x.classList.toggle('active', x.dataset.type==='ruled'));
  document.querySelectorAll('.type-section').forEach(sec=>sec.style.display = sec.dataset.for==='ruled' ? '' : 'none');
  markPreset(); render();
}

bind();
render();
