
// =====================
// CUSTOM CURSOR
// =====================
const cursor = document.getElementById('cursor');
const trail = document.getElementById('cursor-trail');
let mx=0,my=0,tx=0,ty=0;
document.addEventListener('mousemove',e=>{
  mx=e.clientX;my=e.clientY;
  cursor.style.left=mx+'px';cursor.style.top=my+'px';
});
function animateTrail(){
  tx+=(mx-tx)*0.12;ty+=(my-ty)*0.12;
  trail.style.left=tx+'px';trail.style.top=ty+'px';
  requestAnimationFrame(animateTrail);
}
animateTrail();
document.querySelectorAll('button,a,.nav-link,.tier-tab,.step-tab,.program-card').forEach(el=>{
  el.addEventListener('mouseenter',()=>{
    cursor.style.width='20px';cursor.style.height='20px';
    trail.style.width='50px';trail.style.height='50px';
    trail.style.opacity='0.5';
  });
  el.addEventListener('mouseleave',()=>{
    cursor.style.width='12px';cursor.style.height='12px';
    trail.style.width='36px';trail.style.height='36px';
    trail.style.opacity='1';
  });
});

// =====================
// HERO CANVAS - PARTICLES & STARS
// =====================
(function(){
  const canvas=document.getElementById('hero-canvas');
  const ctx=canvas.getContext('2d');
  function resize(){canvas.width=canvas.offsetWidth;canvas.height=canvas.offsetHeight;}
  resize();window.addEventListener('resize',resize);
  const particles=[];
  for(let i=0;i<120;i++){
    particles.push({
      x:Math.random()*canvas.width,
      y:Math.random()*canvas.height,
      r:Math.random()*1.5+0.3,
      vx:(Math.random()-.5)*0.3,
      vy:(Math.random()-.5)*0.3,
      o:Math.random()*0.6+0.1,
      flickerSpeed:Math.random()*0.02+0.005,
      flickerPhase:Math.random()*Math.PI*2
    });
  }
  let t=0;
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    t+=0.016;
    particles.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0)p.x=canvas.width;
      if(p.x>canvas.width)p.x=0;
      if(p.y<0)p.y=canvas.height;
      if(p.y>canvas.height)p.y=0;
      const flicker=Math.sin(t*50*p.flickerSpeed+p.flickerPhase)*0.3+0.7;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,255,255,${p.o*flicker})`;
      ctx.fill();
    });
    // Occasional bright sparkles
    if(Math.random()<0.03){
      const sx=Math.random()*canvas.width;
      const sy=Math.random()*canvas.height*0.5;
      ctx.beginPath();ctx.arc(sx,sy,2,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.9)';ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx-6,sy);ctx.lineTo(sx+6,sy);
      ctx.moveTo(sx,sy-6);ctx.lineTo(sx,sy+6);
      ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=0.5;ctx.stroke();
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// =====================
// 3D CUBE (THREE.JS) - About Section
// =====================
(function(){
  const canvas=document.getElementById('cube-canvas');
  if(!canvas||typeof THREE==='undefined')return;
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.offsetWidth||500,canvas.offsetHeight||400);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(60,canvas.offsetWidth/canvas.offsetHeight||1.25,0.1,100);
  camera.position.set(0,0,4);
  // Wireframe cube
  const geo=new THREE.BoxGeometry(1.8,1.8,1.8);
  const edges=new THREE.EdgesGeometry(geo);
  const mat=new THREE.LineBasicMaterial({color:0x3dff7a,transparent:true,opacity:0.7});
  const wireframe=new THREE.LineSegments(edges,mat);
  scene.add(wireframe);
  // Inner glow sphere
  const sGeo=new THREE.SphereGeometry(0.5,32,32);
  const sMat=new THREE.MeshBasicMaterial({color:0x3dff7a,transparent:true,opacity:0.05});
  scene.add(new THREE.Mesh(sGeo,sMat));
  // Outer particles
  const pGeo=new THREE.BufferGeometry();
  const pCount=200;
  const pPos=new Float32Array(pCount*3);
  for(let i=0;i<pCount*3;i++)pPos[i]=(Math.random()-0.5)*6;
  pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
  const pMat=new THREE.PointsMaterial({color:0xffffff,size:0.03,transparent:true,opacity:0.5});
  scene.add(new THREE.Points(pGeo,pMat));
  // Ambient light
  scene.add(new THREE.AmbientLight(0x3dff7a,0.5));
  let mouseX=0,mouseY=0;
  document.addEventListener('mousemove',e=>{
    mouseX=(e.clientX/window.innerWidth-0.5)*2;
    mouseY=-(e.clientY/window.innerHeight-0.5)*2;
  });
  function animate(){
    requestAnimationFrame(animate);
    wireframe.rotation.x+=0.005;
    wireframe.rotation.y+=0.008;
    wireframe.rotation.x+=mouseY*0.001;
    wireframe.rotation.y+=mouseX*0.001;
    mat.opacity=0.5+Math.sin(Date.now()*0.002)*0.2;
    renderer.render(scene,camera);
  }
  animate();
})();

// =====================
// GLOBE CANVAS
// =====================
(function(){
  const canvas=document.getElementById('globe-canvas');
  if(!canvas||typeof THREE==='undefined')return;
  const w=canvas.offsetWidth||600,h=canvas.offsetHeight||300;
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w,h);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(45,w/h,0.1,100);
  camera.position.set(0,0.5,4.5);
  // Globe
  const gGeo=new THREE.SphereGeometry(2,64,64);
  const gMat=new THREE.MeshPhongMaterial({
    color:0x000000,
    emissive:0x001a0a,
    specular:0x3dff7a,
    shininess:10,
    transparent:true,opacity:0.95,
    wireframe:false
  });
  const globe=new THREE.Mesh(gGeo,gMat);
  globe.position.y=-1.5;
  scene.add(globe);
  // Edge glow
  const ringGeo=new THREE.TorusGeometry(2,0.02,16,100);
  const ringMat=new THREE.MeshBasicMaterial({color:0x3dff7a,transparent:true,opacity:0.3});
  const ring=new THREE.Mesh(ringGeo,ringMat);
  ring.position.y=-1.5;ring.rotation.x=Math.PI/2;
  scene.add(ring);
  // Light
  const pLight=new THREE.PointLight(0x3dff7a,2,8);
  pLight.position.set(0,3,2);scene.add(pLight);
  scene.add(new THREE.AmbientLight(0x001a0a,1));
  function animate(){
    requestAnimationFrame(animate);
    globe.rotation.y+=0.002;
    ring.rotation.z+=0.001;
    renderer.render(scene,camera);
  }
  animate();
})();

// =====================
// metrics TICKER
// =====================
const metricss=[
  {name:'Ethereum',price:'(0.002) USD',change:'+11,419.99%',up:true,color:'#627EEA'},
  {name:'Solana',price:'(20,575) USD',change:'+12,14%',up:true,color:'#9945FF'},
  {name:'BNB',price:'(0.015) USD',change:'-62.69%',up:false,color:'#F3BA2F'},
  {name:'Tether',price:'(0.001) USD',change:'+15,715%',up:true,color:'#26A17B'},
  {name:'Cardano',price:'(0,215) USD',change:'-222,181%',up:false,color:'#0033AD'},
  {name:'XRP',price:'(0,595) USD',change:'+54,12%',up:true,color:'#346AA9'},
  {name:'Bitcoin',price:'(0,170) USD',change:'+310%',up:true,color:'#F7931A'},
  {name:'Ethereum',price:'(0,090) USD',change:'+10,10%',up:true,color:'#627EEA'},
  {name:'Solana',price:'(0,315) USD',change:'',up:true,color:'#9945FF'},
];
const track=document.getElementById('tickerTrack');
if(track){
  const buildItems=()=>metricss.map(c=>`
    <div class="ticker-item">
      <div class="ticker-dot" style="background:${c.color}"></div>
      <span class="ticker-name">${c.name}</span>
      <span class="ticker-price">${c.price}</span>
      <span class="ticker-change ${c.up?'up':'down'}">${c.change}</span>
    </div>
  `).join('');
  track.innerHTML=buildItems()+buildItems()+buildItems();
}

// =====================
// STAR FIELD
// =====================
const starField=document.getElementById('starField');
if(starField){
  for(let i=0;i<80;i++){
    const s=document.createElement('div');
    const size=Math.random()*2.5+0.5;
    s.style.cssText=`position:absolute;width:${size}px;height:${size}px;
      background:rgba(255,255,255,${Math.random()*0.6+0.2});
      border-radius:50%;left:${Math.random()*100}%;top:${Math.random()*70}%;
      animation:starTwinkle ${2+Math.random()*3}s ease-in-out infinite;
      animation-delay:${Math.random()*3}s;`;
    starField.appendChild(s);
  }
}

// =====================
// COUNTDOWN TIMER
// =====================
function updateCountdown(){
  const target=new Date();
  target.setDate(target.getDate()+3);
  target.setHours(target.getHours()+12);
  target.setMinutes(target.getMinutes()+53);
  function tick(){
    const now=Date.now();
    const end=target.getTime();
    let diff=Math.max(0,end-now);
    const d=Math.floor(diff/86400000);diff%=86400000;
    const h=Math.floor(diff/3600000);diff%=3600000;
    const m=Math.floor(diff/60000);diff%=60000;
    const s=Math.floor(diff/1000);
    const fmt=n=>String(n).padStart(2,'0');
    document.getElementById('cdDays').textContent=fmt(d);
    document.getElementById('cdHours').textContent=fmt(h);
    document.getElementById('cdMins').textContent=fmt(m);
    document.getElementById('cdSecs').textContent=fmt(s);
  }
  tick();setInterval(tick,1000);
}
updateCountdown();

// =====================
// SCROLL ANIMATIONS (Intersection Observer)
// =====================
const observer=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
},{threshold:0.15,rootMargin:'0px 0px -50px 0px'});
document.querySelectorAll('.fade-up,.fade-in').forEach(el=>observer.observe(el));

// =====================
// COUNTER ANIMATION
// =====================
const counterObserver=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      const el=e.target;
      const target=parseInt(el.dataset.target);
      const prefix=el.dataset.prefix||'';
      const suffix=el.dataset.suffix||'';
      let current=0;
      const duration=2000;
      const start=Date.now();
      function update(){
        const elapsed=Date.now()-start;
        const progress=Math.min(elapsed/duration,1);
        const eased=1-Math.pow(1-progress,4);
        current=Math.round(target*eased);
        el.textContent=prefix+current+suffix;
        if(progress<1)requestAnimationFrame(update);
      }
      update();
      counterObserver.unobserve(el);
    }
  });
},{threshold:0.5});
document.querySelectorAll('[data-target]').forEach(el=>counterObserver.observe(el));

// =====================
// CARD HOVER SPOTLIGHT
// =====================
document.querySelectorAll('.stat-card,.why-card,.program-card').forEach(card=>{
  card.addEventListener('mousemove',e=>{
    const r=card.getBoundingClientRect();
    card.style.setProperty('--mx',(e.clientX-r.left)/r.width*100+'%');
    card.style.setProperty('--my',(e.clientY-r.top)/r.height*100+'%');
  });
});

// =====================
// HOW IT WORKS STEPS
// =====================
const stepData=[
  {num:'[ STEP 1 ]',title:'Step 1: Choose a Program',text:'Choose your training program based on your experience. Pick the revenue uplift size and the program that fits your business style.'},
  {num:'[ STEP 2 ]',title:'Step 2',text:'Your task at this stage is to fulfil the requirements of the given program in a trading phase of a ZenoAI evaluation.'},
  {num:'[ STEP 3 ]',title:'Step 3: Co-operation',text:'When you manage to successfully complete our training program, we are then set to cooperate with you and you become an ZenoAI merchant. Receive a FCF revenue account and earn profits up to 30% increase – we protect your margin.'},
];
function showStep(idx,tab){
  document.querySelectorAll('.step-tab').forEach(t=>t.classList.remove('active'));
  tab.classList.add('active');
  const info=document.getElementById('howInfo');
  const d=stepData[idx];
  info.innerHTML=`<div class="how-step-num">${d.num}</div><div class="how-step-title">${d.title}</div><div class="how-step-text">${d.text}</div>`;
}

// =====================
// TIER TABS
// =====================
function selectTier(tier,tab){
  document.querySelectorAll('.tier-tab').forEach(t=>t.classList.remove('active'));
  tab.classList.add('active');
}

// =====================
// GSAP ANIMATIONS
// =====================
if(typeof gsap!=='undefined'&&typeof ScrollTrigger!=='undefined'){
  gsap.registerPlugin(ScrollTrigger);

  // Hero title animation
  gsap.from('.hero-title .line1',{duration:1,y:80,opacity:0,ease:'power3.out',delay:0.3});
  gsap.from('.hero-title .line2',{duration:1,y:80,opacity:0,ease:'power3.out',delay:0.5});
  gsap.from('.hero-tag',{duration:0.8,y:30,opacity:0,ease:'power2.out',delay:0.1});
  gsap.from('.hero-features',{duration:0.8,y:20,opacity:0,ease:'power2.out',delay:0.7});
  gsap.from('.hero-btns',{duration:0.8,y:20,opacity:0,ease:'power2.out',delay:0.9});
  gsap.from('.hero-bottom',{duration:0.8,y:20,opacity:0,ease:'power2.out',delay:1.1});

  // Nav
  gsap.from('nav',{duration:0.8,y:-40,opacity:0,ease:'power2.out'});

  // Math elements
  gsap.from('.math-el,.math-box',{
    duration:1.5,opacity:0,scale:0.5,
    stagger:0.1,ease:'power2.out',delay:0.5
  });

  // Certificate hover 3D
  const cert=document.getElementById('certCard');
  if(cert){
    cert.addEventListener('mousemove',e=>{
      const r=cert.getBoundingClientRect();
      const x=((e.clientX-r.left)/r.width-0.5)*20;
      const y=-((e.clientY-r.top)/r.height-0.5)*20;
      gsap.to(cert,{rotateY:x,rotateX:y,duration:0.3,ease:'power2.out',transformPerspective:800});
    });
    cert.addEventListener('mouseleave',()=>{
      gsap.to(cert,{rotateY:-8,rotateX:4,duration:0.5,ease:'power2.out'});
    });
  }

  // Parallax math elements
  gsap.to('.math-el',{
    y:-60,
    ease:'none',
    scrollTrigger:{trigger:'#hero',start:'top top',end:'bottom top',scrub:1}
  });
}

// =====================
// CHART ANIMATION (Phone)
// =====================
(function(){
  const path=document.querySelector('.chart-svg path:first-of-type');
  if(!path)return;
  const len=path.getTotalLength();
  path.style.strokeDasharray=len;
  path.style.strokeDashoffset=len;
  setTimeout(()=>{
    path.style.transition='stroke-dashoffset 2s ease';
    path.style.strokeDashoffset=0;
  },800);
})();

