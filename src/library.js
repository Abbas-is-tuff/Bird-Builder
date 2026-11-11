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
];

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
    id: 'door', name: 'Door Wall', cat: 'structures', mat: 'concrete',
    build: (M) => {
      const wood = M.get('wood', '#9b6a45'), metal = M.get('darkmetal');
      const knob = new THREE.Mesh(cg('knob', () => new THREE.SphereGeometry(0.05, 12, 8)), metal);
      knob.position.set(0.38, 1.05, 0.08);
      return G(B(1.45, 3, 0.25, M.main, -1.275), B(1.45, 3, 0.25, M.main, 1.275), B(1.1, 0.8, 0.25, M.main, 0, 2.2),
        B(1.04, 2.18, 0.07, wood, 0, 0.01), knob);
    },
  },
  {
    id: 'window', name: 'Window Wall', cat: 'structures', mat: 'concrete',
    build: (M) => {
      const glass = M.get('glass'), frame = M.get('darkmetal');
      return G(B(4, 1, 0.25, M.main), B(4, 0.8, 0.25, M.main, 0, 2.2), B(1.2, 1.2, 0.25, M.main, -1.4, 1), B(1.2, 1.2, 0.25, M.main, 1.4, 1),
        B(1.6, 1.2, 0.03, glass, 0, 1), B(0.05, 1.2, 0.08, frame, 0, 1), B(1.6, 0.05, 0.08, frame, 0, 1.575));
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
    id: 'streetlight', name: 'Streetlight', cat: 'infrastructure', mat: 'darkmetal',
    build: (M) => G(Cyl(0.08, 0.13, 6, M.main), B(1.5, 0.08, 0.08, M.main, 0.7, 5.88), B(0.7, 0.14, 0.32, M.main, 1.35, 5.76),
      B(0.56, 0.03, 0.24, M.get('light'), 1.35, 5.74), Cyl(0.22, 0.22, 0.1, M.main)),
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
    id: 'lamp', name: 'Floor Lamp', cat: 'decoration', mat: 'plastic', color: '#f4f4f2',
    build: (M) => {
      const metal = M.get('darkmetal');
      const bulb = new THREE.Mesh(cg('bulb', () => new THREE.SphereGeometry(0.08, 12, 8)), M.get('light'));
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
