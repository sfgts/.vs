(function () {
  'use strict';

  // ===== Автомасштабирование под экран =====
  const GAME_W = 1264;  // canvas 1240 + padding
  const GAME_H = 1010;  // canvas 920 + HUD + подсказка + padding

  function scaleGame(){
    const wrap = document.getElementById('wrap');
    if(!wrap) return;
    const scale = Math.min(
      window.innerWidth  / GAME_W,
      window.innerHeight / GAME_H,
      1  // не апскейлить
    );
    const s = scale.toFixed(4);
    // сдвигаем чтоб было по центру
    const offsetX = (window.innerWidth  - GAME_W * scale) / 2;
    const offsetY = (window.innerHeight - GAME_H * scale) / 2;
    wrap.style.position  = 'fixed';
    wrap.style.top       = '0';
    wrap.style.left      = '0';
    wrap.style.width     = GAME_W + 'px';
    wrap.style.transform = `translate(${offsetX.toFixed(1)}px, ${Math.max(0,offsetY).toFixed(1)}px) scale(${s})`;
  }
  scaleGame();
  window.addEventListener('resize', scaleGame);
  // =========================================

  // ===== Supabase Leaderboard config
  // → Paste your values from Supabase Dashboard → Settings → API
  const SUPABASE_URL = 'https://wieewilxnegogbijfdwo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_keBGHcIbB2P-WO_zIyJVGA_EKUXX8GT';

  // ===== Boss portrait (змінюється через меню, зберігається в localStorage)
  const BOSS_PORTRAIT_DEFAULT = 'img/boss/portrait.gif';
  const BOSS_PORTRAIT_KEY     = 'vs_boss_portrait';
  function getBossPortraitSrc(){ return localStorage.getItem(BOSS_PORTRAIT_KEY) || BOSS_PORTRAIT_DEFAULT; }
  function setBossPortraitSrc(src){
    localStorage.setItem(BOSS_PORTRAIT_KEY, src);
    // оновлюємо всі живі елементи
    if(_bossGifEl)  _bossGifEl.src  = src;
    const introImg = document.getElementById('bossIntroPortraitImg');
    if(introImg) introImg.src = src;
  }

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
      position:fixed; inset:0; display:none; flex-direction:column;
      align-items:center; justify-content:center; gap:10px;
      background: #080414;
      z-index:50; padding:16px; overflow-y:auto;
    }
    #startOverlay::before{
      content:''; position:absolute; inset:-40px; z-index:0;
      background: url('${MENU_BG}') center/cover no-repeat;
      filter: blur(7px) brightness(0.6);
      pointer-events:none;
    }
    #startOverlay > * { position:relative; z-index:1; }
    .start-panel{
      display:flex; flex-direction:column; gap:12px;
      align-items:center; width:min(360px,90vw);
      padding:20px 16px;
      background:#0f0a1ecc; border:2px solid #5a1a6a; border-radius:14px;
      box-shadow:0 0 40px #8800cc44, inset 0 0 0 1px #2a0a3a;
    }
    .nick-row{
      width:100%; display:flex; flex-direction:column; gap:4px;
    }
    .nick-label{
      font-size:10px; color:#7050a0; letter-spacing:.6px; text-transform:uppercase;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .nick-input{
      width:100%; box-sizing:border-box;
      background:#0a0518; border:1px solid #4a1a6a; border-radius:8px;
      color:#e0c0ff; padding:8px 10px; font-size:13px; outline:none;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      transition:border-color .15s, box-shadow .15s;
    }
    .nick-input:focus{ border-color:#8a3aaa; box-shadow:0 0 8px #8800cc44; }
    .start-title{
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight:800; letter-spacing:1px; font-size:20px; color:#e0c0ff;
      text-shadow:0 0 20px #8800cc88, 0 2px 0 #000a; margin-bottom:6px;
    }
    .pixel-btn{
      width:100%; padding:12px 10px; border-radius:10px;
      border:2px solid #5a1a6a; background:linear-gradient(#1a0a2e,#100820);
      color:#e0c0ff; font-weight:700; letter-spacing:.5px;
      box-shadow:inset 0 -3px 0 #0008, 0 0 16px #8800cc33;
      cursor:pointer; transition:transform .05s ease, filter .1s, box-shadow .1s;
    }
    .pixel-btn:hover{ filter:brightness(1.15); box-shadow:inset 0 -3px 0 #0008, 0 0 24px #8800cc66; }
    .pixel-btn:active{ transform:translateY(1px); }
    .lb-panel{
      display:flex; flex-direction:column; gap:0;
      width:min(360px,90vw);
      padding:14px 12px;
      background:#0f0a1ecc; border:2px solid #5a1a6a; border-radius:14px;
      box-shadow:0 0 40px #8800cc44, inset 0 0 0 1px #2a0a3a;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .lb-panel-title{
      font-weight:800; letter-spacing:1px; font-size:12px; color:#e0c0ff;
      text-shadow:0 0 12px #8800cc66; margin-bottom:8px;
      display:flex; align-items:center; justify-content:space-between;
    }
    .lb-panel-title a{
      font-size:10px; color:#7050a0; text-decoration:none; letter-spacing:.5px;
    }
    .lb-panel-title a:hover{ color:#c090ff; }
    .lb-row{
      display:flex; align-items:center; gap:6px;
      padding:5px 0; border-top:1px solid #2a1040; font-size:11px;
    }
    .lb-row:first-child{ border-top:none; }
    .lb-rank{ width:20px; color:#6040a0; font-size:10px; text-align:center; flex-shrink:0; }
    .lb-name{ flex:1; color:#e0c0ff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .lb-score{ color:#c090ff; font-weight:700; flex-shrink:0; }
    .lb-empty{ color:#6040a0; font-size:11px; padding:16px 0; text-align:center; }
  `;
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
})();

// ===== Pause overlay =====
const PAUSE_ICON = 'img/ui/pause.png'; // PNG значок паузы

(function injectPauseStyles(){
  const css = `
    #pauseOverlay{
      position:fixed; inset:0; display:none; place-items:center;
      background:rgba(5,2,12,.60);
      backdrop-filter: blur(5px);
      z-index:60;
    }
    .pause-box{
      display:flex; flex-direction:column; align-items:center; gap:14px;
      padding:28px 32px; border-radius:16px;
      background:#0f0a1e; border:2px solid #5a1a6a;
      box-shadow:0 0 40px #8800cc44, inset 0 0 0 1px #2a0a3a;
    }
    .pause-icon{
      width:72px; height:72px; image-rendering: pixelated;
      background:url('${PAUSE_ICON}') center/contain no-repeat;
      opacity:.9; filter: drop-shadow(0 0 10px #8800cc88);
    }
    .pause-title{
      font-weight:800; letter-spacing:.6px; color:#e0c0ff;
      text-shadow:0 0 16px #8800cc88, 0 2px 0 #000a;
    }
    .pause-hint{
      position:fixed; right:450px; bottom:66px; z-index:61; color:#c090ffcc;
      font-weight:600; letter-spacing:.3px; display:flex; align-items:center; gap:8px;
      pointer-events:none; user-select:none;
    }
    .keycap{
      display:inline-block;padding:4px 10px;
      border:1px solid #5a1a6a; border-radius:8px;
      background:#0f0a1e; box-shadow:inset 0 -2px 0 #0008, 0 0 8px #8800cc33;
      font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.5px;
      color:#e0c0ff;
    }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

function buildPauseOverlay(){
  if (document.getElementById('pauseOverlay')) return;
  const wrap = document.createElement('div'); wrap.id = 'pauseOverlay';
  wrap.innerHTML = `
    <div class="pause-box">
      <div class="pause-icon"></div>
      <div class="pause-title">Paused</div>
      <div style="opacity:.75">Press <span class="keycap">Esc</span> to continue</div>
    </div>
  `;
  document.body.appendChild(wrap);

  // подсказка «Esc — пауза» — скрыта до старта игры
  const hint = document.createElement('div');
  hint.className = 'pause-hint';
  hint.id = 'pauseHint';
  hint.innerHTML = `<span class="keycap">Esc</span> — Pause`;
  hint.style.display = 'none';
  document.body.appendChild(hint);
}
buildPauseOverlay();


// ===== Стили: .opt-info (информационный блок, не кнопка)
(function injectOptInfoStyle(){
  const css = `.opt-info{
    padding:10px 14px; border-radius:10px;
    background:#100820; border:1px solid #3d1a55;
    color:#c090ff; font-size:.92em; cursor:default; user-select:none;
  }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

// ===== Toast-уведомление (замена alert)
function showToast(msg, ms) {
  ms = ms || 2200;
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'bottom:32px', 'left:50%', 'transform:translateX(-50%)',
    'padding:10px 22px', 'background:#0f0a1e', 'border:2px solid #5a1a6a',
    'border-radius:10px', 'color:#e0c0ff', 'font-size:.9em',
    'z-index:200', 'pointer-events:none', 'transition:opacity .4s',
    'box-shadow:0 0 24px #8800cc44'
  ].join(';');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 420); }, ms);
}

async function loadMenuLeaderboard(){
  const body = document.getElementById('menuLbBody');
  if (!body) return;
  if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL'){
    body.innerHTML = '<div class="lb-empty">Not configured</div>'; return;
  }
  try {
    const res = await fetch(
      SUPABASE_URL+'/rest/v1/scores?order=score.desc&limit=10&select=name,score',
      { headers:{ apikey: SUPABASE_KEY, Authorization:'Bearer '+SUPABASE_KEY } }
    );
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length){
      body.innerHTML = '<div class="lb-empty">No scores yet — be first! 🎮</div>'; return;
    }
    const medals = ['🥇','🥈','🥉'];
    body.innerHTML = rows.map((r,i) =>
      `<div class="lb-row">`+
      `<span class="lb-rank">${i<3?medals[i]:i+1}</span>`+
      `<span class="lb-name">${escHtml(r.name)}</span>`+
      `<span class="lb-score">${r.score}</span>`+
      `</div>`
    ).join('');
  } catch(e) {
    body.innerHTML = '<div class="lb-empty">⚠ Failed to load</div>';
  }
}

function buildStartMenu(){
  if (!ui.startOverlay) return;
  ui.startOverlay.innerHTML = '';

  // ── верхняя панель: заголовок + ник + кнопки
  const panel = document.createElement('div'); panel.className='start-panel';

  const title = document.createElement('div'); title.className='start-title'; title.textContent='VS';

  // поле ника
  const nickRow = document.createElement('div'); nickRow.className='nick-row';
  const nickLabel = document.createElement('div'); nickLabel.className='nick-label'; nickLabel.textContent='Your name';
  const nickIn = document.createElement('input');
  nickIn.type='text'; nickIn.className='nick-input';
  nickIn.placeholder='Anonymous'; nickIn.maxLength=20;
  nickIn.value = localStorage.getItem('vs_player_name') || '';
  nickIn.addEventListener('input', () => {
    localStorage.setItem('vs_player_name', nickIn.value.trim());
  });
  nickRow.appendChild(nickLabel);
  nickRow.appendChild(nickIn);

  const play = document.createElement('button'); play.className='pixel-btn'; play.textContent='Start';
  const sets = document.createElement('button'); sets.className='pixel-btn'; sets.textContent='Settings';
  play.onclick = startFromMenu;
  sets.onclick = () => showToast('Settings — coming soon!');

  panel.appendChild(title);
  panel.appendChild(nickRow);
  panel.appendChild(play);
  panel.appendChild(sets);

  // ── нижняя панель: лидерборд
  const lb = document.createElement('div'); lb.className='lb-panel';
  lb.innerHTML =
    `<div class="lb-panel-title">🏆 TOP SCORES <a href="leaderboard.html">Full →</a></div>`+
    `<div id="menuLbBody"><div class="lb-empty">Loading…</div></div>`;

  ui.startOverlay.appendChild(panel);
  ui.startOverlay.appendChild(lb);

  loadMenuLeaderboard();
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
  ui.storyHint.innerHTML = `<span class="keycap keycap--space">Space</span> ${text || '— skip'}`;
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
  // boss intro диалог
  if (game.bossIntro) {
    e.preventDefault();
    if (!bossIntroCtrl.finished) bossIntroCtrl.cancel && bossIntroCtrl.cancel();
    else closeBossIntro();
    return;
  }
  // boss death диалог
  if (game.bossDeathScene) {
    e.preventDefault();
    if (!bossDeathCtrl.finished) bossDeathCtrl.cancel && bossDeathCtrl.cancel();
    else closeBossDeathScene();
    return;
  }
  // если окно истории видно — перехватываем
  if (ui.storyOverlay && ui.storyOverlay.style.display !== 'none') {
    e.preventDefault();
    if (!storyCtrl.finished) {
      // ещё печатает — дописать мгновенно
      storyCtrl.cancel && storyCtrl.cancel();
      // и обновить подсказку
      showSpaceHint('— start');
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
    difficulty: 0.2,
    explosions: [],
    combatLog: [],
    boss: null,
    nextBossAt: 60,  // секунд; первый босс на 1-й минуте
    bossProjs: [],
    bossWarning: false,
    bossWarnTimer: 0,
    bossIntro: false,
    bossDeathScene: false
  };

  // ─── Combat Log HTML Panel ────────────────────────────────────────────────
  let _clPanel = null;
  let _clEntries = null;
  let _clLastUpdate = 0;

  function initCombatLogPanel(){
    const stage = document.querySelector('.stage');
    if (!stage || document.getElementById('combat-log-panel')) return;
    const row = document.createElement('div');
    row.id = 'game-row';
    row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';
    stage.parentNode.insertBefore(row, stage);
    _clPanel = document.createElement('div');
    _clPanel.id = 'combat-log-panel';
    _clPanel.innerHTML = '<div class="cl-title">COMBAT LOG</div><div id="cl-entries"></div>';
    row.appendChild(_clPanel);
    row.appendChild(stage);
    _clEntries = document.getElementById('cl-entries');
    const st = document.createElement('style'); st.textContent = `
      #combat-log-panel{width:190px;max-height:920px;background:#080c16;border:1px solid #1e2a42;
        border-radius:8px;padding:8px 10px;font:11px/1.55 monospace;
        flex-shrink:0;display:flex;flex-direction:column;box-sizing:border-box;}
      .cl-title{color:#3a5070;font-weight:bold;font-size:10px;letter-spacing:1px;
        margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #1a2336;flex-shrink:0;}
      #cl-entries{display:flex;flex-direction:column;gap:2px;overflow-y:auto;flex:1;}
      #cl-entries::-webkit-scrollbar{display:none;}
      .cl-entry{padding:2px 0;font-size:11px;white-space:nowrap;}
      .cl-dealt{color:#44dd88;} .cl-crit{color:#ffd040;} .cl-taken{color:#ff4455;}
    `; document.head.appendChild(st);
  }

  function refreshCombatLog(){
    if (!_clEntries) return;
    const nowT = now(), maxAge = 5000, log = game.combatLog;
    // collect oldest→newest (all 20 slots), newest at bottom
    let html = '';
    const start = Math.max(0, log.length - 20);
    for (let i = start; i < log.length; i++){
      const en = log[i]; const age = nowT - en.t;
      const op = Math.max(0.12, 1-(age/maxAge)*0.82).toFixed(2);
      let cls, txt;
      if (en.type==='taken'){ cls='cl-taken'; txt='◀ -'+en.amount+' HP'; }
      else if (en.crit)     { cls='cl-crit';  txt='▶ ★ '+en.amount+' CRIT!'; }
      else                  { cls='cl-dealt'; txt='▶ '+en.amount+' dmg'; }
      html += '<div class="cl-entry '+cls+'" style="opacity:'+op+'">'+txt+'</div>';
    }
    _clEntries.innerHTML = html;
    // keep newest entry visible at bottom
    _clEntries.scrollTop = _clEntries.scrollHeight;
  }

  window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    e.preventDefault();
    // Если открыта история — ESC работает как Space: пропустить/начать
    if (ui.storyOverlay && ui.storyOverlay.style.display !== 'none') {
      if (!storyCtrl.finished) {
        storyCtrl.cancel && storyCtrl.cancel();
        showSpaceHint('— start');
      } else {
        startRun();
      }
      return;
    }
    togglePause();
  }
}, { passive:false });

  // === Hero spritesheet
  const HERO_SHEET_SRC = 'img/hero/run.png';
  const HERO_FRAMES    = 6;
  const HERO_FPS       = 10;
  const HERO_DT        = 1000 / HERO_FPS;
  const HERO_SCALE     = 2;
  const HERO_ANCHOR = { x: 0, y: 0 }; // не используется для спрайта (центровка через body-offset)

  const SHEET = { margin: 0, spacing: 0, frameW: null, frameH: null };

  const heroSheet = new Image();
  heroSheet.src = HERO_SHEET_SRC;

  // игрок (радиус пересчитаем после onload)
  const player = {
    x: W/2, y: H/2,
    r: 12, // временно; после onload станет точным
    speed: 210,
    hp: 150, hpMax: 150,
    xp: 0, lvl: 1, xpNext: 10, xpBonus: 0,
    cd: 0.9, dmg: 10, lastAtk: 0,
    projCount: 1,
    projR: 4,          // projectile radius
    pierceCount: 0,    // how many enemies each shot passes through
    explosiveLevel: 0, // 0=off; each stack +AoE radius
    critChance: 0,     // 0-1 probability of 3x crit
    homingStrength: 0, // 0=off; each stack = stronger tracking
    vampirism: 0,      // HP gained per kill
    regen: 0,          // HP/sec passive regen
    invulTime: 1200,   // ms of invincibility after hit
    secondWindCount: 0,// how many Second Wind revives remain
    magnetR: 140,      // gem attraction radius
    orbitalCount: 0,   // orbiting projectile count
    orbitalAngle: 0,   // current orbital rotation angle
    chainBounces: 0,   // how many times each shot bounces
    xpMult: 1,         // XP gain multiplier
    xpBoostEnd: 0,     // performance.now() timestamp when boost expires
    invul: 0,
    scale: HERO_SCALE,
    sprite: { tAcc: 0, frame: 0, moving: false, facing: 1 }
  };

  heroSheet.onload = () => {
    const totalW = heroSheet.naturalWidth - SHEET.margin*2 - SHEET.spacing*(HERO_FRAMES-1);
    SHEET.frameW = Math.floor(totalW / HERO_FRAMES);
    SHEET.frameH = heroSheet.naturalHeight;
    player.r = 18; // фиксированный хитбокс под реальный размер тела персонажа
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

    const baseSpeed = rand(18,32);
    const speed = baseSpeed + game.difficulty * 3;
    const hp    = 8 + game.difficulty * 2.5;
    const touchDmg = 6 + Math.floor(game.difficulty*0.7);

    game.enemies.push({ x, y, r:10, speed, hp, hpMax:hp, touchDmg, type:(Math.random()*3)|0 });
  }


  // ===== Boss warning overlay =============================================
  let _bossWarnEl = null;

  function ensureBossWarnEl(){
    if(_bossWarnEl) return;
    _bossWarnEl = document.createElement('div');
    _bossWarnEl.id = 'boss-warn';
    _bossWarnEl.style.cssText = [
      'position:absolute','inset:0','display:none','pointer-events:none',
      'z-index:4','align-items:center','justify-content:center',
      'flex-direction:column','gap:12px',
      'background:rgba(60,0,0,0.55)',
      'font-family:ui-monospace,SFMono-Regular,Menlo,monospace',
    ].join(';');
    _bossWarnEl.innerHTML =
      '<div id="bw-text" style="font-size:64px;font-weight:900;color:#ff2244;'
      +'letter-spacing:6px;text-shadow:0 0 30px #ff0033,0 0 60px #ff003388;">! BOSS !!!</div>'
      +'<div style="font-size:16px;color:#ff8899;letter-spacing:3px;opacity:.85">PREPARE YOURSELF</div>';
    const stage = cvs.parentElement;
    if(stage) stage.appendChild(_bossWarnEl);
  }

  function startBossWarning(){
    ensureBossWarnEl();
    game.bossWarning = true;
    game.bossWarnTimer = 2.6;
    _bossWarnEl.style.display = 'flex';
    playTrack('boss'); // музыка меняется сразу при предупреждении
    // CSS мигание через анимацию
    const txt = document.getElementById('bw-text');
    if(txt) txt.style.animation = 'bossFlash 0.18s steps(1) infinite';
    // инжектим keyframe если ещё нет
    if(!document.getElementById('boss-flash-style')){
      const st = document.createElement('style');
      st.id = 'boss-flash-style';
      st.textContent = '@keyframes bossFlash{'
        +'0%{opacity:1;text-shadow:0 0 40px #ff0033,0 0 80px #ff0033,0 0 120px #ff003399;}'
        +'49%{opacity:1;}'
        +'50%{opacity:0;text-shadow:none;}'
        +'99%{opacity:0;}'
        +'100%{opacity:1;}}';
      document.head.appendChild(st);
    }
  }

  function hideBossWarning(){
    if(_bossWarnEl) _bossWarnEl.style.display = 'none';
  }

  // ===== Boss Intro Dialogue ================================================
  let _bossIntroEl = null;
  const bossIntroCtrl = { active:false, finished:false, cancel:null };

  const BOSS_LINES = [
    'Hello my Zuckerbaby!\n\nYou thought you could hide in this digital Traum forever?',
    'I am the Fehler at the end of the loop.\nThe crash at the edge of the void.',
    'Mach dich bereit...'
  ].join('\n\n');

  function ensureBossIntroEl(){
    if(_bossIntroEl) return;
    _bossIntroEl = document.createElement('div');
    _bossIntroEl.id = 'boss-intro-overlay';
    _bossIntroEl.style.cssText = [
      'position:fixed','inset:0','display:none','place-items:center',
      'z-index:45','backdrop-filter:blur(5px)',
      'background:rgba(6,3,14,0.78)',
      'font-family:monospace','cursor:pointer'
    ].join(';');
    _bossIntroEl.innerHTML =
      '<div id="bossIntroCard" style="background:#0f0a1e;border:2px solid #5a1a6a;border-radius:10px;'
      +'padding:20px;width:min(480px,90vw);box-shadow:0 0 40px #8800cc55;opacity:0;transition:opacity .5s">'
      +'<div style="display:flex;gap:14px;align-items:flex-start">'
      +'<div style="width:80px;height:80px;flex:0 0 auto;border:2px solid #5a1a6a;border-radius:6px;'
      +'background:#0b0518;display:grid;place-items:center;overflow:hidden;image-rendering:pixelated">'
      +'<img id="bossIntroPortraitImg" src="'+getBossPortraitSrc()+'" style="max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated" alt="boss">'
      +'</div>'
      +'<div id="bossIntroText" style="color:#e0c0ff;line-height:1.6;white-space:pre-wrap;min-height:4em;font-size:.95em"></div>'
      +'</div>'
      +'<div id="bossIntroHint" style="display:none;margin-top:14px;color:#9060c0;font-size:.85em">'
      +'<span style="display:inline-block;padding:3px 10px;border:1px solid #5a3a7a;border-radius:4px;'
      +'background:#1a0a2e;margin-right:6px">Space</span> — continue</div>'
      +'</div>';
    document.body.appendChild(_bossIntroEl);
    // клик по оверлею = Space
    _bossIntroEl.addEventListener('click', ()=>{
      if(!bossIntroCtrl.finished) bossIntroCtrl.cancel && bossIntroCtrl.cancel();
      else closeBossIntro();
    });
  }

  function startBossIntro(){
    ensureBossIntroEl();
    game.bossIntro = true;
    game.running   = false;
    _bossIntroEl.style.display = 'grid';

    // музыка тише до 20%
    const tr = music[music.current];
    if(tr && tr.audio) tr.audio.volume = Math.max(0, VOLUME.music * 0.2);

    // показываем карточку с задержкой 0.7 сек
    setTimeout(()=>{
      const card = document.getElementById('bossIntroCard');
      if(card) card.style.opacity = '1';
      const textEl = document.getElementById('bossIntroText');
      if(!textEl) return;

      bossIntroCtrl.active   = true;
      bossIntroCtrl.finished = false;
      textEl.textContent = '';
      let i = 0;
      const text = BOSS_LINES;
      let timer = null;

      function finishType(){
        bossIntroCtrl.active   = false;
        bossIntroCtrl.finished = true;
        timer = null;
        const hint = document.getElementById('bossIntroHint');
        if(hint) hint.style.display = 'block';
      }
      function tick(){
        textEl.textContent = text.slice(0, ++i);
        const ch = text[i-1];
        if(i % 2===0 && ch && ch.trim()) sfxPlay('typing', VOLUME.typing * 0.5);
        if(i < text.length) timer = setTimeout(tick, 22);
        else finishType();
      }
      timer = setTimeout(tick, 22);

      bossIntroCtrl.cancel = ()=>{
        if(timer){ clearTimeout(timer); timer = null; }
        textEl.textContent = text;
        finishType();
      };
    }, 700);
  }

  function closeBossIntro(){
    if(_bossIntroEl) _bossIntroEl.style.display = 'none';
    game.bossIntro = false;
    game.running   = true;
    // убиваем всех обычных врагов
    game.enemies = [];
    // восстанавливаем громкость (startBossWarning сразу переключит трек)
    const tr = music[music.current];
    if(tr && tr.audio) tr.audio.volume = VOLUME.music;
    // запускаем предупреждение и потом босса
    startBossWarning();
  }
  // ===== END Boss Intro =====================================================

  // ===== END boss warning ==================================================

  // ===== BOSS ================================================================
  function spawnBoss(){
    // спавн с одного из краёв экрана
    const side = (Math.random()*4)|0;
    let bx = W/2, by = -60;
    if(side===0){ bx = rand(100,W-100); by = -60; }
    else if(side===1){ bx = W+60; by = rand(100,H-100); }
    else if(side===2){ bx = rand(100,W-100); by = H+60; }
    else { bx = -60; by = rand(100,H-100); }

    document.body.classList.add('boss-fight');
    const hpBase = 700 + game.difficulty * 120;
    game.boss = {
      x: bx, y: by, r: 38,
      hp: hpBase, hpMax: hpBase,
      shootTimer: 0,
      voiceTimer: 3, // первый крик через 3 сек
      spreadAngle: 0,
      chaosTimer: 2.8,   // вторая атака с небольшой задержкой от первой
      crossTimer: 5.5,   // третья атака — крест
      crossBurst: 0,     // сколько суб-залпов осталось
      crossBurstTimer: 0,
      crossAngle: 0,
      touchDmg: 20 + game.difficulty * 3,
    };
    game.bossProjs = [];
    showXp('⚠ BOSS INCOMING!');
    logCombat('dealt', 0);
  }

  function updateBoss(dt){
    const b = game.boss;
    if(!b) return;

    // голосовые реплики: первая через 3 сек, потом каждые 7–9 сек
    b.voiceTimer -= dt;
    if(b.voiceTimer <= 0){
      playBossVoice();
      b.voiceTimer = 7 + Math.random() * 2; // следующий через 7–9 сек
    }

    // движение к игроку (медленно)
    const dx = player.x - b.x, dy = player.y - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 58;
    if(dist > 90){
      b.x += dx/dist * speed * dt;
      b.y += dy/dist * speed * dt;
    }

    // стрельба
    const phase2 = b.hp < b.hpMax * 0.5;
    const interval = phase2 ? 1.0 : 1.8;
    b.shootTimer += dt;
    if(b.shootTimer >= interval){
      b.shootTimer = 0;
      b.spreadAngle += phase2 ? 0.22 : 0.14;
      const count = phase2 ? 12 : 8;
      const spd = 175;
      for(let i = 0; i < count; i++){
        const ang = b.spreadAngle + (Math.PI*2/count)*i;
        game.bossProjs.push({ x:b.x, y:b.y, r:7,
          vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
          life:4.5, dmg:10 + game.difficulty*2 });
      }
      // фаза 2: дополнительный прицельный залп
      if(phase2){
        const aimAng = Math.atan2(dy, dx);
        for(let i = -1; i <= 1; i++){
          const a = aimAng + i*0.18;
          game.bossProjs.push({ x:b.x, y:b.y, r:7,
            vx:Math.cos(a)*230, vy:Math.sin(a)*230,
            life:3.5, dmg:16 + game.difficulty*2 });
        }
      }
    }

    // ── Вторая атака: хаотичный залп ─────────────────────────────────────
    b.chaosTimer += dt;
    const chaosInterval = phase2 ? 3.2 : 5.0;
    if(b.chaosTimer >= chaosInterval){
      b.chaosTimer = 0;
      const count = phase2 ? 26 : 18;
      const spd = 155;
      for(let i = 0; i < count; i++){
        const ang = (Math.PI*2/count)*i + rand(-0.3, 0.3);
        game.bossProjs.push({
          x: b.x, y: b.y, r: 6,
          vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
          life: 5.5, dmg: 8 + game.difficulty*1.5,
          chaos: true,
          turn: rand(-3.5, 3.5),       // начальная угловая скорость
          turnTimer: 0,                 // через каждые 0.5с меняем поворот
        });
      }
    }

    // ── Третья атака: крест-шторм ──────────────────────────────────────────
    b.crossTimer += dt;
    const crossInterval = phase2 ? 4.5 : 8.0;
    if(b.crossTimer >= crossInterval && b.crossBurst === 0){
      b.crossTimer = 0;
      b.crossBurst = phase2 ? 9 : 6;  // суб-залпов
      b.crossBurstTimer = 0;
      b.crossAngle = rand(0, Math.PI/4);
      showXp('☠ CROSS STORM!');
    }
    if(b.crossBurst > 0){
      b.crossBurstTimer += dt;
      if(b.crossBurstTimer >= 0.11){
        b.crossBurstTimer = 0;
        b.crossBurst--;
        b.crossAngle += 0.28;
        const arms = phase2 ? 6 : 4;
        const spd = 160;
        for(let i = 0; i < arms; i++){
          const ang = b.crossAngle + (Math.PI*2/arms)*i;
          game.bossProjs.push({
            x:b.x, y:b.y, r:10,
            vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
            life:5.5, dmg:20 + game.difficulty*3,
            cross:true,
          });
        }
        // фаза 2: ещё встречный залп под углом 45°
        if(phase2){
          for(let i = 0; i < arms; i++){
            const ang = b.crossAngle + Math.PI/arms + (Math.PI*2/arms)*i;
            game.bossProjs.push({
              x:b.x, y:b.y, r:8,
              vx:Math.cos(ang)*200, vy:Math.sin(ang)*200,
              life:4.0, dmg:14 + game.difficulty*2,
              cross:true,
            });
          }
        }
      }
    }

    // движение снарядов босса
    for(let i = game.bossProjs.length-1; i >= 0; i--){
      const p = game.bossProjs[i];
      // хаотичные: вращаем вектор скорости
      if(p.chaos){
        p.turnTimer += dt;
        if(p.turnTimer >= 0.5){
          p.turnTimer = 0;
          p.turn = rand(-3.8, 3.8);  // новое случайное направление поворота
        }
        const cos = Math.cos(p.turn * dt);
        const sin = Math.sin(p.turn * dt);
        const nvx = p.vx*cos - p.vy*sin;
        const nvy = p.vx*sin + p.vy*cos;
        p.vx = nvx; p.vy = nvy;
      }
      p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt;
      if(p.life <= 0){ game.bossProjs.splice(i,1); continue; }
      // попадание в игрока
      if(player.invul <= 0){
        const r = p.r + player.r;
        if(dist2(p.x,p.y,player.x,player.y) <= r*r){
          player.hp -= p.dmg; player.invul = player.invulTime * 0.6;
          logCombat('taken', p.dmg|0);
          game.bossProjs.splice(i,1);
          if(player.hp <= 0){
            if(player.secondWindCount>0){ player.hp=1; player.secondWindCount--; showXp('Second Wind!'); }
            else { gameOver(); return; }
          }
        }
      }
    }

    // контактный урон от самого босса
    if(player.invul <= 0 && dist2(player.x,player.y,b.x,b.y) <= (player.r+b.r)*(player.r+b.r)){
      player.hp -= b.touchDmg; player.invul = player.invulTime;
      logCombat('taken', b.touchDmg|0);
      if(player.hp <= 0){
        if(player.secondWindCount>0){ player.hp=1; player.secondWindCount--; }
        else { gameOver(); return; }
      }
    }
  }

  function checkBossHit(){
    if(!game.boss) return;
    const b = game.boss;
    for(let i = game.projs.length-1; i >= 0; i--){
      const p = game.projs[i];
      if(p.life <= 0) continue;
      const r = p.r + b.r;
      if(dist2(p.x,p.y,b.x,b.y) > r*r) continue;
      // попадание
      let dmg = p.dmg;
      if(player.critChance>0 && Math.random()<player.critChance){ dmg*=3; showXp('CRIT!'); }
      b.hp -= dmg;
      logCombat('dealt', dmg|0, false);
      if(p.maxPierce>0){
        p.pierced.add(b);
        if(p.pierced.size >= p.maxPierce) p.life=0;
      } else { p.life=0; }
      if(b.hp <= 0){
        // дропаем кристаллы сразу
        for(let j=0;j<18;j++) dropGem(b.x+rand(-50,50), b.y+rand(-50,50));
        game.kills += 8; if(ui.kills) ui.kills.textContent=game.kills;
        game.boss=null; game.bossProjs=[];
        document.body.classList.remove('boss-fight');
        game.nextBossAt = game.seconds + 300;
        showXp('BOSS DEFEATED! 💀 +8 kills');
        playBossDeathSfx();
        playTrack('game');
        showBossDeathScene(); // диалог смерти — пауза до Space
        return;
      }
    }
  }

  // Гифка босса — position:absolute внутри .stage, transform двигает её
  let _bossGifEl = null;

  function ensureBossGifEl(){
    if(_bossGifEl) return;
    // ищем .stage — туда вставляем img
    const stage = cvs.parentElement; // canvas → .stage
    if(!stage) return;
    _bossGifEl = document.createElement('img');
    _bossGifEl.src = 'img/boss/boss1.gif';
    _bossGifEl.style.cssText =
      'position:absolute;display:none;pointer-events:none;' +
      'image-rendering:pixelated;z-index:3;';
    stage.appendChild(_bossGifEl);
  }

  function syncBossGif(b){
    ensureBossGifEl();
    if(!_bossGifEl) return;
    if(!b){ _bossGifEl.style.display='none'; return; }

    const size = b.r * 2.8;
    _bossGifEl.style.display = 'block';
    _bossGifEl.style.width   = (size|0) + 'px';
    _bossGifEl.style.height  = (size|0) + 'px';
    _bossGifEl.style.left    = ((b.x - size/2)|0) + 'px';
    _bossGifEl.style.top     = ((b.y - size/2)|0) + 'px';
    _bossGifEl.style.opacity = (b.hp < b.hpMax*0.5)
      ? (0.82 + 0.18*Math.sin(now()/160)).toFixed(3) : '1';
  }

  function drawBoss(b){
    // HP-дуга убрана — только полоска сверху (drawBossHpBar)
  }

  function drawBossHpBar(b){
    const bw = W * 0.55, bh = 14;
    const bx = (W - bw) / 2, by = 18;
    const pct = clamp(b.hp/b.hpMax,0,1);
    const phase2 = b.hp < b.hpMax * 0.5;
    ctx.save();
    // фон
    ctx.fillStyle='#0a0d1688';
    roundRect(ctx, bx-4, by-4, bw+8, bh+16, 6); ctx.fill();
    // лейбл
    ctx.fillStyle='#cc44ff'; ctx.font='bold 10px monospace';
    ctx.textAlign='center';
    ctx.fillText(phase2 ? '⚠ BOSS — ENRAGED' : '☠ BOSS', W/2, by+9);
    // бар
    const barY = by + 13;
    ctx.fillStyle='#1a0a2a'; ctx.fillRect(bx, barY, bw, bh-4);
    ctx.fillStyle = phase2
      ? `hsl(${340+20*Math.sin(now()/200)},90%,55%)`
      : '#9922cc';
    ctx.fillRect(bx, barY, bw*pct, bh-4);
    // рамка
    ctx.strokeStyle='#5a1a7a66'; ctx.lineWidth=1;
    ctx.strokeRect(bx, barY, bw, bh-4);
    ctx.restore();
  }
  // ===== END BOSS ===========================================================

  function nearestEnemy(x,y){
    let best=null,bd2=1e9;
    for(const e of game.enemies){ const d2=dist2(x,y,e.x,e.y); if(d2<bd2){bd2=d2; best=e;} }
    if(game.boss){ const d2=dist2(x,y,game.boss.x,game.boss.y); if(d2<bd2){ best=game.boss; } }
    return best;
  }

  function fireAuto(){
    const t = now()/1000; if (t - player.lastAtk < player.cd) return;
    const target = nearestEnemy(player.x, player.y); if (!target) return;
    player.lastAtk = t;
    const dx=target.x-player.x, dy=target.y-player.y; const base=Math.atan2(dy,dx);
    const n = Math.max(1, Math.floor(player.projCount)); const spread=0.17;
    for(let i=0;i<n;i++){
      const off=(i-(n-1)/2)*spread, ang=base+off;
      const vx=Math.cos(ang)*260, vy=Math.sin(ang)*260;
      const needSet = player.pierceCount>0 || player.chainBounces>0;
      game.projs.push({
        x:player.x, y:player.y, r:player.projR,
        vx, vy, life:4.0, dmg:player.dmg,
        maxPierce: player.pierceCount,
        explosive: player.explosiveLevel,
        homingStrength: player.homingStrength,
        chainLeft: player.chainBounces,
        pierced: needSet ? new Set() : null
      });
    }
    sfxSynth(player);
  }

  function dropGem(x,y){ game.gems.push({x,y,r:5,xp:2,spawnedAt:game.seconds}); }

  function logCombat(type, amount, crit){
    game.combatLog.push({type, amount, crit:!!crit, t:now()});
    if (game.combatLog.length > 20) game.combatLog.shift();
  }
  function spawnChest(){ const m=40; const x=rand(m,W-m), y=rand(m,H-m); game.chests.push({x,y}); }

  function openChest(){
    const rewards=[
      {name:'Damage +1', apply:()=>{player.dmg+=1;}},
      {name:'Fire Rate +10%', apply:()=>{player.cd=player.cd*0.9;}},
      {name:'Speed +10%', apply:()=>{player.speed=player.speed*1.1;}},
      {name:'XP +1 per crystal', apply:()=>{player.xpBonus+=1;}},
      {name:'+1 Projectile', apply:()=>{player.projCount+=1;}},
      {name:'Health +15', apply:()=>{player.hpMax+=15; player.hp=player.hpMax;}}
    ];
    const r = rewards[(Math.random()*rewards.length)|0];

    sfxPlay('chest', 0.35);

    setOverlayTitle('Chest!');
    ui.opts.innerHTML='';
    const info=document.createElement('div'); info.className='opt'; info.innerHTML='<b>Chest!</b><div class="muted">Reward: '+r.name+'</div>';
    const ok=document.createElement('div'); ok.className='opt'; ok.innerHTML='<b>Take</b>';
    ok.onclick=function(){ r.apply(); ui.levelup.style.display='none'; game.running=true; };
    ui.opts.appendChild(info); ui.opts.appendChild(ok);
    ui.levelup.style.display='grid'; game.running=false;
  }

  function levelUp(){
    player.lvl++; player.xp=0; player.xpNext=Math.floor(player.xpNext*1.35+2);

    const pool=[
      // — Базовые —
      {name:'Damage +1',         apply:()=>{player.dmg+=1;},                                  desc:'Increases auto-attack damage'},
      {name:'Fire Rate +10%',    apply:()=>{player.cd*=0.9;},                                  desc:'Reduces shot cooldown'},
      {name:'Speed +10%',        apply:()=>{player.speed*=1.1;},                               desc:'Move faster'},
      {name:'XP +1 per crystal', apply:()=>{player.xpBonus+=1;},                              desc:'More EXP per crystal'},
      {name:'+1 Projectile',     apply:()=>{player.projCount+=1;},                             desc:'Fire one more projectile per shot'},
      {name:'Health +15',        apply:()=>{player.hpMax+=15; player.hp=Math.min(player.hp+15,player.hpMax);}, desc:'Gain max HP and heal'},
      // — Атака —
      {name:'Piercing Shot',     apply:()=>{player.pierceCount++;},                            desc:'Pass through +1 enemy per stack'},
      {name:'Explosive Round',   apply:()=>{player.explosiveLevel++;},                         desc:'AoE on impact; each stack +20px radius'},
      {name:'Crit Chance +20%',  apply:()=>{player.critChance=Math.min(1,player.critChance+0.2);}, desc:'20% chance to deal 3× damage'},
      {name:'Larger Projectile', apply:()=>{player.projR+=2;},                                desc:'Bigger projectiles, easier to hit'},
      {name:'Homing',            apply:()=>{player.homingStrength++;},                         desc:'Projectiles steer to enemies; stacks = sharper turn'},
      // — Выживание —
      {name:'Vampirism',         apply:()=>{player.vampirism+=1;},                             desc:'+1 HP restored per kill'},
      {name:'Regeneration',      apply:()=>{player.regen+=0.5;},                              desc:'Slowly recover HP over time'},
      {name:'Iron Skin',         apply:()=>{player.invulTime+=350;},                           desc:'Longer invincibility frames after being hit'},
      {name:'Second Wind',       apply:()=>{player.secondWindCount++;},                        desc:'Survive a lethal hit at 1 HP; stackable'},
      // — Особые —
      {name:'Magnet',            apply:()=>{player.magnetR+=70;},                             desc:'Crystals attract from further away'},
      {name:'Orbital',           apply:()=>{player.orbitalCount+=1;},                          desc:'A rotating projectile orbits and damages enemies'},
      {name:'Chain Shot',        apply:()=>{player.chainBounces++;},                           desc:'Shots bounce +1 enemy per stack'},
      {name:'XP Boost ×2',       apply:()=>{player.xpMult=2; player.xpBoostEnd=now()+60000;}, desc:'Double XP gain for 60 seconds'},
    ];
    for(let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
    const choices = pool.slice(0,3);

    setOverlayTitle('Level Up!');
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

    // boss
    if(!game.boss && !game.bossWarning && !game.bossIntro && game.seconds >= game.nextBossAt) startBossIntro();
    if(game.bossWarning){ game.bossWarnTimer -= dt; if(game.bossWarnTimer <= 0){ game.bossWarning=false; hideBossWarning(); spawnBoss(); } }
    if(game.boss){ updateBoss(dt); checkBossHit(); }

    // spawn обычных врагов — только без босса и без предупреждения
    if(!game.boss && !game.bossWarning){
      const spawnInterval = Math.max(350, game.spawnEvery - game.difficulty*40);
      if (t - game.lastSpawn > spawnInterval) {
        game.lastSpawn = t;
        const pack = 1 + Math.floor(game.difficulty / 4);
        for (let i = 0; i < pack; i++) spawnEnemy();
      }
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
    for (const p of game.projs){
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
      if (p.homingStrength>0){
        const ht=nearestEnemy(p.x,p.y);
        if(ht){ const hd=Math.hypot(ht.x-p.x,ht.y-p.y)||1;
          const hf=p.homingStrength*3;
          p.vx+=(ht.x-p.x)/hd*hf*dt*260; p.vy+=(ht.y-p.y)/hd*hf*dt*260;
          const sp=Math.hypot(p.vx,p.vy)||1; p.vx=p.vx/sp*260; p.vy=p.vy/sp*260; }
      }
    }
    // regen
    if (player.regen>0) player.hp=Math.min(player.hpMax, player.hp+player.regen*dt);
    // orbital damage
    if (player.orbitalCount>0){
      player.orbitalAngle+=dt*2.5;
      const orR=38+player.orbitalCount*6;
      for(let oi=0;oi<player.orbitalCount;oi++){
        const ang=player.orbitalAngle+(Math.PI*2/player.orbitalCount)*oi;
        const ox=player.x+Math.cos(ang)*orR, oy=player.y+Math.sin(ang)*orR;
        for(const e of game.enemies){
          if(dist2(ox,oy,e.x,e.y)<=(6+e.r)*(6+e.r)) e.hp-=player.dmg*0.9*dt;
        }
      }
    }
    // xp boost expiry
    if(player.xpBoostEnd>0 && now()>player.xpBoostEnd){ player.xpMult=1; player.xpBoostEnd=0; }
    // explosion lifetime
    for(let ei=game.explosions.length-1;ei>=0;ei--){
      const ex=game.explosions[ei]; ex.life-=dt;
      if(ex.life<=0) game.explosions.splice(ei,1);
    }

    // collisions
    for (const p of game.projs){
      if (p.life<=0) continue;
      for (const e of game.enemies){
        if (p.pierced && p.pierced.has(e)) continue;
        const r=p.r+e.r;
        if (dist2(p.x,p.y,e.x,e.y)<=r*r){
          let dmg=p.dmg;
          let isCrit=false;
          if(player.critChance>0 && Math.random()<player.critChance){ dmg*=3; isCrit=true; showXp('CRIT!'); }
          e.hp-=dmg;
          logCombat('dealt', dmg|0, isCrit);
          if(p.explosive>0){
            const aoeR=40+(p.explosive-1)*20;
            for(const ae of game.enemies){ if(ae!==e && dist2(p.x,p.y,ae.x,ae.y)<=aoeR*aoeR) ae.hp-=dmg*0.5; }
            game.explosions.push({x:p.x,y:p.y,r:0,maxR:aoeR,life:0.35,maxLife:0.35});
          }
          if(p.chainLeft>0){
            let ct=null,cd2=240*240;
            for(const ce of game.enemies){
              if(ce===e) continue;
              if(p.pierced && p.pierced.has(ce)) continue;
              const d2=dist2(e.x,e.y,ce.x,ce.y); if(d2<cd2){cd2=d2;ct=ce;}
            }
            if(ct){
              const cl=Math.hypot(ct.x-e.x,ct.y-e.y)||1;
              const np=new Set(p.pierced||[]); np.add(e);
              game.projs.push({x:e.x,y:e.y,r:p.r,
                vx:(ct.x-e.x)/cl*280,vy:(ct.y-e.y)/cl*280,
                life:1.5,dmg:p.dmg*0.75,
                maxPierce:p.maxPierce, pierced:np,
                chainLeft:p.chainLeft-1,
                explosive:p.explosive,
                homingStrength:0
              });
            }
          }
          if(p.maxPierce>0){
            p.pierced.add(e);
            if(p.pierced.size>=p.maxPierce){ p.life=0; break; }
          } else { p.life=0; break; }
        }
      }
    }

    // deaths
    for (let i=game.enemies.length-1;i>=0;i--){
      const e=game.enemies[i];
      if (e.hp<=0){
        game.enemies.splice(i,1); game.kills++; if (ui.kills) ui.kills.textContent=game.kills; dropGem(e.x,e.y);
        if(player.vampirism>0) player.hp=Math.min(player.hpMax, player.hp+player.vampirism);
      }
    }

    // contact damage
    for (const e of game.enemies){
      const r=player.r+e.r;
      if (player.invul<=0 && dist2(player.x,player.y,e.x,e.y)<=r*r){
        player.hp-=e.touchDmg; player.invul=player.invulTime;
        logCombat('taken', e.touchDmg);
        if(player.hp<=0){
          if(player.secondWindCount>0){ player.hp=1; player.secondWindCount--; showXp('Second Wind! ('+player.secondWindCount+' left)'); }
          else { gameOver(); return; }
        }
      }
    }

    // gems
    for (const g of game.gems){
      const d2=dist2(player.x,player.y,g.x,g.y);
      if (d2<player.magnetR*player.magnetR){ const d=Math.sqrt(d2)||1; g.x+=(player.x-g.x)/d*120*dt; g.y+=(player.y-g.y)/d*120*dt; }
    }
    for (let i=game.gems.length-1;i>=0;i--){
      const g=game.gems[i];
      // удаление через 30 сек
      if(game.seconds - g.spawnedAt >= 30){ game.gems.splice(i,1); continue; }
      const r=player.r+g.r;
      if (dist2(player.x,player.y,g.x,g.y)<=r*r){
        const gained = Math.ceil((g.xp + player.xpBonus) * player.xpMult);
        player.xp += gained; showXp('+ '+gained+' XP');
        game.gems.splice(i,1);
        if (player.xp >= player.xpNext) { levelUp(); break; }
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
    for (const g of game.gems){
      const age = game.seconds - g.spawnedAt;
      if(age >= 25){
        // мигание: 4 раза в секунду, пропускаем каждый второй кадр
        if(Math.floor(now() / 125) % 2 === 0) continue;
      }
      drawCircle(g.x,g.y,g.r,'#cc44ff'); drawRing(g.x,g.y,g.r+2,'#8800cc');
    }

    // enemies
    for (const e of game.enemies){
      drawEnemy(e);
      // HP дуга сверху (12 часов), только если HP не полное
      const pct = clamp(e.hp / e.hpMax, 0, 1);
      if (pct < 1) drawArcRing(e.x, e.y, e.r + 4, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct, '#c9484d');
    }

    // boss
    syncBossGif(game.boss); // двигаем DOM-гифку (или прячем)
    if(game.boss){ drawBoss(game.boss); drawBossHpBar(game.boss); }
    // boss projectiles
    for(const p of game.bossProjs){
      ctx.save();
      ctx.globalAlpha=0.92;
      if(p.chaos){
        const pulse = 0.7 + 0.3*Math.sin(now()/120 + p.life*8);
        ctx.globalAlpha = pulse;
        drawCircle(p.x,p.y,p.r,'#ffaa00');
        drawRing(p.x,p.y,p.r+2,'#ff660066');
      } else if(p.cross){
        // крест — ярко-голубые, крупные, пульсируют
        const pulse = 0.75 + 0.25*Math.sin(now()/90 + p.life*6);
        ctx.globalAlpha = pulse;
        drawCircle(p.x,p.y,p.r,'#00eeff');
        drawRing(p.x,p.y,p.r+3,'#0088ff88');
      } else {
        drawCircle(p.x,p.y,p.r,'#ff3355');
        drawRing(p.x,p.y,p.r+2,'#ff224466');
      }
      ctx.restore();
    }

    // explosions
    for (const ex of game.explosions){
      const a=ex.life/ex.maxLife;
      const exR=ex.maxR*(1-a);
      ctx.save(); ctx.globalAlpha=a*0.55; drawCircle(ex.x,ex.y,exR,'#ff8030');
      ctx.globalAlpha=a*0.35; drawRing(ex.x,ex.y,exR,'#ffcc50'); ctx.restore();
    }
    // orbital projectiles
    if(player.orbitalCount>0){
      const orR=38+player.orbitalCount*6;
      for(let oi=0;oi<player.orbitalCount;oi++){
        const ang=player.orbitalAngle+(Math.PI*2/player.orbitalCount)*oi;
        const ox=player.x+Math.cos(ang)*orR, oy=player.y+Math.sin(ang)*orR;
        drawCircle(ox,oy,5,'#a8d8ff'); drawRing(ox,oy,7,'#6090ff99');
      }
    }
    // projectiles
    for (const p of game.projs){
      const col = p.explosive ? '#ffaa40' : p.pierce ? '#80ffcc' : p.homing ? '#ff80ff' : '#d6e8ff';
      drawCircle(p.x,p.y,p.r,col);
    }

    // player (спрайт из ленты)
    drawPlayerFromSheet(player.x, player.y);

    // индикатор инвулна — из того же центра, что и спрайт
    if (player.invul > 0) {
      const c = getHeroCenter();
      drawRing(c.x, c.y, player.r + 4, '#e2f04b55');
    }

    // HTML combat log refresh (throttled ~12fps)
    const _nt=now(); if(_nt-_clLastUpdate>80){ refreshCombatLog(); _clLastUpdate=_nt; }
  }

  function roundRect(c, x, y, w, h, r){
    c.beginPath();
    c.moveTo(x+r, y); c.lineTo(x+w-r, y);
    c.quadraticCurveTo(x+w, y, x+w, y+r);
    c.lineTo(x+w, y+h-r);
    c.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    c.lineTo(x+r, y+h);
    c.quadraticCurveTo(x, y+h, x, y+h-r);
    c.lineTo(x, y+r);
    c.quadraticCurveTo(x, y, x+r, y);
    c.closePath();
  }

  function drawCombatLog(){
    const log = game.combatLog;
    if (!log || log.length === 0) return;
    const nowT = now();
    const maxAge = 3500;
    const px = 14, lineH = 19, maxLines = 9;
    const visible = [];
    for (let i = log.length - 1; i >= 0 && visible.length < maxLines; i--) {
      if (nowT - log[i].t < maxAge) visible.push(log[i]);
    }
    if (visible.length === 0) return;
    const panelH = visible.length * lineH + 26;
    const panelY = 130;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,22,0.72)';
    roundRect(ctx, px - 4, panelY - 2, 180, panelH, 6);
    ctx.fill();
    ctx.strokeStyle = '#1e2a42'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#3a5070'; ctx.globalAlpha = 1;
    ctx.fillText('COMBAT LOG', px + 2, panelY + 12);
    ctx.font = '11px monospace';
    for (let i = 0; i < visible.length; i++) {
      const ent = visible[i];
      const age = nowT - ent.t;
      const alpha = Math.max(0.2, 1 - (age / maxAge) * 0.78);
      ctx.globalAlpha = alpha;
      const yy = panelY + 26 + i * lineH;
      if (ent.type === 'taken') {
        ctx.fillStyle = '#ff4455';
        ctx.fillText('◀ -' + ent.amount + ' HP', px + 2, yy);
      } else if (ent.crit) {
        ctx.fillStyle = '#ffd040';
        ctx.fillText('▶ ★ ' + ent.amount + ' CRIT!', px + 2, yy);
      } else {
        ctx.fillStyle = '#44dd88';
        ctx.fillText('▶ ' + ent.amount + ' dmg', px + 2, yy);
      }
    }
    ctx.globalAlpha = 1; ctx.restore();
  }

  // ===== Enemy pixel-art sprites (8×8 grid, value = color index 1-3, 0 = transparent)
  const ENEMY_SPRITES = [
    { // Type 0: Skull (красный демон)
      px: [
        [0,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1],
        [1,2,1,1,1,1,2,1],
        [1,2,1,1,1,1,2,1],
        [1,1,1,1,1,1,1,1],
        [1,1,3,1,1,3,1,1],
        [0,1,3,1,1,3,1,0],
        [0,0,1,1,1,1,0,0],
      ],
      c: ['#c94d52','#150306','#ffe0e0'] // тело, впадины глаз, зубы
    },
    { // Type 1: Drone (синий робот)
      px: [
        [0,0,0,1,1,0,0,0],
        [0,1,1,1,1,1,1,0],
        [1,1,2,2,2,2,1,1],
        [1,2,0,1,1,0,2,1],
        [1,2,0,1,1,0,2,1],
        [1,1,2,2,2,2,1,1],
        [0,1,1,0,0,1,1,0],
        [0,0,1,0,0,1,0,0],
      ],
      c: ['#22cc44','#aaff00','#0a3010'] // корпус, свечение, детали
    },
    { // Type 2: Virus (оранжевый вирус)
      px: [
        [0,0,1,0,0,1,0,0],
        [0,1,1,1,1,1,1,0],
        [1,1,1,2,2,1,1,1],
        [0,1,2,3,3,2,1,0],
        [0,1,2,3,3,2,1,0],
        [1,1,1,2,2,1,1,1],
        [0,1,1,1,1,1,1,0],
        [0,0,1,0,0,1,0,0],
      ],
      c: ['#e07830','#ff2800','#ffcc00'] // тело, ядро, свечение ядра
    }
  ];

  function drawEnemy(e) {
    const def = ENEMY_SPRITES[e.type % 3];
    const s   = Math.max(2, Math.round(e.r * 0.44)); // размер пикселя в canvas-единицах
    const off = 4 * s; // 8 пикселей / 2 = 4 → смещение центра
    const ex  = e.x|0, ey = e.y|0;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const v = def.px[row][col];
        if (!v) continue;
        ctx.fillStyle = def.c[v - 1];
        ctx.fillRect(ex - off + col * s, ey - off + row * s, s, s);
      }
    }
    ctx.restore();
  }

  // ===== Draw helpers
  function getHeroCenter() {
    return { x: player.x, y: player.y }; // кольцо = хитбокс
  }

  function drawPlayerFromSheet(px, py) {
    // Тело персонажа в кадре (из pixel-analysis): frame-px (15,32)
    // При scale=2 → body offset от края спрайта: (30, 64)
    // Рисуем спрайт так, чтобы body оказался точно в (px, py)
    const BODY_FX = 15, BODY_FY = 32; // frame-pixels (измерено)

    if (!heroSheet.complete || !heroSheet.naturalWidth || !SHEET.frameW) {
      drawCircle(px, py, player.r, '#e2f04b');
      return;
    }

    const fw = SHEET.frameW|0;
    const fh = SHEET.frameH|0;
    const sp = SHEET.spacing|0;
    const mg = SHEET.margin|0;
    const sc = player.scale;

    const f  = (player.sprite.frame|0) % HERO_FRAMES;
    const sx = (mg + f*(fw + sp))|0;
    const sy = 0;

    const dw = (fw * sc)|0;
    const dh = (fh * sc)|0;

    // dx/dy: верхний-левый угол спрайта, чтобы body (BODY_FX*sc, BODY_FY*sc) → (px,py)
    const dx = (px - BODY_FX * sc)|0;
    const dy = (py - BODY_FY * sc)|0;

    ctx.save();
    if (player.invul > 0) {
      const blink = ((performance.now()/80)|0) % 2 === 0;
      ctx.globalAlpha = blink ? 0.65 : 1;
    }
    if (player.sprite.facing === -1) {
      // Flip вокруг тела персонажа (px), а не вокруг центра кадра
      ctx.translate(px * 2, 0);
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

  // Игровые треки — добавляй файлы в music/game/, прописывай сюда
  const GAME_TRACKS = [
    'music/game/track1.mp3',
    'music/game/track2.mp3',
    'music/game/track3.mp3',
    'music/game/track4.mp3',
    'music/game/track5.mp3',
  ];

  // Выбираем случайный трек один раз при загрузке страницы
  const _randomGameTrack = GAME_TRACKS[(Math.random() * GAME_TRACKS.length) | 0];

  const music = {
    menu: { audio: null, src: 'music/menu_theme.mp3',  playing: false },
    game: { audio: null, src: _randomGameTrack,         playing: false },
    boss: { audio: null, src: 'music/boss_theme.mp3',  playing: false },
    current: 'menu',
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
  ['menu','game','boss'].forEach(n => {
    const t = music[n];
    if (t.audio) t.audio.pause();
    t.playing = false;
  });
  if (ui.musicBtn) ui.musicBtn.textContent = '♫ Music: off';
}

async function playTrack(name){
  pauseAll();
  music.current = name;
  const a = ensureTrack(name);
  try {
    await a.play();
    music[name].playing = true;
    if (ui.musicBtn) ui.musicBtn.textContent = '♫ Music: on';
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


  // ===== SFX
  const sfx = {
    shoot:   'music/shoot.wav',
    levelup: 'music/levelup.wav',
    chest:   'music/chest.wav',
    death:   'music/death.wav',
    typing:  'music/typing.wav'
  };

  // ===== Boss death sound
  const BOSS_DEATH_SFX = 'music/boss/death.wav';
  function playBossDeathSfx(){
    try{
      const a = new Audio(BOSS_DEATH_SFX);
      a.volume = 0.15; a.play().catch(()=>{});
    }catch(e){}
  }

  // ===== Boss death dialogue ================================================
  let _bossDeathEl = null;
  const bossDeathCtrl = { active:false, finished:false, cancel:null };

  const BOSS_DEATH_LINES = 'N-no... this cannot be...\n\nI am the void itself.\nI will return... and when I do,\nyou won\'t be so lucky.';

  function ensureBossDeathEl(){
    if(_bossDeathEl) return;
    _bossDeathEl = document.createElement('div');
    _bossDeathEl.id = 'boss-death-overlay';
    _bossDeathEl.style.cssText = [
      'position:fixed','inset:0','display:none','place-items:center',
      'z-index:45','backdrop-filter:blur(5px)',
      'background:rgba(6,3,14,0.82)',
      'font-family:monospace','cursor:pointer'
    ].join(';');
    _bossDeathEl.innerHTML =
      '<div id="bossDeathCard" style="background:#0f0a1e;border:2px solid #5a1a6a;border-radius:10px;'
      +'padding:20px;width:min(480px,90vw);box-shadow:0 0 40px #8800cc55;opacity:0;transition:opacity .5s">'
      +'<div style="display:flex;gap:14px;align-items:flex-start">'
      +'<div style="width:80px;height:80px;flex:0 0 auto;border:2px solid #5a1a6a;border-radius:6px;'
      +'background:#0a0518;display:grid;place-items:center;overflow:hidden;image-rendering:pixelated;'
      +'filter:grayscale(0.7) brightness(0.6)">'
      +'<img src="img/boss/portrait.gif" style="max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated" alt="boss">'
      +'</div>'
      +'<div id="bossDeathText" style="color:#c090c0;line-height:1.6;white-space:pre-wrap;min-height:4em;font-size:.95em"></div>'
      +'</div>'
      +'<div id="bossDeathHint" style="display:none;margin-top:14px;color:#6040a0;font-size:.85em">'
      +'<span style="display:inline-block;padding:3px 10px;border:1px solid #3d1a55;border-radius:4px;'
      +'background:#0a0518;margin-right:6px">Space</span> — continue</div>'
      +'</div>';
    document.body.appendChild(_bossDeathEl);
    _bossDeathEl.addEventListener('click', ()=>{
      if(!bossDeathCtrl.finished) bossDeathCtrl.cancel && bossDeathCtrl.cancel();
      else closeBossDeathScene();
    });
  }

  function showBossDeathScene(){
    ensureBossDeathEl();
    game.bossDeathScene = true;
    game.running = false;
    _bossDeathEl.style.display = 'grid';

    // музыка тише во время диалога
    const tr = music[music.current];
    if(tr && tr.audio) tr.audio.volume = VOLUME.music * 0.25;

    setTimeout(()=>{
      const card = document.getElementById('bossDeathCard');
      if(card) card.style.opacity = '1';
      const textEl = document.getElementById('bossDeathText');
      if(!textEl) return;

      bossDeathCtrl.active   = true;
      bossDeathCtrl.finished = false;
      textEl.textContent = '';
      let i = 0;
      const text = BOSS_DEATH_LINES;
      let timer = null;

      function finishType(){
        bossDeathCtrl.active   = false;
        bossDeathCtrl.finished = true;
        timer = null;
        const hint = document.getElementById('bossDeathHint');
        if(hint) hint.style.display = 'block';
      }
      function tick(){
        textEl.textContent = text.slice(0, ++i);
        const ch = text[i-1];
        if(i % 2===0 && ch && ch.trim()) sfxPlay('typing', VOLUME.typing * 0.4);
        if(i < text.length) timer = setTimeout(tick, 28);
        else finishType();
      }
      timer = setTimeout(tick, 28);

      bossDeathCtrl.cancel = ()=>{
        if(timer){ clearTimeout(timer); timer = null; }
        textEl.textContent = text;
        finishType();
      };
    }, 600);
  }

  function closeBossDeathScene(){
    if(_bossDeathEl) _bossDeathEl.style.display = 'none';
    game.bossDeathScene = false;
    game.running = true;
    const tr = music[music.current];
    if(tr && tr.audio) tr.audio.volume = VOLUME.music;
  }
  // ===== END Boss death dialogue ============================================

  // ===== Boss voice lines (рандомные, не чаще 10 сек)
  const BOSS_VOICES = [
    'music/boss/voice1.wav',
    'music/boss/voice2.wav',
    'music/boss/voice3.wav',
    'music/boss/voice4.wav',
    'music/boss/voice5.wav',
  ];
  const bossVoiceCache = {};
  let _lastBossVoiceAt = -999;

  function playBossVoice(){
    const src = BOSS_VOICES[(Math.random() * BOSS_VOICES.length) | 0];
    try{
      const a = (bossVoiceCache[src] && bossVoiceCache[src].pop()) || new Audio(src);
      a.volume = 0.30; a.currentTime = 0;
      a.onended = ()=>{ (bossVoiceCache[src]||(bossVoiceCache[src]=[])).push(a); };
      a.play().catch(()=>{});
    }catch(e){}
  }
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

  let _webAudioCtx = null;
  function getWAC(){ if(!_webAudioCtx) _webAudioCtx=new(window.AudioContext||window.webkitAudioContext)(); return _webAudioCtx; }

  function sfxSynth(pl){
    try{
      const ac=getWAC(); if(ac.state==='suspended') ac.resume();
      const t=ac.currentTime;
      // pick variant
      if(pl.explosiveLevel>0){
        // deep thud + noise
        const buf=ac.createBuffer(1,Math.ceil(ac.sampleRate*0.18),ac.sampleRate);
        const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/d.length*7);
        const src=ac.createBufferSource(); src.buffer=buf;
        const g=ac.createGain(); const f=ac.createBiquadFilter(); f.type='lowpass'; f.frequency.value=280+pl.explosiveLevel*40;
        src.connect(f); f.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.28,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.18); src.start(t);
      } else if(pl.pierceCount>0){
        // sharp rising zzt
        const o=ac.createOscillator(), g=ac.createGain(); o.type='sawtooth';
        o.connect(g); g.connect(ac.destination);
        o.frequency.setValueAtTime(600+pl.pierceCount*120,t); o.frequency.exponentialRampToValueAtTime(2400,t+0.06);
        g.gain.setValueAtTime(0.055,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.07);
        o.start(t); o.stop(t+0.07);
      } else if(pl.chainBounces>0){
        // electric zap
        const o=ac.createOscillator(), g=ac.createGain(); o.type='square';
        o.connect(g); g.connect(ac.destination);
        o.frequency.setValueAtTime(180,t); o.frequency.exponentialRampToValueAtTime(900+pl.chainBounces*200,t+0.045); o.frequency.exponentialRampToValueAtTime(180,t+0.09);
        g.gain.setValueAtTime(0.05,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
        o.start(t); o.stop(t+0.1);
      } else if(pl.homingStrength>0){
        // whoosh swirl
        const o=ac.createOscillator(), g=ac.createGain(); o.type='sine';
        o.connect(g); g.connect(ac.destination);
        o.frequency.setValueAtTime(260,t); o.frequency.setValueAtTime(520+pl.homingStrength*60,t+0.03); o.frequency.setValueAtTime(260,t+0.06);
        g.gain.setValueAtTime(0.07,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.09);
        o.start(t); o.stop(t+0.09);
      } else {
        // normal pew
        const o=ac.createOscillator(), g=ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.frequency.setValueAtTime(520,t); o.frequency.exponentialRampToValueAtTime(200,t+0.09);
        g.gain.setValueAtTime(0.07,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.09);
        o.start(t); o.stop(t+0.09);
      }
    }catch(e){}
  }

  // ===== Leaderboard helpers
  function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function calcScore(){ return game.kills*100 + Math.floor(game.seconds)*3 + player.lvl*150; }

  // Возвращает { status: 'new_record'|'no_record'|'skip'|'error', msg: string }
  async function sbSubmitIfBest(name, score){
    if(!SUPABASE_URL||SUPABASE_URL==='YOUR_SUPABASE_URL') return {status:'skip',msg:''};
    const hdrs = { apikey:SUPABASE_KEY, 'Authorization':'Bearer '+SUPABASE_KEY };
    const hdrsJ = { ...hdrs, 'Content-Type':'application/json' };
    try{
      // 1. Проверяем текущий лучший результат этого игрока
      const r = await fetch(
        SUPABASE_URL+'/rest/v1/scores?name=eq.'+encodeURIComponent(name)+'&order=score.desc&limit=1&select=score',
        {headers: hdrs}
      );
      if(!r.ok){
        const t=await r.text().catch(()=>'');
        return {status:'error', msg:'GET '+r.status+': '+t};
      }
      const rows = await r.json();
      const best = (Array.isArray(rows)&&rows.length) ? rows[0].score : -1;

      if(score <= best) return {status:'no_record', msg:''};

      // 2. Пробуем upsert через merge-duplicates
      const payload = JSON.stringify({name, score, kills:game.kills,
        time_seconds:Math.floor(game.seconds), level:player.lvl});

      // ?on_conflict=name — говорим PostgREST использовать name как цель конфликта
      const up = await fetch(SUPABASE_URL+'/rest/v1/scores?on_conflict=name',{
        method:'POST',
        headers:{...hdrsJ, 'Prefer':'resolution=merge-duplicates,return=minimal'},
        body: payload
      });
      if(up.ok) return {status:'new_record', msg:''};

      const upErr = await up.text().catch(()=>'');
      return {status:'error', msg:'upsert('+up.status+'): '+upErr};
    }catch(e){
      return {status:'error', msg:String(e)};
    }
  }

  async function sbFetch(){
    if(!SUPABASE_URL||SUPABASE_URL==='YOUR_SUPABASE_URL') return null;
    try{
      const r=await fetch(
        SUPABASE_URL+'/rest/v1/scores?order=score.desc&limit=10&select=name,score,kills,time_seconds,level',
        {headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY}}
      );
      return await r.json();
    }catch(e){ return null; }
  }

  async function renderLeaderboard(targetEl){
    targetEl.innerHTML='<div class="opt-info" style="text-align:center;color:#4a6080">Loading…</div>';
    const rows = await sbFetch();
    if(!rows||!rows.length){
      targetEl.innerHTML='<div class="opt-info muted" style="text-align:center">No entries yet — you are first! 🎉</div>';
      return;
    }
    const medals=['🥇','🥈','🥉'];
    let h='<div class="opt-info" style="padding:6px 0">'
         +'<div style="font-size:10px;font-weight:700;color:#3a5070;letter-spacing:1px;margin-bottom:6px">TOP 10 · LEADERBOARD</div>'
         +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
         +'<tr style="color:#3a5070;font-size:10px">'
         +'<th style="text-align:left;padding:2px 4px;width:28px">#</th>'
         +'<th style="text-align:left">Name</th>'
         +'<th style="text-align:right;padding-right:4px">Score</th>'
         +'<th style="text-align:right;padding-right:4px">Kills</th>'
         +'<th style="text-align:right;padding-right:4px">Time</th>'
         +'<th style="text-align:right">Lv</th></tr>';
    rows.forEach((row,i)=>{
      const rank=medals[i]||(i+1);
      h+='<tr style="border-top:1px solid #1a2336">'
        +'<td style="padding:3px 4px;color:#4a6080">'+rank+'</td>'
        +'<td style="color:#e7ecf9;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(row.name)+'</td>'
        +'<td style="text-align:right;color:#aae8ff;padding-right:4px">'+row.score+'</td>'
        +'<td style="text-align:right;color:#44dd88;padding-right:4px">'+row.kills+'</td>'
        +'<td style="text-align:right;color:#888;padding-right:4px">'+fmtTime(row.time_seconds||0)+'</td>'
        +'<td style="text-align:right;color:#ffd040">'+row.level+'</td>'
        +'</tr>';
    });
    h+='</table></div>';
    targetEl.innerHTML=h;
  }

  // ===== Game over
  function gameOver(){
    sfxPlay('death', 0.4);
    document.body.classList.remove('low-hp');
    document.body.classList.remove('boss-fight');
    if(_bossDeathEl) _bossDeathEl.style.display='none';
    game.bossDeathScene = false;
    setOverlayTitle('GAME OVER');
    ui.levelup.style.display='grid';
    game.running=false;

    const score=calcScore();
    ui.opts.innerHTML='';

    // — summary
    const over=document.createElement('div'); over.className='opt-info';
    over.innerHTML='<b>Session ended</b><div class="muted" style="margin-top:4px">'
      +'Kills: <b style="color:#44dd88">'+game.kills+'</b>'
      +' &nbsp;·&nbsp; Time: <b style="color:#aaa">'+fmtTime(game.seconds)+'</b>'
      +' &nbsp;·&nbsp; Lv: <b style="color:#ffd040">'+player.lvl+'</b>'
      +' &nbsp;·&nbsp; Score: <b style="color:#aae8ff">'+score+'</b>'
      +'</div>';

    // — статус отправки (пока ждём)
    const statusEl=document.createElement('div'); statusEl.className='opt-info';
    statusEl.style.cssText='text-align:center;color:#4a6080;font-size:13px;';
    statusEl.textContent='Saving score…';

    // — leaderboard placeholder
    const lbDiv=document.createElement('div');
    lbDiv.style.display='none';

    // — retry
    const retry=document.createElement('div'); retry.className='opt';
    retry.innerHTML='<b>▶ Play Again</b>';
    retry.onclick=()=>location.reload();

    ui.opts.appendChild(over);
    ui.opts.appendChild(statusEl);
    ui.opts.appendChild(lbDiv);
    ui.opts.appendChild(retry);

    // — авто-сабмит
    (async()=>{
      const name=(localStorage.getItem('vs_player_name')||'Anonymous').substring(0,20);
      const {status, msg} = await sbSubmitIfBest(name, score);
      if(status==='new_record'){
        statusEl.innerHTML='🏆 <b style="color:#aae8ff">New personal best!</b> Saved as <b>'+escHtml(name)+'</b>';
      } else if(status==='no_record'){
        statusEl.innerHTML='<span style="color:#4a6080">Not a new personal best — your record stands</span>';
      } else if(status==='skip'){
        statusEl.style.display='none';
      } else {
        statusEl.innerHTML='<span style="color:#ff4455">⚠ Save failed: '+escHtml(msg)+'</span>';
      }
      await renderLeaderboard(lbDiv);
      lbDiv.style.display='';
    })();
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

  const STORY = 'You are a “sleeping avatar” trapped in a glitch world between the server and the subconscious.\n' +
                'Each session is a sleep cycle where you must survive among bugs, viruses, and fragments of memories.';

function showStory(){
  ui.storyOverlay.style.display = 'grid';
  if (ui.storyOk) ui.storyOk.style.display = 'none';
  if (ui.storyHint) ui.storyHint.style.display = 'none';

  typeText(ui.storyText, STORY, 1, function(){
    if (ui.storyOk) ui.storyOk.style.display = 'inline-block';
    showSpaceHint('— start'); // покажем подсказку с «Space», когда печать закончилась
  });

  // пока печатаем — показываем «— пропустить»
  showSpaceHint('— skip');
}

  function startRun(){
    initCombatLogPanel();
    game.started = true;
    document.body.classList.remove('low-hp');
    ui.levelup.style.display='none';
    ui.storyOverlay.style.display='none';
    ui.startOverlay.style.display='none';
    game.seconds = 0; if (ui.time) ui.time.textContent='00:00'; game.t0 = now();
    game.running = true;
    if (ui.pauseBtn) ui.pauseBtn.style.display = '';
    const ph = document.getElementById('pauseHint');
    if (ph) ph.style.display = '';
  }

function isOverlayOpen(){
  const levelupOpen = ui.levelup && ui.levelup.style.display !== "none";
  const storyOpen   = ui.storyOverlay && ui.storyOverlay.style.display !== "none";
  const menuOpen    = ui.startOverlay && ui.startOverlay.style.display !== "none";
  return levelupOpen || storyOpen || menuOpen;
}
function showPause(){ const p=document.getElementById("pauseOverlay"); if(p) p.style.display="grid"; }
function hidePause(){ const p=document.getElementById("pauseOverlay"); if(p) p.style.display="none"; }
function togglePause(){
  if(!game.started) return;
  if(isOverlayOpen()) return;
  game.running=!game.running;
  if(!game.running) showPause(); else hidePause();
}
function showMenu(){
  buildStartMenu();
  if(ui.startOverlay) ui.startOverlay.style.display="flex";
  cvs.style.display="none";
  playTrack("menu");
}
function startFromMenu(){
  cvs.style.display="block";
  playTrack("game");
  if(ui.startOverlay) ui.startOverlay.style.display="none";
  showStory();
}
  function loop(){
    const t=now(); const dt=(t-last)/1000; last=t;
    if(game.running){ update(dt,t); render(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  if(ui.pauseBtn) ui.pauseBtn.onclick=togglePause;
  if(ui.pauseBtn) ui.pauseBtn.style.display="none";
  if(ui.storyOk) ui.storyOk.addEventListener("click", startRun);
  if(ui.storyOverlay) ui.storyOverlay.addEventListener("click",(e)=>{
    if(ui.storyOk && ui.storyOk.style.display!=="none" && e.target===ui.storyOverlay) startRun();
  });
  window.addEventListener("load",()=>{
    // ===== Декоративный загрузчик =====
    const loadScreen = document.getElementById('loadScreen');
    const loadBar    = document.getElementById('loadBar');
    const loadMsg    = document.getElementById('loadMsg');
    const msgs = [
      'Initializing glitch matrix…',
      'Loading corrupted memories…',
      'Syncing with the void…',
      'Patching reality…',
      'Spawning entities…',
      'Calibrating dreamscape…',
      'Almost there…',
    ];
    let step = 0;
    const totalSteps = msgs.length;

    function nextStep(){
      if(step >= totalSteps){
        // сначала показываем меню за лоадингом, потом плавно убираем лоадинг
        const wrap = document.getElementById('wrap');
        showMenu();
        if(wrap) requestAnimationFrame(()=>{ wrap.style.opacity='1'; });
        // startOverlay появляется с fade-in
        const so = document.getElementById('startOverlay');
        if(so){ so.style.opacity='0'; so.style.transition='opacity .5s ease';
          requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ so.style.opacity='1'; }); }); }
        setTimeout(()=>{
          if(loadScreen) loadScreen.classList.add('hide');
          setTimeout(()=>{ if(loadScreen) loadScreen.style.display='none'; }, 520);
        }, 80);
        return;
      }
      if(loadBar) loadBar.style.width = ((step+1)/totalSteps*100).toFixed(1)+'%';
      if(loadMsg)  loadMsg.textContent = msgs[step];
      step++;
      setTimeout(nextStep, 320 + Math.random()*200);
    }
    setTimeout(nextStep, 120);
  });
})();
