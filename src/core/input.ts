// 键盘 + 鼠标输入管理
export type Action =
  | 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'skill1' | 'skill2'
  | 'potHp' | 'potMp' | 'job1' | 'job2' | 'job3' | 'inventory' | 'mute' | 'pause'
  | 'confirm' | 'cancel' | 'cheat' | 'sell';

const BINDINGS: Record<Action, string[]> = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  jump: ['Space', 'KeyC', 'AltLeft', 'AltRight'],
  attack: ['KeyA', 'ControlLeft', 'ControlRight', 'KeyJ'],
  skill1: ['KeyQ'],
  skill2: ['KeyW'],
  potHp: ['KeyZ'],
  potMp: ['KeyX'],
  job1: ['Digit1', 'Numpad1'],
  job2: ['Digit2', 'Numpad2'],
  job3: ['Digit3', 'Numpad3'],
  inventory: ['KeyI', 'KeyB'],
  mute: ['KeyM'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'NumpadEnter', 'Space'],
  cancel: ['Escape'],
  cheat: ['F9'],
  sell: ['KeyS', 'Delete'],
};

const PREVENT = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'AltLeft', 'AltRight', 'Tab', 'F9', 'ControlLeft',
]);

export class Input {
  private down = new Set<string>();
  private pressedKeys = new Set<string>();
  private releasedKeys = new Set<string>();
  mouse = { x: 0, y: 0, down: false, clicked: false, rclicked: false, moved: false };
  anyKey = false;
  onFirstInteract: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement, private logicalW: number, private logicalH: number) {
    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code) || e.altKey) e.preventDefault();
      if (!this.down.has(e.code)) this.pressedKeys.add(e.code);
      this.down.add(e.code);
      this.anyKey = true;
      this.interact();
    });
    window.addEventListener('keyup', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      this.down.delete(e.code);
      this.releasedKeys.add(e.code);
    });
    window.addEventListener('blur', () => this.down.clear());
    canvas.addEventListener('mousemove', (e) => this.updateMouse(e));
    canvas.addEventListener('mousedown', (e) => {
      this.updateMouse(e);
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      } else if (e.button === 2) this.mouse.rclicked = true;
      canvas.focus();
      this.interact();
    });
    window.addEventListener('mouseup', () => (this.mouse.down = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private interact() {
    if (this.onFirstInteract) this.onFirstInteract();
  }

  private updateMouse(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - r.left) / r.width) * this.logicalW;
    this.mouse.y = ((e.clientY - r.top) / r.height) * this.logicalH;
    this.mouse.moved = true;
  }

  isDown(a: Action) {
    for (const k of BINDINGS[a]) if (this.down.has(k)) return true;
    return false;
  }
  pressed(a: Action) {
    for (const k of BINDINGS[a]) if (this.pressedKeys.has(k)) return true;
    return false;
  }
  released(a: Action) {
    for (const k of BINDINGS[a]) if (this.releasedKeys.has(k)) return true;
    return false;
  }
  /** 消耗某个按键的 pressed 状态，防止同一帧被多处响应 */
  consume(a: Action) {
    for (const k of BINDINGS[a]) this.pressedKeys.delete(k);
  }
  consumeAll() {
    this.pressedKeys.clear();
    this.mouse.clicked = false;
    this.mouse.rclicked = false;
  }
  endFrame() {
    this.pressedKeys.clear();
    this.releasedKeys.clear();
    this.mouse.clicked = false;
    this.mouse.rclicked = false;
    this.mouse.moved = false;
    this.anyKey = false;
  }
}
