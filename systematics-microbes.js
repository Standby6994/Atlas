// Domain representatives: Escherichia coli (Bacteria), Halobacterium salinarum (Archaea) and
// Paramecium caudatum (Eukarya). Units are micrometres for the prokaryotes and 1 unit = 100 µm for the
// paramecium; the app rescales every model. Envelopes are thickened and molecular patterns enlarged so
// they can be seen; numbers of ribosomes, pili and cilia are reduced samples, not counts.
import {TAU,noise3,fbm,hex,mix,shade,smooth,rand,add,sub,scale,norm,cross,madd,dot} from './systematics-geometry.js';

// Rounded rod (capsule) radius along t for total length L and radius R.
const capsule=(t,L,R)=>{const x=Math.abs((t-.5)*L),c=L/2-R,d=Math.max(0,x-c);return Math.sqrt(Math.max(0,R*R-d*d))};
// Random point on a rod surface, avoiding an opened window (front half between t0 and t1).
function surfacePoint(lo,rnd,avoid){for(let k=0;k<60;k++){const t=.03+rnd()*.94,a=rnd()*TAU;if(avoid&&t>avoid[0]-.02&&t<avoid[1]+.02&&a>-.05&&a<Math.PI+.05)continue;const i=Math.round(t*lo.samples),j=Math.round(a/TAU*lo.radial)%lo.radial,p=lo.point(i,j),q=lo.point(i,(j+1)%lo.radial),r=lo.point(Math.min(lo.samples,i+1),j),n=norm(cross(sub(r,p),sub(q,p)));const out=dot(n,[0,lo.F.N[i][1]*Math.cos(a)+lo.F.B[i][1]*Math.sin(a),lo.F.N[i][2]*Math.cos(a)+lo.F.B[i][2]*Math.sin(a)])<0?scale(n,-1):n;return{p,n:out,t,a,T:lo.F.T[i]}}return null}
function ribosome(b,part,p,s,rnd,color){const o=[rnd()-.5,rnd()-.5,rnd()-.5];b.blob(part,'granule',p,[s,s*.8,s*.78],{nu:10,nv:6,color:color,disp:d=>1+.08*noise3(d[0]*3+o[0]*9,d[1]*3,d[2]*3)});b.blob(part,'granule',madd(p,norm(o),s*.95),[s*.75,s*.5,s*.6],{nu:9,nv:5,color:shade(color,.92)})}
// A DNA mass as one smoothed random walk confined to an ellipsoid (nucleoid; no nuclear envelope).
function nucleoid(b,part,c,radii,{steps=420,radius=.011,seed=7,color,above=0}={}){
 const rnd=rand(seed),pts=[c.slice()];let v=[0,0,0];
 for(let i=0;i<steps;i++){const p=pts.at(-1),q=[(p[0]-c[0])/radii[0],(p[1]-c[1])/radii[1],(p[2]-c[2])/radii[2]],r=Math.hypot(...q);v=add(scale(v,.62),[(rnd()-.5)*.09,(rnd()-.5)*.09,(rnd()-.5)*.09]);if(r>.85)v=add(v,scale([q[0]*radii[0],q[1]*radii[1],q[2]*radii[2]],-.07/r));let n=add(p,scale(v,.55));if(above&&n[2]<c[2]-above)n[2]=c[2]-above;pts.push(n)}
 b.tube(part,'dna',pts,radius,{samples:steps*5,radial:6,color:(t,a,p)=>mix(color,shade(color,.7),.5+.5*noise3(p[0]*14,p[1]*14,p[2]*14))});
}
function plasmid(b,part,c,r,{tilt=0,twist=2,radius=.009,color}){const pts=[];for(let i=0;i<=48;i++){const a=i/48*TAU,k=r*(1+.18*Math.cos(twist*a));pts.push([c[0]+k*Math.cos(a),c[1]+k*Math.sin(a)*Math.cos(tilt),c[2]+.35*r*Math.sin(twist*a)+k*Math.sin(a)*Math.sin(tilt)*.3])}b.tube(part,'dna',pts,radius,{samples:140,radial:6,color,ends:false})}
// Helical filament (flagellum / archaellum) starting at the cell surface.
function helixFilament(b,part,tissue,base,n,axis,{length=3,amp=.16,pitch=1.05,radius=.013,turnOut=.18,color,seed=1}){
 const rnd=rand(seed),ph=rnd()*TAU,side=norm(cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0])),up=cross(axis,side),pts=[base,madd(base,n,turnOut*.5),madd(madd(base,n,turnOut),axis,.12)];
 const start=pts.at(-1);for(let i=1;i<=60;i++){const s=i/60*length,a=ph+s/pitch*TAU,k=amp*smooth(0,.4,s);pts.push(add(madd(start,axis,s),add(scale(side,k*Math.cos(a)),scale(up,k*Math.sin(a)))))}
 b.tube(part,tissue,pts,radius,{samples:340,radial:7,color});
}

export function ecoli(b){
 const L=2.4,rnd=rand(11),win={t:[.16,.84],a:[0,Math.PI]},spine=[[-L/2,0,0],[L/2,0,0]];
 const OM=hex(0xc8b38c),PG=hex(0xd6b25e),IM=hex(0xc98c74),CYT=hex(0xb9c3c0),DNA=hex(0x86699a),RIB=hex(0xa66e58);
 const lps=(t,a)=>.0045*fbm(t*40,Math.cos(a)*6,Math.sin(a)*6,3);
 const om=b.loft('outer-membrane','membrane',{spine,samples:180,radial:110,window:win,thickness:.022,profile:t=>{const r=capsule(t,L,.46);return[r,r]},disp:lps,color:(t,a,p)=>mix(OM,shade(OM,.82),.5+.5*fbm(p[0]*9,p[1]*9,p[2]*9,3)),innerColor:()=>shade(OM,.9),lipColor:()=>shade(OM,.95)});
 b.loft('peptidoglycan','wall',{spine,samples:180,radial:110,window:win,thickness:.012,profile:t=>{const r=capsule(t,L,.427);return[r,r]},color:(t,a,p)=>mix(PG,shade(PG,.86),.5+.5*noise3(p[0]*30,p[1]*30,p[2]*30)),innerColor:()=>shade(PG,.85),lipColor:()=>PG});
 const im=b.loft('plasma-membrane','membrane',{spine,samples:180,radial:110,window:win,thickness:.018,profile:t=>{const r=capsule(t,L,.405);return[r,r]},color:()=>IM,innerColor:()=>shade(IM,.92),lipColor:()=>mix(IM,[1,.9,.8],.15)});
 b.section('cytoplasm','cytosol',im,{t:win.t,inset:.018,across:60,disp:(t,s,p)=>.007*fbm(p[0]*22,p[1]*22,1.3,3)-.004,color:(t,s,p)=>mix(CYT,shade(CYT,.84),.5+.6*fbm(p[0]*11,p[1]*11,5.1,3))});
 nucleoid(b,'nucleoid',[0,0,.06],[.62,.24,.1],{steps:b.mobile?300:520,color:DNA,above:.06});
 for(const [c,r,tilt] of [[[.68,.18,.03],.075,.3],[[-.7,-.2,.03],.06,-.4],[[.55,-.24,.03],.05,.9]])plasmid(b,'plasmids',c,r,{tilt,color:hex(0xa48ab5)});
 const nr=b.mobile?320:760;for(let k=0;k<nr;k++){const x=(rnd()-.5)*L*.62,y=(rnd()-.5)*.68,z=.012+rnd()*.016;if(Math.abs(y)>.37||((x/.68)**2+(y/.26)**2<1&&rnd()<.8))continue;ribosome(b,'ribosomes',[x,y,z],.021,rnd,mix(RIB,hex(0xb98a66),rnd()))}
 // Peritrichous flagella: bases spread over the surface, filaments bundled behind the swimming cell.
 for(let k=0;k<6;k++){const s=surfacePoint(om,rand(40+k),win.t);if(!s)continue;helixFilament(b,'flagella','protein',s.p,s.n,norm([-1,(rnd()-.5)*.25,(rnd()-.5)*.25]),{length:2.6+rnd()*.8,amp:.17,pitch:1.0,radius:.014,color:(t,a,p)=>mix(hex(0xddd2bb),hex(0xc9bb9b),.5+.5*noise3(p[0]*20,0,0)),seed:90+k});
  b.tube('flagella','protein',[madd(s.p,s.n,-.03),madd(s.p,s.n,.02),madd(s.p,s.n,.06)],.024,{samples:10,radial:9,color:hex(0xb9a785)})}
 const np=b.mobile?110:240;for(let k=0;k<np;k++){const s=surfacePoint(om,rnd,win.t);if(!s)continue;const l=.18+rnd()*.24,bend=[(rnd()-.5)*.25,(rnd()-.5)*.25,(rnd()-.5)*.25];b.strand('fimbriae','protein',[madd(s.p,s.n,-.004),madd(s.p,add(s.n,scale(bend,.3)),l*.5),madd(s.p,add(s.n,bend),l)],.0065,.005,{seg:5,radial:4,color:hex(0xd5c8a6)})}
 const s=surfacePoint(om,rand(5),win.t)||{p:[.3,.45,-.1],n:[0,1,0]};b.strand('sex-pilus','protein',[s.p,madd(s.p,s.n,.4),madd(madd(s.p,s.n,.9),[.6,0,-.2],.4),madd(madd(s.p,s.n,1.25),[1,0,-.3],.8)],.012,.011,{seg:40,radial:7,color:hex(0xc7b48b)});
}

export function halobacterium(b){
 const L=3.2,rnd=rand(23),sWin={t:[.2,.8],a:[0,Math.PI]},mWin={t:[.3,.72],a:[0,Math.PI]},spine=[[-L/2,-.06,0],[-.6,.05,0],[.6,-.04,0],[L/2,.06,0]];
 const SL=hex(0xe0c2ad),MEM=hex(0xc2532f),PUR=hex(0x6a3a78),CYT=hex(0xd8b7a0),DNA=hex(0x7d5a8c),GV=hex(0xe4e6e0);
 const rad=t=>.34*Math.pow(Math.max(0,1-Math.abs(2*t-1)**3.2),.5);
 // Hexagonal S-layer lattice from three plane waves at 60° (spacing enlarged for visibility).
 const hexLattice=(t,a)=>{const u=t*L/.05,v=a*.33/.05;let s=0;for(const k of[0,1,2]){const ang=k*Math.PI/3;s+=Math.cos(TAU*(u*Math.cos(ang)+v*Math.sin(ang)))}return .0035*s/3};
 const sl=b.loft('s-layer','protein',{spine,samples:220,radial:120,window:sWin,thickness:.018,exponent:2.3,profile:t=>[rad(t)*1.12,rad(t)*.86],disp:hexLattice,color:(t,a,p)=>mix(SL,shade(SL,.85),.5+.5*fbm(p[0]*7,p[1]*7,p[2]*7,3)),innerColor:()=>shade(SL,.88),lipColor:()=>SL});
 const mem=b.loft('cell-membrane','membrane',{spine,samples:220,radial:120,window:mWin,thickness:.02,exponent:2.3,profile:t=>[rad(t)*1.12-.03,rad(t)*.86-.03],color:(t,a,p)=>mix(MEM,hex(0xd8743f),.5+.5*fbm(p[0]*10,p[1]*10,p[2]*10,3)),innerColor:()=>shade(MEM,.85),lipColor:()=>mix(MEM,[1,.85,.7],.2)});
 // Purple membrane: crystalline patches of bacteriorhodopsin in the membrane, seen where the S-layer is peeled.
 for(const [tc,ac,w,h] of [[.25,1.0,.035,.55],[.235,2.1,.02,.35],[.76,1.3,.03,.6],[.775,2.3,.018,.3],[.27,.45,.02,.3]]){const i0=Math.round((tc-w)*mem.samples),i1=Math.round((tc+w)*mem.samples),j0=Math.round((ac-h)/TAU*mem.radial),j1=Math.round((ac+h)/TAU*mem.radial),ph=rnd()*9;
  b.grid('purple-membrane','membrane',i1-i0+1,j1-j0+1,(r,c)=>{const i=i0+r,j=j0+c,p=mem.point(i,j,-.0035),u=(r/(i1-i0)-.5)*2,v=(c/(j1-j0)-.5)*2;return madd(p,norm(sub(p,mem.S[i])),.0035*(u*u+v*v<.8?1:0)+.0012*Math.cos(TAU*(i*.9+j*.7)))},{color:(r,c,p)=>mix(PUR,hex(0x8a4f8f),.5+.5*noise3(p[0]*40,p[1]*40,ph)),skip:(r,c)=>{const u=((r+.5)/(i1-i0)-.5)*2,v=((c+.5)/(j1-j0)-.5)*2;return u*u+v*v+.35*noise3(u*2,v*2,ph)>.9},outward:(r,c,p)=>sub(p,mem.S[i0+r])})}
 b.section('cytoplasm','cytosol',mem,{t:mWin.t,inset:.02,across:44,disp:(t,s,p)=>.006*fbm(p[0]*20,p[1]*20,3.3,3)-.004,color:(t,s,p)=>mix(CYT,shade(CYT,.86),.5+.6*fbm(p[0]*9,p[1]*9,2.2,3))});
 nucleoid(b,'chromosome',[-.05,0,.05],[.5,.15,.08],{steps:b.mobile?260:440,color:DNA,above:.05,seed:5});
 for(const [c,r,tilt] of [[[.48,.12,.03],.07,.4],[[-.5,-.13,.03],.065,-.2]])plasmid(b,'plasmids',c,r,{tilt,twist:3,color:hex(0x9d7fae)});
 // Gas vesicles: spindle-shaped protein shells with ribs, which make the cell buoyant.
 for(let k=0;k<(b.mobile?9:14);k++){const x=-.6+rnd()*1.2,y=(rnd()-.5)*.24,len=.16+rnd()*.12,ang=(rnd()-.5)*.9,ax=[Math.cos(ang),Math.sin(ang),0],w=.045+rnd()*.02;if(Math.abs(x)<.2&&Math.abs(y)<.1)continue;
  b.tube('gas-vesicles','protein',[madd([x,y,.035],ax,-len/2),[x,y,.035],madd([x,y,.035],ax,len/2)],t=>w*Math.pow(Math.sin(Math.PI*t),.7),{samples:40,radial:16,ends:false,disp:(t,a)=>.0035*Math.cos(TAU*t*len/.022),color:(t,a,p)=>mix(GV,shade(GV,.82),.5+.5*Math.cos(TAU*t*len/.022))})}
 for(let k=0;k<(b.mobile?260:600);k++){const x=(rnd()-.5)*L*.42,y=(rnd()-.5)*.48;if(Math.abs(y)>.24)continue;ribosome(b,'ribosomes',[x,y,.012+rnd()*.012],.02,rnd,mix(hex(0x9c6550),hex(0xb5805e),rnd()))}
 // Archaella: a polar tuft of thinner rotary filaments, unrelated in origin to bacterial flagella.
 const tip=sl.point(sl.samples-3,0),T=sl.F.T[sl.samples-3];for(let k=0;k<6;k++){const a=k/6*TAU,off=[0,Math.cos(a)*.07,Math.sin(a)*.07],base=add(sl.point(sl.samples-4,Math.round(k/6*sl.radial)),[0,0,0]);helixFilament(b,'archaella','protein',base,norm(add(T,scale(off,4))),norm(add(T,scale(off,1.2))),{length:2.1+rnd()*.5,amp:.11,pitch:.75,radius:.01,turnOut:.1,color:hex(0xe8d6c2),seed:300+k})}
}

export function paramecium(b){
 const rnd=rand(77),mobile=b.mobile,rows=mobile?34:64,units=mobile?58:112,per=mobile?3:4,samples=units*per,radial=rows*per;
 const win={t:[.1,.47],a:[0,Math.PI]},spine=[[-1.25,-.03,-.02],[-.5,.02,0],[.4,.0,.02],[1.25,.08,-.03]];
 const PEL=hex(0xc9cfc0),IN=hex(0xb7bfae),CYT=hex(0xc3c9b4);
 const width=t=>.37*Math.pow(Math.sin(Math.PI*Math.min(1,Math.max(0,t))),.62)*(1+.13*Math.sin(Math.PI*(t-.1))-.08*smooth(.6,1,t)),height=t=>width(t)*.86;
 const groove=t=>1.15+.75*smooth(.92,.5,t),grooveDepth=t=>t>.94||t<.47?0:(.025+.075*smooth(.92,.52,t))*smooth(.47,.53,t);
 const gauss=(a,c,w)=>{const d=Math.atan2(Math.sin(a-c),Math.cos(a-c));return Math.exp(-((d/w)**2))};
 // Kinetids: the pellicle is a lattice of shallow cups (alveoli) in slightly spiralling rows, one cilium per cup.
 const kin=(t,a)=>{const u=a/TAU*rows+t*2.2,v=t*units+(Math.floor(u)%2)*.5,fu=u-Math.floor(u)-.5,fv=v-Math.floor(v)-.5,m=Math.max(Math.abs(fu),Math.abs(fv))*2;return .0055*(Math.pow(m,3)-.45)};
 const relief=(t,a)=>kin(t,a)*(1-.8*gauss(a,groove(t),.42)*(grooveDepth(t)>0?1:0))-grooveDepth(t)*gauss(a,groove(t),.36)+.006*fbm(t*9,Math.cos(a)*2,Math.sin(a)*2,2);
 const pel=b.loft('pellicle','pellicle',{spine,samples,radial,fixed:true,window:win,thickness:.06,profile:t=>[width(t),height(t)],disp:relief,color:(t,a,p)=>{const g=gauss(a,groove(t),.36)*(grooveDepth(t)>0?1:0);return mix(mix(PEL,shade(PEL,.8),.5+.5*fbm(p[0]*5,p[1]*5,p[2]*5,3)),hex(0xa9ae95),g*.7)},innerTissue:'cytosol',innerColor:()=>IN,lipColor:(t,a,p)=>mix(hex(0xd6d8c8),IN,.5+.5*noise3(p[0]*30,p[1]*30,p[2]*30))});
 b.section('cytoplasm','cytosol',pel,{t:win.t,inset:.06,across:70,disp:(t,s,p)=>.012*fbm(p[0]*9,p[1]*9,7.7,4)-.006,color:(t,s,p)=>mix(mix(CYT,hex(0xaeb39a),.5+.6*fbm(p[0]*6,p[1]*6,1.1,3)),hex(0xd9dccd),smooth(.55,.85,noise3(p[0]*40,p[1]*40,.5)))});
 const at=(t,a)=>{const i=Math.round(t*pel.samples),j=((Math.round(a/TAU*pel.radial))%pel.radial+pel.radial)%pel.radial,p=pel.point(i,j),pa=pel.point(i,(j+1)%pel.radial),pb=pel.point(Math.min(pel.samples,i+1),j),pc=pel.point(Math.max(0,i-1),j);let n=norm(cross(sub(pb,pc),sub(pa,p)));const ref=sub(p,pel.S[i]);if(dot(n,ref)<0)n=scale(n,-1);return{p,n,T:pel.F.T[i]}};
 // Body cilia with a metachronal wave: neighbouring rows beat slightly out of phase.
 for(let r=0;r<rows;r++)for(let u=0;u<units;u++){const t=(u+.5+(r%2)*.5)/units,a=((r+.5-t*2.2)/rows*TAU+TAU)%TAU;if(t<.012||t>.985)continue;if(t>win.t[0]-.01&&t<win.t[1]+.01&&a<Math.PI+.04)continue;if(mobile&&(r+u)%2)continue;const g=gauss(a,groove(t),.36)*(grooveDepth(t)>0?1:0);if(g>.5)continue;
  const {p,n,T}=at(t,a),phase=Math.sin(TAU*(t*9-r/rows*1.6)),lean=.75+.4*phase,len=(t<.06?.2:.1)*(1+.1*(rnd()-.5)),dir=norm(add(scale(n,Math.cos(lean)),scale(T,-Math.sin(lean))));
  b.strand('cilia','cilium',[madd(p,n,-.003),madd(madd(p,n,len*.45),T,-len*.1*phase),madd(p,dir,len)],.0042,.0032,{seg:mobile?4:5,radial:mobile?3:4,color:hex(0xdedfd2)})}
 // Oral groove (peristome) and its dense oral cilia, ending at the cytostome.
 for(let i=Math.round(.5*pel.samples);i<=Math.round(.93*pel.samples);i+=mobile?2:1){const t=i/pel.samples;for(let k=-3;k<=3;k++){if(mobile&&k%2)continue;const a=groove(t)+k*.06,{p,n,T}=at(t,a),len=.07+.03*smooth(.9,.55,t);b.strand('oral-groove','cilium',[madd(p,n,-.003),madd(madd(p,n,len*.5),T,-len*.25),madd(madd(p,n,len*.8),T,-len*.6)],.0045,.0035,{seg:4,radial:mobile?3:4,color:hex(0xd2d4c0)})}}
 {const i0=Math.round(.5*pel.samples),i1=Math.round(.93*pel.samples),j0=Math.floor((groove(.93)-.55)/TAU*pel.radial),j1=Math.ceil((groove(.5)+.55)/TAU*pel.radial);
  b.grid('oral-groove','pellicle',i1-i0+1,j1-j0+1,(r,c)=>{const i=i0+r,j=j0+c,p=pel.point(i,j);return madd(p,norm(sub(p,pel.S[i])),.0016)},{color:(r,c,p)=>{const t=(i0+r)/pel.samples,a=(j0+c)/pel.radial*TAU;return mix(hex(0xb7b49a),hex(0x9d9a7e),gauss(a,groove(t),.2))},skip:(r,c)=>{const t=(i0+r+.5)/pel.samples,a=(j0+c+.5)/pel.radial*TAU;return gauss(a,groove(t),.36)<.35||grooveDepth(t)<.004},outward:(r,c,p)=>sub(p,pel.S[i0+r])})}
 // Cytopharynx: the gullet leaves the cytostome and runs back into the endoplasm, where food vacuoles form.
 const mouth=at(.5,groove(.5)).p;b.tube('cytopharynx','membrane',[madd(mouth,[0,0,1],-.01),add(mouth,[-.06,-.03,-.09]),[-.16,-.1,.05],[-.27,-.12,.04]],t=>.032-.012*t,{samples:60,radial:18,ends:false,color:(t,a,p)=>mix(hex(0xb0a68a),hex(0x998d70),t)});
 const vac=(c,r,content,seed)=>{const q=rand(seed);b.blob('food-vacuoles','membrane',c,[r,r,r*.9],{nu:40,nv:24,color:hex(0xd8d9c6),cut:(t,u)=>Math.cos(t*Math.PI)<-.4||(Math.sin(t*Math.PI)*Math.sin(u*TAU)>.35)});for(let k=0;k<5+Math.floor(q()*5);k++){const d=norm([q()-.5,q()-.5,q()*.6]),p=madd(c,d,r*.45*q());b.blob('food-vacuoles','granule',p,[r*.24,r*.12,r*.12],{nu:14,nv:8,color:mix(hex(content),shade(hex(content),.7),q()),xf:null})}};
 vac([-.27,-.13,.05],.07,0x6f7a3e,1);vac([-.52,.05,.05],.09,0x7b6a3c,2);vac([-.7,-.12,.04],.075,0x6a5b3a,3);vac([-.38,.15,.04],.06,0x80884a,4);vac([-.82,.12,.035],.05,0x5e5136,5);vac([-.62,-.22,.035],.045,0x76693f,6);
 // Macronucleus (polyploid; controls metabolism) and micronucleus (germline; meiosis and conjugation).
 b.blob('macronucleus','nucleus',[-.45,-.02,.0],[.24,.1,.075],{nu:72,nv:40,disp:(d,p)=>1-.18*Math.exp(-((d[1]+.9)**2)/.2)+.03*fbm(p[0]*20,p[1]*20,p[2]*20,3),color:(p)=>mix(hex(0xa696ac),hex(0x8a7895),.5+.5*fbm(p[0]*25,p[1]*25,p[2]*25,3))});
 b.blob('micronucleus','nucleus',[-.25,.08,.01],[.04,.04,.035],{nu:28,nv:16,color:hex(0x7c6488)});
 // Contractile vacuole: central vacuole with radiating collecting canals, under the dorsal surface.
 const cv=(c,seed)=>{const q=rand(seed);b.blob('contractile-vacuoles','membrane',c,[.045,.045,.03],{nu:30,nv:18,color:hex(0xcfe0e0)});for(let k=0;k<8;k++){const a=k/8*TAU+q()*.3,d=[Math.cos(a),Math.sin(a)*.8,0],pts=[madd(c,d,.035),madd(madd(c,d,.08),[0,0,1],.006),madd(c,d,.15)];b.tube('contractile-vacuoles','membrane',pts,t=>.011+.01*Math.sin(Math.PI*Math.min(1,t*2.2))*(t<.45?1:0),{samples:24,radial:10,color:hex(0xbfd3d4)})}};
 cv([-.78,.17,.015],8);cv([.62,.16,-.05],9);
 // Trichocysts: discharge organelles in the ectoplasm, cut across where the section meets the pellicle.
 for(let k=0;k<(mobile?40:90);k++){const t=win.t[0]+.01+rnd()*(win.t[1]-win.t[0]-.02),top=rnd()<.5,i=Math.round(t*pel.samples),j=top?0:Math.round(pel.radial/2),o=pel.point(i,j),inner=pel.point(i,j,.05),d=norm(sub(o,inner));b.tube('trichocysts','granule',[madd(o,d,-.05),madd(o,d,-.012)],t=>.0075*Math.sin(Math.PI*t)**.6,{samples:10,radial:8,ends:false,color:hex(0xe6e1cf)})}
 for(let k=0;k<(mobile?30:70);k++){const x=-.95+rnd()*.85,y=(rnd()-.5)*.6;if(Math.abs(y)>.26)continue;const ang=rnd()*TAU;b.tube('mitochondria','membrane',[[x-.018*Math.cos(ang),y-.018*Math.sin(ang),.01],[x,y,.016],[x+.018*Math.cos(ang),y+.018*Math.sin(ang),.01]],.011,{samples:10,radial:9,color:hex(0xb6a07c)})}
 // Cytoproct: the cell's fixed exit for undigested residues, on the ventral surface behind the mouth.
 {const t=.07,{p,n,T}=at(t,2.4),side=norm(cross(n,T)),pts=[];for(let k=0;k<=40;k++){const a=k/40*TAU;pts.push(add(madd(p,n,.004),add(scale(T,.045*Math.cos(a)),scale(side,.012*Math.sin(a)))))}b.tube('cytoproct','pellicle',pts,.006,{samples:60,radial:8,ends:false,color:hex(0x9a967c)})}
}
