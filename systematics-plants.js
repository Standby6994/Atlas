// Magnified details for the scanned plants and the mushroom. The specimen surface comes from the scan;
// what a scan cannot show (inside of a capsule, sori, ovules, pollen, gills) is built here as "lens"
// insets placed beside the specimen, in the specimen's normalised frame (longest side 1, centred), each
// inside a thin ring that marks it as an enlargement. Enlargements are didactic, not to scale.
import {TAU,noise3,fbm,hex,mix,shade,smooth,rand,add,sub,scale,norm,cross,madd} from './systematics-geometry.js';

// Inset frame: local point (units of the inset) -> specimen frame.
const lensAt=(o,k)=>p=>[o[0]+p[0]*k,o[1]+p[1]*k,o[2]+p[2]*k];
function ring(b,part,o,r,{tilt=0}={}){const pts=[];for(let i=0;i<=72;i++){const a=i/72*TAU;pts.push([o[0]+r*Math.cos(a),o[1]+r*Math.sin(a),o[2]-.01])}b.tube(part,'protein',pts,r*.012,{samples:144,radial:6,ends:false,color:hex(0xd8d4c8)})}
const strandX=(b,part,tissue,X,pts,r0,r1,opts)=>b.strand(part,tissue,pts.map(X),r0,r1,opts);

// ---------- Moss: hair-cap moss (Pogonatum inflexum) ----------
export function moss(b){
 const mobile=b.mobile,rnd=rand(41);
 // Capsule in longitudinal section: hairy calyptra, operculum, peristome, spore sac with spores, columella.
 {const o=[-.19,-.68,0],k=.9,X=lensAt(o,k);ring(b,'capsule-section',o,.17);
  const prof=t=>.055*Math.pow(Math.sin(Math.PI*Math.min(1,Math.max(0,t))),.55)*(1+.15*smooth(.2,.6,t));
  const wall=b.loft('capsule-section','plant',{spine:[[0,-.1,0],[0,.08,0]],samples:40,radial:mobile?24:40,up:[1,0,0],window:{t:[.04,.96],a:[Math.PI,TAU]},thickness:.008,profile:t=>[prof(t),prof(t)*.85],xf:X,color:(t,a,p)=>mix(hex(0x8b6a3a),hex(0x6f5530),.5+.5*fbm(p[0]*60,p[1]*60,p[2]*60,3)),innerColor:()=>hex(0xbfa36a),lipColor:()=>hex(0xa08450)});
  for(let i=0;i<(mobile?120:320);i++){const t=.15+rnd()*.7,a=rnd()*TAU,r=(.012+rnd()*.03)*Math.min(1,prof(t)/.05),p=[r*Math.cos(a),-.1+.18*t,-Math.abs(r*Math.sin(a))*.9];b.blob('capsule-section','granule',X(p),[.0035*k,.0035*k,.0035*k],{nu:6,nv:4,color:mix(hex(0xc89a3c),hex(0x9a6e28),rnd())})}
  b.tube('capsule-section','plant',[X([0,-.09,0]),X([0,.075,0])],.007*k,{samples:12,radial:8,color:hex(0xe2d6b0)});
  b.blob('capsule-section','plant',X([0,.095,0]),[.05*k,.022*k,.042*k],{nu:24,nv:10,cut:(t)=>t>.5,color:hex(0x7a5a2e)});
  for(let i=0;i<(mobile?16:32);i++){const a=i/(mobile?16:32)*TAU;strandX(b,'capsule-section','chitin',X,[[.045*Math.cos(a),.08,.04*Math.sin(a)],[.03*Math.cos(a),.095,.027*Math.sin(a)]],.0028*k,.0016*k,{seg:2,radial:3,color:hex(0xd8c18a)})}
  b.blob('capsule-section','plant',X([0,.115,0]),[.034*k,.036*k,.03*k],{nu:20,nv:12,cut:(t)=>t>.62,color:hex(0xb79a6a)});
  for(let i=0;i<(mobile?40:110);i++){const a=rnd()*TAU,h=rnd(),p=[.03*Math.cos(a)*(1-h*.3),.1+.04*h,.026*Math.sin(a)*(1-h*.3)];strandX(b,'capsule-section','plant',X,[p,add(p,[.01*Math.cos(a),-.03-.02*rnd(),.01*Math.sin(a)]),add(p,[.018*Math.cos(a),-.07-.03*rnd(),.016*Math.sin(a)])],.0012*k,.0007*k,{seg:3,radial:3,color:hex(0xc9b48a)})}
  b.tube('capsule-section','plant',[X([0,-.1,0]),X([.004,-.15,0]),X([.006,-.17,0])],.006*k,{samples:10,radial:8,color:hex(0x7a4e28)})}
 // Gametangia at the shoot tip: archegonium (egg in the venter) and antheridium (sperm), among paraphyses.
 {const o=[.19,-.68,0],k=1.45,X=lensAt(o,k);ring(b,'gametangia',o,.17);
  b.blob('gametangia','plant',X([0,-.06,0]),[.08*k,.015*k,.05*k],{nu:24,nv:10,color:hex(0x5e7a2e)});
  b.loft('gametangia','plant',{spine:[[-.035,-.05,0],[-.035,.07,0]],samples:30,radial:mobile?16:24,up:[1,0,0],window:{t:[.05,.95],a:[Math.PI,TAU]},thickness:.003,profile:t=>{const r=t<.35?.016*Math.sin(Math.PI*Math.min(1,t/.35*0.9+.1)):.006;return[r,r]},xf:X,color:()=>hex(0x9db25a),innerColor:()=>hex(0xd8e2b4)});
  b.blob('gametangia','nucleus',X([-.035,-.03,-.002]),[.008*k,.009*k,.007*k],{nu:14,nv:10,color:hex(0xe9c97a)});
  b.loft('gametangia','plant',{spine:[[.035,-.05,0],[.035,.04,0]],samples:24,radial:mobile?16:24,up:[1,0,0],window:{t:[.15,.95],a:[Math.PI,TAU]},thickness:.003,profile:t=>{const r=.016*Math.pow(Math.sin(Math.PI*Math.min(1,t*1.05)),.6)*(t<.2?.5+2.5*t:1);return[r,r]},xf:X,color:()=>hex(0xb8a85a),innerColor:()=>hex(0xe2d8a4)});
  for(let i=0;i<(mobile?20:50);i++){const p=[.035+(rnd()-.5)*.02,-.035+rnd()*.06,-rnd()*.008];b.blob('gametangia','granule',X(p),[.0025*k,.0025*k,.0025*k],{nu:6,nv:4,color:hex(0xf2e4b0)})}
  for(let i=0;i<7;i++){const x=-.06+i*.02;strandX(b,'gametangia','plant',X,[[x,-.05,-.01],[x+.004,0,-.012],[x+.002,.05,-.01]],.0022*k,.0016*k,{seg:4,radial:4,color:hex(0x7f9a42)})}}
}

// ---------- Fern: autumn fern (Dryopteris erythrosora) ----------
export function fern(b){
 const mobile=b.mobile,rnd=rand(43);
 // Underside of a pinna with kidney-shaped sori, and one sporangium opening by its annulus.
 {const o=[.22,-.33,0],k=.8,X=lensAt(o,k);ring(b,'sori',o,.2);
  b.sheet('sori','leaf',{nu:30,nv:10,mid:(u,v)=>X([-.2+.4*u,(v-.5)*.14*(1-.6*Math.abs(u-.5)),0]),thick:(u,v)=>.004*k*(1-Math.pow(Math.abs(v-.5)*2,4)),color:()=>hex(0x5f7d34),under:(u,v,p)=>mix(hex(0x7a944a),hex(0x6a8440),.5+.5*fbm(p[0]*40,p[1]*40,1,2))});
  for(let i=0;i<6;i++)for(const s of[1,-1]){const c=X([-.15+i*.06,s*.03,.006]);b.blob('sori','plant',c,[.012*k,.009*k,.004*k],{nu:16,nv:8,disp:(d)=>1-.35*Math.max(0,d[0]*s),color:mix(hex(0xb5452f),hex(0x8a3a28),rnd())})}
  const sp=X([.12,.12,.04]);b.tube('sori','plant',[X([.09,.03,.008]),X([.11,.08,.02]),sp],.002*k,{samples:12,radial:6,color:hex(0xa9b46a)});
  b.blob('sori','plant',sp,[.03*k,.024*k,.012*k],{nu:24,nv:14,color:hex(0xc9a24a)});
  const ann=[];for(let i=0;i<=24;i++){const a=-.3+i/24*3.6;ann.push(add(sp,[.031*k*Math.cos(a),.025*k*Math.sin(a),.004*k]))}b.tube('sori','chitin',ann,.0045*k,{samples:48,radial:6,ends:false,disp:(t,a)=>.0012*k*Math.cos(t*90),color:hex(0x8a4a22)});
  for(let i=0;i<(mobile?14:30);i++){const d=norm([.6+rnd(),rnd()-.3,rnd()*.6]);b.blob('sori','granule',madd(sp,d,(.035+rnd()*.05)*k),[.004*k,.003*k,.003*k],{nu:6,nv:4,color:hex(0x8a6a2a)})}}
 // Rhizome with roots, leaf bases and a young frond coiled as a fiddlehead (crozier).
 {const o=[-.22,-.33,0],k=.85,X=lensAt(o,k);ring(b,'rhizome-roots',o,.2);
  b.tube('rhizome-roots','bark',[X([-.15,-.04,0]),X([0,-.05,0]),X([.13,-.03,0])],.025*k,{samples:30,radial:14,disp:(t,a)=>.003*fbm(t*20,Math.cos(a)*2,Math.sin(a)*2,3),color:(t,a,p)=>mix(hex(0x5b3b22),hex(0x7a5232),.5+.5*fbm(p[0]*90,p[1]*90,p[2]*90,3))});
  for(let i=0;i<(mobile?10:20);i++){const x=-.13+rnd()*.25,a=(rnd()-.5)*1.5,l=.06+rnd()*.06;b.tube('rhizome-roots','plant',[X([x,-.06,0]),X([x+Math.sin(a)*l*.4,-.06-l*.5,(rnd()-.5)*.04]),X([x+Math.sin(a)*l,-.06-l,(rnd()-.5)*.06])],.0025*k,{samples:10,radial:5,color:hex(0x4a3420)})}
  const pts=[];for(let i=0;i<=40;i++){const t=i/40;if(t<.5)pts.push([.06,-.02+t*.2,0]);else{const a=(t-.5)/.5*Math.PI*1.6,r=.035*(1-.6*(t-.5)/.5);pts.push([.06-r+r*Math.cos(a),.08+r*Math.sin(a),0])}}
  b.tube('rhizome-roots','leaf',pts.map(X),t=>.008*k*(1-.4*t),{samples:80,radial:10,color:(t,a,p)=>mix(hex(0xa4462e),hex(0x7d8a3a),t*.4)});
  for(let i=0;i<(mobile?12:26);i++){const t=.1+rnd()*.35,p=X([.06,-.02+t*.2,0]);b.blob('rhizome-roots','bark',madd(p,[rnd()-.5,0,rnd()-.5],.006*k),[.004*k,.008*k,.002*k],{nu:6,nv:4,color:hex(0x7a4a2a)})}}
}

// ---------- Gymnosperm: Japanese red pine (Pinus densiflora) ----------
export function pine(b){
 const mobile=b.mobile,rnd=rand(47);
 // Seed (ovulate) cone: woody scales in spirals; one scale lifted to show its two winged seeds.
 {const o=[-.38,-.72,0],k=.7,X=lensAt(o,k);ring(b,'seed-cone',o,.18);
  const n=mobile?55:110,golden=Math.PI*(3-Math.sqrt(5));for(let i=0;i<n;i++){const t=i/n,y=-.1+.22*t,r=.05*Math.sin(Math.PI*(.1+.85*t))+.008,a=i*golden,c=[r*Math.cos(a),y,r*Math.sin(a)],out=norm([Math.cos(a),.35,Math.sin(a)]);
   b.blob('seed-cone','bark',X(madd(c,out,.012)),[.02*k,.008*k,.016*k],{nu:12,nv:6,xf:null,disp:(d,p)=>1+.1*fbm(p[0]*200,p[1]*200,p[2]*200,2),color:mix(hex(0x8a5a32),hex(0x6b4426),rnd())})}
  b.tube('seed-cone','bark',[X([0,-.14,0]),X([0,.13,0])],.012*k,{samples:20,radial:10,color:hex(0x6b4426)});
  const sc=X([.13,.02,.0]);b.blob('seed-cone','bark',sc,[.04*k,.006*k,.032*k],{nu:20,nv:8,color:hex(0x9a6a3e)});
  for(const s of[1,-1]){b.blob('seed-cone','granule',madd(sc,[0,1,0],.008*k),[.008*k,.005*k,.006*k],{nu:12,nv:8,xf:null,color:hex(0x4a3020)});b.blob('seed-cone','leaf',add(sc,[.02*k,.009*k,s*.012*k]),[.026*k,.002*k,.011*k],{nu:14,nv:6,color:hex(0xc9a46a)})}}
 // Pollen grain with two air sacs (carried by the wind).
 {const o=[0,-.72,0],k=1.1,X=lensAt(o,k);ring(b,'pollen',o,.18);
  b.blob('pollen','granule',X([0,0,0]),[.05*k,.035*k,.04*k],{nu:24,nv:14,disp:(d,p)=>1+.03*noise3(p[0]*300,p[1]*300,p[2]*300),color:hex(0xe2c46a)});
  for(const s of[1,-1])b.blob('pollen','membrane',X([s*.055,-.01,0]),[.04*k,.035*k,.038*k],{nu:22,nv:14,disp:(d,p)=>1+.08*Math.abs(Math.sin(p[0]*900)*Math.sin(p[1]*900)),color:hex(0xf0e2b0)})}
 // Needle in cross-section: epidermis with sunken stomata, resin ducts, endodermis and two vascular bundles.
 {const o=[.38,-.72,0],k=1.6,X=lensAt(o,k);ring(b,'needle-section',o,.18);
  const R=.08,prof=a=>{const y=Math.sin(a);return y>=0?R:R*.15};
  b.grid('needle-section','leaf',2,61,(r,c)=>{const a=c/60*Math.PI;return X([R*Math.cos(a)*(r?1:.0),R*Math.sin(a)*(r?1:0)-.0,.0])},{color:()=>hex(0x5f8a3a),outward:()=>[0,0,1]});
  b.grid('needle-section','leaf',12,61,(r,c)=>{const a=c/60*Math.PI,rr=R*r/11;return X([rr*Math.cos(a),rr*Math.sin(a),.001])},{color:(r,c,p)=>{const a=c/60*Math.PI,rr=r/11;if(rr>.92)return hex(0x3f5f22);if(rr<.45)return mix(hex(0xd8d7b0),hex(0xc9c48a),rr*2);return mix(hex(0x6e9a40),hex(0x4f7a2e),.5+.5*fbm(p[0]*400,p[1]*400,1,2))},outward:()=>[0,0,1]});
  for(const s of[1,-1])b.blob('needle-section','organ',X([s*.018,.025,.004]),[.012*k,.012*k,.004*k],{nu:14,nv:8,color:p=>hex(0x9a7a3a)});
  for(const a of[.5,1.5,2.6])b.blob('needle-section','membrane',X([.06*Math.cos(a),.06*Math.sin(a),.004]),[.007*k,.007*k,.003*k],{nu:12,nv:6,color:hex(0xe9e2b4)});
  for(let i=0;i<5;i++){const a=.3+i*.62;b.blob('needle-section','leaf',X([R*Math.cos(a)*.97,R*Math.sin(a)*.97,.004]),[.004*k,.004*k,.002*k],{nu:8,nv:4,color:hex(0x2a3a18)})}}
}

// ---------- Angiosperm: tiger lily (Lilium lancifolium) ----------
export function lily(b){
 const mobile=b.mobile,rnd=rand(53);
 // Pistil in longitudinal section: three-lobed stigma, style with a pollen tube, ovary with ovules.
 {const o=[-.22,-.74,0],k=1.15,X=lensAt(o,k);ring(b,'pistil-section',o,.2);
  b.loft('pistil-section','petal',{spine:[[0,-.15,0],[0,-.03,0],[0,.14,0]],samples:50,radial:mobile?20:32,up:[1,0,0],window:{t:[.02,.98],a:[Math.PI,TAU]},thickness:.006,profile:t=>{const r=t<.38?.045*Math.sin(Math.PI*(t/.38*.9+.05)):.009+.006*smooth(.9,1,t);return[r,r]},xf:X,color:(t,a,p)=>mix(hex(0x8aa04a),hex(0xb7c06a),t),innerColor:()=>hex(0xe8ecc0),lipColor:()=>hex(0xc8d090)});
  for(let i=0;i<3;i++){const a=i/3*TAU;b.blob('pistil-section','petal',X([.016*Math.cos(a),.15,.016*Math.sin(a)]),[.014*k,.008*k,.01*k],{nu:12,nv:8,color:hex(0x7a5a30)})}
  for(let i=0;i<(mobile?8:16);i++)for(const s of[1,-1]){const y=-.13+i*.0065*2.6;if(y>-.05)continue;b.blob('pistil-section','granule',X([s*.012,y,-.006]),[.005*k,.004*k,.004*k],{nu:8,nv:6,color:hex(0xf2ead0)})}
  b.tube('pistil-section','membrane',[X([.003,.15,.0]),X([.004,.05,-.002]),X([.006,-.06,-.004]),X([.012,-.09,-.006])],.0015*k,{samples:40,radial:5,color:hex(0xe9d36a)});
  b.blob('pistil-section','granule',X([.0,.158,.004]),[.006*k,.005*k,.005*k],{nu:10,nv:6,color:hex(0xc9752a)})}
 // Anther in cross-section: four pollen sacs full of pollen grains.
 {const o=[.22,-.74,0],k=1.6,X=lensAt(o,k);ring(b,'anther-section',o,.2);
  for(const [sx,sy] of [[-1,1],[1,1],[-1,-1],[1,-1]]){const c=X([sx*.035,sy*.025,0]);b.blob('anther-section','petal',c,[.03*k,.024*k,.03*k],{nu:22,nv:14,cut:(t,u)=>u<.5,color:hex(0x8a3a28)});
   for(let i=0;i<(mobile?14:30);i++){const a=rnd()*TAU,r=rnd()*.022;b.blob('anther-section','granule',add(c,[r*Math.cos(a)*k,r*Math.sin(a)*.8*k,-.006*k+rnd()*.008*k]),[.004*k,.004*k,.004*k],{nu:6,nv:4,color:hex(0xc96a2a)})}}
  b.blob('anther-section','petal',X([0,0,0]),[.012*k,.035*k,.02*k],{nu:14,nv:10,color:hex(0x9a4a30)})}
}

// ---------- Fungus: mushroom (gilled basidiomycete) ----------
export function mushroom(b){
 const mobile=b.mobile,rnd=rand(59);
 // Mycelium: white hyphae spreading from the base of the stipe into the substrate.
 {const base=[-.27,-.42,0];for(let i=0;i<(mobile?40:110);i++){const a=rnd()*TAU,l=.05+rnd()*.14,pts=[base];let p=base;for(let s=0;s<5;s++){p=add(p,[Math.cos(a)*l/5+(rnd()-.5)*.02,-(rnd()*.02),Math.sin(a)*l/5+(rnd()-.5)*.02]);pts.push(p)}b.tube('mycelium','fungus',pts,.0016,{samples:mobile?10:18,radial:4,color:(t)=>mix(hex(0xf2eee4),hex(0xdcd4c4),t)})}}
 // Gill with its hymenium: basidia, each with four basidiospores on sterigmata.
 {const o=[.2,-.74,0],k=.85,X=lensAt(o,k);ring(b,'basidia',o,.2);
  b.sheet('basidia','fungus',{nu:20,nv:20,mid:(u,v)=>X([-.14+.28*u,-.1+.2*v,0]),thick:()=>.03*k,color:(u,v,p)=>mix(hex(0xd9c3a4),hex(0xc6a888),.5+.5*fbm(p[0]*200,p[1]*200,1,2))});
  const n=mobile?8:16;for(let i=0;i<n;i++){const x=-.12+.24*i/(n-1),root=X([x,.1,.012]);b.tube('basidia','fungus',[root,X([x,.13,.012]),X([x,.15,.012])],t=>.007*k*(.6+.4*t),{samples:10,radial:8,color:hex(0xe9dcc4)});
   for(let s=0;s<4;s++){const dx=(s-1.5)*.008,tip=X([x+dx,.165,.012]);strandX(b,'basidia','fungus',p=>p,[X([x+dx*.5,.15,.012]),tip],.0012*k,.0008*k,{seg:2,radial:3,color:hex(0xe2d4b8)});b.blob('basidia','granule',madd(tip,[0,1,0],.004*k),[.004*k,.0055*k,.004*k],{nu:8,nv:6,color:hex(0x6a4a2a)})}}}
 // Septate hyphae: chains of cells with cross walls, the body of the fungus.
 {const o=[-.24,-.74,0],k=1.1,X=lensAt(o,k);ring(b,'hyphae',o,.2);
  const branch=(p0,dir,len,depth)=>{const n=Math.round(len/.03);let p=p0;for(let i=0;i<n;i++){const q=madd(p,dir,.03);b.tube('hyphae','fungus',[X(p),X(madd(p,dir,.015)),X(q)],.006*k,{samples:6,radial:8,color:hex(0xece4d2)});b.blob('hyphae','fungus',X(q),[.0065*k,.0065*k,.0065*k],{nu:8,nv:6,color:hex(0xc9b896)});p=q;if(depth<2&&i===Math.floor(n/2))branch(p,norm(add(dir,[rnd()-.5,rnd()-.5,0])),len*.6,depth+1)}};
  branch([-.12,-.08,0],norm([1,.6,0]),.24,0);branch([-.1,.06,0],norm([1,-.2,0]),.2,1)}
}
