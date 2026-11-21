// Keyboard and pointer input for Tanjung Pelita. Held keys give movement (walk) and
// driving (throttle + steering); one-shot presses are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_ATTACK = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const ATTACK = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (ATTACK.has(event.code)) {
      // Space also confirms, so on a dialogue screen it advances the lines
      // instead of queuing a punch behind them.
      if (!event.repeat) actions |= ACTION_ATTACK | ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  const has = (set) => [...set].some((code) => held.has(code));

  return {
    /** Walk direction in screen space: mx -1..1 (left/right), my -1..1 (up/down). */
    walk() {
      return {
        mx: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
        my: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0),
      };
    },
    /** Driving: throttle 1 forward (W) / -1 reverse (S), steer 1 right (D) / -1 left (A). */
    drive() {
      return {
        throttle: (has(UP) ? 1 : 0) - (has(DOWN) ? 1 : 0),
        steer: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Peek without clearing (for the shot autopilot's override). */
    peekActions() { return actions; },
  };
}
