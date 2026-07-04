/* ===================================================================
   JP Mentors Penalty Shootout — self-contained canvas game
   Aim with pointer, hold to charge an oscillating power meter,
   release to shoot. Beat the keeper for a goal.
   =================================================================== */
(function () {
  "use strict";

  const canvas = document.getElementById("footyGame");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  // ---- Field geometry ----
  const GOAL = { left: 150, right: 490, top: 74, bottom: 176 }; // goal mouth
  const GOAL_W = GOAL.right - GOAL.left;
  const BALL_START = { x: W / 2, y: 372 };
  const KEEPER_Y = 150;

  // ---- UI elements ----
  const overlay = document.getElementById("gameOverlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const startBtn = document.getElementById("startBtn");
  const elGoals = document.getElementById("scoreGoals");
  const elShots = document.getElementById("scoreShots");
  const elStreak = document.getElementById("scoreStreak");
  const hint = document.getElementById("gameHint");

  // ---- State ----
  let state = "ready"; // ready | aim | charging | shooting | result
  let goals = 0, shots = 0, streak = 0, best = 0;
  let aim = { x: W / 2, y: (GOAL.top + GOAL.bottom) / 2 };
  let power = 0, powerDir = 1;
  let ball, keeper, shotResult = null, resultTimer = 0, particles = [];

  function resetKeeper() {
    keeper = { x: W / 2, targetX: W / 2, y: KEEPER_Y, dive: 0, diveDir: 0, committed: false };
  }
  function resetBall() {
    ball = { x: BALL_START.x, y: BALL_START.y, r: 15, vx: 0, vy: 0, t: 0, dur: 0, flying: false,
             sx: BALL_START.x, sy: BALL_START.y, tx: 0, ty: 0, spin: 0 };
  }
  resetKeeper();
  resetBall();

  // ---- Pointer handling ----
  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x: cx * (W / rect.width), y: cy * (H / rect.height) };
  }
  function setAim(p) {
    // Aim within/around the goal; allow a little beyond posts so wide shots are possible
    aim.x = Math.max(GOAL.left - 55, Math.min(GOAL.right + 55, p.x));
    aim.y = Math.max(GOAL.top + 6, Math.min(GOAL.bottom - 6, Math.min(p.y, KEEPER_Y + 40)));
  }

  canvas.addEventListener("pointermove", (e) => {
    if (state === "aim" || state === "charging") setAim(pointerPos(e));
  });
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state === "aim") {
      setAim(pointerPos(e));
      state = "charging";
      power = 0; powerDir = 1;
      hint.textContent = "Release to shoot!";
    }
  });
  const release = (e) => {
    if (state === "charging") { if (e) e.preventDefault(); shoot(); }
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointerleave", release);
  canvas.addEventListener("pointercancel", release);

  // ---- Game flow ----
  function startGame() {
    goals = 0; shots = 0; streak = 0;
    updateHud();
    overlay.classList.add("hidden");
    beginAim();
  }
  function beginAim() {
    state = "aim";
    resetBall();
    resetKeeper();
    shotResult = null;
    hint.textContent = "Move to aim · press & hold to charge power";
  }

  function shoot() {
    state = "shooting";
    shots++;
    const pw = power / 100; // 0..1

    // Keeper commits to a horizontal zone (0 left, 1 mid, 2 right) it can't see your exact aim
    const dz = Math.floor(rand() * 3);
    const zoneCenters = [GOAL.left + GOAL_W * 0.2, W / 2, GOAL.right - GOAL_W * 0.2];
    keeper.targetX = zoneCenters[dz];
    keeper.committed = true;

    // Ball flight target
    ball.sx = ball.x; ball.sy = ball.y;
    ball.tx = aim.x; ball.ty = aim.y;
    ball.dur = 46 - pw * 20;      // frames; more power = faster
    ball.t = 0; ball.flying = true;
    ball.spin = (aim.x - W / 2) * 0.02;

    // Precompute outcome
    shotResult = decideOutcome(aim, dz, pw);
    hint.textContent = "";
  }

  function decideOutcome(a, keeperZone, pw) {
    // Wide of the posts?
    if (a.x < GOAL.left + 6 || a.x > GOAL.right - 6) return { type: "wide" };

    // Which third did the shot go? (0 = left, 1 = middle, 2 = right)
    let shotZone;
    if (a.x < GOAL.left + GOAL_W / 3) shotZone = 0;
    else if (a.x < GOAL.left + (2 * GOAL_W) / 3) shotZone = 1;
    else shotZone = 2;

    const cornerness = Math.abs(a.x - W / 2) / (GOAL_W / 2); // 0 centre .. 1 corner
    const height = (KEEPER_Y - a.y) / (KEEPER_Y - GOAL.top);  // higher shot -> closer to 1

    if (shotZone === keeperZone) {
      // Keeper is in the right area — but power + placement can still beat them
      const beatChance = 0.18 + pw * 0.32 + cornerness * 0.28 + Math.max(0, height) * 0.15;
      if (rand() < beatChance) return { type: "goal", squeak: true };
      return { type: "save" };
    }
    // Keeper went the wrong way — almost certain goal, tiny chance of a great recovery
    if (rand() < 0.04) return { type: "save", stretch: true };
    return { type: "goal" };
  }

  function finishShot() {
    state = "result";
    resultTimer = 90;
    if (shotResult.type === "goal") {
      goals++; streak++; best = Math.max(best, streak);
      spawnConfetti(ball.x, ball.y);
      hint.textContent = shotResult.squeak ? "⚽ GOAL! Squeezed past the keeper!" : "⚽ GOAL! Top finish!";
    } else if (shotResult.type === "save") {
      streak = 0;
      hint.textContent = "🧤 Saved! The keeper reads it.";
    } else {
      streak = 0;
      hint.textContent = "😬 Just wide of the post!";
    }
    updateHud();
  }

  function nextOrEnd() {
    if (shots >= 5) {
      state = "ready";
      overlayTitle.textContent = `Full time — ${goals}/5 scored`;
      overlayText.textContent =
        goals === 5 ? "Perfect shootout! You're on the JP Mentors teamsheet. 🏆"
        : goals >= 3 ? "Great shooting — play again to go perfect?"
        : "Keep practising — hit the corners with power!";
      startBtn.textContent = "Play again";
      overlay.classList.remove("hidden");
    } else {
      beginAim();
    }
  }

  function updateHud() {
    elGoals.textContent = goals;
    elShots.textContent = shots;
    elStreak.textContent = streak;
  }

  // ---- Simple deterministic-ish RNG (no Date/Math.random ban concerns in browser) ----
  function rand() { return Math.random(); }

  // ---- Confetti particles ----
  function spawnConfetti(x, y) {
    const colors = ["#d6353b", "#ffffff", "#16181d", "#ffcf33"];
    for (let i = 0; i < 34; i++) {
      particles.push({
        x, y,
        vx: (rand() - 0.5) * 7,
        vy: -rand() * 7 - 2,
        life: 60 + rand() * 20,
        c: colors[(rand() * colors.length) | 0],
        s: 3 + rand() * 4
      });
    }
  }

  // ===================================================================
  // Drawing
  // ===================================================================
  function draw() {
    // Pitch
    const gg = ctx.createLinearGradient(0, 0, 0, H);
    gg.addColorStop(0, "#3a9a41");
    gg.addColorStop(1, "#2e7d32");
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, W, H);

    // Mowing stripes
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    for (let i = 0; i < 8; i++) if (i % 2 === 0) ctx.fillRect(0, 40 + i * 44, W, 44);

    drawGoal();
    drawPenaltyArc();
    drawKeeper();
    drawParticles();
    if (state === "aim" || state === "charging") drawAim();
    drawBall();
    if (state === "charging" || state === "aim") drawPowerBar();
  }

  function drawGoal() {
    const { left, right, top, bottom } = GOAL;
    // Net
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    const step = 13;
    ctx.beginPath();
    for (let x = left; x <= right; x += step) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
    for (let y = top; y <= bottom; y += step) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
    ctx.stroke();
    ctx.restore();

    // Posts + crossbar
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(left - 8, top, 8, bottom - top + 8);
    ctx.fillRect(right, top, 8, bottom - top + 8);
    ctx.fillRect(left - 8, top - 8, right - left + 16, 8);
  }

  function drawPenaltyArc() {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    ctx.strokeRect(70, GOAL.bottom + 8, W - 140, 150);
    ctx.beginPath();
    ctx.arc(W / 2, GOAL.bottom + 40, 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fill();
  }

  function drawKeeper() {
    // Animate dive toward target when committed
    if (keeper.committed) keeper.x += (keeper.targetX - keeper.x) * 0.18;
    const x = keeper.x, y = keeper.y;
    const diving = Math.abs(keeper.x - W / 2) > 20 && keeper.committed;
    ctx.save();
    ctx.translate(x, y);
    if (diving) ctx.rotate((keeper.targetX < W / 2 ? -1 : 1) * 0.5);
    // Kit (yellow keeper)
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(-13, -6, 26, 30);        // body
    // arms outstretched
    ctx.fillRect(-30, -2, 60, 8);
    ctx.fillStyle = "#1b3a2a";            // gloves
    ctx.fillRect(-34, -3, 8, 10);
    ctx.fillRect(26, -3, 8, 10);
    // head
    ctx.beginPath(); ctx.fillStyle = "#f0c9a0";
    ctx.arc(0, -16, 9, 0, Math.PI * 2); ctx.fill();
    // legs
    ctx.fillStyle = "#16181d";
    ctx.fillRect(-11, 22, 8, 16);
    ctx.fillRect(3, 22, 8, 16);
    ctx.restore();
  }

  function drawAim() {
    ctx.save();
    ctx.translate(aim.x, aim.y);
    const pulse = 12 + Math.sin(Date.now() / 180) * 2;
    ctx.strokeStyle = "rgba(214,53,59,0.95)";
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-pulse - 5, 0); ctx.lineTo(pulse + 5, 0);
    ctx.moveTo(0, -pulse - 5); ctx.lineTo(0, pulse + 5);
    ctx.stroke();
    ctx.restore();

    // Guide line from ball to aim
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(aim.x, aim.y); ctx.stroke();
    ctx.restore();
  }

  function drawBall() {
    ctx.save();
    ctx.translate(ball.x, ball.y);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.ellipse(0, ball.r * 0.8, ball.r, ball.r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    // ball
    ctx.rotate(ball.spin * ball.t * 0.3);
    ctx.beginPath(); ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = "#fbfbfb"; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#c7c7c7"; ctx.stroke();
    // pentagon accents
    ctx.fillStyle = "#16181d";
    ctx.beginPath(); ctx.arc(0, 0, ball.r * 0.32, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * ball.r * 0.62, Math.sin(ang) * ball.r * 0.62, ball.r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPowerBar() {
    const bx = 30, by = H - 30, bw = 150, bh = 12;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, "#4caf50"); grad.addColorStop(0.6, "#ffd23f"); grad.addColorStop(1, "#d6353b");
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, bw * (power / 100), bh);
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = "#fff"; ctx.font = "600 11px 'Space Grotesk', sans-serif";
    ctx.fillText("POWER", bx, by - 8);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 70);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }

  // ===================================================================
  // Update loop
  // ===================================================================
  function update() {
    if (state === "charging") {
      power += powerDir * 2.4;
      if (power >= 100) { power = 100; powerDir = -1; }
      if (power <= 0) { power = 0; powerDir = 1; }
    }

    if (state === "shooting" && ball.flying) {
      ball.t++;
      const p = Math.min(1, ball.t / ball.dur);
      const ease = 1 - Math.pow(1 - p, 2);
      ball.x = ball.sx + (ball.tx - ball.sx) * ease;
      ball.y = ball.sy + (ball.ty - ball.sy) * ease;
      ball.r = 15 - 7 * ease; // perspective shrink
      if (p >= 1) { ball.flying = false; finishShot(); }
    }

    if (state === "result") {
      resultTimer--;
      if (resultTimer <= 0) nextOrEnd();
    }

    // particles
    for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life--; }
    particles = particles.filter((p) => p.life > 0);
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  startBtn.addEventListener("click", startGame);
  loop();
})();
