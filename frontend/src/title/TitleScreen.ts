import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * 3D title screen (Three.js): old CRT TV on a VHS player with a stack of CDs,
 * red screen glow and a bloody, glitching "TIPU!" on the TV.
 * Menu on the right: PLAY / HOW TO PLAY / SETTINGS. No title text.
 *
 * Rendered in its own canvas on top of the Phaser canvas; removed when PLAY is pressed.
 */
export interface TitleCallbacks {
  onPlay: () => void;
  onHowTo: () => void;
  onSettings: () => void;
}

const SCREEN_W = 1024;
const SCREEN_H = 768;

export async function showTitleScreen(cb: TitleCallbacks): Promise<() => void> {
  const root = document.createElement('div');
  root.id = 'title-root';
  root.innerHTML = `
    <style>
      #title-root{position:fixed;inset:0;z-index:20;background:#07060a;overflow:hidden;font-family:"Courier New",monospace}
      #title-root canvas{display:block;width:100%;height:100%}
      #title-menu{position:absolute;left:60%;top:39%;display:flex;flex-direction:column;gap:2.2vh}
      #title-menu button{all:unset;cursor:pointer;color:#e8c9b8;font-size:min(3.2vw,5.6vh);letter-spacing:.12em;font-weight:bold;
        display:flex;gap:1.6vw;align-items:center;text-shadow:0 0 12px rgba(255,40,40,.35);transition:color .15s, transform .15s}
      #title-menu button span{width:2.2vw;display:inline-block;text-align:center;color:#c8a89a}
      #title-menu button:hover,#title-menu button:focus-visible{color:#ff3a2a;transform:translateX(.6vw)}
      #title-menu button:focus-visible{outline:2px solid #ff3a2a;outline-offset:6px}
      #title-hint{position:absolute;right:2vw;bottom:2vh;color:#6d5a55;font-size:min(1.1vw,1.9vh)}
      #title-fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .6s}
    </style>
    <div id="title-menu">
      <button id="t-play"><span>▶</span>PLAY</button>
      <button id="t-how"><span>?</span>HOW TO PLAY</button>
      <button id="t-set"><span>⚙</span>SETTINGS</button>
    </div>
    <div id="title-hint">Best with sound on · desktop browser</div>
    <div id="title-fade"></div>`;
  document.body.appendChild(root);

  const font = new FontFace('Creepster', 'url(/fonts/creepster.woff2)');
  await font.load().then((f) => document.fonts.add(f)).catch(() => undefined);

  // ---- renderer / scene ----
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  root.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060a);
  scene.fog = new THREE.Fog(0x07060a, 4, 12);
  const cam = new THREE.PerspectiveCamera(35, 16 / 9, 0.01, 100);
  scene.add(new THREE.AmbientLight(0x404060, 0.35));
  const lamp = new THREE.PointLight(0xffaa66, 14, 10, 2);
  lamp.position.set(-1.6, 1.6, 1.4);
  lamp.castShadow = true;
  scene.add(lamp);
  const rim = new THREE.DirectionalLight(0x6688ff, 0.5);
  rim.position.set(2, 2, -2);
  scene.add(rim);
  const screenGlow = new THREE.PointLight(0xff2a2a, 8, 5, 2);
  scene.add(screenGlow);

  const top = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.08, 1.6), new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.8 }));
  top.position.set(0.8, -0.04, 0);
  top.receiveShadow = true;
  scene.add(top);

  const fit = (obj: THREE.Object3D, size: number) => {
    const b = new THREE.Box3().setFromObject(obj);
    const sz = b.getSize(new THREE.Vector3());
    obj.scale.multiplyScalar(size / Math.max(sz.x, sz.y, sz.z));
    const b2 = new THREE.Box3().setFromObject(obj);
    obj.position.x -= (b2.min.x + b2.max.x) / 2;
    obj.position.z -= (b2.min.z + b2.max.z) / 2;
    obj.position.y -= b2.min.y;
    obj.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) m.castShadow = m.receiveShadow = true;
    });
    return obj;
  };

  const loader = new GLTFLoader();
  const [tv, vcr] = await Promise.all([loader.loadAsync('/3d/old_tv.glb'), loader.loadAsync('/3d/vhs_player.glb')]);
  const vcrO = fit(vcr.scene, 1.1);
  scene.add(vcrO);
  const vb = new THREE.Box3().setFromObject(vcrO);
  const tvO = fit(tv.scene, 1.3);
  tvO.position.y += vb.max.y;
  scene.add(tvO);
  const tb = new THREE.Box3().setFromObject(tvO);
  screenGlow.position.set(0, (tb.min.y + tb.max.y) / 2, tb.max.z + 0.4);

  // ---- TV screen: canvas texture with a bloody TIPU! ----
  const base = document.createElement('canvas');
  base.width = SCREEN_W;
  base.height = SCREEN_H;
  drawTipu(base.getContext('2d')!);
  const cv = document.createElement('canvas');
  cv.width = SCREEN_W;
  cv.height = SCREEN_H;
  const g = cv.getContext('2d')!;
  g.drawImage(base, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sw = tb.max.x - tb.min.x;
  const sh = tb.max.y - tb.min.y;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(sw * 0.52, sh * 0.6),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, depthTest: false }),
  );
  screen.position.set(tb.min.x + sw * 0.4, tb.min.y + sh * 0.54, tb.max.z - 0.07);
  screen.renderOrder = 999;
  scene.add(screen);

  scene.add(makeCdStack());

  cam.position.set(1.55, tb.max.y * 0.78, 3.5);
  cam.lookAt(0.85, tb.max.y * 0.5, 0);

  // ---- sizing: keep a 16:9 view, cover the window ----
  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.fov = w / h < 16 / 9 ? 35 * ((16 / 9) / (w / h)) ** 0.75 : 35;
    cam.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  // ---- glitch loop ----
  let running = true;
  let seed = 1;
  let burstUntil = 0;
  let forced = 0;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const frame = (t: number) => {
    if (!running) return;
    if (t > burstUntil && Math.random() < 0.02) burstUntil = t + 120 + Math.random() * 380;
    const amt = Math.max(forced, t < burstUntil ? 0.4 + Math.random() * 0.6 : 0.08 * Math.random());
    glitch(g, base, amt, rnd);
    tex.needsUpdate = true;
    screenGlow.intensity = 8 * (0.75 + 0.5 * Math.random() * (amt > 0.2 ? 1 : 0.4));
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const destroy = () => {
    running = false;
    window.removeEventListener('resize', resize);
    renderer.dispose();
    renderer.forceContextLoss();
    root.remove();
  };

  const fade = root.querySelector<HTMLDivElement>('#title-fade')!;
  root.querySelector('#t-play')!.addEventListener('click', () => {
    forced = 1;
    fade.style.opacity = '1';
    setTimeout(() => {
      destroy();
      cb.onPlay();
    }, 700);
  });
  root.querySelector('#t-how')!.addEventListener('click', cb.onHowTo);
  root.querySelector('#t-set')!.addEventListener('click', cb.onSettings);
  root.querySelector<HTMLButtonElement>('#t-play')!.focus();
  return destroy;
}

function roundedClip(g: CanvasRenderingContext2D): void {
  const r = 110;
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = '#000';
  g.beginPath();
  g.moveTo(r, 0);
  g.lineTo(SCREEN_W - r, 0);
  g.quadraticCurveTo(SCREEN_W, 0, SCREEN_W, r);
  g.lineTo(SCREEN_W, SCREEN_H - r);
  g.quadraticCurveTo(SCREEN_W, SCREEN_H, SCREEN_W - r, SCREEN_H);
  g.lineTo(r, SCREEN_H);
  g.quadraticCurveTo(0, SCREEN_H, 0, SCREEN_H - r);
  g.lineTo(0, r);
  g.quadraticCurveTo(0, 0, r, 0);
  g.fill();
  g.globalCompositeOperation = 'source-over';
}

function drawTipu(g: CanvasRenderingContext2D): void {
  const grd = g.createRadialGradient(512, 384, 50, 512, 384, 620);
  grd.addColorStop(0, '#2a0608');
  grd.addColorStop(1, '#050102');
  g.fillStyle = grd;
  g.fillRect(0, 0, SCREEN_W, SCREEN_H);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random() * 90;
    g.fillStyle = `rgba(${v + 40},${v * 0.3},${v * 0.3},0.3)`;
    g.fillRect(Math.random() * SCREEN_W, Math.random() * SCREEN_H, 2, 2);
  }
  g.save();
  g.translate(512, 360);
  g.rotate(-0.05);
  g.font = '330px Creepster, Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,30,30,1)';
  g.shadowBlur = 70;
  g.fillStyle = '#9e0b0b';
  g.fillText('TIPU!', 0, 0);
  g.shadowBlur = 0;
  const tg = g.createLinearGradient(0, -150, 0, 150);
  tg.addColorStop(0, '#ff4a3a');
  tg.addColorStop(1, '#d00000');
  g.fillStyle = tg;
  g.fillText('TIPU!', 0, 0);
  g.fillStyle = '#d01010';
  for (let i = 0; i < 9; i++) {
    const x = -330 + Math.random() * 660;
    const y = 60 + Math.random() * 40;
    const len = 60 + Math.random() * 160;
    const w = 6 + Math.random() * 8;
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.lineTo(x + w / 2, y);
    g.lineTo(x + w * 0.35, y + len);
    g.arc(x, y + len, w * 0.75, 0, Math.PI * 2);
    g.lineTo(x - w * 0.35, y + len);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.fillStyle = 'rgba(0,0,0,0.3)';
  for (let y = 0; y < SCREEN_H; y += 4) g.fillRect(0, y, SCREEN_W, 2);
  roundedClip(g);
}

function glitch(g: CanvasRenderingContext2D, base: HTMLCanvasElement, amt: number, rnd: () => number): void {
  g.clearRect(0, 0, SCREEN_W, SCREEN_H);
  g.globalAlpha = 1;
  g.drawImage(base, 0, 0);
  if (amt > 0) {
    const sh = amt * 40 * (rnd() - 0.3);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.35 * amt;
    g.drawImage(base, sh, 0);
    g.globalAlpha = 0.25 * amt;
    g.drawImage(base, -sh * 0.7, 2);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    const n = Math.floor(3 + amt * 14);
    for (let i = 0; i < n; i++) {
      const y = rnd() * SCREEN_H;
      const h = 6 + rnd() * 60 * amt;
      const dx = (rnd() - 0.5) * 260 * amt;
      g.drawImage(base, 0, y, SCREEN_W, h, dx, y, SCREEN_W, h);
    }
    g.fillStyle = `rgba(255,${80 + rnd() * 80},${80 + rnd() * 60},${0.15 + 0.3 * amt})`;
    g.fillRect(0, rnd() * 700, SCREEN_W, 10 + 30 * amt);
    for (let i = 0; i < 2500 * amt; i++) {
      const v = rnd() * 255;
      g.fillStyle = `rgba(${v},${v * 0.35},${v * 0.35},0.5)`;
      g.fillRect(rnd() * SCREEN_W, rnd() * SCREEN_H, 2, 2);
    }
    if (amt > 0.8) {
      g.fillStyle = 'rgba(255,30,30,0.15)';
      g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
  }
  roundedClip(g);
}

function makeCdStack(): THREE.Group {
  const cds = new THREE.Group();
  const caseM = new THREE.MeshStandardMaterial({ color: 0x99aab0, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.85 });
  const spines = [0x1d1d22, 0x7a1414, 0x223355, 0xd8d0b8, 0x1d1d22, 0x2c4a2c, 0xb08a2a, 0x1d1d22, 0x553355];
  spines.forEach((c, i) => {
    const gp = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.022, 0.25), caseM);
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.25), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    sp.position.x = -0.14;
    gp.add(b, sp);
    gp.position.y = 0.011 + i * 0.023;
    gp.rotation.y = Math.sin(i * 2.3) * 0.25;
    gp.position.x = Math.sin(i * 1.7) * 0.02;
    gp.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) m.castShadow = m.receiveShadow = true;
    });
    cds.add(gp);
  });
  const t1 = new THREE.Group();
  [0x1d1d22, 0xd8d0b8, 0x7a1414].forEach((_, i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.022, 0.25), caseM);
    b.position.y = 0.011 + i * 0.023;
    b.rotation.y = 0.4 + i * 0.2;
    t1.add(b);
  });
  t1.position.set(0.32, 0, 0.08);
  cds.add(t1);
  cds.position.set(0.95, 0, 0.35);
  cds.rotation.y = -0.4;
  cds.scale.setScalar(0.85);
  return cds;
}
