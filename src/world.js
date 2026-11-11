// The open world: terrain, water, sky, sun/moon lighting, forests, rocks, grass.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { makeNoise, mulberry32, smoothstep, lerp } from './noise.js';
import { getTex, getMaterial, setNightFactor } from './textures.js';
import { crownGeometry, pineGeometry, rockGeometry } from './library.js';

export const WORLD_SIZE = 1000;
export const HALF = WORLD_SIZE / 2;
export const SEG = 256;
export const FLAT_R = 90;      // radius of the flat building plaza
export const FLAT_H = 1.5;     // its height above water
const STEP = WORLD_SIZE / SEG;

const nA = makeNoise(7), nB = makeNoise(13), nC = makeNoise(29), nD = makeNoise(41);

function fbm(x, z, oct, f) {
  let a = 1, s = 0, t = 0;
  for (let i = 0; i < oct; i++) { s += a * nA(x * f, z * f); t += a; a *= 0.5; f *= 2; }
  return s / t;
}
function ridged(x, z) {
  let a = 1, s = 0, t = 0, f = 1 / 230;
  for (let i = 0; i < 5; i++) { let v = 1 - Math.abs(nB(x * f, z * f)); v *= v; s += a * v; t += a; a *= 0.5; f *= 2.1; }
  return s / t;
}

// Analytic world height (used once to build the mesh).
function rawHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = 4 + fbm(x, z, 4, 1 / 170) * 7;

  // river winding north from the lake
  const rx = -170 + 40 * Math.sin(z / 60);
  const rd = Math.abs(x - rx);
  const riverOn = smoothstep(140, 190, z);
  const valley = 1 - (1 - smoothstep(25, 140, rd)) * riverOn;

  // sea to the east
  const coast = 330 + 40 * nC(z / 140, 3.1);
  const sea = smoothstep(coast - 40, coast + 90, x);

  // mountains around the rim
  const mMask = smoothstep(210, 400, r) * valley * (1 - sea);
  h += mMask * Math.pow(ridged(x, z), 1.6) * 210 * (0.55 + 0.45 * (fbm(x + 500, z, 2, 1 / 380) * 0.5 + 0.5));

  // lake
  const ld = Math.hypot(x + 170, z - 150);
  const lake = 1 - smoothstep(45, 115, ld);
  h = lerp(h, -7, lake);

  // river channel
  const ch = (1 - smoothstep(7, 24, rd)) * riverOn;
  h = lerp(h, -3, ch);

  h = lerp(h, -14, sea);

  // flat building plaza in the middle
  const f = 1 - smoothstep(FLAT_R, FLAT_R + 55, r);
  h = lerp(h, FLAT_H, f);
  return h;
}

const C = (hex) => new THREE.Color(hex);
const COL = {
  wetSand: C('#6f6449'), sand: C('#c9b98e'), grassA: C('#4c6b2a'), grassB: C('#6b8236'), lawn: C('#5b7a31'),
  dirt: C('#6e5a3e'), alpine: C('#6f7556'), rock: C('#7b756d'), rockDark: C('#5a5650'), snow: C('#eef2f6'),
};

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.heights = new Float32Array((SEG + 1) * (SEG + 1));
    this.focus = new THREE.Vector3();
    this.timeOfDay = 10.5;
    this._envHour = -99;
    this.grassTime = { value: 0 };

    this._buildTerrain();
    this._buildWater();
    this._buildSky();
    this._buildLights();
    this._buildVegetation();
    this._buildStars();
    scene.fog = new THREE.FogExp2(0xb9cde0, 0.0011);
    this.setTimeOfDay(this.timeOfDay);
  }

  // ---------------- terrain ----------------
  _buildTerrain() {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const h = rawHeight(pos.getX(i), pos.getZ(i));
      pos.setY(i, h);
      this.heights[i] = h; // index = row(z) * (SEG+1) + col(x)
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), t = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), slope = nrm.getY(i);
      const n = nC(x / 35, z / 35) * 0.5 + 0.5;
      const n2 = nD(x / 9, z / 9) * 0.5 + 0.5;
      c.copy(COL.grassA).lerp(COL.grassB, n);
      if (Math.hypot(x, z) < FLAT_R + 5) c.lerp(COL.lawn, 0.6);
      c.lerp(COL.dirt, smoothstep(0.62, 0.85, nD(x / 60, z / 60) * 0.5 + 0.5) * 0.7);
      c.lerp(COL.alpine, smoothstep(35, 70, h));
      c.lerp(t.copy(COL.rock).lerp(COL.rockDark, n2), smoothstep(0.86, 0.68, slope));
      c.lerp(COL.sand, 1 - smoothstep(0.7, 1.5, h));
      c.lerp(COL.wetSand, 1 - smoothstep(-1.2, 0.1, h));
      c.lerp(COL.snow, smoothstep(95, 120, h + n * 15) * smoothstep(0.55, 0.75, slope));
      const v = 0.92 + n2 * 0.16;
      colors[i * 3] = c.r * v; colors[i * 3 + 1] = c.g * v; colors[i * 3 + 2] = c.b * v;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const detail = getTex('detail').clone();
    detail.needsUpdate = true;
    detail.repeat.set(260, 260);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.96, metalness: 0 });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.terrain.name = 'terrain';
    this.scene.add(this.terrain);
  }

  getHeight(x, z) {
    const fx = Math.min(SEG - 0.0001, Math.max(0, (x + HALF) / STEP));
    const fz = Math.min(SEG - 0.0001, Math.max(0, (z + HALF) / STEP));
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const W = SEG + 1, H = this.heights;
    const a = H[iz * W + ix], b = H[iz * W + ix + 1], c = H[(iz + 1) * W + ix], d = H[(iz + 1) * W + ix + 1];
    // match the triangle split used by PlaneGeometry (a-c-b / c-d-b)
    if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  // ray-march the heightfield (much cheaper than triangle raycasting on mobile)
  raycastTerrain(ray) {
    const o = ray.origin, d = ray.direction;
    let t = 0, prevT = 0;
    const p = new THREE.Vector3();
    const above = (tt) => { p.copy(o).addScaledVector(d, tt); return p.y - this.getHeight(p.x, p.z); };
    if (above(0) < 0) return null;
    for (let i = 0; i < 600 && t < 4000; i++) {
      prevT = t;
      t += 0.4 + t * 0.012;
      const a = above(t);
      if (a < 0) {
        let lo = prevT, hi = t;
        for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; if (above(mid) < 0) hi = mid; else lo = mid; }
        p.copy(o).addScaledVector(d, hi);
        if (Math.abs(p.x) > HALF || Math.abs(p.z) > HALF) return null;
        return { point: p.clone(), distance: hi };
      }
    }
    return null;
  }

  slopeAt(x, z) {
    return Math.abs(this.getHeight(x + 2, z) - this.getHeight(x - 2, z)) + Math.abs(this.getHeight(x, z + 2) - this.getHeight(x, z - 2));
  }

  // ---------------- water ----------------
  _buildWater() {
    const normal = getTex('waterNormal');
    normal.repeat.set(140, 140);
    this.waterNormal = normal;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1e4c5c, roughness: 0.06, metalness: 0.0, normalMap: normal, normalScale: new THREE.Vector2(0.55, 0.55),
      transparent: true, opacity: 0.86, envMapIntensity: 1.3,
    });
    const geo = new THREE.PlaneGeometry(WORLD_SIZE * 1.6, WORLD_SIZE * 1.6).rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.y = 0;
    this.water.receiveShadow = true;
    this.water.renderOrder = 1;
    this.scene.add(this.water);
  }

  // ---------------- sky, sun, environment ----------------
  _buildSky() {
    const mk = () => {
      const s = new Sky();
      s.scale.setScalar(9000);
      const u = s.material.uniforms;
      u.turbidity.value = 5.5; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.82;
      return s;
    };
    this.sky = mk();
    this.scene.add(this.sky);
    this.envSky = mk();
    this.envScene = new THREE.Scene();
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.sunDir = new THREE.Vector3();
  }

  _buildLights() {
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    s.bias = -0.0004; s.normalBias = 0.04;
    s.camera.near = 1; s.camera.far = 900;
    this.setShadowRange(60);
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a5a32, 0.4);
    this.scene.add(this.hemi);
  }

  setShadowRange(r) {
    const c = this.sun.shadow.camera;
    c.left = -r; c.right = r; c.top = r; c.bottom = -r;
    c.updateProjectionMatrix();
  }

  setShadowMapSize(n) {
    const s = this.sun.shadow;
    if (s.mapSize.x === n) return;
    s.mapSize.set(n, n);
    if (s.map) { s.map.dispose(); s.map = null; }
  }

  _buildStars() {
    const rng = mulberry32(5);
    const N = 1800, p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = rng() * 2 - 1, th = rng() * Math.PI * 2, y = Math.abs(u);
      const r = Math.sqrt(1 - y * y);
      p[i * 3] = Math.cos(th) * r * 4000; p[i * 3 + 1] = y * 4000 + 100; p[i * 3 + 2] = Math.sin(th) * r * 4000;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);
  }

  setTimeOfDay(hours) {
    this.timeOfDay = ((hours % 24) + 24) % 24;
    const h = this.timeOfDay;
    const elev = Math.sin(((h - 6) / 12) * Math.PI) * 62; // degrees
    const az = 180 + (h - 12) * 15;
    const phi = THREE.MathUtils.degToRad(90 - elev), theta = THREE.MathUtils.degToRad(az);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    this.envSky.material.uniforms.sunPosition.value.copy(this.sunDir);

    const day = smoothstep(-5, 8, elev);
    this.day = day;
    const night = 1 - day;
    if (elev > -3) {
      this.lightDir = this.sunDir.clone();
      this.sun.intensity = 3.4 * smoothstep(-2, 12, elev);
      this.sun.color.set('#ffb27a').lerp(new THREE.Color('#fff3e2'), smoothstep(2, 25, elev));
    } else {
      this.lightDir = this.sunDir.clone().negate(); // moon opposite the sun
      this.sun.intensity = 0.6 * smoothstep(-2, -10, elev);
      this.sun.color.set('#a9bcff');
    }
    this.hemi.intensity = 0.32 + 0.22 * day;
    this.hemi.color.set('#566aa8').lerp(new THREE.Color('#cfe3ff'), day);
    this.hemi.groundColor.set('#1c2230').lerp(new THREE.Color('#4a5a32'), day);
    this.scene.environmentIntensity = 0.3 + 0.7 * day;
    this.renderer.toneMappingExposure = 0.6 + 0.55 * night;

    const fog = new THREE.Color('#0b1222').lerp(new THREE.Color('#b9cde0'), day);
    const dusk = Math.max(0, 1 - Math.abs(elev - 2) / 9);
    fog.lerp(new THREE.Color('#d99a72'), dusk * 0.45);
    if (this.scene.fog) this.scene.fog.color.copy(fog);
    this.stars.material.opacity = smoothstep(0.5, 1, night);
    setNightFactor(night);

    if (Math.abs(h - this._envHour) > 0.2) this._updateEnv(h);
  }

  _updateEnv(h) {
    this._envHour = h;
    const rt = this.pmrem.fromScene(this.envScene, 0, 1, 20000);
    if (this._envRT) this._envRT.dispose();
    this._envRT = rt;
    this.scene.environment = rt.texture;
  }

  // ---------------- vegetation ----------------
  _buildVegetation() {
    const rng = mulberry32(2024);
    const broad = [], pines = [], rocks = [];
    const MAXB = 3600, MAXP = 2600, MAXR = 700;
    for (let i = 0; i < 60000 && (broad.length < MAXB || pines.length < MAXP); i++) {
      const x = (rng() * 2 - 1) * (HALF - 10), z = (rng() * 2 - 1) * (HALF - 10);
      const h = this.getHeight(x, z);
      if (h < 2.3 || h > 85) continue;
      const r = Math.hypot(x, z);
      if (r < FLAT_R + 35) continue;
      if (this.slopeAt(x, z) > 3.2) continue;
      const forest = nD(x / 140, z / 140);
      if (forest < -0.05 && rng() > 0.06) continue;
      const isPine = h > 28 || rng() < 0.25;
      (isPine ? pines : broad).push([x, h, z, 0.7 + rng() * 0.7, rng() * Math.PI * 2, rng()]);
    }
    for (let i = 0; i < 20000 && rocks.length < MAXR; i++) {
      const x = (rng() * 2 - 1) * (HALF - 10), z = (rng() * 2 - 1) * (HALF - 10);
      const h = this.getHeight(x, z);
      const r = Math.hypot(x, z);
      if (r < FLAT_R + 20 || h < -2) continue;
      const sl = this.slopeAt(x, z);
      const pref = (h > 20 ? 0.5 : 0.05) + (sl > 3 ? 0.4 : 0) + (h < 1.5 ? 0.25 : 0);
      if (rng() > pref) continue;
      rocks.push([x, h, z, 0.4 + rng() * rng() * 3.2, rng() * Math.PI * 2, rng()]);
    }

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const fill = (mesh, list, yOff = 0, colorFn = null) => {
      list.forEach(([x, h, z, sc, rot, rr], i) => {
        q.setFromAxisAngle(up, rot); s.setScalar(sc); p.set(x, h + yOff * sc, z);
        m4.compose(p, q, s); mesh.setMatrixAt(i, m4);
        if (colorFn) { colorFn(col, rr, h); mesh.setColorAt(i, col); }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    };

    const bark = getMaterial('bark');
    const leafMat = new THREE.MeshStandardMaterial({ map: getTex('foliage'), roughness: 0.9, vertexColors: true });
    const pineMat = new THREE.MeshStandardMaterial({ map: getTex('foliage'), roughness: 0.92, vertexColors: true });
    const addAO = (g) => {
      g.computeBoundingBox();
      const { min, max } = g.boundingBox, pos = g.attributes.position;
      const c = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) - min.y) / (max.y - min.y);
        const v = 0.45 + 0.55 * t;
        c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      return g;
    };
    const crown = addAO(crownGeometry().clone());
    const pineG = addAO(pineGeometry().clone());
    const trunkB = new THREE.CylinderGeometry(0.2, 0.32, 4, 7).translate(0, 2, 0);
    const trunkP = new THREE.CylinderGeometry(0.18, 0.28, 2.5, 7).translate(0, 1.25, 0);
    const rockMat = getMaterial('stone', '#a49d93');

    const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = true; this.scene.add(m); return m; };
    this.trees = {
      broadTrunk: mk(trunkB, bark, broad.length), broadCrown: mk(crown, leafMat, broad.length),
      pineTrunk: mk(trunkP, bark, pines.length), pineCrown: mk(pineG, pineMat, pines.length),
    };
    this.rocks = mk(rockGeometry(), rockMat, rocks.length);
    fill(this.trees.broadTrunk, broad);
    fill(this.trees.broadCrown, broad, 0, (c, r) => c.setHSL(0.24 + r * 0.06, 0.45 + r * 0.15, 0.42 + r * 0.12));
    fill(this.trees.pineTrunk, pines);
    fill(this.trees.pineCrown, pines, 0, (c, r) => c.setHSL(0.3 + r * 0.04, 0.35 + r * 0.1, 0.32 + r * 0.08));
    fill(this.rocks, rocks, -0.35);
    this.counts = { broad: broad.length, pines: pines.length, rocks: rocks.length };

    // ---- grass tufts around the plaza ----
    const MAXG = 110000;
    const blades = 5, tri = [];
    const gr = mulberry32(77);
    const pos = [], colr = [], nrm = [];
    for (let b = 0; b < blades; b++) {
      const a = gr() * Math.PI * 2, w = 0.035, hgt = 0.32 + gr() * 0.3;
      const ox = (gr() - 0.5) * 0.3, oz = (gr() - 0.5) * 0.3;
      const dx = Math.cos(a) * w, dz = Math.sin(a) * w, lean = (gr() - 0.5) * 0.2;
      pos.push(ox - dx, 0, oz - dz, ox + dx, 0, oz + dz, ox + lean, hgt, oz + lean * 0.5);
      const lo = new THREE.Color().setRGB(0.2, 0.28, 0.09, THREE.SRGBColorSpace);
      const hi = new THREE.Color().setRGB(0.42, 0.55, 0.2, THREE.SRGBColorSpace);
      colr.push(lo.r, lo.g, lo.b, lo.r, lo.g, lo.b, hi.r, hi.g, hi.b);
      nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
    void tri;
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    gg.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    gg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    const gm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
    gm.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.grassTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float sw = sin(uTime * 1.6 + ip.x * 0.13 + ip.z * 0.09) * 0.6 + sin(uTime * 3.1 + ip.x * 0.5) * 0.25;
          float bend = position.y * position.y * 1.6;
          transformed.x += sw * bend * 0.35;
          transformed.z += sw * bend * 0.18;
        #endif`);
    };
    const grass = new THREE.InstancedMesh(gg, gm, MAXG);
    let gi = 0;
    for (let i = 0; i < MAXG * 4 && gi < MAXG; i++) {
      const ang = gr() * Math.PI * 2, rad = FLAT_R + 4 + Math.sqrt(gr()) * 95;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      const h = this.getHeight(x, z);
      if (h < 1.4 || this.slopeAt(x, z) > 2.5) continue;
      q.setFromAxisAngle(up, gr() * Math.PI * 2);
      s.set(1, 0.7 + gr() * 0.7, 1); p.set(x, h - 0.02, z);
      m4.compose(p, q, s); grass.setMatrixAt(gi, m4);
      const g = 0.75 + gr() * 0.4; col.setRGB(g, g * (0.95 + gr() * 0.1), g * 0.85); grass.setColorAt(gi, col);
      gi++;
    }
    grass.instanceMatrix.needsUpdate = true;
    grass.computeBoundingSphere();
    grass.receiveShadow = true;
    grass.castShadow = false;
    this.grass = grass;
    this.grassMax = gi;
    this.scene.add(grass);
  }

  setVegetationDensity(treeFrac, grassFrac) {
    const t = this.trees;
    t.broadTrunk.count = t.broadCrown.count = Math.floor(this.counts.broad * treeFrac);
    t.pineTrunk.count = t.pineCrown.count = Math.floor(this.counts.pines * treeFrac);
    this.rocks.count = Math.floor(this.counts.rocks * Math.max(0.4, treeFrac));
    this.grass.count = Math.floor(this.grassMax * grassFrac);
    this.grass.visible = this.grass.count > 0;
  }

  update(dt, focus) {
    this.grassTime.value += dt;
    this.waterNormal.offset.x += dt * 0.006;
    this.waterNormal.offset.y += dt * 0.0035;
    // keep the shadow frustum centred on what the player is looking at
    this.focus.copy(focus);
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.lightDir, 400);
    this.sun.target.updateMatrixWorld();
  }
}
