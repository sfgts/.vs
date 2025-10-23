(function () {
  'use strict';

  // ===== Utils
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const rand  = (a,b)=>Math.random()*(b-a)+a;
  const dist2 = (ax,ay,bx,by)=>{const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy;};
  const now   = ()=>performance.now();

  // ===== Canvas + UI
  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d');
  const W = cvs.width, H = cvs.height;

  const ui = {
    lvl: document.getElementById('lvl'),
    xp: document.getElementById('xpbar'),
    hp: document.getElementById('hpbar'),
    kills: document.getElementById('kills'),
    time: document.getElementById('time'),
    pauseBtn: document.getElementById('pauseBtn'),
    levelup: document.getElementById('levelup'),
    opts: document.getElementById('opts'),
    xptext: document.getElementById('xptext'),
    fx: document.getElementById('fx'),
    startOverlay: document.getElementById('startOverlay'),
    startBtn: document.getElementById('startBtn'),
    storyOverlay: document.getElementById('storyOverlay'),
    storyText: document.getElementById('storyText'),
    storyOk: document.getElementById('storyOk'),
    storyHint: document.getElementById('storyHint'),
    storyAvatar: document.getElementById('storyAvatar'),
    musicBtn: document.getElementById('musicBtn')
  };

  // ===== Input
  const keys = new Set();
  addEventListener('keydown', e => {
    const k = (e.key || '').toLowerCase();
    keys.add(k); keys.add(e.code);
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { const k=(e.key||'').toLowerCase(); keys.delete(k); keys.delete(e.code); });

  // ===== Game state
  const game = {
    started: false,
    running: false,
    t0: now(),
    seconds: 0,
    lastSpawn: 0,
    spawnEvery: 1300,
    enemies: [],
    projs: [],
    gems: [],
    chests: [],
    nextChestAt: 120, // каждые 2 минуты
    kills: 0,
    difficulty: 0.5
  };

  const player = {
    x: W/2, y: H/2, r: 12, speed: 190,
    hp: 100, hpMax: 100,
    xp: 0, lvl: 1, xpNext: 10, xpBonus: 0,
    cd: 1.2, dmg: 10, lastAtk: 0,
    projCount: 1,
    invul: 0
  };

  // ===== Time helpers
  let last = now();
  let secAcc = 0;
  function tMod(dt){ secAcc += dt; if (secAcc >= 1){ secAcc -= 1; return true; } return false; }
  function fmtTime(s){ s|=0; const m=(s/60)|0, r=(s%60)|0; return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`; }

  // ===== GLOBAL VOLUMES
  const VOLUME = { music: 0.04, sfx: 0.06, typing: 0.08 };

  // ===== Systems
  function spawnEnemy(){
    const edge=(Math.random()*4)|0, m=30; let x=rand(0,W), y=rand(0,H);
    if(edge===0){x=-m;y=rand(0,H);} if(edge===1){x=W+m;y=rand(0,H);} if(edge===2){y=-m;x=rand(0,W);} if(edge===3){y=H+m;x=rand(0,W);}
    const speed=rand(25,45)+game.difficulty*3; const hp=10+game.difficulty*3;
    game.enemies.push({x,y,r:10,speed,hp,hpMax:hp,touchDmg:8});
  }

  function nearestEnemy(x,y){ let best=null,bd2=1e9; for(const e of game.enemies){ const d2=dist2(x,y,e.x,e.y); if(d2<bd2){bd2=d2; best=e;} } return best; }

  function fireAuto(){
    const t = now()/1000; if (t - player.lastAtk < player.cd) return;
    const target = nearestEnemy(player.x, player.y); if (!target) return;
    player.lastAtk = t;
    const dx=target.x-player.x, dy=target.y-player.y; const base=Math.atan2(dy,dx);
    const n = Math.max(1, Math.floor(player.projCount)); const spread=0.17;
    for(let i=0;i<n;i++){
      const off=(i-(n-1)/2)*spread, ang=base+off;
      const vx=Math.cos(ang)*260, vy=Math.sin(ang)*260;
      game.projs.push({x:player.x,y:player.y,r:4,vx,vy,life:1.8,dmg:player.dmg});
    }
    sfxPlay('shoot', 0.05); // выстрел
  }

  function dropGem(x,y){ game.gems.push({x,y,r:5,xp:2}); }
  function spawnChest(){ const m=40; const x=rand(m,W-m), y=rand(m,H-m); game.chests.push({x,y}); }

  function openChest(){
    const rewards=[
      {name:'Сила +3', apply:()=>{player.dmg+=3;}},
      {name:'Скорострельность +10%', apply:()=>{player.cd=player.cd*0.9;}},
      {name:'Скорость +10%', apply:()=>{player.speed=player.speed*1.1;}},
      {name:'Опыт +1 за кристалл', apply:()=>{player.xpBonus+=1;}},
      {name:'Доп. снаряд +1', apply:()=>{player.projCount+=1;}},
      {name:'Здоровье +15', apply:()=>{player.hpMax+=15; player.hp=player.hpMax;}}
    ];
    const r = rewards[(Math.random()*rewards.length)|0];

    sfxPlay('chest', 0.35); // сундук

    ui.opts.innerHTML='';
    const info=document.createElement('div'); info.className='opt'; info.innerHTML='<b>Сундук!</b><div class="muted">Награда: '+r.name+'</div>';
    const ok=document.createElement('div'); ok.className='opt'; ok.innerHTML='<b>Забрать</b>';
    ok.onclick=function(){ r.apply(); ui.levelup.style.display='none'; game.running=true; };
    ui.opts.appendChild(info); ui.opts.appendChild(ok);
    ui.levelup.style.display='grid'; game.running=false;
  }

  function levelUp(){
    player.lvl++; player.xp=0; player.xpNext=Math.floor(player.xpNext*1.35+2);

    const pool=[
      {name:'Сила +3', apply:()=>{player.dmg+=3;}, desc:'Увеличивает урон автоатаки'},
      {name:'Скорострельность +10%', apply:()=>{player.cd=player.cd*0.9;}, desc:'Снижает перезарядку'},
      {name:'Скорость +10%', apply:()=>{player.speed=player.speed*1.1;}, desc:'Быстрее двигаться'},
      {name:'Опыт +1 за кристалл', apply:()=>{player.xpBonus+=1;}, desc:'Больше EXP с дропа'},
      {name:'Доп. снаряд +1', apply:()=>{player.projCount+=1;}, desc:'Больше выстрелов'},
      {name:'Здоровье +15', apply:()=>{player.hpMax+=15; player.hp=player.hpMax;}, desc:'Полное исцеление'}
    ];
    for(let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
    const choices = pool.slice(0,3);

    ui.opts.innerHTML='';
    for (const c of choices){
      const el=document.createElement('div'); el.className='opt';
      el.innerHTML = `<b>${c.name}</b><div class="muted">${c.desc}</div>`;
      el.onclick=function(){
        c.apply();
        sfxPlay('levelup', 0.35); // апгрейд получен
        ui.levelup.style.display='none';
        game.running=true;
      };
      ui.opts.appendChild(el);
    }
    ui.levelup.style.display='grid'; game.running=false;
  }

  // ===== Loop
  function tick(){ const t=now(); const dt=(t-last)/1000; last=t; if(game.running){ update(dt,t); render(); } requestAnimationFrame(tick); }

  function update(dt,t){
    game.seconds += dt;
    if (tMod(dt)) { game.difficulty += 0.01; ui.time.textContent = fmtTime(game.seconds); }

    // movement
    let ax=0, ay=0;
    if (keys.has('w')||keys.has('arrowup')||keys.has('KeyW')) ay-=1;
    if (keys.has('s')||keys.has('arrowdown')||keys.has('KeyS')) ay+=1;
    if (keys.has('a')||keys.has('arrowleft')||keys.has('KeyA')) ax-=1;
    if (keys.has('d')||keys.has('arrowright')||keys.has('KeyD')) ax+=1;
    const len=Math.hypot(ax,ay)||1;
    player.x += ax/len*player.speed*dt;
    player.y += ay/len*player.speed*dt;
    player.x = clamp(player.x, player.r, W-player.r);
    player.y = clamp(player.y, player.r, H-player.r);
    player.invul = Math.max(0, player.invul - dt*1000);

    // spawn
    if (t - game.lastSpawn > Math.max(250, game.spawnEvery - game.difficulty*40)) { game.lastSpawn = t; spawnEnemy(); }
    if (game.seconds >= game.nextChestAt) { spawnChest(); game.nextChestAt += 120; }

    // enemies seek
    for (const e of game.enemies){ const dx=player.x-e.x, dy=player.y-e.y; const l=Math.hypot(dx,dy)||1; e.x+=dx/l*e.speed*dt; e.y+=dy/l*e.speed*dt; }

    // fire
    fireAuto();

    // projectiles
    for (const p of game.projs){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; }

    // collisions
    for (const p of game.projs){ if (p.life<=0) continue; for (const e of game.enemies){ const r=p.r+e.r; if (dist2(p.x,p.y,e.x,e.y)<=r*r){ e.hp-=p.dmg; p.life=0; break; } } }

    // deaths
    for (let i=game.enemies.length-1;i>=0;i--){ const e=game.enemies[i]; if (e.hp<=0){ game.enemies.splice(i,1); game.kills++; ui.kills.textContent=game.kills; dropGem(e.x,e.y); } }

    // contact damage
    for (const e of game.enemies){ const r=player.r+e.r; if (player.invul<=0 && dist2(player.x,player.y,e.x,e.y)<=r*r){ player.hp-=e.touchDmg; player.invul=550; if (player.hp<=0){ gameOver(); return; } } }

    // gems
    for (const g of game.gems){ const d2=dist2(player.x,player.y,g.x,g.y); if (d2<140*140){ const d=Math.sqrt(d2)||1; g.x += (player.x-g.x)/d*120*dt; g.y += (player.y-g.y)/d*120*dt; } }
    for (let i=game.gems.length-1;i>=0;i--){ const g=game.gems[i]; const r=player.r+g.r;
      if (dist2(player.x,player.y,g.x,g.y)<=r*r){
        const gained = g.xp + player.xpBonus;
        player.xp += gained; showXp('+ '+gained+' XP');
        game.gems.splice(i,1);
        if (player.xp >= player.xpNext) levelUp();
      }
    }

    // chest pickup
    for (let i=game.chests.length-1;i>=0;i--){ const c=game.chests[i]; const r=player.r+10; if (dist2(player.x,player.y,c.x,c.y)<=r*r){ openChest(); game.chests.splice(i,1); } }

    // cleanup
    game.projs = game.projs.filter(p=>p.life>0 && p.x>-20 && p.x<W+20 && p.y>-20 && p.y<H+20);

    // UI bars
    ui.lvl.textContent = player.lvl;
    ui.xp.style.width = Math.min(100,(player.xp/player.xpNext)*100) + '%';
    ui.hp.style.width = Math.max(0,(player.hp/player.hpMax)*100) + '%';
    if (ui.xptext) ui.xptext.textContent = Math.floor(player.xp)+' / '+player.xpNext+' XP';

    // === Low HP glitch pulse (≤30%)
    if (player.hp / player.hpMax <= 0.3) {
      document.body.classList.add('low-hp');
    } else {
      document.body.classList.remove('low-hp');
    }
  }

  function render(){
    ctx.clearRect(0,0,W,H);

    // background grid
    ctx.save(); ctx.strokeStyle='#151a22'; ctx.lineWidth=1;
    for (let x=0; x<=W; x+=32){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y=0; y<=H; y+=32){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.restore();

    // chests
    for (const c of game.chests) drawChest(c.x,c.y);

    // gems
    for (const g of game.gems){ drawCircle(g.x,g.y,g.r,'#49a6ff'); drawRing(g.x,g.y,g.r+2,'#2d6ea8'); }

    // enemies
    for (const e of game.enemies){ drawCircle(e.x,e.y,e.r,'#9b2d30'); const pct=clamp(e.hp/e.hpMax,0,1); drawArcRing(e.x,e.y,e.r+3,0,Math.PI*2*pct,'#c9484d'); }

    // projectiles
    for (const p of game.projs) drawCircle(p.x,p.y,p.r,'#d6e8ff');

    // player
    drawCircle(player.x,player.y,player.r,'#e2f04b'); if (player.invul>0) drawRing(player.x,player.y,player.r+4,'#e2f04b55');
  }

  // ===== Draw helpers
  function drawCircle(x,y,r,fill){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=fill; ctx.fill(); }
  function drawRing(x,y,r,stroke){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.strokeStyle=stroke; ctx.lineWidth=2; ctx.stroke(); }
  function drawArcRing(x,y,r,a0,a1,stroke){ ctx.beginPath(); ctx.arc(x,y,r,a0,a1); ctx.strokeStyle=stroke; ctx.lineWidth=3; ctx.stroke(); }
  function drawChest(x,y){
    ctx.save(); ctx.translate(x,y); ctx.fillStyle='#cfa84a'; ctx.strokeStyle='#8c6b1d'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.rect(-10,-8,20,16); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10,-2); ctx.lineTo(10,-2); ctx.stroke();
    ctx.restore();
  }

  // ===== FX
  function showXp(txt){
    try {
      const anchor = ui.xptext || ui.lvl;
      const r = anchor.getBoundingClientRect();
      const el = document.createElement('div');
      el.className = 'xppop';
      el.textContent = txt;
      el.style.left = (r.left + r.width/2) + 'px';
      el.style.top  = (r.top - 6) + 'px';
      ui.fx.appendChild(el);
      requestAnimationFrame(()=>{ el.classList.add('show'); });
      setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translate(-50%,-30px) scale(0.98)'; }, 600);
      setTimeout(()=>{ el.remove(); }, 900);
    } catch(e) {}
  }

  // ===== Music (BG)
  const music = { audio:null, playing:false };
  function ensureMusic(){
    if (!music.audio) {
      music.audio = new Audio('music/arcade_theme.mp3');
      music.audio.loop = true;
      music.audio.volume = VOLUME.music;
    }
  }
  function playMusic(){
    ensureMusic();
    const p = music.audio.play();
    if (p && p.then) {
      p.then(() => { music.playing = true; ui.musicBtn.textContent = '♫ Музыка: вкл'; })
       .catch(() => { /* автоплей заблокирован до первого действия */ });
    } else { music.playing = true; ui.musicBtn.textContent = '♫ Музыка: вкл'; }
  }
  function pauseMusic(){ if (music.audio){ music.audio.pause(); music.playing=false; ui.musicBtn.textContent='♫ Музыка: выкл'; } }
  function toggleMusic(){ music.playing ? pauseMusic() : playMusic(); }
  ui.musicBtn.onclick = toggleMusic;

  // Автостарт + разблокировка
  window.addEventListener('load', () => {
    playMusic();
    const unlock = () => { if (!music.playing) playMusic(); };
    window.addEventListener('pointerdown', unlock, { once:true });
    window.addEventListener('keydown',     unlock, { once:true });
  });

  // ===== SFX (универсальный проигрыватель)
  const sfx = {
    shoot:   'music/shoot.wav',
    levelup: 'music/levelup.wav',
    chest:   'music/chest.wav',
    death:   'music/death.wav',
    typing:  'music/typing.wav'
  };
  const sfxCache = {};
  function sfxPlay(name, vol = VOLUME.sfx){
    try{
      const src = sfx[name]; if(!src) return;
      const a = (sfxCache[name] && sfxCache[name].pop()) || new Audio(src);
      a.volume = vol; a.currentTime = 0;
      a.onended = () => { (sfxCache[name]||(sfxCache[name]=[])).push(a); };
      a.play().catch(()=>{ /* может требовать первый клик */ });
    }catch(e){}
  }

  // ===== Game over
  function gameOver(){
    sfxPlay('death', 0.4);
    document.body.classList.remove('low-hp'); // на всякий случай выключаем тревогу
    ui.levelup.style.display='grid';
    ui.opts.innerHTML='';
    const over=document.createElement('div'); over.className='opt';
    over.innerHTML='<b>Игра окончена</b><div class="muted">Убитых: '+game.kills+' · Время: '+fmtTime(game.seconds)+'</div>';
    const retry=document.createElement('div'); retry.className='opt'; retry.innerHTML='<b>Начать заново</b>';
    retry.onclick=()=>location.reload();
    ui.opts.appendChild(over); ui.opts.appendChild(retry);
    game.running=false;
  }

  // ===== Story / Start (typewriter с бипами)
  function typeText(el, text, cps, done){
    el.textContent = '';
    let i = 0, step = Math.max(1, cps|0);
    (function tick(){
      el.textContent = text.slice(0, i += step);

      const ch = text[i-1];
      if (i % 2 === 0 && ch && ch.trim() !== '') {
        sfxPlay('typing', VOLUME.typing);
      }
      if (i < text.length) setTimeout(tick, 18);
      else done && done();
    })();
  }

  const STORY = 'Ты — “спящий аватар”, застрявший в глитч-мире между сервером и подсознанием.\n' +
                'Каждая сессия — это цикл сна, где нужно выжить среди багов, вирусов и обрывков воспоминаний.';

  function showStory(){
    // ui.storyAvatar.src = 'img/portrait_default.gif'; // если нужно менять портрет
    ui.storyOverlay.style.display = 'grid';
    ui.storyOk.style.display = 'none';
    ui.storyHint.style.display = 'none';
    typeText(ui.storyText, STORY, 1, function(){
      ui.storyOk.style.display = 'inline-block';
      ui.storyHint.style.display = 'block';
    });
  }

  function startRun(){
    game.started = true;
    document.body.classList.remove('low-hp'); // сброс тревоги на старте
    ui.levelup.style.display='none';
    ui.storyOverlay.style.display='none';
    ui.startOverlay.style.display='none';
    game.seconds = 0; ui.time.textContent='00:00'; game.t0 = now();
    game.running = true;
  }

  // ===== Pause
  ui.pauseBtn.onclick = function(){
    if (!game.started) return;
    game.running = !game.running;
    ui.pauseBtn.textContent = game.running ? '⏸︎ Пауза' : '▶ Продолжить';
  };

  ui.startBtn.addEventListener('click', () => { ui.startOverlay.style.display='none'; showStory(); });
  ui.storyOk.addEventListener('click', startRun);
  ui.storyOverlay.addEventListener('click', (e) => {
    if (ui.storyOk.style.display !== 'none' && e.target === ui.storyOverlay) startRun();
  });

  // ===== Draw loop kickoff
  function drawCircle(x,y,r,fill){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=fill; ctx.fill(); }
  function drawRing(x,y,r,stroke){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.strokeStyle=stroke; ctx.lineWidth=2; ctx.stroke(); }
  function drawArcRing(x,y,r,a0,a1,stroke){ ctx.beginPath(); ctx.arc(x,y,r,a0,a1); ctx.strokeStyle=stroke; ctx.lineWidth=3; ctx.stroke(); }
  function drawChest(x,y){
    ctx.save(); ctx.translate(x,y); ctx.fillStyle='#cfa84a'; ctx.strokeStyle='#8c6b1d'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.rect(-10,-8,20,16); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10,-2); ctx.lineTo(10,-2); ctx.stroke();
    ctx.restore();
  }

  function tick(){ const t=now(); const dt=(t-last)/1000; last=t; if(game.running){ update(dt,t); render(); } requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
})();
