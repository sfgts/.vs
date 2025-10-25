(function () {
  'use strict';

  // ===== Utils
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const rand  = (a,b)=>Math.random()*(b-a)+a;
  const dist2 = (ax,ay,bx,by)=>{const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy;};
  const now   = ()=>performance.now();

  // ===== Canvas + UI
  const cvs = document.getElementById('game');
  if (!cvs) {
    console.error('[game] <canvas id="game"> не найден. Проверь разметку или добавь defer при подключении скрипта.');
    return;
  }
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false; // пиксель-арт без мыла
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
    musicBtn: document.getElementById('musicBtn'),
    settingsBtn: document.getElementById('settingsBtn')
  };

  // ===== Стартовое меню: стили и сборка
const MENU_BG = 'img/menu/bg.gif'; // фон меню

(function injectMenuStyles(){
  const css = `
    #startOverlay{
      position:fixed; inset:0; display:none; place-items:center;
      background: url('${MENU_BG}') center/cover no-repeat, #0e3fe0ff;
      z-index:50;
    }
    .start-panel{
      display:flex; flex-direction:column; gap:12px;
      align-items:center; width:min(340px,90vw);
      padding:20px 16px;
      background:#0c1322cc; border:1px solid #000000ff; border-radius:14px;
      box-shadow:0 12px 40px rgba(7, 59, 107, 0.6), inset 0 0 0 1px #0006;
    }
    .start-title{
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight:800; letter-spacing:1px; font-size:20px; color:#e7ecf9;
      text-shadow:0 2px 0 #000a; margin-bottom:6px;
    }
    .pixel-btn{
      width:100%; padding:12px 10px; border-radius:10px;
      border:1px solid #000000ff; background:linear-gradient(#1b2338,#121a2c);
      color:#e7ecf9; font-weight:700; letter-spacing:.5px;
      box-shadow:inset 0 -3px 0 #0008, 0 3px 12px #0007;
      cursor:pointer; transition:transform .05s ease, filter .1s;
    }
    .pixel-btn:hover{ filter:brightness(1.1); }
    .pixel-btn:active{ transform:translateY(1px); }
  `;
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
})();

// ===== Pause overlay =====
const PAUSE_ICON = 'img/ui/pause.png'; // PNG значок паузы

(function injectPauseStyles(){
  const css = `
    #pauseOverlay{
      position:fixed; inset:0; display:none; place-items:center;
      background:rgba(8,12,20,.35);
      z-index:60; /* выше канваса и HUD */
      backdrop-filter: blur(2px);
    }
    .pause-box{
      display:flex; flex-direction:column; align-items:center; gap:12px;
      padding:24px 28px; border-radius:16px;
      background:#0b1120cc; border:1px solid #2b3650;
      box-shadow:0 10px 40px #000a, inset 0 0 0 1px #0006;
    }
    .pause-icon{
      width:72px; height:72px; image-rendering: pixelated;
      background:url('${PAUSE_ICON}') center/contain no-repeat;
      opacity:.95;
    }
    .pause-title{
      font-weight:800; letter-spacing:.6px; color:#e7ecf9; text-shadow:0 2px 0 #000a;
    }
    .pause-hint{
      position:fixed; right:450px; bottom:66px; z-index:61; color:#c9d6ffcc;
      font-weight:600; letter-spacing:.3px; display:flex; align-items:center; gap:8px;
      pointer-events:none; user-select:none;
    }
    .keycap{display:inline-block;padding:4px 10px;border:1px solid #3c4253;
      border-radius:8px;background:#0b1020cc;box-shadow:inset 0 -2px 0 #0008;
      font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.5px}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

function buildPauseOverlay(){
  if (document.getElementById('pauseOverlay')) return;
  const wrap = document.createElement('div'); wrap.id = 'pauseOverlay';
  wrap.innerHTML = `
    <div class="pause-box">
      <div class="pause-icon"></div>
      <div class="pause-title">Пауза</div>
      <div style="opacity:.75">Нажми <span class="keycap">Esc</span> чтобы продолжить</div>
    </div>
  `;
  document.body.appendChild(wrap);

  // маленькая подсказка в HUD (можешь потом передвинуть стилями)
  const hint = document.createElement('div');
  hint.className = 'pause-hint';
  hint.innerHTML = `<span class="keycap">Esc</span> — пауза`;
  document.body.appendChild(hint);
}
buildPauseOverlay();


function buildStartMenu(){
  if (!ui.startOverlay) return;
  // очистим и соберём панель
  ui.startOverlay.innerHTML = '';
  const panel = document.createElement('div'); panel.className='start-panel';

  const title = document.createElement('div'); title.className='start-title'; title.textContent='VS';
  const play  = document.createElement('button'); play.className='pixel-btn'; play.textContent='Start';
  const sets  = document.createElement('button'); sets.className='pixel-btn'; sets.textContent='Settings';

  play.onclick = startFromMenu;
  sets.onclick = () => alert('Settings: Comming Soon...');

  panel.appendChild(title);
  panel.appendChild(play);
  panel.appendChild(sets);
  ui.startOverlay.appendChild(panel);
}

  // ---- Центрированные подписи внутри HP/XP баров
(function injectBarLabelStyles(){
  const css = `
    .bar-label{
      position:absolute; inset:0;
      display:flex; align-items:center; justify-content:center;
      font-weight:600; font-size:12px; letter-spacing:.3px;
      color:#e7ecf9; text-shadow:0 1px 0 #000a;
      pointer-events:none; user-select:none;
    }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

const barLabels = { hp: null, xp: null };
function ensureBarLabels(){
  if (ui.hp && !barLabels.hp){
    const wrap = ui.hp.parentElement;
    if (wrap){ wrap.style.position = 'relative';
      barLabels.hp = document.createElement('div');
      barLabels.hp.className = 'bar-label';
      wrap.appendChild(barLabels.hp);
    }
  }
  if (ui.xp && !barLabels.xp){
    const wrap = ui.xp.parentElement;
    if (wrap){ wrap.style.position = 'relative';
      barLabels.xp = document.createElement('div');
      barLabels.xp.className = 'bar-label';
      wrap.appendChild(barLabels.xp);
    }
  }
}
ensureBarLabels();

// ---- Hint "Space" стили и отрисовка
(function injectKeycapStyles(){
  const css = `
    .keycap{display:inline-block;padding:4px 10px;border:1px solid #3c4253;
      border-radius:8px;background:#0b1020cc;box-shadow:inset 0 -2px 0 #0008;
      font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.5px}
    .keycap--space{min-width:60px;text-align:center}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

// Контроллер состояния печати истории
const storyCtrl = { active:false, finished:false, cancel:null };

// Правый нижний угол внутри storyOverlay
function showSpaceHint(text){
  if (!ui.storyHint) return;
  ui.storyHint.style.position = 'absolute';
  ui.storyHint.style.right = '450px';
  ui.storyHint.style.bottom = '96px';
  ui.storyHint.style.display = 'block';
  ui.storyHint.innerHTML = `<span class="keycap keycap--space">Space</span> ${text || '— пропустить'}`;
}

  // заголовок оверлея (универсальный)
  const overlayTitleEl = ui.levelup ? ui.levelup.querySelector('h3') : null;
  function setOverlayTitle(t){
    if (overlayTitleEl) overlayTitleEl.textContent = t;
  }

  // ===== Input
  const keys = new Set();
  addEventListener('keydown', e => {
    const k = (e.key || '').toLowerCase();
    keys.add(k); keys.add(e.code);
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { const k=(e.key||'').toLowerCase(); keys.delete(k); keys.delete(e.code); });
// ПРОБЕЛ: пропуск/допечатать историю
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  // если окно истории видно — перехватываем
  if (ui.storyOverlay && ui.storyOverlay.style.display !== 'none') {
    e.preventDefault();
    if (!storyCtrl.finished) {
      // ещё печатает — дописать мгновенно
      storyCtrl.cancel && storyCtrl.cancel();
      // и обновить подсказку
      showSpaceHint('— начать');
    } else {
      // печать закончена — стартуем игру
      startRun();
    }
  }
}, { passive:false });
  // ===== Game state
  const game = {
    started: false,
    running: false,
    t0: now(),
    seconds: 0,
    lastSpawn: 0,
    spawnEvery: 700,
    enemies: [],
    projs: [],
    gems: [],
    chests: [],
    nextChestAt: 120, // каждые 2 минуты
    kills: 0,
    difficulty: 0.5
  };

  window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    e.preventDefault();
    togglePause();
  }
}, { passive:false });

  // === Hero spritesheet
  const HERO_SHEET_SRC = 'img/hero/run.png';
  const HERO_FRAMES    = 6;
  const HERO_FPS       = 10;
  const HERO_DT        = 1000 / HERO_FPS;
  const HERO_SCALE     = 2;
  const HERO_ANCHOR    = { x: 2, y: -4 }; // смещение визуального центра

  const SHEET = { margin: 0, spacing: 0, frameW: null, frameH: null };

  const heroSheet = new Image();
  heroSheet.src = HERO_SHEET_SRC;

  // игрок (радиус пересчитаем после onload)
  const player = {
    x: W/2, y: H/2,
    r: 12, // временно; после onload станет точным
    speed: 190,
    hp: 100, hpMax: 100,
    xp: 0, lvl: 1, xpNext: 10, xpBonus: 0,
    cd: 1.2, dmg: 10, lastAtk: 0,
    projCount: 1,
    invul: 0,
    scale: HERO_SCALE,
    sprite: { tAcc: 0, frame: 0, moving: false, facing: 1 }
  };

  heroSheet.onload = () => {
    const totalW = heroSheet.naturalWidth - SHEET.margin*2 - SHEET.spacing*(HERO_FRAMES-1);
    SHEET.frameW = Math.floor(totalW / HERO_FRAMES);
    SHEET.frameH = heroSheet.naturalHeight;
    player.r = Math.min(SHEET.frameW, SHEET.frameH) * HERO_SCALE * 0.30;
  };

  // ===== Time helpers
  let last = now();
  let secAcc = 0;
  function tMod(dt){ secAcc += dt; if (secAcc >= 1){ secAcc -= 1; return true; } return false; }
  function fmtTime(s){ s|=0; const m=(s/60)|0, r=(s%60)|0; return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`; }

  // ===== GLOBAL VOLUMES
  const VOLUME = { music: 0.1, sfx: 0.06, typing: 0.08 };

  // ===== Systems
  function spawnEnemy(){
    const edge=(Math.random()*4)|0, m=30; let x=rand(0,W), y=rand(0,H);
    if(edge===0){x=-m;y=rand(0,H);} if(edge===1){x=W+m;y=rand(0,H);}
    if(edge===2){y=-m;x=rand(0,W);} if(edge===3){y=H+m;x=rand(0,W);}

    const baseSpeed = rand(25,45);
    const speed = baseSpeed + game.difficulty * 5;
    const hp    = 10 + game.difficulty * 4;
    const touchDmg = 10 + Math.floor(game.difficulty*1.2);

    game.enemies.push({ x, y, r:10, speed, hp, hpMax:hp, touchDmg });
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
    sfxPlay('shoot', 0.05);
  }

  function dropGem(x,y){ game.gems.push({x,y,r:5,xp:2}); }
  function spawnChest(){ const m=40; const x=rand(m,W-m), y=rand(m,H-m); game.chests.push({x,y}); }

  function openChest(){
    const rewards=[
      {name:'Урон +1', apply:()=>{player.dmg+=1;}},
      {name:'Скорострельность +10%', apply:()=>{player.cd=player.cd*0.9;}},
      {name:'Скорость +10%', apply:()=>{player.speed=player.speed*1.1;}},
      {name:'Опыт +1 за кристалл', apply:()=>{player.xpBonus+=1;}},
      {name:'Доп. снаряд +1', apply:()=>{player.projCount+=1;}},
      {name:'Здоровье +15', apply:()=>{player.hpMax+=15; player.hp=player.hpMax;}}
    ];
    const r = rewards[(Math.random()*rewards.length)|0];

    sfxPlay('chest', 0.35);

    setOverlayTitle('Сундук!');
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
      {name:'Урон +1', apply:()=>{player.dmg+=1;}, desc:'Увеличивает урон автоатаки'},
      {name:'Скорострельность +10%', apply:()=>{player.cd=player.cd*0.9;}, desc:'Снижает перезарядку'},
      {name:'Скорость +10%', apply:()=>{player.speed=player.speed*1.1;}, desc:'Быстрее двигаться'},
      {name:'Опыт +1 за кристалл', apply:()=>{player.xpBonus+=1;}, desc:'Больше EXP с дропа'},
      {name:'Доп. снаряд +1', apply:()=>{player.projCount+=1;}, desc:'Больше выстрелов'},
      {name:'Здоровье +15', apply:()=>{player.hpMax+=15; player.hp=player.hpMax;}, desc:'Полное исцеление'}
    ];
    for(let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
    const choices = pool.slice(0,3);

    setOverlayTitle('Повышение уровня!');
    ui.opts.innerHTML='';
    for (const c of choices){
      const el=document.createElement('div'); el.className='opt';
      el.innerHTML = `<b>${c.name}</b><div class="muted">${c.desc}</div>`;
      el.onclick=function(){
        c.apply();
        sfxPlay('levelup', 0.35);
        ui.levelup.style.display='none';
        game.running=true;
      };
      ui.opts.appendChild(el);
    }
    ui.levelup.style.display='grid'; game.running=false;
  }

  // ===== Update & Render
  function update(dt,t){
    game.seconds += dt;
    if (tMod(dt)) { game.difficulty += 0.01; if (ui.time) ui.time.textContent = fmtTime(game.seconds); }

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

    // анимация и «фейсинг»
    const movingNow = (ax !== 0 || ay !== 0);
    player.sprite.moving = movingNow;

    if (movingNow) {
      if (Math.abs(ax) >= Math.abs(ay)) {
        player.sprite.facing = ax >= 0 ? 1 : -1;
      }
      player.sprite.tAcc += dt*1000;
      while (player.sprite.tAcc >= HERO_DT) {
        player.sprite.tAcc -= HERO_DT;
        player.sprite.frame = (player.sprite.frame + 1) % HERO_FRAMES;
      }
    } else {
      player.sprite.frame = 0;
      player.sprite.tAcc = 0;
    }

    player.invul = Math.max(0, player.invul - dt*1000);

    // spawn — быстрее и пачками
    const spawnInterval = Math.max(180, game.spawnEvery - game.difficulty*60);
    if (t - game.lastSpawn > spawnInterval) {
      game.lastSpawn = t;
      const pack = 1 + Math.floor(game.difficulty / 2);
      for (let i = 0; i < pack; i++) spawnEnemy();
    }
    if (game.seconds >= game.nextChestAt) { spawnChest(); game.nextChestAt += 120; }

    // enemies seek
    for (const e of game.enemies){
      const dx=player.x-e.x, dy=player.y-e.y; const l=Math.hypot(dx,dy)||1;
      e.x+=dx/l*e.speed*dt; e.y+=dy/l*e.speed*dt;
    }

    // fire
    fireAuto();

    // projectiles
    for (const p of game.projs){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; }

    // collisions
    for (const p of game.projs){
      if (p.life<=0) continue;
      for (const e of game.enemies){
        const r=p.r+e.r;
        if (dist2(p.x,p.y,e.x,e.y)<=r*r){ e.hp-=p.dmg; p.life=0; break; }
      }
    }

    // deaths
    for (let i=game.enemies.length-1;i>=0;i--){
      const e=game.enemies[i];
      if (e.hp<=0){
        game.enemies.splice(i,1); game.kills++; if (ui.kills) ui.kills.textContent=game.kills; dropGem(e.x,e.y);
      }
    }

    // contact damage
    for (const e of game.enemies){
      const r=player.r+e.r;
      if (player.invul<=0 && dist2(player.x,player.y,e.x,e.y)<=r*r){
        player.hp-=e.touchDmg; player.invul=550;
        if (player.hp<=0){ gameOver(); return; }
      }
    }

    // gems
    for (const g of game.gems){
      const d2=dist2(player.x,player.y,g.x,g.y);
      if (d2<140*140){ const d=Math.sqrt(d2)||1; g.x += (player.x-g.x)/d*120*dt; g.y += (player.y-g.y)/d*120*dt; }
    }
    for (let i=game.gems.length-1;i>=0;i--){
      const g=game.gems[i]; const r=player.r+g.r;
      if (dist2(player.x,player.y,g.x,g.y)<=r*r){
        const gained = g.xp + player.xpBonus;
        player.xp += gained; showXp('+ '+gained+' XP');
        game.gems.splice(i,1);
        if (player.xp >= player.xpNext) levelUp();
      }
    }

    // chest pickup
    for (let i=game.chests.length-1;i>=0;i--){
      const c=game.chests[i]; const r=player.r+10;
      if (dist2(player.x,player.y,c.x,c.y)<=r*r){ openChest(); game.chests.splice(i,1); }
    }

    // cleanup
    game.projs = game.projs.filter(p=>p.life>0 && p.x>-20 && p.x<W+20 && p.y>-20 && p.y<H+20);

    // UI bars
// UI bars
if (ui.lvl) ui.lvl.textContent = player.lvl;

// ширины
if (ui.xp)  ui.xp.style.width = Math.min(100,(player.xp/player.xpNext)*100) + '%';
if (ui.hp)  ui.hp.style.width = Math.max(0,(player.hp/player.hpMax)*100) + '%';

// подписи внутри баров
if (barLabels.xp) barLabels.xp.textContent = `${Math.floor(player.xp)} / ${player.xpNext} XP`;
if (barLabels.hp) barLabels.hp.textContent = `${Math.max(0, player.hp|0)} / ${player.hpMax|0} HP`;

// при желании можно убрать старый левый счетчик XP,
// но если нужен — оставляем, просто обновляем:
if (ui.xptext) ui.xptext.textContent = `${Math.floor(player.xp)} / ${player.xpNext} XP`;

    // Low HP ring (≤30%)
    if (player.hp / player.hpMax <= 0.3) document.body.classList.add('low-hp');
    else document.body.classList.remove('low-hp');
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

    // player (спрайт из ленты)
    drawPlayerFromSheet(player.x, player.y);

    // индикатор инвулна — из того же центра, что и спрайт
    if (player.invul > 0) {
      const c = getHeroCenter();
      drawRing(c.x, c.y, player.r + 4, '#e2f04b55');
    }
  }

  // ===== Draw helpers
  function getHeroCenter() {
    return { x: player.x + HERO_ANCHOR.x, y: player.y + HERO_ANCHOR.y };
  }

  function drawPlayerFromSheet(x, y) {
    // выравниваем центр
    const c = getHeroCenter();
    x = c.x; y = c.y;

    if (!heroSheet.complete || !heroSheet.naturalWidth || !SHEET.frameW) {
      drawCircle(x, y, player.r, '#e2f04b');
      return;
    }

    const fw = SHEET.frameW|0;
    const fh = SHEET.frameH|0;
    const sp = SHEET.spacing|0;
    const mg = SHEET.margin|0;

    const f  = (player.sprite.frame|0) % HERO_FRAMES;
    const sx = (mg + f*(fw + sp))|0;
    const sy = 0;

    const dw = (fw * player.scale)|0;
    const dh = (fh * player.scale)|0;

    const dx = (x - (dw/2)|0)|0;
    const dy = (y - (dh/2)|0)|0;

    ctx.save();
    if (player.invul > 0) {
      const blink = ((performance.now()/80)|0) % 2 === 0;
      ctx.globalAlpha = blink ? 0.65 : 1;
    }
    if (player.sprite.facing === -1) {
      ctx.translate((dx + (dw>>1)) * 2, 0);
      ctx.scale(-1, 1);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(heroSheet, sx, sy, fw, fh, dx, dy, dw, dh);
    ctx.restore();
  }

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

    const music = {
        menu: { audio: null, src: 'music/menu_theme.mp3', playing: false },
        game: { audio: null, src: 'music/arcade_theme.mp3', playing: false },
        current: 'menu', // что считаем активным контекстом
};

function ensureTrack(name){
  const t = music[name];
  if (!t.audio){
    t.audio = new Audio(t.src);
    t.audio.loop = true;
    t.audio.volume = VOLUME.music;
  }
  return t.audio;
}

function pauseAll(){
  ['menu','game'].forEach(n => {
    const t = music[n];
    if (t.audio) t.audio.pause();
    t.playing = false;
  });
  if (ui.musicBtn) ui.musicBtn.textContent = '♫ Музыка: выкл';
}

async function playTrack(name){
  pauseAll();
  music.current = name;
  const a = ensureTrack(name);
  try {
    await a.play();
    music[name].playing = true;
    if (ui.musicBtn) ui.musicBtn.textContent = '♫ Музыка: вкл';
  } catch(_e) {
    // автоплей может быть заблокирован до первого взаимодействия — разблокируем при любом клике/клавише
  }
}

function toggleMusic(){
  const cur = music.current;
  const t = music[cur];
  if (t.playing) { pauseAll(); }
  else { playTrack(cur); }
}
if (ui.musicBtn) ui.musicBtn.onclick = toggleMusic;

// Разблокировка автоплея по первому действию
window.addEventListener('pointerdown', () => {
  const cur = music.current;
  const t = music[cur];
  if (!t.playing) playTrack(cur);
}, { once:true });
window.addEventListener('keydown', () => {
  const cur = music.current;
  const t = music[cur];
  if (!t.playing) playTrack(cur);
}, { once:true });

  // Автостарт + разблокировка
  window.addEventListener('load', () => {
    playMusic();
    const unlock = () => { if (!music.playing) playMusic(); };
    window.addEventListener('pointerdown', unlock, { once:true });
    window.addEventListener('keydown',     unlock, { once:true });
  });

  // ===== SFX
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
      a.play().catch(()=>{});
    }catch(e){}
  }

  // ===== Game over
  function gameOver(){
    sfxPlay('death', 0.4);
    document.body.classList.remove('low-hp');
    setOverlayTitle('GAME OVER');
    ui.levelup.style.display='grid';
    ui.opts.innerHTML='';
    const over=document.createElement('div'); over.className='opt';
    over.innerHTML='<b>Игра окончена</b><div class="muted">Убитых: '+game.kills+' · Время: '+fmtTime(game.seconds)+'</div>';
    const retry=document.createElement('div'); retry.className='opt'; retry.innerHTML='<b>Начать заново</b>';
    retry.onclick=()=>location.reload();
    ui.opts.appendChild(over); ui.opts.appendChild(retry);
    game.running=false;
  }

  // ===== Story / Start
function typeText(el, text, cps, done){
  el.textContent = '';
  let i = 0, step = Math.max(1, cps|0);
  let timer = null;

  storyCtrl.active = true;
  storyCtrl.finished = false;

  function finish(){
    storyCtrl.active = false;
    storyCtrl.finished = true;
    timer = null;
    done && done();
  }

  function tick(){
    el.textContent = text.slice(0, i += step);
    const ch = text[i-1];
    if (i % 2 === 0 && ch && ch.trim() !== '') sfxPlay('typing', VOLUME.typing);
    if (i < text.length) timer = setTimeout(tick, 18);
    else finish();
  }

  timer = setTimeout(tick, 18);

  // возможность мгновенно «допечатать»
  storyCtrl.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    el.textContent = text;
    finish();
  };
}

  const STORY = 'Ты — “спящий аватар”, застрявший в глитч-мире между сервером и подсознанием.\n' +
                'Каждая сессия — это цикл сна, где нужно выжить среди багов, вирусов и обрывков воспоминаний.';

function showStory(){
  ui.storyOverlay.style.display = 'grid';
  if (ui.storyOk) ui.storyOk.style.display = 'none';
  if (ui.storyHint) ui.storyHint.style.display = 'none';

  typeText(ui.storyText, STORY, 1, function(){
    if (ui.storyOk) ui.storyOk.style.display = 'inline-block';
    showSpaceHint('— начать'); // покажем подсказку с «Space», когда печать закончилась
  });

  // пока печатаем — показываем «— пропустить»
  showSpaceHint('— пропустить');
}

  function startRun(){
    game.started = true;
    document.body.classList.remove('low-hp');
    ui.levelup.style.display='none';
    ui.storyOverlay.style.display='none';
    ui.startOverlay.style.display='none';
    game.seconds = 0; if (ui.time) ui.time.textContent='00:00'; game.t0 = now();
    game.running = true;
  }

  // ===== Стартовое меню =====
function ensureSettingsBtn(){
  if (!ui.startOverlay) return;
  // если кнопки «Настройки» нет в DOM — создадим
  if (!ui.settingsBtn){
    const btn = document.createElement('button');
    btn.id = 'settingsBtn';
    btn.className = 'btn';
    btn.textContent = 'Настройки';
    // попробуем вставить рядом со startBtn; если разметка другая — добавим в overlay
    if (ui.startBtn && ui.startBtn.parentElement) {
      ui.startBtn.parentElement.appendChild(btn);
    } else {
      ui.startOverlay.appendChild(btn);
    }
    ui.settingsBtn = btn;
  }
  // заглушка
  ui.settingsBtn.onclick = () => {
    alert('Настройки: скоро добавим :)');
  };
}

function showMenu(){
  if (!ui.startOverlay) return;
  ui.startOverlay.style.display = 'grid'; // показываем главное меню
  if (ui.storyOverlay) ui.storyOverlay.style.display = 'none';
  // запускаем меню-музыку
  playTrack('menu');
}

function isOverlayOpen(){
  // не даём ставить/снимать паузу, если открыта блокирующая UI
  const levelupOpen = ui.levelup && ui.levelup.style.display !== 'none';
  const storyOpen   = ui.storyOverlay && ui.storyOverlay.style.display !== 'none';
  const menuOpen    = ui.startOverlay && ui.startOverlay.style.display !== 'none';
  return levelupOpen || storyOpen || menuOpen;
}

function showPause(){
  const p = document.getElementById('pauseOverlay');
  if (p) p.style.display = 'grid';
}
function hidePause(){
  const p = document.getElementById('pauseOverlay');
  if (p) p.style.display = 'none';
}

function togglePause(){
  if (!game.started) return;
  if (isOverlayOpen()) return; // если меню/сторителлинг/левелап — игнор

  game.running = !game.running;
  if (!game.running) showPause();
  else hidePause();
}


function startFromMenu(){
  // скрываем меню и показываем заставку
  if (ui.startOverlay) ui.startOverlay.style.display = 'none';
  // переключаемся на игровую музыку
  playTrack('game');
  // запускаем историю
  showStory();
}
// ===== Стартовое меню / переход к игре
function showMenu(){
  buildStartMenu();
  if (ui.startOverlay) ui.startOverlay.style.display = 'grid';
  // канвас прячем, чтобы его не было на фоне
  cvs.style.display = 'none';
  // меню музыка
  playTrack('menu');
}

function startFromMenu(){
  // показываем канвас, включаем игровую музыку
  cvs.style.display = 'block';
  playTrack('game');
  // скрываем меню и запускаем историю
  if (ui.startOverlay) ui.startOverlay.style.display = 'none';
  showStory();
}

  // ===== Pause & Start
  if (ui.pauseBtn) {
    ui.pauseBtn.onclick = function(){
      if (!game.started) return;
      game.running = !game.running;
      ui.pauseBtn.textContent = game.running ? '⏸︎ Пауза' : '▶ Продолжить';
    };
  }
  if (ui.pauseBtn) ui.pauseBtn.style.display = 'none';

  if (ui.startBtn) ui.startBtn.addEventListener('click', startFromMenu);
    ensureSettingsBtn(); // создадим кнопку Настройки при старте
  if (ui.storyOk) ui.storyOk.addEventListener('click', startRun);
  if (ui.storyOverlay) ui.storyOverlay.addEventListener('click', (e) => {
    if (ui.storyOk && ui.storyOk.style.display !== 'none' && e.target === ui.storyOverlay) startRun();
  });

  // ===== Loop (единственный)
  function loop(){
    const t=now();
    const dt=(t-last)/1000; last=t;
    if(game.running){ update(dt,t); render(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener('load', () => {
  showMenu();
});

})();
