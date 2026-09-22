import React,{useEffect,useMemo,useRef,useState}from"react";
import{Canvas}from"@react-three/fiber";
import{OrbitControls,ContactShadows}from"@react-three/drei";
import*as THREE from"three";
import{House,Cloud,PanelLeft,Undo2,Redo2,Upload,Download,Paintbrush,Eraser,PaintBucket,Pipette,Square,Circle,Type,Grid3X3,Eye,EyeOff,Plus,Trash2,ZoomIn,ZoomOut,Maximize2,Save,Copy,Trash,RotateCcw,Move,Palette,Layers3,Image as ImageIcon,SlidersHorizontal,MousePointer2,RefreshCw,ChevronDown,Check,Box,SunMedium,Minus,Rotate3D,FlipHorizontal2}from"lucide-react";

type Kind="shirt"|"pants"|"tshirt";
type Tool="select"|"brush"|"eraser"|"fill"|"picker"|"rect"|"circle"|"text";
type Layer={id:number,name:string,visible:boolean,opacity:number,canvas:HTMLCanvasElement,x:number,y:number,scale:number,rotation:number};
type FaceRect={x:number,y:number,w:number,h:number};

const SIZES:Record<Kind,[number,number]>={shirt:[585,559],pants:[585,559],tshirt:[512,512]};
const COLUMNS=[
 "#111827","#1f2937","#374151","#6b7280","#9ca3af","#d1d5db","#f9fafb",
 "#7f1d1d","#b91c1c","#ef4444","#f97316","#f59e0b","#eab308",
 "#166534","#16a34a","#22c55e","#0f766e","#0891b2","#2563eb",
 "#4f46e5","#7c3aed","#9333ea","#db2777"
];

const TORSO={
 top:{x:231,y:8,w:128,h:64},right:{x:165,y:74,w:64,h:128},front:{x:231,y:74,w:128,h:128},
 left:{x:361,y:74,w:64,h:128},back:{x:427,y:74,w:128,h:128},bottom:{x:231,y:204,w:128,h:64}
};
const LIMB_R={
 top:{x:217,y:289,w:64,h:64},left:{x:19,y:355,w:64,h:128},back:{x:85,y:355,w:64,h:128},
 right:{x:151,y:355,w:64,h:128},front:{x:217,y:355,w:64,h:128},bottom:{x:217,y:485,w:64,h:64}
};
const LIMB_L={
 top:{x:308,y:289,w:64,h:64},front:{x:308,y:355,w:64,h:128},left:{x:374,y:355,w:64,h:128},
 back:{x:440,y:355,w:64,h:128},right:{x:506,y:355,w:64,h:128},bottom:{x:308,y:485,w:64,h:64}
};

const makeCanvas=(w:number,h:number)=>{const c=document.createElement("canvas");c.width=w;c.height=h;return c};
const cloneCanvas=(src:HTMLCanvasElement)=>{const c=makeCanvas(src.width,src.height);c.getContext("2d")!.drawImage(src,0,0);return c};
const rgba=(hex:string)=>{const s=hex.replace("#","");const n=parseInt(s.length===3?s.split("").map(x=>x+x).join(""):s,16);return[(n>>16)&255,(n>>8)&255,n&255,255]};
const colorString=(d:Uint8ClampedArray)=>"#"+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,"0")).join("");

function checker(ctx:CanvasRenderingContext2D,w:number,h:number){
 for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=16){ctx.fillStyle=(x/16+y/16)%2?"#20242c":"#161a20";ctx.fillRect(x,y,16,16)}
}
function drawGuides(ctx:CanvasRenderingContext2D,k:Kind,alpha=true){
 if(!alpha)return;ctx.save();ctx.strokeStyle="#9a8cff99";ctx.fillStyle="#d0caff";ctx.lineWidth=1.5;ctx.setLineDash([5,5]);ctx.font="700 9px Inter,Arial";
 if(k==="tshirt"){ctx.strokeRect(0,0,512,512);ctx.fillText("FRONT TORSO • T-SHIRT GRAPHIC",12,18)}
 else{
  const a:[number,number,number,number,string][]=[[231,8,128,64,"UP"],[165,74,64,128,"R"],[231,74,128,128,"FRONT"],[361,74,64,128,"L"],[427,74,128,128,"BACK"],[231,204,128,64,"DOWN"],
  [19,355,64,128,"L"],[85,355,64,128,"B"],[151,355,64,128,"R"],[217,355,64,128,"F"],[217,289,64,64,"U"],[217,485,64,64,"D"],
  [308,355,64,128,"F"],[374,355,64,128,"L"],[440,355,64,128,"B"],[506,355,64,128,"R"],[308,289,64,64,"U"],[308,485,64,64,"D"]];
  a.forEach(([x,y,w,h,t])=>{ctx.strokeRect(x,y,w,h);ctx.fillText(t,x+4,y+11)});
 }
 ctx.restore();
}
function flood(c:HTMLCanvasElement,x:number,y:number,hex:string){
 const ctx=c.getContext("2d")!,w=c.width,h=c.height,px=x|0,py=y|0;if(px<0||py<0||px>=w||py>=h)return;
 const img=ctx.getImageData(0,0,w,h),d=img.data,start=(py*w+px)*4,target=[d[start],d[start+1],d[start+2],d[start+3]],to=rgba(hex);
 if(target.every((v,i)=>v===to[i]))return;
 const q:[[number,number]]|Array<[number,number]>=[[px,py]],seen=new Uint8Array(w*h);
 while(q.length){const [a,b]=q.pop()!,n=b*w+a,i=n*4;if(a<0||b<0||a>=w||b>=h||seen[n]||d[i]!==target[0]||d[i+1]!==target[1]||d[i+2]!==target[2]||d[i+3]!==target[3])continue;
  seen[n]=1;d[i]=to[0];d[i+1]=to[1];d[i+2]=to[2];d[i+3]=to[3];q.push([a+1,b],[a-1,b],[a,b+1],[a,b-1])
 }ctx.putImageData(img,0,0)
}
function removeLightBackground(c:HTMLCanvasElement){
 const ctx=c.getContext("2d")!,img=ctx.getImageData(0,0,c.width,c.height),d=img.data;
 for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];if(r>235&&g>235&&b>235)d[i+3]=0}
 ctx.putImageData(img,0,0)
}
function drawLayerTo(ctx:CanvasRenderingContext2D,l:Layer,cx:number,cy:number){
 if(!l.visible||l.opacity<=0)return;ctx.save();ctx.globalAlpha=l.opacity;ctx.translate(cx+l.x,cy+l.y);ctx.rotate(l.rotation*Math.PI/180);ctx.scale(l.scale,l.scale);ctx.drawImage(l.canvas,-l.canvas.width/2,-l.canvas.height/2);ctx.restore()
}
function compose(layers:Layer[],w:number,h:number){
 const c=makeCanvas(w,h),ctx=c.getContext("2d")!;layers.forEach(l=>drawLayerTo(ctx,l,w/2,h/2));return c;
}
function addTextCanvas(text:string,font:string,size:number,color:string,bold:boolean){
 const c=makeCanvas(Math.max(64,text.length*size),Math.max(64,size*1.6)),ctx=c.getContext("2d")!;ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle=color;ctx.font=(bold?"700 ":"400 ")+size+"px "+font;ctx.textBaseline="middle";ctx.fillText(text,10,c.height/2);return c
}

function FaceMat({source,rect,flip=false}:{source:HTMLCanvasElement,rect:FaceRect,flip?:boolean}){
 const mat=useMemo(()=>{const c=makeCanvas(rect.w,rect.h),x=c.getContext("2d")!;x.save();if(flip){x.translate(rect.w,0);x.scale(-1,1)}x.drawImage(source,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);x.restore();const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearFilter;return t},[source,rect.x,rect.y,rect.w,rect.h,flip]);
 useEffect(()=>()=>mat.dispose(),[mat]);
 return <meshStandardMaterial map={mat} color="white" transparent alphaTest={.02} roughness={.82}/>;
}
function R6Part({size,position,materials}:{size:[number,number,number],position:[number,number,number],materials:React.ReactNode[]|React.ReactNode}){
 return <mesh position={position} castShadow geometry={new THREE.BoxGeometry(...size)}>{materials}</mesh>
}
function R6Avatar({kind,source}:{kind:Kind,source:HTMLCanvasElement}){
 const isShirt=kind==="shirt",isPants=kind==="pants",isT=kind==="tshirt";
 return <group position={[0,-2.7,0]} scale={1.32}>
   <mesh position={[0,5.25,0]} castShadow><boxGeometry args={[2,1,1]}/><meshStandardMaterial color="#d7ad86" roughness={.9}/></mesh>
   <mesh position={[0,3.25,0]} castShadow><boxGeometry args={[2,2,1]}/>{
     isT?[<meshStandardMaterial key="0" color="#d7ad86" roughness={.9}/>,<meshStandardMaterial key="1" color="#d7ad86" roughness={.9}/>,<meshStandardMaterial key="2" color="#d7ad86" roughness={.9}/>,<meshStandardMaterial key="3" color="#d7ad86" roughness={.9}/>,<FaceMat key="4" source={source} rect={{x:0,y:0,w:source.width,h:source.height}}/>,<meshStandardMaterial key="5" color="#d7ad86" roughness={.9}/>]:
       [<FaceMat key="0" source={source} rect={TORSO.right}/>,<FaceMat key="1" source={source} rect={TORSO.left} flip/>,<FaceMat key="2" source={source} rect={TORSO.top}/>,<FaceMat key="3" source={source} rect={TORSO.bottom}/>,<FaceMat key="4" source={source} rect={TORSO.front}/>,<FaceMat key="5" source={source} rect={TORSO.back} flip/>]
   }</mesh>
   <mesh position={[-1.5,3.25,0]} castShadow><boxGeometry args={[1,2,1]}/>{isShirt?[<FaceMat key="0" source={source} rect={LIMB_L.right}/>,<FaceMat key="1" source={source} rect={LIMB_L.left} flip/>,<FaceMat key="2" source={source} rect={LIMB_L.top}/>,<FaceMat key="3" source={source} rect={LIMB_L.bottom}/>,<FaceMat key="4" source={source} rect={LIMB_L.front}/>,<FaceMat key="5" source={source} rect={LIMB_L.back} flip/>]:<meshStandardMaterial color="#d7ad86" roughness={.9}/>}</mesh>
   <mesh position={[1.5,3.25,0]} castShadow><boxGeometry args={[1,2,1]}/>{isShirt?[<FaceMat key="0" source={source} rect={LIMB_R.right}/>,<FaceMat key="1" source={source} rect={LIMB_R.left} flip/>,<FaceMat key="2" source={source} rect={LIMB_R.top}/>,<FaceMat key="3" source={source} rect={LIMB_R.bottom}/>,<FaceMat key="4" source={source} rect={LIMB_R.front}/>,<FaceMat key="5" source={source} rect={LIMB_R.back} flip/>]:<meshStandardMaterial color="#d7ad86" roughness={.9}/>}</mesh>
   <mesh position={[-.5,1.25,0]} castShadow><boxGeometry args={[1,2,1]}/>{isPants?[<FaceMat key="0" source={source} rect={LIMB_L.right}/>,<FaceMat key="1" source={source} rect={LIMB_L.left} flip/>,<FaceMat key="2" source={source} rect={LIMB_L.top}/>,<FaceMat key="3" source={source} rect={LIMB_L.bottom}/>,<FaceMat key="4" source={source} rect={LIMB_L.front}/>,<FaceMat key="5" source={source} rect={LIMB_L.back} flip/>]:<meshStandardMaterial color="#d7ad86" roughness={.9}/>}</mesh>
   <mesh position={[.5,1.25,0]} castShadow><boxGeometry args={[1,2,1]}/>{isPants?[<FaceMat key="0" source={source} rect={LIMB_R.right}/>,<FaceMat key="1" source={source} rect={LIMB_R.left} flip/>,<FaceMat key="2" source={source} rect={LIMB_R.top}/>,<FaceMat key="3" source={source} rect={LIMB_R.bottom}/>,<FaceMat key="4" source={source} rect={LIMB_R.front}/>,<FaceMat key="5" source={source} rect={LIMB_R.back} flip/>]:<meshStandardMaterial color="#d7ad86" roughness={.9}/>}</mesh>
   <mesh position={[0,-.12,0]}><sphereGeometry args={[.08,12,12]}/><meshStandardMaterial color="#111318"/></mesh>
 </group>
}

function App(){
 const[kind,setKind]=useState<Kind>("shirt"),[tool,setTool]=useState<Tool>("select"),[color,setColor]=useState("#ff641f"),[brush,setBrush]=useState(18),
 [showGrid,setShowGrid]=useState(true),[showGuides,setShowGuides]=useState(true),[zoom,setZoom]=useState(1),[layers,setLayers]=useState<Layer[]>([]),
 [selected,setSelected]=useState(1),[nextId,setNextId]=useState(1),[history,setHistory]=useState<Layer[][]>([]),[future,setFuture]=useState<Layer[][]>([]),
 [tab,setTab]=useState<"insert"|"layers">("insert"),[inspectorTab,setInspectorTab]=useState<"style"|"view">("style"),[saved,setSaved]=useState(true),
 [viewMode,setViewMode]=useState<"3d"|"split"|"2d">("split"),[ground,setGround]=useState(true),[lighting,setLighting]=useState(1.3),
 [textValue,setTextValue]=useState("YOUR TEXT"),[font,setFont]=useState("Inter"),[fontSize,setFontSize]=useState(48),[bold,setBold]=useState(true);
 const[w,h]=SIZES[kind],editor=useRef<HTMLCanvasElement>(null),file=useRef<HTMLInputElement>(null),drag=useRef(false),last=useRef<{x:number,y:number}|null>(null);
 useEffect(()=>{const c=makeCanvas(w,h);setLayers([{id:1,name:"Artwork",visible:true,opacity:1,canvas:c,x:0,y:0,scale:1,rotation:0}]);setSelected(1);setNextId(1);setHistory([]);setFuture([]);setSaved(true)},[kind]);
 const active=layers.find(l=>l.id===selected);
 const composite=useMemo(()=>compose(layers,w,h),[layers,w,h]);
 useEffect(()=>{const c=editor.current;if(!c)return;const ctx=c.getContext("2d")!,draw=()=>{const r=c.getBoundingClientRect(),scale=Math.min((r.width-28)/w,(r.height-28)/h)*zoom,ox=(r.width-w*scale)/2,oy=(r.height-h*scale)/2;c.width=Math.max(1,Math.floor(r.width*devicePixelRatio));c.height=Math.max(1,Math.floor(r.height*devicePixelRatio));ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.clearRect(0,0,r.width,r.height);checker(ctx,r.width,r.height);ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=false;ctx.drawImage(composite,0,0);drawGuides(ctx,kind,showGuides);ctx.restore()};draw();window.addEventListener("resize",draw);return()=>window.removeEventListener("resize",draw)},[composite,kind,showGuides,zoom,w,h]);
 const snapshot=()=>{setHistory(hh=>hh.length>24?[...hh.slice(-24),layers]:[...hh,layers]);setFuture([]);setSaved(false)};
 const updateLayer=(id:number,fn:(l:Layer)=>void)=>{setLayers(ls=>ls.map(l=>{if(l.id!==id)return l;fn(l);return l}));setSaved(false)};
 const save=()=>{localStorage.setItem("rbxwear-project",JSON.stringify({kind}));setSaved(true)};
 const exportPng=()=>{const a=document.createElement("a");a.href=composite.toDataURL("image/png");a.download="rbxwear-"+kind+"-"+w+"x"+h+".png";a.click()};
 const addLayer=(name="Layer")=>{snapshot();const id=nextId+1;setNextId(id);setLayers(ls=>[...ls,{id,name:name+" "+id,visible:true,opacity:1,canvas:makeCanvas(w,h),x:0,y:0,scale:1,rotation:0}]);setSelected(id)};
 const duplicate=()=>{if(!active)return;snapshot();const id=nextId+1;setNextId(id);setLayers(ls=>[...ls,{...active,id,name:active.name+" copy",canvas:cloneCanvas(active.canvas),x:active.x+12,y:active.y+12}]);setSelected(id)};
 const remove=()=>{if(layers.length<=1)return;snapshot();const ls=layers.filter(l=>l.id!==selected);setLayers(ls);setSelected(ls[0].id)};
 const undo=()=>{if(!history.length)return;setFuture(f=>[layers,...f]);setLayers(history[history.length-1]);setHistory(history.slice(0,-1));setSaved(false)};
 const redo=()=>{if(!future.length)return;setHistory(h=>[...h,layers]);setLayers(future[0]);setFuture(future.slice(1));setSaved(false)};
 const reset=()=>{const c=makeCanvas(w,h);setLayers([{id:1,name:"Artwork",visible:true,opacity:1,canvas:c,x:0,y:0,scale:1,rotation:0}]);setSelected(1);setSaved(false)};
 const editorPoint=(e:React.PointerEvent)=>{const v=editor.current!,r=v.getBoundingClientRect(),s=Math.min((r.width-28)/w,(r.height-28)/h)*zoom;return{x:(e.clientX-r.left-(r.width-w*s)/2)/s,y:(e.clientY-r.top-(r.height-h*s)/2)/s}};
 const paint=(e:React.PointerEvent)=>{if(!active||!drag.current)return;const p=editorPoint(e);if(p.x<0||p.y<0||p.x>=w||p.y>=h)return;const ctx=active.canvas.getContext("2d")!;
  if(tool==="select"){const dx=p.x-(last.current?.x??p.x),dy=p.y-(last.current?.y??p.y);updateLayer(active.id,l=>{l.x+=dx;l.y+=dy});last.current=p;return}
  if(tool==="picker"){const d=ctx.getImageData(p.x|0,p.y|0,1,1).data;setColor(colorString(d));setTool("brush");return}
  ctx.globalCompositeOperation=tool==="eraser"?"destination-out":"source-over";ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=brush;ctx.lineCap="round";
  if(tool==="brush"||tool==="eraser"){ctx.beginPath();ctx.arc(p.x,p.y,brush/2,0,Math.PI*2);ctx.fill()}
  else if(tool==="fill")flood(active.canvas,p.x,p.y,color)
  else if(tool==="rect")ctx.fillRect(p.x-brush,p.y-brush,brush*2,brush*2)
  else if(tool==="circle"){ctx.beginPath();ctx.arc(p.x,p.y,brush,0,Math.PI*2);ctx.fill()}
  setLayers(ls=>[...ls]);setSaved(false)
 };
 const down=(e:React.PointerEvent)=>{drag.current=true;last.current=editorPoint(e);snapshot();paint(e)};
 const up=()=>{drag.current=false;last.current=null};
 const importImage=(f:File)=>{const im=new Image();im.onload=()=>{snapshot();const c=makeCanvas(w,h),ctx=c.getContext("2d")!,scale=Math.min(w/im.width,h/im.height)*.82;ctx.drawImage(im,(w-im.width*scale)/2,(h-im.height*scale)/2,im.width*scale,im.height*scale);const id=nextId+1;setNextId(id);setLayers(ls=>[...ls,{id,name:f.name.replace(/\.[^.]+$/,""),visible:true,opacity:1,canvas:c,x:0,y:0,scale:1,rotation:0}]);setSelected(id);setSaved(false)};im.src=URL.createObjectURL(f)};
 const textLayer=()=>{snapshot();const id=nextId+1;setNextId(id);const c=addTextCanvas(textValue,font,fontSize,color,bold);setLayers(ls=>[...ls,{id,name:"Text "+id,visible:true,opacity:1,canvas:c,x:0,y:0,scale:1,rotation:0}]);setSelected(id);setTool("select")};
 const removeBg=()=>{if(!active)return;snapshot();removeLightBackground(active.canvas);setLayers([...layers]);setSaved(false)};
 const flip=()=>{if(!active)return;snapshot();updateLayer(active.id,l=>l.scale=-l.scale)};
 const downloadTemplate=()=>{const c=makeCanvas(w,h),ctx=c.getContext("2d")!;checker(ctx,w,h);drawGuides(ctx,kind,true);const a=document.createElement("a");a.href=c.toDataURL("image/png");a.download="rbxwear-template-"+w+"x"+h+".png";a.click()};
 const setBodyView=(m:"3d"|"split"|"2d")=>setViewMode(m);
 return <div className="app">
  <header className="topbar">
   <div className="brand"><span className="brandmark">✦</span><b>RbxWear</b><small>STUDIO</small></div>
   <div className="crumb"><span>Projects</span><span>/</span><b>Untitled design</b></div>
   <div className="topactions"><button title="Autosave"><Cloud size={16}/><span className="save-dot"/></button><button onClick={undo} disabled={!history.length}><Undo2 size={16}/></button><button onClick={redo} disabled={!future.length}><Redo2 size={16}/></button><button className="save" onClick={save}><Save size={14}/>Save</button><button className="export" onClick={exportPng}><Download size={14}/>Export</button></div>
  </header>
  <div className="workspace">
   <aside className="leftbar">
    <div className="lefthead"><button className="iconbtn"><House size={17}/></button><span>POL</span><button className="iconbtn"><PanelLeft size={17}/></button></div>
    <div className="tabs"><button onClick={()=>setTab("insert")} className={tab==="insert"?"active":""}>Insert</button><button onClick={()=>setTab("layers")} className={tab==="layers"?"active":""}>Layers</button></div>
    {tab==="insert"?<div className="insert">
      <div className="sectiontitle">CREATE</div>
      <div className="toolgrid">
       {([["select","Select",MousePointer2],["brush","Brush",Paintbrush],["eraser","Eraser",Eraser],["fill","Fill",PaintBucket],["picker","Picker",Pipette],["rect","Rectangle",Square],["circle","Circle",Circle],["text","Text",Type]] as any[]).map(([t,n,I])=><button className={tool===t?"sel":""} onClick={()=>t==="text"?textLayer():setTool(t)} key={t}><I size={15}/><span>{n}</span></button>)}
      </div>
      <div className="sectiontitle">MEDIA</div>
      <button className="wide" onClick={()=>file.current?.click()}><Upload size={15}/>Import image</button>
      <button className="wide" onClick={downloadTemplate}><Download size={15}/>Download template</button>
      <input hidden ref={file} type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&importImage(e.target.files[0])}/>
      <div className="sectiontitle">COLOR</div>
      <div className="colorpick"><input type="color" value={color} onChange={e=>setColor(e.target.value)}/><code>{color}</code></div>
      <div className="palette">{COLUMNS.map(c=><button key={c} style={{background:c}} onClick={()=>setColor(c)}/>)}</div>
      <div className="sliderrow"><label>Brush</label><b>{brush}px</b></div><input className="range" type="range" min="2" max="100" value={brush} onChange={e=>setBrush(+e.target.value)}/>
      <div className="textcontrols"><input value={textValue} onChange={e=>setTextValue(e.target.value)} placeholder="Text"/><div className="row"><select value={font} onChange={e=>setFont(e.target.value)}><option>Inter</option><option>Arial</option><option>Georgia</option><option>Courier New</option></select><input type="number" min="10" max="160" value={fontSize} onChange={e=>setFontSize(+e.target.value)}/><button className={bold?"mini active": "mini"} onClick={()=>setBold(!bold)}>B</button></div></div>
    </div>:<div className="layerslist">{[...layers].reverse().map(l=><button className={"layerrow "+(l.id===selected?"selected":"")} key={l.id} onClick={()=>setSelected(l.id)}><span className="thumb" style={{backgroundImage:"url("+l.canvas.toDataURL()+")"}}/><span className="layername">{l.name}</span><button className="eye" onClick={e=>{e.stopPropagation();l.visible=!l.visible;setLayers([...layers]);setSaved(false)}}>{l.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button></button>)}</div>}
    <div className="leftbottom"><button onClick={()=>addLayer("Layer")}><Plus size={14}/>Add layer</button><button onClick={remove} disabled={layers.length<=1}><Trash2 size={14}/>Delete</button></div>
   </aside>
   <main className="stage">
    <div className="stagehead"><div><h1>{kind==="shirt"?"Classic Shirt":kind==="pants"?"Classic Pants":"Classic T-Shirt"}</h1><p>R6 Block Avatar · pixel-accurate classic clothing test</p></div>
      <div className="kindtabs">{(["shirt","pants","tshirt"] as Kind[]).map(k=><button key={k} className={kind===k?"active":""} onClick={()=>setKind(k)}>{k==="tshirt"?"T-Shirt":k==="shirt"?"Shirt":"Pants"}</button>)}</div>
    </div>
    <div className="avatarwrap">
      <Canvas shadows dpr={[1,2]} camera={{position:[6,3.5,8],fov:40}}>
       <color attach="background" args={["#11141b"]}/><ambientLight intensity={lighting}/><directionalLight position={[4,8,5]} intensity={2.2} castShadow/>
       <directionalLight position={[-4,3,-2]} intensity={.7}/>
       <R6Avatar kind={kind} source={composite}/>
       {ground&&<><mesh rotation={[-Math.PI/2,0,0]} position={[0,-3.15,0]} receiveShadow><planeGeometry args={[15,15]}/><meshStandardMaterial color="#0a0d12" roughness={1}/></mesh><ContactShadows position={[0,-3.14,0]} opacity={.42} scale={10} blur={2.4}/></>}
       <OrbitControls enablePan={false} minDistance={5} maxDistance={15}/>
      </Canvas>
      <div className="rigbadge"><span className="liveDot"/>R6 BLOCK AVATAR <small>6 PART TEST RIG</small></div>
      <div className="viewhint"><Rotate3D size={13}/>Drag to rotate · wheel to zoom</div>
      <div className="viewmodes"><button className={viewMode==="3d"?"active":""} onClick={()=>setBodyView("3d")}>3D</button><button className={viewMode==="split"?"active":""} onClick={()=>setBodyView("split")}>Split</button><button className={viewMode==="2d"?"active":""} onClick={()=>setBodyView("2d")}>2D</button></div>
      {viewMode!=="3d"&&<div className={"canvasfloat "+(viewMode==="2d"?"full":"")}><div className="floathead"><div><b>2D texture canvas</b><span>{w} × {h} · export-safe</span></div><button onClick={()=>setViewMode("3d")}><Maximize2 size={14}/></button></div><div className="floatcanvas"><canvas ref={editor} onPointerDown={down} onPointerMove={paint} onPointerUp={up} onPointerLeave={up}/><div className="floattools"><button onClick={()=>setZoom(Math.max(.5,zoom-.1))}><ZoomOut size={14}/></button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(Math.min(3,zoom+.1))}><ZoomIn size={14}/></button><button onClick={()=>setZoom(1)}><RefreshCw size={13}/></button></div></div></div>}
    </div>
   </main>
   <aside className="inspector">
    <div className="inspecttop"><div className="inspecttitle"><span className="tinyicon"><SlidersHorizontal size={14}/></span><div><b>{active?.name||"Artwork"}</b><small>{kind==="tshirt"?"T-Shirt":"Classic "+(kind==="shirt"?"Shirt":"Pants")} · {w}×{h}</small></div></div><button onClick={reset}><RotateCcw size={14}/></button></div>
    <div className="inspecttabs"><button className={inspectorTab==="style"?"active":""} onClick={()=>setInspectorTab("style")}>Edit</button><button className={inspectorTab==="view"?"active":""} onClick={()=>setInspectorTab("view")}>View</button></div>
    {inspectorTab==="style"?<div className="inspectorbody">
      <div className="controlgroup"><div className="controlhead"><span>Opacity</span><b>{Math.round((active?.opacity??1)*100)}%</b></div><input className="range" type="range" min="0" max="1" step=".01" value={active?.opacity??1} onChange={e=>active&&updateLayer(active.id,l=>l.opacity=+e.target.value)}/></div>
      <div className="actionrow"><button onClick={removeBg}><ImageIcon size={15}/>Remove background</button><button onClick={duplicate}><Copy size={15}/>Duplicate</button></div>
      <div className="controlgroup"><div className="controlhead"><span>Transform</span><Move size={13}/></div><div className="transformgrid">
       <label>X<input type="number" value={Math.round(active?.x??0)} onChange={e=>active&&updateLayer(active.id,l=>l.x=+e.target.value)}/></label>
       <label>Y<input type="number" value={Math.round(active?.y??0)} onChange={e=>active&&updateLayer(active.id,l=>l.y=+e.target.value)}/></label>
       <label>Scale<input type="number" min=".1" max="5" step=".05" value={active?.scale??1} onChange={e=>active&&updateLayer(active.id,l=>l.scale=+e.target.value)}/></label>
       <label>Rotate<input type="number" value={Math.round(active?.rotation??0)} onChange={e=>active&&updateLayer(active.id,l=>l.rotation=+e.target.value)}/></label>
      </div></div>
      <div className="actionrow"><button onClick={flip}><FlipHorizontal2 size={15}/>Flip</button><button onClick={()=>active&&updateLayer(active.id,l=>{l.x=0;l.y=0;l.scale=1;l.rotation=0})}><Maximize2 size={15}/>Center</button></div>
      <div className="controlgroup"><div className="controlhead"><span>Layer</span><Layers3 size={13}/></div><div className="layerops"><button onClick={()=>addLayer("Layer")}><Plus size={14}/>New layer</button><button onClick={remove}><Trash size={14}/>Delete</button></div></div>
    </div>:<div className="inspectorbody">
      <div className="controlgroup"><div className="controlhead"><span>Avatar preview</span><b>R6</b></div><div className="previewpill"><span>Blocky</span><span>Classic six-part rig</span></div></div>
      <div className="controlgroup"><div className="controlhead"><span>Lighting</span><SunMedium size={13}/></div><input className="range" type="range" min=".5" max="2.2" step=".05" value={lighting} onChange={e=>setLighting(+e.target.value)}/></div>
      <div className="controlgroup"><div className="controlhead"><span>Stage</span><Box size={13}/></div><button className={"toggle "+(ground?"on":"")} onClick={()=>setGround(!ground)}><span/>Ground plane</button><button className={"toggle "+(showGrid?"on":"")} onClick={()=>setShowGrid(!showGrid)}><span/>2D grid</button><button className={"toggle "+(showGuides?"on":"")} onClick={()=>setShowGuides(!showGuides)}><span/>Template guides</button></div>
      <div className="formatcard"><Check size={15}/><div><b>Roblox classic format</b><span>{w} × {h}px · PNG/JPG compatible</span></div></div>
    </div>}
    <div className="inspectbottom"><span>{saved?"All changes saved locally":"Unsaved changes"}</span><button onClick={save}>Save</button></div>
   </aside>
  </div>
  <footer>Independent creator tool · Not affiliated with Roblox Corporation · Classic clothing workflow</footer>
 </div>
}

export default App;
