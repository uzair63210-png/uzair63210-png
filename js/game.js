/* ============================================================
   Snake — smooth animation engine
   - Movement is interpolated between logic ticks (no cell jumps)
   - Particles, score popups, glow, screen shake
   ============================================================ */
(() => {
"use strict";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const GRID = 21;
const CELL = canvas.width / GRID;

const scoreEl   = document.getElementById("score");
const bestEl    = document.getElementById("best");
const speedEl   = document.getElementById("speed");
const overlay   = document.getElementById("overlay");
const ovTitle   = document.getElementById("overlay-title");
const ovMsg     = document.getElementById("overlay-msg");
const restartBtn = document.getElementById("restart-btn");

const BASE_TICK = 150;   // ms per logic step at start
const MIN_TICK  = 68;    // fastest allowed
const HEAD_R    = CELL * 0.48;
const TAIL_R    = CELL * 0.26;

/* ---------- state ---------- */
let snake, prevSnake, dir, inputQueue;
let food, score, best, eaten, tickInterval, tickTimer, lastTickTime;
let running, paused, dead, deathAt;
let particles = [], popups = [];
let shake = 0, flash = 0, borderGlow = 0;

best = parseInt(localStorage.getItem("snake-best") || "0", 10);
bestEl.textContent = best;

/* ---------- helpers ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const cellCenter = c => c * CELL + CELL / 2;

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mixColor(c1, c2, t) {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;
}
const GREEN_HEAD = [63, 185, 80];
const GREEN_TAIL = [20, 80, 35];

/* ---------- game setup ---------- */
function reset() {
  const mid = Math.floor(GRID / 2);
  snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
    { x: mid - 3, y: mid },
  ];
  prevSnake = snake.map(s => ({ ...s }));
  dir = { x: 1, y: 0 };
  inputQueue = [];
  score = 0;
  eaten = 0;
  tickInterval = BASE_TICK;
  particles = [];
  popups = [];
  shake = 0; flash = 0;
  running = true;
  paused = false;
  dead = false;
  scoreEl.textContent = "0";
  speedEl.textContent = "1.0x";
  overlay.classList.remove("show");
  placeFood();
  startLoop();
}

function placeFood() {
  do {
    food = { x: (Math.random() * GRID) | 0, y: (Math.random() * GRID) | 0 };
  } while (snake.some(s => s.x === food.x && s.y === food.y));
}

function currentSpeed() {
  return (BASE_TICK / tickInterval).toFixed(1) + "x";
}

/* ---------- logic tick (fixed step) ---------- */
function tick() {
  if (paused || dead) { lastTickTime = performance.now(); return; }
  lastTickTime = performance.now();

  // Apply at most one queued direction change per tick
  while (inputQueue.length) {
    const d = inputQueue.shift();
    const isReverse = (d.x === -dir.x && d.y === -dir.y);
    const isSame    = (d.x === dir.x && d.y === dir.y);
    if (!isReverse && !isSame) { dir = d; break; }
  }

  prevSnake = snake.map(s => ({ ...s }));

  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
  const hitSelf = snake.some(s => s.x === head.x && s.y === head.y);
  if (hitWall || hitSelf) { die(); return; }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    eaten++;
    score += 10;
    scoreEl.textContent = score;
    spawnParticles(cellCenter(food.x), cellCenter(food.y));
    spawnPopup(cellCenter(food.x), cellCenter(food.y), "+10");
    shake = Math.min(shake + 4, 8);
    borderGlow = 1;
    if (tickInterval > MIN_TICK) {
      tickInterval = Math.max(MIN_TICK, BASE_TICK - eaten * 3);
      speedEl.textContent = currentSpeed();
      restartLoop();
      return; // lastTickTime already set; loop re-scheduled
    }
    placeFood();
  } else {
    snake.pop();
  }
}

function die() {
  dead = true;
  running = false;
  clearInterval(tickTimer);
  flash = 1;
  shake = 14;
  if (score > best) {
    best = score;
    localStorage.setItem("snake-best", String(best));
    bestEl.textContent = best;
  }
  setTimeout(() => {
    ovTitle.textContent = "Game Over";
    ovMsg.innerHTML = "Score: <b>" + score + "</b>" +
      (score > 0 && score >= best ? " &nbsp;🏆 New best!" : "");
    overlay.classList.add("show");
  }, 650);
}

function startLoop() {
  clearInterval(tickTimer);
  lastTickTime = performance.now();
  tickTimer = setInterval(tick, tickInterval);
}
function restartLoop() {
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, tickInterval);
}

/* ---------- effects ---------- */
function spawnParticles(x, y) {
  const colors = ["#f85149", "#3fb950", "#ffd33d", "#ff9bce"];
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 2.6;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 0.6,
      r: 1.5 + Math.random() * 2.5,
      life: 1,
      decay: 0.015 + Math.random() * 0.02,
      color: colors[(Math.random() * colors.length) | 0],
    });
  }
}

function spawnPopup(x, y, text) {
  popups.push({ x, y, text, life: 1 });
}

/* ---------- rendering (every frame, interpolated) ---------- */
function render(now) {
  const t = paused || dead ? 1 : Math.min(1, (now - lastTickTime) / tickInterval);

  ctx.save();

  // Screen shake
  if (shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    shake *= 0.88;
  } else shake = 0;

  drawBoard(now);
  drawFood(now);
  drawSnake(t);
  drawParticles();
  drawPopups();

  // Death flash
  if (flash > 0.01) {
    ctx.fillStyle = `rgba(248, 81, 73, ${flash * 0.28})`;
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);
    flash *= 0.9;
  }

  ctx.restore();
  requestAnimationFrame(render);
}

function drawBoard(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#161b22";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Slowly drifting grid
  const drift = (now / 90) % CELL;
  ctx.strokeStyle = "rgba(48, 54, 61, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = drift; x < canvas.width; x += CELL) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
  for (let y = drift; y < canvas.height; y += CELL) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
  ctx.stroke();

  // Glowing border (flashes green when you eat)
  if (borderGlow > 0.02) {
    ctx.strokeStyle = `rgba(63, 185, 80, ${borderGlow * 0.8})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(63, 185, 80, 0.9)";
    ctx.shadowBlur = 18 * borderGlow;
    roundRect(2, 2, canvas.width - 4, canvas.height - 4, 12);
    ctx.stroke();
    ctx.shadowBlur = 0;
    borderGlow *= 0.92;
  }
}

function drawFood(now) {
  const cx = cellCenter(food.x), cy = cellCenter(food.y);
  const pulse = 1 + 0.14 * Math.sin(now / 160);

  // Halo
  ctx.save();
  ctx.shadowColor = "rgba(248, 81, 73, 0.9)";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#f85149";
  ctx.beginPath();
  ctx.arc(cx, cy, CELL * 0.30 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.arc(cx - CELL * 0.09, cy - CELL * 0.11, CELL * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // Orbiting sparkles
  for (let i = 0; i < 3; i++) {
    const a = now / 400 + (i * Math.PI * 2) / 3;
    ctx.fillStyle = `rgba(255, 211, 61, ${0.5 + 0.4 * Math.sin(now / 200 + i)})`;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * CELL * 0.62, cy + Math.sin(a) * CELL * 0.62, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSnake(t) {
  const pts = [];
  for (let i = 0; i < snake.length; i++) {
    const cur = snake[i];
    const prev = i === 0 ? (prevSnake[0] || cur) : (prevSnake[i - 1] || cur);
    pts.push({ x: lerp(cellCenter(prev.x), cellCenter(cur.x), t),
               y: lerp(cellCenter(prev.y), cellCenter(cur.y), t) });
  }

  // Body: tapering circles, tail → head so the head renders on top
  const n = pts.length;
  for (let i = n - 1; i >= 0; i--) {
    const k = n === 1 ? 0 : i / (n - 1);
    const r = lerp(HEAD_R, TAIL_R, k);
    ctx.fillStyle = mixColor(GREEN_HEAD, GREEN_TAIL, k);
    if (i === 0) { ctx.shadowColor = "rgba(63, 185, 80, 0.6)"; ctx.shadowBlur = 14; }
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Belly stripes (subtle, along the middle segments)
  ctx.fillStyle = "rgba(13, 17, 23, 0.18)";
  for (let i = 2; i < n; i += 2) {
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, lerp(HEAD_R, TAIL_R, i / (n - 1)) * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head eyes (look in the direction of travel)
  const h = pts[0];
  const ex = dir.x * CELL * 0.14, ey = dir.y * CELL * 0.14;
  const px = -dir.y, py = dir.x; // perpendicular
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(h.x + ex + px * CELL * 0.16 * s, h.y + ey + py * CELL * 0.16 * s, CELL * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0d1117";
    ctx.beginPath();
    ctx.arc(h.x + ex * 1.6 + px * CELL * 0.16 * s, h.y + ey * 1.6 + py * CELL * 0.16 * s, CELL * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tongue flicker
  if ((performance.now() / 900 | 0) % 3 === 0 && !dead) {
    const tx = h.x + dir.x * HEAD_R, ty = h.y + dir.y * HEAD_R;
    ctx.strokeStyle = "#ff7b72";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + dir.x * CELL * 0.35, ty + dir.y * CELL * 0.35);
    ctx.moveTo(tx + dir.x * CELL * 0.35, ty + dir.y * CELL * 0.35);
    ctx.lineTo(tx + dir.x * CELL * 0.5 - dir.y * 3, ty + dir.y * CELL * 0.5 - dir.x * 3);
    ctx.moveTo(tx + dir.x * CELL * 0.35, ty + dir.y * CELL * 0.35);
    ctx.lineTo(tx + dir.x * CELL * 0.5 + dir.y * 3, ty + dir.y * CELL * 0.5 + dir.x * 3);
    ctx.stroke();
  }
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.05;
    p.vx *= 0.98;
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPopups() {
  ctx.textAlign = "center";
  ctx.font = "bold 16px -apple-system, sans-serif";
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.y -= 0.7;
    p.life -= 0.02;
    if (p.life <= 0) { popups.splice(i, 1); continue; }
    ctx.globalAlpha = p.life;
    ctx.fillStyle = "#ffd33d";
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

/* ---------- input ---------- */
function queueDir(x, y) {
  if (dead) return;
  if (inputQueue.length < 3) inputQueue.push({ x, y });
}

document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  switch (k) {
    case "arrowup": case "w": queueDir(0, -1); break;
    case "arrowdown": case "s": queueDir(0, 1); break;
    case "arrowleft": case "a": queueDir(-1, 0); break;
    case "arrowright": case "d": queueDir(1, 0); break;
    case " ":
      if (!dead && running) { paused = !paused; lastTickTime = performance.now(); }
      break;
    case "enter": if (dead) reset(); break;
  }
});

// Touch buttons
document.querySelectorAll("#touch-controls button").forEach(btn => {
  const go = e => {
    e.preventDefault();
    const d = btn.dataset.dir;
    if (d === "up") queueDir(0, -1);
    if (d === "down") queueDir(0, 1);
    if (d === "left") queueDir(-1, 0);
    if (d === "right") queueDir(1, 0);
  };
  btn.addEventListener("touchstart", go, { passive: false });
  btn.addEventListener("click", go);
});

// Swipe on canvas
let touchStart = null;
canvas.addEventListener("touchstart", e => { touchStart = e.touches[0]; }, { passive: true });
canvas.addEventListener("touchend", e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.clientX;
  const dy = e.changedTouches[0].clientY - touchStart.clientY;
  if (Math.abs(dx) < 18 && Math.abs(dy) < 18) { touchStart = null; return; }
  if (Math.abs(dx) > Math.abs(dy)) queueDir(dx > 0 ? 1 : -1, 0);
  else queueDir(0, dy > 0 ? 1 : -1);
  touchStart = null;
}, { passive: true });

restartBtn.addEventListener("click", reset);

// Auto-pause when the tab loses focus
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running && !dead) paused = true;
});

/* ---------- go ---------- */
reset();
requestAnimationFrame(render);
})();
