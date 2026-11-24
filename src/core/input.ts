// 键盘 + 鼠标输入管理：支持【现代动作键位 WASD+JKL/鼠标】与【冒险岛经典方向键位】一键切换
export type ControlScheme = 'modern' | 'classic';

export type Action =
  | 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'skill1' | 'skill2'
  | 'interact' | 'potHp' | 'potMp' | 'job1' | 'job2' | 'job3' | 'inventory'
  | 'mute' | 'pause' | 'confirm' | 'cancel' | 'cheat' | 'sell' | 'scheme';

const SCHEME_KEY = 'starlight_story_scheme_v1';

const PRESETS: Record<ControlScheme, Record<Action, string[]>> = {
  // 默认推荐：现代横版动作人体工学（左手 WASD + Space/Shift，右手 JKL 或鼠标，同时兼容方向键移动）
  modern: {
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    jump: ['Space', 'KeyK'],
    attack: ['KeyJ'],
    skill1: ['KeyQ', 'KeyU'],
    skill2: ['KeyL', 'ShiftLeft', 'ShiftRight'],
    interact: ['KeyF', 'KeyE', 'KeyW', 'ArrowUp'],
    potHp: ['KeyZ', 'Digit4', 'Numpad4'],
    potMp: ['KeyX', 'Digit5', 'Numpad5'],
    job1: ['Digit1', 'Numpad1'],
    job2: ['Digit2', 'Numpad2'],
    job3: ['Digit3', 'Numpad3'],
    inventory: ['Tab', 'KeyI', 'KeyB'],
    mute: ['KeyM'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'KeyF'],
    cancel: ['Escape'],
    cheat: ['F9'],
    sell: ['KeyS', 'Delete'],
    scheme: ['F2'],
  },
  // 冒险岛人体工学经典键位（右手方向键精准走位，左手自然搭在 D/Q/W/Space，告别小指抽筋）
  classic: {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    jump: ['Space', 'KeyC', 'AltLeft', 'AltRight'],
    attack: ['KeyD', 'KeyA', 'ControlLeft', 'ControlRight'],
    skill1: ['KeyQ', 'KeyS'],
    skill2: ['KeyW', 'KeyF', 'ShiftLeft', 'ShiftRight'],
    interact: ['ArrowUp', 'KeyE'],
    potHp: ['KeyZ', 'Digit4', 'Numpad4'],
    potMp: ['KeyX', 'Digit5', 'Numpad5'],
    job1: ['Digit1', 'Numpad1'],
    job2: ['Digit2', 'Numpad2'],
    job3: ['Digit3', 'Numpad3'],
    inventory: ['Tab', 'KeyI', 'KeyB'],
    mute: ['KeyM'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'NumpadEnter', 'Space'],
    cancel: ['Escape'],
    cheat: ['F9'],
    sell: ['KeyS', 'Delete'],
    scheme: ['F2'],
  },
};

export const SCHEME_LABELS: Record<ControlScheme, {
  name: string;
  short: string;
  move: string;
  jump: string;
  drop: string;
  attack: string;
  skill1: string;
  skill2: string;
  interact: string;
  potHp: string;
  potMp: string;
  bag: string;
}> = {
  modern: {
    name: '现代动作 (WASD+JKL/鼠标)',
    short: '现代',
    move: 'WASD / 方向键',
    jump: 'Space / K',
    drop: 'S+Space / 双击S',
    attack: 'J',
    skill1: 'Q/U',
    skill2: 'L/Sh',
    interact: 'F',
    potHp: 'Z',
    potMp: 'X',
    bag: 'Tab/I',
  },
  classic: {
    name: '冒险岛经典 (方向键+DQW)',
    short: '经典',
    move: '方向键 ←→↑↓',
    jump: 'Space / C',
    drop: '↓+Space / 双击↓',
    attack: 'D/A',
    skill1: 'Q',
    skill2: 'W/F',
    interact: '↑/E',
    potHp: 'Z',
    potMp: 'X',
    bag: 'I/B',
  },
};

const PREVENT = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'AltLeft', 'AltRight', 'Tab', 'F9', 'F2', 'ControlLeft',
]);

export class Input {
  private down = new Set<string>();
  private pressedKeys = new Set<string>();
  private releasedKeys = new Set<string>();
  scheme: ControlScheme = 'modern';
  mouse = { x: 0, y: 0, down: false, rdown: false, clicked: false, rclicked: false, moved: false };
  anyKey = false;
  onFirstInteract: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement, private logicalW: number, private logicalH: number) {
    try {
      const saved = localStorage.getItem(SCHEME_KEY);
      if (saved === 'modern' || saved === 'classic') this.scheme = saved;
    } catch { /* ignore */ }

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
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouse.down = false;
      this.mouse.rdown = false;
    });
    canvas.addEventListener('mousemove', (e) => this.updateMouse(e));
    canvas.addEventListener('mousedown', (e) => {
      this.updateMouse(e);
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      } else if (e.button === 2) {
        this.mouse.rdown = true;
        this.mouse.rclicked = true;
      }
      canvas.focus();
      this.interact();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      else if (e.button === 2) this.mouse.rdown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setScheme(s: ControlScheme) {
    this.scheme = s;
    try { localStorage.setItem(SCHEME_KEY, s); } catch { /* ignore */ }
  }

  toggleScheme(): ControlScheme {
    const next: ControlScheme = this.scheme === 'modern' ? 'classic' : 'modern';
    this.setScheme(next);
    return next;
  }

  labels() {
    return SCHEME_LABELS[this.scheme];
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

  /** 是否在游戏主战区（排除底部 HUD 与右上迷你地图），用于在现代模式下安全支持鼠标普攻/位移 */
  mouseInPlayfield() {
    if (this.mouse.y >= 310) return false;
    if (this.mouse.x >= 492 && this.mouse.y <= 128) return false;
    return true;
  }

  isDown(a: Action) {
    for (const k of PRESETS[this.scheme][a]) if (this.down.has(k)) return true;
    return false;
  }
  pressed(a: Action) {
    for (const k of PRESETS[this.scheme][a]) if (this.pressedKeys.has(k)) return true;
    return false;
  }
  released(a: Action) {
    for (const k of PRESETS[this.scheme][a]) if (this.releasedKeys.has(k)) return true;
    return false;
  }
  consume(a: Action) {
    for (const k of PRESETS[this.scheme][a]) this.pressedKeys.delete(k);
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
