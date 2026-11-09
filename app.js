/* CODE / local interaction study. No dependencies, tracking, or remote assets. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, v) => { const t = clamp((v-a)/(b-a),0,1); return t*t*(3-2*t); };
  const items = [
    { number:'01', definition:'material form', title:'An etymology', asset:'01-tablet.png', home:[-.77,-.43] },
    { number:'02', definition:'instruction', title:'An instruction', asset:'02-instruction.jpg', home:[.06,-.70] },
    { number:'03', definition:'translation', title:'Mediating legibility', asset:'03-translation.png', home:[.88,-.07] },
    { number:'04', definition:'shared convention', title:'A shared convention', asset:'04-convention.png', home:[-.57,.65] },
    { number:'05', definition:'a tool for building complexity', title:'A generative rule', asset:'05-rule.png', home:[.29,.79] }
  ];
  const edges = [[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]];
  const state = { phase:'material', zoom:0, zoomTarget:0, hover:-1, focus:-1, paused:matchMedia('(prefers-reduced-motion: reduce)').matches, time:0, last:0, ready:false, entry:0, reveal:0 };
  let width=innerWidth, height=innerHeight, dpr=1, particles=[], pointer={x:-9999,y:-9999,active:false}, touchStart=null;
  const canvas=$('cloud'), ctx=canvas.getContext('2d');
  let cellSize = 28;
  let glyphs = [];
  let seed=25013;
  function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
  const nodes=items.map((item,i)=>{
    const button=document.createElement('button');button.className='node';button.disabled=true;
    button.setAttribute('aria-label',`${item.number}. Code as ${item.definition}. Open entry`);
    const label=document.createElement('span');label.className='node-label';
    const number=document.createElement('span');number.className='node-number';number.textContent=item.number;
    const definition=document.createElement('span');definition.className='node-definition';definition.textContent=`code as ${item.definition}`;
    label.append(number,definition);
    const img=document.createElement('img');img.src=`assets/${item.asset}`;img.alt=`Source image for ${item.title}`;img.draggable=false;
    button.append(label,img);$('nodes').append(button);
    button.addEventListener('pointerenter',()=>{if(state.ready)state.hover=i;});
    button.addEventListener('pointerleave',()=>{if(state.hover===i)state.hover=-1;});
    button.addEventListener('focus',()=>{state.focus=i;});button.addEventListener('blur',()=>{state.focus=-1;});
    button.addEventListener('click',()=>{if(state.ready)openEntry(i);});
    return {button,x:0,y:0,vx:0,vy:0,home:item.home};
  });
  const lines=edges.map(()=>{const line=document.createElementNS('http://www.w3.org/2000/svg','line');$('links').append(line);return line;});

  function fit(){
    width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    makeParticles();placeNodes(true);
  }
  function metrics(){return {x:width*.40, y:height*.38, cy:height*.50};}
  function placeNodes(reset=false){
    const m=metrics();nodes.forEach(n=>{n.baseX=width/2+n.home[0]*m.x;n.baseY=m.cy+n.home[1]*m.y;if(reset){n.x=n.baseX;n.y=n.baseY;n.vx=0;n.vy=0;}});
  }
  function makeGlyph(text, color, family, fontScale, outline = false) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 96;
    const pen = tile.getContext('2d');
    pen.font = `${96 * fontScale}px ${family}`;
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    pen.fillStyle = color;
    if (outline) {
      pen.strokeStyle = color;
      pen.lineWidth = 30;
      pen.lineJoin = 'miter';
      pen.miterLimit = 3;
      pen.strokeText(text, 48, 49, 60);
    }
    pen.fillText(text, 48, 49, outline ? 60 : 81);
    return tile;
  }

  function makeParticles() {
    seed = 25013;
    cellSize = clamp(width * .0205, 21, 39);
    const arial = 'Arial, sans-serif';
    glyphs = [
      [makeGlyph('囍', '#C66674', '"PingFang SC", sans-serif', .73)],
      ['—··', '··—', '·—·', '——', '···'].map(text => makeGlyph(text, '#E0B894', arial, .56)),
      ['/ \\', '\\ /', '//', '/'].map(text => makeGlyph(text, '#4E5893', arial, .73)),
      Array.from('CODEMATERIALFORM', letter => makeGlyph(letter, '#2A3313', arial, .50, true)),
      [makeGlyph('▪', '#515151', arial, .76)]
    ];
    particles = [];
    const columns = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    for (let row = -1; row <= rows; row++) {
      for (let column = -1; column <= columns; column++) {
        const group = glyphs[Math.floor(rand() * glyphs.length)];
        particles.push({
          glyph: group[Math.floor(rand() * group.length)],
          x: (column + .5) * cellSize - (columns * cellSize - width) / 2,
          y: (row + .5) * cellSize - (rows * cellSize - height) / 2,
          phase: rand() * Math.PI * 2,
          dx: 0,
          dy: 0,
          exit: rand() * .16
        });
      }
    }
  }
  function say(text){$('announcement').textContent=text;}
  function goNetwork(){
    window.CODE_DETAIL.close();
    state.phase='material';
    state.hover=-1;
    state.focus=-1;
    state.zoomTarget=1;
    $('universe').hidden=false;
    $('universe').focus({preventScroll:true});
  }
  function reset(){
    state.zoomTarget=0;
    state.hover=-1;
    state.focus=-1;
    pointer.active=false;
    $('universe').focus({preventScroll:true});
  }
  function updateReady(){
    const ready=state.zoom>.94;
    if(ready===state.ready)return;
    state.ready=ready;
    if(!ready)state.hover=-1;
    nodes.forEach(({button})=>{button.disabled=!ready;button.tabIndex=ready?0:-1;});
    if(ready)say('Five connected images. Hover to pause and choose an image to open.');
  }
  const cardInsetX=()=> (width<760?clamp(width*.28,100,155):clamp(width*.215,150,305))/2+8;
  const cardInsetY=()=> clamp(height*.32,110,300)/2+19;
  function stepNetwork(dt){
    const frozen=state.paused||state.hover>=0||state.focus>=0;
    if(!frozen){
      const speed=dt*60;
      nodes.forEach((n,i)=>{
        const tx=state.time, px=i*2.32, py=i*3.77;
        const roomX=Math.max(25,width/2-cardInsetX()),roomY=Math.max(35,height/2-cardInsetY());
        const targetX=width/2+roomX*(.79*Math.sin(tx*(.18+i*.018)+px)+.21*Math.sin(tx*.39+py));
        const targetY=height/2+roomY*(.79*Math.cos(tx*(.22+i*.021)+py)+.21*Math.sin(tx*.46+px));
        n.vx+=(targetX-n.x)*.0037*speed;n.vy+=(targetY-n.y)*.0037*speed;

      });
      edges.forEach(([a,b])=>{
        const p=nodes[a],q=nodes[b];const dx=q.x-p.x,dy=q.y-p.y,dist=Math.hypot(dx,dy)||1;
        const rest=Math.hypot(q.baseX-p.baseX,q.baseY-p.baseY);
        const force=(dist-rest)*.00025*speed;p.vx+=dx/dist*force;p.vy+=dy/dist*force;q.vx-=dx/dist*force;q.vy-=dy/dist*force;
      });
      nodes.forEach(n=>{n.vx*=Math.pow(.94,speed);n.vy*=Math.pow(.94,speed);n.x+=n.vx*speed;n.y+=n.vy*speed;const insetX=cardInsetX(),insetY=cardInsetY();n.x=clamp(n.x,insetX,width-insetX);n.y=clamp(n.y,insetY,height-insetY);});
    }
    nodes.forEach((n,i)=>{const selected=i===state.hover||i===state.focus;n.button.classList.toggle("selected",selected);n.button.style.zIndex=String(selected?10:i+1);n.button.style.left=`${n.x}px`;n.button.style.top=`${n.y}px`;});
    edges.forEach(([a,b],i)=>{lines[i].setAttribute('x1',nodes[a].x);lines[i].setAttribute('y1',nodes[a].y);lines[i].setAttribute('x2',nodes[b].x);lines[i].setAttribute('y2',nodes[b].y);});
    const scale=lerp(width<760?.20:.24, width<760?.83:1,state.zoom);
    $('network-world').style.transform=`scale(${scale})`;
    const cloudRadiusX=width*(.15+.22*state.zoom), cloudRadiusY=height*(.15+.20*state.zoom);
    const distance=Math.hypot((pointer.x-width/2)/cloudRadiusX,(pointer.y-height/2)/cloudRadiusY);
    const overCloud=pointer.active?1-smoothstep(.76,1,distance):0;
    state.reveal=lerp(state.reveal,overCloud,1-Math.exp(-dt*9));
    const imageOpacity = state.ready ? 1 : overCloud === 0 ? 0 : state.reveal;
    $('nodes').style.opacity=String(imageOpacity);
    $('connections').style.opacity=String(imageOpacity);
    $('network-wordmark').style.opacity=String(imageOpacity);
  }
  function paintCloud(dt) {
    ctx.clearRect(0, 0, width, height);
    if (state.zoom > .94) return;

    const time = state.time * .24;
    const stretch = 1 + state.zoom * 1.7;
    const radius = Math.min(width * .29, 240) + state.zoom * 48;
    const easing = 1 - Math.exp(-dt * 4.4);
    const centerX = width / 2;
    const centerY = height / 2;

    for (const particle of particles) {
      const weave = particle.x / (cellSize * 5) + particle.y / (cellSize * 7);
      const fold = particle.y / (cellSize * 4) - particle.x / (cellSize * 9);
      const homeX = centerX + (particle.x - centerX + cellSize *
        (.56 * Math.sin(fold + time) + .22 * Math.sin(weave - time * .7))) * stretch;
      const homeY = centerY + (particle.y - centerY + cellSize *
        (.53 * Math.sin(weave - time) + .21 * Math.cos(fold + time * .9))) * stretch;

      let pushX = 0;
      let pushY = 0;
      if (pointer.active) {
        const dx = homeX - pointer.x;
        const dy = homeY - pointer.y;
        const distance = Math.hypot(dx, dy);
        const angle = distance < 1 ? particle.phase : Math.atan2(dy, dx);
        const edge = radius * (1 + .15 * Math.sin(angle * 3 + time) + .11 * Math.cos(angle * 5));
        if (distance < edge) {
          const push = (edge - distance) * 1.14;
          const outward = angle + .24 * Math.sin(particle.phase);
          pushX = Math.cos(outward) * push;
          pushY = Math.sin(outward) * push;
        }
      }
      particle.dx = lerp(particle.dx, pushX, easing);
      particle.dy = lerp(particle.dy, pushY, easing);
      const size = cellSize * (1 - smoothstep(.48 + particle.exit, .93, state.zoom));
      if (size < 1) continue;
      ctx.drawImage(particle.glyph, homeX + particle.dx - size / 2,
        homeY + particle.dy - size / 2, size, size);
    }
  }
  function frame(now){
    const dt=Math.min((now-(state.last||now))/1000,.033);state.last=now;
    if(!state.paused&&state.phase!=='entry'&&state.hover<0&&state.focus<0)state.time+=dt;
    if(state.phase==='material'){
      state.zoom=lerp(state.zoom,state.zoomTarget,state.paused?1:1-Math.exp(-dt*6));if(Math.abs(state.zoom-state.zoomTarget)<.0003)state.zoom=state.zoomTarget;
      updateReady();stepNetwork(dt);paintCloud(dt);
    }
    requestAnimationFrame(frame);
  }

  function openEntry(index){
    state.entry=index;
    state.phase='entry';
    state.hover=-1;
    state.focus=-1;
    $('universe').hidden=true;
    window.CODE_DETAIL.open(items[index],index,goNetwork);
  }
  $('universe').addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY,active:true};});$('universe').addEventListener('pointerleave',()=>{pointer.active=false;state.hover=-1;});
  $('universe').addEventListener('wheel',e=>{if(state.phase!=='material')return;e.preventDefault();const factor=e.deltaMode===1?18:e.deltaMode===2?height:1;const delta=clamp(e.deltaY*factor,-120,120);state.zoomTarget=clamp(state.zoomTarget+(e.ctrlKey?-delta*.008:delta*.0018),0,1);},{passive:false});
  $('universe').addEventListener('touchstart',e=>{if(e.touches.length===2){touchStart={distance:Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY),zoom:state.zoomTarget};}else if(e.touches.length===1){touchStart={y:e.touches[0].clientY,zoom:state.zoomTarget};pointer={x:e.touches[0].clientX,y:e.touches[0].clientY,active:true};}},{passive:true});
  $('universe').addEventListener('touchmove',e=>{if(!touchStart)return;if(e.touches.length===2&&touchStart.distance){e.preventDefault();const distance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);state.zoomTarget=clamp(touchStart.zoom+(distance-touchStart.distance)/200,0,1);}else if(e.touches.length===1&&touchStart.y!==undefined){e.preventDefault();state.zoomTarget=clamp(touchStart.zoom+(touchStart.y-e.touches[0].clientY)/300,0,1);pointer={x:e.touches[0].clientX,y:e.touches[0].clientY,active:true};}},{passive:false});
  $('universe').addEventListener('touchend',()=>{touchStart=null;pointer.active=false;});
  addEventListener('keydown',event=>{
    if(state.phase==='entry'&&event.key==='Escape'){goNetwork();nodes[state.entry].button.focus();return;}
    if(state.phase!=='material')return;
    if(event.key==='Escape')reset();
    if(event.key==='+'||event.key==='=')state.zoomTarget=clamp(state.zoomTarget+.15,0,1);
    if(event.key==='-')state.zoomTarget=clamp(state.zoomTarget-.15,0,1);
  });
  addEventListener('resize',fit);
  fit();
  say('Move over the pixels to uncover the network. Scroll down or press plus to zoom in.');
  requestAnimationFrame(frame);
})();
