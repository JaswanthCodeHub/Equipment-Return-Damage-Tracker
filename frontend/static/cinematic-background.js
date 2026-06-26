import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

const canvas = document.getElementById("webgl-background");

if (canvas && window.WebGLRenderingContext) {
  initCinematicBackground(canvas);
}

function initCinematicBackground(canvas) {
  RectAreaLightUniformsLib.init();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    logarithmicDepthBuffer: true,
  });
  renderer.setClearColor(0x080810, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x080810, 0.022);

  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 120);
  camera.position.set(0, 2, 18);

  const world = new THREE.Group();
  scene.add(world);

  const ambient = new THREE.AmbientLight(0x0a0a1a, 0.5);
  scene.add(ambient);

  const keyLight = new THREE.SpotLight(0xfff5e0, 3.5);
  keyLight.position.set(7, 9, 8);
  keyLight.angle = 0.35;
  keyLight.penumbra = 0.7;
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  const rimLight = new THREE.SpotLight(0x003cff, 2.0);
  rimLight.position.set(-9, 4, 4);
  rimLight.angle = 0.55;
  rimLight.penumbra = 0.85;
  scene.add(rimLight);

  const orbitLight = new THREE.PointLight(0xff2060, 2.8, 18);
  scene.add(orbitLight);

  const softbox = new THREE.RectAreaLight(0xffffff, 1.5, 8, 5);
  softbox.position.set(0, 8, 5);
  softbox.lookAt(0, 0, 0);
  scene.add(softbox);

  const cameraMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x111118,
    roughness: 0.25,
    metalness: 0.85,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
  });
  const lensGlassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x1a1aff,
    roughness: 0,
    metalness: 0,
    transmission: 0.95,
    thickness: 0.7,
    ior: 1.52,
    emissive: 0x001060,
    emissiveIntensity: 0.42,
  });
  const lensBodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x1a1a1a,
    roughness: 0.15,
    metalness: 0.9,
    clearcoat: 0.35,
  });
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0x888899,
    roughness: 0.1,
    metalness: 1.0,
    side: THREE.DoubleSide,
  });

  const animatedObjects = [];
  const apertureGroups = [];
  const filmMaterials = [];

  for (let i = 0; i < 6; i += 1) {
    const body = createCameraBody(cameraMaterial, lensGlassMaterial);
    body.position.set(rand(-12, 12), rand(-4.2, 4.2), rand(-24, 8));
    body.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    const scale = rand(0.65, 1.15);
    body.scale.setScalar(scale);
    world.add(body);
    animatedObjects.push({
      mesh: body,
      seed: Math.random() * 100,
      speed: new THREE.Vector3(rand(0.001, 0.004), rand(0.001, 0.004), rand(0.001, 0.004)),
      baseY: body.position.y,
      kind: "camera",
    });
  }

  for (let i = 0; i < 8; i += 1) {
    const lens = createFloatingLens(lensBodyMaterial, lensGlassMaterial, i % 2 === 0);
    lens.position.set(rand(-14, 14), rand(-5, 5), rand(-26, 10));
    lens.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    lens.scale.setScalar(rand(0.65, 1.2));
    world.add(lens);
    animatedObjects.push({
      mesh: lens,
      seed: Math.random() * 100,
      speed: new THREE.Vector3(rand(0.001, 0.003), rand(0.001, 0.003), rand(0.002, 0.006)),
      baseY: lens.position.y,
      kind: "lens",
    });
  }

  for (let i = 0; i < 5; i += 1) {
    const aperture = createApertureRing(bladeMaterial);
    aperture.position.set(rand(-13, 13), rand(-4, 4), rand(-24, 6));
    aperture.rotation.set(rand(-0.6, 0.6), rand(0, Math.PI), rand(-0.4, 0.4));
    aperture.scale.setScalar(rand(0.7, 1.25));
    world.add(aperture);
    apertureGroups.push({ group: aperture, seed: Math.random() * 100 });
  }

  const stripTexture = createFilmSprocketTexture();
  for (let i = 0; i < 4; i += 1) {
    const film = createFilmStrip(stripTexture);
    film.position.set(rand(-15, 15), rand(-5, 5), rand(-26, 4));
    film.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    film.scale.setScalar(rand(0.8, 1.5));
    world.add(film);
    filmMaterials.push(film.material);
  }

  const particles = createBokehParticles(2500);
  scene.add(particles);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.6, 0.6);
  composer.addPass(bloomPass);
  const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ssaoPass.kernelRadius = 8;
  ssaoPass.minDistance = 0.001;
  ssaoPass.maxDistance = 0.18;
  composer.addPass(ssaoPass);
  const filmPass = new FilmPass(0.12, 0, 0, false);
  composer.addPass(filmPass);

  const mouse = new THREE.Vector2();
  const parallax = new THREE.Vector2();
  let raf = 0;
  let visible = true;
  let start = performance.now();
  let lightAngle = 0;

  window.addEventListener("mousemove", (event) => {
    mouse.x = (event.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = -(event.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (visible) {
      start = performance.now() - getElapsed() * 1000;
      animate();
    } else {
      cancelAnimationFrame(raf);
    }
  });

  animate();

  function getElapsed() {
    return (performance.now() - start) * 0.001;
  }

  function animate() {
    if (!visible) return;
    raf = requestAnimationFrame(animate);
    const time = getElapsed();

    parallax.x += (mouse.x * 1.8 - parallax.x) * 0.025;
    parallax.y += (mouse.y * 1.8 - parallax.y) * 0.025;

    const driftX = Math.sin(time * (Math.PI * 2 / 14)) * 1.2;
    const driftY = Math.sin(time * (Math.PI * 2 / 9)) * 0.6;
    const depth = 16.5 + Math.cos(time * (Math.PI * 2 / 22)) * 1.5;

    camera.position.set(driftX + parallax.x, 2 + driftY + parallax.y, depth);
    camera.rotation.z = Math.sin(time * 0.07) * 0.018;
    camera.lookAt(0, 0, 0);
    camera.rotateZ(Math.sin(time * 0.07) * 0.018);

    world.rotation.y += 0.00025;
    lightAngle += 0.006;
    orbitLight.position.set(Math.cos(lightAngle) * 8, 3 + Math.sin(time) * 2, Math.sin(lightAngle) * 8);

    for (const item of animatedObjects) {
      const distance = camera.position.distanceTo(item.mesh.position);
      if (distance > 60) continue;
      item.mesh.rotation.x += item.speed.x;
      item.mesh.rotation.y += item.speed.y;
      item.mesh.rotation.z += item.speed.z;
      item.mesh.position.y = item.baseY + Math.sin(time + item.seed) * 0.3;
    }

    for (const aperture of apertureGroups) {
      const open = 0.8 + Math.sin(time * (Math.PI * 2 / 4) + aperture.seed) * 0.2;
      aperture.group.rotation.y += 0.002;
      aperture.group.children.forEach((blade, index) => {
        blade.scale.x = open;
        blade.rotation.z = (index / 7) * Math.PI * 2 + Math.sin(time * 0.45 + aperture.seed) * 0.12;
      });
    }

    for (const material of filmMaterials) {
      material.uniforms.uTime.value = time;
    }

    particles.material.uniforms.uTime.value = time;
    composer.render();
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    composer.setSize(window.innerWidth, window.innerHeight);
  }
}

function createCameraBody(bodyMaterial, glassMaterial) {
  const group = new THREE.Group();
  const main = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.9), bodyMaterial);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 1.1, 32), bodyMaterial);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.92;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.15, 32), glassMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.z = 0.98;
  const hump = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.6), bodyMaterial);
  hump.position.y = 0.78;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 0.7), bodyMaterial);
  grip.position.set(1.02, -0.08, 0.02);
  group.add(main, lens, ring, hump, grip);
  return group;
}

function createFloatingLens(bodyMaterial, glassMaterial, telephoto) {
  const group = new THREE.Group();
  const barrel = new THREE.Mesh(
    telephoto ? new THREE.CylinderGeometry(0.5, 0.55, 1.4, 64) : new THREE.CylinderGeometry(0.65, 0.6, 0.7, 64),
    bodyMaterial,
  );
  barrel.rotation.x = Math.PI / 2;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 64), glassMaterial);
  glass.rotation.x = Math.PI / 2;
  glass.position.z = telephoto ? 0.73 : 0.38;
  const rear = glass.clone();
  rear.position.z = telephoto ? -0.73 : -0.38;
  group.add(barrel, glass, rear);
  return group;
}

function createApertureRing(material) {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.08, -0.62);
  shape.lineTo(0.42, -0.44);
  shape.lineTo(0.22, 0.62);
  shape.lineTo(-0.25, 0.46);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  for (let i = 0; i < 7; i += 1) {
    const blade = new THREE.Mesh(geometry, material);
    blade.position.x = 0.36;
    blade.rotation.z = (i / 7) * Math.PI * 2;
    group.add(blade);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.025, 10, 80), material);
  group.add(ring);
  return group;
}

function createFilmSprocketTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#120b00";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f8d58a";
  for (let y = 12; y < canvas.height; y += 36) {
    ctx.fillRect(6, y, 10, 16);
    ctx.fillRect(48, y, 10, 16);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  return texture;
}

function createFilmStrip(texture) {
  const geometry = new THREE.BoxGeometry(0.15, 6, 0.02, 6, 80, 1);
  return new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: texture },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.x += sin(position.y * 3.0 + uTime * 1.8) * 0.12;
        p.z += cos(position.y * 2.1 + uTime * 1.2) * 0.08;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv;
      void main() {
        vec4 tex = texture2D(uMap, vUv);
        vec3 glow = vec3(0.20, 0.13, 0.02);
        gl_FragColor = vec4(tex.rgb + glow * 0.35, 0.72);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
  }));
}

function createBokehParticles(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const palette = [new THREE.Color(0xffd700), new THREE.Color(0x00b4ff), new THREE.Color(0xff6090), new THREE.Color(0xffffff)];
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = rand(-38, 38);
    positions[i * 3 + 1] = rand(-18, 18);
    positions[i * 3 + 2] = rand(-55, 16);
    const color = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = rand(6, 22);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) } },
    vertexShader: `
      attribute float size;
      attribute vec3 aColor;
      varying vec3 vColor;
      uniform float uTime;
      uniform float uPixelRatio;
      void main() {
        vColor = aColor;
        vec3 p = position;
        p.y += sin(uTime * 0.35 + position.x * 0.12) * 0.18;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = size * uPixelRatio * (18.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord.xy - 0.5;
        float d = dot(uv, uv);
        if (d > 0.25) discard;
        float alpha = smoothstep(0.25, 0.0, d) * 0.72;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geometry, material);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}
