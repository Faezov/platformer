const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../src/game-core");

function tick(state, seconds, input) {
  const steps = Math.ceil(seconds / 0.05);
  for (let i = 0; i < steps; i += 1) {
    Core.update(state, input || {}, seconds / steps);
  }
}

test("the player can move right and face that direction", () => {
  const state = Core.createInitialState(123);
  const start = state.player.x;

  tick(state, 0.5, { right: true });

  assert.ok(state.player.x > start);
  assert.equal(state.player.facing, 1);
});

test("sprinting moves faster and spends stamina", () => {
  const walking = Core.createInitialState(456);
  const sprinting = Core.createInitialState(456);

  tick(walking, 1, { right: true });
  tick(sprinting, 1, { right: true, sprint: true });

  assert.ok(sprinting.player.x > walking.player.x);
  assert.ok(sprinting.player.stamina < walking.player.stamina);
});

test("time advances into night", () => {
  const state = Core.createInitialState(789);

  tick(state, Core.NIGHT_START + 0.2);

  assert.equal(state.phase, "night");
  assert.equal(state.day, 1);
});

test("serializing and reviving preserves player progress", () => {
  const state = Core.createInitialState(31415);
  tick(state, 2, { right: true, sprint: true });

  const revived = Core.reviveLoadedState(Core.serializableState(state));

  assert.equal(revived.version, Core.SAVE_VERSION);
  assert.equal(revived.day, state.day);
  assert.equal(revived.player.x, state.player.x);
  assert.equal(revived.player.stamina, state.player.stamina);
});
