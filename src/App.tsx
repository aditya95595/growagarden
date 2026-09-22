import React,{useEffect,useMemo,useRef,useState}from"react";
import{Canvas}from"@react-three/fiber";
import{OrbitControls,ContactShadows}from"@react-three/drei";
import*as THREE from"three";
import{House,PanelsTopLeft,Undo2,Redo2,Upload,Download,Paintbrush,Eraser,PaintBucket,Pipette,Square,Circle,Type,Grid3X3,Eye,EyeOff,Plus,Trash2,ZoomIn,ZoomOut,Maximize2,Save,Copy,Trash,RotateCcw,Move,Palette,Layers3,Image as ImageIcon,SlidersHorizontal,MousePointer2,RefreshCw,FlipHorizontal2,AlignCenter,Lock,Unlock,SunMedium,Box,FileDown,FileUp,ChevronDown,Check, Sparkles}from"lucide-react";

type Kind="shirt"|"pants"|"tshirt";
type Tool="select"|"brush"|"eraser"|"fill"|"picker"|"rect"|"circle"|"text";
type Blend="source-over"|"multiply"|"screen"|"overlay";
type Layer={id:number,name:string,visible:boolean,locked:boolean,opacity:number,canvas:HTMLCanvasElement,x:number,y:number,scale:number,rotation:number,flipX:boolean,blend:Blend};

type FaceRect={x:number,y:number,w:number,h:number};
const SIZES:Record<Kind,[number,number]>={shirt:[585,559],pants:[585,559],tshirt:[512,512]};
const COLORS=["#111827","#1f2937","#374151","#6b7280","#9ca3af","#d1d5db","#f9fafb","#7f1d1d","#b91c1c","#ef4444","#f97316","#f59e0b","#eab308","#166534","#16a34a","#22c55e","#0f766e","#0891b2","#2563eb","#4f46e5","#7c3aed","#9333ea","#db2777","#ec4899"];

const TORSO={top:{x:231,y:8,w:128,h:64},right:{x:165,y:74,w:64,h:128},front:{x:231,y:74,w:128,h:128},left:{x:361,y:74,w:64,h:128},back:{x:427,y:74,w:128,h:128},bottom:{x:231,y:202,w:128,h:64}};
const LIMB_R={left:{x:19,y:355,w:64,h:128},back:{x:85,y:355,w:64,h:128},right:{x:151,y:355,w:64,h:128},front:{x:217,y:355,w:64,h:128},top:{x:217,y:289,w:64,h:64},bottom:{x:217,y:485,w:64,h:64}};
const LIMB_L={front:{x:308,y:355,w:64,h:128},left:{x:374,y:355,w:64,h:128},back:{x:440,y:355,w:64,h:128},right:{x:506,y:355,w:64,h:128},top:{x:308,y:289,w:64,h:64},bottom:{x:308,y:485,w:64,h:64}};

const makeCanvas=(w:number,h:number)=>{const c=document.createElement("canvas");c.width=w;c.height=h;return c};
const cloneCanvas=(src:HTMLCanvasElement)=>{const c=makeCanvas(src.width,src.height);c.getContext("2d")!.drawImage(src,0,0);return c};
const cloneLayers=(ls:Layer[])=>ls.map(l=>({...l,canvas:cloneCanvas(l.canvas)}));
const hexRgb=(hex:string)=>{const s=hex.replace("#","");const n=parseInt(s.length===3?s.split("").map(v=>v+v).join(""):s,16);return[(n>>16)&255,(n>>8)&255,n&255,255]};
const pxColor=(d:Uint8ClampedArray)=>"#"+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,"0")).join("");

function checker(ctx:CanvasRenderingContext2D,w:number,h:number){
 for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=16){ctx.fillStyle=(x/16+y/16)%2?"#22262f":"#171b22";ctx.fillRect(x,y,16,16)}
}
function guideRects(k:Kind){
 if(k==="tshirt")return[{x:0,y:0,w:512,h:512,n:"T-SHIRT • FRONT"}];
 return[
  {x:231,y:8,w:128,h:64,n:"UP"},{x:165,y:74,w:64,h:128,n:"R"},{x:231,y:74,w:128,h:128,n:"FRONT"},{x:361,y:74,w:64,h:128,n:"L"},{x:427,y:74,w:128,h:128,n:"BACK"},{x:231,y:202,w:128,h:64,n:"DOWN"},
  {x:19,y:355,w:64,h:128,n:"L"},{x:85,y:355,w:64,h:128,n:"B"},{x:151,y:355,w:64,h:128,n:"R"},{x:217,y:355,w:64,h:128,n:"F"},{x:217,y:289,w:64,h:64,n:"U"},{x:217,y:485,w:64,h:64,n:"D"},
  {x:308,y:355,w:64,h:128,n:"F"},{x:374,y:355,w:64,h:128,n:"L"},{x:440,y:355,w:64,h:128,n:"B"},{x:506,y:355,w:64,h:128,n:"R"},{x:308,y:289,w:64,h:64,n:"U"},{x:308,y:485,w:64,h:64,n:"D"}
 ];
}
function drawGuides(ctx:CanvasRenderingContext2D,k:Kind,on:boolean,selected?:string){
 if(!on)return;
 ctx.save();ctx.setLineDash([5,5]);ctx.lineWidth=1.5;ctx.font="700 9px Inter,Arial";ctx.fillStyle="#d9d3ff";ctx.strokeStyle="#a599ff88";
 guideRects(k).forEach(r=>{ctx.strokeStyle=selected===r.n?"#ff6b2c":"#a599ff88";ctx.lineWidth=selected===r.n?2:1.5;ctx.strokeRect(r.x+.5,r.y+.5,r.w-1,r.h-1);ctx.fillText(r.n,r.x+4,r.y+12)});
 ctx.restore();
}
function flood(c:HTMLCanvasElement,x:number,y:number,color:string){
 const ctx=c.getContext("2d")!,w=c.width,h=c.height,px=x|0,py=y|0;if(px<0||py<0||px>=w||py>=h)return;
 const img=ctx.getImageData(0,0,w,h),d=img.data,start=(py*w+px)*4,target=[d[start],d[start+1],d[start+2],d[start+3]],to=hexRgb(color);
 if(target.every((v,i)=>v===to[i]))return;
 const q:[[number,number]]|Array<[number,number]>=[[px,py]],seen=new Uint8Array(w*h);
 while(q.length){const[a,b]=q.pop()!,n=b*w+a,i=n*4;if(a<0||b<0||a>=w||b>=h||seen[n]||d[i]!==target[0]||d[i+1]!==target[1]||d[i+2]!==target[2]||d[i+3]!==target[3])continue;seen[n]=1;d[i]=to[0];d[i+1]=to[1];d[i+2]=to[2];d[i+3]=to[3];q.push([a+1,b],[a-1,b],[a,b+1],[a,b-1])}
 ctx.putImageData(img,0,0)
}
function removeBackground(c:HTMLCanvasElement){
 const ctx=c.getContext("2d")!,img=ctx.getImageData(0,0,c.width,c.height),d=img.data;
 for(let i=0;i<d.length;i+=4){if(d[i]>235&&d[i+1]>235&&d[i+2]>235)d[i+3]=0}
 ctx.putImageData(img,0,0)
}
function drawLayer(ctx:CanvasRenderingContext2D,l:Layer,cx:number,cy:number){
 if(!l.visible||l.opacity<=0)return;
 ctx.save();ctx.globalAlpha=l.opacity;ctx.globalCompositeOperation=l.blend;ctx.translate(cx+l.x,cy+l.y);ctx.rotate(l.rotation*Math.PI/180);ctx.scale(l.scale*(l.flipX?-1:1),l.scale);ctx.drawImage(l.canvas,-l.canvas.width/2,-l.canvas.height/2);ctx.restore();
}
function compose(ls:Layer[],w:number,h:number){const c=makeCanvas(w,h),ctx=c.getContext("2d")!;ls.forEach(l=>drawLayer(ctx,l,w/2,h/2));return c}
function textCanvas(value:string,font:string,size:number,color:string,bold:boolean){
 const c=makeCanvas(Math.max(80,value.length*size+30),Math.max(80,size*1.6)),ctx=c.getContext("2d")!;ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle=color;ctx.font=(bold?"700 ":"400 ")+size+"px "+font;ctx.textBaseline="middle";ctx.fillText(value,15,c.height/2);return c;
}
function patternCanvas(type:"stripes"|"checker"|"gradient",w:number,h:number,a:string,b:string){
 const c=makeCanvas(w,h),ctx=c.getContext("2d")!;
 if(type==="gradient"){const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,a);g.addColorStop(1,b);ctx.fillStyle=g;ctx.fillRect(0,0,w,h)}
 else if(type==="checker"){const s=32;for(let y=0;y<h;y+=s)for(let x=0;x<w;x+=s){ctx.fillStyle=((x/s+y/s)%2)?a:b;ctx.fillRect(x,y,s,s)}}
 else {ctx.fillStyle=b;ctx.fillRect(0,0,w,h);ctx.strokeStyle=a;ctx.lineWidth=18;for(let x=-h;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+h,h);ctx.stroke()}}
 return c;
}

function FaceMaterial({source,rect,flip=false}:{source:HTMLCanvasElement,rect:FaceRect,flip?:boolean}){
 const tex=useMemo(()=>{const c=makeCanvas(rect.w,rect.h),x=c.getContext("2d")!;x.save();if(flip){x.translate(rect.w,0);x.scale(-1,1)}x.drawImage(source,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);x.restore();const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearFilter;return t},[source,rect.x,rect.y,rect.w,rect.h,flip]);
 useEffect(()=>()=>tex.dispose(),[tex]);
 return <meshStandardMaterial map={tex} color="white" transparent alphaTest={.02} roughness={.82}/>;
}
function Skin(){return <meshStandardMaterial color="#d9b08a" roughness={.9}/>}

function R6Avatar({kind,source,body}:{kind:Kind,source:HTMLCanvasElement,body:"blocky"|"boy"|"girl"}){
 const shirt=kind==="shirt",pants=kind==="pants",tee=kind==="tshirt";
 const preset=body==="girl"?{torso:[2.02,2,1],arm:[.9,2,1],leg:[.95,2.05,1],head:[1.95,1,1]}:body==="boy"?{torso:[2.12,2.08,1],arm:[1,2.1,1],leg:[1.02,2.1,1],head:[2.02,1.02,1]}:{torso:[2.02,2.02,1.02],arm:[1.02,2.02,1.02],leg:[1.02,2.02,1.02],head:[2,1,1]};
 return <group position={[0,-2.7,0]} scale={1.48}>
   <mesh position={[0,5.25,0]} castShadow><boxGeometry args={preset.head}/><Skin/></mesh>
   <mesh position={[0,3.25,0]} castShadow><boxGeometry args={preset.torso}/>{tee?
     [<Skin key="0"/>,<Skin key="1"/>,<Skin key="2"/>,<Skin key="3"/>,<FaceMaterial key="4" source={source} rect={{x:0,y:0,w:source.width,h:source.height}}/>,<Skin key="5"/>]:
     [<FaceMaterial key="0" source={source} rect={TORSO.right}/>,<FaceMaterial key="1" source={source} rect={TORSO.left}/>,<FaceMaterial key="2" source={source} rect={TORSO.top}/>,<FaceMaterial key="3" source={source} rect={TORSO.bottom}/>,<FaceMaterial key="4" source={source} rect={TORSO.front}/>,<FaceMaterial key="5" source={source} rect={TORSO.back}/>]
   }</mesh>
   <mesh position={[-1.5,3.25,0]} castShadow><boxGeometry args={preset.arm}/>{shirt?
    [<FaceMaterial key="0" source={source} rect={LIMB_L.right}/>,<FaceMaterial key="1" source={source} rect={LIMB_L.left}/>,<FaceMaterial key="2" source={source} rect={LIMB_L.top}/>,<FaceMaterial key="3" source={source} rect={LIMB_L.bottom}/>,<FaceMaterial key="4" source={source} rect={LIMB_L.front}/>,<FaceMaterial key="5" source={source} rect={LIMB_L.back}/>]:<Skin/>}</mesh>
   <mesh position={[1.5,3.25,0]} castShadow><boxGeometry args={preset.arm}/>{shirt?
    [<FaceMaterial key="0" source={source} rect={LIMB_R.right}/>,<FaceMaterial key="1" source={source} rect={LIMB_R.left}/>,<FaceMaterial key="2" source={source} rect={LIMB_R.top}/>,<FaceMaterial key="3" source={source} rect={LIMB_R.bottom}/>,<FaceMaterial key="4" source={source} rect={LIMB_R.front}/>,<FaceMaterial key="5" source={source} rect={LIMB_R.back}/>]:<Skin/>}</mesh>
   <mesh position={[-.51,1.05,0]} castShadow><boxGeometry args={preset.leg}/>{pants?
    [<FaceMaterial key="0" source={source} rect={LIMB_L.right}/>,<FaceMaterial key="1" source={source} rect={LIMB_L.left}/>,<FaceMaterial key="2" source={source} rect={LIMB_L.top}/>,<FaceMaterial key="3" source={source} rect={LIMB_L.bottom}/>,<FaceMaterial key="4" source={source} rect={LIMB_L.front}/>,<FaceMaterial key="5" source={source} rect={LIMB_L.back}/>]:<Skin/>}</mesh>
   <mesh position={[.51,1.05,0]} castShadow><boxGeometry args={preset.leg}/>{pants?
    [<FaceMaterial key="0" source={source} rect={LIMB_R.right}/>,<FaceMaterial key="1" source={source} rect={LIMB_R.left}/>,<FaceMaterial key="2" source={source} rect={LIMB_R.top}/>,<FaceMaterial key="3" source={source} rect={LIMB_R.bottom}/>,<FaceMaterial key="4" source={source} rect={LIMB_R.front}/>,<FaceMaterial key="5" source={source} rect={LIMB_R.back}/>]:<Skin/>}</mesh>
 </group>;
}

export default function App(){
 const[kind,setKind]=useState<Kind>("shirt"),[tool,setTool]=useState<Tool>("select"),[color,setColor]=useState("#ff641f"),[brush,setBrush]=useState(18),[showGrid,setShowGrid]=useState(true),[showGuides,setShowGuides]=useState(true),[zoom,setZoom]=useState(1),
 [layers,setLayers]=useState<Layer[]>([]),[selected,setSelected]=useState(1),[body,setBody]=useState<"blocky"|"boy"|"girl">("blocky"),[homeOpen,setHomeOpen]=useState(false),[nextId,setNextId]=useState(1),[history,setHistory]=useState<Layer[][]>([]),[future,setFuture]=useState<Layer[][]>([]),
 [tab,setTab]=useState<"insert"|"layers">("insert"),[inspectorTab,setInspectorTab]=useState<"edit"|"view">("edit"),[viewMode,setViewMode]=useState<"split"|"3d"|"2d">("split"),[panel,setPanel]=useState<"design"|"assets">("design"),
 [saved,setSaved]=useState(true),[ground,setGround]=useState(true),[light,setLight]=useState(1.35),[bg,setBg]=useState("#11141b"),[textValue,setTextValue]=useState("YOUR TEXT"),[font,setFont]=useState("Inter"),[fontSize,setFontSize]=useState(48),[bold,setBold]=useState(true),[pattern,setPattern]=useState<"stripes"|"checker"|"gradient">("stripes");
 const[w,h]=SIZES[kind],editor=useRef<HTMLCanvasElement>(null),file=useRef<HTMLInputElement>(null),projectFile=useRef<HTMLInputElement>(null),dragging=useRef(false),last=useRef<{x:number,y:number}|null>(null);
 const active=layers.find(l=>l.id===selected);
 useEffect(()=>{const c=makeCanvas(w,h);setLayers([{id:1,name:"Artwork",visible:true,locked:false,opacity:1,canvas:c,x:0,y:0,scale:1,rotation:0,flipX:false,blend:"source-over"}]);setSelected(1);setNextId(1);setHistory([]);setFuture([]);setSaved(true)},[kind]);
 const composite=useMemo(()=>compose(layers,w,h),[layers,w,h]);

 useEffect(()=>{const c=editor.current;if(!c)return;const ctx=c.getContext("2d")!,render=()=>{const r=c.getBoundingClientRect(),s=Math.min((r.width-28)/w,(r.height-28)/h)*zoom,ox=(r.width-w*s)/2,oy=(r.height-h*s)/2;c.width=Math.max(1,Math.floor(r.width*devicePixelRatio));c.height=Math.max(1,Math.floor(r.height*devicePixelRatio));ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.clearRect(0,0,r.width,r.height);checker(ctx,r.width,r.height);ctx.save();ctx.translate(ox,oy);ctx.scale(s,s);ctx.imageSmoothingEnabled=false;ctx.drawImage(composite,0,0);drawGuides(ctx,kind,showGuides);ctx.restore()};render();window.addEventListener("resize",render);return()=>window.removeEventListener("resize",render)},[composite,kind,showGuides,zoom,w,h]);

 const snapshot=()=>{setHistory(hh=>[...hh.slice(-23),cloneLayers(layers)]);setFuture([]);setSaved(false)};
 const mutate=(fn:(l:Layer)=>void)=>{if(!active||active.locked)return;setLayers(ls=>ls.map(l=>l.id===active.id?(fn(l),l):l));setSaved(false)};
 const point=(e:React.PointerEvent)=>{const c=editor.current!,r=c.getBoundingClientRect(),s=Math.min((r.width-28)/w,(r.height-28)/h)*zoom;return{x:(e.clientX-r.left-(r.width-w*s)/2)/s,y:(e.clientY-r.top-(r.height-h*s)/2)/s}};
 const paint=(e:React.PointerEvent)=>{if(!active||active.locked||!dragging.current)return;const p=point(e);if(p.x<0||p.y<0||p.x>=w||p.y>=h)return;const ctx=active.canvas.getContext("2d")!;
  if(tool==="select"){const dx=p.x-(last.current?.x??p.x),dy=p.y-(last.current?.y??p.y);mutate(l=>{l.x+=dx;l.y+=dy});last.current=p;return}
  if(tool==="picker"){const d=ctx.getImageData(p.x|0,p.y|0,1,1).data;setColor(pxColor(d));setTool("brush");return}
  ctx.globalCompositeOperation=tool==="eraser"?"destination-out":"source-over";ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=brush;ctx.lineCap="round";
  if(tool==="brush"||tool==="eraser"){ctx.beginPath();ctx.arc(p.x,p.y,brush/2,0,Math.PI*2);ctx.fill()}
  else if(tool==="fill")flood(active.canvas,p.x,p.y,color)
  else if(tool==="rect")ctx.fillRect(p.x-brush,p.y-brush,brush*2,brush*2)
  else if(tool==="circle"){ctx.beginPath();ctx.arc(p.x,p.y,brush,0,Math.PI*2);ctx.fill()}
  setLayers(ls=>[...ls]);setSaved(false)
 };
 const down=(e:React.PointerEvent)=>{if(active?.locked)return;dragging.current=true;last.current=point(e);snapshot();paint(e)};const up=()=>{dragging.current=false;last.current=null};

 const addLayer=(name="Layer",canvas?:HTMLCanvasElement)=>{snapshot();const id=nextId+1;setNextId(id);setLayers(ls=>[...ls,{id,name:name+" "+id,visible:true,locked:false,opacity:1,canvas:canvas||makeCanvas(w,h),x:0,y:0,scale:1,rotation:0,flipX:false,blend:"source-over"}]);setSelected(id)};
 const duplicate=()=>{if(!active)return;snapshot();const id=nextId+1;setNextId(id);setLayers(ls=>[...ls,{...active,id,name:active.name+" copy",canvas:cloneCanvas(active.canvas),x:active.x+12,y:active.y+12}]);setSelected(id)};
 const remove=()=>{if(!active)return;snapshot();if(layers.length===1){active.canvas.getContext("2d")!.clearRect(0,0,w,h);setLayers([...layers]);setSaved(false);return}const ls=layers.filter(l=>l.id!==active.id);setLayers(ls);setSelected(ls[0].id)};
 const undo=()=>{if(!history.length)return;setFuture(f=>[cloneLayers(layers),...f]);setLayers(cloneLayers(history.at(-1)!));setHistory(history.slice(0,-1));setSaved(false)};
 const redo=()=>{if(!future.length)return;setHistory(h=>[...h,cloneLayers(layers)]);setLayers(cloneLayers(future[0]));setFuture(future.slice(1));setSaved(false)};
 const reset=()=>{const c=makeCanvas(w,h);setLayers([{id:1,name:"Artwork",visible:true,locked:false,opacity:1,canvas:c,x:0,y:0,scale:1,rotation:0,flipX:false,blend:"source-over"}]);setSelected(1);setNextId(1);setHistory([]);setFuture([]);setSaved(false)};
 const importImage=(f:File)=>{const im=new Image();im.onload=()=>{const c=makeCanvas(w,h),ctx=c.getContext("2d")!,s=Math.min(w/im.width,h/im.height)*.82;ctx.drawImage(im,(w-im.width*s)/2,(h-im.height*s)/2,im.width*s,im.height*s);addLayer(f.name.replace(/\.[^.]+$/,""),c)};im.src=URL.createObjectURL(f)};
 const addText=()=>{const c=textCanvas(textValue,font,fontSize,color,bold);addLayer("Text",c);setTool("select")};
 const addPattern=()=>{const c=patternCanvas(pattern,w,h,color,"#151921");addLayer("Pattern",c)};
 const removeBg=()=>{if(!active)return;snapshot();removeBackground(active.canvas);setLayers([...layers]);setSaved(false)};
 const flip=()=>mutate(l=>l.flipX=!l.flipX);
 const alignCenter=()=>mutate(l=>{l.x=0;l.y=0});
 const projectData=()=>({version:3,kind,layers:layers.map(l=>({id:l.id,name:l.name,visible:l.visible,locked:l.locked,opacity:l.opacity,x:l.x,y:l.y,scale:l.scale,rotation:l.rotation,flipX:l.flipX,blend:l.blend,image:l.canvas.toDataURL("image/png")}))});
 const saveProject=()=>{const data=projectData();localStorage.setItem("rbxwear-project",JSON.stringify(data));const a=document.createElement("a");a.href="data:application/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(data));a.download="rbxwear-project.json";a.click();setSaved(true)};
 const restoreAutosave=()=>{const raw=localStorage.getItem("rbxwear-project");if(!raw)return false;try{const d=JSON.parse(raw);if(d.kind&&Array.isArray(d.layers)){setKind(d.kind);return true}}catch{}return false};
 const loadProject=(f:File)=>{const reader=new FileReader();reader.onload=()=>{try{const d=JSON.parse(String(reader.result)),target=(d.kind&&SIZES[d.kind as Kind])?d.kind as Kind:kind,[pw,ph]=SIZES[target],arr:Layer[]=[];setKind(target);Promise.all((d.layers||[]).map((x:any)=>new Promise<void>(res=>{const im=new Image();im.onload=()=>{const c=makeCanvas(pw,ph);c.getContext("2d")!.drawImage(im,0,0);arr.push({...x,canvas:c,flipX:!!x.flipX,blend:x.blend||"source-over"});res()};im.onerror=()=>res();im.src=x.image}))).then(()=>{if(arr.length){setLayers(arr);setSelected(arr[0].id);setNextId(Math.max(...arr.map(x=>x.id)));setHistory([]);setFuture([]);setSaved(true)}})}catch{alert("That project file is not valid.")}};reader.readAsText(f)};
 const exportPng=()=>{const a=document.createElement("a");a.href=composite.toDataURL("image/png");a.download="rbxwear-"+kind+"-"+w+"x"+h+".png";a.click()};
 const downloadTemplate=()=>{const c=makeCanvas(w,h),x=c.getContext("2d")!;x.clearRect(0,0,w,h);drawGuides(x,kind,true);const a=document.createElement("a");a.href=c.toDataURL("image/png");a.download="rbxwear-template-"+w+"x"+h+".png";a.click()};

 return <div className="app">
  <header className="topbar">
   <div className="brand"><span className="brandmark"><Sparkles size={15}/></span><b>RbxWear</b><small>STUDIO</small></div>
   <div className="crumb"><span>Projects</span><span>/</span><b>Untitled design</b><i title={saved?"Saved locally":"Unsaved changes"} className={saved?"saved":""}/></div>
   <div className="topactions"><button title="Save project" onClick={saveProject}><FileDown size={15}/></button><button title="Undo" onClick={undo} disabled={!history.length}><Undo2 size={16}/></button><button title="Redo" onClick={redo} disabled={!future.length}><Redo2 size={16}/></button><button className="save" onClick={saveProject}><Save size={14}/>Save</button><button className="export" onClick={exportPng}><Download size={14}/>Export</button></div>
  </header>

  <div className="workspace">
   <aside className="leftbar">
    <div className="lefthead"><button className="homebtn" title="Project home" onClick={()=>setHomeOpen(true)}><House size={17}/></button><span>POL</span><button className="homebtn" title="Toggle 2D editor" onClick={()=>setViewMode(viewMode==="2d"?"split":"2d")}><PanelsTopLeft size={17}/></button></div>
    <div className="rail">
      <button className={panel==="design"?"active":""} onClick={()=>setPanel("design")}><Palette size={18}/><span>Design</span></button>
      <button className={panel==="assets"?"active":""} onClick={()=>setPanel("assets")}><ImageIcon size={18}/><span>Assets</span></button>
      <button onClick={()=>setTab("layers")} className={tab==="layers"?"active":""}><Layers3 size={18}/><span>Layers</span></button>
      <button onClick={()=>setTab("insert")} className={tab==="insert"?"active":""}><SlidersHorizontal size={18}/><span>Tools</span></button>
    </div>
    <div className="leftpanel">
      {tab==="layers"?<div className="layerspanel"><div className="paneltitle">LAYERS <span>{layers.length}</span></div>{[...layers].reverse().map(l=><button className={"layerrow "+(selected===l.id?"selected":"")} key={l.id} onClick={()=>setSelected(l.id)}><span className="thumb" style={{backgroundImage:"url("+l.canvas.toDataURL()+")"}}/><span>{l.name}</span><i onClick={e=>{e.stopPropagation();l.visible=!l.visible;setLayers([...layers]);setSaved(false)}}>{l.visible?<Eye size={14}/>:<EyeOff size={14}/>}</i></button>)}</div>:
      panel==="assets"?<div className="assetspanel"><div className="paneltitle">ASSETS</div><button className="assetcard" onClick={()=>file.current?.click()}><Upload size={18}/><div><b>Import design</b><span>PNG · JPG · WEBP</span></div></button><div className="miniassets"><button onClick={()=>{setPattern("stripes");addPattern()}}><div className="patternicon stripes"/><span>Stripes</span></button><button onClick={()=>{setPattern("checker");addPattern()}}><div className="patternicon checker"/><span>Checker</span></button><button onClick={()=>{setPattern("gradient");addPattern()}}><div className="patternicon gradient"/><span>Gradient</span></button></div><input hidden ref={file} type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&importImage(e.target.files[0])}/></div>:
      <div className="designpanel">
       <div className="paneltitle">CREATE</div>
       <div className="quickgrid">
        <button onClick={()=>setTool("select")}><MousePointer2/><span>Select</span></button><button onClick={()=>setTool("brush")}><Paintbrush/><span>Draw</span></button><button onClick={()=>setTool("eraser")}><Eraser/><span>Eraser</span></button><button onClick={()=>setTool("fill")}><PaintBucket/><span>Fill</span></button><button onClick={()=>setTool("picker")}><Pipette/><span>Picker</span></button><button onClick={()=>setTool("rect")}><Square/><span>Shape</span></button><button onClick={()=>setTool("circle")}><Circle/><span>Circle</span></button><button onClick={addText}><Type/><span>Text</span></button>
       </div>
       <div className="paneltitle">MEDIA</div>
       <button className="wide" onClick={()=>file.current?.click()}><Upload size={15}/>Import image</button>
       <button className="wide" onClick={downloadTemplate}><Download size={15}/>Template guide</button>
       <input hidden ref={file} type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&importImage(e.target.files[0])}/>
       <div className="paneltitle">COLOR</div>
       <div className="colorrow"><input type="color" value={color} onChange={e=>setColor(e.target.value)}/><code>{color}</code></div>
       <div className="palette">{COLORS.map(c=><button key={c} style={{background:c}} onClick={()=>setColor(c)}/>)}</div>
       <div className="sliderline"><span>Brush size</span><b>{brush}px</b></div><input className="range" type="range" min="2" max="100" value={brush} onChange={e=>setBrush(+e.target.value)}/>
       <div className="subcard"><div className="sliderline"><span>Text</span><button className={bold?"tiny active":"tiny"} onClick={()=>setBold(!bold)}>B</button></div><input value={textValue} onChange={e=>setTextValue(e.target.value)} placeholder="Add text"/><div className="twocol"><select value={font} onChange={e=>setFont(e.target.value)}><option>Inter</option><option>Arial</option><option>Georgia</option><option>Courier New</option></select><input type="number" min="12" max="180" value={fontSize} onChange={e=>setFontSize(+e.target.value)}/></div><button className="wide accentwide" onClick={addText}>Add text layer</button></div>
      </div>}
    </div>
    <div className="leftbottom"><button onClick={()=>addLayer("Layer")}><Plus size={14}/>New layer</button><button onClick={remove} disabled={layers.length<=1}><Trash2 size={14}/>Delete</button></div>
   </aside>

   <main className="stage">
    <div className="stagehead"><div><h1>{kind==="shirt"?"Classic Shirt":kind==="pants"?"Classic Pants":"Classic T-Shirt"}</h1><p>R6 Block Avatar · live classic-clothing test workspace</p></div><div className="kindtabs">{(["shirt","pants","tshirt"] as Kind[]).map(k=><button key={k} className={kind===k?"active":""} onClick={()=>setKind(k)}>{k==="shirt"?"Shirt":k==="pants"?"Pants":"T-Shirt"}</button>)}</div></div>
    <div className="viewport">
      <Canvas shadows dpr={[1,2]} camera={{position:[6.5,3.2,8.5],fov:40}}>
       <color attach="background" args={[bg]}/><ambientLight intensity={light}/><directionalLight position={[5,9,6]} intensity={2.25} castShadow/><directionalLight position={[-4,3,-2]} intensity={.65}/>
       <R6Avatar kind={kind} source={composite} body={body}/>
       {ground&&<><mesh rotation={[-Math.PI/2,0,0]} position={[0,-3.2,0]} receiveShadow><planeGeometry args={[18,18]}/><meshStandardMaterial color="#0a0d12" roughness={1}/></mesh><ContactShadows position={[0,-3.18,0]} opacity={.42} scale={11} blur={2.4}/></>}
       <OrbitControls enablePan={false} minDistance={5.5} maxDistance={14}/>
      </Canvas>
      <div className="rigbadge"><span/>R6 BLOCK <small>6-PART TEST RIG</small></div>
      <div className="viewhint">Drag to rotate · wheel to zoom</div>
      <div className="viewmodes"><button className={viewMode==="3d"?"active":""} onClick={()=>setViewMode("3d")}>3D</button><button className={viewMode==="split"?"active":""} onClick={()=>setViewMode("split")}>Split</button><button className={viewMode==="2d"?"active":""} onClick={()=>setViewMode("2d")}>2D</button></div>
      {viewMode!=="3d"&&<div className={"dock "+(viewMode==="2d"?"docked2d":"")}><div className="dockhead"><div><b>2D texture editor</b><span>{w} × {h} px · guides excluded from export</span></div><div><button onClick={()=>setZoom(Math.max(.5,zoom-.1))}><ZoomOut size={14}/></button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(Math.min(3,zoom+.1))}><ZoomIn size={14}/></button><button onClick={()=>setViewMode("3d")}><Maximize2 size={14}/></button></div></div><div className="dockcanvas"><canvas ref={editor} onPointerDown={down} onPointerMove={paint} onPointerUp={up} onPointerLeave={up}/><div className="canvasbadge">{kind==="tshirt"?"T-SHIRT":"585 × 559"} <span>LIVE</span></div></div></div>}
    </div>
    <div className="stagefooter"><div className="bodytabs"><span className="label">TEST AVATAR</span><button className={body==="blocky"?"bodyactive":""} onClick={()=>setBody("blocky")}><span className="avataricon">▦</span>Blocky <small>R6</small></button><button className={body==="boy"?"bodyactive":""} onClick={()=>setBody("boy")}>Boy <small>R6</small></button><button className={body==="girl"?"bodyactive":""} onClick={()=>setBody("girl")}>Girl <small>R6</small></button></div><div className="stagecontrols"><button className={showGrid?"active":""} onClick={()=>setShowGrid(!showGrid)}><Grid3X3 size={14}/></button><button className={showGuides?"active":""} onClick={()=>setShowGuides(!showGuides)}><Eye size={14}/></button></div></div>
   </main>

   <aside className="inspector">
    <div className="inspecthead"><div><b>{active?.name||"Artwork"}</b><small>{kind==="shirt"?"Classic Shirt":kind==="pants"?"Classic Pants":"Classic T-Shirt"} · {w} × {h}</small></div><button onClick={reset}><RotateCcw size={14}/></button></div>
    <div className="inspecttabs"><button className={inspectorTab==="edit"?"active":""} onClick={()=>setInspectorTab("edit")}>Edit</button><button className={inspectorTab==="view"?"active":""} onClick={()=>setInspectorTab("view")}>Preview</button></div>
    {inspectorTab==="edit"?<div className="inspectorbody">
      <div className="section"><div className="sectionhead"><span>Selected layer</span><div><button onClick={duplicate} title="Duplicate"><Copy size={14}/></button><button onClick={()=>active&&mutate(l=>l.locked=!l.locked)}>{active?.locked?<Lock size={14}/>:<Unlock size={14}/>}</button></div></div></div>
      <div className="section"><div className="sliderline"><span>Opacity</span><b>{Math.round((active?.opacity??1)*100)}%</b></div><input className="range" type="range" min="0" max="1" step=".01" value={active?.opacity??1} onChange={e=>mutate(l=>l.opacity=+e.target.value)}/></div>
      <div className="actiongrid"><button onClick={removeBg}><ImageIcon size={15}/>Remove background</button><button onClick={duplicate}><Copy size={15}/>Duplicate</button></div>
      <div className="section"><div className="sectionhead"><span>Transform</span><Move size={13}/></div><div className="transformgrid"><label>X<input type="number" value={Math.round(active?.x??0)} onChange={e=>mutate(l=>l.x=+e.target.value)}/></label><label>Y<input type="number" value={Math.round(active?.y??0)} onChange={e=>mutate(l=>l.y=+e.target.value)}/></label><label>Scale<input type="number" min=".1" max="5" step=".05" value={active?.scale??1} onChange={e=>mutate(l=>l.scale=+e.target.value)}/></label><label>Rotate<input type="number" value={Math.round(active?.rotation??0)} onChange={e=>mutate(l=>l.rotation=+e.target.value)}/></label></div></div>
      <div className="actiongrid three"><button onClick={flip}><FlipHorizontal2 size={14}/>Flip</button><button onClick={alignCenter}><AlignCenter size={14}/>Center</button><button onClick={remove}><Trash2 size={14}/>Delete</button></div>
      <div className="section"><div className="sectionhead"><span>Blend</span><ChevronDown size={13}/></div><select className="fullinput" value={active?.blend??"source-over"} onChange={e=>mutate(l=>l.blend=e.target.value as Blend)}><option value="source-over">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option></select></div>
      <div className="section"><div className="sectionhead"><span>Quick color</span><Palette size={13}/></div><div className="palette inspectorpalette">{COLORS.slice(0,16).map(c=><button key={c} style={{background:c}} onClick={()=>{setColor(c);setTool("brush")}}/>)}</div></div>
    </div>:<div className="inspectorbody">
      <div className="previewcard"><div className="previewcardhead"><span>R6 Block Avatar</span><Check size={15}/></div><p>Classic clothing is tested live on a six-part block rig.</p><div className="stat"><span>Rig</span><b>R6 Blocky</b></div><div className="stat"><span>Asset</span><b>{kind==="shirt"?"Shirt":kind==="pants"?"Pants":"T-Shirt"}</b></div><div className="stat"><span>Canvas</span><b>{w} × {h}</b></div></div>
      <div className="section"><div className="sliderline"><span>Scene lighting</span><b>{light.toFixed(1)}</b></div><input className="range" type="range" min=".5" max="2.2" step=".05" value={light} onChange={e=>setLight(+e.target.value)}/></div>
      <div className="section"><div className="sliderline"><span>Viewport background</span></div><div className="colorrow"><input type="color" value={bg} onChange={e=>setBg(e.target.value)}/><code>{bg}</code></div></div>
      <button className={"toggle "+(ground?"on":"")} onClick={()=>setGround(!ground)}><span/>Ground plane</button>
      <button className={"toggle "+(showGrid?"on":"")} onClick={()=>setShowGrid(!showGrid)}><span/>2D grid</button>
      <button className={"toggle "+(showGuides?"on":"")} onClick={()=>setShowGuides(!showGuides)}><span/>Template guides</button>
      <div className="formatcard"><Check size={15}/><div><b>Roblox classic format</b><span>Export remains native {w} × {h}px · PNG</span></div></div>
    </div>}
    <div className="inspectbottom"><span>{saved?"All changes saved locally":"Unsaved changes"}</span><div><button onClick={()=>projectFile.current?.click()}><FileUp size={13}/>Open</button><input hidden ref={projectFile} type="file" accept=".json,application/json" onChange={e=>e.target.files?.[0]&&loadProject(e.target.files[0])}/><button onClick={saveProject}><FileDown size={13}/>Project</button></div></div>
   </aside>
  </div>
  {homeOpen&&<div className="modalbackdrop" onMouseDown={()=>setHomeOpen(false)}><div className="homemodal" onMouseDown={e=>e.stopPropagation()}><div className="modalhead"><div><b>Project Home</b><span>RbxWear Studio</span></div><button title="Close" onClick={()=>setHomeOpen(false)}>×</button></div><div className="homegrid"><button onClick={()=>{reset();setHomeOpen(false)}}><Plus size={18}/><b>New design</b><span>Blank transparent clothing canvas</span></button><button onClick={()=>projectFile.current?.click()}><FileUp size={18}/><b>Open project</b><span>Load an RbxWear JSON project</span></button><button onClick={()=>{saveProject();setHomeOpen(false)}}><FileDown size={18}/><b>Save project</b><span>Store locally and download JSON</span></button></div></div></div>}<footer>Independent creator tool · Not affiliated with Roblox Corporation · Classic clothing editor</footer>
 </div>
}
