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
  const SAVE_VERSION = 2;
  const WORLD_MIN = -2860;
  const WORLD_MAX = 2860;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createInitialState(seed) {
    return {
      version: SAVE_VERSION,
      seed: seed || 918273645,
      time: 0,
      day: 1,
      phase: "day",
      paused: false,
      player: {
        x: -34,
        vx: 0,
        facing: 1,
        stamina: 1
      }
    };
  }

  function reviveLoadedState(candidate) {
    if (!candidate || candidate.version !== SAVE_VERSION) {
      return createInitialState();
    }

    const state = createInitialState(candidate.seed);
    Object.assign(state, candidate);
    state.player = Object.assign(createInitialState().player, candidate.player || {});
    return state;
  }

  function serializableState(state) {
    return {
      version: SAVE_VERSION,
      seed: state.seed,
      time: state.time,
      day: state.day,
      phase: state.phase,
      paused: state.paused,
      player: state.player
    };
  }

  function updateCalendar(state) {
    const dayIndex = Math.floor(state.time / DAY_LENGTH);
    state.day = dayIndex + 1;
    state.phase = state.time - dayIndex * DAY_LENGTH >= NIGHT_START ? "night" : "day";
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
  }

  function update(state, input, dt) {
    const step = clamp(dt || 0, 0, 0.05);
    if (state.paused) return state;

    state.time += step;
    updateCalendar(state);
    updatePlayer(state, input || {}, step);
    return state;
  }

  return {
    DAY_LENGTH,
    NIGHT_START,
    SAVE_VERSION,
    WORLD_MAX,
    WORLD_MIN,
    clamp,
    createInitialState,
    reviveLoadedState,
    serializableState,
    update
  };
});
