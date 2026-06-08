import * as THREE from 'three';

/* =========================================================================
   INVERSE HUNTER — 3D Action Game
   食物連鎖を逆走する、生存と革命の3Dアクション
   ========================================================================= */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------------- FORM DEFINITIONS ---------------------- */
// Each form: stats drive movement / combat / perception.
const FORMS = [
  { id:'rat',  emoji:'🐭', name:'ネズミ', sub:'被食者・隠密',
    color:0xbcae9c, accent:0x8a7d6a, scale:0.55,
    speed:9.2, jump:7.0, hp:70, dash:1.6,
    attack:{ type:'bite', range:2.2, dmg:9,  cooldown:0.32, knock:3 },
    canFly:false, sky:0x0a0e18, fog:0x121826, sense:'ultrasonic',
    desc:'素早く小さい。狭い隙間を抜け、敵の追跡をリセットできる。' },

  { id:'fox',  emoji:'🦊', name:'キツネ', sub:'中型捕食者・敏捷',
    color:0xd9712c, accent:0xf2f0e8, scale:0.85,
    speed:11.5, jump:9.5, hp:120, dash:2.4,
    attack:{ type:'claw', range:3.0, dmg:18, cooldown:0.4, knock:6 },
    canFly:false, sky:0x101a14, fog:0x16241c, sense:'normal',
    desc:'高い跳躍とダッシュ。地上戦の主力。' },

  { id:'snake', emoji:'🐍', name:'ニシキヘビ', sub:'待機型捕食者',
    color:0x4f8f3a, accent:0xc8d65a, scale:0.7,
    speed:8.0, jump:5.0, hp:150, dash:3.2,
    attack:{ type:'lunge', range:5.5, dmg:26, cooldown:0.65, knock:9 },
    canFly:false, sky:0x12100a, fog:0x1c1810, sense:'thermal',
    desc:'長距離の突進噛みつき。熱源探知で暗闇の敵が見える。' },

  { id:'eagle', emoji:'🦅', name:'イヌワシ', sub:'頂点捕食者・飛行',
    color:0x6b4a2a, accent:0xf0d9a0, scale:1.0,
    speed:14.0, jump:11.0, hp:130, dash:3.0,
    attack:{ type:'dive', range:4.0, dmg:30, cooldown:0.5, knock:10 },
    canFly:true, sky:0x14233a, fog:0x1a2c44, sense:'aerial',
    desc:'空を飛び、急降下攻撃。上空からの俯瞰マップ。' },

  { id:'wolf', emoji:'🐺', name:'オオカミ', sub:'群れの長',
    color:0x5a6066, accent:0xc8d2da, scale:1.05,
    speed:13.0, jump:9.0, hp:200, dash:2.8,
    attack:{ type:'fang', range:3.4, dmg:34, cooldown:0.42, knock:8 },
    canFly:false, sky:0x0c1018, fog:0x141a24, sense:'nightvision',
    desc:'最強の地上戦力。連続攻撃が強い群れの長。' },
];
const formIndex = id => FORMS.findIndex(f => f.id === id);

/* ---------------------- STAGE DEFINITIONS ---------------------- */
const STAGES = [
  { name:'Stage 01 — 草原の夜明け', objective:'天敵キツネを倒せ', enemyType:'fox',
    count:3, unlock:'fox', ground:0x223018, env:'grass',
    intro:['STAGE 01','草原の夜明け — まずは生き延びろ'] },
  { name:'Stage 02 — 湿地のヘビ王国', objective:'ニシキヘビを討伐せよ', enemyType:'snake',
    count:4, unlock:'snake', ground:0x1c2418, env:'swamp',
    intro:['STAGE 02','湿地のヘビ王国 — 形態を切り替えて戦え'] },
  { name:'Stage 03 — 断崖のワシの縄張り', objective:'イヌワシを撃墜せよ', enemyType:'eagle',
    count:3, unlock:'eagle', ground:0x2a2218, env:'cliff',
    intro:['STAGE 03','断崖のワシの縄張り — 空を制圧せよ'] },
  { name:'Stage 04 — 森のオオカミ群れ', objective:'オオカミの群れを制圧せよ', enemyType:'wolf',
    count:5, unlock:'wolf', ground:0x182414, env:'forest',
    intro:['STAGE 04','森のオオカミ群れ — 群れを率いる者となれ'] },
  { name:'Stage 05 — 人間の村', objective:'文明の脅威を退けろ', enemyType:'human',
    count:4, unlock:null, ground:0x2a2a2a, env:'village',
    intro:['STAGE 05','人間の村 — 強さだけでは勝てない'] },
];

/* =========================================================================
   GAME CLASS
   ========================================================================= */
class Game {
  constructor() {
    this.dom = {};
    ['hud','formEmoji','formName','formSub','hpFill','hpTxt','instinctFill','instinctTxt',
     'xpFill','xpTxt','stageName','objective','objCount','crosshair','toast','toastBig',
     'toastSub','dmgFlash','startScreen','startBtn','ctrlHint','loadingBar','endScreen',
     'endTitle','endMsg','restartBtn','touchUI','joyZone','joyBase','joyKnob','lookZone',
     'btnSense','btnForm','btnJump','formWheel','wheel'].forEach(id=>{
      this.dom[id]=document.getElementById(id);
    });

    this.isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
      || ('ontouchstart' in window && window.innerWidth < 1024);

    this.initThree();
    this.initState();
    this.initAudio();
    this.initInput();
    this.bindUI();
    this.buildLoadingHint();

    // simulate small load then enable start
    let p=0; const lt=setInterval(()=>{ p+=rand(12,28); 
      this.dom.loadingBar.firstElementChild.style.width=Math.min(100,p)+'%';
      if(p>=100){clearInterval(lt); this.dom.loadingBar.style.display='none';
        this.dom.startBtn.style.display='inline-block';}},120);

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(()=>this.loop());
  }

  /* ----------------- THREE SETUP ----------------- */
  initThree(){
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e18);
    this.scene.fog = new THREE.Fog(0x121826, 28, 95);

    this.camera = new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.1, 400);
    this.renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game').appendChild(this.renderer.domElement);

    // lights
    this.hemi = new THREE.HemisphereLight(0x8db4ff, 0x202018, 0.65);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 1.05);
    this.sun.position.set(30,55,20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048,2048);
    const sc=this.sun.shadow.camera; sc.near=1; sc.far=160;
    sc.left=-70; sc.right=70; sc.top=70; sc.bottom=-70;
    this.scene.add(this.sun);
    this.sun.target.position.set(0,0,0); this.scene.add(this.sun.target);

    addEventListener('resize',()=>{
      this.camera.aspect=innerWidth/innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth,innerHeight);
    });

    this.WORLD = 78; // half-size of arena
  }

  initState(){
    this.running=false;
    this.stageIdx=0;
    this.unlocked = ['rat'];
    this.curForm = 'rat';
    this.kills=0;
    this.enemies=[];
    this.projectiles=[];
    this.particles=[];
    this.pickups=[];
    this.allies=[];

    // player physical state
    this.player = {
      pos: new THREE.Vector3(0,0,0),
      vel: new THREE.Vector3(),
      yaw: 0,        // facing direction (radians)
      onGround: true,
      hp: 70, maxHp: 70,
      instinct: 0,   // 0..100
      flying: false,
      attackCD: 0,
      hurtCD: 0,
      dashCD: 0,
      xp: 0,         // kills toward unlock
    };
    // camera orbit
    this.cam = { yaw: 0, pitch: 0.25, dist: 8.5, height: 3.2 };
    // aim direction (world)
    this.aimDir = new THREE.Vector3(0,0,-1);
  }

  /* ----------------- AUDIO (procedural WebAudio) ----------------- */
  initAudio(){
    this.audio = { ctx:null, master:null, enabled:true };
  }
  ensureAudio(){
    if(this.audio.ctx) return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      const ctx=new AC();
      const master=ctx.createGain(); master.gain.value=0.35; master.connect(ctx.destination);
      this.audio.ctx=ctx; this.audio.master=master;
    }catch(e){ this.audio.enabled=false; }
  }
  sfx(type){
    if(!this.audio.enabled) return;
    this.ensureAudio();
    const ctx=this.audio.ctx; if(!ctx) return;
    if(ctx.state==='suspended') ctx.resume();
    const now=ctx.currentTime;
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.connect(g); g.connect(this.audio.master);
    let f0=440,f1=440,dur=0.12,wave='sine',vol=0.5;
    switch(type){
      case 'attack':  wave='sawtooth'; f0=420; f1=180; dur=0.12; vol=0.4; break;
      case 'hit':     wave='square';   f0=180; f1=60;  dur=0.14; vol=0.55; break;
      case 'hurt':    wave='sawtooth'; f0=160; f1=70;  dur=0.22; vol=0.6; break;
      case 'kill':    wave='triangle'; f0=300; f1=520; dur=0.25; vol=0.55; break;
      case 'jump':    wave='sine';     f0=300; f1=620; dur=0.14; vol=0.35; break;
      case 'transform':wave='triangle';f0=200; f1=900; dur=0.5;  vol=0.45; break;
      case 'unlock':  wave='triangle'; f0=520; f1=1040;dur=0.6;  vol=0.5; break;
      case 'shoot':   wave='square';   f0=700; f1=300; dur=0.1;  vol=0.3; break;
    }
    o.type=wave; o.frequency.setValueAtTime(f0,now);
    o.frequency.exponentialRampToValueAtTime(Math.max(40,f1),now+dur);
    g.gain.setValueAtTime(vol,now);
    g.gain.exponentialRampToValueAtTime(0.001,now+dur);
    o.start(now); o.stop(now+dur+0.02);
  }

  shake(amount){ this.camShake=Math.min(1.2,(this.camShake||0)+amount); }

  /* ----------------- WORLD BUILD ----------------- */
  buildWorld(stage){
    // clear old
    if(this.worldGroup) this.scene.remove(this.worldGroup);
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
    this.colliders = []; // {pos, r}

    const form = FORMS[formIndex(this.curForm)];
    this.scene.background = new THREE.Color(form.sky);
    this.scene.fog.color = new THREE.Color(form.fog);

    // ground
    const gMat = new THREE.MeshStandardMaterial({color:stage.ground, roughness:1, metalness:0});
    const ground = new THREE.Mesh(new THREE.CircleGeometry(this.WORLD+6, 64), gMat);
    ground.rotation.x = -Math.PI/2; ground.receiveShadow=true;
    this.worldGroup.add(ground);

    // grid-ish detail rings
    for(let i=1;i<=3;i++){
      const ring=new THREE.Mesh(new THREE.RingGeometry(this.WORLD*0.3*i, this.WORLD*0.3*i+0.3,64),
        new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.04}));
      ring.rotation.x=-Math.PI/2; ring.position.y=0.02; this.worldGroup.add(ring);
    }

    // boundary wall (visual ring)
    const wall=new THREE.Mesh(new THREE.CylinderGeometry(this.WORLD+5,this.WORLD+5,14,48,1,true),
      new THREE.MeshStandardMaterial({color:0x0a0d14,side:THREE.BackSide,roughness:1}));
    wall.position.y=7; this.worldGroup.add(wall);

    // environment props (trees/rocks) depending on env
    const propCount = 60;
    for(let i=0;i<propCount;i++){
      const a=Math.random()*TAU, d=rand(8,this.WORLD-4);
      const x=Math.cos(a)*d, z=Math.sin(a)*d;
      this.makeProp(stage.env, x, z);
    }

    // sky decorations / clouds for eagle stages
    if(stage.env==='cliff'){ this.makeFloatingRocks(); }

    // pickups area marker handled by enemies
  }

  makeProp(env, x, z){
    let mesh, r=1.4;
    if(env==='grass' || env==='forest' || env==='swamp'){
      // tree
      const h=rand(3,6.5);
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.45,h,6),
        new THREE.MeshStandardMaterial({color:0x3a2a18,roughness:1}));
      trunk.position.set(x,h/2,z); trunk.castShadow=true;
      const leafColor = env==='swamp'?0x2f4a2a: env==='forest'?0x1e3a1e:0x2e4a22;
      const leaves=new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.4,2.3),0),
        new THREE.MeshStandardMaterial({color:leafColor,roughness:1,flatShading:true}));
      leaves.position.set(x,h+0.6,z); leaves.castShadow=true;
      this.worldGroup.add(trunk); this.worldGroup.add(leaves);
      r=0.7;
    } else if(env==='cliff'){
      const s=rand(1.5,4);
      mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),
        new THREE.MeshStandardMaterial({color:0x4a3e30,roughness:1,flatShading:true}));
      mesh.position.set(x,s*0.5,z); mesh.castShadow=true; mesh.receiveShadow=true;
      this.worldGroup.add(mesh); r=s*0.8;
    } else { // village
      const w=rand(2,4), h=rand(2,5);
      mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),
        new THREE.MeshStandardMaterial({color:0x6b5d4a,roughness:1}));
      mesh.position.set(x,h/2,z); mesh.castShadow=true; mesh.receiveShadow=true;
      this.worldGroup.add(mesh); r=w*0.6;
    }
    this.colliders.push({x,z,r});
  }

  makeFloatingRocks(){
    for(let i=0;i<10;i++){
      const a=Math.random()*TAU,d=rand(15,this.WORLD-10);
      const s=rand(2,4);
      const m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),
        new THREE.MeshStandardMaterial({color:0x554738,roughness:1,flatShading:true}));
      m.position.set(Math.cos(a)*d, rand(6,16), Math.sin(a)*d);
      m.castShadow=true; this.worldGroup.add(m);
    }
  }

  /* ----------------- PLAYER MESH ----------------- */
  buildPlayerMesh(){
    if(this.playerGroup) this.scene.remove(this.playerGroup);
    this.playerGroup = new THREE.Group();
    this.scene.add(this.playerGroup);
    this.rebuildPlayerForm();
  }

  rebuildPlayerForm(){
    // remove old body
    if(this.body){ this.playerGroup.remove(this.body); }
    const f = FORMS[formIndex(this.curForm)];
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({color:f.color,roughness:0.85,flatShading:true});
    const matA= new THREE.MeshStandardMaterial({color:f.accent,roughness:0.8,flatShading:true});
    const s = f.scale;

    if(f.id==='eagle'){
      // body + wings
      const torso=new THREE.Mesh(new THREE.ConeGeometry(0.55*s,1.8*s,8),mat);
      torso.rotation.x=Math.PI/2; torso.castShadow=true; g.add(torso);
      const head=new THREE.Mesh(new THREE.SphereGeometry(0.35*s,8,8),matA);
      head.position.set(0,0.1*s,1.0*s); g.add(head);
      const beak=new THREE.Mesh(new THREE.ConeGeometry(0.12*s,0.4*s,6),
        new THREE.MeshStandardMaterial({color:0xe8a020,flatShading:true}));
      beak.rotation.x=Math.PI/2; beak.position.set(0,0.05*s,1.4*s); g.add(beak);
      const wingGeo=new THREE.BoxGeometry(2.6*s,0.1*s,1.0*s);
      this.wingL=new THREE.Mesh(wingGeo,mat); this.wingL.position.set(-1.4*s,0,0); g.add(this.wingL);
      this.wingR=new THREE.Mesh(wingGeo,mat); this.wingR.position.set(1.4*s,0,0); g.add(this.wingR);
      this.eyes=[head];
    } else if(f.id==='snake'){
      // segmented body
      this.snakeSegs=[];
      for(let i=0;i<6;i++){
        const seg=new THREE.Mesh(new THREE.SphereGeometry((0.45-i*0.04)*s,8,8), i%2?matA:mat);
        seg.position.set(0,0.3*s,-i*0.55*s); seg.castShadow=true; g.add(seg);
        this.snakeSegs.push(seg);
      }
      const head=new THREE.Mesh(new THREE.SphereGeometry(0.5*s,8,8),mat);
      head.scale.z=1.3; head.position.set(0,0.35*s,0.5*s); head.castShadow=true; g.add(head);
      const e1=new THREE.Mesh(new THREE.SphereGeometry(0.07*s,6,6),new THREE.MeshBasicMaterial({color:0xffcc00}));
      e1.position.set(0.15*s,0.5*s,0.85*s); head.add(e1);
      const e2=e1.clone(); e2.position.x=-0.15*s; head.add(e2);
      this.eyes=[e1,e2];
    } else {
      // quadruped (rat/fox/wolf)
      const torso=new THREE.Mesh(new THREE.CapsuleGeometry(0.4*s,1.0*s,4,8),mat);
      torso.rotation.z=Math.PI/2; torso.position.y=0.6*s; torso.castShadow=true; g.add(torso);
      const head=new THREE.Mesh(new THREE.SphereGeometry(0.42*s,8,8),mat);
      head.position.set(0,0.75*s,0.85*s); head.castShadow=true; g.add(head);
      // snout
      const snout=new THREE.Mesh(new THREE.ConeGeometry(0.2*s,0.5*s,6),matA);
      snout.rotation.x=Math.PI/2; snout.position.set(0,0.7*s,1.25*s); g.add(snout);
      // ears
      const earGeo=new THREE.ConeGeometry(0.18*s,0.4*s,5);
      const earL=new THREE.Mesh(earGeo,matA); earL.position.set(-0.22*s,1.05*s,0.8*s); g.add(earL);
      const earR=new THREE.Mesh(earGeo,matA); earR.position.set(0.22*s,1.05*s,0.8*s); g.add(earR);
      if(f.id==='rat'){ earL.scale.set(1.4,1,1.4); earR.scale.set(1.4,1,1.4); }
      // legs (animated)
      this.legs=[];
      const legGeo=new THREE.CylinderGeometry(0.1*s,0.08*s,0.6*s,5);
      const lp=[[-0.3,0.6],[0.3,0.6],[-0.3,-0.55],[0.3,-0.55]];
      lp.forEach(([lx,lz])=>{
        const leg=new THREE.Mesh(legGeo,mat);
        leg.position.set(lx*s,0.3*s,lz*s); leg.castShadow=true; g.add(leg); this.legs.push(leg);
      });
      // tail
      const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.06*s,0.14*s,0.9*s,5),mat);
      tail.position.set(0,0.6*s,-0.9*s); tail.rotation.x=-0.5; g.add(tail); this.tail=tail;
      // eyes
      const e1=new THREE.Mesh(new THREE.SphereGeometry(0.08*s,6,6),new THREE.MeshBasicMaterial({color:0x222}));
      e1.position.set(0.18*s,0.85*s,1.05*s); g.add(e1);
      const e2=e1.clone(); e2.position.x=-0.18*s; g.add(e2);
      this.eyes=[e1,e2];
    }

    this.body=g;
    this.playerGroup.add(g);
    this.player.maxHp = f.hp;
    // keep hp ratio
    this.player.hp = Math.min(this.player.maxHp, this.player.hp || f.hp);

    // form perception: light tint
    this.applySense(false);
  }

  /* ----------------- ENEMIES ----------------- */
  spawnEnemiesForStage(){
    this.enemies.forEach(e=>this.scene.remove(e.group));
    this.enemies=[];
    const st=STAGES[this.stageIdx];
    for(let i=0;i<st.count;i++){
      const a=Math.random()*TAU, d=rand(22, this.WORLD-12);
      this.spawnEnemy(st.enemyType, Math.cos(a)*d, Math.sin(a)*d);
    }
  }

  spawnEnemy(type, x, z){
    const def = {
      fox:  {emoji:'🦊',color:0xc4642a,hp:55, dmg:12,speed:7.0, range:2.8, scale:0.85, fly:false},
      snake:{emoji:'🐍',color:0x3f7a30,hp:80, dmg:16,speed:6.0, range:4.5, scale:0.8,  fly:false},
      eagle:{emoji:'🦅',color:0x5a3e22,hp:70, dmg:20,speed:9.5, range:3.5, scale:1.0,  fly:true},
      wolf: {emoji:'🐺',color:0x4a5056,hp:110,dmg:22,speed:8.5, range:3.2, scale:1.0,  fly:false},
      human:{emoji:'🧍',color:0x88714e,hp:90, dmg:18,speed:5.0, range:14,  scale:1.1,  fly:false, ranged:true},
    }[type];

    const g=new THREE.Group();
    const mat=new THREE.MeshStandardMaterial({color:def.color,roughness:0.85,flatShading:true});
    const s=def.scale;
    if(type==='eagle'){
      const torso=new THREE.Mesh(new THREE.ConeGeometry(0.5*s,1.6*s,8),mat);
      torso.rotation.x=Math.PI/2; g.add(torso);
      const wL=new THREE.Mesh(new THREE.BoxGeometry(2.2*s,0.1*s,0.9*s),mat); wL.position.x=-1.2*s; g.add(wL);
      const wR=wL.clone(); wR.position.x=1.2*s; g.add(wR);
      g.userData.wings=[wL,wR];
    } else if(type==='snake'){
      for(let i=0;i<5;i++){
        const seg=new THREE.Mesh(new THREE.SphereGeometry((0.4-i*0.04)*s,7,7),mat);
        seg.position.z=-i*0.5*s; seg.position.y=0.3; g.add(seg);
      }
    } else if(type==='human'){
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.35*s,1.2*s,4,8),mat);
      body.position.y=1.0*s; g.add(body);
      const head=new THREE.Mesh(new THREE.SphereGeometry(0.3*s,8,8),mat);
      head.position.y=1.85*s; g.add(head);
    } else {
      const torso=new THREE.Mesh(new THREE.CapsuleGeometry(0.4*s,1.0*s,4,8),mat);
      torso.rotation.z=Math.PI/2; torso.position.y=0.6*s; g.add(torso);
      const head=new THREE.Mesh(new THREE.SphereGeometry(0.4*s,8,8),mat);
      head.position.set(0,0.75*s,0.8*s); g.add(head);
      const legGeo=new THREE.CylinderGeometry(0.1*s,0.08*s,0.6*s,5);
      [[-0.3,0.6],[0.3,0.6],[-0.3,-0.55],[0.3,-0.55]].forEach(([lx,lz])=>{
        const leg=new THREE.Mesh(legGeo,mat); leg.position.set(lx*s,0.3*s,lz*s); g.add(leg);
      });
    }
    g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
    g.position.set(x, def.fly?rand(5,10):0, z);
    this.scene.add(g);

    // health bar sprite
    const bar=this.makeHealthBar();
    bar.position.y = (def.fly?0: (type==='human'?2.4:1.6)) ;
    g.add(bar);

    this.enemies.push({
      group:g, type, hp:def.hp, maxHp:def.hp, dmg:def.dmg, speed:def.speed,
      range:def.range, fly:def.fly, ranged:!!def.ranged, scale:s,
      pos:g.position, vel:new THREE.Vector3(), state:'idle', atkCD:0, hurtFlash:0,
      bar, baseY:def.fly?g.position.y:0, dead:false, wanderA:Math.random()*TAU,
    });
  }

  makeHealthBar(){
    const cnv=document.createElement('canvas'); cnv.width=64; cnv.height=8;
    const tex=new THREE.CanvasTexture(cnv);
    const mat=new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true});
    const spr=new THREE.Sprite(mat); spr.scale.set(2.2,0.3,1);
    spr.userData={cnv,tex,ctx:cnv.getContext('2d')};
    this.drawHealthBar(spr,1);
    return spr;
  }
  drawHealthBar(spr,ratio){
    const {ctx,tex}=spr.userData;
    ctx.clearRect(0,0,64,8);
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(0,0,64,8);
    ctx.fillStyle = ratio>0.5?'#7fe07f':ratio>0.25?'#ffd56b':'#ff5b6e';
    ctx.fillRect(1,1,62*clamp(ratio,0,1),6);
    tex.needsUpdate=true;
  }

  /* ----------------- INPUT ----------------- */
  initInput(){
    this.keys = {};
    this.mouse = { down:false, x:0, y:0, dx:0, dy:0, locked:false };

    // ---- keyboard (FIXED: correct WASD + arrows, not inverted) ----
    addEventListener('keydown', e=>{
      const k=e.key.toLowerCase();
      this.keys[k]=true;
      if(k===' '){ e.preventDefault(); this.tryJump(); }
      if(k==='e'){ this.toggleSense(); }
      if(k==='q'){ this.openWheel(); }
      if(['1','2','3','4','5'].includes(k)){ this.quickForm(parseInt(k)-1); }
      // arrow keys must NOT be inverted — handled in movement read directly
    });
    addEventListener('keyup', e=>{
      const k=e.key.toLowerCase();
      this.keys[k]=false;
      if(k==='q'){ this.closeWheel(); }
    });

    // ---- mouse look (pointer lock on desktop) ----
    const cv=this.renderer.domElement;
    cv.addEventListener('mousedown', e=>{
      if(this.isMobile) return;
      if(!this.mouse.locked && this.running){ cv.requestPointerLock(); return; }
      if(e.button===0){ this.mouse.down=true; this.tryAttack(); }
    });
    addEventListener('mouseup', e=>{ if(e.button===0) this.mouse.down=false; });
    document.addEventListener('pointerlockchange',()=>{
      this.mouse.locked = (document.pointerLockElement===cv);
    });
    addEventListener('mousemove', e=>{
      if(this.mouse.locked){
        this.cam.yaw   -= e.movementX*0.0024;
        this.cam.pitch -= e.movementY*0.0024;
        this.cam.pitch = clamp(this.cam.pitch, -0.5, 1.1);
      }
    });
    addEventListener('wheel', e=>{
      if(!this.running) return;
      // form wheel quick scroll
      if(this.keys['q']){ return; }
      this.cam.dist = clamp(this.cam.dist + Math.sign(e.deltaY)*0.6, 5, 14);
    },{passive:true});

    if(this.isMobile){ this.initTouch(); }
  }

  initTouch(){
    this.dom.touchUI.style.display='block';
    this.touch = { move:{active:false,id:null,sx:0,sy:0,dx:0,dy:0},
                   look:{active:false,id:null,lx:0,ly:0} };

    const jz=this.dom.joyZone, jb=this.dom.joyBase, jk=this.dom.joyKnob;
    const startJoy=(t)=>{
      this.touch.move.active=true; this.touch.move.id=t.identifier;
      this.touch.move.sx=t.clientX; this.touch.move.sy=t.clientY;
      jb.style.display='block';
      jb.style.left=(t.clientX-60)+'px'; jb.style.top=(t.clientY-60)+'px';
      jk.style.left='32px'; jk.style.top='32px';
    };
    jz.addEventListener('touchstart',e=>{e.preventDefault();startJoy(e.changedTouches[0]);},{passive:false});
    jz.addEventListener('touchmove',e=>{e.preventDefault();
      for(const t of e.changedTouches){ if(t.identifier!==this.touch.move.id)continue;
        let dx=t.clientX-this.touch.move.sx, dy=t.clientY-this.touch.move.sy;
        const mag=Math.hypot(dx,dy), max=55;
        if(mag>max){dx*=max/mag;dy*=max/mag;}
        this.touch.move.dx=dx/max; this.touch.move.dy=dy/max;
        jk.style.left=(32+dx)+'px'; jk.style.top=(32+dy)+'px';
      }},{passive:false});
    const endJoy=e=>{ for(const t of e.changedTouches){ if(t.identifier===this.touch.move.id){
        this.touch.move.active=false; this.touch.move.dx=0; this.touch.move.dy=0;
        jb.style.display='none'; }}};
    jz.addEventListener('touchend',endJoy); jz.addEventListener('touchcancel',endJoy);

    // look + aim attack
    const lz=this.dom.lookZone;
    lz.addEventListener('touchstart',e=>{e.preventDefault();
      const t=e.changedTouches[0]; this.touch.look.active=true; this.touch.look.id=t.identifier;
      this.touch.look.lx=t.clientX; this.touch.look.ly=t.clientY;
      this.touchAimMoved=false;
    },{passive:false});
    lz.addEventListener('touchmove',e=>{e.preventDefault();
      for(const t of e.changedTouches){ if(t.identifier!==this.touch.look.id)continue;
        const dx=t.clientX-this.touch.look.lx, dy=t.clientY-this.touch.look.ly;
        this.cam.yaw-=dx*0.006; this.cam.pitch=clamp(this.cam.pitch-dy*0.006,-0.5,1.1);
        this.touch.look.lx=t.clientX; this.touch.look.ly=t.clientY;
        if(Math.hypot(dx,dy)>2) this.touchAimMoved=true;
      }},{passive:false});
    const endLook=e=>{ for(const t of e.changedTouches){ if(t.identifier===this.touch.look.id){
        this.touch.look.active=false; this.tryAttack(); }}};
    lz.addEventListener('touchend',endLook); lz.addEventListener('touchcancel',endLook);

    // buttons
    this.dom.btnJump.addEventListener('touchstart',e=>{e.preventDefault();this.tryJump();},{passive:false});
    this.dom.btnSense.addEventListener('touchstart',e=>{e.preventDefault();this.toggleSense();},{passive:false});
    this.dom.btnForm.addEventListener('touchstart',e=>{e.preventDefault();this.openWheel();},{passive:false});
  }

  buildLoadingHint(){
    if(this.isMobile){
      this.dom.ctrlHint.innerHTML =
        '左スティック=移動 / 右ドラッグ=視点・離して攻撃<br>'+
        '🔄=変身 ⤴=ジャンプ 👁=センスモード';
    } else {
      this.dom.ctrlHint.innerHTML =
        '<b>WASD / 矢印キー</b>=移動　<b>マウス</b>=視点・エイム<br>'+
        '<b>左クリック</b>=攻撃　<b>Space</b>=ジャンプ/ダッシュ<br>'+
        '<b>Q</b>=変身ホイール　<b>1-5</b>=変身　<b>E</b>=センスモード';
    }
  }

  bindUI(){
    this.dom.startBtn.addEventListener('click',()=>this.start());
    this.dom.restartBtn.addEventListener('click',()=>{ location.reload(); });
  }

  /* ----------------- GAME FLOW ----------------- */
  start(){
    this.ensureAudio();
    if(this.audio.ctx && this.audio.ctx.state==='suspended') this.audio.ctx.resume();
    this.dom.startScreen.classList.add('hidden');
    this.dom.hud.classList.remove('hidden');
    this.running=true;
    this.buildPlayerMesh();
    this.loadStage(0);
    if(!this.isMobile){ this.renderer.domElement.requestPointerLock?.(); }
  }

  loadStage(idx){
    this.stageIdx=idx;
    const st=STAGES[idx];
    this.kills=0;
    this.player.pos.set(0,0,0); this.player.vel.set(0,0,0);
    this.buildWorld(st);
    this.spawnEnemiesForStage();
    this.dom.stageName.textContent=st.name;
    this.dom.objective.innerHTML = st.objective+' <span class="obj-count" id="objCount">0/'+st.count+'</span>';
    this.dom.objCount=document.getElementById('objCount');
    this.showToast(st.intro[0], st.intro[1], 2600);
    this.updateFormHUD();
  }

  nextStage(){
    if(this.stageIdx+1 < STAGES.length){
      // heal a bit
      this.player.hp = this.player.maxHp;
      this.loadStage(this.stageIdx+1);
    } else {
      this.win();
    }
  }

  win(){
    this.running=false;
    document.exitPointerLock?.();
    this.dom.endScreen.classList.remove('hidden');
    this.dom.endTitle.textContent='GAME CLEAR';
    this.dom.endTitle.style.background='linear-gradient(90deg,#9fffce,#ffd56b)';
    this.dom.endTitle.style.webkitBackgroundClip='text';
    this.dom.endMsg.innerHTML='全ての天敵を超え、頂点に立った。<br>しかし、守るべきものはまだ残っている――。<br><br>'+
      '<span style="opacity:.6;font-size:13px">"You were prey. Now you are everything."</span>';
  }

  gameOver(){
    this.running=false;
    document.exitPointerLock?.();
    this.dom.endScreen.classList.remove('hidden');
    this.dom.endTitle.textContent='GAME OVER';
    this.dom.endMsg.innerHTML='あなたは喰われた。<br>食物連鎖の底辺は、あまりにも過酷だ。';
  }

  /* ----------------- TRANSFORMATION ----------------- */
  openWheel(){
    if(!this.running||this.wheelOpen) return;
    this.wheelOpen=true;
    this.dom.formWheel.style.display='flex';
    // build items
    const w=this.dom.wheel;
    w.querySelectorAll('.wheel-item').forEach(n=>n.remove());
    this.wheelItems=[];
    const R=120, cx=170, cy=170;
    FORMS.forEach((f,i)=>{
      const ang=-Math.PI/2 + i*(TAU/FORMS.length);
      const el=document.createElement('div'); el.className='wheel-item';
      el.style.left=(cx+Math.cos(ang)*R)+'px'; el.style.top=(cy+Math.sin(ang)*R)+'px';
      el.innerHTML='<div class="we">'+f.emoji+'</div><div class="wn">'+f.name+'</div>';
      if(!this.unlocked.includes(f.id)) el.classList.add('locked');
      if(f.id===this.curForm) el.classList.add('sel');
      el.addEventListener('mouseenter',()=>this.selectWheel(i));
      el.addEventListener('click',()=>{ this.selectWheel(i); this.confirmWheel(); });
      el.addEventListener('touchstart',e=>{e.preventDefault();this.selectWheel(i);this.confirmWheel();},{passive:false});
      w.appendChild(el); this.wheelItems.push({el,form:f});
    });
    this.wheelSel=formIndex(this.curForm);
  }
  selectWheel(i){
    this.wheelSel=i;
    this.wheelItems.forEach((it,idx)=>it.el.classList.toggle('sel',idx===i));
  }
  closeWheel(){
    if(!this.wheelOpen) return;
    this.confirmWheel();
  }
  confirmWheel(){
    if(!this.wheelOpen) return;
    this.wheelOpen=false;
    this.dom.formWheel.style.display='none';
    const f=FORMS[this.wheelSel];
    if(f && this.unlocked.includes(f.id) && f.id!==this.curForm){
      this.transform(f.id);
    }
  }
  quickForm(i){
    const f=FORMS[i];
    if(f && this.unlocked.includes(f.id) && f.id!==this.curForm){ this.transform(f.id); }
  }

  transform(id){
    if(this.player.instinct < 20 && this.kills>0){
      // need instinct after first transform; allow free first transforms via unlock
    }
    this.curForm=id;
    const f=FORMS[formIndex(id)];
    this.scene.background=new THREE.Color(f.sky);
    this.scene.fog.color=new THREE.Color(f.fog);
    this.player.flying=false;
    this.rebuildPlayerForm();
    this.updateFormHUD();
    this.spawnTransformBurst();
    this.sfx('transform'); this.shake(0.4);
    this.showToast(f.emoji+' '+f.name, f.desc, 2200);
    this.player.instinct = Math.max(0, this.player.instinct-15);
  }

  unlockForm(id){
    if(!this.unlocked.includes(id)){
      this.unlocked.push(id);
      const f=FORMS[formIndex(id)];
      this.sfx('unlock');
      this.showToast('🧬 新形態解放！', f.emoji+' '+f.name+' に変身可能（Q / '+(formIndex(id)+1)+'キー）',3200);
    }
  }

  updateFormHUD(){
    const f=FORMS[formIndex(this.curForm)];
    this.dom.formEmoji.textContent=f.emoji;
    this.dom.formName.textContent=f.name;
    this.dom.formSub.textContent=f.sub;
  }

  /* ----------------- COMBAT ----------------- */
  computeAim(){
    // aim direction from camera forward, flattened option for ground forms
    const f=FORMS[formIndex(this.curForm)];
    const dir=new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    if(!f.canFly){ dir.y=clamp(dir.y,-0.3,0.3); }
    dir.normalize();
    this.aimDir.copy(dir);
    return dir;
  }

  tryAttack(){
    if(!this.running||this.player.attackCD>0||this.wheelOpen) return;
    const f=FORMS[formIndex(this.curForm)];
    const atk=f.attack;
    this.player.attackCD=atk.cooldown;
    const dir=this.computeAim();

    // face aim
    this.player.yaw = Math.atan2(dir.x, dir.z);

    // lunge / dive moves the player forward
    if(atk.type==='lunge'||atk.type==='dive'){
      this.player.vel.x += dir.x*14;
      this.player.vel.z += dir.z*14;
      if(atk.type==='dive') this.player.vel.y += dir.y*10;
    }

    // hit detection: cone around aim within range
    const origin=this.player.pos.clone(); origin.y+=0.6;
    let hit=false;
    for(const en of this.enemies){
      if(en.dead) continue;
      const to=en.pos.clone().sub(origin); const d=to.length();
      if(d>atk.range+1.5) continue;
      to.normalize();
      const dot=to.dot(dir);
      if(dot>0.55){ // within ~57° cone
        this.damageEnemy(en, atk.dmg, dir, atk.knock); hit=true;
      }
    }
    this.spawnSlash(origin, dir, f);
    this.sfx('attack');
    if(hit){ this.sfx('hit'); this.shake(0.35); }
    // attacking restores some instinct (predatory action)
    if(hit) this.addInstinct(8); else this.addInstinct(2);
    this.attackAnim=0.18;
    if(this.isMobile && navigator.vibrate) navigator.vibrate(hit?30:12);
  }

  damageEnemy(en, dmg, dir, knock){
    en.hp-=dmg; en.hurtFlash=0.15;
    en.vel.x += dir.x*knock; en.vel.z += dir.z*knock;
    this.drawHealthBar(en.bar, en.hp/en.maxHp);
    this.spawnHitParticles(en.pos);
    if(en.hp<=0 && !en.dead){ this.killEnemy(en); }
  }

  killEnemy(en){
    en.dead=true;
    this.sfx('kill'); this.shake(0.6);
    this.spawnDeathBurst(en.pos, en.group);
    this.scene.remove(en.group);
    this.kills++;
    this.player.xp++;
    this.addInstinct(25);
    const st=STAGES[this.stageIdx];
    if(this.dom.objCount) this.dom.objCount.textContent=this.kills+'/'+st.count;
    this.updateXP();
    if(this.kills>=st.count){
      // unlock next form
      if(st.unlock){ this.unlockForm(st.unlock); }
      setTimeout(()=>{ if(this.running){
        this.showToast('STAGE CLEAR','次のステージへ…',2200);
        setTimeout(()=>{ if(this.running) this.nextStage(); },1800);
      }},900);
    }
  }

  updateXP(){
    const st=STAGES[this.stageIdx];
    const ratio=clamp(this.kills/st.count,0,1);
    this.dom.xpFill.style.width=(ratio*100)+'%';
    this.dom.xpTxt.textContent=this.kills+'/'+st.count;
  }

  addInstinct(v){
    this.player.instinct=clamp(this.player.instinct+v,0,100);
  }

  hurtPlayer(dmg){
    if(this.player.hurtCD>0) return;
    this.player.hp-=dmg; this.player.hurtCD=0.6;
    this.sfx('hurt'); this.shake(0.5);
    this.dom.dmgFlash.style.opacity='1';
    setTimeout(()=>this.dom.dmgFlash.style.opacity='0',120);
    if(this.isMobile && navigator.vibrate) navigator.vibrate(60);
    if(this.player.hp<=0){ this.player.hp=0; this.updateBars(); this.gameOver(); }
  }

  /* ----------------- ENEMY PROJECTILE (human) ----------------- */
  enemyShoot(en, dir){
    const geo=new THREE.SphereGeometry(0.18,6,6);
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffdd44}));
    m.position.copy(en.pos); m.position.y+=1.6;
    this.scene.add(m);
    this.sfx('shoot');
    this.projectiles.push({mesh:m, vel:dir.clone().multiplyScalar(28), life:2.5, dmg:en.dmg});
  }

  /* ----------------- PARTICLES / FX ----------------- */
  spawnSlash(origin, dir, f){
    const ringGeo=new THREE.TorusGeometry(f.attack.range*0.5,0.08,6,16,Math.PI);
    const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({
      color:f.accent,transparent:true,opacity:0.9,side:THREE.DoubleSide}));
    m.position.copy(origin).add(dir.clone().multiplyScalar(f.attack.range*0.5));
    m.lookAt(origin);
    this.scene.add(m);
    this.particles.push({mesh:m,life:0.22,maxLife:0.22,type:'slash',scaleUp:true});
  }
  spawnHitParticles(pos){
    for(let i=0;i<6;i++){
      const m=new THREE.Mesh(new THREE.TetrahedronGeometry(0.12),
        new THREE.MeshBasicMaterial({color:0xffe08a}));
      m.position.copy(pos); m.position.y+=0.8;
      const v=new THREE.Vector3(rand(-1,1),rand(0.5,2),rand(-1,1)).multiplyScalar(4);
      this.scene.add(m);
      this.particles.push({mesh:m,life:0.5,maxLife:0.5,vel:v,type:'spark'});
    }
  }
  spawnDeathBurst(pos){
    for(let i=0;i<16;i++){
      const m=new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.1,0.25),0),
        new THREE.MeshBasicMaterial({color:i%2?0xffd56b:0xff8a5b}));
      m.position.copy(pos); m.position.y+=0.8;
      const v=new THREE.Vector3(rand(-1,1),rand(0.5,1),rand(-1,1)).normalize().multiplyScalar(rand(4,9));
      this.scene.add(m);
      this.particles.push({mesh:m,life:0.8,maxLife:0.8,vel:v,type:'spark'});
    }
  }
  spawnTransformBurst(){
    for(let i=0;i<24;i++){
      const m=new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.12,0.3),0),
        new THREE.MeshBasicMaterial({color:0x9fe6ff}));
      m.position.copy(this.player.pos); m.position.y+=1;
      const v=new THREE.Vector3(rand(-1,1),rand(-1,1),rand(-1,1)).normalize().multiplyScalar(rand(5,11));
      this.scene.add(m);
      this.particles.push({mesh:m,life:0.7,maxLife:0.7,vel:v,type:'spark'});
    }
  }

  /* ----------------- SENSE MODE ----------------- */
  toggleSense(){ this.senseOn=!this.senseOn; this.applySense(this.senseOn); }
  applySense(on){
    const f=FORMS[formIndex(this.curForm)];
    if(on){
      const tint={ultrasonic:0x6a4aff,thermal:0xff3a2a,aerial:0x7ad0ff,
                  nightvision:0x4aff7a,normal:0xffffff}[f.sense]||0xffffff;
      this.hemi.color.setHex(tint); this.hemi.intensity=1.1;
      this.showToast('👁 センスモード',{ultrasonic:'超音波 — 壁の向こうを感知',
        thermal:'熱源探知 — 暗闇でも敵が見える',aerial:'広域俯瞰',
        nightvision:'暗視 — 夜でも鮮明',normal:'通常視界'}[f.sense]||'',1500);
    } else {
      this.hemi.color.setHex(0x8db4ff); this.hemi.intensity=0.65;
    }
  }

  /* ----------------- MOVEMENT ----------------- */
  tryJump(){
    if(!this.running) return;
    const f=FORMS[formIndex(this.curForm)];
    if(f.canFly){
      // flap upward
      this.player.vel.y = f.jump*0.8;
      this.player.flying=true;
      this.addInstinct(1);
      this.sfx('jump');
    } else if(this.player.onGround){
      this.player.vel.y = f.jump;
      this.player.onGround=false;
      this.sfx('jump');
    }
  }

  readMoveInput(){
    // returns {x,z} in -1..1 (screen-relative: x=right, z=forward)
    let mx=0, mz=0;
    const k=this.keys;
    // FIX: previously arrows were swapped. Now correct mapping:
    //   forward = W / ArrowUp,  back = S / ArrowDown,
    //   left = A / ArrowLeft,   right = D / ArrowRight
    if(k['w']||k['arrowup'])    mz+=1;
    if(k['s']||k['arrowdown'])  mz-=1;
    if(k['a']||k['arrowleft'])  mx-=1;
    if(k['d']||k['arrowright']) mx+=1;
    if(this.isMobile && this.touch && this.touch.move.active){
      mx+=this.touch.move.dx; mz-=this.touch.move.dy; // up on joystick = forward
    }
    const mag=Math.hypot(mx,mz);
    if(mag>1){ mx/=mag; mz/=mag; }
    return {x:mx, z:mz};
  }

  /* ----------------- TOAST ----------------- */
  showToast(big, sub, dur=2000){
    this.dom.toastBig.textContent=big;
    this.dom.toastSub.textContent=sub||'';
    this.dom.toast.style.opacity='1';
    clearTimeout(this._toastT);
    this._toastT=setTimeout(()=>this.dom.toast.style.opacity='0',dur);
  }

  updateBars(){
    const p=this.player;
    this.dom.hpFill.style.width=(p.hp/p.maxHp*100)+'%';
    this.dom.hpTxt.textContent=Math.ceil(p.hp);
    this.dom.instinctFill.style.width=p.instinct+'%';
    this.dom.instinctTxt.textContent=Math.floor(p.instinct);
  }

  /* ----------------- MAIN LOOP ----------------- */
  loop(){
    const dt=Math.min(this.clock.getDelta(),0.05);
    if(this.running){
      this.updatePlayer(dt);
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      this.updateCamera(dt);
      this.updateParticles(dt);
      this.updateCrosshair();
      this.updateBars();
      this.updateXP();
    }
    this.renderer.render(this.scene,this.camera);
  }

  updatePlayer(dt){
    const p=this.player;
    const f=FORMS[formIndex(this.curForm)];
    p.attackCD=Math.max(0,p.attackCD-dt);
    p.hurtCD=Math.max(0,p.hurtCD-dt);
    p.dashCD=Math.max(0,p.dashCD-dt);

    // movement relative to camera yaw
    const inp=this.readMoveInput();
    const cy=this.cam.yaw;
    // camera-forward on XZ plane
    const fwd=new THREE.Vector3(-Math.sin(cy),0,-Math.cos(cy));
    const right=new THREE.Vector3(Math.cos(cy),0,-Math.sin(cy));
    const moveDir=new THREE.Vector3();
    moveDir.addScaledVector(fwd, inp.z);
    moveDir.addScaledVector(right, inp.x);
    const moving=moveDir.lengthSq()>0.001;
    if(moving){ moveDir.normalize();
      // face movement direction (unless attacking lunge)
      if(p.attackCD < f.attack.cooldown*0.6){
        const targetYaw=Math.atan2(moveDir.x,moveDir.z);
        p.yaw=this.lerpAngle(p.yaw,targetYaw,0.2);
      }
    }

    let speed=f.speed;
    // sprint with shift on ground forms
    if((this.keys['shift']) && f.id!=='snake'){ speed*=0.6; } // shift = sneak (slower, restores instinct)
    if(this.keys['shift']){ this.addInstinct(8*dt); }

    const accel=moving? speed : 0;
    p.vel.x = lerp(p.vel.x, moveDir.x*accel, 0.2);
    p.vel.z = lerp(p.vel.z, moveDir.z*accel, 0.2);

    // gravity / flying
    if(f.canFly){
      if(this.player.flying || !p.onGround){
        // hold space to ascend handled in tryJump (flap); gentle gravity
        p.vel.y -= 9*dt;
        if(this.keys[' ']) p.vel.y += 18*dt; // sustained flight while holding space
        p.vel.y=clamp(p.vel.y,-12,12);
      }
    } else {
      p.vel.y -= 26*dt; // gravity
    }

    // integrate
    p.pos.x += p.vel.x*dt;
    p.pos.y += p.vel.y*dt;
    p.pos.z += p.vel.z*dt;

    // ground collision
    const groundY = 0;
    const minY = f.canFly? 0 : 0;
    if(p.pos.y<=minY){ p.pos.y=minY; p.vel.y=0; p.onGround=true; p.flying=false; }
    else p.onGround=false;

    // arena bounds
    const distC=Math.hypot(p.pos.x,p.pos.z);
    if(distC>this.WORLD){ const a=Math.atan2(p.pos.z,p.pos.x);
      p.pos.x=Math.cos(a)*this.WORLD; p.pos.z=Math.sin(a)*this.WORLD;
      p.vel.x*=-0.3; p.vel.z*=-0.3; }

    // prop collision (simple push-out)
    for(const c of this.colliders){
      const dx=p.pos.x-c.x, dz=p.pos.z-c.z; const d=Math.hypot(dx,dz);
      const minD=c.r+0.6;
      if(d<minD && d>0.001){ const push=(minD-d); p.pos.x+=dx/d*push; p.pos.z+=dz/d*push; }
    }

    // sync mesh
    this.playerGroup.position.copy(p.pos);
    this.playerGroup.rotation.y=p.yaw;

    // animate legs/wings
    this.animatePlayer(dt, moving, f);

    // passive instinct regen for "form-true" behavior
    if(f.canFly && p.flying) this.addInstinct(6*dt);
  }

  lerpAngle(a,b,t){
    let d=b-a; while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU;
    return a+d*t;
  }

  animatePlayer(dt, moving, f){
    this.animT=(this.animT||0)+dt*(moving?12:3);
    if(this.legs){
      this.legs.forEach((leg,i)=>{
        const ph=this.animT+(i%2)*Math.PI;
        leg.rotation.x = moving? Math.sin(ph)*0.6 : 0;
      });
    }
    if(this.wingL && this.wingR){
      const fl=Math.sin((this.wingFlap=(this.wingFlap||0)+dt*10))*0.6;
      this.wingL.rotation.z = 0.2+fl; this.wingR.rotation.z=-0.2-fl;
    }
    if(this.snakeSegs){
      this.snakeSegs.forEach((seg,i)=>{ seg.position.x=Math.sin(this.animT*0.5+i*0.6)*0.3*(moving?1:0.4); });
    }
    if(this.tail){ this.tail.rotation.z=Math.sin(this.animT*0.5)*0.3; }
    // attack lunge anim
    if(this.attackAnim>0){ this.attackAnim-=dt;
      this.body.position.z = Math.sin(this.attackAnim*20)*0.3;
    } else { this.body.position.z=0; }
  }

  updateEnemies(dt){
    const p=this.player;
    for(const en of this.enemies){
      if(en.dead) continue;
      en.atkCD=Math.max(0,en.atkCD-dt);
      en.hurtFlash=Math.max(0,en.hurtFlash-dt);

      const to=new THREE.Vector3(p.pos.x-en.pos.x,0,p.pos.z-en.pos.z);
      const dist=to.length();
      to.normalize();

      const aggroRange=28;
      if(dist<aggroRange){
        en.state='chase';
        // move toward player but keep range for ranged
        const desired = en.ranged? en.range*0.7 : 0;
        if(dist>desired+0.5){
          en.vel.x=lerp(en.vel.x,to.x*en.speed,0.1);
          en.vel.z=lerp(en.vel.z,to.z*en.speed,0.1);
        } else {
          en.vel.x*=0.85; en.vel.z*=0.85;
        }
        // attack
        if(dist<=en.range && en.atkCD<=0){
          en.atkCD = en.ranged? 1.6 : 1.0;
          if(en.ranged){
            const sdir=new THREE.Vector3(p.pos.x-en.pos.x, (p.pos.y+0.6)-(en.pos.y+1.6), p.pos.z-en.pos.z).normalize();
            this.enemyShoot(en,sdir);
          } else {
            // lunge
            en.vel.x+=to.x*6; en.vel.z+=to.z*6;
            this.hurtPlayer(en.dmg);
          }
        }
        // face player
        en.group.rotation.y=Math.atan2(to.x,to.z);
      } else {
        // wander
        en.state='idle';
        en.wanderA += rand(-1,1)*dt;
        en.vel.x=lerp(en.vel.x,Math.cos(en.wanderA)*en.speed*0.3,0.05);
        en.vel.z=lerp(en.vel.z,Math.sin(en.wanderA)*en.speed*0.3,0.05);
        en.group.rotation.y=lerp(en.group.rotation.y, Math.atan2(en.vel.x,en.vel.z),0.05);
      }

      // flying bob
      if(en.fly){
        en.baseY=lerp(en.baseY, p.pos.y+rand(3,6), 0.02);
        en.pos.y=en.baseY + Math.sin(performance.now()*0.003+en.wanderA)*0.6;
        if(en.group.userData.wings){
          const fl=Math.sin(performance.now()*0.012)*0.7;
          en.group.userData.wings[0].rotation.z=0.2+fl;
          en.group.userData.wings[1].rotation.z=-0.2-fl;
        }
      }

      en.pos.x+=en.vel.x*dt; en.pos.z+=en.vel.z*dt;
      en.vel.x*=0.9; en.vel.z*=0.9;

      // bounds
      const dc=Math.hypot(en.pos.x,en.pos.z);
      if(dc>this.WORLD){const a=Math.atan2(en.pos.z,en.pos.x);
        en.pos.x=Math.cos(a)*this.WORLD; en.pos.z=Math.sin(a)*this.WORLD;}

      // hurt flash tint
      en.group.traverse(o=>{ if(o.isMesh && o.material && o.material.emissive){
        o.material.emissive.setHex(en.hurtFlash>0?0xff4444:0x000000);
      }});

      // health bar faces camera (sprite auto), keep above
      en.bar.material.opacity = (en.hp<en.maxHp)?1:0.0;
    }
  }

  updateProjectiles(dt){
    const p=this.player;
    for(let i=this.projectiles.length-1;i>=0;i--){
      const pr=this.projectiles[i];
      pr.life-=dt;
      pr.mesh.position.addScaledVector(pr.vel,dt);
      pr.vel.y-=4*dt;
      // hit player
      const d=pr.mesh.position.distanceTo(new THREE.Vector3(p.pos.x,p.pos.y+0.8,p.pos.z));
      if(d<1.0){ this.hurtPlayer(pr.dmg); pr.life=0; }
      if(pr.life<=0 || pr.mesh.position.y<0){
        this.scene.remove(pr.mesh); this.projectiles.splice(i,1);
      }
    }
  }

  updateParticles(dt){
    for(let i=this.particles.length-1;i>=0;i--){
      const pt=this.particles[i]; pt.life-=dt;
      if(pt.type==='spark'){
        pt.mesh.position.addScaledVector(pt.vel,dt);
        pt.vel.y-=12*dt;
        pt.mesh.material.opacity=clamp(pt.life/pt.maxLife,0,1);
        pt.mesh.material.transparent=true;
        pt.mesh.rotation.x+=dt*8; pt.mesh.rotation.y+=dt*6;
      } else if(pt.type==='slash'){
        const k=1-pt.life/pt.maxLife;
        pt.mesh.scale.setScalar(1+k*1.5);
        pt.mesh.material.opacity=clamp(pt.life/pt.maxLife,0,1);
      }
      if(pt.life<=0){ this.scene.remove(pt.mesh); this.particles.splice(i,1); }
    }
  }

  updateCamera(dt){
    const p=this.player;
    const f=FORMS[formIndex(this.curForm)];
    // eagle gets a higher, wider view
    const dist = f.canFly? this.cam.dist+3 : this.cam.dist;
    const targetY = p.pos.y + this.cam.height + (f.canFly?2:0);
    const cy=this.cam.yaw, cp=this.cam.pitch;
    const ox=Math.sin(cy)*Math.cos(cp)*dist;
    const oz=Math.cos(cy)*Math.cos(cp)*dist;
    const oy=Math.sin(cp)*dist;
    const desired=new THREE.Vector3(p.pos.x+ox, targetY+oy, p.pos.z+oz);
    if(!this._camPos) this._camPos=desired.clone();
    this._camPos.lerp(desired,0.18);
    this.camera.position.copy(this._camPos);
    // camera shake
    if(this.camShake>0){
      this.camShake=Math.max(0,this.camShake-dt*3);
      const s=this.camShake;
      this.camera.position.x += rand(-1,1)*s*0.4;
      this.camera.position.y += rand(-1,1)*s*0.4;
      this.camera.position.z += rand(-1,1)*s*0.4;
    }
    this.camera.lookAt(p.pos.x, p.pos.y+1.2, p.pos.z);

    // sun follows player for shadows
    this.sun.position.set(p.pos.x+30,55,p.pos.z+20);
    this.sun.target.position.set(p.pos.x,0,p.pos.z);
  }

  updateCrosshair(){
    // lock indicator if an enemy is within aim cone
    const f=FORMS[formIndex(this.curForm)];
    const dir=this.computeAim();
    const origin=this.player.pos.clone(); origin.y+=0.6;
    let locked=false;
    for(const en of this.enemies){ if(en.dead)continue;
      const to=en.pos.clone().sub(origin); const d=to.length();
      if(d>f.attack.range+3) continue;
      if(to.normalize().dot(dir)>0.7){ locked=true; break; }
    }
    this.dom.crosshair.classList.toggle('locked',locked);
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  window.GAME=new Game();
  // ---- automated self-test (only with ?autotest=1) ----
  if(location.search.includes('autotest')){
    const g=window.GAME;
    setTimeout(()=>{
      try{
        console.log('AUTOTEST start, mobile=',g.isMobile);
        g.start();
        console.log('AUTOTEST running=',g.running,'enemies=',g.enemies.length,'form=',g.curForm,'hp=',g.player.hp);
        const p0={x:g.player.pos.x,z:g.player.pos.z};
        g.keys['w']=true;
        setTimeout(()=>{
          g.keys['w']=false;
          console.log('AUTOTEST moved dx=',(g.player.pos.x-p0.x).toFixed(2),'dz=',(g.player.pos.z-p0.z).toFixed(2));
          // attack test
          const e=g.enemies[0];
          if(e){ const dir=g.aimDir.clone();
            e.pos.set(g.player.pos.x+dir.x*2,0,g.player.pos.z+dir.z*2);
            const hp0=e.hp; g.player.attackCD=0; g.tryAttack();
            console.log('AUTOTEST attack: enemy hp',hp0,'->',e.hp);
          } else console.log('AUTOTEST no enemy');
          // transform test
          g.unlocked.push('fox'); g.transform('fox');
          console.log('AUTOTEST transformed to',g.curForm,'maxHp=',g.player.maxHp);
          console.log('AUTOTEST DONE OK');
        },700);
      }catch(err){ console.log('AUTOTEST ERROR:',err.message,err.stack); }
    },1800);
  }
});
