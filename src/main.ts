import { Game } from './game/game';
import { VIEW_W, VIEW_H } from './gfx/backgrounds';

const canvas = document.getElementById('game') as HTMLCanvasElement;

function resize() {
  const aspect = VIEW_W / VIEW_H;
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  let w = ww;
  let h = w / aspect;
  if (h > wh) {
    h = wh;
    w = h * aspect;
  }
  canvas.style.width = `${Math.floor(w)}px`;
  canvas.style.height = `${Math.floor(h)}px`;
}

window.addEventListener('resize', resize);
resize();
canvas.focus();

const game = new Game(canvas);

let last = performance.now();
function loop(now: number) {
  const dt = Math.max(0, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
