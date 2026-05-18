const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../src/game-core");

function tick(state, seconds, input) {
  const steps = Math.ceil(seconds / 0.05);
  for (let i = 0; i < steps; i += 1) {
    Core.update(state, input || {}, seconds / steps);
  }
}

test("upgrading the keep spends coins and raises the level", () => {
  const state = Core.createInitialState(123);
  state.player.x = 0;

  const target = Core.getNearestInteractable(state);
  assert.equal(target.kind, "upgrade");
  assert.equal(target.id, "keep");
  assert.equal(target.cost, 7);

  assert.equal(Core.performAction(state), true);
  const keep = state.structures.find((structure) => structure.id === "keep");
  assert.equal(keep.level, 2);
  assert.equal(state.player.coins, 1);
  assert.equal(state.stats.coinsSpent, 7);
});

test("hiring a traveler converts them into a useful citizen", () => {
  const state = Core.createInitialState(456);
  const traveler = state.citizens.find((citizen) => citizen.role === "vagrant");
  state.player.x = traveler.x;
  state.player.coins = 3;

  assert.equal(Core.performAction(state), true);
  assert.notEqual(traveler.role, "vagrant");
  assert.equal(state.player.coins, 2);
  assert.equal(Core.getCounts(state).total, 3);
  assert.equal(state.stats.peopleHired, 1);
});

test("the first night starts a wave", () => {
  const state = Core.createInitialState(789);

  tick(state, Core.NIGHT_START + 0.2);

  assert.equal(state.phase, "night");
  assert.equal(state.waveDay, 1);
  assert.ok(state.enemies.length > 0);
});

test("guards can defeat a nearby enemy and drop coins", () => {
  const state = Core.createInitialState(101112);
  state.enemies.push({
    id: "enemy-test",
    x: 150,
    side: 1,
    hp: 1,
    maxHp: 1,
    speed: 0,
    cooldown: 0,
    loot: 0,
    stunned: 0
  });

  tick(state, 1.2);

  assert.equal(state.enemies.length, 0);
  assert.ok(state.drops.length > 0);
  assert.equal(state.stats.enemiesDefeated, 1);
});

test("serializing and reviving preserves campaign progress", () => {
  const state = Core.createInitialState(31415);
  state.player.x = 0;
  Core.performAction(state);
  tick(state, 2);

  const revived = Core.reviveLoadedState(Core.serializableState(state));
  assert.equal(revived.version, Core.SAVE_VERSION);
  assert.equal(revived.day, state.day);
  assert.equal(revived.player.coins, state.player.coins);
  assert.equal(revived.structures.find((structure) => structure.id === "keep").level, 2);
});
