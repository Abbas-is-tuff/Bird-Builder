// Building library: every placeable object. Each item builds a THREE.Group whose
// origin sits at the centre of its base (y = 0 is the floor contact point).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { boxGeo, getMaterial } from './textures.js';
import { makeNoise } from './noise.js';

export const CATEGORIES = [
  { id: 'structures', label: 'Structures' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'nature', label: 'Nature' },
  { id: 'decoration', label: 'Decoration' },
  { id: 'birds', label: 'Bird Stuff' },
];

// the bird statue borrows the bird model; main.js plugs the factory in (avoids an import cycle)
let statueFactory = null;
export function setStatueFactory(fn) { statueFactory = fn; }

const geoCache = new Map();
const cg = (key, fn) => { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); };

function B(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}
function Cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 20) {
  const m = new THREE.Mesh(cg(`cyl${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}
function Mx(key, geoFn, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(cg(key, geoFn), mat);
  m.position.set(x, y, z);
  return m;
}
// a hinge/slider: children move with it; anim says how it opens
function P(x, y, z, anim, ...children) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.userData.anim = anim; // { prop: 'rotation'|'position'|'scale', axis, closed, open }
  children.flat().forEach((c) => g.add(c));
  return g;
}
const glow = (m, kind) => { m.userData.glow = kind; return m; };
function G(...children) { const g = new THREE.Group(); children.flat().forEach((c) => g.add(c)); return g; }

function extrudeShape(key, pts, depth, uvScale = 0.5) {
  return cg(key, () => {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
    return g;
  });
}

// organic blob geometry for foliage / rocks (smooth, deterministic)
const blobNoise = makeNoise(99);
function blob(radius, detail, amount, seed, sx = 1, sy = 1, sz = 1) {
  let g = new THREE.IcosahedronGeometry(radius, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = blobNoise(x * 1.3 + seed, z * 1.3 + y * 0.7 - seed) * amount;
    const k = 1 + n;
    p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  g.computeVertexNormals();
  // simple spherical UVs so textures show
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = Math.atan2(p.getZ(i), p.getX(i)) / Math.PI + 1;
    uv[i * 2 + 1] = p.getY(i) * 0.5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export const crownGeometry = () => cg('crown', () => {
  const parts = [
    blob(1.9, 2, 0.22, 1).translate(0, 4.6, 0),
    blob(1.4, 2, 0.25, 2).translate(0.9, 4.0, 0.4),
    blob(1.45, 2, 0.25, 3).translate(-0.8, 4.1, -0.5),
    blob(1.2, 2, 0.25, 4).translate(0.1, 5.7, 0.2),
  ];
  return mergeGeometries(parts);
});
export const pineGeometry = () => cg('pine', () => {
  const cones = [[2.3, 3.2, 2.4], [1.8, 2.8, 4.1], [1.2, 2.4, 5.7], [0.6, 1.6, 7.0]].map(([r, h, y]) => {
    const c = new THREE.ConeGeometry(r, h, 10, 1);
    c.translate(0, y, 0);
    return c;
  });
  return mergeGeometries(cones);
});
export const rockGeometry = () => cg('rock', () => blob(1, 2, 0.32, 7, 1.25, 0.75, 1));

// ---------- the library ----------
export const LIBRARY = [
  // STRUCTURES
  { id: 'wall', name: 'Wall', cat: 'structures', mat: 'concrete', build: (M) => G(B(4, 3, 0.25, M.main)) },
  { id: 'halfwall', name: 'Half Wall', cat: 'structures', mat: 'brick', build: (M) => G(B(4, 1.2, 0.25, M.main)) },
  { id: 'floor', name: 'Floor', cat: 'structures', mat: 'wood', build: (M) => G(B(4, 0.2, 4, M.main)) },
  { id: 'pillar', name: 'Pillar', cat: 'structures', mat: 'concrete', build: (M) => G(B(0.4, 3, 0.4, M.main)) },
  { id: 'column', name: 'Round Column', cat: 'structures', mat: 'stone', build: (M) => G(Cyl(0.3, 0.3, 3, M.main), B(0.8, 0.15, 0.8, M.main), B(0.8, 0.15, 0.8, M.main, 0, 2.85)) },
  { id: 'beam', name: 'Beam', cat: 'structures', mat: 'metal', build: (M) => G(B(4, 0.3, 0.3, M.main)) },
  {
    id: 'stairs', name: 'Stairs', cat: 'structures', mat: 'concrete',
    build: (M) => G(Array.from({ length: 10 }, (_, i) => B(2, (i + 1) * 0.3, 0.3, M.main, 0, 0, 1.35 - i * 0.3))),
  },
  {
    id: 'roof', name: 'Gable Roof', cat: 'structures', mat: 'stone', color: '#8a3b2e',
    build: (M) => G(new THREE.Mesh(extrudeShape('roof', [[-2.2, 0], [2.2, 0], [0, 1.6]], 4.2), M.main)),
  },
  {
    id: 'door', name: 'Door Wall', cat: 'structures', mat: 'concrete', interact: { verbs: ['Open Door', 'Close Door'] },
    build: (M) => {
      const wood = M.get('wood', '#9b6a45'), metal = M.get('darkmetal');
      const knob = (z) => Mx('knob', () => new THREE.SphereGeometry(0.05, 12, 8), metal, 0.9, 1.05, z);
      return G(B(1.45, 3, 0.25, M.main, -1.275), B(1.45, 3, 0.25, M.main, 1.275), B(1.1, 0.8, 0.25, M.main, 0, 2.2),
        P(-0.52, 0, 0, { prop: 'rotation', axis: 'y', closed: 0, open: -1.75 }, B(1.04, 2.18, 0.07, wood, 0.52, 0.01), knob(0.08), knob(-0.08)));
    },
  },
  {
    id: 'window', name: 'Window Wall', cat: 'structures', mat: 'concrete', interact: { verbs: ['Open Window', 'Close Window'] },
    build: (M) => {
      const glass = M.get('glass'), frame = M.get('darkmetal');
      return G(B(4, 1, 0.25, M.main), B(4, 0.8, 0.25, M.main, 0, 2.2), B(1.2, 1.2, 0.25, M.main, -1.4, 1), B(1.2, 1.2, 0.25, M.main, 1.4, 1),
        P(0, 2.2, 0, { prop: 'rotation', axis: 'x', closed: 0, open: -0.95 },
          B(1.6, 1.2, 0.03, glass, 0, -1.2), B(0.05, 1.2, 0.08, frame, 0, -1.2), B(1.6, 0.05, 0.08, frame, 0, -0.625), B(1.6, 0.06, 0.08, frame, 0, -1.2), B(1.6, 0.06, 0.08, frame, 0, -0.06)));
    },
  },
  { id: 'glasspanel', name: 'Glass Panel', cat: 'structures', mat: 'glass', build: (M) => G(B(2, 3, 0.05, M.main), B(2, 0.06, 0.1, M.get('darkmetal'), 0, 0), B(2, 0.06, 0.1, M.get('darkmetal'), 0, 2.94)) },

  // SHAPES
  { id: 'block', name: 'Block', cat: 'shapes', mat: 'concrete', build: (M) => G(B(1, 1, 1, M.main)) },
  { id: 'plate', name: 'Plate', cat: 'shapes', mat: 'metal', build: (M) => G(B(2, 0.1, 2, M.main)) },
  {
    id: 'sphere', name: 'Sphere', cat: 'shapes', mat: 'plastic', color: '#2e86de',
    build: (M) => { const m = new THREE.Mesh(cg('sphere', () => new THREE.SphereGeometry(0.5, 32, 20)), M.main); m.position.y = 0.5; return G(m); },
  },
  { id: 'cylinder', name: 'Cylinder', cat: 'shapes', mat: 'plastic', color: '#c0392b', build: (M) => G(Cyl(0.5, 0.5, 1, M.main, 0, 0, 0, 32)) },
  {
    id: 'cone', name: 'Cone', cat: 'shapes', mat: 'plastic', color: '#e67e22',
    build: (M) => { const m = new THREE.Mesh(cg('cone', () => new THREE.ConeGeometry(0.5, 1, 32)), M.main); m.position.y = 0.5; return G(m); },
  },
  { id: 'ramp', name: 'Ramp', cat: 'shapes', mat: 'concrete', build: (M) => G(new THREE.Mesh(extrudeShape('ramp', [[-1, 0], [1, 0], [1, 1]], 2), M.main)) },

  // INFRASTRUCTURE
  {
    id: 'road', name: 'Road', cat: 'infrastructure', mat: 'asphalt',
    build: (M) => {
      const marks = new THREE.Mesh(cg('roadplane', () => new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2)), M.get('paint'));
      marks.position.y = 0.122;
      return G(B(8, 0.12, 8, M.main), marks);
    },
  },
  { id: 'sidewalk', name: 'Sidewalk', cat: 'infrastructure', mat: 'concrete', build: (M) => G(B(2, 0.25, 4, M.main)) },
  {
    id: 'streetlight', name: 'Streetlight', cat: 'infrastructure', mat: 'darkmetal', interact: { verbs: ['Turn On', 'Turn Off'], initial: true, toggle: true },
    build: (M) => G(Cyl(0.08, 0.13, 6, M.main), B(1.5, 0.08, 0.08, M.main, 0.7, 5.88), B(0.7, 0.14, 0.32, M.main, 1.35, 5.76),
      glow(B(0.56, 0.03, 0.24, M.get('light'), 1.35, 5.74), 'light'), Cyl(0.22, 0.22, 0.1, M.main)),
  },
  {
    id: 'stopsign', name: 'Stop Sign', cat: 'infrastructure', mat: 'plastic', color: '#c0392b',
    build: (M) => {
      const sign = new THREE.Mesh(cg('octa', () => new THREE.CylinderGeometry(0.38, 0.38, 0.03, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8)), M.main);
      sign.position.set(0, 2.3, 0.05);
      const rim = new THREE.Mesh(cg('octa2', () => new THREE.CylinderGeometry(0.42, 0.42, 0.02, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8)), M.get('plastic', '#f4f4f2'));
      rim.position.set(0, 2.3, 0.035);
      return G(Cyl(0.035, 0.035, 2.35, M.get('metal')), rim, sign);
    },
  },
  { id: 'barrier', name: 'Barrier', cat: 'infrastructure', mat: 'concrete', build: (M) => G(new THREE.Mesh(extrudeShape('jersey', [[-0.3, 0], [0.3, 0], [0.3, 0.08], [0.12, 0.3], [0.09, 0.8], [-0.09, 0.8], [-0.12, 0.3], [-0.3, 0.08]], 3), M.main)) },
  {
    id: 'bridge', name: 'Bridge Deck', cat: 'infrastructure', mat: 'concrete',
    build: (M) => {
      const metal = M.get('darkmetal');
      const parts = [B(8, 0.5, 4, M.main), B(8, 0.08, 0.08, metal, 0, 1.4, 1.9), B(8, 0.08, 0.08, metal, 0, 1.4, -1.9)];
      for (let i = 0; i < 9; i++) for (const z of [1.9, -1.9]) parts.push(B(0.07, 0.95, 0.07, metal, -4 + i, 0.5, z));
      return G(parts);
    },
  },

  // NATURE
  {
    id: 'tree', name: 'Oak Tree', cat: 'nature', mat: 'foliage', color: '#7fae58',
    build: (M) => G(Cyl(0.2, 0.32, 4, M.get('bark')), new THREE.Mesh(crownGeometry(), M.main)),
  },
  {
    id: 'pine', name: 'Pine Tree', cat: 'nature', mat: 'foliage', color: '#4f7a45',
    build: (M) => G(Cyl(0.18, 0.28, 2.5, M.get('bark')), new THREE.Mesh(pineGeometry(), M.main)),
  },
  {
    id: 'bush', name: 'Bush', cat: 'nature', mat: 'foliage', color: '#6f9e4c',
    build: (M) => { const m = new THREE.Mesh(cg('bush', () => blob(0.8, 2, 0.3, 5, 1.2, 0.8, 1.1).translate(0, 0.55, 0)), M.main); return G(m); },
  },
  {
    id: 'rock', name: 'Rock', cat: 'nature', mat: 'stone',
    build: (M) => { const m = new THREE.Mesh(rockGeometry(), M.main); m.position.y = 0.45; return G(m); },
  },

  // DECORATION
  {
    id: 'bench', name: 'Bench', cat: 'decoration', mat: 'wood',
    build: (M) => {
      const metal = M.get('darkmetal');
      return G(B(1.8, 0.05, 0.13, M.main, 0, 0.45, 0.16), B(1.8, 0.05, 0.13, M.main, 0, 0.45, 0), B(1.8, 0.05, 0.13, M.main, 0, 0.45, -0.16),
        B(1.8, 0.13, 0.04, M.main, 0, 0.6, -0.25), B(1.8, 0.13, 0.04, M.main, 0, 0.8, -0.25),
        B(0.06, 0.45, 0.5, metal, -0.8), B(0.06, 0.45, 0.5, metal, 0.8), B(0.06, 0.5, 0.05, metal, -0.8, 0.45, -0.25), B(0.06, 0.5, 0.05, metal, 0.8, 0.45, -0.25));
    },
  },
  {
    id: 'table', name: 'Table', cat: 'decoration', mat: 'wood',
    build: (M) => G(B(1.6, 0.06, 0.9, M.main, 0, 0.72), ...[[-0.72, -0.38], [0.72, -0.38], [-0.72, 0.38], [0.72, 0.38]].map(([x, z]) => B(0.06, 0.72, 0.06, M.main, x, 0, z))),
  },
  {
    id: 'chair', name: 'Chair', cat: 'decoration', mat: 'wood',
    build: (M) => G(B(0.46, 0.05, 0.46, M.main, 0, 0.45), B(0.46, 0.5, 0.05, M.main, 0, 0.5, -0.205), ...[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z]) => B(0.04, 0.45, 0.04, M.main, x, 0, z))),
  },
  {
    id: 'fence', name: 'Fence', cat: 'decoration', mat: 'wood',
    build: (M) => G(B(0.1, 1.1, 0.1, M.main, -0.95), B(0.1, 1.1, 0.1, M.main, 0), B(0.1, 1.1, 0.1, M.main, 0.95), B(2, 0.09, 0.04, M.main, 0, 0.35, 0.06), B(2, 0.09, 0.04, M.main, 0, 0.8, 0.06)),
  },
  {
    id: 'lamp', name: 'Floor Lamp', cat: 'decoration', mat: 'plastic', color: '#f4f4f2', interact: { verbs: ['Turn On', 'Turn Off'], initial: true, toggle: true },
    build: (M) => {
      const metal = M.get('darkmetal');
      const bulb = glow(new THREE.Mesh(cg('bulb', () => new THREE.SphereGeometry(0.08, 12, 8)), M.get('light')), 'light');
      bulb.position.y = 1.5;
      return G(Cyl(0.18, 0.2, 0.04, metal), Cyl(0.018, 0.018, 1.45, metal, 0, 0.04), bulb, Cyl(0.14, 0.24, 0.3, M.main, 0, 1.4));
    },
  },
  {
    id: 'planter', name: 'Planter', cat: 'decoration', mat: 'concrete',
    build: (M) => {
      const b = new THREE.Mesh(cg('bush', () => blob(0.8, 2, 0.3, 5, 1.2, 0.8, 1.1).translate(0, 0.55, 0)), M.get('foliage', '#6f9e4c'));
      b.position.y = 0.3; b.scale.set(0.6, 0.7, 0.6);
      return G(B(1, 0.5, 1, M.main), b);
    },
  },
  { id: 'crate', name: 'Crate', cat: 'decoration', mat: 'wood', build: (M) => G(B(1, 1, 1, M.main)) },

  // ---------------- MORE STRUCTURES ----------------
  { id: 'halffloor', name: 'Half Floor', cat: 'structures', mat: 'wood', build: (M) => G(B(4, 0.2, 2, M.main)) },
  { id: 'railing', name: 'Railing', cat: 'structures', mat: 'metal', build: (M) => G(B(4, 0.06, 0.08, M.main, 0, 1.0), B(4, 0.05, 0.05, M.main, 0, 0.5), ...[-1.95, -1, 0, 1, 1.95].map((x) => B(0.06, 1.06, 0.06, M.main, x))) },
  {
    id: 'garage', name: 'Garage Wall', cat: 'structures', mat: 'brick', interact: { verbs: ['Open Garage', 'Close Garage'] },
    build: (M) => {
      const door = M.get('metal', '#d0d4d8');
      const panels = []; for (let i = 0; i < 5; i++) panels.push(B(3, 0.48, 0.08, door, 0, -2.5 + i * 0.5));
      return G(B(0.5, 3, 0.25, M.main, -1.75), B(0.5, 3, 0.25, M.main, 1.75), B(3, 0.5, 0.25, M.main, 0, 2.5),
        P(0, 2.5, 0, { prop: 'scale', axis: 'y', closed: 1, open: 0.04 }, panels));
    },
  },
  {
    id: 'shopwindow', name: 'Shop Window', cat: 'structures', mat: 'metal', color: '#3a3f46',
    build: (M) => G(B(4, 0.3, 0.25, M.main), B(4, 0.3, 0.25, M.main, 0, 2.7), B(0.12, 2.4, 0.25, M.main, -1.94, 0.3), B(0.12, 2.4, 0.25, M.main, 1.94, 0.3), B(0.1, 2.4, 0.2, M.main, 0, 0.3), B(3.76, 2.4, 0.04, M.get('glass'), 0, 0.3)),
  },
  { id: 'arch', name: 'Stone Arch', cat: 'structures', mat: 'stone', build: (M) => G(B(0.6, 2.4, 0.6, M.main, -1.7), B(0.6, 2.4, 0.6, M.main, 1.7), Mx('archtop', () => new THREE.TorusGeometry(1.7, 0.3, 10, 24, Math.PI), M.main, 0, 2.4, 0)) },
  { id: 'ladder', name: 'Ladder', cat: 'structures', mat: 'wood', build: (M) => { const p = [B(0.08, 3, 0.08, M.main, -0.25), B(0.08, 3, 0.08, M.main, 0.25)]; for (let i = 0; i < 9; i++) p.push(B(0.5, 0.05, 0.06, M.main, 0, 0.3 + i * 0.32)); return G(p); } },
  { id: 'chimney', name: 'Chimney', cat: 'structures', mat: 'brick', build: (M) => G(B(0.8, 2.2, 0.8, M.main), B(0.95, 0.15, 0.95, M.get('concrete'), 0, 2.2)) },
  { id: 'pyramidroof', name: 'Pyramid Roof', cat: 'structures', mat: 'stone', color: '#8a3b2e', build: (M) => G(Mx('pyrroof', () => new THREE.ConeGeometry(2.97, 2, 4, 1).rotateY(Math.PI / 4).translate(0, 1, 0), M.main)) },
  { id: 'dome', name: 'Dome', cat: 'structures', mat: 'concrete', build: (M) => G(Mx('dome', () => new THREE.SphereGeometry(2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.main)) },

  // ---------------- MORE SHAPES ----------------
  { id: 'pyramid', name: 'Pyramid', cat: 'shapes', mat: 'stone', color: '#e0c088', build: (M) => G(Mx('pyr', () => new THREE.ConeGeometry(0.707, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0), M.main)) },
  { id: 'torus', name: 'Ring', cat: 'shapes', mat: 'plastic', color: '#8e44ad', build: (M) => G(Mx('torus', () => new THREE.TorusGeometry(0.5, 0.18, 16, 40), M.main, 0, 0.68, 0)) },
  { id: 'halfsphere', name: 'Half Sphere', cat: 'shapes', mat: 'plastic', color: '#16a085', build: (M) => G(Mx('hsph', () => new THREE.SphereGeometry(0.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.main)) },
  { id: 'pipe', name: 'Pipe', cat: 'shapes', mat: 'metal', build: (M) => G(Mx('pipe', () => new THREE.CylinderGeometry(0.3, 0.3, 4, 24).rotateZ(Math.PI / 2), M.main, 0, 0.3, 0)) },
  { id: 'hexprism', name: 'Hex Prism', cat: 'shapes', mat: 'concrete', build: (M) => G(Cyl(0.55, 0.55, 1, M.main, 0, 0, 0, 6)) },
  { id: 'capsule', name: 'Capsule', cat: 'shapes', mat: 'plastic', color: '#f1c40f', build: (M) => G(Mx('caps', () => new THREE.CapsuleGeometry(0.35, 0.6, 8, 16), M.main, 0, 0.65, 0)) },

  // ---------------- MORE INFRASTRUCTURE ----------------
  {
    id: 'trafficlight', name: 'Traffic Light', cat: 'infrastructure', mat: 'darkmetal', cycle: true,
    build: (M) => {
      const L = (k, y) => glow(Mx('tl', () => new THREE.SphereGeometry(0.12, 12, 8), M.get('plastic', '#222'), 0, y, 0.18), k);
      return G(Cyl(0.08, 0.1, 3.2, M.main), B(0.4, 1.1, 0.35, M.main, 0, 3.2), L('tl0', 4.05), L('tl1', 3.75), L('tl2', 3.45));
    },
  },
  {
    id: 'crosswalk', name: 'Crosswalk', cat: 'infrastructure', mat: 'asphalt',
    build: (M) => { const w = M.get('plastic', '#f2f2ee'); const p = [B(8, 0.12, 8, M.main)]; for (let i = 0; i < 7; i++) p.push(B(0.5, 0.012, 6, w, -3 + i, 0.12)); return G(p); },
  },
  {
    id: 'busstop', name: 'Bus Stop', cat: 'infrastructure', mat: 'metal',
    build: (M) => G(...[[-1.45, -0.6], [1.45, -0.6], [-1.45, 0.6], [1.45, 0.6]].map(([x, z]) => B(0.08, 2.5, 0.08, M.main, x, 0, z)),
      B(3.1, 0.08, 1.5, M.main, 0, 2.5), B(2.9, 2.0, 0.03, M.get('glass'), 0, 0.4, -0.6), B(2.4, 0.06, 0.4, M.get('wood'), 0, 0.45, -0.35)),
  },
  {
    id: 'hydrant', name: 'Fire Hydrant', cat: 'infrastructure', mat: 'plastic', color: '#c0392b',
    build: (M) => G(Cyl(0.16, 0.18, 0.6, M.main), Mx('hydtop', () => new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.main, 0, 0.6, 0), Mx('hydarm', () => new THREE.CylinderGeometry(0.06, 0.06, 0.5, 10).rotateZ(Math.PI / 2), M.main, 0, 0.42, 0)),
  },
  {
    id: 'powerpole', name: 'Power Pole', cat: 'infrastructure', mat: 'wood', color: '#8d6e52',
    build: (M) => G(Cyl(0.13, 0.16, 9, M.main), B(2.4, 0.12, 0.12, M.main, 0, 8.2), ...[-1, -0.4, 0.4, 1].map((x) => Cyl(0.04, 0.04, 0.15, M.get('plastic', '#e8e8e8'), x, 8.32))),
  },
  { id: 'bollard', name: 'Bollard', cat: 'infrastructure', mat: 'darkmetal', build: (M) => G(Cyl(0.1, 0.1, 0.9, M.main), Cyl(0.106, 0.106, 0.08, M.get('plastic', '#f1c40f'), 0, 0.7)) },
  { id: 'bridgepillar', name: 'Bridge Pillar', cat: 'infrastructure', mat: 'concrete', build: (M) => G(B(1.4, 8, 1.4, M.main), B(3, 0.6, 1.6, M.main, 0, 8)) },

  // ---------------- MORE NATURE ----------------
  {
    id: 'palm', name: 'Palm Tree', cat: 'nature', mat: 'foliage', color: '#6aa84f',
    build: (M) => {
      const bark = M.get('bark', '#c7a67a');
      const p = [];
      for (let i = 0; i < 6; i++) { const s = Cyl(0.2 - i * 0.015, 0.22 - i * 0.015, 1.1, bark, i * 0.12, i * 1.05); s.rotation.z = -0.05 * i; p.push(s); }
      for (let k = 0; k < 7; k++) {
        const leaf = Mx('palmleaf', () => new THREE.SphereGeometry(1, 10, 6).scale(0.28, 0.06, 1.6).translate(0, 0, 1.4), M.main, 0.7, 6.3, 0);
        leaf.rotation.set(0.38, (k / 7) * Math.PI * 2, 0, 'YXZ');
        p.push(leaf);
      }
      return G(p);
    },
  },
  {
    id: 'cactus', name: 'Cactus', cat: 'nature', mat: 'foliage', color: '#4f8f3a',
    build: (M) => {
      const c = (key, r, len, x, y, rz = 0) => { const m = Mx(key, () => new THREE.CapsuleGeometry(r, len, 6, 12), M.main, x, y, 0); m.rotation.z = rz; return m; };
      return G(c('cac0', 0.3, 1.8, 0, 1.2), c('cac1', 0.15, 0.35, 0.42, 1.2, Math.PI / 2), c('cac2', 0.15, 0.5, 0.62, 1.55), c('cac1', 0.15, 0.35, -0.42, 1.6, Math.PI / 2), c('cac2', 0.15, 0.5, -0.62, 1.95));
    },
  },
  {
    id: 'flowers', name: 'Flower Bed', cat: 'nature', mat: 'wood', color: '#6e4b33',
    build: (M) => {
      const p = [B(2, 0.25, 1, M.main), B(1.85, 0.02, 0.85, M.get('stone', '#5a3f2a'), 0, 0.25)];
      const cols = ['#e74c3c', '#f1c40f', '#ffffff', '#e84393', '#9b59b6'];
      for (let i = 0; i < 14; i++) {
        const x = -0.8 + (i % 7) * 0.27, z = i < 7 ? -0.2 : 0.2;
        p.push(Cyl(0.012, 0.012, 0.3, M.get('foliage', '#4f8f3a'), x, 0.25, z, 4), Mx('flw', () => new THREE.SphereGeometry(0.07, 8, 6), M.get('plastic', cols[i % 5]), x, 0.57, z));
      }
      return G(p);
    },
  },
  { id: 'boulder', name: 'Boulder', cat: 'nature', mat: 'stone', build: (M) => { const m = new THREE.Mesh(rockGeometry(), M.main); m.scale.setScalar(2.6); m.position.y = 1.1; return G(m); } },
  { id: 'log', name: 'Log', cat: 'nature', mat: 'bark', build: (M) => G(Mx('log', () => new THREE.CylinderGeometry(0.3, 0.32, 3, 14).rotateZ(Math.PI / 2), M.main, 0, 0.3, 0)) },
  { id: 'hedge', name: 'Hedge', cat: 'nature', mat: 'foliage', color: '#5d8f3f', build: (M) => G(Mx('hedge', () => blob(1, 2, 0.12, 9, 2, 0.65, 0.5).translate(0, 0.62, 0), M.main)) },
  {
    id: 'pond', name: 'Pond', cat: 'nature', mat: 'stone',
    build: (M) => G(Mx('pondrim', () => new THREE.TorusGeometry(1.6, 0.22, 8, 32).rotateX(Math.PI / 2), M.main, 0, 0.12, 0), Cyl(1.6, 1.6, 0.06, M.get('glass', '#3d7fa8'), 0, 0.04, 0, 32)),
  },

  // ---------------- MORE DECORATION ----------------
  { id: 'sofa', name: 'Sofa', cat: 'decoration', mat: 'plastic', color: '#34495e', build: (M) => G(B(2, 0.42, 0.9, M.main), B(2, 0.5, 0.2, M.main, 0, 0.42, -0.35), B(0.2, 0.25, 0.9, M.main, -0.9, 0.42), B(0.2, 0.25, 0.9, M.main, 0.9, 0.42)) },
  {
    id: 'bed', name: 'Bed', cat: 'decoration', mat: 'wood',
    build: (M) => { const pil = M.get('plastic', '#dfe6ee'); return G(B(1.6, 0.35, 2.1, M.main), B(1.5, 0.2, 2, M.get('plastic', '#f4f4f2'), 0, 0.35), B(1.6, 0.9, 0.08, M.main, 0, 0, -1.05), B(0.6, 0.12, 0.35, pil, -0.38, 0.55, -0.72), B(0.6, 0.12, 0.35, pil, 0.38, 0.55, -0.72), B(1.52, 0.06, 1.3, M.get('plastic', '#2e86de'), 0, 0.55, 0.3)); },
  },
  {
    id: 'bookshelf', name: 'Bookshelf', cat: 'decoration', mat: 'wood',
    build: (M) => {
      const p = [B(1.2, 2, 0.04, M.main, 0, 0, -0.18), B(0.04, 2, 0.4, M.main, -0.58), B(0.04, 2, 0.4, M.main, 0.58)];
      for (let i = 0; i < 5; i++) p.push(B(1.12, 0.04, 0.38, M.main, 0, i * 0.48));
      const cols = ['#c0392b', '#2e86de', '#27ae60', '#f1c40f', '#8e44ad'];
      for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) p.push(B(0.12, 0.3 + ((k * 7 + r * 3) % 4) * 0.03, 0.26, M.get('plastic', cols[(k + r) % 5]), -0.45 + k * 0.17, r * 0.48 + 0.04));
      return G(p);
    },
  },
  {
    id: 'tv', name: 'TV', cat: 'decoration', mat: 'darkmetal', interact: { verbs: ['Turn On TV', 'Turn Off TV'], toggle: true },
    build: (M) => G(B(0.5, 0.04, 0.25, M.main), B(0.06, 0.4, 0.06, M.main, 0, 0.04), B(1.4, 0.8, 0.06, M.main, 0, 0.4), glow(B(1.32, 0.72, 0.01, M.get('plastic', '#0d1117'), 0, 0.44, 0.031), 'screen')),
  },
  {
    id: 'fountain', name: 'Fountain', cat: 'decoration', mat: 'stone',
    build: (M) => { const w = M.get('glass', '#5fa8d3'); return G(Cyl(1.5, 1.6, 0.5, M.main, 0, 0, 0, 32), Cyl(1.35, 1.35, 0.02, w, 0, 0.46, 0, 32), Cyl(0.18, 0.25, 1.4, M.main, 0, 0.5), Cyl(0.6, 0.25, 0.25, M.main, 0, 1.7), Cyl(0.5, 0.5, 0.02, w, 0, 1.92, 0, 24)); },
  },
  { id: 'trashbin', name: 'Trash Bin', cat: 'decoration', mat: 'plastic', color: '#27ae60', build: (M) => G(Cyl(0.3, 0.26, 0.9, M.main), Cyl(0.32, 0.32, 0.06, M.main, 0, 0.9)) },
  { id: 'mailbox', name: 'Mailbox', cat: 'decoration', mat: 'metal', color: '#2e86de', build: (M) => G(B(0.08, 1, 0.08, M.get('wood')), B(0.3, 0.32, 0.5, M.main, 0, 1), B(0.02, 0.18, 0.06, M.get('plastic', '#c0392b'), 0.16, 1.15, 0.1)) },
  {
    id: 'flag', name: 'Flag', cat: 'decoration', mat: 'plastic', color: '#27ae60',
    build: (M) => G(Cyl(0.05, 0.06, 6, M.get('metal')), Mx('flagcloth', () => new THREE.BoxGeometry(1.5, 0.9, 0.02), M.main, 0.8, 5.4, 0), Mx('flagball', () => new THREE.SphereGeometry(0.09, 10, 8), M.get('metal', '#d4af37'), 0, 6.05, 0)),
  },
  { id: 'umbrella', name: 'Patio Umbrella', cat: 'decoration', mat: 'plastic', color: '#e67e22', build: (M) => G(Cyl(0.03, 0.03, 2.3, M.get('metal')), Mx('umb', () => new THREE.ConeGeometry(1.4, 0.5, 8), M.main, 0, 2.5, 0), Cyl(0.3, 0.3, 0.05, M.get('darkmetal'))) },
  {
    id: 'car', name: 'Parked Car', cat: 'decoration', mat: 'metal', color: '#c0392b',
    build: (M) => {
      const tire = M.get('rubber'), win = M.get('plastic', '#1d2733'), lamp = M.get('light');
      const w = (x, z) => Mx('wheel', () => new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18).rotateZ(Math.PI / 2), tire, x, 0.34, z);
      return G(B(1.8, 0.6, 4.2, M.main, 0, 0.35), B(1.6, 0.55, 2.2, M.main, 0, 0.95, -0.2), B(1.62, 0.4, 2.22, win, 0, 1.03, -0.2),
        w(-0.85, 1.35), w(0.85, 1.35), w(-0.85, -1.35), w(0.85, -1.35), B(0.3, 0.12, 0.04, lamp, -0.6, 0.65, 2.1), B(0.3, 0.12, 0.04, lamp, 0.6, 0.65, 2.1));
    },
  },
  {
    id: 'slide', name: 'Slide', cat: 'decoration', mat: 'plastic', color: '#e74c3c',
    build: (M) => {
      const metal = M.get('metal');
      const ramp = B(0.6, 0.05, 3.8, M.main); ramp.position.set(0, 1.0, 0.78); ramp.rotation.x = 0.54;
      return G(...[[-0.35, -0.9], [0.35, -0.9], [-0.35, -1.5], [0.35, -1.5]].map(([x, z]) => B(0.08, 2, 0.08, metal, x, 0, z)), B(0.8, 0.06, 0.7, M.main, 0, 1.9, -1.2), ramp);
    },
  },

  // ---------------- OPENABLE ----------------
  {
    id: 'doubledoor', name: 'Double Door', cat: 'structures', mat: 'concrete', interact: { verbs: ['Open Doors', 'Close Doors'] },
    build: (M) => {
      const wood = M.get('wood', '#7a5236'), metal = M.get('darkmetal');
      const handle = (x) => B(0.04, 0.3, 0.05, metal, x, 1.0, 0.06);
      return G(B(1, 3, 0.25, M.main, -1.5), B(1, 3, 0.25, M.main, 1.5), B(2, 0.75, 0.25, M.main, 0, 2.25),
        P(-1, 0, 0, { prop: 'rotation', axis: 'y', closed: 0, open: -1.7 }, B(0.99, 2.24, 0.07, wood, 0.5, 0.01), handle(0.9)),
        P(1, 0, 0, { prop: 'rotation', axis: 'y', closed: 0, open: 1.7 }, B(0.99, 2.24, 0.07, wood, -0.5, 0.01), handle(-0.9)));
    },
  },
  {
    id: 'gate', name: 'Garden Gate', cat: 'decoration', mat: 'wood', interact: { verbs: ['Open Gate', 'Close Gate'] },
    build: (M) => {
      const bars = [B(1.86, 0.09, 0.05, M.main, 0.95, 0.3), B(1.86, 0.09, 0.05, M.main, 0.95, 0.85)];
      for (let i = 0; i < 6; i++) bars.push(B(0.08, 1.0, 0.04, M.main, 0.12 + i * 0.33, 0.1));
      return G(B(0.12, 1.3, 0.12, M.main, -1.02), B(0.12, 1.3, 0.12, M.main, 1.02), P(-0.95, 0, 0, { prop: 'rotation', axis: 'y', closed: 0, open: -1.6 }, bars));
    },
  },
  {
    id: 'chest', name: 'Treasure Chest', cat: 'decoration', mat: 'wood', color: '#b07a4a', interact: { verbs: ['Open Chest', 'Close Chest'] },
    build: (M) => {
      const band = M.get('metal', '#d4af37');
      return G(B(1, 0.5, 0.6, M.main), B(0.9, 0.04, 0.5, M.get('metal', '#ffd23f'), 0, 0.42), B(1.02, 0.06, 0.62, band, 0, 0.44),
        P(0, 0.5, -0.3, { prop: 'rotation', axis: 'x', closed: 0, open: -1.9 }, B(1, 0.22, 0.6, M.main, 0, 0, 0.3), B(1.02, 0.05, 0.62, band, 0, 0.2, 0.3), B(0.12, 0.14, 0.04, band, 0, 0.02, 0.61)));
    },
  },
  {
    id: 'trapdoor', name: 'Trapdoor Floor', cat: 'structures', mat: 'wood', interact: { verbs: ['Open Trapdoor', 'Close Trapdoor'] },
    build: (M) => G(B(4, 0.2, 1.4, M.main, 0, 0, 1.3), B(4, 0.2, 1.4, M.main, 0, 0, -1.3), B(1.4, 0.2, 1.2, M.main, 1.3), B(1.4, 0.2, 1.2, M.main, -1.3),
      P(-0.6, 0, 0, { prop: 'rotation', axis: 'z', closed: 0, open: 1.9 }, B(1.2, 0.12, 1.2, M.get('wood', '#8a5a3a'), 0.6, 0.08), B(0.06, 0.04, 0.3, M.get('darkmetal'), 1.0, 0.2))),
  },

  // ---------------- BIRD STUFF ----------------
  {
    id: 'birdhouse', name: 'Bird House', cat: 'birds', mat: 'wood', color: '#e8a87c',
    build: (M) => {
      const roof = Mx('bhroof', () => new THREE.ConeGeometry(0.62, 0.4, 4).rotateY(Math.PI / 4), M.get('stone', '#8a3b2e'), 0, 2.4, 0);
      const hole = Mx('bhhole', () => new THREE.CircleGeometry(0.11, 16), M.get('rubber'), 0, 1.98, 0.302);
      const perch = Mx('bhperch', () => new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8).rotateX(Math.PI / 2), M.get('wood'), 0, 1.82, 0.4);
      return G(Cyl(0.05, 0.05, 1.6, M.get('wood')), B(0.6, 0.6, 0.6, M.main, 0, 1.6), roof, hole, perch);
    },
  },
  {
    id: 'perch', name: 'Perch Stand', cat: 'birds', mat: 'wood',
    build: (M) => G(Cyl(0.45, 0.5, 0.08, M.main), Cyl(0.05, 0.05, 1.6, M.main, 0, 0.08), Mx('perchbar', () => new THREE.CylinderGeometry(0.04, 0.04, 1.2, 10).rotateZ(Math.PI / 2), M.main, 0, 1.68, 0),
      Cyl(0.12, 0.1, 0.08, M.get('plastic', '#f1c40f'), -0.5, 1.72), Cyl(0.12, 0.1, 0.08, M.get('plastic', '#2e86de'), 0.5, 1.72)),
  },
  { id: 'birdbath', name: 'Bird Bath', cat: 'birds', mat: 'stone', build: (M) => G(Cyl(0.35, 0.4, 0.1, M.main), Cyl(0.12, 0.18, 0.8, M.main, 0, 0.1), Cyl(0.6, 0.3, 0.18, M.main, 0, 0.9), Cyl(0.52, 0.52, 0.02, M.get('glass', '#5fa8d3'), 0, 1.04)) },
  {
    id: 'feeder', name: 'Seed Feeder', cat: 'birds', mat: 'metal', color: '#27ae60',
    build: (M) => G(Cyl(0.04, 0.04, 1.8, M.get('darkmetal')), Cyl(0.14, 0.14, 0.6, M.get('glass', '#cfe8f0'), 0, 1.3), Cyl(0.11, 0.11, 0.45, M.get('stone', '#d9b26a'), 0, 1.32),
      Mx('feedtop', () => new THREE.ConeGeometry(0.22, 0.2, 16), M.main, 0, 2.0, 0), Cyl(0.22, 0.22, 0.04, M.main, 0, 1.26)),
  },
  {
    id: 'nest', name: 'Nest', cat: 'birds', mat: 'wood', color: '#8d6e52',
    build: (M) => {
      const egg = (x, z) => Mx('egg', () => new THREE.SphereGeometry(0.1, 12, 10).scale(1, 1.3, 1), M.get('plastic', '#f4f1e6'), x, 0.2, z);
      return G(Mx('nestring', () => new THREE.TorusGeometry(0.45, 0.18, 10, 24).rotateX(Math.PI / 2), M.main, 0, 0.18, 0), Cyl(0.4, 0.3, 0.12, M.main, 0, 0.02), egg(0.08, 0), egg(-0.1, 0.08), egg(0, -0.12));
    },
  },
  {
    id: 'birdswing', name: 'Bird Swing', cat: 'birds', mat: 'wood', interact: { verbs: ['Push Swing', 'Push Swing'], swing: true },
    build: (M) => {
      const metal = M.get('metal');
      const sw = P(0, 2.2, 0, { prop: 'rotation', axis: 'x', swing: true }, Cyl(0.01, 0.01, 1.0, metal, -0.3, -1.0), Cyl(0.01, 0.01, 1.0, metal, 0.3, -1.0),
        Mx('swingbar', () => new THREE.CylinderGeometry(0.035, 0.035, 0.7, 10).rotateZ(Math.PI / 2), M.main, 0, -1.0, 0));
      return G(B(0.1, 2.2, 0.1, M.main, -0.8), B(0.1, 2.2, 0.1, M.main, 0.8), B(1.7, 0.1, 0.1, M.main, 0, 2.2), sw);
    },
  },
  {
    id: 'statue', name: 'Bird Statue', cat: 'birds', mat: 'metal', color: '#d4af37',
    build: (M) => {
      const g = G(B(1.2, 0.8, 1.2, M.get('stone')));
      const bird = statueFactory?.();
      if (bird) { bird.traverse((o) => { if (o.isMesh) o.material = M.main; }); bird.position.y = 0.8; bird.scale.setScalar(1.15); g.add(bird); }
      return g;
    },
  },
];

export const LIB = Object.fromEntries(LIBRARY.map((d) => [d.id, d]));

export function buildItem(def, matName, color) {
  const M = {
    main: getMaterial(matName || def.mat, color ?? def.color ?? null),
    get: (n, c = null) => getMaterial(n, c),
  };
  return def.build(M);
}

// ---------- 3D thumbnails for the library panel ----------
let thumbs = null;
export function getThumbnails() {
  if (thumbs) return thumbs;
  thumbs = {};
  const size = 160;
  let r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) {
    return thumbs; // cards fall back to text-only
  }
  r.setSize(size, size);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 0.78;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  const envRT = pm.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 200);
  const box = new THREE.Box3(), c = new THREE.Vector3(), s = new THREE.Vector3();
  const dir = new THREE.Vector3(1, 0.75, 1.35).normalize();
  for (const def of LIBRARY) {
    const obj = buildItem(def);
    scene.add(obj);
    box.setFromObject(obj); box.getCenter(c); box.getSize(s);
    const radius = s.length() / 2;
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.02;
    cam.position.copy(c).addScaledVector(dir, dist);
    cam.lookAt(c);
    r.render(scene, cam);
    thumbs[def.id] = r.domElement.toDataURL('image/png');
    scene.remove(obj);
  }
  envRT.dispose(); pm.dispose(); r.dispose();
  r.forceContextLoss?.();
  return thumbs;
}

// ---------- starter content for a brand-new world ----------
export function starterWorld(flatH) {
  const out = [];
  for (let x = -72; x <= 72; x += 8) out.push({ type: 'road', mat: 'asphalt', color: null, x, y: flatH, z: 0, ry: Math.PI / 2, sx: 1, sy: 1, sz: 1 });
  for (const x of [-40, 0, 40]) out.push({ type: 'streetlight', mat: 'darkmetal', color: null, x, y: flatH, z: -5, ry: -Math.PI / 2, sx: 1, sy: 1, sz: 1 });
  return out;
}
