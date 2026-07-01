(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const screen = canvas.parentElement;
  const ui = {
    score: document.getElementById("score"),
    wave: document.getElementById("wave"),
    highScore: document.getElementById("highScore"),
    lives: document.getElementById("lives"),
    start: document.getElementById("startScreen"),
    message: document.getElementById("messageScreen"),
    pause: document.getElementById("pauseScreen"),
    messageKicker: document.getElementById("messageKicker"),
    messageTitle: document.getElementById("messageTitle"),
    finalMetricLabel: document.getElementById("finalMetricLabel"),
    finalScore: document.getElementById("finalScore"),
    restartButton: document.getElementById("restartButton"),
    changeSeasonButton: document.getElementById("changeSeasonButton"),
    pauseButton: document.getElementById("pauseButton"),
    soundButton: document.getElementById("soundButton"),
  };
  const pauseButtons = document.querySelectorAll("[data-pause-trigger]");
  const backgroundMusic = document.getElementById("backgroundMusic");
  backgroundMusic.volume = 1;
  const sessionId =
    window.crypto?.randomUUID?.() ||
    `ri_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

  const images = {
    winter: new Image(),
    summer: new Image(),
    red: new Image(),
    purple: new Image(),
    blue: new Image(),
    black: new Image(),
    grey: new Image(),
    brown: new Image(),
  };
  images.winter.src = "assets/winter-icon.svg";
  images.summer.src = "assets/summer-icon.svg";
  images.red.src = "assets/red-gold-container.svg?v=asset-fixes-1";
  images.purple.src = "assets/purple-gold-container.svg?v=violet-lid-1";
  images.blue.src = "assets/blue-gold-container.svg?v=container-perspective-1";
  images.black.src = "assets/black-narrow-container.svg?v=asset-fixes-1";
  images.grey.src = "assets/grey-rectangle-container.svg?v=container-perspective-1";
  images.brown.src = "assets/brown-wide-container.svg?v=container-perspective-1";

  const colors = {
    winter: "#83d5ff",
    summer: "#ffb43b",
    red: "#ff5e55",
    purple: "#b46cff",
    blue: "#39aee8",
    black: "#b8bec5",
    grey: "#d3d7da",
    brown: "#b67542",
    danger: "#ff5e55",
    white: "#f5f1e8",
  };

  const challengerRoster = [
    { key: "purple", name: "VIOLET" },
    { key: "blue", name: "BLUE" },
    { key: "grey", name: "GREY" },
    { key: "brown", name: "BROWN" },
    { key: "black", name: "BLACK" },
    { key: "red", name: "RED" },
  ];

  const bossTraits = {
    purple: { health: -2, speed: 0.82, cadence: 1.35, points: 450 },
    blue: { health: 0, speed: 0.95, cadence: 1.05, points: 520 },
    grey: { health: 5, speed: 0.7, cadence: 1.45, points: 650 },
    brown: { health: 2, speed: 0.78, cadence: 1.2, points: 600 },
    black: { health: 1, speed: 1.05, cadence: 0.95, points: 700 },
    red: { health: 0, speed: 1.15, cadence: 1.15, points: 620 },
  };

  const keys = { left: false, right: false, fire: false };
  const game = {
    width: 800,
    height: 600,
    state: "menu",
    season: "winter",
    enemySeason: "purple",
    enemyName: "VIOLET",
    score: 0,
    highScore: Number(localStorage.getItem("rosinInvadersHighScore")) || 0,
    bestTime: Number(localStorage.getItem("rosinInvadersBestTime")) || 0,
    runStartTime: 0,
    runElapsed: 0,
    completionTime: 0,
    wave: 1,
    stage: "wave",
    pendingStage: "wave",
    lives: 3,
    lastTime: 0,
    enemyDirection: 1,
    enemySpeed: 32,
    enemyShootTimer: 1,
    waveDelay: 0,
    shake: 0,
    enemyShake: 0,
    stars: [],
    bullets: [],
    enemyBullets: [],
    enemies: [],
    boss: null,
    bossDecoys: [],
    powderClouds: [],
    particles: [],
    orb: null,
    orbDropped: false,
    initialEnemyCount: 0,
    poweredUp: false,
    completedCycle: false,
    player: null,
    audio: null,
    soundOn: true,
  };

  function formatScore(value) {
    return String(value).padStart(6, "0");
  }

  function formatDuration(ms) {
    const totalCentiseconds = Math.max(0, Math.floor(ms / 10));
    const centiseconds = totalCentiseconds % 100;
    const totalSeconds = Math.floor(totalCentiseconds / 100);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
      centiseconds
    ).padStart(2, "0")}`;
  }

  function track(eventName, properties = {}) {
    if (!window.posthog || typeof window.posthog.capture !== "function") return;

    window.posthog.capture(eventName, {
      app: "rosin_invaders",
      surface: "game",
      session_id: sessionId,
      season: game.season,
      wave: game.wave,
      stage: game.stage,
      score: game.score,
      elapsed_seconds: Number(game.runElapsed.toFixed(2)),
      viewport_width: Math.round(game.width),
      viewport_height: Math.round(game.height),
      sound_on: game.soundOn,
      ...properties,
    });
  }

  function updateUI() {
    ui.score.textContent = formatDuration(game.runElapsed * 1000);
    ui.wave.textContent = String(game.wave).padStart(2, "0");
    ui.highScore.textContent = game.bestTime ? formatDuration(game.bestTime) : "--:--.--";
    ui.lives.textContent = Array.from({ length: game.lives }, () => "●").join(" ") || "—";
  }

  function resizeCanvas() {
    const rect = screen.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    game.width = rect.width;
    game.height = rect.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    if (game.player) {
      game.player.y = game.height - Math.max(52, game.height * 0.09);
      game.player.x = Math.min(game.player.x, game.width - game.player.w);
    }
    createStars();
  }

  function createStars() {
    const targetCount = Math.max(35, Math.floor((game.width * game.height) / 7000));
    game.stars = Array.from({ length: targetCount }, (_, index) => ({
      x: Math.random() * game.width,
      y: Math.random() * game.height,
      size: index % 8 === 0 ? 1.6 : 0.8,
      alpha: 0.16 + Math.random() * 0.42,
      speed: 2 + Math.random() * 7,
    }));
  }

  function resetPlayer() {
    const size = Math.max(42, Math.min(58, game.width * 0.075)) * 0.76;
    game.player = {
      x: game.width / 2 - size / 2,
      y: game.height - Math.max(52, game.height * 0.09),
      w: size,
      h: size,
      speed: Math.max(240, game.width * 0.42),
      cooldown: 0,
      invulnerable: 1.6,
    };
  }

  function setWaveOpponent() {
    const challenger = challengerRoster[(game.wave - 1) % challengerRoster.length];
    game.enemySeason = challenger.key;
    game.enemyName = challenger.name;
  }

  function addScore(points) {
    game.score += points;
    if (game.score > game.highScore) {
      game.highScore = game.score;
      localStorage.setItem("rosinInvadersHighScore", String(game.highScore));
    }
    updateUI();
  }

  function spawnQueuedStage() {
    if (game.pendingStage === "boss") {
      spawnBoss();
    } else {
      spawnWave();
    }
  }

  function spawnWave() {
    setWaveOpponent();
    game.stage = "wave";
    game.pendingStage = "wave";
    game.enemies = [];
    game.boss = null;
    game.bossDecoys = [];
    game.powderClouds = [];
    game.enemyBullets = [];
    game.enemyDirection = 1;
    game.enemyShootTimer = 0.8;
    game.orb = null;
    game.orbDropped = false;
    game.poweredUp = false;

    const columns = game.width < 520 ? 7 : 9;
    const rows = Math.min(5, 3 + Math.floor((game.wave - 1) / 2));
    const gapRatio = 0.48;
    const formationRatio = game.width < 520 ? 0.76 : 0.82;
    const targetFormationWidth = game.width * formationRatio;
    const enemySize = Math.max(
      24,
      Math.min(43, targetFormationWidth / (columns + (columns - 1) * gapRatio))
    );
    const gapX = enemySize * gapRatio;
    const gapY = enemySize * 0.42;
    const formationWidth = columns * enemySize + (columns - 1) * gapX;
    const startX = (game.width - formationWidth) / 2;
    const startY = Math.max(40, game.height * 0.09);
    const horizontalRunway = Math.max(40, game.width - 24 - formationWidth);
    const passDuration = Math.max(3.2, 6.2 - game.wave * 0.18);
    game.enemySpeed = horizontalRunway / passDuration;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        game.enemies.push({
          x: startX + column * (enemySize + gapX),
          y: startY + row * (enemySize + gapY),
          w: enemySize,
          h: enemySize,
          row,
          column,
          points: (rows - row) * 10,
          alive: true,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
    game.initialEnemyCount = game.enemies.length;
    track("rosin_invaders_wave_started", {
      opponent: game.enemySeason,
      opponent_name: game.enemyName,
      enemy_count: game.initialEnemyCount,
    });
  }

  function spawnBoss() {
    setWaveOpponent();
    const trait = bossTraits[game.enemySeason];
    const size = Math.max(72, Math.min(118, game.width * 0.18));
    const maxHealth = Math.max(7, 10 + Math.floor(game.wave * 1.45) + trait.health) * 2;
    game.stage = "boss";
    game.pendingStage = "boss";
    game.enemies = [];
    game.enemyBullets = [];
    game.bossDecoys = [];
    game.powderClouds = [];
    game.orb = null;
    game.poweredUp = false;
    game.enemyDirection = 1;
    game.enemyShootTimer = Math.max(0.55, trait.cadence - game.wave * 0.025);
    game.enemySpeed = Math.max(45, Math.min(118, game.width * 0.12 * trait.speed));
    game.boss = {
      key: game.enemySeason,
      form: game.enemySeason,
      x: game.width / 2 - size / 2,
      y: Math.max(38, game.height * 0.1),
      baseY: Math.max(38, game.height * 0.1),
      w: size,
      h: size,
      health: maxHealth,
      maxHealth,
      age: 0,
      phase: Math.random() * Math.PI * 2,
      modeTimer: 0,
      unavailableTimer: -1.8,
      shieldDeployed: false,
      shieldPieces: [],
      supplyCount: 0,
      supplyTruck: null,
      points: trait.points + game.wave * 45,
    };
    track("rosin_invaders_boss_started", {
      opponent: game.enemySeason,
      opponent_name: game.enemyName,
      boss_health: game.boss.maxHealth,
    });
  }

  function startGame(season) {
    game.season = season;
    game.score = 0;
    game.runStartTime = performance.now();
    game.runElapsed = 0;
    game.completionTime = 0;
    game.wave = 1;
    game.stage = "wave";
    game.pendingStage = "wave";
    game.lives = 3;
    game.bullets = [];
    game.enemyBullets = [];
    game.boss = null;
    game.bossDecoys = [];
    game.powderClouds = [];
    game.particles = [];
    game.orb = null;
    game.poweredUp = false;
    game.completedCycle = false;
    game.waveDelay = 0;
    game.shake = 0;
    game.enemyShake = 0;
    resetPlayer();
    spawnWave();
    game.state = "playing";
    ui.start.classList.remove("visible");
    ui.message.classList.remove("visible");
    ui.pause.classList.remove("visible");
    ui.finalMetricLabel.textContent = "SCORE";
    ui.restartButton.textContent = "PLAY AGAIN";
    ui.changeSeasonButton.textContent = "CHANGE SEASON";
    pauseButtons.forEach((button) => {
      button.textContent = "PAUSE";
    });
    updateUI();
    syncBackgroundMusic();
    track("rosin_invaders_game_started", {
      selected_season: season,
    });
    playTone(185, 0.12, "square", 0.035);
    playTone(275, 0.12, "square", 0.025, 0.09);
  }

  function restartGame() {
    startGame(game.season);
  }

  function continueHighScoreRun() {
    game.state = "playing";
    ui.message.classList.remove("visible");
    ui.pause.classList.remove("visible");
    ui.restartButton.textContent = "PLAY AGAIN";
    game.completedCycle = false;
    game.runElapsed = 0;
    game.completionTime = 0;
    spawnWave();
    updateUI();
    syncBackgroundMusic();
  }

  function returnToMenu() {
    game.state = "menu";
    game.bullets = [];
    game.enemyBullets = [];
    game.enemies = [];
    game.boss = null;
    game.bossDecoys = [];
    game.powderClouds = [];
    game.orb = null;
    game.poweredUp = false;
    game.completedCycle = false;
    game.shake = 0;
    game.enemyShake = 0;
    ui.message.classList.remove("visible");
    ui.pause.classList.remove("visible");
    ui.start.classList.add("visible");
    syncBackgroundMusic();
  }

  function togglePause(forceResume = false) {
    if (game.state === "playing") {
      game.state = "paused";
      ui.pause.classList.add("visible");
      pauseButtons.forEach((button) => {
        button.textContent = "RESUME";
      });
      track("rosin_invaders_paused");
    } else if (game.state === "paused" || forceResume) {
      game.state = "playing";
      game.lastTime = performance.now();
      ui.pause.classList.remove("visible");
      pauseButtons.forEach((button) => {
        button.textContent = "PAUSE";
      });
      track("rosin_invaders_resumed");
    }
    syncBackgroundMusic();
  }

  function shoot() {
    if (game.state !== "playing" || !game.player || game.player.cooldown > 0) return;
    const p = game.player;
    const bulletSpeed = Math.max(440, game.height * 0.92);
    const addBullet = (x, vx = 0) => {
      game.bullets.push({
        x,
        y: p.y - 9,
        w: 4,
        h: 14,
        speed: bulletSpeed,
        vx,
      });
    };

    if (game.poweredUp) {
      addBullet(p.x + p.w / 2 - 2, -125);
      addBullet(p.x + p.w / 2 - 2);
      addBullet(p.x + p.w / 2 - 2, 125);
    } else {
      addBullet(p.x + p.w / 2 - 2);
    }

    p.cooldown = 0.25;
    playTone(game.season === "winter" ? 520 : 430, 0.055, "square", 0.025);
  }

  function getCompanion() {
    const p = game.player;
    const size = p.w;
    const gap = Math.max(6, p.w * 0.12);
    const rightX = p.x + p.w + gap;
    const x = rightX + size <= game.width - 8 ? rightX : p.x - size - gap;
    return {
      x,
      y: p.y + p.h - size,
      w: size,
      h: size,
    };
  }

  function dropPowerOrb(enemy) {
    const size = Math.max(20, Math.min(30, game.width * 0.038));
    game.orb = {
      x: enemy.x + enemy.w / 2 - size / 2,
      y: enemy.y + enemy.h / 2 - size / 2,
      baseX: enemy.x + enemy.w / 2 - size / 2,
      w: size,
      h: size,
      speed: Math.max(125, game.height * 0.24),
      phase: Math.random() * Math.PI * 2,
    };
    game.orbDropped = true;
  }

  function collectPowerOrb() {
    game.poweredUp = true;
    burst(
      game.player.x + game.player.w / 2,
      game.player.y + game.player.h / 2,
      game.season === "winter" ? colors.red : colors.summer,
      28
    );
    game.orb = null;
    playTone(660, 0.12, "sine", 0.035);
    playTone(880, 0.18, "sine", 0.03, 0.1);
    track("rosin_invaders_power_orb_collected", {
      companion: game.season === "winter" ? "summer" : "winter",
    });
  }

  function enemyShoot() {
    const bottomByColumn = new Map();
    for (const enemy of game.enemies) {
      if (!enemy.alive) continue;
      const current = bottomByColumn.get(enemy.column);
      if (!current || enemy.y > current.y) bottomByColumn.set(enemy.column, enemy);
    }
    const shooters = [...bottomByColumn.values()];
    if (!shooters.length) return;
    const enemy = shooters[Math.floor(Math.random() * shooters.length)];
    game.enemyBullets.push({
      x: enemy.x + enemy.w / 2 - 2,
      y: enemy.y + enemy.h,
      w: 4,
      h: 13,
      speed: Math.min(330, 155 + game.wave * 14),
    });
  }

  function intersects(a, b, padding = 0) {
    return (
      a.x + padding < b.x + b.w - padding &&
      a.x + a.w - padding > b.x + padding &&
      a.y + padding < b.y + b.h - padding &&
      a.y + a.h - padding > b.y + padding
    );
  }

  function circleIntersectsEntity(circle, entity) {
    const closestX = Math.max(entity.x, Math.min(circle.x, entity.x + entity.w));
    const closestY = Math.max(entity.y, Math.min(circle.y, entity.y + entity.h));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy <= circle.radius * circle.radius;
  }

  function burst(x, y, color, count = 12) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 130;
      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        size: 1 + Math.random() * 3,
        color,
      });
    }
  }

  function destroyEnemy(enemy) {
    enemy.alive = false;
    addScore(enemy.points);
    burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, colors[game.enemySeason], 15);
    game.enemyShake = 0.12;
    playTone(150 + enemy.row * 25, 0.08, "sawtooth", 0.022);

    const livingCount = game.enemies.reduce(
      (count, candidate) => count + Number(candidate.alive),
      0
    );
    if (
      !game.orbDropped &&
      livingCount <= Math.floor(game.initialEnemyCount / 2)
    ) {
      dropPowerOrb(enemy);
    }
  }

  function isBossUnavailable() {
    return game.boss?.key === "black" && game.boss.unavailableTimer > 0;
  }

  function spawnBossDecoys() {
    const boss = game.boss;
    if (!boss) return;
    game.bossDecoys = Array.from({ length: 2 }, (_, index) => ({
      x: Math.max(
        12,
        Math.min(game.width - boss.w - 12, boss.x + (index === 0 ? -1 : 1) * boss.w * 0.95)
      ),
      y: boss.y + 8 + Math.random() * 16,
      w: boss.w,
      h: boss.h,
      life: 0.9,
      form: Math.random() > 0.5 ? "black" : "brown",
    }));
  }

  function spawnPowderCloud(x, y, options = {}) {
    const radius = options.radius || Math.max(16, Math.min(26, game.width * 0.034));
    const life = options.life || 1.45;
    game.powderClouds.push({
      x,
      y,
      radius,
      maxRadius: radius * (options.spread || 3.2),
      vx: options.vx ?? -18 + Math.random() * 36,
      vy: options.vy ?? -6 + Math.random() * 12,
      life,
      maxLife: life,
      phase: Math.random() * Math.PI * 2,
      harmful: Boolean(options.harmful),
    });
  }

  function popPowderCrystal(crystal) {
    const x = crystal.x + crystal.w / 2;
    const y = crystal.y + crystal.h / 2;
    spawnPowderCloud(x, y, {
      radius: Math.max(18, crystal.w * 0.72),
      spread: 3.8,
      life: 1.35,
      harmful: false,
    });
    burst(x, y, "#ffd8c4", 26);
    burst(x, y, colors.red, 18);
    playTone(175, 0.07, "sawtooth", 0.018);
  }

  function usesSwedishShield(boss) {
    return boss?.key === "purple" || boss?.key === "blue";
  }

  function deploySwedishShield(boss) {
    const size = Math.max(18, Math.min(28, boss.w * 0.22));
    const spacing = size * 1.05;
    const y = boss.h * 0.9;
    boss.shieldDeployed = true;
    boss.shieldPieces = [-2, -1, 0, 1, 2].map((slot) => ({
      offsetX: slot * spacing,
      offsetY: y - Math.abs(slot) * size * 0.22,
      size,
      alive: true,
    }));
    burst(boss.x + boss.w / 2, boss.y + boss.h * 0.8, colors[boss.key], 16);
    playTone(620, 0.1, "square", 0.018);
    playTone(740, 0.12, "square", 0.016, 0.08);
  }

  function getShieldPieceBounds(boss, piece) {
    const x = boss.x + boss.w / 2 + piece.offsetX - piece.size / 2;
    const y = boss.y + piece.offsetY - piece.size / 2;
    return { x, y, w: piece.size, h: piece.size };
  }

  function bossDamageMultiplier() {
    const boss = game.boss;
    if (!boss) return 1;
    if (boss.key === "grey") return 1 + Math.min(2, Math.floor(boss.age / 6));
    return 1;
  }

  function damageBoss(bullet) {
    const boss = game.boss;
    if (!boss || isBossUnavailable()) return;
    bullet.dead = true;
    boss.health = Math.max(0, boss.health - bossDamageMultiplier());
    game.enemyShake = 0.08;
    burst(bullet.x + bullet.w / 2, bullet.y, colors[boss.form || boss.key], 5);
    playTone(115 + boss.health * 9, 0.045, "sawtooth", 0.016);
    if (boss.health <= 0) defeatBoss();
  }

  function defeatBoss() {
    const boss = game.boss;
    if (!boss) return;
    const defeatedKey = boss.key;
    const quickBonus = boss.key === "grey" && boss.age < 8 ? 250 : 0;
    addScore(boss.points + quickBonus);
    burst(boss.x + boss.w / 2, boss.y + boss.h / 2, colors[boss.form || boss.key], 44);
    game.enemyShake = 0.32;
    game.boss = null;
    game.bossDecoys = [];
    game.powderClouds = [];
    game.bullets = [];
    game.enemyBullets = [];
    game.wave += 1;
    setWaveOpponent();
    game.stage = "wave";
    game.pendingStage = "wave";
    game.waveDelay = defeatedKey === "red" && !game.completedCycle ? 0 : 1.45;
    game.poweredUp = false;
    updateUI();

    track("rosin_invaders_boss_defeated", {
      opponent: defeatedKey,
      next_wave: game.wave,
      quick_bonus: quickBonus,
    });

    if (defeatedKey === "red" && !game.completedCycle) {
      showCompletionScreen();
      return;
    }

    playTone(260, 0.09, "square", 0.025);
    playTone(390, 0.11, "square", 0.025, 0.1);
    playTone(585, 0.16, "square", 0.025, 0.22);
  }

  function bossShoot() {
    const boss = game.boss;
    const p = game.player;
    if (!boss || !p || isBossUnavailable()) return;
    const cx = boss.x + boss.w / 2;
    const cy = boss.y + boss.h;
    const aimedVx = Math.max(-130, Math.min(130, (p.x + p.w / 2 - cx) / 1.25));
    const addBullet = (x, speed, vx = 0, w = 5, h = 15, extra = {}) => {
      game.enemyBullets.push({ x, y: cy, w, h, speed, vx, ...extra });
    };

    if (boss.key === "red") {
      const size = Math.max(18, Math.min(28, boss.w * 0.22));
      addBullet(cx - size / 2, 125 + game.wave * 7, aimedVx * 0.28, size, size, {
        type: "powderCrystal",
        phase: Math.random() * Math.PI * 2,
      });
      if (boss.health < boss.maxHealth * 0.55) {
        addBullet(cx + boss.w * 0.24 - size / 2, 138 + game.wave * 7, 34, size, size, {
          type: "powderCrystal",
          phase: Math.random() * Math.PI * 2,
        });
        addBullet(cx - boss.w * 0.24 - size / 2, 138 + game.wave * 7, -34, size, size, {
          type: "powderCrystal",
          phase: Math.random() * Math.PI * 2,
        });
      }
      return;
    }

    if (boss.key === "purple") {
      if (Math.random() < 0.24) {
        burst(cx, cy, colors.purple, 4);
        return;
      }
      addBullet(cx - 2, 185 + game.wave * 8, aimedVx * 0.55, 5, 16);
      return;
    }

    if (boss.key === "blue") {
      addBullet(cx - 2, 205 + game.wave * 8, aimedVx, 5, 16);
      return;
    }

    if (boss.key === "grey") {
      const fizzle = Math.random() < 0.5;
      addBullet(cx - 4, 150 + game.wave * 5, aimedVx * 0.45, 8, 19, {
        type: fizzle ? "fizzle" : "heavy",
        fizzleAt: fizzle ? 0.48 + Math.random() * 0.42 : Infinity,
        age: 0,
      });
      return;
    }

    if (boss.key === "brown" && boss.form === "black") {
      addBullet(cx - boss.w * 0.18, 225 + game.wave * 8, -30, 4, 16);
      addBullet(cx + boss.w * 0.18, 225 + game.wave * 8, 30, 4, 16);
      return;
    }

    if (boss.key === "brown") {
      addBullet(cx - boss.w * 0.25, 160 + game.wave * 6, -35, 8, 18);
      addBullet(cx - 4, 168 + game.wave * 6, 0, 8, 18);
      addBullet(cx + boss.w * 0.25, 160 + game.wave * 6, 35, 8, 18);
      return;
    }

    addBullet(cx - 2, 235 + game.wave * 8, aimedVx * 0.65, 4, 16);
  }

  function nextBossShotDelay() {
    const boss = game.boss;
    if (!boss) return 1;
    const trait = bossTraits[boss.key];
    let delay = Math.max(0.38, trait.cadence - game.wave * 0.035);
    if (boss.key === "red" && boss.health < boss.maxHealth * 0.55) delay *= 0.72;
    if (boss.key === "brown" && boss.form === "black") delay *= 0.78;
    if (boss.key === "grey" && boss.age > 10) delay *= 1.15;
    return delay * (0.85 + Math.random() * 0.35);
  }

  function updateBoss(dt) {
    const boss = game.boss;
    if (!boss) return;
    boss.age += dt;
    boss.phase += dt * 2.7;
    boss.modeTimer += dt;

    if (boss.key === "black") {
      boss.unavailableTimer -= dt;
      if (boss.unavailableTimer <= -2.6) {
        boss.unavailableTimer = 0.82;
        spawnBossDecoys();
      }
    }

    if (boss.key === "brown" && boss.modeTimer > 4.2) {
      boss.modeTimer = 0;
      boss.form = boss.form === "brown" ? "black" : "brown";
      if (boss.form === "brown") boss.baseY += Math.max(8, game.height * 0.018);
      burst(boss.x + boss.w / 2, boss.y + boss.h / 2, colors[boss.form], 10);
    }

    if (
      usesSwedishShield(boss) &&
      !boss.shieldDeployed &&
      boss.health <= boss.maxHealth / 2
    ) {
      deploySwedishShield(boss);
    }

    const deliveryThresholds = [0.5, 0.34];
    if (
      boss.key === "red" &&
      !boss.supplyTruck &&
      boss.supplyCount < deliveryThresholds.length &&
      boss.health <= boss.maxHealth * deliveryThresholds[boss.supplyCount]
    ) {
      const size = Math.max(34, Math.min(54, boss.w * 0.42));
      boss.supplyCount += 1;
      boss.supplyTruck = {
        x: -size * 1.4,
        y: boss.y + boss.h * 0.34,
        size,
        speed: Math.max(180, game.width * 0.42),
        delivered: false,
      };
    }

    if (boss.supplyTruck) {
      const truck = boss.supplyTruck;
      truck.y = boss.y + boss.h * 0.34 + Math.sin(boss.age * 8) * 2;
      truck.x += truck.speed * dt;
      if (!truck.delivered && truck.x + truck.size * 0.5 >= boss.x + boss.w / 2) {
        truck.delivered = true;
        boss.health = boss.maxHealth;
        burst(boss.x + boss.w / 2, boss.y + boss.h / 2, colors.red, 28);
        playTone(220, 0.08, "square", 0.018);
        playTone(330, 0.1, "square", 0.016, 0.08);
      }
      if (truck.x > game.width + truck.size * 1.5) boss.supplyTruck = null;
    }

    let speed = game.enemySpeed;
    if (boss.key === "brown" && boss.form === "black") speed *= 1.28;
    if (boss.key === "red" && boss.health < boss.maxHealth * 0.55) speed *= 1.32;

    boss.x += game.enemyDirection * speed * dt;
    if (boss.x < 12 || boss.x + boss.w > game.width - 12) {
      game.enemyDirection *= -1;
      boss.x = Math.max(12, Math.min(game.width - boss.w - 12, boss.x));
      if (boss.key === "brown") boss.baseY += Math.max(6, game.height * 0.012);
    }
    boss.y = boss.baseY + Math.sin(boss.phase) * Math.max(5, boss.h * 0.08);

    for (const decoy of game.bossDecoys) decoy.life -= dt;
    game.bossDecoys = game.bossDecoys.filter((decoy) => decoy.life > 0);
  }

  function updatePowderClouds(dt) {
    for (const cloud of game.powderClouds) {
      cloud.phase += dt * 2.3;
      cloud.x += (cloud.vx + Math.sin(cloud.phase) * 12) * dt;
      cloud.y += cloud.vy * dt;
      cloud.radius = Math.min(cloud.maxRadius, cloud.radius + dt * 16);
      cloud.life -= dt;
    }
    game.powderClouds = game.powderClouds.filter(
      (cloud) => cloud.life > 0 && cloud.y - cloud.radius < game.height + 12
    );
  }

  function updateBossStage(dt, player) {
    updateBoss(dt);
    updatePowderClouds(dt);

    game.enemyShootTimer -= dt;
    if (game.enemyShootTimer <= 0) {
      bossShoot();
      game.enemyShootTimer = nextBossShotDelay();
    }

    for (const bullet of game.bullets) {
      if (bullet.dead) continue;

      for (const cloud of game.powderClouds) {
        if (cloud.harmful && !bullet.dead && circleIntersectsEntity(cloud, bullet)) {
          bullet.dead = true;
          cloud.life -= 0.9;
          burst(bullet.x, bullet.y, "rgba(255, 190, 160, 0.9)", 3);
        }
      }

      for (const enemyBullet of game.enemyBullets) {
        if (
          enemyBullet.type === "powderCrystal" &&
          !enemyBullet.dead &&
          !bullet.dead &&
          intersects(bullet, enemyBullet, enemyBullet.w * 0.1)
        ) {
          bullet.dead = true;
          enemyBullet.dead = true;
          popPowderCrystal(enemyBullet);
        }
      }

      for (const decoy of game.bossDecoys) {
        if (!bullet.dead && intersects(bullet, decoy, decoy.w * 0.16)) {
          bullet.dead = true;
          decoy.life = 0;
          burst(decoy.x + decoy.w / 2, decoy.y + decoy.h / 2, colors[decoy.form], 12);
        }
      }

      if (game.boss && !bullet.dead) {
        for (const piece of game.boss.shieldPieces) {
          if (!piece.alive) continue;
          const bounds = getShieldPieceBounds(game.boss, piece);
          if (intersects(bullet, bounds, bounds.w * 0.08)) {
            bullet.dead = true;
            piece.alive = false;
            burst(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, colors[game.boss.key], 10);
            playTone(520, 0.05, "square", 0.014);
            break;
          }
        }
      }

      if (game.boss && !bullet.dead && intersects(bullet, game.boss, game.boss.w * 0.14)) {
        damageBoss(bullet);
      }
    }

    for (const bullet of game.enemyBullets) {
      if (!bullet.dead && intersects(bullet, player, player.w * 0.16)) {
        bullet.dead = true;
        hitPlayer();
      }
    }

    for (const cloud of game.powderClouds) {
      if (cloud.harmful && circleIntersectsEntity(cloud, player)) {
        cloud.life = 0;
        hitPlayer();
      }
    }

    game.bullets = game.bullets.filter(
      (bullet) =>
        !bullet.dead &&
        bullet.y + bullet.h > 0 &&
        bullet.x + bullet.w > 0 &&
        bullet.x < game.width
    );
    game.enemyBullets = game.enemyBullets.filter(
      (bullet) => !bullet.dead && bullet.y < game.height + bullet.h
    );

    if (game.boss && game.boss.y + game.boss.h >= player.y + 4) {
      endGame("INVASION COMPLETE", `${game.enemyName} took over.`);
    }
  }

  function hitPlayer() {
    if (!game.player || game.player.invulnerable > 0) return;
    game.lives -= 1;
    burst(
      game.player.x + game.player.w / 2,
      game.player.y + game.player.h / 2,
      colors[game.season],
      26
    );
    game.shake = 0.32;
    game.poweredUp = false;
    game.orb = null;
    playTone(90, 0.28, "sawtooth", 0.045);
    updateUI();

    if (game.lives <= 0) {
      endGame("GAME OVER", "Season defeated.");
      return;
    }

    game.player.x = game.width / 2 - game.player.w / 2;
    game.player.invulnerable = 2;
    game.enemyBullets = [];
  }

  function showCompletionScreen() {
    game.completedCycle = true;
    game.completionTime = game.runElapsed * 1000;
    if (!game.bestTime || game.completionTime < game.bestTime) {
      game.bestTime = game.completionTime;
      localStorage.setItem("rosinInvadersBestTime", String(game.bestTime));
    }
    game.state = "complete";
    ui.messageKicker.textContent = "CONGRATULATIONS";
    ui.messageTitle.textContent = "Congratulations you saved the world from bass rosin";
    ui.finalMetricLabel.textContent = "TIME";
    ui.finalScore.textContent = formatDuration(game.completionTime);
    ui.restartButton.textContent = "KEEP PLAYING";
    ui.changeSeasonButton.textContent = "CHANGE SEASON";
    ui.message.classList.add("visible");
    track("rosin_invaders_cycle_completed", {
      completion_time_seconds: Number((game.completionTime / 1000).toFixed(2)),
      best_time_seconds: Number((game.bestTime / 1000).toFixed(2)),
    });
    playTone(330, 0.1, "square", 0.025);
    playTone(440, 0.12, "square", 0.025, 0.12);
    playTone(660, 0.18, "square", 0.025, 0.26);
  }

  function endGame(kicker, title) {
    game.state = "over";
    ui.messageKicker.textContent = kicker;
    ui.messageTitle.textContent = title;
    ui.finalMetricLabel.textContent = "SCORE";
    ui.finalScore.textContent = formatScore(game.score);
    ui.restartButton.textContent = "PLAY AGAIN";
    ui.changeSeasonButton.textContent = "CHANGE SEASON";
    ui.message.classList.add("visible");
    track("rosin_invaders_game_over", {
      reason: kicker,
      message: title,
      lives_remaining: game.lives,
    });
  }

  function update(dt) {
    for (const star of game.stars) {
      star.y += star.speed * dt;
      if (star.y > game.height) star.y = 0;
    }

    for (const particle of game.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 80 * dt;
      particle.life -= dt;
    }
    game.particles = game.particles.filter((particle) => particle.life > 0);
    game.shake = Math.max(0, game.shake - dt);
    game.enemyShake = Math.max(0, game.enemyShake - dt);

    if (game.state !== "playing") return;
    game.runElapsed += dt;
    updateUI();

    if (game.waveDelay > 0) {
      game.waveDelay -= dt;
      if (game.waveDelay <= 0) spawnQueuedStage();
      return;
    }

    const p = game.player;
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    const direction = Number(keys.right) - Number(keys.left);
    p.x += direction * p.speed * dt;
    p.x = Math.max(8, Math.min(game.width - p.w - 8, p.x));
    shoot();

    for (const bullet of game.bullets) {
      bullet.x += (bullet.vx || 0) * dt;
      bullet.y -= bullet.speed * dt;
    }
    for (const bullet of game.enemyBullets) {
      bullet.age = (bullet.age || 0) + dt;
      bullet.phase = (bullet.phase || 0) + dt * 5;
      bullet.x += (bullet.vx || 0) * dt;
      bullet.y += bullet.speed * dt;
      if (bullet.type === "fizzle" && bullet.age >= bullet.fizzleAt) {
        bullet.dead = true;
        burst(bullet.x + bullet.w / 2, bullet.y + bullet.h / 2, colors.grey, 8);
        playTone(90, 0.05, "sawtooth", 0.012);
      }
    }

    if (game.orb) {
      game.orb.phase += dt * 4.5;
      game.orb.y += game.orb.speed * dt;
      game.orb.x = game.orb.baseX + Math.sin(game.orb.phase) * 16;
      if (intersects(game.orb, p, p.w * 0.12)) {
        collectPowerOrb();
      } else if (game.orb.y > game.height + game.orb.h) {
        game.orb = null;
      }
    }

    if (game.stage === "boss") {
      updateBossStage(dt, p);
      return;
    }

    const living = game.enemies.filter((enemy) => enemy.alive);
    let hitEdge = false;
    for (const enemy of living) {
      enemy.x += game.enemyDirection * game.enemySpeed * dt;
      enemy.phase += dt * 4;
      if (enemy.x < 12 || enemy.x + enemy.w > game.width - 12) hitEdge = true;
    }
    if (hitEdge) {
      game.enemyDirection *= -1;
      for (const enemy of living) {
        enemy.x = Math.max(13, Math.min(game.width - enemy.w - 13, enemy.x));
        enemy.y += Math.max(10, game.height * 0.025);
      }
      game.enemySpeed = Math.min(110, game.enemySpeed * 1.06);
    }

    game.enemyShootTimer -= dt;
    if (game.enemyShootTimer <= 0) {
      enemyShoot();
      game.enemyShootTimer = Math.max(0.28, 1.25 - game.wave * 0.055) * (0.7 + Math.random() * 0.7);
    }

    for (const bullet of game.bullets) {
      if (bullet.dead) continue;
      for (const enemy of living) {
        if (enemy.alive && intersects(bullet, enemy, enemy.w * 0.12)) {
          bullet.dead = true;
          destroyEnemy(enemy);
          break;
        }
      }
    }

    for (const bullet of game.enemyBullets) {
      if (!bullet.dead && intersects(bullet, p, p.w * 0.16)) {
        bullet.dead = true;
        hitPlayer();
      }
    }

    game.bullets = game.bullets.filter(
      (bullet) =>
        !bullet.dead &&
        bullet.y + bullet.h > 0 &&
        bullet.x + bullet.w > 0 &&
        bullet.x < game.width
    );
    game.enemyBullets = game.enemyBullets.filter(
      (bullet) => !bullet.dead && bullet.y < game.height + bullet.h
    );

    const remaining = game.enemies.some((enemy) => enemy.alive);
    if (!remaining) {
      game.stage = "boss";
      game.pendingStage = "boss";
      game.waveDelay = 1.15;
      game.bullets = [];
      game.enemyBullets = [];
      game.orb = null;
      game.poweredUp = false;
      updateUI();
      track("rosin_invaders_wave_cleared", {
        opponent: game.enemySeason,
        next_stage: "boss",
      });
      playTone(330, 0.1, "square", 0.025);
      playTone(440, 0.1, "square", 0.025, 0.12);
      playTone(660, 0.16, "square", 0.025, 0.24);
    } else if (living.some((enemy) => enemy.y + enemy.h >= p.y + 4)) {
      endGame("INVASION COMPLETE", `${game.enemyName} took over.`);
    }
  }

  function drawBackground(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, game.height);
    gradient.addColorStop(0, "#080d18");
    gradient.addColorStop(1, "#04060a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, game.width, game.height);

    for (const star of game.stars) {
      ctx.globalAlpha = star.alpha * (0.76 + Math.sin(time * 0.001 + star.x) * 0.24);
      ctx.fillStyle = "#d9e8ff";
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(255,255,255,0.055)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, game.height - Math.max(30, game.height * 0.045));
    ctx.lineTo(game.width, game.height - Math.max(30, game.height * 0.045));
    ctx.stroke();
  }

  function drawImageEntity(image, entity, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, Math.round(entity.x), Math.round(entity.y), entity.w, entity.h);
    ctx.restore();
  }

  function drawBoss() {
    const boss = game.boss;
    if (!boss) return;

    for (const decoy of game.bossDecoys) {
      drawImageEntity(images[decoy.form], decoy, Math.min(0.42, decoy.life * 0.55));
    }

    const alpha = isBossUnavailable() ? 0.28 : 1;
    drawImageEntity(images[boss.form || boss.key], boss, alpha);

    if (boss.supplyTruck) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.round(boss.supplyTruck.size)}px Arial`;
      ctx.fillText(
        "🚚",
        boss.supplyTruck.x + boss.supplyTruck.size / 2,
        boss.supplyTruck.y + boss.supplyTruck.size / 2
      );
      ctx.restore();
    }

    const barW = boss.w;
    const barH = Math.max(5, boss.h * 0.055);
    const barX = boss.x;
    const barY = Math.max(8, boss.y - barH - 9);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = colors[boss.form || boss.key];
    ctx.fillRect(barX, barY, barW * (boss.health / boss.maxHealth), barH);

    if (boss.shieldPieces.some((piece) => piece.alive)) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const piece of boss.shieldPieces) {
        if (!piece.alive) continue;
        const bounds = getShieldPieceBounds(boss, piece);
        ctx.font = `${Math.round(piece.size)}px Arial`;
        ctx.fillText("🇸🇪", bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
      }
      ctx.restore();
    }

    if (isBossUnavailable()) {
      ctx.save();
      ctx.translate(boss.x + boss.w / 2, boss.y + boss.h * 0.52);
      ctx.rotate(-0.14);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${Math.max(12, boss.w * 0.15)}px Arial`;
      ctx.lineWidth = Math.max(3, boss.w * 0.035);
      ctx.strokeStyle = "rgba(5, 8, 14, 0.88)";
      ctx.fillStyle = colors.red;
      ctx.strokeText("BACKORDERED", 0, 0);
      ctx.fillText("BACKORDERED", 0, 0);
      ctx.restore();
    }
  }

  function drawEnemyBullet(bullet) {
    if (bullet.type === "fizzle") {
      const alpha = Math.max(0.18, 1 - bullet.age / bullet.fizzleAt);
      const spark = Math.sin((bullet.phase || 0) * 7) * 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colors.grey;
      ctx.fillRect(bullet.x + spark, bullet.y, bullet.w, bullet.h * alpha);
      ctx.globalAlpha = alpha * 0.65;
      ctx.fillStyle = "#f6d57a";
      ctx.fillRect(bullet.x - 2 - spark, bullet.y + bullet.h * 0.3, 2, 2);
      ctx.fillRect(bullet.x + bullet.w + spark, bullet.y + bullet.h * 0.55, 2, 2);
      ctx.restore();
      return;
    }

    if (bullet.type !== "powderCrystal") {
      ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
      return;
    }

    const cx = bullet.x + bullet.w / 2;
    const cy = bullet.y + bullet.h / 2;
    const radius = Math.max(bullet.w, bullet.h) / 2;
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 1.9);
    glow.addColorStop(0, "rgba(255, 236, 214, 0.95)");
    glow.addColorStop(0.34, "rgba(255, 94, 85, 0.72)");
    glow.addColorStop(1, "rgba(255, 94, 85, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.85, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin((bullet.phase || 0) + bullet.y * 0.03) * 0.16);
    ctx.fillStyle = "#cf1f1a";
    ctx.strokeStyle = "#ffe2ce";
    ctx.lineWidth = Math.max(1.2, bullet.w * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -bullet.h * 0.68);
    ctx.lineTo(bullet.w * 0.38, -bullet.h * 0.12);
    ctx.lineTo(bullet.w * 0.18, bullet.h * 0.58);
    ctx.lineTo(0, bullet.h * 0.74);
    ctx.lineTo(-bullet.w * 0.18, bullet.h * 0.58);
    ctx.lineTo(-bullet.w * 0.38, -bullet.h * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 226, 206, 0.76)";
    ctx.beginPath();
    ctx.moveTo(0, -bullet.h * 0.46);
    ctx.lineTo(bullet.w * 0.12, -bullet.h * 0.05);
    ctx.lineTo(0, bullet.h * 0.38);
    ctx.lineTo(-bullet.w * 0.1, -bullet.h * 0.03);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPowderClouds() {
    for (const cloud of game.powderClouds) {
      const alpha = Math.max(0, Math.min(0.72, cloud.life / cloud.maxLife));
      const gradient = ctx.createRadialGradient(
        cloud.x,
        cloud.y,
        cloud.radius * 0.15,
        cloud.x,
        cloud.y,
        cloud.radius
      );
      gradient.addColorStop(0, `rgba(255, 230, 205, ${alpha})`);
      gradient.addColorStop(0.45, `rgba(255, 94, 85, ${alpha * 0.72})`);
      gradient.addColorStop(1, "rgba(255, 94, 85, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(time) {
    drawBackground(time);

    ctx.save();
    if (game.shake > 0) {
      const amount = game.shake * 12;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }

    ctx.save();
    if (game.enemyShake > 0) {
      const amount = game.enemyShake * 12;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }

    const enemyImage = images[game.enemySeason];
    for (const enemy of game.enemies) {
      if (!enemy.alive) continue;
      const bob = Math.sin(enemy.phase) * 1.5;
      drawImageEntity(enemyImage, { ...enemy, y: enemy.y + bob });
    }
    drawBoss();
    ctx.restore();

    if (game.player && game.state !== "menu") {
      const flicker =
        game.player.invulnerable > 0 && Math.floor(game.player.invulnerable * 12) % 2 === 0;
      if (!flicker) drawImageEntity(images[game.season], game.player);
      if (game.poweredUp && !flicker) {
        const companionSeason = game.season === "winter" ? "summer" : "winter";
        drawImageEntity(images[companionSeason], getCompanion());
      }
      ctx.fillStyle = colors[game.season];
      ctx.globalAlpha = 0.42;
      ctx.fillRect(
        game.player.x + game.player.w * 0.27,
        game.player.y + game.player.h + 2,
        game.player.w * 0.46,
        3 + Math.random() * 5
      );
      ctx.globalAlpha = 1;
    }

    if (game.orb) {
      const orb = game.orb;
      const cx = orb.x + orb.w / 2;
      const cy = orb.y + orb.h / 2;
      const radius = orb.w / 2;
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * 1.7);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.25, "rgba(123,224,255,0.9)");
      glow.addColorStop(0.65, "rgba(161,92,255,0.55)");
      glow.addColorStop(1, "rgba(90,50,210,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.7, 0, Math.PI * 2);
      ctx.fill();

      const sphere = ctx.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.4,
        radius * 0.08,
        cx,
        cy,
        radius
      );
      sphere.addColorStop(0, "#ffffff");
      sphere.addColorStop(0.18, "#a7f3ff");
      sphere.addColorStop(0.52, "#6398ff");
      sphere.addColorStop(0.78, "#7a3bd1");
      sphere.addColorStop(1, "#28105f");
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = colors[game.season];
    for (const bullet of game.bullets) {
      ctx.shadowColor = colors[game.season];
      ctx.shadowBlur = 8;
      ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
    }

    ctx.fillStyle = colors[game.enemySeason];
    for (const bullet of game.enemyBullets) {
      ctx.shadowColor = colors[game.enemySeason];
      ctx.shadowBlur = 7;
      drawEnemyBullet(bullet);
    }
    ctx.shadowBlur = 0;

    drawPowderClouds();

    for (const particle of game.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;

    if (game.waveDelay > 0 && game.state === "playing") {
      ctx.fillStyle = colors.white;
      ctx.textAlign = "center";
      ctx.font = `900 ${Math.max(18, game.width * 0.034)}px Arial`;
      ctx.fillText(
        game.pendingStage === "boss" ? "BOSS" : `WAVE ${game.wave}`,
        game.width / 2,
        game.height / 2
      );
      ctx.font = `700 ${Math.max(9, game.width * 0.014)}px Arial`;
      ctx.fillStyle = colors[game.enemySeason];
      ctx.fillText(
        game.pendingStage === "boss" ? game.enemyName : `${game.enemyName} IS COMING`,
        game.width / 2,
        game.height / 2 + 24
      );
    }

    ctx.restore();
  }

  function loop(time) {
    const dt = Math.min(0.034, (time - game.lastTime) / 1000 || 0);
    game.lastTime = time;
    update(dt);
    draw(time);
    requestAnimationFrame(loop);
  }

  function ensureAudio() {
    if (!game.audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) game.audio = new AudioContext();
    }
    if (!game.audio) return Promise.resolve(null);
    if (game.audio?.state === "suspended") {
      return game.audio.resume().then(() => game.audio).catch(() => null);
    }
    return Promise.resolve(game.audio);
  }

  function prepareBackgroundMusic() {
    backgroundMusic.loop = true;
    backgroundMusic.muted = false;
    backgroundMusic.volume = 1;
  }

  function syncBackgroundMusic() {
    if (!game.soundOn || game.state === "paused" || document.hidden) {
      backgroundMusic.pause();
      return;
    }
    prepareBackgroundMusic();
    const playPromise = backgroundMusic.play();
    if (playPromise) playPromise.catch(() => {});
  }

  function playTone(frequency, duration, type, volume, delay = 0) {
    if (!game.soundOn) return;
    ensureAudio().then((audio) => {
      if (!audio || audio.state !== "running") return;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(40, frequency * 0.72),
        start + duration
      );
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    });
  }

  function setControl(control, pressed, button) {
    keys[control] = pressed;
    if (button) button.classList.toggle("active", pressed);
  }

  function bindHoldButton(id, control) {
    const button = document.getElementById(id);
    const press = (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      setControl(control, true, button);
    };
    const release = (event) => {
      event.preventDefault();
      setControl(control, false, button);
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  }

  document.querySelectorAll("[data-season]").forEach((button) => {
    button.addEventListener("click", () => startGame(button.dataset.season));
  });

  ui.restartButton.addEventListener("click", () => {
    if (game.state === "complete") {
      continueHighScoreRun();
    } else {
      restartGame();
    }
  });
  ui.changeSeasonButton.addEventListener("click", returnToMenu);
  document.getElementById("resumeButton").addEventListener("click", () => togglePause(true));
  document.getElementById("startOverButton").addEventListener("click", returnToMenu);
  pauseButtons.forEach((button) => {
    button.addEventListener("click", () => togglePause());
  });
  ui.soundButton.addEventListener("click", () => {
    game.soundOn = !game.soundOn;
    ui.soundButton.textContent = `SOUND: ${game.soundOn ? "ON" : "OFF"}`;
    ui.soundButton.setAttribute("aria-pressed", String(game.soundOn));
    if (game.soundOn) {
      ensureAudio();
      syncBackgroundMusic();
      playTone(440, 0.08, "square", 0.025);
    } else {
      syncBackgroundMusic();
    }
  });

  const unlockSound = () => {
    if (!game.soundOn) return;
    syncBackgroundMusic();
  };
  document.addEventListener("pointerdown", unlockSound, { capture: true });
  document.addEventListener("click", unlockSound, { capture: true });
  document.addEventListener("keydown", unlockSound, { capture: true });

  bindHoldButton("leftButton", "left");
  bindHoldButton("rightButton", "right");

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = true;
    if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = true;
    if ((event.code === "KeyP" || event.code === "Escape") && !event.repeat) togglePause();
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = false;
  });

  window.addEventListener("blur", () => {
    keys.left = false;
    keys.right = false;
    if (game.state === "playing") togglePause();
  });

  window.addEventListener("resize", resizeCanvas);
  window.visualViewport?.addEventListener("resize", resizeCanvas);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === "playing") togglePause();
    syncBackgroundMusic();
  });

  updateUI();
  resizeCanvas();
  syncBackgroundMusic();
  requestAnimationFrame(loop);
})();
