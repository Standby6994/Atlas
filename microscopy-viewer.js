// Photographs remain unmodified; zoom is the installed image's pixel scale, not calibrated magnification.
let activeCleanup=null;
const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!=null)el.textContent=text;return el};

export function openMicroscopyViewer(slide,opener,onAnnotation){
 activeCleanup?.();
 const dialog=node('dialog','microscopy-dialog'),heading=node('h2',null,slide.label);
 heading.id='microscopy-dialog-title';dialog.setAttribute('aria-labelledby',heading.id);dialog.dataset.microscopyViewer='';
 const header=node('div','microscopy-dialog-header'),close=node('button','quiet','Fechar');close.type='button';close.setAttribute('aria-label','Fechar visualizador de microscopia');header.append(heading,close);
 const toolbar=node('div','microscopy-dialog-toolbar'),minus=node('button',null,'−'),plus=node('button',null,'+'),fit=node('button',null,'Ajustar à tela'),actual=node('button',null,'Pixels da imagem'),status=node('output','microscopy-zoom-status','Carregando imagem…');
 status.setAttribute('aria-live','polite');minus.setAttribute('aria-label','Diminuir zoom');plus.setAttribute('aria-label','Aumentar zoom');
 minus.dataset.microscopyZoomOut='';plus.dataset.microscopyZoomIn='';fit.dataset.microscopyReset='';actual.dataset.microscopyActual='';close.dataset.microscopyClose='';
 const buttons=[minus,plus,fit,actual];for(const button of buttons){button.type='button';button.disabled=true}toolbar.append(minus,plus,fit,actual,status);
 const help=node('p','microscopy-dialog-help','Arraste para mover; use dois dedos ou + e − para ampliar. Pelo teclado: setas para mover, +/− para zoom, 0 para ajustar e 1 para pixels da imagem.');help.id='microscopy-dialog-help';
 const viewport=node('div','microscopy-slide-viewport');viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label','Imagem de microscopia ampliável');viewport.setAttribute('aria-describedby',help.id);
 const image=node('img','microscopy-slide-image');image.alt=slide.label;image.decoding='async';image.draggable=false;viewport.append(image);
 const annotationList=Array.isArray(slide.annotations)?slide.annotations:[],markers=node('div','microscopy-annotations-overlay');markers.setAttribute('aria-label','Estruturas identificadas na fotografia');viewport.append(markers);
 const annotationSection=node('section','microscopy-annotation-section'),annotationHeading=node('h3',null,'Estruturas identificadas'),annotationButtons=node('div','microscopy-annotation-list'),annotationDescription=node('p','microscopy-annotation-description'),compare=node('button','quiet microscopy-compare','Comparar esta estrutura no modelo 3D');
 compare.type='button';compare.dataset.microscopyCompare='';compare.hidden=true;annotationDescription.setAttribute('aria-live','polite');annotationDescription.textContent='Selecione um número na imagem ou um nome abaixo. As marcações são orientações didáticas sobre a fotografia, sem alterar seus pixels.';
 const markerButtons=[],listButtons=[];
 for(const [index,annotation] of annotationList.entries()){
  const marker=node('button','microscopy-annotation-marker',String(index+1)),item=node('button','quiet microscopy-annotation-item',(index+1)+'. '+annotation.label);
  for(const button of [marker,item]){button.type='button';button.dataset.microscopyAnnotation=String(index);button.setAttribute('aria-pressed','false');button.disabled=true}
  marker.setAttribute('aria-label',(index+1)+'. '+annotation.label);marker.title=annotation.label;markers.append(marker);annotationButtons.append(item);markerButtons.push(marker);listButtons.push(item);
 }
 annotationSection.append(annotationHeading,annotationButtons,annotationDescription,compare);if(!annotationList.length)annotationSection.hidden=true;
 const footer=node('div','microscopy-dialog-footer');footer.append(node('p',null,slide.caption));
 for(const [key,label] of [['species','Espécie'],['organRegion','Órgão / região'],['orientation','Orientação / corte'],['stage','Estágio']])footer.append(node('p','microscopy-'+key,label+': '+(slide[key]||'não informado pela fonte.')));
 if(slide.comparison)footer.append(node('p','microscopy-model-comparison','Comparação com o modelo: '+slide.comparison));
 if(slide.sourceLabels?.length)footer.append(node('p','microscopy-source-labels','Tradução dos rótulos preservados no original: '+slide.sourceLabels.map(label=>label.original+' = '+label.pt).join('; ')+'.'));
 footer.append(node('p','microscopy-technique',slide.technique||'Microscopia óptica; técnica específica não informada pela fonte.'));
 footer.append(node('p','microscopy-stain','Coloração / marcação: '+(slide.stain||'não informada pela fonte.')));
 footer.append(node('p','microscopy-magnification','Ampliação informada na fonte: '+(slide.originalMagnification||'não informada.')));
 const calibration=slide.scaleCalibration,scaleNote=typeof calibration==='string'?calibration:calibration&&typeof calibration==='object'?[calibration.source,calibration.scope].filter(value=>typeof value==='string'&&value.trim()).join(' '):'';
 footer.append(node('p','microscopy-scale-note',scaleNote||'Zoom digital sem escala física calibrada. Ampliar além dos pixels da imagem não acrescenta detalhes à fotografia.'));
 footer.append(node('p','microscopy-resolution','Imagem disponível no Atlas: '+slide.width+' × '+slide.height+' pixels.'+(slide.sourceWidth&&slide.sourceHeight&&(slide.sourceWidth!==slide.width||slide.sourceHeight!==slide.height)?' Original da fonte: '+slide.sourceWidth+' × '+slide.sourceHeight+' pixels; esta cópia é a miniatura oficial, sem ampliação artificial.':'')));
 const credits=node('p',null,slide.author+' · '+slide.license+' · '),source=node('a',null,'Fonte'),license=node('a',null,'Licença');source.href=slide.sourceUrl;license.href=slide.licenseUrl;for(const link of [source,license]){link.target='_blank';link.rel='noreferrer'}credits.append(source,' · ',license);if(slide.originalUrl){const original=node('a',null,'Arquivo original da fonte');original.href=slide.originalUrl;original.target='_blank';original.rel='noreferrer';credits.append(' · ',original)}footer.append(credits);
 dialog.append(header,toolbar,help,viewport,annotationSection,footer);document.body.append(dialog);
 const controller=new AbortController(),signal=controller.signal,pointers=new Map();
 let closed=false,loaded=false,scale=1,x=0,y=0,autoFit=true,lastPinch=null,selectedAnnotation=null;
 const listen=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal});
 const fitScale=()=>Math.min(viewport.clientWidth/image.naturalWidth,viewport.clientHeight/image.naturalHeight,1);
 function paint(){if(!loaded)return;const w=viewport.clientWidth,h=viewport.clientHeight,iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;x=iw<=w?(w-iw)/2:Math.min(0,Math.max(w-iw,x));y=ih<=h?(h-ih)/2:Math.min(0,Math.max(h-ih,y));image.style.transform=`translate(${x}px, ${y}px) scale(${scale})`;for(const [index,annotation] of annotationList.entries()){const marker=markerButtons[index];marker.style.left=(x+annotation.x*iw)+'px';marker.style.top=(y+annotation.y*ih)+'px'}status.textContent=Math.round(scale*100)+'% dos pixels da imagem';minus.disabled=scale<=Math.max(.01,fitScale()*.5);plus.disabled=scale>=4;viewport.classList.toggle('can-pan',iw>w||ih>h)}
 function selectAnnotation(index){selectedAnnotation=annotationList[index];if(!selectedAnnotation)return;for(let i=0;i<annotationList.length;i++)for(const button of [markerButtons[i],listButtons[i]])button.setAttribute('aria-pressed',String(i===index));annotationDescription.textContent=selectedAnnotation.label+' — '+selectedAnnotation.description;compare.hidden=typeof onAnnotation!=='function'||!selectedAnnotation.viewId||!selectedAnnotation.partId;compare.textContent='Comparar '+selectedAnnotation.label+' no modelo 3D';dialog.dataset.selectedAnnotation=String(index)}
 function zoom(value,px=viewport.clientWidth/2,py=viewport.clientHeight/2){if(!loaded)return;const next=Math.max(Math.max(.01,fitScale()*.5),Math.min(4,value)),ratio=next/scale;x=px-(px-x)*ratio;y=py-(py-y)*ratio;scale=next;autoFit=false;paint()}
 function reset(){if(!loaded)return;scale=fitScale();x=0;y=0;autoFit=true;paint()}
 function cleanup(){if(closed)return;closed=true;controller.abort();observer.disconnect();pointers.clear();image.onload=null;image.onerror=null;image.removeAttribute('src');image.remove();if(dialog.open)dialog.close();dialog.remove();if(activeCleanup===cleanup)activeCleanup=null;if(opener?.isConnected)opener.focus({preventScroll:true})}
 activeCleanup=cleanup;
 for(let index=0;index<annotationList.length;index++)for(const button of [markerButtons[index],listButtons[index]]){
  listen(button,'pointerdown',event=>event.stopPropagation());listen(button,'click',event=>{event.stopPropagation();selectAnnotation(index)})
 }
 listen(compare,'click',()=>{if(!selectedAnnotation||typeof onAnnotation!=='function')return;const annotation=selectedAnnotation;cleanup();onAnnotation(annotation,slide)});
 listen(close,'click',cleanup);listen(dialog,'close',cleanup);listen(dialog,'cancel',event=>{event.preventDefault();cleanup()});
 listen(dialog,'click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)cleanup()});
 listen(minus,'click',()=>zoom(scale/1.25));listen(plus,'click',()=>zoom(scale*1.25));listen(fit,'click',reset);listen(actual,'click',()=>zoom(1));
 listen(viewport,'keydown',event=>{if(!loaded||event.ctrlKey||event.altKey||event.metaKey)return;let handled=true;switch(event.key){case '+':case '=':zoom(scale*1.25);break;case '-':zoom(scale/1.25);break;case '0':reset();break;case '1':zoom(1);break;case 'ArrowLeft':x+=50;autoFit=false;paint();break;case 'ArrowRight':x-=50;autoFit=false;paint();break;case 'ArrowUp':y+=50;autoFit=false;paint();break;case 'ArrowDown':y-=50;autoFit=false;paint();break;default:handled=false}if(handled)event.preventDefault()});
 listen(viewport,'wheel',event=>{if(!loaded)return;event.preventDefault();const r=viewport.getBoundingClientRect();zoom(scale*Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.003),event.clientX-r.left,event.clientY-r.top)},{passive:false});
 const pinch=()=>{const [a,b]=[...pointers.values()];return a&&b?{distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2}:null};
 listen(viewport,'pointerdown',event=>{if(!loaded||event.button!==0||event.target.closest('button'))return;event.preventDefault();viewport.focus({preventScroll:true});viewport.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});lastPinch=pinch()});
 listen(viewport,'pointermove',event=>{const previous=pointers.get(event.pointerId);if(!previous)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===1){x+=event.clientX-previous.x;y+=event.clientY-previous.y;autoFit=false;paint()}else{const next=pinch();if(lastPinch&&next&&lastPinch.distance>0){const r=viewport.getBoundingClientRect();zoom(scale*next.distance/lastPinch.distance,lastPinch.x-r.left,lastPinch.y-r.top);x+=next.x-lastPinch.x;y+=next.y-lastPinch.y;paint()}lastPinch=next}});
 const release=event=>{pointers.delete(event.pointerId);lastPinch=pinch()};for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(viewport,type,release);
 const observer=new ResizeObserver(()=>{if(loaded){if(autoFit)reset();else paint()}});observer.observe(viewport);
 image.onload=()=>{if(closed)return;loaded=true;image.style.width=image.naturalWidth+'px';image.style.height=image.naturalHeight+'px';for(const button of [...buttons,...markerButtons,...listButtons])button.disabled=false;reset()};
 image.onerror=()=>{if(!closed){status.textContent='Não foi possível carregar esta imagem. Use o link da resolução original ou confira o download offline.';image.hidden=true}};
 dialog.showModal();close.focus();image.src=slide.image;
 return cleanup;
}

