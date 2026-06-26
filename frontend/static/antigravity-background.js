import * as THREE from "three";

const canvas = document.getElementById("webgl-dashboard");

let animationId = null;
let renderer = null;
let isRunning = false;

window.startAntigravityBackground = function () {
  if (isRunning || !canvas) return;
  isRunning = true;
  canvas.classList.remove("hidden");
  initAntigravity(canvas);
};

window.stopAntigravityBackground = function () {
  isRunning = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  if (canvas) {
    canvas.classList.add("hidden");
  }
};

function initAntigravity(canvas) {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.012);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(0, 0, 30);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x2a1a4e, 0.6);
  scene.add(ambientLight);

  const bluePoint = new THREE.PointLight(0x3b82f6, 3.5, 80);
  bluePoint.position.set(8, 10, 15);
  scene.add(bluePoint);

  const bluePoint2 = new THREE.PointLight(0x3b82f6, 2.5, 60);
  bluePoint2.position.set(-10, -5, 10);
  scene.add(bluePoint2);

  const purplePoint = new THREE.PointLight(0x7c3aed, 2.0, 70);
  purplePoint.position.set(-5, 8, 20);
  scene.add(purplePoint);

  const purplePoint2 = new THREE.PointLight(0x6d28d9, 1.5, 50);
  purplePoint2.position.set(12, -8, 5);
  scene.add(purplePoint2);

  // Dark metallic colors
  const colors = [
    0x0f172a, // deep navy
    0x1e293b, // dark slate
    0x334155, // gunmetal
    0x1a1a2e, // midnight
    0x16213e, // dark navy
    0x0d1b2a, // charcoal navy
    0x2d3436, // charcoal
    0x1b2838, // steel blue dark
  ];

  const meshes = [];
  const MESH_COUNT = 80;
  const SPREAD_X = 40;
  const SPREAD_Y = 50;
  const SPREAD_Z = 60;

  for (let i = 0; i < MESH_COUNT; i++) {
    const isIcosahedron = Math.random() > 0.45;

    let geometry;
    if (isIcosahedron) {
      const radius = rand(0.3, 1.4);
      const detail = Math.floor(rand(0, 2));
      geometry = new THREE.IcosahedronGeometry(radius, detail);
    } else {
      const radius = rand(0.2, 1.0);
      const wSeg = Math.floor(rand(8, 20));
      const hSeg = Math.floor(rand(6, 16));
      geometry = new THREE.SphereGeometry(radius, wSeg, hSeg);
    }

    const color = colors[Math.floor(Math.random() * colors.length)];
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: rand(0.15, 0.45),
      metalness: rand(0.7, 0.95),
      flatShading: isIcosahedron && Math.random() > 0.3,
    });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(
      rand(-SPREAD_X / 2, SPREAD_X / 2),
      rand(-SPREAD_Y / 2, SPREAD_Y / 2),
      rand(-SPREAD_Z, 5)
    );

    mesh.rotation.set(
      rand(0, Math.PI * 2),
      rand(0, Math.PI * 2),
      rand(0, Math.PI * 2)
    );

    const scale = rand(0.6, 1.4);
    mesh.scale.setScalar(scale);

    scene.add(mesh);

    meshes.push({
      mesh,
      driftSpeed: rand(0.002, 0.008),
      rotSpeedY: rand(0.001, 0.006) * (Math.random() > 0.5 ? 1 : -1),
      rotSpeedX: rand(0.0005, 0.004) * (Math.random() > 0.5 ? 1 : -1),
      startY: mesh.position.y,
    });
  }

  // Subtle mouse parallax
  const mouse = new THREE.Vector2();
  const parallax = new THREE.Vector2();

  window.addEventListener(
    "mousemove",
    (e) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true }
  );

  const handleResize = () => {
    if (!renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  window.addEventListener("resize", handleResize);

  const topBound = SPREAD_Y / 2 + 8;
  const bottomBound = -SPREAD_Y / 2 - 8;

  function animate() {
    if (!isRunning) return;
    animationId = requestAnimationFrame(animate);

    // Subtle parallax on camera
    parallax.x += (mouse.x * 1.2 - parallax.x) * 0.02;
    parallax.y += (mouse.y * 1.2 - parallax.y) * 0.02;
    camera.position.x = parallax.x * 0.8;
    camera.position.y = parallax.y * 0.5;
    camera.lookAt(0, 0, 0);

    // Animate meshes – antigravity drift upward
    for (const item of meshes) {
      item.mesh.position.y += item.driftSpeed;
      item.mesh.rotation.y += item.rotSpeedY;
      item.mesh.rotation.x += item.rotSpeedX;

      // Reset to bottom when exiting top
      if (item.mesh.position.y > topBound) {
        item.mesh.position.y = bottomBound;
        item.mesh.position.x = rand(-SPREAD_X / 2, SPREAD_X / 2);
        item.mesh.position.z = rand(-SPREAD_Z, 5);
      }
    }

    // Gently orbit one of the point lights
    const time = performance.now() * 0.001;
    bluePoint.position.x = Math.cos(time * 0.15) * 12;
    bluePoint.position.y = Math.sin(time * 0.1) * 8;
    purplePoint.position.x = Math.sin(time * 0.12) * 10;
    purplePoint.position.z = 15 + Math.cos(time * 0.08) * 8;

    renderer.render(scene, camera);
  }

  animate();
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// Auto-start if app.js already requested it before this module loaded
if (window._startAntigravityPending) {
  window._startAntigravityPending = false;
  window.startAntigravityBackground();
}
