/*
 * Singularity — a particle physics game.
 *
 * Every dot on screen is a real particle with mass, velocity, momentum and
 * elastic bounces off the walls. On top of that:
 *   - the player is a gravity well: particles accelerate toward it (F ~ 1/r),
 *     so near misses bend into orbits and slow ones fall in,
 *   - colliding motes merge perfectly inelastically (momentum is conserved),
 *     which grows clumps you can either harvest or get wrecked by,
 *   - tangential force keeps the swarm swirling instead of collapsing
 *     in a straight line.
 */
(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const el = {
    mass: document.getElementById('hud-mass'),
    score: document.getElementById('hud-score'),
    wave: document.getElementById('hud-wave'),
    best: document.getElementById('hud-best'),
    energy: document.getElementById('hud-energy'),
    overlay: document.getElementById('overlay'),
    title: document.getElementById('overlay-title'),
    body: document.getElementById('overlay-body'),
    start: document.getElementById('start-btn'),
  };

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const COLORS = { mote: '120, 225, 255', flare: '255, 208, 110', hazard: '255, 92, 132' };

  const CFG = {
    startMass: 14,
    energyMax: 100,
    energyDrain: 26,
    energyRegen: 12,
    pull: 5200,
    waveTime: 13,
    maxSpeed: 1500,
  };

  let W = 0;
  let H = 0;
  let DPR = 1;

  const keys = new Set();

  const game = {
    mode: 'menu',
    time: 0,
    wave: 1,
    waveTimer: 0,
    mass: CFG.startMass,
    score: 0,
    energy: CFG.energyMax,
    over: false,
    particles: [],
    player: { x: 0, y: 0, vx: 0, vy: 0, r: 16 },
    pointer: { x: 0, y: 0, down: false, active: false },
    shake: 0,
    flash: 0,
    best: Number(localStorage.getItem('particle-game.best')) || 0,
  };

  const playerRadius = (mass) => 9 + Math.sqrt(Math.max(mass, 0)) * 1.9;

  function resize() {
    DPR = clamp(window.devicePixelRatio || 1, 1, 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#04060e';
    ctx.fillRect(0, 0, W, H);
    game.player.x = clamp(game.player.x, 0, W);
    game.player.y = clamp(game.player.y, 0, H);
  }

  function spawnParticle(type) {
    const p = game.player;
    let x = W / 2;
    let y = H / 2;
    for (let i = 0; i < 16; i++) {
      x = rand(40, Math.max(41, W - 40));
      y = rand(40, Math.max(41, H - 40));
      if (Math.hypot(x - p.x, y - p.y) > 170) break;
    }
    const angle = rand(0, TAU);
    const speed = type === 'hazard' ? rand(40, 95) : rand(10, 45);
    const q = { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, type, dead: false };
    if (type === 'mote') {
      q.m = 1;
      q.r = 2.6;
    } else if (type === 'flare') {
      q.m = 0;
      q.r = 5.5;
    } else {
      q.m = 5;
      q.r = 8;
    }
    game.particles.push(q);
    return q;
  }

  function countType(type) {
    let n = 0;
    for (const q of game.particles) if (q.type === type && !q.dead) n++;
    return n;
  }

  function reset() {
    game.mode = 'playing';
    game.time = 0;
    game.wave = 1;
    game.waveTimer = 0;
    game.mass = CFG.startMass;
    game.score = 0;
    game.energy = CFG.energyMax;
    game.over = false;
    game.particles.length = 0;
    game.shake = 0;
    game.flash = 0;
    game.player.x = W / 2;
    game.player.y = H / 2;
    game.player.vx = 0;
    game.player.vy = 0;
    game.player.r = playerRadius(game.mass);
    game.pointer.x = W / 2;
    game.pointer.y = H / 2;
    game.pointer.down = false;
    for (let i = 0; i < 70; i++) spawnParticle('mote');
    hideOverlay();
    updateHud(true);
  }

  function endGame() {
    game.over = true;
    game.mode = 'over';
    const score = Math.round(game.score);
    if (score > game.best) {
      game.best = score;
      localStorage.setItem('particle-game.best', String(score));
    }
    showOverlay(
      'Collapsed',
      `You held ${Math.round(game.mass > 0 ? game.mass : 0)} mass across ${game.wave} wave${
        game.wave === 1 ? '' : 's'
      } and scored <strong>${score}</strong>.<br />Best so far: <strong>${game.best}</strong>.`,
      'Again'
    );
    updateHud(true);
  }

  function showOverlay(title, body, button) {
    el.title.textContent = title;
    el.body.innerHTML = body;
    el.start.textContent = button;
    el.overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    el.overlay.classList.add('hidden');
  }

  function updateHud(force) {
    if (!force) {
      if (game.hudClock < 0.06) return;
      game.hudClock = 0;
    }
    el.mass.textContent = String(Math.max(0, Math.round(game.mass)));
    el.score.textContent = String(Math.round(game.score));
    el.wave.textContent = String(game.wave);
    el.best.textContent = String(game.best);
    el.energy.style.width = `${clamp(game.energy, 0, 100)}%`;
  }
  game.hudClock = 0;

  // ---------------------------------------------------------------- physics

  function physics(dt) {
    const g = game;
    const p = g.player;

    p.r = playerRadius(g.mass);

    // --- player motion: a spring toward the pointer, plus keyboard thrust ---
    let ax = 0;
    let ay = 0;
    if (g.pointer.active) {
      ax += (g.pointer.x - p.x) * 24;
      ay += (g.pointer.y - p.y) * 24;
    }
    const thrust = 2400;
    if (keys.has('a') || keys.has('arrowleft')) ax -= thrust;
    if (keys.has('d') || keys.has('arrowright')) ax += thrust;
    if (keys.has('w') || keys.has('arrowup')) ay -= thrust;
    if (keys.has('s') || keys.has('arrowdown')) ay += thrust;

    p.vx += ax * dt;
    p.vy += ay * dt;
    const drag = Math.exp(-3.1 * dt);
    p.vx *= drag;
    p.vy *= drag;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > CFG.maxSpeed) {
      p.vx = (p.vx / speed) * CFG.maxSpeed;
      p.vy = (p.vy / speed) * CFG.maxSpeed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, p.r, W - p.r);
    p.y = clamp(p.y, p.r, H - p.r);

    // --- overcharge state ---
    const wantsPull = g.pointer.down || keys.has(' ');
    const over = wantsPull && g.energy > 0.5;
    g.over = over;
    if (over) g.energy = Math.max(0, g.energy - CFG.energyDrain * dt);
    else g.energy = Math.min(CFG.energyMax, g.energy + CFG.energyRegen * dt);

    // --- gravity well ---
    const pullR = p.r * (over ? 5.6 : 3.3) + 55;
    const pullR2 = pullR * pullR;
    const base = CFG.pull * (over ? 3 : 1) * (0.55 + Math.sqrt(g.mass) * 0.13);
    const pDrag = Math.exp(-0.85 * dt);

    for (const q of g.particles) {
      if (q.dead) continue;
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const d2 = dx * dx + dy * dy;

      if (d2 < pullR2) {
        const d = Math.sqrt(d2) + 0.001;
        let f = base / (d + 55);
        if (f > 1500) f = 1500;
        if (q.type === 'hazard') f *= 0.42; // anti-matter resists
        q.vx += ((dx / d) * f + (-dy / d) * f * 0.28) * dt;
        q.vy += ((dy / d) * f + (dx / d) * f * 0.28) * dt;
      }

      // free drift needs a little damping so orbits settle instead of flying off
      q.vx *= pDrag;
      q.vy *= pDrag;
      q.x += q.vx * dt;
      q.y += q.vy * dt;

      if (q.x < q.r) {
        q.x = q.r;
        q.vx = Math.abs(q.vx) * 0.62;
      } else if (q.x > W - q.r) {
        q.x = W - q.r;
        q.vx = -Math.abs(q.vx) * 0.62;
      }
      if (q.y < q.r) {
        q.y = q.r;
        q.vy = Math.abs(q.vy) * 0.62;
      } else if (q.y > H - q.r) {
        q.y = H - q.r;
        q.vy = -Math.abs(q.vy) * 0.62;
      }
    }

    // --- inelastic merging: motes clump, momentum is conserved ---
    const ps = g.particles;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.dead || a.type === 'hazard') continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        if (b.dead || b.type !== a.type) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = (a.r + b.r) * 0.8;
        if (dx * dx + dy * dy > rr * rr) continue;
        const m = a.m + b.m;
        if (m > 0) {
          a.vx = (a.vx * a.m + b.vx * b.m) / m;
          a.vy = (a.vy * a.m + b.vy * b.m) / m;
          a.x = (a.x * a.m + b.x * b.m) / m;
          a.y = (a.y * a.m + b.y * b.m) / m;
        }
        a.m = m;
        a.r = Math.min(2.6 * Math.cbrt(Math.max(a.m, 1)) + (a.type === 'flare' ? 3 : 0), 26);
        b.dead = true;
      }
    }

    // --- absorption ---
    let ate = false;
    for (const q of g.particles) {
      if (q.dead) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const rr = p.r + q.r;
      if (dx * dx + dy * dy > rr * rr) continue;
      q.dead = true;
      ate = true;
      if (q.type === 'mote') {
        g.mass += q.m;
        g.score += Math.round(q.m * 12);
      } else if (q.type === 'flare') {
        g.energy = Math.min(CFG.energyMax, g.energy + 42);
        g.score += 20;
      } else {
        g.mass -= 6 + q.m * 0.8;
        g.score = Math.max(0, g.score - 45);
        g.shake = 18;
        g.flash = 0.55;
      }
    }
    if (ate) g.particles = g.particles.filter((q) => !q.dead);

    // --- waves & spawning ---
    g.waveTimer += dt;
    if (g.waveTimer >= CFG.waveTime) {
      g.waveTimer = 0;
      g.wave++;
      g.energy = Math.min(CFG.energyMax, g.energy + 20);
    }

    const moteTarget = Math.min(190, 60 + g.wave * 14);
    const hazardTarget = Math.min(15, 1 + g.wave);
    const flareTarget = 2;

    let motes = countType('mote');
    let hazards = countType('hazard');
    let flares = countType('flare');
    let guard = 0;
    while (motes < moteTarget && guard++ < 12) {
      spawnParticle('mote');
      motes++;
    }
    while (hazards < hazardTarget && guard++ < 40) {
      spawnParticle('hazard');
      hazards++;
    }
    while (flares < flareTarget && guard++ < 50) {
      spawnParticle('flare');
      flares++;
    }

    // --- decay & death ---
    g.shake *= Math.exp(-7 * dt);
    g.flash = Math.max(0, g.flash - dt * 1.8);
    g.time += dt;

    if (g.mass <= 0.4) endGame();
  }

  // ----------------------------------------------------------------- render

  function render() {
    const g = game;
    const p = g.player;

    // translucent wipe leaves motion trails behind every particle
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(4, 6, 14, 0.34)';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (g.shake > 0.4) ctx.translate(rand(-g.shake, g.shake), rand(-g.shake, g.shake));

    ctx.globalCompositeOperation = 'lighter';

    for (const q of g.particles) {
      if (q.dead) continue;
      const c = COLORS[q.type];
      const r = q.r;
      ctx.fillStyle = `rgba(${c}, 0.1)`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r * 2.7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(${c}, ${q.type === 'hazard' ? 0.92 : 0.85})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, TAU);
      ctx.fill();
    }

    // gravity well radius while overcharging
    if (g.over) {
      const pulse = 0.16 + 0.09 * Math.sin(g.time * 9);
      ctx.strokeStyle = `rgba(120, 225, 255, ${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 5.6 + 55, 0, TAU);
      ctx.stroke();
    }

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.6);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    glow.addColorStop(0.28, 'rgba(150, 240, 255, 0.5)');
    glow.addColorStop(1, 'rgba(70, 170, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 3.6, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();

    ctx.restore();

    if (g.flash > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(255, 70, 110, ${g.flash * 0.3})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------- loop

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;

    if (game.mode === 'playing') {
      physics(dt);
      game.hudClock += dt;
      updateHud(false);
    }
    render();
  }

  // ------------------------------------------------------------------ input

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('pointermove', (e) => {
    const pos = pointerPos(e);
    game.pointer.x = pos.x;
    game.pointer.y = pos.y;
    game.pointer.active = true;
  });

  canvas.addEventListener('pointerdown', (e) => {
    const pos = pointerPos(e);
    game.pointer.x = pos.x;
    game.pointer.y = pos.y;
    game.pointer.active = true;
    game.pointer.down = true;
    canvas.setPointerCapture?.(e.pointerId);
    if (game.mode === 'menu' || game.mode === 'over') reset();
  });

  const release = () => {
    game.pointer.down = false;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => {
    game.pointer.down = false;
    game.pointer.active = false;
  });
  window.addEventListener('blur', release);

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'spacebar' || e.code === 'Space') {
      e.preventDefault();
      if (game.mode !== 'playing') reset();
    }
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  el.start.addEventListener('click', (e) => {
    e.stopPropagation();
    reset();
  });

  window.addEventListener('resize', resize);

  // ------------------------------------------------------------------- boot

  resize();
  game.player.x = W / 2;
  game.player.y = H / 2;
  game.pointer.x = W / 2;
  game.pointer.y = H / 2;
  for (let i = 0; i < 60; i++) spawnParticle('mote');
  render();
  updateHud(true);
  requestAnimationFrame(frame);
})();
