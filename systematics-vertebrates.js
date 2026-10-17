// Interiors for the scanned vertebrates. Each builder works in the frame of its specimen scan, already
// normalised by the processing step (body length 1 along x, head towards −x, back towards +y, left side
// towards +z), so the organs sit inside the photographed body. Body outlines were measured on the scans
// (back, belly and half-width per position along x, fins and limbs excluded); every organ is placed at a
// fraction of that elliptical cross-section, so nothing pierces the skin. Sizes and positions follow
// dissection guides and are approximate.
import {noise3,fbm,hex,mix,shade,smooth,rand,norm,madd,bodyShape} from './systematics-geometry.js';

// ---------- Bony fish: carp (Cyprinus carpio) ----------
export function carp(b){
 const mobile=b.mobile,rnd=rand(5);
 const B=bodyShape([[-.5,.015,-.065,.03],[-.44,.046,-.071,.045],[-.4,.063,-.08,.055],[-.365,.08,-.088,.066],[-.33,.096,-.096,.072],[-.29,.105,-.11,.072],[-.25,.113,-.12,.07],[-.2,.12,-.125,.067],[-.135,.121,-.13,.064],[-.06,.115,-.13,.06],[.02,.105,-.13,.059],[.06,.096,-.128,.047],[.1,.088,-.121,.042],[.135,.071,-.115,.038],[.17,.063,-.096,.033],[.21,.046,-.082,.029],[.25,.038,-.077,.025],[.29,.029,-.07,.02],[.32,.027,-.064,.015]],-.007);
 const zc=B.zc,spineY=x=>B.mid(x)+B.semi(x)*.42,cavity=[-.25,.125];
 // Muscle wall behind the organs: myomeres (W-shaped blocks) above and below the body cavity, and the
 // dark peritoneum lining the cavity.
 {const x0=-.285,x1=.31,nx=mobile?70:140,ny=mobile?24:44,zw=-.62;
  b.grid('muscles','muscle',ny+1,nx+1,(r,c)=>{const x=x0+(x1-x0)*c/nx,v=-.76+1.52*r/ny;return B.at(x,v,zw)},
   {color:(r,c,p)=>{const x=p[0],y=p[1],v=(y-B.mid(x))/B.semi(x),sv=(spineY(x)-B.mid(x))/B.semi(x),w=x*38+Math.abs(Math.abs((v-sv)*1.4)-.3)*2.4,seam=Math.exp(-((w-Math.round(w))**2)/.006);
    if(x>cavity[0]&&x<cavity[1]&&v<sv-.12&&v>-.7)return mix(hex(0x55504c),hex(0x8e8a84),.5+.5*fbm(x*40,y*40,1,3));return shade(mix(hex(0xe4b6a6),hex(0xcf9a8a),.5+.5*fbm(x*30,y*30,2,3)),1-.22*seam-.12*Math.exp(-((v-sv)**2)/.004))},outward:()=>[0,0,1]})}
 // Vertebral column, ribs around the body cavity (right side only: the left ones go with the opened body
 // wall, as in a dissection), neural and haemal spines.
 {const x0=-.285,x1=.31,n=mobile?26:40;for(let i=0;i<n;i++){const x=x0+(x1-x0)*(i+.5)/n,y=spineY(x),l=(x1-x0)/n*.42,r=.0075*(1-.45*smooth(.1,.3,x)),v=[x,y,zc];
   b.tube('skeleton','bone',[[x-l,y,zc],v,[x+l,y,zc]],t=>r*(1-.25*Math.sin(Math.PI*t)),{samples:6,radial:mobile?8:12,ends:false,color:hex(0xe9e2d2)});
   b.tube('skeleton','bone',[[x,y+r,zc],B.ring(x+.012,0,.5),B.ring(x+.03,0,.86)],t=>.0021*(1-.6*t),{samples:8,radial:5,color:hex(0xe6dfcd)});
   if(x>cavity[0]&&x<cavity[1]-.01){for(const side of[-1])b.tube('skeleton','bone',[[x,y-r*.6,zc+side*.004],B.ring(x+.008,side*1.35,.8),B.ring(x+.016,side*1.9,.84),B.ring(x+.024,side*2.5,.8)],t=>.002*(1-.5*t),{samples:mobile?10:16,radial:5,color:hex(0xe8e0cf)})}
   else if(x>=cavity[1]-.01)b.tube('skeleton','bone',[[x,y-r,zc],B.ring(x+.012,Math.PI,.4),B.ring(x+.03,Math.PI,.84)],t=>.0021*(1-.6*t),{samples:8,radial:5,color:hex(0xe6dfcd)})}}
 // Brain and spinal cord.
 {const x0=-.425;[[0,.012,.008],[.014,.014,.011],[.03,.015,.012],[.045,.011,.009],[.058,.009,.007]].forEach(([dx,rx,ry],i)=>{const x=x0+dx,c=[x,B.mid(x)+B.semi(x)*.32,zc];for(const side of i<3?[1,-1]:[0])b.blob('brain','nerve',[c[0],c[1],c[2]+side*.007],[rx,ry,rx*.75],{nu:18,nv:12,color:mix(hex(0xf1e3d6),hex(0xe2c9b8),i/5)})});
  const pts=[];for(let i=0;i<=40;i++){const x=-.36+i/40*.66;pts.push([x,spineY(x)+.011,zc])}b.tube('brain','nerve',pts,.0032,{samples:80,radial:6,color:hex(0xf2e8dc)})}
 // Gills: four arches on each side under the operculum, each with two rows of red filaments.
 for(const side of[1,-1])for(let i=0;i<4;i++){const x=-.352+i*.012,arc=u=>{const a=.55+u*(Math.PI-1.05);return B.ring(x-.008*Math.sin(Math.PI*u),side*a,.55)};
  b.tube('gills','bone',Array.from({length:13},(_,k)=>arc(k/12)),.0026,{samples:30,radial:6,color:hex(0xe9d9cc)});
  const nf=mobile?10:22;for(let k=0;k<nf;k++){const u=(k+.5)/nf,p=arc(u),a=.55+u*(Math.PI-1.05);for(const row of[-1,1]){const dir=norm([.55+.25*row,Math.cos(a)*.25,side*Math.sin(a)*.8]);
   b.strand('gills','mucosa',[p,madd(madd(p,dir,.009),[row*.003,0,0],1),madd(p,dir,.018)],.0026,.0013,{seg:3,radial:4,color:t=>mix(hex(0xc2343a),hex(0x9e1f2a),t)})}}}
 // Heart (sinus venosus, atrium, ventricle, bulbus arteriosus) and the main arteries.
 const hp=(x,v)=>[x,B.mid(x)+B.semi(x)*v,zc];
 b.blob('heart','muscle',hp(-.272,-.62),[.015,.013,.013],{nu:24,nv:14,disp:(d,p)=>1+.06*noise3(p[0]*90,p[1]*90,p[2]*90),color:hex(0x9e2d33)});
 b.blob('heart','muscle',hp(-.258,-.48),[.014,.011,.014],{nu:22,nv:12,color:hex(0x7a1f2c)});
 b.blob('heart','muscle',hp(-.244,-.52),[.007,.008,.012],{nu:16,nv:10,color:hex(0x5e1a26)});
 b.tube('heart','organ',[hp(-.285,-.6),hp(-.297,-.54),hp(-.307,-.48)],t=>.007-.0025*t,{samples:12,radial:12,color:hex(0xe8c8c0)});
 {b.tube('blood-vessels','blood',[hp(-.307,-.48),hp(-.322,-.4),hp(-.35,-.32)],.003,{samples:16,radial:8,color:hex(0xb33a3f)});
  for(let i=0;i<4;i++)for(const side of[1,-1]){const x=-.352+i*.012;b.tube('blood-vessels','blood',[hp(-.315-.006*i,-.44+.04*i),B.ring(x-.006,side*2.3,.45),B.ring(x-.004,side*1.6,.5)],.0016,{samples:10,radial:5,color:hex(0xb33a3f)})}
  const da=[];for(let i=0;i<=40;i++){const x=-.33+i/40*.62;da.push([x,spineY(x)-.012,zc])}b.tube('blood-vessels','blood',da,t=>.003*(1-.4*t),{samples:80,radial:8,color:hex(0xa8343a)});
  const pcv=[];for(let i=0;i<=24;i++){const x=-.255+i/24*.36;pcv.push([x,spineY(x)-.02,zc+.004])}b.tube('blood-vessels','blood',pcv,.0026,{samples:48,radial:6,color:hex(0x5b2433)})}
 // Swim bladder: anterior and posterior chambers (physostome: pneumatic duct to the oesophagus).
 const sb=(x,v,r,taper)=>b.blob('swim-bladder','membrane',hp(x,v),r,{nu:40,nv:24,disp:(d)=>1-taper*smooth(0,1,d[0])*.35,color:(p)=>mix(hex(0xd3d6d2),hex(0xaab3b5),.5+.5*fbm(p[0]*40,p[1]*40,p[2]*40,3))});
 sb(-.155,.18,[.058,.039,.036],0);sb(-.005,.12,[.084,.034,.03],1);
 b.tube('swim-bladder','membrane',[hp(-.085,.1),hp(-.1,-.05),hp(-.17,-.2),hp(-.235,-.25)],.002,{samples:20,radial:6,color:hex(0xe2e2dc)});
 // Kidney along the roof of the body cavity, with ureters to the urogenital pore.
 {const pts=[];for(let i=0;i<=30;i++){const x=-.255+i/30*.385;pts.push([x,spineY(x)-.024,zc])}b.tube('kidney','organ',pts,t=>.0085*(1+.6*Math.exp(-((t-.05)**2)/.004))*(1-.4*smooth(.7,1,t)),{samples:60,radial:12,disp:(t,a)=>.0012*noise3(t*40,a,1),color:(t,a,p)=>mix(hex(0x6e2027),hex(0x8a2f33),.5+.5*fbm(p[0]*60,p[1]*60,p[2]*60,3))});
  b.tube('kidney','organ',[[.128,spineY(.128)-.026,zc],hp(.142,-.1),hp(.148,-.6),hp(.15,-.86)],.0022,{samples:16,radial:6,color:hex(0xdcc8b4)})}
 // Gut: short oesophagus, no true stomach (cyprinids), long looped intestine ending at the anus.
 {const g=(x,v,w)=>B.at(x,v,w);const ip=[g(-.34,-.05,0),g(-.3,-.12,0),g(-.25,-.2,.08),g(-.2,-.22,.3),g(-.08,-.26,.42),g(.05,-.3,.36),g(.09,-.48,.2),g(.03,-.52,.42),g(-.1,-.46,.45),g(-.2,-.52,.32),g(-.215,-.7,.1),g(-.12,-.74,.36),g(0,-.72,.38),g(.08,-.7,.25),g(.11,-.78,0),g(.124,-.88,0)];
  b.tube('intestine','organ',ip,.0085,{samples:mobile?140:260,radial:mobile?10:14,disp:(t,a)=>.001*Math.sin(t*300),color:(t,a,p)=>mix(hex(0xd9b3a0),hex(0xb88e7c),.5+.5*fbm(p[0]*50,p[1]*50,p[2]*50,3))});
  b.blob('intestine','muscle',g(-.34,-.05,0),[.014,.014,.018],{nu:18,nv:10,color:hex(0xcf9f8c)})}
 // Hepatopancreas: diffuse lobes among the loops; gall bladder.
 for(const [x,v,w,r] of [[-.22,-.36,0,[.028,.02,.028]],[-.19,-.6,.15,[.032,.018,.026]],[-.05,-.58,.1,[.036,.015,.024]],[.05,-.6,-.1,[.028,.015,.022]],[-.13,-.34,-.15,[.03,.016,.022]]]){const ph=rnd()*9;
  b.blob('liver','organ',B.at(x,v,w),r,{nu:28,nv:16,disp:(d,p)=>1+.18*fbm(p[0]*40+ph,p[1]*40,p[2]*40,3),color:p=>mix(hex(0x7d3a2c),hex(0x9a4d36),.5+.5*fbm(p[0]*70,p[1]*70,p[2]*70,3))})}
 b.blob('liver','organ',B.at(-.205,-.45,.45),[.008,.006,.006],{nu:14,nv:8,color:hex(0x4f6b3a)});
 // Ovaries (female specimen assumed): paired, under the swim bladder, granular with eggs; oviduct to the pore.
 for(const side of[1,-1]){const pts=[];for(let i=0;i<=20;i++){const x=-.19+i/20*.3;pts.push(B.at(x,-.1-.08*Math.sin(i/20*Math.PI),side*.38))}
  b.tube('gonads','organ',pts,t=>.015*Math.sin(Math.PI*Math.min(1,t*1.15))**.6,{samples:50,radial:14,disp:(t,a)=>.0016*noise3(t*200,Math.cos(a)*4,Math.sin(a)*4),color:(t,a,p)=>mix(hex(0xe2b25a),hex(0xc98f3c),.5+.5*noise3(p[0]*400,p[1]*400,p[2]*400))})}
 b.tube('gonads','organ',[B.at(.11,-.2,0),B.at(.135,-.5,0),B.at(.138,-.86,0)],.0022,{samples:12,radial:6,color:hex(0xd9b070)});
}

// ---------- Amphibian: black-spotted pond frog (Pelophylax nigromaculatus), male ----------
export function frog(b){
 const mobile=b.mobile,rnd=rand(9);
 const B=bodyShape([[-.5,.17,.13,.03],[-.45,.2,.1,.08],[-.4,.21,.075,.11],[-.35,.215,.05,.13],[-.3,.21,.02,.145],[-.25,.205,0,.155],[-.2,.2,-.01,.16],[-.15,.195,-.02,.165],[-.1,.185,-.03,.165],[-.05,.175,-.04,.16],[0,.165,-.045,.157],[.05,.15,-.05,.15],[.1,.135,-.055,.135],[.15,.115,-.055,.11],[.2,.09,-.04,.07]],-.01);
 const zc=B.zc,P=(x,v,w)=>B.at(x,v,w),spineY=x=>B.mid(x)+B.semi(x)*.62;
 // Body wall behind the organs: abdominal muscles lining the far side.
 {const x0=-.27,x1=.17,nx=mobile?40:80,ny=mobile?20:36;b.grid('muscles','muscle',ny+1,nx+1,(r,c)=>{const x=x0+(x1-x0)*c/nx,v=-.72+1.3*r/ny;return P(x,v,-.68)},{color:(r,c,p)=>{const x=p[0],y=p[1],v=(y-B.mid(x))/B.semi(x),band=Math.exp(-((Math.sin(x*70)*.5)**2)/.02)*.12;return shade(mix(hex(0xd8a291),hex(0xc0857a),.5+.5*fbm(x*30,y*30,3,3)),1-band-.15*smooth(.2,.6,v))},outward:()=>[0,0,1]})}
 // Skeleton: nine vertebrae and the urostyle (no ribs), long ilia of the pelvic girdle, shoulder girdle.
 {for(let i=0;i<9;i++){const x=-.3+i*.042,y=spineY(x);b.blob('skeleton','bone',[x,y,zc],[.017,.009,.01],{nu:mobile?12:18,nv:mobile?8:10,color:hex(0xece5d6)});
   for(const side of[1,-1])b.tube('skeleton','bone',[[x,y,zc],[x+.004,y+.004,zc+side*.025],[x+.008,y-.004,zc+side*(i===8?.05:.04)]],.0035,{samples:6,radial:6,color:hex(0xe6dfce)})}
  const ys=spineY(.08);b.tube('skeleton','bone',[[.06,ys,zc],[.12,ys-.012,zc],[.19,ys-.03,zc]],t=>.006*(1-.6*t),{samples:16,radial:10,color:hex(0xe9e1d0)});
  for(const side of[1,-1]){b.tube('skeleton','bone',[[.04,spineY(.04),zc+side*.05],P(.1,.35,side*.32),P(.17,.05,side*.32)],.0045,{samples:20,radial:8,color:hex(0xe8e0cf)});
   b.tube('skeleton','bone',[P(-.27,.75,side*.25),P(-.25,.3,side*.62),P(-.24,-.3,side*.45),P(-.235,-.62,side*.1)],.0042,{samples:22,radial:8,color:hex(0xe8e0cf)})}
}
 // Brain and spinal cord.
 {[[-.42,.006,.005],[-.4,.01,.008],[-.375,.012,.01],[-.35,.009,.007],[-.33,.006,.005]].forEach(([x,rx,ry],i)=>{for(const side of i<3?[1,-1]:[0])b.blob('brain','nerve',[x,B.mid(x)+B.semi(x)*.55,zc+side*.008],[rx,ry,rx*.8],{nu:16,nv:10,color:mix(hex(0xf1e3d6),hex(0xe2c9b8),i/5)})});
  const pts=[];for(let i=0;i<=20;i++){const x=-.32+i/20*.4;pts.push([x,spineY(x)+.012,zc])}b.tube('brain','nerve',pts,.003,{samples:40,radial:6,color:hex(0xf2e8dc)})}
 // Tongue: attached at the front of the mouth floor, free at the back.
 b.tube('tongue','mucosa',[P(-.47,-.3,0),P(-.42,-.45,0),P(-.36,-.4,0)],t=>.012*(1-.3*t),{samples:20,radial:14,disp:(t,a)=>.002*noise3(t*20,a*2,1),color:(t,a,p)=>mix(hex(0xe2a3a0),hex(0xc98584),t)});
 // Heart: two atria, one ventricle, conus arteriosus and the arches.
 b.blob('heart','muscle',P(-.235,-.62,0),[.018,.022,.02],{nu:26,nv:16,disp:(d,p)=>1+.05*noise3(p[0]*80,p[1]*80,p[2]*80),color:hex(0xa53337)});
 for(const side of[1,-1])b.blob('heart','muscle',P(-.255,-.42,side*.12),[.016,.014,.015],{nu:20,nv:12,color:hex(0x6f1d2a)});
 b.tube('heart','organ',[P(-.235,-.5,.08),P(-.26,-.3,.04),P(-.28,-.2,0)],.006,{samples:12,radial:10,color:hex(0xd9a29c)});
 for(const side of[1,-1])b.tube('blood-vessels','blood',[P(-.28,-.2,0),P(-.29,.0,side*.25),P(-.25,.35,side*.25),P(-.2,.45,side*.05),P(0,.45,0),P(.12,.3,0)],t=>.004*(1-.3*t),{samples:40,radial:8,color:hex(0xb33a3f)});
 for(const side of[1,-1])b.tube('blood-vessels','blood',[P(-.29,0,side*.25),P(-.25,.12,side*.42),P(-.18,.18,side*.5)],.0028,{samples:14,radial:6,color:hex(0xb33a3f)});
 b.tube('blood-vessels','blood',[P(.1,-.3,.0),P(-.05,-.35,.05),P(-.2,-.45,.05),P(-.245,-.5,.02)],.004,{samples:30,radial:8,color:hex(0x5b2433)});
 b.blob('blood-vessels','organ',P(-.03,-.15,-.15),[.009,.009,.009],{nu:14,nv:8,color:hex(0x7d1f2a)});
 // Lungs: paired thin-walled sacs with a honeycomb lining.
 for(const side of[1,-1]){const ph=rnd()*9;b.blob('lungs','membrane',P(-.17,.18,side*.38),[.064,.038,.04],{nu:36,nv:22,disp:(d,p)=>{const c=Math.abs(Math.sin(p[0]*260)*Math.sin(p[1]*260)*Math.sin(p[2]*260));return 1+.03*c+.05*fbm(p[0]*30+ph,p[1]*30,p[2]*30,2)-.25*smooth(0,1,d[0])},color:(p)=>mix(hex(0xe2a6a0),hex(0xc97d7d),.5+.5*Math.sin(p[0]*260)*Math.sin(p[2]*260))});
  b.tube('lungs','membrane',[P(-.29,-.05,0),P(-.26,.05,side*.15),P(-.235,.15,side*.3)],.003,{samples:12,radial:6,color:hex(0xe0b7ae)})}
 // Liver (three lobes) with the gall bladder; pancreas; stomach, small and large intestine to the cloaca.
 for(const [x,v,w,r] of [[-.19,-.55,.42,[.06,.03,.05]],[-.19,-.55,-.42,[.055,.03,.05]],[-.2,-.6,0,[.035,.028,.04]]]){const ph=rnd()*9;b.blob('liver','organ',P(x,v,w),r,{nu:30,nv:18,disp:(d,p)=>1+.08*fbm(p[0]*30+ph,p[1]*30,p[2]*30,3)-.2*Math.max(0,d[1]),color:p=>mix(hex(0x6e2f2a),hex(0x8a3e33),.5+.5*fbm(p[0]*60,p[1]*60,p[2]*60,3))})}
 b.blob('liver','organ',P(-.17,-.45,.02),[.009,.009,.009],{nu:14,nv:8,color:hex(0x3f6b3a)});
 b.blob('liver','organ',P(-.02,-.3,-.2),[.012,.008,.01],{nu:14,nv:8,color:hex(0xe6c9a2)});
 b.tube('stomach','muscle',[P(-.3,.0,.05),P(-.25,-.05,.25),P(-.18,-.1,.42),P(-.1,-.2,.45),P(-.06,-.36,.35),P(-.08,-.48,.15)],t=>.02*(1-.35*t),{samples:40,radial:18,disp:(t,a)=>.0018*noise3(t*30,a*3,2),color:(t,a,p)=>mix(hex(0xead8cc),hex(0xd8bfae),.5+.5*fbm(p[0]*40,p[1]*40,p[2]*40,3))});
 {const g=P,ip=[g(-.08,-.48,.15),g(-.12,-.55,-.05),g(-.06,-.62,-.3),g(.0,-.5,-.15),g(-.02,-.38,.15),g(.04,-.42,.35),g(.07,-.55,.2),g(.03,-.66,0),g(.08,-.6,-.25),g(.1,-.45,-.1)];
  b.tube('intestine','organ',ip,.007,{samples:mobile?80:150,radial:mobile?10:12,color:(t,a,p)=>mix(hex(0xe7c8b8),hex(0xcfa694),.5+.5*fbm(p[0]*50,p[1]*50,p[2]*50,3))});
  b.tube('intestine','organ',[g(.1,-.45,-.1),g(.13,-.3,0),g(.17,-.15,0),g(.2,-.1,0)],t=>.011+.004*t,{samples:24,radial:14,color:(t,a,p)=>mix(hex(0xd9b8a8),hex(0xbf9585),t)});
  b.blob('intestine','muscle',P(.195,-.12,0),[.01,.012,.012],{nu:14,nv:10,color:hex(0xb7867a)})}
 // Kidneys on the dorsal wall, fat bodies, testes (male), urinary bladder.
 for(const side of[1,-1]){b.blob('kidneys','organ',P(.06,.28,side*.17),[.065,.016,.022],{nu:28,nv:14,disp:(d,p)=>1+.06*fbm(p[0]*80,p[1]*80,p[2]*80,3),color:p=>mix(hex(0x6a2026),hex(0x8a2f33),.5+.5*fbm(p[0]*60,p[1]*60,p[2]*60,3))});
  b.tube('kidneys','organ',[P(.12,.25,side*.17),P(.16,.0,side*.08),P(.19,-.1,side*.02)],.0025,{samples:14,radial:6,color:hex(0xdcc8b4)});
  b.blob('testes','organ',P(.01,.15,side*.2),[.022,.012,.014],{nu:20,nv:12,color:hex(0xeadfbf)});
  for(let k=0;k<4;k++){const a=k/3;b.tube('fat-bodies','organ',[P(-.02,.12,side*(.22+a*.08)),P(-.06,.05+a*.08,side*(.3+a*.1)),P(-.1,-.02+a*.12,side*(.36+a*.08))],t=>.007*(1-.4*t),{samples:12,radial:8,color:hex(0xf0c45a)})}}
 b.blob('kidneys','membrane',P(.16,-.3,0),[.025,.02,.035],{nu:22,nv:14,disp:(d)=>1-.15*Math.abs(d[2]),color:hex(0xe9dfd2)});
}

// ---------- Reptile: Japanese grass lizard (Takydromus tachydromoides) ----------
// Scan frame: snout at x −0.5, trunk to about −0.17, then a very long tail; the trunk bends towards −z.
export function lizard(b){
 const mobile=b.mobile,rnd=rand(21);
 const B=bodyShape([[-.5,.0,-.005,.005,-.047],[-.48,.012,-.006,.012,-.047],[-.45,.02,-.006,.019,-.048],[-.42,.025,-.006,.017,-.052],[-.4,.0275,-.006,.016,-.055],[-.35,.0325,-.006,.021,-.062],[-.3,.03,-.0065,.022,-.057],[-.25,.025,-.009,.02,-.04],[-.2,.016,-.01,.016,-.027],[-.15,.01,-.01,.01,-.015]]);
 const P=(x,v,w)=>B.at(x,v,w),spineY=x=>B.mid(x)+B.semi(x)*.6;
 // Far body wall: intercostal muscles between the ribs.
 {const x0=-.415,x1=-.19,nx=mobile?40:80,ny=mobile?12:22;b.grid('muscles','muscle',ny+1,nx+1,(r,c)=>{const x=x0+(x1-x0)*c/nx,v=-.72+1.3*r/ny;return P(x,v,-.68)},{color:(r,c,p)=>{const x=p[0],y=p[1],band=Math.exp(-((Math.sin(x*520))**2)/.05)*.2;return shade(mix(hex(0xd6a493),hex(0xbf8778),.5+.5*fbm(x*200,y*200,3,3)),1-band)},outward:()=>[0,0,1]})}
 // Skeleton: vertebrae with ribs along the trunk (ribs move to ventilate the lungs), and the start of the tail.
 {const n=mobile?24:40;for(let i=0;i<n;i++){const x=-.43+i/n*.26,y=spineY(x);b.blob('skeleton','bone',[x,y,B.zcAt(x)],[.0042,.0017,.0018],{nu:10,nv:6,color:hex(0xece5d6)});
   if(x>-.4&&x<-.2)b.tube('skeleton','bone',[[x,y,B.zcAt(x)],B.ring(x+.002,-1.3,.8),B.ring(x+.004,-2.0,.82),B.ring(x+.006,-2.6,.75)],.0007,{samples:mobile?8:12,radial:4,color:hex(0xe8e0cf)})}}
 // Brain, tongue.
 {for(const [x,r] of [[-.462,.003],[-.455,.004],[-.447,.0035],[-.44,.003]])b.blob('brain','nerve',[x,B.mid(x)+B.semi(x)*.45,B.zcAt(x)],[r,r*.8,r*.9],{nu:12,nv:8,color:hex(0xf0e2d4)});
  const pts=[];for(let i=0;i<=20;i++){const x=-.435+i/20*.3;pts.push([x,spineY(x)+.0025,B.zcAt(x)])}b.tube('brain','nerve',pts,.0009,{samples:40,radial:5,color:hex(0xf2e8dc)})}
 for(const side of[1,-1])b.tube('tongue','mucosa',[P(-.465,-.5,0),P(-.485,-.55,side*.08),P(-.494,-.55,side*.25)],t=>.0018*(1-.5*t),{samples:12,radial:8,color:hex(0xd98d8d)});
 b.tube('tongue','mucosa',[P(-.44,-.5,0),P(-.465,-.5,0)],.0022,{samples:8,radial:8,color:hex(0xd98d8d)});
 // Trachea and lungs: simple sacs with internal folds.
 b.tube('lungs','cartilage',[P(-.45,-.3,0),P(-.42,-.25,0),P(-.395,-.1,0)],.0012,{samples:16,radial:6,disp:(t,a)=>.0002*Math.sin(t*120),color:hex(0xeadfd4)});
 for(const side of[1,-1])b.blob('lungs','membrane',P(-.36,.2,side*.45),[.03,.009,.009],{nu:28,nv:16,disp:(d,p)=>1+.06*Math.abs(Math.sin(p[0]*900)*Math.sin(p[1]*900))-.2*smooth(0,1,d[0]),color:p=>mix(hex(0xe6aaa4),hex(0xcc8580),.5+.5*Math.sin(p[0]*900)*Math.sin(p[2]*900))});
 // Heart: two atria, a ventricle partly divided by a septum; aortic arches.
 b.blob('heart','muscle',P(-.405,-.45,0),[.006,.006,.006],{nu:18,nv:12,color:hex(0xa53337)});
 for(const side of[1,-1])b.blob('heart','muscle',P(-.412,-.2,side*.3),[.004,.0035,.004],{nu:14,nv:8,color:hex(0x6f1d2a)});
 for(const side of[1,-1])b.tube('blood-vessels','blood',[P(-.41,-.2,0),P(-.42,.1,side*.3),P(-.4,.35,side*.15),P(-.37,.4,0),P(-.2,.4,0)],t=>.0011*(1-.3*t),{samples:30,radial:6,color:hex(0xb33a3f)});
 b.tube('blood-vessels','blood',[P(-.2,-.2,.1),P(-.3,-.3,.1),P(-.4,-.45,.05)],.0011,{samples:20,radial:6,color:hex(0x5b2433)});
 // Liver, stomach, small and large intestine, cloaca.
 {const ph=rnd()*9;b.blob('liver','organ',P(-.355,-.35,0),[.028,.008,.012],{nu:28,nv:16,disp:(d,p)=>1+.08*fbm(p[0]*200+ph,p[1]*200,p[2]*200,3),color:p=>mix(hex(0x6e2f2a),hex(0x8a3e33),.5+.5*fbm(p[0]*300,p[1]*300,p[2]*300,3))})}
 b.blob('liver','organ',P(-.34,-.4,.4),[.003,.003,.003],{nu:10,nv:6,color:hex(0x3f6b3a)});
 b.tube('stomach','muscle',[P(-.4,-.05,.2),P(-.36,-.1,.35),P(-.31,-.25,.35),P(-.28,-.35,.2)],t=>.0045*(1-.3*t),{samples:30,radial:12,color:(t,a,p)=>mix(hex(0xead8cc),hex(0xd8bfae),.5+.5*fbm(p[0]*200,p[1]*200,p[2]*200,3))});
 b.tube('intestine','organ',[P(-.28,-.35,.2),P(-.27,-.55,-.1),P(-.255,-.4,.3),P(-.24,-.55,0),P(-.23,-.4,-.3),P(-.215,-.5,.1),P(-.2,-.3,0),P(-.185,-.25,0)],t=>.0026+.0012*smooth(.75,1,t),{samples:mobile?60:110,radial:mobile?8:10,color:(t,a,p)=>mix(hex(0xe7c8b8),hex(0xc9a090),t)});
 b.blob('intestine','muscle',P(-.18,-.3,0),[.003,.003,.003],{nu:10,nv:6,color:hex(0xb7867a)});
 // Kidneys in the pelvis, gonads, fat bodies.
 for(const side of[1,-1]){b.blob('kidneys','organ',P(-.205,.2,side*.35),[.01,.003,.003],{nu:16,nv:8,color:hex(0x7a2a2e)});
  b.blob('gonads','organ',P(-.245,.15,side*.38),[.005,.003,.003],{nu:14,nv:8,color:hex(0xeadfbf)});
  b.blob('fat-bodies','organ',P(-.23,-.4,side*.5),[.014,.004,.004],{nu:16,nv:8,disp:(d,p)=>1+.15*fbm(p[0]*400,p[1]*400,p[2]*400,2),color:hex(0xf0c45a)})}
}

// ---------- Bird: peregrine falcon (Falco peregrinus), taxidermy mount ----------
// The bird stands upright: the trunk axis runs from the base of the neck (−0.12, 0.28) down to the vent
// (0.06, −0.26). T(u,v,w): u along the trunk (−1 neck … +1 vent), v from back (−1) to breast (+1),
// w from right (−1) to left (+1); the section narrows towards both ends.
export function falcon(b){
 const mobile=b.mobile,rnd=rand(33);
 const C=[.0,.0,0],D=norm([.316,-.949,0]),V=norm([-.949,-.316,0]),La=.28,Lb=.14,Lc=.11;
 const T=(u,v,w)=>{const s=Math.sqrt(Math.max(.05,1-u*u*.85));return[C[0]+D[0]*u*La+V[0]*v*Lb*s,C[1]+D[1]*u*La+V[1]*v*Lb*s,w*Lc*s]};
 // Head frame: centre of the skull and direction of the beak.
 const H=[-.13,.39,0];
 // Keel (sternum), furcula and coracoids: the anchor of the flight muscles.
 {const pts=[];for(let i=0;i<=16;i++){const u=-.7+i/16*1.25;pts.push(T(u,1.05-.25*u*u,0))}
  b.tube('skeleton','bone',pts,t=>.004,{samples:40,radial:8,color:hex(0xece5d6)});
  b.grid('skeleton','bone',2,17,(r,c)=>{const u=-.7+c/16*1.25;return T(u,r?1.05-.25*u*u:.55,0)},{color:()=>hex(0xe8e0cf),outward:()=>[0,0,1]});
  for(const side of[1,-1])b.tube('skeleton','bone',[T(-.95,.75,0),T(-.85,.3,side*.55),T(-.75,-.4,side*.7)],.0035,{samples:20,radial:8,color:hex(0xe8e0cf)});
  const sp=[];for(let i=0;i<=24;i++){const u=-1.05+i/24*2.0;sp.push(T(u,-.85,0))}for(const p of sp)b.blob('skeleton','bone',p,[.009,.009,.01],{nu:12,nv:8,color:hex(0xece5d6)});
  for(let k=0;k<6;k++){const u=-.55+k*.16;b.tube('skeleton','bone',[T(u,-.85,0),T(u+.04,-.2,-.85),T(u+.08,.5,-.75),T(u+.06,.95,-.2)],.002,{samples:16,radial:5,color:hex(0xe6dfce)})}}
 // Pectoral (flight) muscle on the far side of the keel, and the supracoracoideus beneath it.
 b.blob('flight-muscles','muscle',T(-.15,.55,-.42),[.13,.06,.05],{nu:36,nv:20,xf:null,disp:(d,p)=>1+.03*Math.sin(p[1]*300+p[0]*200),color:p=>mix(hex(0x8e3b37),hex(0x6f2a2a),.5+.5*Math.sin(p[1]*300+p[0]*200))});
 b.blob('flight-muscles','muscle',T(-.2,.75,-.2),[.09,.03,.03],{nu:24,nv:14,color:hex(0x7a302e)});
 // Trachea with rings, syrinx at the base, and the lungs: small, spongy and fixed against the ribs.
 {const pts=[[-.2,.36,0],[-.17,.31,0],T(-1.1,.3,0),T(-.85,.15,0)];b.tube('trachea-syrinx','cartilage',pts,.0055,{samples:40,radial:10,disp:(t,a)=>.0009*Math.cos(t*160),color:(t,a,p)=>mix(hex(0xf0e6da),hex(0xd8cbbb),.5+.5*Math.cos(t*160))});
  b.blob('trachea-syrinx','cartilage',T(-.85,.15,0),[.011,.009,.012],{nu:16,nv:10,color:hex(0xe2d6c6)});
  for(const side of[1,-1]){b.tube('trachea-syrinx','cartilage',[T(-.85,.15,0),T(-.75,0,side*.25),T(-.6,-.35,side*.45)],.0035,{samples:14,radial:8,color:hex(0xe0d2c2)});
   b.blob('lungs','organ',T(-.45,-.55,side*.5),[.07,.035,.03],{nu:30,nv:18,disp:(d,p)=>1+.05*fbm(p[0]*150,p[1]*150,p[2]*150,3)+.04*Math.max(0,-d[1]),color:p=>mix(hex(0xd9767a),hex(0xb85558),.5+.5*fbm(p[0]*200,p[1]*200,p[2]*200,3))})}}
 // Air sacs: thin transparent-looking membranes that keep air flowing one way through the lungs.
 for(const [u,v,w,r] of [[-.95,.3,.45,[.024,.02,.02]],[-.8,.55,.0,[.028,.024,.03]],[-.1,0,.62,[.048,.032,.02]],[.2,-.1,.64,[.048,.032,.02]],[.55,-.2,.52,[.056,.036,.024]]])for(const side of[1,-1])b.blob('air-sacs','membrane',T(u,v,side*w),r,{nu:24,nv:14,disp:(d,p)=>1+.04*fbm(p[0]*90,p[1]*90,p[2]*90,2),color:hex(0xdfe6e8)});
 // Heart: four chambers (two atria, two ventricles); right aortic arch.
 b.blob('heart','muscle',T(-.55,.4,0),[.035,.028,.03],{nu:28,nv:18,disp:(d,p)=>1+.05*noise3(p[0]*80,p[1]*80,p[2]*80)-.18*Math.max(0,d[1]),xf:null,color:p=>mix(hex(0xa5333a),hex(0x86242c),.5+.5*fbm(p[0]*90,p[1]*90,p[2]*90,2))});
 for(const side of[1,-1])b.blob('heart','muscle',T(-.72,.3,side*.28),[.018,.016,.018],{nu:18,nv:12,color:hex(0x6f1d2a)});
 b.tube('blood-vessels','blood',[T(-.68,.35,0),T(-.85,.3,-.15),T(-.85,-.2,-.25),T(-.6,-.65,0),T(.6,-.7,0)],t=>.006*(1-.3*t),{samples:50,radial:10,color:hex(0xb33a3f)});
 for(const side of[1,-1])b.tube('blood-vessels','blood',[T(-.85,.3,-.15),T(-1.05,.4,side*.35),[-.17,.3,side*.04]],.003,{samples:20,radial:6,color:hex(0xb33a3f)});
 b.tube('blood-vessels','blood',[T(.4,-.5,.1),T(0,-.4,.1),T(-.5,.1,.15)],.004,{samples:30,radial:8,color:hex(0x5b2433)});
 // Oesophagus with crop, proventriculus (glandular stomach), gizzard, intestine with paired caeca, cloaca.
 {b.tube('crop-oesophagus','organ',[[-.21,.37,.02],[-.18,.3,.03],T(-1.0,.65,.25),T(-.9,.5,.3),T(-.7,.2,.15),T(-.3,-.15,.1)],t=>.008+.012*Math.exp(-((t-.48)**2)/.012),{samples:50,radial:14,color:(t,a,p)=>mix(hex(0xe5cfc0),hex(0xd4b6a2),.5+.5*fbm(p[0]*90,p[1]*90,p[2]*90,3))});
  b.tube('stomach','organ',[T(-.3,-.15,.1),T(-.1,-.15,.15),T(.05,-.1,.15)],t=>.013,{samples:20,radial:14,color:hex(0xd6b19d)});
  b.blob('stomach','muscle',T(.15,.05,.2),[.05,.04,.04],{nu:28,nv:18,disp:(d,p)=>1+.04*Math.sin(Math.atan2(d[2],d[0])*6),color:p=>mix(hex(0x9b4a43),hex(0xd8c3b0),smooth(.4,.9,Math.abs(p[2]-.0)/.04))});
  const ip=[T(.2,.25,.1),T(.35,.45,.3),T(.5,.3,-.1),T(.4,.1,-.4),T(.25,.25,-.2),T(.4,.5,0),T(.6,.4,.3),T(.7,.2,.1),T(.75,0,0),T(.9,-.1,0)];
  b.tube('intestine','organ',ip,.0075,{samples:mobile?90:160,radial:mobile?10:12,color:(t,a,p)=>mix(hex(0xe7c8b8),hex(0xcfa694),.5+.5*fbm(p[0]*90,p[1]*90,p[2]*90,3))});
  for(const side of[1,-1])b.tube('intestine','organ',[T(.75,0,0),T(.62,.15,side*.3),T(.55,.3,side*.35)],t=>.004*(1-.4*t),{samples:12,radial:8,color:hex(0xd9b8a8)});
  b.blob('intestine','muscle',T(.95,-.1,0),[.015,.015,.017],{nu:16,nv:10,color:hex(0xb7867a)})}
 // Liver (two lobes) around the heart, kidneys pressed into the pelvis, single left ovary.
 for(const side of[1,-1]){const ph=rnd()*9;b.blob('liver','organ',T(-.25,.3,side*.55),[.07,.04,.035],{nu:28,nv:16,disp:(d,p)=>1+.07*fbm(p[0]*90+ph,p[1]*90,p[2]*90,3),color:p=>mix(hex(0x6e2f2a),hex(0x8a3e33),.5+.5*fbm(p[0]*120,p[1]*120,p[2]*120,3))});
  b.blob('kidneys','organ',T(.45,-.75,side*.35),[.08,.022,.025],{nu:28,nv:14,disp:(d,p)=>1+.12*Math.cos(d[0]*9),color:p=>mix(hex(0x6a2026),hex(0x8a2f33),.5+.5*fbm(p[0]*120,p[1]*120,p[2]*120,3))});
  b.tube('kidneys','organ',[T(.6,-.7,side*.3),T(.85,-.4,side*.15),T(.95,-.15,side*.05)],.0025,{samples:14,radial:6,color:hex(0xdcc8b4)})}
 b.blob('gonads','organ',T(.15,-.65,.3),[.03,.012,.015],{nu:20,nv:12,disp:(d,p)=>1+.2*noise3(p[0]*300,p[1]*300,p[2]*300),color:hex(0xe8c58a)});
 b.tube('gonads','organ',[T(.2,-.6,.35),T(.55,-.3,.35),T(.9,-.15,.1)],.003,{samples:20,radial:6,disp:(t,a)=>.0012*Math.sin(t*80),color:hex(0xe2c8a0)});
 // Brain: large cerebral hemispheres, optic lobes and cerebellum.
 {for(const side of[1,-1])b.blob('brain','nerve',[H[0]+.01,H[1]+.01,side*.016],[.026,.02,.017],{nu:20,nv:12,color:hex(0xf1e3d6)});
  for(const side of[1,-1])b.blob('brain','nerve',[H[0]+.03,H[1]-.015,side*.022],[.012,.011,.01],{nu:14,nv:8,color:hex(0xe8d6c6)});
  b.blob('brain','nerve',[H[0]+.045,H[1]+.0,0],[.013,.014,.014],{nu:14,nv:8,color:hex(0xe2c9b8)});
  const pts=[[H[0]+.05,H[1]-.02,0],[-.1,.3,0],T(-1.0,-.85,0),T(1.0,-.85,0)];b.tube('brain','nerve',pts,.0035,{samples:60,radial:6,color:hex(0xf2e8dc)})}
}
