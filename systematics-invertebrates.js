// Invertebrates without a usable specimen scan: earthworm (Annelida), planarian (Platyhelminthes),
// roundworm (Nematoda) and hydra (Cnidaria). Units are centimetres (the app rescales every model).
// Bodies are opened by a lateral window on the side facing the camera, like a dissection seen from the
// left: organ positions follow textbook dissections, while counts of repeated structures (setae,
// nephridia, gut branches) are reduced samples and colours are natural but simplified.
import {TAU,noise3,fbm,hex,mix,shade,smooth,rand,add,sub,scale,norm,cross,madd,dot,curve,bodyShape} from './systematics-geometry.js';

const gauss=(a,c,w)=>{const d=Math.atan2(Math.sin(a-c),Math.cos(a-c));return Math.exp(-((d/w)**2))};
// Dense centre line with lookup by fraction of length; parallel frames with "up" = +y and a side vector
// Z that faces the camera (+z on a spine running towards -x).
function centreLine(points,n=1600){
 const S=curve(points,n),T=[],N=[],Z=[];for(let i=0;i<=n;i++){const t=norm(sub(S[Math.min(n,i+1)],S[Math.max(0,i-1)]));let up=norm(sub([0,1,0],scale(t,t[1])));T.push(t);N.push(up);Z.push(scale(cross(t,up),-1))}
 const at=t=>{const i=Math.max(0,Math.min(n,Math.round(t*n)));return{p:S[i],T:T[i],N:N[i],Z:Z[i]}};
 const place=(t,y,z)=>{const f=at(t);return add(f.p,add(scale(f.N,y),scale(f.Z,z)))};
 return{S,at,place,spine:u=>at(u).p,sub:(t0,t1)=>u=>at(t0+u*(t1-t0)).p}
}

// ---------- Lumbricus terrestris ----------
export function earthworm(b){
 const mobile=b.mobile,rnd=rand(31),NS=150,R=.34;
 const GUT=[[1.2,.1],[2.4,.4],[4.6,.5],[6.2,.25],[9.2,.24],[11,.32],[12.6,.24],[14.2,.24],[15,.44],[16.3,.46],[16.9,.53],[18.3,.53],[19.1,.42]];
 // Lying on the ground: the straight front third is opened; the rest of the body curls away behind it.
 const line=centreLine([[4.8,0,0],[2.4,0,.04],[0,0,0],[-1.6,0,-.32],[-2.9,0,-1.3],[-3.2,0,-2.6],[-2.4,0,-3.5],[-.9,0,-3.7]]);
 const segOf=t=>t*NS,inSeg=t=>{const s=t*NS;return s-Math.floor(s)};
 // Radius: tapered prostomium, swollen clitellum (segments 32–37), flattened and blunt tail.
 const radius=t=>{const s=t*NS;return R*(.18+.82*smooth(0,7,s)**.7)*(1-.25*smooth(.55,1,t))*(t>.985?Math.sqrt(Math.max(.05,(1-t)/.015)):1)};
 const flat=t=>1-.28*smooth(.5,.9,t),groove=t=>{const f=inSeg(t);return Math.exp(-(((Math.min(f,1-f))/.11)**2))};
 const win={t:[.012,.205],a:[Math.PI,TAU]};
 const DORS=hex(0x5e2733),DORS2=hex(0x8a4a48),TAIL=hex(0x9a6556),VENT=hex(0xc58f7e),CLIT=hex(0xc2684a);
 const skinColor=(t,a,p)=>{const dorsal=.5+.5*Math.cos(a),s=t*NS,c=mix(VENT,mix(mix(DORS2,TAIL,smooth(.4,.95,t)),DORS,smooth(.35,.03,t)),smooth(.1,.7,dorsal));
  const g=groove(t),vessel=gauss(a,0,.09)*smooth(5,10,s)*.35;return shade(mix(mix(c,shade(c,.62),g*.6+vessel),hex(0x7a4e46),.18*smooth(.2,.8,fbm(p[0]*3,p[1]*3,p[2]*3,3)+.5)),.9+.18*fbm(p[0]*9,p[1]*9,p[2]*9,3))};
 const relief=(t,a)=>-.028*groove(t)*smooth(0,3,t*NS)+.004*fbm(t*90,Math.cos(a)*3,Math.sin(a)*3,2);
 const wall=b.loft('body-wall','cuticle',{spine:line.spine,samples:NS*(mobile?3:4),radial:mobile?30:52,fixed:true,window:win,thickness:.024,
  profile:t=>{const r=radius(t);return[r,r*flat(t)]},disp:relief,color:skinColor,innerTissue:'muscle',innerColor:()=>hex(0xc98d82),lipColor:()=>hex(0xb47a72)});
 // Muscle layers under the epidermis, only along the opened front third (they are hidden elsewhere).
 const span=[0,.26],lw={t:[win.t[0]/span[1],win.t[1]/span[1]],a:win.a},sub=line.sub(...span),T=u=>span[0]+u*(span[1]-span[0]);
 b.loft('circular-muscle','muscle',{spine:sub,samples:mobile?90:170,radial:mobile?26:44,window:lw,thickness:.03,profile:u=>{const r=radius(T(u))-.024;return[r,r*flat(T(u))]},color:(u,a,p)=>mix(hex(0xc47f78),hex(0xa9645f),.5+.5*Math.cos(TAU*segOf(T(u)))*.4),innerColor:()=>hex(0xb47068),lipColor:(u,a,p)=>mix(hex(0xc98b80),hex(0xb5736b),.5+.5*noise3(p[0]*40,p[1]*40,p[2]*40))});
 b.loft('longitudinal-muscle','muscle',{spine:sub,samples:mobile?90:170,radial:mobile?26:44,window:lw,thickness:.05,profile:u=>{const r=radius(T(u))-.054;return[r,r*flat(T(u))]},color:()=>hex(0xa9625e),innerTissue:'organ',innerColor:(u,a,p)=>mix(hex(0xd8b3a7),hex(0xc99a8f),.5+.5*fbm(p[0]*9,p[1]*9,p[2]*9,3)),lipColor:(u,a,p)=>mix(hex(0xa45d58),hex(0x8f4f4c),.5+.5*noise3(p[0]*60,p[1]*20,p[2]*60))});
 const inner=t=>radius(t)-.1;
 // Septa: thin walls between segments, kept on the far half so the organs stay in view.
 for(let s=3;s<=Math.floor(win.t[1]*NS);s+=mobile?2:1){const t=s/NS;if(t<win.t[0])continue;const g=gutR(t)+.025,o=inner(t),f=line.at(t),cols=mobile?12:20;
  b.grid('septa','membrane',2,cols+1,(r,c)=>{const a=c/cols*Math.PI,k=r?o:g;return add(f.p,add(scale(f.N,Math.cos(a)*k*flat(t)),scale(f.Z,-Math.sin(a)*k)))},{color:(r,c,p)=>mix(hex(0xe9d3c9),hex(0xd9b9ae),r),outward:()=>f.T})}
 // Digestive tube: pharynx, oesophagus with calciferous glands, crop, gizzard, intestine.
 // Gut radius (fraction of R) by segment, cosine-blended between keys so the regions join smoothly.
 function gutR(t){const s=t*NS;if(s>=19.1)return R*(.42-.07*groove(t))*(1-.25*smooth(.6,1,t));let k=0;while(k<GUT.length-2&&s>GUT[k+1][0])k++;const [s0,r0]=GUT[k],[s1,r1]=GUT[k+1],u=Math.max(0,Math.min(1,(s-s0)/(s1-s0)));return R*(r0+(r1-r0)*(.5-.5*Math.cos(Math.PI*u)))}
 const gutY=t=>-.02*R;
 const gutTube=(part,tissue,t0,t1,n,color,radial=16)=>b.tube(part,tissue,Array.from({length:n+1},(_,i)=>line.place(t0+(t1-t0)*i/n,gutY(t0+(t1-t0)*i/n),0)),u=>gutR(t0+u*(t1-t0)),{samples:Math.round(n*1.6),radial,ends:false,color});
 gutTube('pharynx','muscle',1.4/NS,6.6/NS,24,(u,a,p)=>mix(hex(0xd58f84),hex(0xbf7469),.5+.5*fbm(p[0]*25,p[1]*25,p[2]*25,3)),mobile?14:22);
 gutTube('oesophagus','organ',6.4/NS,14.7/NS,30,(u,a,p)=>{const s=6.4+u*8.3;return mix(hex(0xd9a99a),hex(0xe8d6b8),Math.exp(-(((s-11)/1.4)**2)))});
 gutTube('crop','organ',14.5/NS,16.7/NS,12,(u,a,p)=>mix(hex(0xe2c8ad),hex(0xd2b293),.5+.5*fbm(p[0]*18,p[1]*18,p[2]*18,3)),mobile?14:20);
 gutTube('gizzard','muscle',16.5/NS,18.8/NS,12,(u,a,p)=>mix(hex(0xe6dccd),hex(0xcfc0ab),.5+.5*Math.cos(a*2+p[0]*30)*.3),mobile?14:22);
 // Intestine with chloragogen tissue (yellow-brown); opened for a few segments to show the typhlosole.
 {const t0=18.6/NS,t1=.985,n=mobile?260:420,pts=Array.from({length:n+1},(_,i)=>line.place(t0+(t1-t0)*i/n,gutY(t0),0)),iw={t:[(23-18.6)/NS/(t1-t0),(29.5-18.6)/NS/(t1-t0)],a:[Math.PI,TAU]};
  const chl=(t,a,p)=>mix(mix(hex(0xb88c4c),hex(0x9a6e3a),.5+.5*fbm(p[0]*20,p[1]*20,p[2]*20,3)),hex(0x8a5a3c),groove(t0+t*(t1-t0))*.5);
  const gut=b.loft('intestine','organ',{spine:pts,samples:n,radial:mobile?14:20,fixed:true,window:iw,thickness:.03,profile:u=>{const r=gutR(t0+u*(t1-t0))*Math.min(1,Math.sqrt(Math.max(0,1-u)*40));return[r,r]},color:chl,innerTissue:'mucosa',innerColor:(u,a,p)=>mix(hex(0xd7a98f),hex(0xc48d77),.5+.5*fbm(p[0]*30,p[1]*30,p[2]*30,3)),lipColor:()=>hex(0xc59b74)});
  // Typhlosole: dorsal fold hanging into the lumen, which enlarges the absorptive surface.
  const ta=t0+iw.t[0]*(t1-t0)-.004,tb=t0+iw.t[1]*(t1-t0)+.004;b.tube('typhlosole','mucosa',Array.from({length:21},(_,i)=>line.place(ta+(tb-ta)*i/20,gutY(t0)+gutR(t0+.05)*.42,0)),u=>gutR(t0+.05)*.34*(1+.08*Math.sin(u*40)),{samples:60,radial:mobile?10:14,ends:false,color:(u,a,p)=>mix(hex(0xd29c84),hex(0xb57f68),.5+.5*fbm(p[0]*30,p[1]*30,p[2]*30,3))})}
 // Closed circulation: dorsal vessel (pumps forwards), ventral vessel and five pairs of aortic arches.
 const top=t=>gutY(t)+gutR(t)+.05,bottom=t=>gutY(t)-gutR(t)-.045;
 const vessel=(part,yf,r,t0,t1,n,color)=>b.tube(part,'blood',Array.from({length:n+1},(_,i)=>{const t=t0+(t1-t0)*i/n;return line.place(t,yf(t),0)}),u=>r*(1+.15*Math.sin(TAU*segOf(t0+u*(t1-t0)))),{samples:n*2,radial:mobile?8:12,color});
 vessel('dorsal-vessel',top,.034,1.5/NS,.985,mobile?160:300,(u,a,p)=>mix(hex(0x8e1d23),hex(0xa8343a),.5+.5*fbm(p[0]*30,0,p[2]*30,2)));
 vessel('ventral-vessel',t=>Math.min(bottom(t),-R*.45),.026,2/NS,.985,mobile?160:300,hex(0x93252a));
 for(let s=7;s<=11;s++){const t=(s+.5)/NS,yt=top(t),yb=Math.min(bottom(t),-R*.45),rr=(yt-yb)/2,yc=(yt+yb)/2,w=gutR(t)+.07;
  for(const side of[1,-1]){const pts=[];for(let k=0;k<=16;k++){const a=k/16*Math.PI;pts.push(line.place(t,yc+rr*Math.cos(a),side*w*Math.sin(a)*1.05))}
   b.tube('aortic-arches','blood',pts,u=>.03*(1+.35*Math.sin(Math.PI*u)**2*(.8+.2*Math.sin(u*30))),{samples:40,radial:mobile?8:12,color:(u,a,p)=>mix(hex(0xa4282d),hex(0x7f171c),.5+.5*Math.cos(u*24))})}}
 // Metanephridia: a coiled tubule per side and segment, with the funnel in the segment in front.
 for(let s=13;s<=Math.floor(win.t[1]*NS)-1;s+=mobile?2:1){const t=s/NS,q=rand(s*7);for(const side of[1,-1]){const z0=side*(gutR(t)+.05),pts=[line.place(t-.2/NS,-R*.4,side*(gutR(t)*.6))];
   for(let k=0;k<9;k++){const u=k/8,y=-R*(.42-.26*Math.sin(Math.PI*u))+.025*Math.cos(k*2.1+q()),z=z0+side*(.03+.03*Math.sin(k*1.9+q()*2));pts.push(line.place(t+(.12+.6*u)/NS,y,z))}pts.push(line.place(t+.78/NS,-R*.58,side*(inner(t)-.01)));
   b.tube('nephridia','organ',pts,.0075,{samples:mobile?20:36,radial:mobile?4:6,color:(u,a,p)=>mix(hex(0xe7cfc2),hex(0xc08a7e),.5+.5*Math.sin(u*22))})
   b.blob('nephridia','organ',pts[0],[.016,.016,.016],{nu:10,nv:6,color:hex(0xf0e2d6)})}}
 // Nervous system: cerebral ganglia above the pharynx, connectives and a ventral cord with one ganglion per segment.
 const brain=line.place(3/NS,gutR(3/NS)+.03,0);for(const side of[1,-1])b.blob('nerve-cord','nerve',add(brain,scale(line.at(3/NS).Z,side*.06)),[.05,.04,.055],{nu:16,nv:10,color:hex(0xf0e8d8)});
 for(const side of[1,-1]){const pts=[];for(let k=0;k<=10;k++){const a=k/10*Math.PI;pts.push(line.place((3+k*.12)/NS,(gutR(3.5/NS)+.03)*Math.cos(a),side*(gutR(3.5/NS)+.05)*Math.sin(a)))}b.tube('nerve-cord','nerve',pts,.013,{samples:24,radial:6,color:hex(0xeee4d2)})}
 {const n=mobile?220:420,t0=4.2/NS,pts=Array.from({length:n+1},(_,i)=>{const t=t0+(.985-t0)*i/n;return line.place(t,-inner(t)*flat(t)+.045,0)});b.tube('nerve-cord','nerve',pts,u=>.022*(1+.4*Math.exp(-(((inSeg(t0+u*(.985-t0))-.5)/.12)**2))),{samples:n*2,radial:mobile?6:9,color:hex(0xefe6d6)})}
 // Reproduction (hermaphrodite): three pairs of seminal vesicles (segments 9–12), spermathecae, ovaries, male pores, clitellum.
 for(const [s,sz] of [[9.4,1],[10.6,1.1],[11.9,1.25]])for(const side of[1,-1]){const c=line.place(s/NS,R*.08,side*(gutR(s/NS)+.1)),ph=rnd()*9;
  b.blob('seminal-vesicles','organ',c,[.085*sz,.13*sz,.085*sz],{nu:26,nv:16,disp:(d,p)=>1+.16*fbm(p[0]*16+ph,p[1]*16,p[2]*16,3),color:p=>mix(hex(0xf2e6cf),hex(0xdcc7a6),.5+.5*fbm(p[0]*22,p[1]*22,p[2]*22,3))})}
 for(const s of[9.6,10.6])for(const side of[1,-1])b.blob('spermathecae','organ',line.place(s/NS,-R*.42,side*(R*.55)),[.035,.035,.035],{nu:14,nv:8,color:hex(0xf4ece0)});
 for(const side of[1,-1])b.blob('ovaries','organ',line.place(13.2/NS,-R*.36,side*.1),[.028,.04,.024],{nu:12,nv:8,color:hex(0xe9c9a4)});
 for(const side of[1,-1]){const p=line.place(15.5/NS,-radius(15.5/NS)*.86,side*radius(15.5/NS)*.42);b.blob('male-pores','skin',p,[.05,.035,.05],{nu:14,nv:8,color:hex(0xd9a48e)})}
 b.loft('clitellum','skin',{spine:line.sub(31.6/NS,37.4/NS),samples:mobile?40:70,radial:mobile?30:52,fixed:true,window:{t:[0,1],a:win.a},thickness:.05,innerTissue:'organ',innerColor:()=>hex(0xd9a48a),lipColor:(u,a,p)=>mix(hex(0xd88a62),hex(0xc47555),.5+.5*noise3(p[0]*50,p[1]*50,p[2]*50)),
  profile:u=>{const t=(31.6+u*5.8)/NS,e=Math.min(1,Math.min(u,1-u)*12),r=radius(t)*(1+.07*e);return[r,r*flat(t)]},
  disp:(u,a)=>-.006*groove((31.6+u*5.8)/NS)+.004*fbm(u*40,Math.cos(a)*5,Math.sin(a)*5,2)-.025*gauss(a,Math.PI,.55)*Math.min(1,Math.min(u,1-u)*12),color:(u,a,p)=>mix(mix(CLIT,hex(0xa8573f),.5+.5*fbm(p[0]*14,p[1]*14,p[2]*14,3)),VENT,gauss(a,Math.PI,.5)*.6)});
 // Setae: four pairs per segment, short amber bristles on the ventral and lateral sides.
 for(let s=2;s<NS-1;s+=mobile?2:1){const t=(s+.5)/NS;for(const c of[Math.PI-.24,Math.PI+.24,Math.PI-.95,Math.PI+.95])for(const d of[-.035,.035]){const a=c+d;if(t>win.t[0]-.003&&t<win.t[1]+.003&&a>Math.PI-.05)continue;
  const r=radius(t),f=line.at(t),base=add(f.p,add(scale(f.N,Math.cos(a)*r*flat(t)),scale(f.Z,-Math.sin(a)*r))),dir=norm(add(scale(f.N,Math.cos(a)),scale(f.Z,-Math.sin(a))));
  b.strand('setae','chitin',[madd(base,dir,-.012),madd(madd(base,dir,.018),f.T,.006),madd(madd(base,dir,.034),f.T,.016)],.0055,.003,{seg:3,radial:3,color:hex(0xc9a066)})}}
}

// ---------- Insect: migratory locust (Locusta migratoria) ----------
// Scan frame: head towards −x (x −0.40…−0.27), thorax to −0.10, abdomen to +0.25 under the wings.
export function locust(b){
 const mobile=b.mobile,rnd=rand(17);
 const B=bodyShape([[-.4,.06,-.03,.035],[-.36,.095,-.045,.05],[-.3,.1,-.05,.055],[-.22,.095,-.05,.06],[-.14,.09,-.055,.058],[-.08,.07,-.06,.05],[-.04,.045,-.064,.047],[0,.025,-.068,.045],[.08,.018,-.07,.042],[.15,.012,-.068,.036],[.21,0,-.055,.026],[.245,-.01,-.035,.014]],.002);
 const P=(x,v,w)=>B.at(x,v,w),zc=B.zc;
 // Inner face of the far body wall: cuticle lined by epidermis and, in the thorax, flight muscles.
 {const x0=-.37,x1=.235,nx=mobile?44:90,ny=mobile?16:30;b.grid('flight-muscles','muscle',ny+1,nx+1,(r,c)=>{const x=x0+(x1-x0)*c/nx,v=-.78+1.56*r/ny;return P(x,v,-.72)},
  {color:(r,c,p)=>{const x=p[0],y=p[1];if(x>-.27&&x<-.1)return mix(hex(0xc98d78),hex(0xb37563),.5+.5*Math.sin(y*900+fbm(x*60,y*60,1,2)*3));const seg=Math.exp(-((Math.sin((x+.1)*140))**2)/.02);return shade(mix(hex(0xd8c3a0),hex(0xc4ad88),.5+.5*fbm(x*50,y*50,2,3)),1-.18*seg)},outward:()=>[0,0,1]})}
 // Thoracic flight muscles (indirect): dorsal longitudinal and dorsoventral bundles.
 for(let k=0;k<(mobile?5:9);k++){const x=-.255+k*.017;b.tube('flight-muscles','muscle',[P(x,.62,-.2),P(x+.004,0,-.25),P(x,-.55,-.2)],.0075,{samples:12,radial:mobile?8:10,disp:(t,a)=>.0008*Math.sin(t*90),color:(t,a,p)=>mix(hex(0xc78a73),hex(0xa9654f),.5+.5*Math.sin(a*6+t*40))})}
 b.tube('flight-muscles','muscle',[P(-.26,.55,0),P(-.18,.6,0),P(-.11,.5,0)],.016,{samples:20,radial:14,disp:(t,a)=>.0012*Math.sin(a*14),color:(t,a,p)=>mix(hex(0xcf937c),hex(0xb87a63),.5+.5*Math.sin(a*14))});
 // Gut: pharynx, oesophagus, crop, proventriculus, six pairs of gastric caeca, midgut, ileum, colon, rectum.
 const gut=(part,tissue,pts,r,color,samples=40)=>b.tube(part,tissue,pts,r,{samples,radial:mobile?10:16,ends:false,color});
 gut('foregut','organ',[P(-.37,-.35,0),P(-.35,-.05,0),P(-.32,.05,0),P(-.28,.0,0)],t=>.006+.002*t,(t,a,p)=>mix(hex(0xe2cdb4),hex(0xd4b998),t));
 gut('foregut','organ',[P(-.28,.0,0),P(-.22,-.05,0),P(-.15,-.08,0),P(-.105,-.08,0)],t=>.012+.016*Math.sin(Math.PI*Math.min(1,t*1.1)),(t,a,p)=>mix(hex(0xe6d6bd),hex(0xd2b894),.5+.5*fbm(p[0]*90,p[1]*90,p[2]*90,3)),50);
 b.blob('foregut','muscle',P(-.095,-.08,0),[.011,.012,.012],{nu:18,nv:10,color:hex(0xc9a985)});
 for(let k=0;k<6;k++){const a=(k/6)*Math.PI*2,dir=[0,Math.cos(a),Math.sin(a)];b.tube('gastric-caeca','organ',[madd(P(-.085,-.08,0),dir,.008),madd(madd(P(-.1,-.08,0),dir,.018),[-1,0,0],.01),madd(madd(P(-.12,-.08,0),dir,.02),[-1,0,0],.02)],t=>.005*(1-.3*t),{samples:12,radial:8,color:(t,a,p)=>mix(hex(0xe7d58a),hex(0xd2b860),t)});
  b.tube('gastric-caeca','organ',[madd(P(-.075,-.08,0),dir,.008),madd(madd(P(-.07,-.08,0),dir,.016),[1,0,0],.01),madd(madd(P(-.06,-.08,0),dir,.016),[1,0,0],.02)],t=>.004*(1-.3*t),{samples:10,radial:8,color:(t,a,p)=>mix(hex(0xe7d58a),hex(0xd2b860),t)})}
 gut('midgut','organ',[P(-.08,-.08,0),P(-.02,-.12,0),P(.05,-.14,0),P(.1,-.15,0)],.011,(t,a,p)=>mix(hex(0xd8c06e),hex(0xbfa04f),.5+.5*fbm(p[0]*80,p[1]*80,p[2]*80,3)),40);
 gut('hindgut','organ',[P(.1,-.15,0),P(.14,-.12,0),P(.17,-.05,0),P(.2,-.08,0),P(.235,-.15,0)],t=>.007+.004*Math.sin(Math.PI*t),(t,a,p)=>mix(hex(0xc9a98a),hex(0xa98a6c),t),40);
 for(let k=0;k<6;k++){const a=k/6*Math.PI*2;b.blob('hindgut','muscle',madd(P(.215,-.11,0),[0,Math.cos(a),Math.sin(a)],.006),[.009,.003,.003],{nu:10,nv:6,color:hex(0xb78f73)})}
 // Malpighian tubules: many fine blind tubules at the midgut-hindgut junction, free in the haemolymph.
 for(let k=0;k<(mobile?24:60);k++){const q=rand(k*13),start=P(.1,-.15,0),pts=[start];let p=start;for(let s=0;s<4;s++){p=add(p,[(q()-.35)*.05,(q()-.5)*.04,(q()-.5)*.05]);const y=Math.max(B.mid(p[0])-B.semi(p[0])*.75,Math.min(B.mid(p[0])+B.semi(p[0])*.4,p[1]));p=[Math.max(-.08,Math.min(.22,p[0])),y,Math.max(-B.half(p[0])*.75,Math.min(B.half(p[0])*.75,p[2]))];pts.push(p)}
  b.tube('malpighian-tubules','organ',pts,.0016,{samples:mobile?14:24,radial:4,color:(t)=>mix(hex(0xe9d36c),hex(0xd8b94a),t)})}
 // Salivary glands in the thorax.
 for(const side of[1,-1])b.blob('foregut','organ',P(-.21,-.35,side*.35),[.017,.008,.008],{nu:18,nv:10,disp:(d,p)=>1+.2*fbm(p[0]*120,p[1]*120,p[2]*120,2),color:hex(0xece2cc)});
 // Gonads: paired ovaries of panicle-like ovarioles above the gut (female drawn); oviducts to the genital opening.
 for(const side of[1,-1])for(let k=0;k<(mobile?6:10);k++){const x=-.06+k*.024;b.tube('gonads','organ',[P(x,.25,side*.15),P(x+.015,.1,side*.4),P(x+.02,-.05,side*.45)],t=>.0045*(1-.3*t),{samples:12,radial:8,disp:(t,a)=>.0012*Math.sin(t*60),color:(t,a,p)=>mix(hex(0xe9b25a),hex(0xd7953f),.5+.5*Math.sin(t*60))})}
 for(const side of[1,-1])b.tube('gonads','organ',[P(-.04,.25,side*.15),P(.1,.25,side*.15),P(.2,0,side*.1),P(.235,-.45,0)],.003,{samples:30,radial:6,color:hex(0xe8c27a)});
 // Dorsal vessel: tubular heart with ostia along the abdomen and the aorta forward to the head (open circulation).
 {const pts=[];for(let i=0;i<=30;i++){const x=-.36+i/30*.58;pts.push(P(x,x<-.1?.6:.72,0))}b.tube('dorsal-vessel','blood',pts,t=>.0032*(t>.45?1+.35*Math.max(0,Math.sin(t*90)):.8),{samples:90,radial:8,color:(t,a,p)=>mix(hex(0x9ab07a),hex(0x7f9a68),.5+.5*Math.sin(t*90))})}
 // Tracheal system: lateral trunks with spiracles on the right side wall, branches and thoracic air sacs.
 for(const side of[1,-1]){const pts=[];for(let i=0;i<=24;i++){const x=-.33+i/24*.54;pts.push(P(x,.15,side*.68))}b.tube('tracheae','membrane',pts,.0025,{samples:60,radial:6,color:hex(0xe6ecec)});
  for(let i=0;i<10;i++){const x=-.2+i*.04;b.tube('tracheae','membrane',[P(x,.15,side*.68),P(x+.005,.3,side*.3),P(x+.01,.5,side*.05)],.0013,{samples:10,radial:4,color:hex(0xdfe7e7)});b.tube('tracheae','membrane',[P(x,.15,side*.68),P(x+.006,-.2,side*.4),P(x+.012,-.45,side*.1)],.0012,{samples:10,radial:4,color:hex(0xdfe7e7)})}
  b.blob('tracheae','membrane',P(-.2,.35,side*.45),[.02,.013,.012],{nu:20,nv:12,color:hex(0xeef2f0)})}
 for(let i=0;i<10;i++){const x=-.2+i*.04;b.tube('tracheae','membrane',[P(x,.15,-.68),P(x,.15,-.93)],.003,{samples:4,radial:8,color:hex(0x5a4a3a)})}
 // Nervous system: brain above the oesophagus, ventral cord with thoracic and abdominal ganglia.
 {for(const side of[1,-1])b.blob('nerve-cord','nerve',P(-.335,.45,side*.25),[.014,.012,.011],{nu:16,nv:10,color:hex(0xf2ebde)});
  const pts=[];for(let i=0;i<=40;i++){const x=-.33+i/40*.52;pts.push(P(x,-.72,0))}b.tube('nerve-cord','nerve',pts,.002,{samples:80,radial:6,color:hex(0xf0e8da)});
  for(const x of[-.31,-.23,-.18,-.13,-.04,.02,.07,.11,.15])b.blob('nerve-cord','nerve',P(x,-.72,0),[.006,.004,.006],{nu:12,nv:8,color:hex(0xf4eee2)})}
 // Fat body: loose creamy lobes in the abdominal haemocoel.
 for(let k=0;k<(mobile?8:16);k++){const x=-.05+rnd()*.26,v=-.3+rnd()*.7,w=(rnd()<.5?-1:1)*(.45+rnd()*.25);b.blob('fat-body','organ',P(x,v,w),[.012,.006,.008],{nu:12,nv:8,disp:(d,p)=>1+.25*fbm(p[0]*150,p[1]*150,p[2]*150,2),color:hex(0xf1e4c2)})}
}

// ---------- Mollusc: land snail (Euhadra herklotsi), preserved specimen ----------
// Scan frame: shell on the left around a vertical axis at x = -0.13 (apex near y 0.34), aperture
// towards +x, the withdrawn foot and head below it on the right. The visceral mass follows the shell's
// spiral: s = 0 at the aperture (body whorl) up to s = 1 at the apex; rr and yy shift a point within
// the visceral tube, in fractions of its radius.
export function snail(b){
 const mobile=b.mobile,AX=-.13,whorls=3,K=Math.log(1/.1)/(whorls*TAU),R0=.255,T0=.13;
 const E=s=>Math.exp(-K*s*whorls*TAU);
 const spiral=(s,rr=0,yy=0,da=0)=>{const e=E(s),a=s*whorls*TAU+da,r=e*(R0+rr*T0);return[AX+r*Math.cos(a),-.03+.38*(1-e)+yy*T0*e,-r*Math.sin(a)]};
 const tubeR=s=>T0*E(s);
 const along=(s0,s1,n,f)=>Array.from({length:n+1},(_,i)=>f(s0+(s1-s0)*i/n));
 // Columella: the central pillar of the shell that the whorls wind around.
 b.tube('columella','shell',[[AX,-.12,0],[AX,.08,0],[AX,.22,0],[AX,.3,0]],t=>.014*(1-.6*t),{samples:20,radial:12,color:(t,a,p)=>mix(hex(0xe9dcc0),hex(0xd6c49e),t)});
 // Digestive gland (hepatopancreas): fills most of the visceral whorls.
 b.tube('digestive-gland','organ',along(.1,.88,80,s=>spiral(s,-.1,-.1)),u=>tubeR(.1+u*.78)*.8,{samples:mobile?120:220,radial:mobile?12:18,disp:(t,a)=>.003*fbm(t*30,Math.cos(a)*2,Math.sin(a)*2,3),color:(t,a,p)=>mix(hex(0x6f4a2c),hex(0x8a5f38),.5+.5*fbm(p[0]*60,p[1]*60,p[2]*60,3))});
 // Ovotestis at the apex, hermaphrodite duct, albumen gland and the duct to the genital pore.
 b.tube('reproductive','organ',along(.86,.99,14,s=>spiral(s)),u=>tubeR(.86+u*.13)*.75,{samples:30,radial:12,disp:(t,a)=>.002*noise3(t*40,a*3,1),color:hex(0xe6d29a)});
 b.tube('reproductive','organ',along(.3,.86,40,s=>spiral(s,.8,.35)),.0035,{samples:90,radial:6,disp:(t,a)=>.0012*Math.sin(t*200),color:hex(0xf0e6d0)});
 b.blob('reproductive','organ',spiral(.24,-.35,.35),[.042,.032,.036],{nu:22,nv:14,disp:(d,p)=>1+.06*fbm(p[0]*80,p[1]*80,p[2]*80,2),color:hex(0xf2ead8)});
 b.tube('reproductive','organ',[spiral(.22,-.3,.3),spiral(.12,-.2,-.3),spiral(.04,-.2,-.6),[.2,-.08,.04]],t=>.008*(1-.3*t),{samples:40,radial:10,color:(t,a,p)=>mix(hex(0xefe2cc),hex(0xd9c3a6),t)});
 // Stomach and intestine running back along the body whorl to the anus beside the breathing pore.
 b.blob('stomach','organ',spiral(.32,0,-.25),[.04,.032,.034],{nu:22,nv:14,color:hex(0xd8b89a)});
 b.tube('intestine','organ',[spiral(.32,0,-.25),spiral(.24,.75,-.45),spiral(.14,.8,-.3),spiral(.05,.75,.35),[.17,.09,.02]],.0075,{samples:60,radial:10,color:(t,a,p)=>mix(hex(0xc9a37a),hex(0xa98058),t)});
 // Lung: the vascular roof of the mantle cavity behind the aperture; heart in its pericardium; kidney.
 b.sheet('lung','membrane',{nu:28,nv:12,mid:(u,v)=>spiral(.01+.13*u,.15+.65*v,.72),thick:()=>.003,color:(u,v,p)=>mix(hex(0xd99a92),hex(0xb5636a),Math.pow(Math.abs(Math.sin(u*30+v*8)),8))});
 for(let k=0;k<(mobile?5:10);k++){const v=k/(mobile?4:9);b.tube('lung','blood',along(.01,.14,12,s=>spiral(s,.15+.65*v,.76)),.0016,{samples:18,radial:5,color:hex(0x9e2b33)})}
 b.blob('heart','muscle',spiral(.17,.15,.5),[.017,.014,.014],{nu:18,nv:12,color:hex(0xc9787a)});
 b.blob('heart','membrane',spiral(.17,.15,.5),[.026,.022,.022],{nu:20,nv:12,cut:(t,u)=>u>.5,color:hex(0xeadbd2)});
 b.blob('kidney','organ',spiral(.14,-.35,.55),[.034,.018,.026],{nu:22,nv:12,color:hex(0xd7c08a)});
 b.tube('kidney','organ',[spiral(.14,-.35,.55),spiral(.07,.2,.6),[.17,.1,.0]],.0028,{samples:20,radial:6,color:hex(0xdcc8a4)});
 // Head in the foot: buccal mass with the radula, salivary glands, oesophagus and the nerve ring.
 const head=[.24,-.13,0];b.blob('radula','muscle',head,[.03,.022,.022],{nu:22,nv:14,color:hex(0xd9a08e)});
 b.tube('radula','chitin',[[.25,-.14,0],[.22,-.15,0],[.19,-.13,0]],.006,{samples:12,radial:10,disp:(t,a)=>.0012*Math.sin(t*80),color:hex(0xa8834c)});
 for(const side of[1,-1])b.blob('radula','organ',[.16,-.1,side*.022],[.025,.008,.01],{nu:16,nv:8,color:hex(0xefe5d4)});
 b.tube('stomach','organ',[[.21,-.12,0],[.12,-.08,0],[.02,-.06,-.02],spiral(.32,0,-.25)],.006,{samples:40,radial:8,color:hex(0xe0c7ad)});
 {const ring=[];for(let i=0;i<=24;i++){const a=i/24*TAU;ring.push([.2,-.12+.02*Math.cos(a),.02*Math.sin(a)])}b.tube('nerve-ganglia','nerve',ring,.004,{samples:40,radial:6,ends:false,color:hex(0xf3ead8)});
  for(const [dy,dz] of [[.02,.012],[.02,-.012],[-.022,.01],[-.022,-.01]])b.blob('nerve-ganglia','nerve',[.2,-.12+dy,dz],[.008,.007,.007],{nu:12,nv:8,color:hex(0xf6efe0)})}
}

// ---------- Echinoderm: bat star (Patiria pectinifera) ----------
// Scan frame: the star lies flat, aboral (upper) side towards +y; disc centre near (0.014, 0, 0.05);
// arm tips at the measured angles below (in the x-z plane). The cut removes the aboral half.
export function seastar(b){
 const mobile=b.mobile,C=[.014,0,.05],TIPS=[[-168,.51],[-90,.48],[-13,.52],[55,.59],[120,.55]].map(([d,r])=>[Math.cos(d*Math.PI/180)*r-C[0],Math.sin(d*Math.PI/180)*r-C[2]]);
 const ARMS=TIPS.map(([x,z])=>Math.atan2(z,x)),LEN=TIPS.map(([x,z])=>Math.hypot(x,z));
 const at=(ang,r,y,side=0)=>{const c=Math.cos(ang),s=Math.sin(ang);return[C[0]+c*r-s*side,y,C[2]+s*r+c*side]};
 const thick=r=>.055*(1-.55*smooth(.08,.48,r));
 // Cardiac stomach (everted over prey to digest outside the body) and the pyloric stomach above it.
 b.blob('stomach','organ',[C[0],-.018,C[2]],[.1,.03,.1],{nu:40,nv:20,disp:(d,p)=>{const a=Math.atan2(d[2],d[0]);return 1+.12*Math.cos(5*(a-ARMS[0]))+.05*fbm(p[0]*40,p[1]*40,p[2]*40,3)},color:p=>mix(hex(0xead9b6),hex(0xd8bf90),.5+.5*fbm(p[0]*50,p[1]*50,p[2]*50,3))});
 b.blob('stomach','organ',[C[0],.016,C[2]],[.055,.016,.055],{nu:30,nv:14,disp:(d)=>{const a=Math.atan2(d[2],d[0]);return 1+.25*Math.cos(5*(a-ARMS[0]))},color:hex(0xd9b77c)});
 b.blob('stomach','muscle',[C[0],-.045,C[2]],[.025,.01,.025],{nu:20,nv:10,color:hex(0xc89a72)});
 // Pyloric caeca: a pair of branched digestive glands in every arm.
 ARMS.forEach((ang,ai)=>{const L=LEN[ai]/.47;for(const side of[1,-1]){const n=mobile?10:18;b.tube('pyloric-caeca','organ',[at(ang,.05,.02,0),at(ang,.1*L,.02,side*.025),at(ang,.25*L,.015,side*.035),at(ang,.36*L,.008,side*.025)],t=>.012*(1-.5*t),{samples:30,radial:10,color:(t,a,p)=>mix(hex(0x9a7a3e),hex(0x7d5f2c),t)});
  for(let k=0;k<n;k++){const r=(.1+.25*k/n)*L,dir=side*(k%2?1:.7);b.blob('pyloric-caeca','organ',at(ang,r,.017-.012*r,side*(.035+.012*dir)),[.012,.007,.009],{nu:12,nv:8,disp:(d,p)=>1+.15*fbm(p[0]*200,p[1]*200,p[2]*200,2),color:p=>mix(hex(0xb08a48),hex(0x8a6a34),.5+.5*fbm(p[0]*120,p[1]*120,p[2]*120,2))})}}});
 // Gonads: tufts at the base of each arm, between the arms (opening through small pores).
 for(let i=0;i<5;i++)for(const side of[1,-1]){const ang=ARMS[i]+side*.38;b.blob('gonads','organ',at(ang,.16,-.005),[.03,.012,.02],{nu:20,nv:10,disp:(d,p)=>1+.25*fbm(p[0]*160,p[1]*160,p[2]*160,3),color:p=>mix(hex(0xe8913f),hex(0xd47630),.5+.5*fbm(p[0]*120,p[1]*120,p[2]*120,2))})}
 // Water vascular system: madreporite, stone canal, ring canal, radial canals with ampullae.
 const inter=(ARMS[0]+ARMS[1])/2;b.blob('water-vascular','shell',at(inter,.11,.06),[.016,.005,.016],{nu:18,nv:8,disp:(d,p)=>1+.15*Math.sin(Math.atan2(d[2],d[0])*12),color:hex(0xe4d07a)});
 b.tube('water-vascular','membrane',[at(inter,.11,.055),at(inter,.09,.02),at(inter,.06,-.02),at(inter,.055,-.035)],.004,{samples:20,radial:8,disp:(t,a)=>.0008*Math.sin(t*80),color:hex(0xe6d5a8)});
 {const ring=[];for(let i=0;i<=40;i++){const a=i/40*TAU;ring.push([C[0]+.055*Math.cos(a),-.035,C[2]+.055*Math.sin(a)])}b.tube('water-vascular','membrane',ring,.004,{samples:80,radial:8,ends:false,color:hex(0xe9dcb4)});
  ARMS.forEach((ang,ai)=>{const L=LEN[ai];b.tube('water-vascular','membrane',[at(ang,.055,-.035),at(ang,.4*L,-.023),at(ang,.65*L,-.012),at(ang,.84*L,-.01)],t=>.003*(1-.4*t),{samples:40,radial:6,color:hex(0xe9dcb4)});
   const n=mobile?10:20;for(let k=0;k<n;k++)for(const side of[1,-1]){const r=.08+(.78*L-.08)*k/n,y=-thick(r)*.45+.004;b.blob('water-vascular','membrane',at(ang,r,y,side*.014*(1-.4*r/.47)),[.006,.008,.006],{nu:10,nv:8,color:hex(0xf0e6c2)})}})}
 // Nervous system: oral nerve ring around the mouth and a radial nerve along each arm (no brain).
 {const ring=[];for(let i=0;i<=40;i++){const a=i/40*TAU;ring.push([C[0]+.045*Math.cos(a),-.05,C[2]+.045*Math.sin(a)])}b.tube('nerves','nerve',ring,.0025,{samples:80,radial:6,ends:false,color:hex(0xf2e6d2)});
  ARMS.forEach((ang,ai)=>b.tube('nerves','nerve',[at(ang,.045,-.05),at(ang,.45*LEN[ai],-.042),at(ang,.84*LEN[ai],-.02)],.0018,{samples:30,radial:5,color:hex(0xf2e6d2)}))}
}

// ---------- Sponge: yellow tube sponge (Aplysina fistularis), dried spongin skeleton ----------
// The scan is the skeleton of a museum specimen (living tissue gone). Lenses below it show the living
// wall: water enters by ostia, crosses choanocyte chambers and leaves through the osculum.
export function sponge(b){
 const mobile=b.mobile,rnd=rand(61),lens=(o,k)=>p=>[o[0]+p[0]*k,o[1]+p[1]*k,o[2]+p[2]*k];
 const ringAt=(part,o,r)=>{const pts=[];for(let i=0;i<=72;i++){const a=i/72*TAU;pts.push([o[0]+r*Math.cos(a),o[1]+r*Math.sin(a),o[2]-.01])}b.tube(part,'protein',pts,r*.012,{samples:144,radial:6,ends:false,color:hex(0xd8d4c8)})};
 // Wall in section (leuconoid body): pinacoderm with ostia, incurrent canals, choanocyte chambers,
 // excurrent canals, mesohyl with amoebocytes and the spongin fibres.
 {const o=[-.2,-.7,0],k=1,X=lens(o,k);ringAt('canal-system',o,.2);
  b.grid('canal-system','sponge',2,2,(r,c)=>X([-.14+.28*c,-.12+.24*r,-.02]),{color:()=>hex(0xd9b56a),outward:()=>[0,0,1]});
  b.grid('canal-system','sponge',2,2,(r,c)=>X([-.14,-.12+.24*r,-.02+.02*c]),{color:()=>hex(0xc89a4a),outward:()=>[-1,0,0]});
  for(let i=0;i<5;i++){const y=-.1+i*.05;b.tube('canal-system','membrane',[X([-.14,y,-.005]),X([-.08,y+.01,-.005]),X([-.04,y,-.005])],.008*k,{samples:12,radial:8,color:hex(0xeadcb8)});b.blob('canal-system','membrane',X([-.142,y,-.005]),[.004,.009,.009],{nu:10,nv:8,color:hex(0x6a4a24)})}
  for(let i=0;i<(mobile?6:10);i++){const c=[-.02+(i%2)*.05,-.09+Math.floor(i/2)*.045,-.006],R=.018;b.blob('canal-system','membrane',X(c),[R,R,R],{nu:16,nv:10,cut:(t,u)=>u<.5,color:hex(0xe2cc90)});
   for(let j=0;j<(mobile?8:14);j++){const a=j/(mobile?8:14)*TAU,p=[c[0]+R*.8*Math.cos(a),c[1]+R*.8*Math.sin(a),c[2]];b.blob('canal-system','granule',X(p),[.003,.003,.003],{nu:6,nv:4,color:hex(0x9a7a3a)})}}
  b.tube('canal-system','membrane',[X([.05,-.11,-.005]),X([.09,-.05,-.005]),X([.1,.02,-.005]),X([.14,.1,-.005])],.012*k,{samples:20,radial:10,color:hex(0xf0e2c0)});
  for(let i=0;i<(mobile?10:24);i++){const p=[-.12+rnd()*.24,-.11+rnd()*.22,-.004];b.blob('canal-system','granule',X(p),[.0045,.003,.003],{nu:8,nv:6,disp:(d,q)=>1+.3*noise3(q[0]*500,q[1]*500,q[2]*500),color:hex(0xc98a3a)})}
  for(let i=0;i<5;i++){const x=-.12+i*.06;b.tube('canal-system','fungus',[X([x,-.12,-.012]),X([x+.01,0,-.012]),X([x-.005,.12,-.012])],.004*k,{samples:16,radial:6,color:hex(0x8a5a2a)})}}
 // One choanocyte: collar of microvilli around a flagellum that drives the current and traps food.
 {const o=[.2,-.7,0],k=1.5,X=lens(o,k);ringAt('choanocyte',o,.2);
  b.blob('choanocyte','membrane',X([0,-.04,0]),[.035*k,.045*k,.035*k],{nu:24,nv:16,color:hex(0xe7cf96)});
  b.blob('choanocyte','nucleus',X([0,-.05,.01]),[.014*k,.014*k,.014*k],{nu:14,nv:10,color:hex(0x8a6aa0)});
  for(let i=0;i<(mobile?14:26);i++){const a=i/(mobile?14:26)*TAU;b.strand('choanocyte','cilium',[X([.02*Math.cos(a),.0,.02*Math.sin(a)]),X([.026*Math.cos(a),.05,.026*Math.sin(a)])],.0016*k,.0012*k,{seg:3,radial:3,color:hex(0xf0e6c8)})}
  const fl=[];for(let i=0;i<=20;i++){const t=i/20;fl.push(X([.012*Math.sin(t*9),.0+.11*t,0]))}b.tube('choanocyte','cilium',fl,.0022*k,{samples:60,radial:5,color:hex(0xf4ecd4)});
  for(let i=0;i<5;i++)b.blob('choanocyte','granule',X([.035*Math.cos(i*1.3),.03+.01*i,.03*Math.sin(i*1.3)]),[.004*k,.004*k,.004*k],{nu:6,nv:4,color:hex(0x6a7a3a)})}
}

// ---------- Flatworm: freshwater planarian (Dugesia) ----------
// Seen from above (dorsal side towards +z, head towards −x), 1 unit ≈ 1.5 cm. The dorsal wall is opened
// over the trunk to show the three-branched gut, pharynx, protonephridia, nerve cords and gonads.
export function planarian(b){
 const mobile=b.mobile,rnd=rand(71);
 const width=t=>{const head=.075+.05*Math.exp(-(((t-.07)/.03)**2)),neck=.065,body=.12*Math.sin(Math.PI*Math.min(1,(t-.08)/.98))**.55;return t<.07?head*Math.sqrt(Math.max(0,t/.07))*.95+.01:t<.12?head+(neck-head)*(t-.07)/.05:Math.max(neck*(1-smooth(.85,1,t)),body)*(1-smooth(.94,1,t)*.9)+.004};
 const thick=t=>.022*Math.min(1,width(t)/.06)+.004;
 const at=(t,y,z)=>[-.5+t,y,z];
 const DORS=hex(0x5e4a3a),PALE=hex(0x9a8470);
 const wall=b.loft('body-wall','skin',{spine:[[-.5,0,0],[.5,0,0]],samples:mobile?90:160,radial:mobile?24:40,up:[0,0,1],exponent:3,window:{t:[.16,.92],a:[-1.25,1.25]},thickness:.006,profile:t=>[width(t),thick(t)],
  color:(t,a,p)=>{const dorsal=.5+.5*Math.cos(a);return mix(mix(PALE,DORS,smooth(.2,.6,dorsal)),hex(0x3d2f25),smooth(.3,.8,fbm(p[0]*40,p[1]*40,p[2]*40,3)+.2)*dorsal*.6)},innerTissue:'organ',innerColor:(t,a,p)=>mix(hex(0xd9c7b2),hex(0xc9b29a),.5+.5*fbm(p[0]*60,p[1]*60,1,2)),lipColor:()=>hex(0xb39a80)});
 // Eyespots: pigment cups that sense the direction of light.
 for(const s of[1,-1])b.blob('eyespots','granule',at(.075,s*.022,thick(.075)*.85),[.011,.008,.004],{nu:14,nv:8,color:(p)=>mix(hex(0x111111),hex(0xe8e0d0),smooth(.0,.007,Math.hypot(p[0]-at(.075,0,0)[0]-.004,p[1]-s*.026)))});
 // Gut: one anterior and two posterior trunks with side branches (diverticula); a single opening.
 const g=(part,pts,r,color)=>b.tube(part,'organ',pts,r,{samples:Math.max(8,pts.length*3),radial:mobile?6:8,color});
 const GUT=(t)=>mix(hex(0xb8935a),hex(0x8a6a3e),t);
 g('gut',[at(.47,0,0),at(.3,0,0),at(.14,0,0)],.012,()=>GUT(.3));
 for(const s of[1,-1])g('gut',[at(.47,0,0),at(.55,s*.035,0),at(.75,s*.04,0),at(.93,s*.015,0)],t=>.011*(1-.4*t),()=>GUT(.5));
 const branch=(t0,s,len)=>{const p0=at(t0,s*(t0>.47?.04:0),0),tip=at(t0+(rnd()-.5)*.02,s*(width(t0)*.82),0);g('gut',[p0,add(p0,scale(sub(tip,p0),.5)),tip],t=>.007*(1-.5*t),()=>GUT(.7))};
 for(let i=0;i<(mobile?7:12);i++){const t=.16+i*(.3/(mobile?7:12));for(const s of[1,-1])branch(t,s)}
 for(let i=0;i<(mobile?9:16);i++){const t=.5+i*(.42/(mobile?9:16));for(const s of[1,-1])branch(t,s)}
 // Pharynx: muscular tube in its pouch, opening at the ventral mouth (extended to feed).
 b.blob('pharynx','membrane',at(.53,0,-.004),[.085,.026,.012],{nu:28,nv:14,cut:(t,u)=>Math.cos(t*Math.PI)>.2,color:hex(0xe4d4c0)});
 b.tube('pharynx','muscle',[at(.47,0,-.002),at(.53,0,-.004),at(.6,0,-.006)],.013,{samples:30,radial:14,disp:(t,a)=>.0012*Math.sin(t*60),color:(t,a,p)=>mix(hex(0xf0e6d6),hex(0xd9c6b0),.5+.5*Math.sin(t*60))});
 // Protonephridia: two lateral excretory canals with branches ending in flame cells.
 for(const s of[1,-1]){const pts=[];for(let i=0;i<=30;i++){const t=.1+i/30*.82;pts.push(at(t,s*width(t)*.7,.006))}b.tube('protonephridia','membrane',pts,.0025,{samples:90,radial:5,color:hex(0xe6eef0)});
  for(let i=0;i<(mobile?8:16);i++){const t=.14+i*(.76/(mobile?8:16)),p=at(t,s*width(t)*.7,.006),q=at(t+.015,s*width(t)*(.45+.3*rnd()),.008);b.tube('protonephridia','membrane',[p,q],.0014,{samples:6,radial:4,color:hex(0xe6eef0)});b.blob('protonephridia','membrane',q,[.004,.003,.003],{nu:8,nv:6,color:hex(0xc8e0e8)})}}
 // Nervous system: cerebral ganglia and two ventral nerve cords linked like a ladder.
 for(const s of[1,-1])b.blob('nervous-system','nerve',at(.09,s*.018,-.004),[.018,.014,.006],{nu:16,nv:10,color:hex(0xf3ead8)});
 for(const s of[1,-1]){const pts=[];for(let i=0;i<=24;i++){const t=.1+i/24*.85;pts.push(at(t,s*width(t)*.32,-.009))}b.tube('nervous-system','nerve',pts,.0028,{samples:70,radial:5,color:hex(0xf3ead8)})}
 for(let i=0;i<(mobile?8:14);i++){const t=.14+i*(.8/(mobile?8:14));b.tube('nervous-system','nerve',[at(t,-width(t)*.32,-.009),at(t,width(t)*.32,-.009)],.0015,{samples:8,radial:4,color:hex(0xf3ead8)})}
 // Hermaphrodite reproductive system: ovaries behind the brain, many testes, copulatory apparatus, genital pore.
 for(const s of[1,-1])b.blob('reproductive','organ',at(.16,s*.03,.006),[.008,.006,.005],{nu:12,nv:8,color:hex(0xe9c98a)});
 for(let i=0;i<(mobile?12:28);i++){const t=.2+rnd()*.68,s=rnd()<.5?-1:1;b.blob('reproductive','organ',at(t,s*width(t)*(.55+.2*rnd()),.01),[.006,.006,.004],{nu:10,nv:6,color:hex(0xf2e6c8)})}
 for(const s of[1,-1]){const pts=[];for(let i=0;i<=16;i++){const t=.16+i/16*.5;pts.push(at(t,s*(.03+.02*Math.sin(i)),.004))}b.tube('reproductive','organ',pts,.0018,{samples:40,radial:4,color:hex(0xe9d7aa)})}
 b.blob('reproductive','muscle',at(.66,0,-.004),[.016,.012,.01],{nu:16,nv:10,color:hex(0xd8b8a0)});
 b.blob('reproductive','membrane',at(.69,0,-.01),[.008,.008,.006],{nu:12,nv:8,color:hex(0xe8dcd0)});
}

// ---------- Roundworm: Ascaris lumbricoides (female) ----------
// Head towards −x; 1 unit ≈ 25 cm, drawn with a gentle S. A lateral window opens the front half of the
// body to show the pseudocoelom with the intestine, the coiled genital tubes and the nerve cords.
export function roundworm(b){
 const mobile=b.mobile,rnd=rand(73),R=.03;
 const pts=[[-.5,0,0],[-.3,.09,0],[-.1,-.07,0],[.1,.09,0],[.3,-.07,0],[.5,.04,0]];
 const radius=t=>R*Math.pow(Math.sin(Math.PI*Math.min(1,Math.max(0,t))),.35)*(1-.15*t);
 const win={t:[.05,.9],a:[0,Math.PI]};
 const CU=hex(0xe7c9b2);
 const wall=b.loft('cuticle','cuticle',{spine:pts,samples:mobile?140:260,radial:mobile?20:32,window:win,thickness:.003,profile:t=>[radius(t),radius(t)],disp:(t,a)=>.0003*Math.sin(t*900)-.0012*Math.exp(-((Math.sin((a-Math.PI/2)))**2)/.01)-.0012*Math.exp(-((Math.sin(a+Math.PI/2))**2)/.01),
  color:(t,a,p)=>mix(mix(CU,hex(0xd9b09a),.5+.5*fbm(p[0]*80,p[1]*80,p[2]*80,3)),hex(0xc69a86),Math.exp(-((Math.sin(a-Math.PI/2))**2)/.02)*.6),innerTissue:'muscle',innerColor:(t,a,p)=>mix(hex(0xe6d2c2),hex(0xd4bba6),.5+.5*Math.sin(a*12)),lipColor:()=>hex(0xd9bca8)});
 const S=t=>{const i=Math.min(wall.samples,Math.max(0,Math.round(t*wall.samples)));return{p:wall.S[i],N:wall.F.N[i],B:wall.F.B[i]}};
 const P=(t,y,z)=>{const f=S(t);return add(f.p,add(scale(f.N,y*radius(t)),scale(f.B,z*radius(t))))};
 // Lips around the mouth.
 for(let i=0;i<3;i++){const a=i/3*TAU;b.blob('mouth-pharynx','cuticle',add(P(0,0,0),[-.002,.007*Math.cos(a),.007*Math.sin(a)]),[.004,.005,.005],{nu:10,nv:8,color:hex(0xe2c0a8)})}
 // Muscular pharynx and the flattened intestine running to the anus near the tail.
 b.tube('mouth-pharynx','muscle',Array.from({length:9},(_,i)=>P(.01+i*.006,0,0)),.006,{samples:24,radial:12,color:hex(0xd8a898)});
 b.tube('intestine','organ',Array.from({length:41},(_,i)=>P(.06+i*.0225,.05,0)),t=>.0055,{samples:mobile?120:220,radial:10,disp:(t,a)=>.0015*Math.cos(2*a),color:(t,a,p)=>mix(hex(0xb88a6a),hex(0x9a6e52),.5+.5*fbm(p[0]*60,p[1]*60,p[2]*60,2))});
 b.blob('intestine','muscle',P(.965,-.2,.0),[.004,.003,.003],{nu:10,nv:6,color:hex(0xc89a80)});
 // Female genital system: paired coiled ovaries and oviducts, two uteri joining at the vulva (front third).
 for(const s of[1,-1]){const coil=[];const n=mobile?120:220;for(let i=0;i<=n;i++){const u=i/n,t=.36+u*.5,a=u*90+s;coil.push(P(t,-.25+.38*Math.cos(a),s*.18+.38*Math.sin(a)))}
  b.tube('reproductive','organ',coil,u=>.0018+.0018*u,{samples:n*3,radial:6,color:(t,a,p)=>mix(hex(0xf3ecde),hex(0xe8d8c0),t)});
  b.tube('reproductive','organ',[P(.36,-.2,s*.2),P(.3,-.35,s*.3),P(.33,-.5,0)],.003,{samples:20,radial:8,color:hex(0xead9be)})}
 b.blob('reproductive','organ',P(.33,-.7,0),[.004,.004,.004],{nu:10,nv:6,color:hex(0xd0a890)});
 // Nerve ring around the pharynx; dorsal and ventral nerve cords in the body wall.
 {const ring=[];for(let i=0;i<=24;i++){const a=i/24*TAU;ring.push(P(.035,.75*Math.cos(a),.75*Math.sin(a)))}b.tube('nerves','nerve',ring,.0012,{samples:40,radial:4,ends:false,color:hex(0xf3ead8)});
  for(const y of[.86,-.86])b.tube('nerves','nerve',Array.from({length:31},(_,i)=>P(.035+i*.03,y,0)),.001,{samples:90,radial:4,color:hex(0xf3ead8)})}
 // Excretory canals in the lateral cords (H-shaped system) opening at the excretory pore.
 b.tube('excretory-canals','membrane',Array.from({length:31},(_,i)=>P(.04+i*.03,0,-.88)),.0011,{samples:90,radial:4,color:hex(0xe0ecf0)});
 b.tube('excretory-canals','membrane',[P(.05,0,-.88),P(.05,-.5,-.4),P(.05,-.95,0)],.0011,{samples:12,radial:4,color:hex(0xe0ecf0)});
 // Pseudocoelom: fluid-filled cavity (hydrostatic skeleton), shown as a pale lining on the far side.
 b.grid('pseudocoelom','membrane',2,61,(r,c)=>{const t=.06+.83*c/60;return P(t,(r?.8:-.8),-.55)},{color:()=>hex(0xf4ece0),outward:()=>[0,0,1]});
}

// ---------- Cnidarian: freshwater hydra (Hydra) ----------
// Upright polyp, 1 unit ≈ 1.5 cm: basal disc at the bottom, mouth on the hypostome at the top with a ring
// of six tentacles. The front half of the column is opened to show the two cell layers, the mesoglea and
// the gastrovascular cavity; a lens shows one cnidocyte with its nematocyst.
export function hydra(b){
 const mobile=b.mobile,rnd=rand(79);
 const H=.62,base=-.3,radius=t=>.055*(1-.35*smooth(.0,.35,t)+.25*smooth(.55,.85,t))*(t<.04?.7+7.5*t:1)*(t>.92?Math.sqrt(Math.max(.05,(1-t)/.08)):1);
 const spine=[[0,base,0],[.01,base+H*.35,0],[-.01,base+H*.7,0],[0,base+H,0]];
 const win={t:[.06,.9],a:[Math.PI,TAU]};
 const ep=b.loft('epidermis','skin',{spine,samples:mobile?60:110,radial:mobile?28:44,up:[1,0,0],window:win,thickness:.01,profile:t=>[radius(t),radius(t)],disp:(t,a)=>.0015*fbm(t*30,Math.cos(a)*3,Math.sin(a)*3,2),
  color:(t,a,p)=>mix(hex(0xd9c3a4),hex(0xc4a888),.5+.5*fbm(p[0]*50,p[1]*50,p[2]*50,3)),innerTissue:'membrane',innerColor:()=>hex(0xeee4cf),lipColor:(t,a,p)=>mix(hex(0xe7d6b8),hex(0xcdb391),.5+.5*noise3(p[0]*200,p[1]*200,p[2]*200))});
 b.loft('gastrodermis','organ',{spine,samples:mobile?60:110,radial:mobile?28:44,up:[1,0,0],window:win,thickness:.012,profile:t=>{const r=Math.max(.004,radius(t)-.013);return[r,r]},color:()=>hex(0x8a7a3e),innerColor:(t,a,p)=>mix(hex(0x9a8a42),hex(0x6f7a32),.5+.5*fbm(p[0]*120,p[1]*120,p[2]*120,3)),lipColor:()=>hex(0x9a8c50)});
 // Food in the gastrovascular cavity (digestion starts there, ends inside gastrodermal cells).
 for(let i=0;i<(mobile?3:6);i++)b.blob('gastrovascular-cavity','granule',[(rnd()-.5)*.02,base+H*(.3+rnd()*.35),-.01],[.012,.01,.01],{nu:12,nv:8,color:hex(0xb87a4a)});
 b.grid('gastrovascular-cavity','membrane',2,2,(r,c)=>[(c-.5)*.04,base+H*(.1+.75*r),-.015],{color:()=>hex(0xe9f0ea),outward:()=>[0,0,1]});
 // Hypostome with the mouth and six hollow tentacles with batteries of cnidocytes.
 const top=[0,base+H,0];b.blob('mouth-hypostome','muscle',top,[.035,.025,.035],{nu:20,nv:12,cut:(t)=>t<.05,color:hex(0xd8bb98)});
 for(let k=0;k<6;k++){const a=k/6*TAU+.2,dir=[Math.cos(a),0,Math.sin(a)],pts=[];const L=.55+.15*rnd();for(let i=0;i<=12;i++){const u=i/12;pts.push([top[0]+dir[0]*(.03+u*L*.45),top[1]-.01+u*L*(.75-.9*u)+.05*Math.sin(u*3+k),top[2]+dir[2]*(.03+u*L*.45)])}
  b.tube('tentacles','skin',pts,t=>.011*(1-.6*t),{samples:mobile?40:80,radial:mobile?8:12,disp:(t,a)=>.0035*Math.max(0,Math.sin(t*70)),color:(t,a,p)=>mix(hex(0xe0cba8),hex(0xf2e6d0),Math.max(0,Math.sin(t*70)))})}
 // Basal disc: glands secrete an adhesive to hold on and glide.
 b.blob('basal-disc','organ',[0,base,0],[.04,.012,.04],{nu:20,nv:10,color:hex(0xbfa07a)});
 // Bud: a new polyp growing from the column (asexual reproduction), and a testis bump.
 {const t=.38,p=[radius(t)*.95,base+H*t,-.03],dir=norm([1,.55,-.25]),pts=[p,madd(p,dir,.06),madd(p,dir,.12)];b.tube('reproduction','skin',pts,t=>.024*(1-.35*t),{samples:20,radial:16,color:hex(0xd9c3a4)});
  for(let k=0;k<4;k++){const a=k/4*TAU,d=norm(add(scale(dir,.3),[Math.cos(a)*.7,.4,Math.sin(a)*.7])),tip=madd(pts[2],dir,.01);b.tube('reproduction','skin',[tip,madd(tip,d,.05),madd(tip,d,.09)],t=>.006*(1-.6*t),{samples:16,radial:8,color:hex(0xe0cba8)})}
  b.blob('reproduction','organ',[-radius(.72)*.9,base+H*.72,-.025],[.014,.02,.014],{nu:14,nv:10,color:hex(0xefe6d4)})}
 // Nerve net: a diffuse web of neurons at the base of the epidermis, no brain.
 for(let i=0;i<(mobile?30:70);i++){const t=.08+rnd()*.8,a=rnd()*Math.PI,r=radius(t)-.006,p=[r*Math.cos(a),base+H*t,-r*Math.sin(a)],q=[r*Math.cos(a+.4),base+H*(t+.05),-r*Math.sin(Math.min(Math.PI,a+.4))];b.tube('nerve-net','nerve',[p,q],.0016,{samples:6,radial:4,color:hex(0x9fb3c8)});b.blob('nerve-net','nerve',p,[.003,.003,.003],{nu:6,nv:4,color:hex(0x8fa6c0)})}
 // Lens: a cnidocyte with its cnidocil (trigger) and the nematocyst capsule with the coiled thread.
 {const o=[.42,.05,0],k=1.2,X=p=>[o[0]+p[0]*k,o[1]+p[1]*k,o[2]+p[2]*k],ring=[];for(let i=0;i<=72;i++){const a=i/72*TAU;ring.push([o[0]+.17*Math.cos(a),o[1]+.17*Math.sin(a),o[2]-.01])}b.tube('cnidocyte','protein',ring,.002,{samples:144,radial:6,ends:false,color:hex(0xd8d4c8)});
  b.blob('cnidocyte','membrane',X([0,-.02,0]),[.06*k,.08*k,.05*k],{nu:24,nv:16,cut:(t,u)=>u<.5,color:hex(0xe9dcc4)});
  b.blob('cnidocyte','granule',X([0,-.0,0]),[.03*k,.05*k,.03*k],{nu:20,nv:14,color:hex(0xf2ead6)});
  const coil=[];for(let i=0;i<=80;i++){const u=i/80;coil.push(X([.018*Math.cos(u*30),-.035+.07*u,.018*Math.sin(u*30)]))}b.tube('cnidocyte','protein',coil,.002*k,{samples:240,radial:4,color:hex(0x9a7a5a)});
  b.strand('cnidocyte','cilium',[X([.0,.06,0]),X([.004,.09,0]),X([.002,.11,0])],.003*k,.002*k,{seg:4,radial:4,color:hex(0xe0d4bc)});
  b.blob('cnidocyte','nucleus',X([.03,-.07,.01]),[.012*k,.012*k,.012*k],{nu:12,nv:8,color:hex(0x8a6aa0)})}
}

// ---------- Green alga: Volvox colony ----------
// A hollow sphere of biflagellate cells in a gelatinous matrix, with daughter colonies inside (1 unit ≈
// 0.5 mm). The front is opened; a lens shows a single cell (similar to Chlamydomonas).
export function volvox(b){
 const mobile=b.mobile,rnd=rand(83),R=.32,C=[-.12,0,0];
 b.blob('matrix','gel',C,[R,R,R],{nu:mobile?40:64,nv:mobile?24:40,cut:(t,u)=>Math.sin(t*Math.PI)*Math.sin(u*TAU)>.35,color:p=>mix(hex(0xd9e8c8),hex(0xc4dab0),.5+.5*fbm(p[0]*20,p[1]*20,p[2]*20,2))});
 const n=mobile?420:1100,golden=Math.PI*(3-Math.sqrt(5));
 for(let i=0;i<n;i++){const y=1-2*(i+.5)/n,r=Math.sqrt(1-y*y),a=i*golden,d=[r*Math.cos(a),y,r*Math.sin(a)];if(d[2]>.35)continue;const p=madd(C,d,R*.995);
  b.blob('somatic-cells','plant',p,[.007,.007,.007],{nu:6,nv:4,color:mix(hex(0x3f8a2e),hex(0x5ea03a),rnd())});
  if(!mobile&&i%3===0)b.strand('somatic-cells','cilium',[p,madd(p,d,.012),madd(madd(p,d,.022),[0,1,0],.004)],.0012,.0008,{seg:2,radial:3,color:hex(0xdfead0)})}
 // Daughter colonies inside the parent, released when it breaks apart (asexual reproduction).
 const kids=[[-.2,.1,-.05,.09],[-.02,-.12,-.08,.08],[-.24,-.14,.05,.07],[.0,.12,.06,.075],[-.14,.02,.15,.065]];
 for(const [x,y,z,r] of kids){const c=add(C,[x+.12,y,z]);b.blob('daughter-colonies','gel',c,[r,r,r],{nu:24,nv:16,color:hex(0xc8e0b0)});const m=mobile?60:140;for(let i=0;i<m;i++){const yy=1-2*(i+.5)/m,rr=Math.sqrt(1-yy*yy),a=i*golden;b.blob('daughter-colonies','plant',madd(c,[rr*Math.cos(a),yy,rr*Math.sin(a)],r*.98),[.005,.005,.005],{nu:5,nv:3,color:hex(0x2f7a24)})}}
 // Gonidia and an egg: larger reproductive cells (sexual reproduction makes a resistant zygote).
 for(let i=0;i<4;i++){const d=norm([rnd()-.5,rnd()-.5,-.6-rnd()]);b.blob('reproductive-cells','plant',madd(C,d,R*.93),[.018,.018,.018],{nu:12,nv:8,color:hex(0x2e6b22)})}
 // Lens: one cell with two flagella, cup-shaped chloroplast, pyrenoid, eyespot and contractile vacuoles.
 {const o=[.42,.18,0],k=2.4,X=p=>[o[0]+p[0]*k,o[1]+p[1]*k,o[2]+p[2]*k],ring=[];for(let i=0;i<=72;i++){const a=i/72*TAU;ring.push([o[0]+.15*Math.cos(a),o[1]+.15*Math.sin(a),o[2]-.01])}b.tube('single-cell','protein',ring,.002,{samples:144,radial:6,ends:false,color:hex(0xd8d4c8)});
  b.blob('single-cell','membrane',X([0,0,0]),[.03*k,.04*k,.03*k],{nu:24,nv:16,cut:(t,u)=>u<.5&&t>.15,color:hex(0xdfeccf)});
  b.blob('single-cell','plant',X([0,-.008,-.004]),[.026*k,.032*k,.024*k],{nu:22,nv:14,cut:(t)=>t<.35,color:hex(0x3f8a2e)});
  b.blob('single-cell','granule',X([0,-.025,0]),[.007*k,.007*k,.007*k],{nu:10,nv:8,color:hex(0xe9e2b0)});
  b.blob('single-cell','nucleus',X([0,.01,0]),[.009*k,.009*k,.009*k],{nu:12,nv:8,color:hex(0x8a6aa0)});
  b.blob('single-cell','granule',X([.022,.018,.008]),[.004*k,.006*k,.003*k],{nu:8,nv:6,color:hex(0xd2452a)});
  for(const s of[1,-1]){b.blob('single-cell','membrane',X([s*.008,.03,.006]),[.004*k,.004*k,.004*k],{nu:8,nv:6,color:hex(0xcfe6ee)});
   b.strand('single-cell','cilium',[X([s*.005,.04,0]),X([s*.03,.08,0]),X([s*.05,.1,0]),X([s*.07,.09,0])],.002*k,.0015*k,{seg:8,radial:4,color:hex(0xe8f0dc)})}}
}
