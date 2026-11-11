// Procedural PBR textures + shared material library. Everything is generated
// in code, so the game needs no image downloads or paid assets.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

let ANISO = 4;
export function setAnisotropy(n) { ANISO = n; }

// ---------- tileable value-noise fields ----------
function periodicNoise(size, cx, cy, rng) {
  const g = new Float32Array(cx * cy);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cy, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
    const y0 = iy % cy, y1 = (iy + 1) % cy;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cx, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
      const x0 = ix % cx, x1 = (ix + 1) % cx;
      const a = g[y0 * cx + x0], b = g[y0 * cx + x1], c = g[y1 * cx + x0], d = g[y1 * cx + x1];
      const top = a + (b - a) * sx, bot = c + (d - c) * sx;
      out[y * size + x] = top + (bot - top) * sy;
    }
  }
  return out;
}

function fbm(size, cx, cy, octaves, seed) {
  const rng = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = periodicNoise(size, cx << o, cy << o, rng);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function pixelTexture(size, fn, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const [r, g, b, a = 255] = fn(x, y, i);
      d[i * 4] = Math.max(0, Math.min(255, r));
      d[i * 4 + 1] = Math.max(0, Math.min(255, g));
      d[i * 4 + 2] = Math.max(0, Math.min(255, b));
      d[i * 4 + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTexture(c, srgb);
}

function finishTexture(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = ANISO;
  t.generateMipmaps = true;
  return t;
}

// ---------- individual generators ----------
const GEN = {
  concrete() {
    const n = fbm(256, 4, 4, 5, 11), rng = mulberry32(3);
    return pixelTexture(256, (x, y, i) => {
      let v = 0.62 + 0.28 * n[i] + (rng() - 0.5) * 0.09;
      if (rng() < 0.004) v -= 0.18; // pores
      return [v * 236, v * 233, v * 226];
    });
  },
  wood() {
    const n = fbm(256, 2, 24, 4, 21), rng = mulberry32(5);
    const plankTone = Array.from({ length: 8 }, () => 0.82 + rng() * 0.3);
    return pixelTexture(256, (x, y) => {
      const p = Math.floor(y / 64);
      const xs = (x + p * 61) % 256;
      const g = n[y * 256 + xs];
      const ring = 0.5 + 0.5 * Math.sin(g * 38);
      let v = plankTone[p] * (0.72 + 0.22 * g + 0.1 * ring);
      if (y % 64 < 2) v *= 0.45; // seam
      return [v * 176, v * 120, v * 72];
    });
  },
  metal() {
    const n = fbm(256, 1, 96, 3, 31), rng = mulberry32(7);
    return pixelTexture(256, (x, y, i) => {
      const v = 0.8 + 0.1 * n[i] + (rng() - 0.5) * 0.04;
      return [v * 222, v * 226, v * 232];
    });
  },
  brick() {
    const n = fbm(256, 8, 8, 3, 41), rng = mulberry32(9);
    const tones = Array.from({ length: 64 }, () => 0.78 + rng() * 0.35);
    return pixelTexture(256, (x, y, i) => {
      const row = Math.floor(y / 32);
      const off = row % 2 ? 32 : 0;
      const col = Math.floor(((x + off) % 256) / 64);
      const lx = (x + off) % 64, ly = y % 32;
      if (lx < 3 || ly < 3) { const m = 0.78 + 0.1 * n[i]; return [m * 205, m * 198, m * 186]; }
      const t = tones[(row * 4 + col) % 64] * (0.88 + 0.2 * n[i]);
      return [t * 158, t * 74, t * 52];
    });
  },
  stone() {
    const n = fbm(256, 6, 6, 5, 51), m = fbm(256, 3, 3, 2, 52), rng = mulberry32(11);
    return pixelTexture(256, (x, y, i) => {
      const v = 0.5 + 0.38 * n[i] + 0.12 * m[i] + (rng() - 0.5) * 0.06;
      return [v * 200, v * 194, v * 184];
    });
  },
  asphalt() {
    const n = fbm(256, 8, 8, 4, 61), rng = mulberry32(13);
    return pixelTexture(256, (x, y, i) => {
      let v = 0.24 + 0.1 * n[i] + (rng() - 0.5) * 0.08;
      if (rng() < 0.03) v += 0.14;
      return [v * 255, v * 255, v * 258];
    });
  },
  foliage() {
    const n = fbm(128, 8, 8, 4, 71), rng = mulberry32(15);
    return pixelTexture(128, (x, y, i) => {
      const v = 0.55 + 0.6 * n[i] + (rng() - 0.5) * 0.15;
      return [v * 92, v * 140, v * 62];
    });
  },
  bark() {
    const n = fbm(128, 24, 2, 4, 81);
    return pixelTexture(128, (x, y, i) => {
      const v = 0.45 + 0.7 * n[i];
      return [v * 110, v * 86, v * 66];
    });
  },
  detail() {
    const n = fbm(256, 8, 8, 5, 91), rng = mulberry32(17);
    return pixelTexture(256, (x, y, i) => {
      const v = 0.76 + 0.26 * n[i] + (rng() - 0.5) * 0.12;
      return [v * 255, v * 255, v * 255];
    });
  },
  waterNormal() {
    const S = 256, k = 0.55;
    const waves = [[3, 1, 0.5, 0.3], [1, 4, 0.42, 1.7], [-2, 3, 0.35, 2.9], [5, -2, 0.22, 0.6],
      [7, 5, 0.13, 4.1], [-9, 4, 0.1, 5.5], [11, 13, 0.06, 1.2], [-15, 7, 0.05, 3.3], [19, -11, 0.035, 0.1]];
    return pixelTexture(S, (x, y) => {
      let dx = 0, dy = 0;
      for (const [fx, fy, a, ph] of waves) {
        const c = Math.cos((2 * Math.PI * (fx * x + fy * y)) / S + ph);
        dx += a * fx * c; dy += a * fy * c;
      }
      let nx = -dx * k, ny = -dy * k, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      return [(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, (nz * 0.5 + 0.5) * 255];
    }, { srgb: false });
  },
  roadMarkings() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512);
    g.fillStyle = '#f2f2ee';
    g.fillRect(18, 0, 12, 512); g.fillRect(482, 0, 12, 512);
    g.fillStyle = '#f0c030';
    g.fillRect(250, 40, 12, 160); g.fillRect(250, 296, 12, 160);
    const t = finishTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  },
};

const texCache = new Map();
export function getTex(name) {
  if (!texCache.has(name)) texCache.set(name, GEN[name]());
  return texCache.get(name);
}

// ---------- geometry helper: box with UVs scaled to world size ----------
const boxCache = new Map();
export function boxGeo(w, h, d, tile = 2) {
  const key = `${w}|${h}|${d}|${tile}`;
  if (boxCache.has(key)) return boxCache.get(key);
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px nx py ny pz nz
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  }
  boxCache.set(key, g);
  return g;
}

// ---------- material library ----------
export const MATERIALS = {
  concrete: { label: 'Concrete', tex: 'concrete', rough: 0.92, metal: 0, color: '#ffffff' },
  wood: { label: 'Wood', tex: 'wood', rough: 0.7, metal: 0, color: '#ffffff' },
  metal: { label: 'Steel', tex: 'metal', rough: 0.3, metal: 1, color: '#ffffff' },
  glass: { label: 'Glass', rough: 0.04, metal: 0, color: '#a8d0e0', glass: true },
  brick: { label: 'Brick', tex: 'brick', rough: 0.88, metal: 0, color: '#ffffff' },
  stone: { label: 'Stone', tex: 'stone', rough: 0.86, metal: 0, color: '#ffffff' },
  plastic: { label: 'Plastic', rough: 0.38, metal: 0, color: '#e6e6e6' },
  asphalt: { label: 'Asphalt', tex: 'asphalt', rough: 0.95, metal: 0, color: '#ffffff' },
};
// internal-only materials (not shown in the material editor)
const INTERNAL = {
  foliage: { tex: 'foliage', rough: 0.9, metal: 0, color: '#ffffff' },
  bark: { tex: 'bark', rough: 0.95, metal: 0, color: '#ffffff' },
  darkmetal: { tex: 'metal', rough: 0.45, metal: 0.9, color: '#5a5f66' },
  rubber: { rough: 0.9, metal: 0, color: '#222222' },
  light: { rough: 0.3, metal: 0, color: '#fff6dd', emissive: '#ffe2a0' },
  paint: { tex: 'roadMarkings', rough: 0.6, metal: 0, color: '#ffffff', alphaTest: 0.5 },
};

export const PALETTE = [
  null, '#f4f4f2', '#b9bcc0', '#6d7177', '#2b2e33', '#c0392b', '#e67e22', '#f1c40f',
  '#27ae60', '#16a085', '#2e86de', '#34495e', '#8e44ad', '#8d5a3b', '#d8c3a5', '#f78fb3',
];

const lightMaterials = [];
export function setNightFactor(f) {
  for (const m of lightMaterials) m.emissiveIntensity = 0.35 + f * 3.2;
}

const matCache = new Map();
export function getMaterial(name, color = null) {
  const key = `${name}|${color || ''}`;
  if (matCache.has(key)) return matCache.get(key);
  const def = MATERIALS[name] || INTERNAL[name] || MATERIALS.concrete;
  const col = new THREE.Color(color || def.color);
  let m;
  if (def.glass) {
    m = new THREE.MeshStandardMaterial({
      color: col, roughness: def.rough, metalness: 0.0, transparent: true, opacity: 0.32,
      envMapIntensity: 2.2, depthWrite: false, side: THREE.DoubleSide,
    });
    m.userData.glass = true;
  } else {
    m = new THREE.MeshStandardMaterial({
      color: col, roughness: def.rough, metalness: def.metal,
      map: def.tex ? getTex(def.tex) : null,
    });
    if (def.alphaTest) { m.alphaTest = def.alphaTest; m.transparent = false; }
    if (def.emissive) {
      m.emissive = new THREE.Color(def.emissive);
      m.emissiveIntensity = 1;
      lightMaterials.push(m);
    }
  }
  m.userData.matName = name;
  matCache.set(key, m);
  return m;
}
