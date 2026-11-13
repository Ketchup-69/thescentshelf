// A small "photo studio": one WebGL renderer, a procedural light rig, and a
// builder that turns a bottle spec into glass, liquid, collar and cap.
// three.js is loaded from a pinned CDN build (see README to self-host it).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
import { lathePoints, CAP_FINISHES } from '../bottle-spec.js';

const FOV = 28;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
const BACK_Z = 30;

// Dark room with a few bright soft boxes. Baked once into an environment map,
// which is what gives the glass and metal their reflections.
function buildEnvScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04050c);
  const geo = new THREE.PlaneGeometry(1, 1);
  const panel = (w, h, hex, intensity, x, y, z) => {
    const color = new THREE.Color(hex).multiplyScalar(intensity);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    mesh.scale.set(w, h, 1);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };
  panel(7, 7, '#ffffff', 5, -7, 6, 6);
  panel(1.4, 12, '#e9e4ff', 9, 8, 1, 3);
  panel(0.8, 10, '#bcd0ff', 5, -9, 0, -2);
  panel(9, 3, '#ffffff', 2.5, 0, 10, 0);
  panel(4, 8, '#8B5CF6', 4, 4, 2, -9);
  panel(10, 10, '#1E1B4B', 1.2, 0, -9, 0);
  return scene;
}

const BACKDROP_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BACKDROP_FRAG = `
uniform vec3 uBg;
uniform vec3 uGlow;
uniform float uAspect;
uniform float uStrength;
varying vec2 vUv;
void main() {
  vec2 p = vUv - vec2(0.5, 0.5);
  p.x *= uAspect;
  float radius = 0.56 * min(1.0, uAspect * 1.15);
  float g = smoothstep(radius, 0.0, length(p));
  g *= g;
  vec2 q = vUv - vec2(0.5, 0.2);
  q.x *= uAspect;
  float pool = smoothstep(1.0, 0.0, length(q * vec2(3.4, 15.0)));
  float amount = clamp(g * uStrength + pool * uStrength * 0.8, 0.0, 1.0);
  gl_FragColor = vec4(mix(uBg, uGlow, amount), 1.0);
  #include <colorspace_fragment>
}`;

function v2(list) {
  return list.map((p) => new THREE.Vector2(p[0], p[1]));
}

// Rounded rectangular block standing on y = 0.
function roundedSlab(w, h, d, r) {
  const b = Math.min(0.03, h * 0.2, w * 0.2, d * 0.2);
  const ww = w - 2 * b;
  const dd = d - 2 * b;
  const rr = Math.max(Math.min(r - b, ww / 2 - 0.002, dd / 2 - 0.002), 0.005);
  const x = -ww / 2;
  const z = -dd / 2;
  const sh = new THREE.Shape();
  sh.moveTo(x + rr, z);
  sh.lineTo(x + ww - rr, z);
  sh.absarc(x + ww - rr, z + rr, rr, -Math.PI / 2, 0, false);
  sh.lineTo(x + ww, z + dd - rr);
  sh.absarc(x + ww - rr, z + dd - rr, rr, 0, Math.PI / 2, false);
  sh.lineTo(x + rr, z + dd);
  sh.absarc(x + rr, z + dd - rr, rr, Math.PI / 2, Math.PI, false);
  sh.lineTo(x, z + rr);
  sh.absarc(x + rr, z + rr, rr, Math.PI, Math.PI * 1.5, false);
  const geo = new THREE.ExtrudeGeometry(sh, {
    depth: Math.max(h - 2 * b, 0.01),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 14,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, b, 0);
  return geo;
}

export class Studio {
  constructor(canvas, { bg = '#0B1026', glow = 0.34 } = {}) {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80);
    this.scene.add(this.camera);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = buildEnvScene();
    this.envTarget = pmrem.fromScene(env, 0.03);
    this.scene.environment = this.envTarget.texture;
    pmrem.dispose();
    env.traverse((o) => {
      if (o.isMesh) o.material.dispose();
    });

    this.backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: {
          uBg: { value: new THREE.Color(bg) },
          uGlow: { value: new THREE.Color('#8B5CF6') },
          uAspect: { value: 1 },
          uStrength: { value: glow },
        },
        vertexShader: BACKDROP_VERT,
        fragmentShader: BACKDROP_FRAG,
      })
    );
    this.backdrop.position.z = -BACK_Z;
    this.backdrop.frustumCulled = false;
    this.camera.add(this.backdrop);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    const glass = {
      color: 0xffffff,
      metalness: 0,
      roughness: 0.05,
      transmission: 1,
      thickness: 0.22,
      ior: 1.45,
      envMapIntensity: 1.35,
    };
    this.mats = {
      glass: new THREE.MeshPhysicalMaterial(glass),
      glassFlat: new THREE.MeshPhysicalMaterial({ ...glass, flatShading: true }),
      tube: new THREE.MeshStandardMaterial({ color: 0xe6e6f0, roughness: 0.5, metalness: 0 }),
      cap: {},
    };
    for (const [name, f] of Object.entries(CAP_FINISHES)) {
      this.mats.cap[name] = new THREE.MeshStandardMaterial({
        color: f.color,
        metalness: f.metalness,
        roughness: f.roughness,
        envMapIntensity: 1.25,
      });
    }

    this.bottles = new Map();
    this.current = null;
    this.setSize(300, 375, 1);
  }

  setSize(w, h, dpr = 1) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    const dist = Math.max(3.75, 2.45 / aspect) / (2 * TAN);
    this.camera.position.set(0, dist * 0.085, dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    const bh = 2 * BACK_Z * TAN;
    this.backdrop.scale.set(bh * aspect * 1.02, bh * 1.02, 1);
    this.backdrop.material.uniforms.uAspect.value = aspect;
  }

  show(spec) {
    if (this.current && this.current.userData.id === spec.id) return;
    let group = this.bottles.get(spec.id);
    if (!group) {
      group = this.build(spec);
      this.bottles.set(spec.id, group);
    }
    if (this.current) this.pivot.remove(this.current);
    this.pivot.add(group);
    this.current = group;
    this.backdrop.material.uniforms.uGlow.value.set(spec.color);
  }

  render(rotY = 0, rotX = 0, lift = 0) {
    this.pivot.rotation.set(rotX, rotY, 0);
    this.pivot.position.y = lift;
    this.renderer.render(this.scene, this.camera);
  }

  build(spec) {
    const g = new THREE.Group();
    g.userData.id = spec.id;
    const flat = spec.style === 'facet';
    const glass = flat ? this.mats.glassFlat : this.mats.glass;
    const capMat = this.mats.cap[spec.cap.finish] || this.mats.cap.gold;
    const liquidMat = new THREE.MeshStandardMaterial({
      color: spec.color,
      emissive: spec.color,
      emissiveIntensity: 0.42,
      roughness: 0.32,
      metalness: 0,
      envMapIntensity: 0.5,
      flatShading: flat,
    });

    let bodyGeo;
    let liquidGeo;
    if (spec.style === 'slab') {
      bodyGeo = roundedSlab(spec.W, spec.H, spec.D, spec.corner);
      liquidGeo = roundedSlab(
        spec.W - 2 * spec.wall,
        spec.H * spec.fill - spec.base,
        spec.D - 2 * spec.wall,
        Math.max(0.02, spec.corner - spec.wall * 0.6)
      );
      liquidGeo.translate(0, spec.base, 0);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(spec.neckR, spec.neckR, spec.neckH, 32, 1, true), glass);
      neck.position.y = spec.H + spec.neckH / 2;
      g.add(neck);
    } else {
      const pts = lathePoints(spec, 44);
      const segs = flat ? spec.sides : 56;
      const phi = flat ? Math.PI / spec.sides : 0;
      bodyGeo = new THREE.LatheGeometry(v2(pts.outer), segs, phi);
      liquidGeo = new THREE.LatheGeometry(v2(pts.liquid), segs, phi);
    }
    g.add(new THREE.Mesh(liquidGeo, liquidMat));
    g.add(new THREE.Mesh(bodyGeo, glass));

    const top = spec.H + spec.neckH;
    const tubeLen = top - spec.base - 0.05;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, tubeLen, 8), this.mats.tube);
    tube.position.y = spec.base + 0.05 + tubeLen / 2;
    g.add(tube);

    const collarR = spec.neckR + 0.045;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(collarR, collarR, spec.collarH, 40), capMat);
    collar.position.y = top + spec.collarH / 2 - 0.02;
    g.add(collar);

    const cap = new THREE.Mesh(this.capGeometry(spec.cap), capMat);
    cap.position.y = top + 0.03;
    g.add(cap);

    const k = 2.3 / (spec.totalH + 0.03);
    g.scale.setScalar(k);
    g.position.y = -1.15;
    return g;
  }

  capGeometry(c) {
    const b = 0.018;
    if (c.type === 'sphere') {
      const geo = new THREE.SphereGeometry(c.r, 40, 28);
      geo.translate(0, c.r * 0.94, 0);
      return geo;
    }
    if (c.type === 'block') return roundedSlab(c.w, c.h, c.d, 0.05);
    if (c.type === 'prism') {
      const geo = new THREE.CylinderGeometry(c.r, c.r, c.h, c.sides).toNonIndexed();
      geo.computeVertexNormals();
      geo.rotateY(Math.PI / c.sides);
      geo.translate(0, c.h / 2, 0);
      return geo;
    }
    let pts;
    if (c.type === 'dome') {
      pts = [[0, 0], [c.r - b, 0], [c.r, b], [c.r, 0.14]];
      for (let i = 1; i <= 12; i++) {
        const a = (i / 12) * (Math.PI / 2);
        pts.push([Math.max(c.r * Math.cos(a), 0), 0.14 + c.r * Math.sin(a)]);
      }
    } else if (c.type === 'taper') {
      pts = [[0, 0], [c.r - b, 0], [c.r, b], [c.top, c.h - b], [c.top - b, c.h], [0, c.h]];
    } else if (c.type === 'disc') {
      pts = [[0, 0], [0.12, 0], [0.12, 0.07], [c.r - b, 0.07], [c.r, 0.07 + b], [c.r, c.h - b], [c.r - b, c.h], [0, c.h]];
    } else {
      pts = [[0, 0], [c.r - b, 0], [c.r, b], [c.r, c.h - b], [c.r - b, c.h], [0, c.h]];
    }
    return new THREE.LatheGeometry(v2(pts), 48);
  }

  dispose() {
    for (const group of this.bottles.values()) {
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        if (o.material.emissive && o.material !== this.mats.tube && !Object.values(this.mats.cap).includes(o.material)) {
          if (o.material !== this.mats.glass && o.material !== this.mats.glassFlat) o.material.dispose();
        }
      });
    }
    this.bottles.clear();
    this.mats.glass.dispose();
    this.mats.glassFlat.dispose();
    this.mats.tube.dispose();
    Object.values(this.mats.cap).forEach((m) => m.dispose());
    this.backdrop.geometry.dispose();
    this.backdrop.material.dispose();
    this.envTarget.dispose();
    this.renderer.dispose();
  }
}
