(function bootstrap(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CrownlineCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function factory() {
  "use strict";

  const DAY_LENGTH = 88;
  const NIGHT_START = 60;
  const WORLD_MIN = -2860;
  const WORLD_MAX = 2860;
  const ACTION_RANGE = 92;
  const SAVE_VERSION = 1;

  const STRUCTURE_DEFS = {
    keep: {
      label: "Raise keep",
      costs: [0, 7, 12, 18],
      hp: [0, 160, 230, 320],
      maxLevel: 3
    },
    wall: {
      label: "Fortify wall",
      costs: [3, 5, 8, 12],
      hp: [0, 70, 135, 215, 320],
      maxLevel: 4
    },
    tower: {
      label: "Raise tower",
      costs: [4, 7, 11],
      hp: [0, 80, 150, 240],
      maxLevel: 3
    },
    farm: {
      label: "Till fields",
      costs: [3, 6, 10],
      hp: [0, 70, 120, 170],
      maxLevel: 3
    }
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function sign(value) {
    if (value < 0) return -1;
    if (value > 0) return 1;
    return 0;
  }

  function distance(a, b) {
    return Math.abs(a - b);
  }

  function random(state) {
    state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
    return state.seed / 4294967296;
  }

  function nextId(state, prefix) {
    const id = `${prefix}${state.nextId}`;
    state.nextId += 1;
    return id;
  }

  function makeStructure(id, kind, x, level, side) {
    const def = STRUCTURE_DEFS[kind];
    const hp = def.hp[level] || 0;
    return {
      id,
      kind,
      x,
      side,
      level,
      hp,
      maxHp: hp,
      cooldown: 0,
      flash: 0
    };
  }

  function makeCitizen(id, role, x, side) {
    return {
      id,
      role,
      x,
      side: side || sign(x) || 1,
      hp: role === "vagrant" ? 2 : 3,
      cooldown: 0,
      work: 0,
      panic: 0,
      carrying: 0
    };
  }

  function makeEnemy(state, side, strength) {
    const edge = side < 0 ? WORLD_MIN - 80 : WORLD_MAX + 80;
    return {
      id: nextId(state, "e"),
      x: edge,
      side,
      hp: 2 + Math.floor(strength / 3),
      maxHp: 2 + Math.floor(strength / 3),
      speed: 46 + Math.min(28, strength * 2),
      cooldown: 0,
      loot: 0,
      stunned: 0
    };
  }

  function createInitialState(seed) {
    const state = {
      version: SAVE_VERSION,
      seed: seed || 918273645,
      nextId: 1,
      time: 0,
      day: 1,
      waveDay: 0,
      phase: "day",
      gameOver: false,
      paused: false,
      score: 0,
      stats: {
        coinsSpent: 0,
        enemiesDefeated: 0,
        peopleHired: 0
      },
      player: {
        x: -34,
        vx: 0,
        facing: 1,
        coins: 8,
        stamina: 1,
        crownHealth: 5,
        maxCrownHealth: 5,
        hurtTimer: 0
      },
      structures: [
        makeStructure("keep", "keep", 0, 1, 0),
        makeStructure("wall-left", "wall", -355, 1, -1),
        makeStructure("wall-right", "wall", 355, 1, 1),
        makeStructure("tower-left", "tower", -560, 0, -1),
        makeStructure("tower-right", "tower", 560, 0, 1),
        makeStructure("farm-left", "farm", -940, 0, -1),
        makeStructure("farm-right", "farm", 940, 0, 1)
      ],
      camps: [
        { id: "camp-left", x: -1540, side: -1 },
        { id: "camp-right", x: 1540, side: 1 }
      ],
      portals: [
        { id: "portal-left", x: WORLD_MIN, side: -1, pulse: 0 },
        { id: "portal-right", x: WORLD_MAX, side: 1, pulse: 0 }
      ],
      citizens: [],
      enemies: [],
      drops: [],
      shots: [],
      events: []
    };

    state.citizens.push(makeCitizen(nextId(state, "c"), "builder", -105, -1));
    state.citizens.push(makeCitizen(nextId(state, "c"), "guard", 128, 1));
    state.citizens.push(makeCitizen(nextId(state, "c"), "vagrant", -1510, -1));
    state.citizens.push(makeCitizen(nextId(state, "c"), "vagrant", -1590, -1));
    state.citizens.push(makeCitizen(nextId(state, "c"), "vagrant", 1510, 1));
    state.citizens.push(makeCitizen(nextId(state, "c"), "vagrant", 1590, 1));

    return state;
  }

  function reviveLoadedState(candidate) {
    if (!candidate || candidate.version !== SAVE_VERSION) {
      return createInitialState();
    }
    const state = createInitialState(candidate.seed);
    Object.assign(state, candidate);
    state.events = [];
    state.shots = state.shots || [];
    state.drops = state.drops || [];
    state.enemies = state.enemies || [];
    state.citizens = state.citizens || [];
    state.structures = state.structures || [];
    state.camps = state.camps || [];
    state.portals = state.portals || [];
    state.player = Object.assign(createInitialState().player, state.player || {});
    state.stats = Object.assign(createInitialState().stats, state.stats || {});
    return state;
  }

  function serializableState(state) {
    return {
      version: SAVE_VERSION,
      seed: state.seed,
      nextId: state.nextId,
      time: state.time,
      day: state.day,
      waveDay: state.waveDay,
      phase: state.phase,
      gameOver: state.gameOver,
      score: state.score,
      stats: state.stats,
      player: state.player,
      structures: state.structures,
      camps: state.camps,
      portals: state.portals,
      citizens: state.citizens,
      enemies: state.enemies,
      drops: state.drops
    };
  }

  function getCounts(state) {
    return state.citizens.reduce(
      (counts, citizen) => {
        counts.total += citizen.role === "vagrant" ? 0 : 1;
        counts[citizen.role] = (counts[citizen.role] || 0) + 1;
        return counts;
      },
      { total: 0, vagrant: 0, builder: 0, guard: 0, farmer: 0 }
    );
  }

  function getStructure(state, id) {
    return state.structures.find((structure) => structure.id === id);
  }

  function structureUpgradeCost(structure) {
    const def = STRUCTURE_DEFS[structure.kind];
    if (!def || structure.level >= def.maxLevel) return null;
    return def.costs[structure.level] || null;
  }

  function roleForHire(state) {
    const counts = getCounts(state);
    if (counts.builder < 3) return "builder";
    if (counts.guard < 7) return "guard";
    return "farmer";
  }

  function nearestBuiltFarm(state, x) {
    const farms = state.structures.filter((structure) => structure.kind === "farm" && structure.level > 0);
    if (!farms.length) return null;
    return farms.reduce((nearest, farm) => {
      if (!nearest) return farm;
      return distance(farm.x, x) < distance(nearest.x, x) ? farm : nearest;
    }, null);
  }

  function getNearestInteractable(state) {
    const px = state.player.x;
    const candidates = [];

    for (const citizen of state.citizens) {
      if (citizen.role !== "vagrant") continue;
      const d = distance(px, citizen.x);
      if (d <= ACTION_RANGE) {
        candidates.push({
          id: citizen.id,
          kind: "hire",
          x: citizen.x,
          distance: d,
          title: "Hire traveler",
          cost: 1
        });
      }
    }

    for (const structure of state.structures) {
      const cost = structureUpgradeCost(structure);
      if (!cost) continue;
      const d = distance(px, structure.x);
      if (d <= ACTION_RANGE) {
        const label = STRUCTURE_DEFS[structure.kind].label;
        candidates.push({
          id: structure.id,
          kind: "upgrade",
          x: structure.x,
          distance: d,
          title: label,
          cost
        });
      }
    }

    return candidates.sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function spendCoins(state, amount) {
    if (state.player.coins < amount) {
      state.events.push({ type: "empty", x: state.player.x });
      return false;
    }
    state.player.coins -= amount;
    state.stats.coinsSpent += amount;
    return true;
  }

  function performAction(state) {
    if (state.gameOver) return false;
    const target = getNearestInteractable(state);
    if (!target || !spendCoins(state, target.cost)) return false;

    if (target.kind === "hire") {
      const citizen = state.citizens.find((person) => person.id === target.id);
      if (!citizen || citizen.role !== "vagrant") return false;
      citizen.role = roleForHire(state);
      citizen.hp = 3;
      citizen.cooldown = 0;
      citizen.work = 0;
      citizen.carrying = 0;
      state.stats.peopleHired += 1;
      state.events.push({ type: "hire", x: citizen.x });
      return true;
    }

    const structure = getStructure(state, target.id);
    if (!structure) return false;
    const def = STRUCTURE_DEFS[structure.kind];
    structure.level += 1;
    structure.maxHp = def.hp[structure.level];
    structure.hp = structure.maxHp;
    structure.flash = 0.75;
    state.score += target.cost * 4;
    state.events.push({ type: "build", x: structure.x, kind: structure.kind });
    return true;
  }

  function spawnDrop(state, x, amount) {
    for (let i = 0; i < amount; i += 1) {
      state.drops.push({
        id: nextId(state, "d"),
        x: x + (random(state) - 0.5) * 34,
        y: -18 - random(state) * 16,
        vx: (random(state) - 0.5) * 70,
        vy: -120 - random(state) * 90,
        amount: 1,
        ttl: 50
      });
    }
  }

  function produceDawnIncome(state) {
    const keep = getStructure(state, "keep");
    if (keep) {
      spawnDrop(state, keep.x, 2 + keep.level);
    }

    for (const farm of state.structures) {
      if (farm.kind !== "farm" || farm.level <= 0) continue;
      const farmers = state.citizens.filter((citizen) => citizen.role === "farmer" && distance(citizen.x, farm.x) < 380);
      spawnDrop(state, farm.x, farm.level + farmers.length);
    }
  }

  function spawnVagrants(state) {
    for (const camp of state.camps) {
      const nearCamp = state.citizens.filter((citizen) => citizen.role === "vagrant" && distance(citizen.x, camp.x) < 180);
      while (nearCamp.length < 3) {
        const citizen = makeCitizen(nextId(state, "c"), "vagrant", camp.x + (random(state) - 0.5) * 120, camp.side);
        state.citizens.push(citizen);
        nearCamp.push(citizen);
      }
    }
  }

  function spawnWave(state) {
    const strength = Math.max(1, state.day);
    const count = 2 + Math.floor(state.day * 1.35);
    for (let i = 0; i < count; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const enemy = makeEnemy(state, side, strength);
      enemy.x += side * random(state) * 340;
      state.enemies.push(enemy);
    }
    state.events.push({ type: "wave", day: state.day });
  }

  function updateCalendar(state) {
    const previousDay = state.day;
    const dayIndex = Math.floor(state.time / DAY_LENGTH);
    state.day = dayIndex + 1;
    const local = state.time - dayIndex * DAY_LENGTH;
    state.phase = local >= NIGHT_START ? "night" : "day";

    if (state.day !== previousDay) {
      state.waveDay = 0;
      produceDawnIncome(state);
      spawnVagrants(state);
      state.events.push({ type: "dawn", day: state.day });
    }

    if (state.phase === "night" && state.waveDay !== state.day) {
      state.waveDay = state.day;
      spawnWave(state);
    }
  }

  function moveToward(entity, targetX, speed, dt) {
    const delta = targetX - entity.x;
    const step = clamp(delta, -speed * dt, speed * dt);
    entity.x += step;
    return Math.abs(delta) <= Math.max(4, speed * dt);
  }

  function nearestEnemy(state, x, range) {
    let best = null;
    let bestDistance = Infinity;
    for (const enemy of state.enemies) {
      const d = distance(enemy.x, x);
      if (d < bestDistance && d <= range) {
        best = enemy;
        bestDistance = d;
      }
    }
    return best;
  }

  function damageEnemy(state, enemy, amount, fromX) {
    enemy.hp -= amount;
    enemy.stunned = Math.max(enemy.stunned || 0, 0.08);
    state.shots.push({
      id: nextId(state, "s"),
      fromX,
      toX: enemy.x,
      ttl: 0.22,
      maxTtl: 0.22
    });
    if (enemy.hp <= 0) {
      state.stats.enemiesDefeated += 1;
      state.score += 10;
      spawnDrop(state, enemy.x, 1 + (enemy.loot > 0 ? enemy.loot : 0));
    }
  }

  function updateDefense(state, dt) {
    for (const citizen of state.citizens) {
      citizen.cooldown = Math.max(0, citizen.cooldown - dt);
      if (citizen.role !== "guard") continue;
      const target = nearestEnemy(state, citizen.x, 250);
      if (target && citizen.cooldown <= 0) {
        citizen.cooldown = 1.1;
        damageEnemy(state, target, 1, citizen.x);
      }
    }

    for (const structure of state.structures) {
      structure.cooldown = Math.max(0, (structure.cooldown || 0) - dt);
      structure.flash = Math.max(0, (structure.flash || 0) - dt);
      if (structure.kind !== "tower" || structure.level <= 0 || structure.cooldown > 0) continue;
      const range = 330 + structure.level * 70;
      const target = nearestEnemy(state, structure.x, range);
      if (!target) continue;
      structure.cooldown = Math.max(0.45, 1.45 - structure.level * 0.25);
      damageEnemy(state, target, 1, structure.x);
    }

    state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  }

  function updateCitizens(state, dt) {
    const counts = getCounts(state);
    const enemyPressure = state.enemies.length > 0;

    for (const citizen of state.citizens) {
      citizen.panic = Math.max(0, (citizen.panic || 0) - dt);
      if (citizen.role === "vagrant") {
        const camp = state.camps.find((item) => item.side === citizen.side) || state.camps[0];
        const anchor = camp.x + Math.sin(state.time * 0.2 + Number(citizen.id.slice(1))) * 55;
        moveToward(citizen, anchor, 28, dt);
        continue;
      }

      if (citizen.role === "builder") {
        const damaged = state.structures
          .filter((structure) => structure.level > 0 && structure.hp < structure.maxHp)
          .sort((a, b) => distance(a.x, citizen.x) - distance(b.x, citizen.x))[0];
        if (damaged && state.phase === "day") {
          if (moveToward(citizen, damaged.x, 82, dt)) {
            damaged.hp = Math.min(damaged.maxHp, damaged.hp + 18 * dt);
          }
        } else {
          const offset = (Number(citizen.id.slice(1)) % 5) * 26 - 52;
          moveToward(citizen, offset, 58, dt);
        }
        continue;
      }

      if (citizen.role === "guard") {
        const targetEnemy = nearestEnemy(state, citizen.x, 380);
        if (targetEnemy) {
          moveToward(citizen, targetEnemy.x - targetEnemy.side * 120, 96, dt);
        } else {
          const side = citizen.side || (counts.guard % 2 ? -1 : 1);
          const wall = state.structures.find((structure) => structure.kind === "wall" && structure.side === side);
          const post = wall && wall.level > 0 ? wall.x - side * 90 : side * 260;
          moveToward(citizen, post, enemyPressure ? 92 : 60, dt);
        }
        continue;
      }

      if (citizen.role === "farmer") {
        const farm = nearestBuiltFarm(state, citizen.x);
        if (farm && state.phase === "day") {
          moveToward(citizen, farm.x + citizen.side * 34, 54, dt);
          citizen.work += dt;
          if (citizen.work >= 18) {
            citizen.work = 0;
            spawnDrop(state, farm.x, 1);
          }
        } else {
          moveToward(citizen, citizen.side * 190, 52, dt);
        }
      }
    }
  }

  function updateEnemies(state, dt) {
    const player = state.player;
    for (const enemy of state.enemies) {
      enemy.cooldown = Math.max(0, enemy.cooldown - dt);
      enemy.stunned = Math.max(0, (enemy.stunned || 0) - dt);
      const homePortal = state.portals.find((portal) => portal.side === enemy.side);

      if (enemy.loot > 0 && homePortal) {
        moveToward(enemy, homePortal.x + enemy.side * 80, enemy.speed * 1.35, dt);
        continue;
      }

      const wall = state.structures.find((structure) => structure.kind === "wall" && structure.side === enemy.side && structure.level > 0 && structure.hp > 0);
      if (wall && distance(enemy.x, wall.x) < 42) {
        if (enemy.cooldown <= 0) {
          enemy.cooldown = 0.85;
          wall.hp -= 9 + state.day * 0.8;
          wall.flash = 0.35;
          if (wall.hp <= 0) {
            wall.hp = 0;
            wall.level = 0;
            wall.maxHp = 0;
            state.events.push({ type: "break", x: wall.x });
          }
        }
        continue;
      }

      if (wall) {
        moveToward(enemy, wall.x + enemy.side * 28, enemy.speed, dt);
      } else {
        moveToward(enemy, 0, enemy.speed, dt);
      }

      if (distance(enemy.x, player.x) < 48 && enemy.cooldown <= 0) {
        enemy.cooldown = 1.4;
        player.hurtTimer = 0.45;
        if (player.coins > 0) {
          player.coins -= 1;
          enemy.loot += 1;
          state.events.push({ type: "steal", x: player.x });
        } else {
          player.crownHealth -= 1;
          state.events.push({ type: "hurt", x: player.x });
          if (player.crownHealth <= 0) {
            state.gameOver = true;
          }
        }
      }

      if (distance(enemy.x, 0) < 44 && enemy.cooldown <= 0) {
        enemy.cooldown = 1.25;
        player.crownHealth -= 1;
        state.events.push({ type: "hurt", x: 0 });
        if (player.crownHealth <= 0) {
          state.gameOver = true;
        }
      }
    }

    state.enemies = state.enemies.filter((enemy) => {
      if (enemy.hp <= 0) return false;
      if (enemy.loot > 0) {
        const portal = state.portals.find((item) => item.side === enemy.side);
        if (portal && distance(enemy.x, portal.x) < 80) {
          return false;
        }
      }
      return enemy.x > WORLD_MIN - 180 && enemy.x < WORLD_MAX + 180;
    });
  }

  function updateDrops(state, dt) {
    for (const drop of state.drops) {
      drop.ttl -= dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.vy += 480 * dt;
      if (drop.y > 0) {
        drop.y = 0;
        drop.vy *= -0.35;
        drop.vx *= 0.72;
      }

      if (distance(drop.x, state.player.x) < 42 && Math.abs(drop.y) < 55) {
        drop.ttl = 0;
        state.player.coins += drop.amount;
        state.score += 1;
        state.events.push({ type: "coin", x: drop.x });
      }
    }

    state.drops = state.drops.filter((drop) => drop.ttl > 0);
  }

  function updatePlayer(state, input, dt) {
    const player = state.player;
    const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const sprinting = Boolean(input.sprint && axis && player.stamina > 0.02);
    const speed = sprinting ? 318 : 178;

    player.vx = axis * speed;
    player.x = clamp(player.x + player.vx * dt, WORLD_MIN + 160, WORLD_MAX - 160);
    if (axis) player.facing = axis;

    if (sprinting) {
      player.stamina = clamp(player.stamina - dt * 0.36, 0, 1);
    } else {
      player.stamina = clamp(player.stamina + dt * 0.22, 0, 1);
    }
    player.hurtTimer = Math.max(0, (player.hurtTimer || 0) - dt);
  }

  function updateShots(state, dt) {
    for (const shot of state.shots) {
      shot.ttl -= dt;
    }
    state.shots = state.shots.filter((shot) => shot.ttl > 0);
  }

  function updatePortals(state, dt) {
    for (const portal of state.portals) {
      portal.pulse = (portal.pulse || 0) + dt;
    }
  }

  function update(state, input, dt) {
    if (state.gameOver) return state;
    const step = clamp(dt || 0, 0, 0.05);
    if (state.paused) return state;

    state.events = [];
    state.time += step;
    updateCalendar(state);
    updatePlayer(state, input || {}, step);
    updateCitizens(state, step);
    updateDefense(state, step);
    updateEnemies(state, step);
    updateDrops(state, step);
    updateShots(state, step);
    updatePortals(state, step);
    return state;
  }

  return {
    ACTION_RANGE,
    DAY_LENGTH,
    NIGHT_START,
    SAVE_VERSION,
    STRUCTURE_DEFS,
    WORLD_MAX,
    WORLD_MIN,
    clamp,
    createInitialState,
    getCounts,
    getNearestInteractable,
    performAction,
    reviveLoadedState,
    serializableState,
    spawnWave,
    update
  };
});
