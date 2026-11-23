import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { CameraStop, CanvasElement } from '../types/wedding.ts';

export type GizmoMode = 'translate' | 'rotate' | 'scale';

export interface MentalCanvas3DHandle {
  getCurrentCameraPose: () => {
    camX: number;
    camY: number;
    camZ: number;
    lookX: number;
    lookY: number;
    lookZ: number;
  };
}

interface MentalCanvas3DProps {
  elements: CanvasElement[];
  cameraStops: CameraStop[];
  scrollProgress: number; // 0..1
  skyColorHex?: string;
  mode?: 'guest' | 'editor';
  isOrbitMode?: boolean;
  gizmoMode?: GizmoMode;
  selectedElementId?: string | null;
  interactiveInspect?: boolean; // Guest "Mode Jelajah 3D"
  onSelectElement?: (id: string | null) => void;
  onTransformElement?: (
    id: string,
    patch: Partial<
      Pick<CanvasElement, 'x' | 'y' | 'z' | 'rotX' | 'rotY' | 'rotZ' | 'scale'>
    >,
  ) => void;
}

interface CachedTextureEntry {
  texture: THREE.Texture;
  aspect: number;
}

// Pre-allocated math helpers (zero GC inside animation loop)
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 0, -4);
const _dummyObj = new THREE.Object3D();
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createWatercolorPetalTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64);
    const grad = ctx.createRadialGradient(32, 34, 4, 32, 32, 26);
    grad.addColorStop(0, 'rgba(255, 250, 252, 0.98)');
    grad.addColorStop(0.65, 'rgba(255, 232, 240, 0.92)');
    grad.addColorStop(1, 'rgba(248, 212, 224, 0.25)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(32, 8);
    ctx.bezierCurveTo(50, 14, 52, 42, 32, 56);
    ctx.bezierCurveTo(12, 42, 14, 14, 32, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(196, 125, 142, 0.25)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createButterflyWingTexture(primaryHex: string, accentHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    // Right wing pair anchored cleanly along x = 4
    const grad = ctx.createRadialGradient(38, 54, 6, 62, 62, 70);
    grad.addColorStop(0, '#FFFDFB');
    grad.addColorStop(0.45, primaryHex);
    grad.addColorStop(1, accentHex);

    // Upper forewing
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(4, 62);
    ctx.bezierCurveTo(22, 18, 92, 6, 114, 32);
    ctx.bezierCurveTo(122, 52, 84, 70, 4, 68);
    ctx.closePath();
    ctx.fill();

    // Lower hindwing
    ctx.beginPath();
    ctx.moveTo(4, 66);
    ctx.bezierCurveTo(64, 68, 98, 92, 76, 114);
    ctx.bezierCurveTo(50, 124, 16, 102, 4, 72);
    ctx.closePath();
    ctx.fill();

    // Delicate botanical ink veins & border
    ctx.strokeStyle = 'rgba(92, 70, 78, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4, 62);
    ctx.bezierCurveTo(22, 18, 92, 6, 114, 32);
    ctx.bezierCurveTo(122, 52, 84, 70, 4, 68);
    ctx.moveTo(4, 66);
    ctx.bezierCurveTo(64, 68, 98, 92, 76, 114);
    ctx.bezierCurveTo(50, 124, 16, 102, 4, 72);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(92, 70, 78, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(8, 63);
    ctx.quadraticCurveTo(54, 42, 92, 34);
    ctx.moveTo(8, 65);
    ctx.quadraticCurveTo(52, 54, 86, 52);
    ctx.moveTo(8, 68);
    ctx.quadraticCurveTo(44, 84, 66, 104);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDoveWingTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 64);
    const grad = ctx.createLinearGradient(0, 32, 120, 12);
    grad.addColorStop(0, 'rgba(255, 253, 250, 0.98)');
    grad.addColorStop(0.7, 'rgba(250, 245, 244, 0.95)');
    grad.addColorStop(1, 'rgba(232, 224, 228, 0.88)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(2, 42);
    ctx.bezierCurveTo(28, 12, 82, 4, 122, 18);
    ctx.bezierCurveTo(96, 36, 54, 48, 2, 48);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(110, 93, 99, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildProcessedTexture(
  img: HTMLImageElement,
  removeWhiteBg: boolean,
  centerWindow: boolean,
  maxAnisotropy: number,
  maxTexDim: number,
): CachedTextureEntry {
  const naturalW = img.naturalWidth || 512;
  const naturalH = img.naturalHeight || 512;
  const aspect = naturalW / Math.max(1, naturalH);

  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  const targetCap = isMobileViewport
    ? removeWhiteBg
      ? 768
      : 960
    : removeWhiteBg
      ? 1024
      : 1280;
  const maxDim = Math.min(targetCap, maxTexDim || targetCap);
  const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
  const w = Math.max(2, Math.round(naturalW * scale));
  const h = Math.max(2, Math.round(naturalH * scale));

  // Fast-path for full-bleed solid backdrops without pixel cutout/portal processing
  if (!removeWhiteBg && !centerWindow) {
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      const texture = new THREE.CanvasTexture(offscreen);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, maxAnisotropy);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
      return { texture, aspect };
    }
    const rawTex = new THREE.Texture(img);
    rawTex.colorSpace = THREE.SRGBColorSpace;
    rawTex.needsUpdate = true;
    return { texture: rawTex, aspect };
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  let finalCanvas: HTMLCanvasElement = offscreen;
  let finalAspect = aspect;

  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    let canReadPixels = true;
    let hasNativeAlphaEdges = false;
    try {
      const checkCorner = (cx: number, cy: number) =>
        ctx.getImageData(cx, cy, 1, 1).data[3] < 24;
      hasNativeAlphaEdges =
        checkCorner(0, 0) ||
        checkCorner(w - 1, 0) ||
        checkCorner(0, h - 1) ||
        checkCorner(w - 1, h - 1);
    } catch {
      canReadPixels = false;
    }

    if (canReadPixels && (removeWhiteBg || centerWindow || hasNativeAlphaEdges)) {
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      if (removeWhiteBg) {
        // Exterior 4-edge BFS flood fill so white paper is removed WITHOUT eating white dresses/roses inside subjects
        const total = w * h;
        const visited = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        const isPaper = (idx4: number) => {
          const r = data[idx4];
          const g = data[idx4 + 1];
          const b = data[idx4 + 2];
          const minC = Math.min(r, g, b);
          const chroma = Math.max(r, g, b) - minC;
          return minC > 224 && chroma < 24;
        };

        const enqueue = (p: number) => {
          if (visited[p]) return;
          if (!isPaper(p * 4)) return;
          visited[p] = 1;
          queue[tail++] = p;
        };

        for (let x = 0; x < w; x++) {
          enqueue(x);
          enqueue((h - 1) * w + x);
        }
        for (let y = 1; y < h - 1; y++) {
          enqueue(y * w);
          enqueue(y * w + (w - 1));
        }

        while (head < tail) {
          const p = queue[head++];
          const px = p % w;
          const py = (p - px) / w;
          data[p * 4 + 3] = 0;

          if (px > 0) enqueue(p - 1);
          if (px < w - 1) enqueue(p + 1);
          if (py > 0) enqueue(p - w);
          if (py < h - 1) enqueue(p + w);
        }

        // Also soften enclosed ultra-pure white gaps (e.g. between gazebo columns / branches)
        for (let p = 0; p < total; p++) {
          if (visited[p]) continue;
          const i = p * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const minC = Math.min(r, g, b);
          const chroma = Math.max(r, g, b) - minC;
          if (minC > 246 && chroma < 8) {
            data[i + 3] = 0;
          } else {
            const px = p % w;
            const py = (p - px) / w;
            const nearBg =
              (px > 0 && visited[p - 1]) ||
              (px < w - 1 && visited[p + 1]) ||
              (py > 0 && visited[p - w]) ||
              (py < h - 1 && visited[p + w]);
            if (nearBg && minC > 210 && chroma < 26) {
              data[i + 3] = Math.round(data[i + 3] * 0.45);
            }
          }
        }
      }

      if (centerWindow) {
        for (let py = 0; py < h; py++) {
          const ny = py / h;
          for (let px = 0; px < w; px++) {
            const i = (py * w + px) * 4;
            let a = data[i + 3];
            if (a === 0) continue;
            const nx = px / w;
            const dx = (nx - 0.5) / 0.27;
            const dy = (ny - 0.56) / 0.36;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1.0) {
              const t = Math.min(1, Math.max(0, (dist - 0.55) / 0.45));
              const portalFade = t * t * (3 - 2 * t);
              a = Math.round(a * portalFade);
              data[i + 3] = a;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Auto-trim excessive transparent padding around uploaded PNGs/cutouts so replacement assets keep factory proportions
      if (!centerWindow && (removeWhiteBg || hasNativeAlphaEdges)) {
        let minX = w;
        let minY = h;
        let maxX = -1;
        let maxY = -1;
        for (let py = 0; py < h; py++) {
          for (let px = 0; px < w; px++) {
            if (data[(py * w + px) * 4 + 3] > 14) {
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
            }
          }
        }
        if (maxX > minX + 10 && maxY > minY + 10) {
          const pad = 4;
          const cx = Math.max(0, minX - pad);
          const cy = Math.max(0, minY - pad);
          const cw = Math.min(w - cx, maxX - minX + 1 + pad * 2);
          const ch = Math.min(h - cy, maxY - minY + 1 + pad * 2);
          if (cw < w * 0.94 || ch < h * 0.94) {
            const cropped = document.createElement('canvas');
            cropped.width = cw;
            cropped.height = ch;
            const cctx = cropped.getContext('2d');
            if (cctx) {
              cctx.imageSmoothingEnabled = true;
              cctx.imageSmoothingQuality = 'high';
              cctx.drawImage(offscreen, cx, cy, cw, ch, 0, 0, cw, ch);
              finalCanvas = cropped;
              finalAspect = cw / Math.max(1, ch);
            }
          }
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(finalCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, maxAnisotropy);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return { texture, aspect: finalAspect };
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function interpolateCameraStops(
  stops: CameraStop[],
  t: number,
  outPos: THREE.Vector3,
  outLook: THREE.Vector3,
) {
  if (stops.length === 0) {
    outPos.set(0, 0.2, 8);
    outLook.set(0, 0, -4);
    return;
  }
  const sorted = [...stops].sort((a, b) => a.scrollAt - b.scrollAt);
  if (sorted.length === 1 || t <= sorted[0].scrollAt) {
    const s = sorted[0];
    outPos.set(s.camX, s.camY, s.camZ);
    outLook.set(s.lookX, s.lookY, s.lookZ);
    return;
  }
  const last = sorted[sorted.length - 1];
  if (t >= last.scrollAt) {
    outPos.set(last.camX, last.camY, last.camZ);
    outLook.set(last.lookX, last.lookY, last.lookZ);
    return;
  }

  let idx = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].scrollAt && t <= sorted[i + 1].scrollAt) {
      idx = i;
      break;
    }
  }

  const p0 = sorted[Math.max(0, idx - 1)];
  const a = sorted[idx];
  const b = sorted[idx + 1];
  const p3 = sorted[Math.min(sorted.length - 1, idx + 2)];
  const span = Math.max(0.0001, b.scrollAt - a.scrollAt);
  const raw = (t - a.scrollAt) / span;
  const uZ = raw * raw * (3 - 2 * raw);

  // Curved Catmull-Rom lateral/vertical sweep combined with monotonic depth glide
  outPos.set(
    catmullRom(p0.camX, a.camX, b.camX, p3.camX, raw),
    catmullRom(p0.camY, a.camY, b.camY, p3.camY, raw),
    THREE.MathUtils.lerp(a.camZ, b.camZ, uZ),
  );
  outLook.set(
    catmullRom(p0.lookX, a.lookX, b.lookX, p3.lookX, raw),
    catmullRom(p0.lookY, a.lookY, b.lookY, p3.lookY, raw),
    THREE.MathUtils.lerp(a.lookZ, b.lookZ, uZ),
  );
}

export const MentalCanvas3D = forwardRef<MentalCanvas3DHandle, MentalCanvas3DProps>(
  function MentalCanvas3D(
    {
      elements,
      cameraStops,
      scrollProgress,
      skyColorHex = '#FBF8F6',
      mode = 'guest',
      isOrbitMode = false,
      gizmoMode = 'translate',
      selectedElementId = null,
      interactiveInspect = false,
      onSelectElement,
      onTransformElement,
    },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);

    // Mutable refs so React state updates never recreate the WebGL context
    const elementsRef = useRef(elements);
    const stopsRef = useRef(cameraStops);
    const scrollRef = useRef(scrollProgress);
    const orbitModeRef = useRef(isOrbitMode);
    const interactiveInspectRef = useRef(interactiveInspect);
    const selectedIdRef = useRef(selectedElementId);
    const onSelectRef = useRef(onSelectElement);
    const onTransformRef = useRef(onTransformElement);
    const gizmoModeRef = useRef(gizmoMode);
    const skyColorRef = useRef(skyColorHex);

    elementsRef.current = elements;
    stopsRef.current = cameraStops;
    scrollRef.current = scrollProgress;
    orbitModeRef.current = isOrbitMode;
    interactiveInspectRef.current = interactiveInspect;
    selectedIdRef.current = selectedElementId;
    onSelectRef.current = onSelectElement;
    onTransformRef.current = onTransformElement;
    gizmoModeRef.current = gizmoMode;
    skyColorRef.current = skyColorHex;

    // Scene internals stored in refs for incremental synchronization
    const threeStateRef = useRef<{
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      renderer: THREE.WebGLRenderer;
      orbitControls: OrbitControls;
      transformControls: TransformControls;
      elementGroup: THREE.Group;
      meshMap: Map<string, THREE.Mesh>;
      selectionOutline: THREE.LineSegments;
      editorGrid: THREE.GridHelper;
      textureCache: Map<string, CachedTextureEntry>;
      inFlightTextures: Map<string, Promise<CachedTextureEntry>>;
      maxAnisotropy: number;
      maxTexDim: number;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      getCurrentCameraPose: () => {
        const st = threeStateRef.current;
        if (!st) {
          return { camX: 0, camY: 0.2, camZ: 8, lookX: 0, lookY: 0, lookZ: -4 };
        }
        const t = st.orbitControls.target;
        return {
          camX: Number(st.camera.position.x.toFixed(2)),
          camY: Number(st.camera.position.y.toFixed(2)),
          camZ: Number(st.camera.position.z.toFixed(2)),
          lookX: Number(t.x.toFixed(2)),
          lookY: Number(t.y.toFixed(2)),
          lookZ: Number(t.z.toFixed(2)),
        };
      },
    }));

    // 1. Initialize Three.js WebGLRenderer & Scene once
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const isSoftwareGl = detectSoftwareWebGL();
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      const scene = new THREE.Scene();
      const bgColor = new THREE.Color(skyColorRef.current);
      scene.background = bgColor;
      scene.fog = new THREE.FogExp2(bgColor.getHex(), 0.0038);

      const aspect = width / Math.max(1, height);
      const responsiveFov = aspect < 0.85 ? THREE.MathUtils.lerp(56, 46, Math.max(0, aspect - 0.35) / 0.5) : 46;
      const camera = new THREE.PerspectiveCamera(responsiveFov, aspect, 0.1, 200);
      camera.position.set(0, 0.1, 6.5);

      const renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });

      const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
      const maxTexDim = renderer.capabilities.maxTextureSize || 2048;

      // Keep crisp pastel ink & watercolor clarity without ACES contrast compression
      const isMobileScreen = width < 768;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, isMobileScreen ? 1.75 : 2),
      );
      renderer.setSize(width, height);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      container.appendChild(renderer.domElement);

      // Soft pastel gallery lighting
      const hemiLight = new THREE.HemisphereLight(0xfff9f6, 0xe8deda, 1.35);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xfff4eb, 0.65);
      dirLight.position.set(4, 8, 10);
      scene.add(dirLight);

      // Editor spatial depth grid (hidden in guest mode)
      const editorGrid = new THREE.GridHelper(32, 32, 0xc47d8e, 0xe6dfdb);
      editorGrid.position.set(0, -3.5, -6);
      editorGrid.visible = mode === 'editor' && orbitModeRef.current;
      scene.add(editorGrid);

      const elementGroup = new THREE.Group();
      scene.add(elementGroup);

      // Selection highlight box in editor mode
      const boxGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.03, 1.03));
      const boxMat = new THREE.LineBasicMaterial({
        color: 0xc47d8e,
        transparent: true,
        opacity: 0.9,
      });
      const selectionOutline = new THREE.LineSegments(boxGeo, boxMat);
      selectionOutline.visible = false;
      scene.add(selectionOutline);

      // Falling Sakura & Rose Petals (InstancedMesh keeping active density in front of camera)
      const petalCount = isMobileScreen || isSoftwareGl ? 75 : 135;
      const petalTex = createWatercolorPetalTexture();
      const petalGeo = new THREE.PlaneGeometry(0.16, 0.22);
      const petalMat = new THREE.MeshBasicMaterial({
        map: petalTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const petalsMesh = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
      petalsMesh.frustumCulled = false;
      petalsMesh.renderOrder = 100;

      const petalSeeds: Array<{
        x: number;
        yOffset: number;
        zOffset: number;
        speedY: number;
        swayFreq: number;
        phase: number;
        scale: number;
        rotSpeed: number;
      }> = [];
      const petalColors = [
        new THREE.Color('#F7C8D4'),
        new THREE.Color('#FBE4EA'),
        new THREE.Color('#F4B8C8'),
        new THREE.Color('#E8DDF0'),
        new THREE.Color('#FFF5F2'),
      ];
      for (let i = 0; i < petalCount; i++) {
        petalSeeds.push({
          x: (Math.random() - 0.5) * 8.5,
          yOffset: Math.random() * 9.0,
          zOffset: 1.5 + Math.random() * 7.2,
          speedY: 0.35 + Math.random() * 0.45,
          swayFreq: 0.9 + Math.random() * 1.1,
          phase: Math.random() * Math.PI * 2,
          scale: 0.65 + Math.random() * 0.95,
          rotSpeed: (Math.random() - 0.5) * 2.2,
        });
        petalsMesh.setColorAt(i, petalColors[i % petalColors.length]);
      }
      if (petalsMesh.instanceColor) petalsMesh.instanceColor.needsUpdate = true;
      petalsMesh.computeBoundingSphere();
      scene.add(petalsMesh);

      // Animated Pastel Butterflies (fly gracefully & periodically perch on tree/vine branches)
      const butterflyTextures = [
        createButterflyWingTexture('#F5B8C8', '#D98CA3'),
        createButterflyWingTexture('#DCD0EE', '#B19CD4'),
        createButterflyWingTexture('#F9D8B8', '#E2A97D'),
        createButterflyWingTexture('#F8E4C8', '#C47D8E'),
      ];
      const wingRightGeo = new THREE.PlaneGeometry(0.2, 0.2);
      wingRightGeo.translate(0.1, 0, 0); // Hinge cleanly at center spine
      const wingLeftGeo = new THREE.PlaneGeometry(0.2, 0.2);
      wingLeftGeo.scale(-1, 1, 1);
      wingLeftGeo.translate(-0.1, 0, 0);
      const bodyGeo = new THREE.CapsuleGeometry(0.008, 0.075, 4, 6);
      const bodyMat = new THREE.MeshBasicMaterial({
        color: 0x5c464e,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });

      const butterflyPerches = [
        { px: -1.45, py: 0.35, pz: 0.55, rx: 0.55, ry: 0.45, phase: 0.0, texIdx: 0 }, // S1 Tree left branch
        { px: 1.5, py: 0.25, pz: 0.35, rx: 0.6, ry: 0.4, phase: 2.3, texIdx: 1 },   // S1 Tree right branch
        { px: -1.25, py: 1.55, pz: 2.25, rx: 0.45, ry: 0.35, phase: 4.1, texIdx: 2 }, // S1 Wisteria vine left
        { px: -0.3, py: 0.3, pz: -8.6, rx: 0.55, ry: 0.45, phase: 1.2, texIdx: 0 },  // S2 Pathway tree branch (right sweep)
        { px: -0.05, py: 1.6, pz: -7.4, rx: 0.45, ry: 0.35, phase: 5.0, texIdx: 3 }, // S2 Wisteria vine
        { px: -2.6, py: 0.25, pz: -18.0, rx: 0.55, ry: 0.45, phase: 3.1, texIdx: 1 }, // S3 Gazebo tree left (left sweep)
        { px: 0.35, py: 0.25, pz: -18.2, rx: 0.55, ry: 0.45, phase: 6.2, texIdx: 2 },  // S3 Gazebo tree right
        { px: -0.1, py: 1.55, pz: -27.6, rx: 0.45, ry: 0.35, phase: 2.8, texIdx: 0 }, // S4 Wisteria branch (right sweep)
        { px: -2.4, py: 0.3, pz: -38.1, rx: 0.55, ry: 0.45, phase: 4.7, texIdx: 3 },  // S5 Gift garden tree branch (left sweep)
        { px: -1.25, py: 3.9, pz: -47.0, rx: 0.45, ry: 0.35, phase: 0.9, texIdx: 1 }, // S6 Sky vine branch
      ];

      const butterflyGroup = new THREE.Group();
      scene.add(butterflyGroup);
      const butterflyMats: THREE.MeshBasicMaterial[] = butterflyTextures.map(
        (tex) =>
          new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.96,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
      );

      const butterflies = butterflyPerches.map((cfg) => {
        const root = new THREE.Group();
        const mat = butterflyMats[cfg.texIdx % butterflyMats.length];
        const leftWing = new THREE.Mesh(wingLeftGeo, mat);
        const rightWing = new THREE.Mesh(wingRightGeo, mat);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.x = Math.PI * 0.5;
        leftWing.renderOrder = 110;
        rightWing.renderOrder = 110;
        body.renderOrder = 110;
        root.add(body, leftWing, rightWing);
        butterflyGroup.add(root);
        return { root, leftWing, rightWing, ...cfg };
      });

      // Animated Flying Doves/Birds Crossing Scene 6 Pastel Sky
      const doveWingTex = createDoveWingTexture();
      const doveWingRightGeo = new THREE.PlaneGeometry(0.42, 0.21);
      doveWingRightGeo.translate(0.21, 0, 0);
      const doveWingLeftGeo = new THREE.PlaneGeometry(0.42, 0.21);
      doveWingLeftGeo.scale(-1, 1, 1);
      doveWingLeftGeo.translate(-0.21, 0, 0);
      const doveBodyGeo = new THREE.CapsuleGeometry(0.028, 0.16, 4, 6);
      const doveMat = new THREE.MeshBasicMaterial({
        map: doveWingTex,
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const doveBodyMat = new THREE.MeshBasicMaterial({
        color: 0xfffaf7,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      });

      const birdGroup = new THREE.Group();
      scene.add(birdGroup);
      const birdConfigs = [
        { baseY: 3.1, z: -48.5, speed: 0.72, scale: 1.05, phase: 0.0, dir: 1 },
        { baseY: 3.45, z: -49.2, speed: 0.68, scale: 0.92, phase: 1.4, dir: 1 },
        { baseY: 2.85, z: -47.8, speed: 0.78, scale: 1.1, phase: 2.8, dir: 1 },
        { baseY: 3.75, z: -49.8, speed: 0.62, scale: 0.85, phase: 4.1, dir: 1 },
        { baseY: 2.6, z: -48.2, speed: 0.74, scale: 0.95, phase: 5.5, dir: -1 },
        { baseY: 3.3, z: -49.0, speed: 0.66, scale: 0.88, phase: 7.2, dir: -1 },
        { baseY: 4.05, z: -50.2, speed: 0.58, scale: 0.78, phase: 8.6, dir: 1 },
      ];
      const birds = birdConfigs.map((cfg) => {
        const root = new THREE.Group();
        const lw = new THREE.Mesh(doveWingLeftGeo, doveMat);
        const rw = new THREE.Mesh(doveWingRightGeo, doveMat);
        const bd = new THREE.Mesh(doveBodyGeo, doveBodyMat);
        bd.rotation.x = Math.PI * 0.5;
        lw.renderOrder = 115;
        rw.renderOrder = 115;
        bd.renderOrder = 115;
        root.add(bd, lw, rw);
        root.scale.setScalar(cfg.scale);
        birdGroup.add(root);
        return { root, lw, rw, ...cfg };
      });

      // Orbit & Transform controls
      const orbitControls = new OrbitControls(camera, renderer.domElement);
      orbitControls.enableDamping = !isSoftwareGl;
      orbitControls.dampingFactor = 0.06;
      orbitControls.enabled = false;
      orbitControls.target.set(0, 0, -5);

      const transformControls = new TransformControls(camera, renderer.domElement);
      transformControls.setSize(0.8);
      transformControls.enabled = false;
      const gizmoHelper = transformControls.getHelper();
      gizmoHelper.visible = false;
      scene.add(gizmoHelper);

      let isDraggingGizmo = false;
      transformControls.addEventListener('dragging-changed', (event) => {
        isDraggingGizmo = Boolean(event.value);
        orbitControls.enabled =
          (orbitModeRef.current || interactiveInspectRef.current) && !isDraggingGizmo;

        if (!isDraggingGizmo && transformControls.object && onTransformRef.current) {
          const obj = transformControls.object;
          const id = obj.userData.elementId as string | undefined;
          if (id) {
            const asp = (obj.userData.aspect as number) || 1;
            const normScale =
              asp > 1.25 ? obj.scale.y * Math.pow(asp, 0.35) : obj.scale.y;
            onTransformRef.current(id, {
              x: Number(obj.position.x.toFixed(2)),
              y: Number(obj.position.y.toFixed(2)),
              z: Number(obj.position.z.toFixed(2)),
              rotX: Number(obj.rotation.x.toFixed(3)),
              rotY: Number(obj.rotation.y.toFixed(3)),
              rotZ: Number(obj.rotation.z.toFixed(3)),
              scale: Number(normScale.toFixed(2)),
            });
          }
        }
      });

      const meshMap = new Map<string, THREE.Mesh>();
      const textureCache = new Map<string, CachedTextureEntry>();
      const inFlightTextures = new Map<string, Promise<CachedTextureEntry>>();

      threeStateRef.current = {
        scene,
        camera,
        renderer,
        orbitControls,
        transformControls,
        elementGroup,
        meshMap,
        selectionOutline,
        editorGrid,
        textureCache,
        inFlightTextures,
        maxAnisotropy,
        maxTexDim,
      };

      // Pointer parallax tracking for guest & scrub preview
      const pointerParallax = { x: 0, y: 0 };
      const handlePointerMove = (e: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
        const ny = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
        pointerParallax.x = THREE.MathUtils.clamp(nx, -1, 1);
        pointerParallax.y = THREE.MathUtils.clamp(ny, -1, 1);
      };
      window.addEventListener('pointermove', handlePointerMove, { passive: true });

      // Click-to-select 3D layers in editor mode
      let downPos = { x: 0, y: 0 };
      const handlePointerDown = (e: PointerEvent) => {
        downPos = { x: e.clientX, y: e.clientY };
      };
      const handlePointerUp = (e: PointerEvent) => {
        if (mode !== 'editor' || isDraggingGizmo) return;
        const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
        if (dist > 6) return; // Was an orbit drag, not a click

        const rect = renderer.domElement.getBoundingClientRect();
        _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        _raycaster.setFromCamera(_pointer, camera);

        const meshes = Array.from(meshMap.values()).filter((m) => m.visible);
        const hits = _raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
          const hitId = hits[0].object.userData.elementId as string;
          onSelectRef.current?.(hitId);
        } else {
          onSelectRef.current?.(null);
        }
      };

      renderer.domElement.addEventListener('pointerdown', handlePointerDown);
      renderer.domElement.addEventListener('pointerup', handlePointerUp);

      const handleResize = () => {
        if (!container) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        const asp = w / Math.max(1, h);
        camera.aspect = asp;
        camera.fov = asp < 0.85 ? THREE.MathUtils.lerp(62, 46, Math.max(0, asp - 0.35) / 0.5) : 46;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);

      // WebGL context safety
      const handleContextLost = (ev: Event) => {
        ev.preventDefault();
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

      // Respect reduced motion preference
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

      const clock = new THREE.Clock();
      let frameId = 0;
      let disposed = false;

      function afterDraw(cb: () => void) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (!gl || typeof gl.fenceSync !== 'function') {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      }

      const tick = () => {
        if (disposed) return;
        const delta = Math.min(0.1, clock.getDelta());
        const elapsed = clock.getElapsedTime();

        const useOrbit =
          (mode === 'editor' && orbitModeRef.current) ||
          (mode === 'guest' && interactiveInspectRef.current);

        editorGrid.visible = mode === 'editor' && orbitModeRef.current;

        if (useOrbit) {
          orbitControls.enabled = !isDraggingGizmo;
          orbitControls.update();
        } else {
          orbitControls.enabled = false;
          interpolateCameraStops(
            stopsRef.current,
            scrollRef.current,
            _targetCamPos,
            _targetLookAt,
          );

          // Add subtle Mental Canvas parallax shift from pointer
          const parallaxStrength = prefersReducedMotion ? 0 : 0.42;
          _targetCamPos.x += pointerParallax.x * parallaxStrength;
          _targetCamPos.y += pointerParallax.y * (parallaxStrength * 0.55);

          const dampLambda = prefersReducedMotion ? 18 : 5.5;
          camera.position.x = THREE.MathUtils.damp(
            camera.position.x,
            _targetCamPos.x,
            dampLambda,
            delta,
          );
          camera.position.y = THREE.MathUtils.damp(
            camera.position.y,
            _targetCamPos.y,
            dampLambda,
            delta,
          );
          camera.position.z = THREE.MathUtils.damp(
            camera.position.z,
            _targetCamPos.z,
            dampLambda,
            delta,
          );

          _currentLookAt.x = THREE.MathUtils.damp(
            _currentLookAt.x,
            _targetLookAt.x,
            dampLambda,
            delta,
          );
          _currentLookAt.y = THREE.MathUtils.damp(
            _currentLookAt.y,
            _targetLookAt.y,
            dampLambda,
            delta,
          );
          _currentLookAt.z = THREE.MathUtils.damp(
            _currentLookAt.z,
            _targetLookAt.z,
            dampLambda,
            delta,
          );

          camera.lookAt(_currentLookAt);
          orbitControls.target.copy(_currentLookAt);
        }

        // Living botanical sway, viewport cover sizing for backdrops, & smooth camera cross-fade
        const currentElements = elementsRef.current;
        const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
        for (let i = 0; i < currentElements.length; i++) {
          const el = currentElements[i];
          const mesh = meshMap.get(el.id);
          if (!mesh) continue;

          if (isDraggingGizmo && transformControls.object === mesh) {
            continue; // Do not fight gizmo drag
          }

          const mat = mesh.material as THREE.MeshBasicMaterial;
          if (!el.visible || !mat.map) {
            mesh.visible = false;
            continue;
          }

          const distFromCam = camera.position.z - el.z;
          if (!useOrbit) {
            if (distFromCam <= 0.15 || distFromCam > 22) {
              mesh.visible = false;
              continue;
            }
            mesh.visible = true;
            // Smooth cross-fade as camera glides past layers into the next scene
            const fadeStart = el.removeWhiteBg ? 2.2 : 3.8;
            const fadeEnd = el.removeWhiteBg ? 0.35 : 0.45;
            const passAlpha = THREE.MathUtils.clamp(
              (distFromCam - fadeEnd) / Math.max(0.1, fadeStart - fadeEnd),
              0,
              1,
            );
            mat.opacity = el.opacity * passAlpha;
          } else {
            mesh.visible = true;
            mat.opacity = el.opacity;
          }

          const phase = i * 1.37;
          const motionScale = prefersReducedMotion ? 0 : 1;
          const isTreeOrVine =
            el.label.toLowerCase().includes('pohon') ||
            el.label.toLowerCase().includes('sulur') ||
            el.swayAmplitude >= 0.015;

          const primarySway =
            Math.sin(elapsed * el.swaySpeed + phase) * el.swayAmplitude * motionScale;
          const gustSway = isTreeOrVine
            ? Math.sin(elapsed * (el.swaySpeed * 2.15) + phase * 1.7) *
              (el.swayAmplitude * 0.42) *
              motionScale
            : 0;
          const sway = primarySway + gustSway;
          const branchShiftX = isTreeOrVine ? sway * 1.45 : 0;
          const floatY =
            Math.cos(elapsed * (el.swaySpeed * 0.75) + phase) *
            el.floatAmplitude *
            motionScale;

          mesh.position.set(el.x + branchShiftX, el.y + floatY, el.z);
          mesh.rotation.set(el.rotX, el.rotY + sway * 0.45, el.rotZ + sway);

          const aspect = (mesh.userData.aspect as number) || 1;
          let fitH = aspect > 1.25 ? el.scale / Math.pow(aspect, 0.35) : el.scale;
          let fitW = fitH * aspect;

          if (!el.removeWhiteBg && !useOrbit) {
            // Ensure full-bleed background illustrations cover 100% of viewport even during oblique left-right sweeps
            const effDist = Math.max(4.5, Math.abs(distFromCam));
            const visH = 2 * effDist * tanHalfFov;
            const visW = visH * camera.aspect;
            const lateralNeed = Math.abs(camera.position.x - el.x) * 1.45;
            const coverW = visW * 1.32 + lateralNeed;
            const coverH = Math.max(visH * 1.32, coverW / Math.max(0.25, aspect));
            fitH = Math.max(fitH, coverH);
            fitW = fitH * aspect;
          } else {
            // Keep foreground PNG replacements neatly bounded inside the factory proportion envelope
            const maxW = el.scale * 1.65;
            const minW = el.scale * 0.45;
            if (fitW > maxW) {
              fitW = maxW;
              fitH = fitW / Math.max(0.25, aspect);
            } else if (fitW < minW) {
              fitW = minW;
              fitH = fitW / Math.max(0.25, aspect);
            }
          }

          mesh.scale.set(fitW, fitH, 1);
        }

        // Update selection outline box if an element is selected in editor
        const selId = selectedIdRef.current;
        const selMesh = selId ? meshMap.get(selId) : undefined;
        if (mode === 'editor' && selMesh && selMesh.visible) {
          selectionOutline.visible = true;
          selectionOutline.position.copy(selMesh.position);
          selectionOutline.rotation.copy(selMesh.rotation);
          selectionOutline.scale.copy(selMesh.scale);
        } else {
          selectionOutline.visible = false;
        }

        // Update abundant falling sakura petals floating cleanly across active camera view
        const drift = prefersReducedMotion ? 0 : elapsed;
        for (let i = 0; i < petalCount; i++) {
          const seed = petalSeeds[i];
          const fallSpan = 9.0;
          const rawY = seed.yOffset - drift * seed.speedY;
          const wrappedY = (((rawY % fallSpan) + fallSpan) % fallSpan) - 4.2;
          const py = camera.position.y + wrappedY;
          const px =
            camera.position.x +
            seed.x +
            Math.sin(drift * seed.swayFreq + seed.phase) * 0.55;
          const pz = camera.position.z - seed.zOffset;

          _dummyObj.position.set(px, py, pz);
          _dummyObj.rotation.set(
            drift * seed.rotSpeed,
            drift * seed.rotSpeed * 0.8,
            Math.sin(drift * 1.3 + seed.phase) * 0.8,
          );
          _dummyObj.scale.setScalar(seed.scale);
          _dummyObj.updateMatrix();
          petalsMesh.setMatrixAt(i, _dummyObj.matrix);
        }
        petalsMesh.instanceMatrix.needsUpdate = true;

        // Update animated butterflies: flutter in garden & settle softly on tree/vine branches
        for (let i = 0; i < butterflies.length; i++) {
          const b = butterflies[i];
          const dCam = camera.position.z - b.pz;
          if (!useOrbit && (dCam <= 0.4 || dCam > 14)) {
            b.root.visible = false;
            continue;
          }
          b.root.visible = true;

          const cycle = ((elapsed * 0.095 + b.phase * 0.16) % 1 + 1) % 1;
          let bx = b.px;
          let by = b.py;
          let bz = b.pz;
          let flapAngle = 0.25;
          let yaw = 0.4;

          if (prefersReducedMotion) {
            flapAngle = 0.35;
          } else if (cycle < 0.55) {
            // Free flight figure-8 near the tree branches
            const u = cycle / 0.55;
            const env = Math.sin(u * Math.PI);
            bx = b.px + Math.sin(u * Math.PI * 2 + b.phase) * b.rx * env;
            by = b.py + Math.sin(u * Math.PI * 4) * b.ry * 0.65 * env + 0.18 * env;
            bz = b.pz + Math.cos(u * Math.PI * 2) * 0.22 * env;
            flapAngle = Math.sin(elapsed * 16 + b.phase) * 0.85;
            yaw = Math.cos(u * Math.PI * 2 + b.phase) >= 0 ? 0.3 : -0.3;
          } else if (cycle < 0.9) {
            // Perched softly ("hinggap") on the branch, breathing wings open & closed
            const branchDrift = Math.sin(elapsed * 0.7 + b.phase) * 0.04;
            bx = b.px + branchDrift;
            by = b.py + Math.cos(elapsed * 0.5 + b.phase) * 0.015;
            bz = b.pz;
            flapAngle = 0.22 + Math.sin(elapsed * 2.6 + b.phase) * 0.48;
            yaw = 0.25;
          } else {
            // Gentle lift-off back into flight
            const u = (cycle - 0.9) / 0.1;
            bx = b.px + Math.sin(u * Math.PI * 0.5) * 0.12;
            by = b.py + u * 0.2;
            flapAngle = Math.sin(elapsed * 15 + b.phase) * 0.8;
            yaw = 0.2;
          }

          b.root.position.set(bx, by, bz);
          b.root.rotation.set(0.35, yaw, 0.08 * Math.sin(elapsed * 2 + b.phase));
          b.leftWing.rotation.y = -flapAngle;
          b.rightWing.rotation.y = flapAngle;
        }

        // Update animated birds/doves gliding across Scene 6 Pastel Sky
        for (let i = 0; i < birds.length; i++) {
          const bd = birds[i];
          const dCam = camera.position.z - bd.z;
          if (!useOrbit && (dCam <= 0.4 || dCam > 18)) {
            bd.root.visible = false;
            continue;
          }
          bd.root.visible = true;

          const span = 6.8;
          const progress = (((elapsed * bd.speed + bd.phase * 0.9) % span) + span) % span;
          const xPos = (progress - span * 0.5) * bd.dir;
          const yPos =
            bd.baseY +
            Math.sin(elapsed * 1.1 + bd.phase) * 0.22 +
            (progress / span) * 0.45;
          const flap = prefersReducedMotion
            ? 0.2
            : Math.sin(elapsed * 7.5 + bd.phase * 1.9) * 0.62;

          bd.root.position.set(xPos, yPos, bd.z);
          bd.root.rotation.set(
            0.22,
            bd.dir > 0 ? -0.35 : Math.PI + 0.35,
            Math.sin(elapsed * 1.2 + bd.phase) * 0.08,
          );
          bd.lw.rotation.z = flap;
          bd.rw.rotation.z = -flap;
        }

        renderer.render(scene, camera);

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      };

      tick();

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('resize', handleResize);
        renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
        renderer.domElement.removeEventListener('pointerup', handlePointerUp);
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);

        transformControls.dispose();
        orbitControls.dispose();
        boxGeo.dispose();
        boxMat.dispose();
        petalGeo.dispose();
        petalMat.dispose();
        petalTex.dispose();
        wingRightGeo.dispose();
        wingLeftGeo.dispose();
        bodyGeo.dispose();
        bodyMat.dispose();
        butterflyMats.forEach((m) => m.dispose());
        butterflyTextures.forEach((t) => t.dispose());
        doveWingRightGeo.dispose();
        doveWingLeftGeo.dispose();
        doveBodyGeo.dispose();
        doveMat.dispose();
        doveBodyMat.dispose();
        doveWingTex.dispose();
        textureCache.forEach((entry) => entry.texture.dispose());
        textureCache.clear();
        inFlightTextures.clear();
        meshMap.forEach((m) => {
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
          else m.material.dispose();
        });
        meshMap.clear();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
        threeStateRef.current = null;
      };
    }, [mode]);

    // 2. Sync Sky / Fog background color
    useEffect(() => {
      const st = threeStateRef.current;
      if (!st) return;
      const c = new THREE.Color(skyColorHex);
      st.scene.background = c;
      if (st.scene.fog instanceof THREE.FogExp2) {
        st.scene.fog.color.copy(c);
      }
    }, [skyColorHex]);

    // 3. Sync Elements (Meshes & Textures) incrementally
    useEffect(() => {
      const st = threeStateRef.current;
      if (!st) return;

      const activeIds = new Set(elements.map((e) => e.id));

      // Remove deleted elements
      st.meshMap.forEach((mesh, id) => {
        if (!activeIds.has(id)) {
          if (st.transformControls.object === mesh) {
            st.transformControls.detach();
          }
          st.elementGroup.remove(mesh);
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else mesh.material.dispose();
          st.meshMap.delete(id);
        }
      });

      let cancelled = false;
      const timerIds: number[] = [];

      const loadOrReuseTexture = (el: CanvasElement, cacheKey: string) => {
        const cached = st.textureCache.get(cacheKey);
        if (cached) return Promise.resolve(cached);

        const existing = st.inFlightTextures.get(cacheKey);
        if (existing) return existing;

        const promise = new Promise<CachedTextureEntry>((resolve, reject) => {
          const runProcessing = (img: HTMLImageElement, forceRaw = false) => {
            window.setTimeout(() => {
              if (!threeStateRef.current) {
                reject(new Error('disposed'));
                return;
              }
              try {
                const entry = forceRaw
                  ? (() => {
                      const tex = new THREE.Texture(img);
                      tex.colorSpace = THREE.SRGBColorSpace;
                      tex.needsUpdate = true;
                      return {
                        texture: tex,
                        aspect: (img.naturalWidth || 512) / Math.max(1, img.naturalHeight || 512),
                      };
                    })()
                  : buildProcessedTexture(
                      img,
                      el.removeWhiteBg,
                      Boolean(el.centerWindow),
                      st.maxAnisotropy,
                      st.maxTexDim,
                    );
                st.textureCache.set(cacheKey, entry);
                st.inFlightTextures.delete(cacheKey);
                resolve(entry);
              } catch (err) {
                st.inFlightTextures.delete(cacheKey);
                reject(err);
              }
            }, 0);
          };

          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.decoding = 'async';
          img.onload = () => {
            if (typeof img.decode === 'function') {
              img.decode().catch(() => undefined).finally(() => runProcessing(img));
            } else {
              runProcessing(img);
            }
          };
          img.onerror = () => {
            // Retry without crossOrigin for external CDN URLs lacking CORS headers
            const fallbackImg = new Image();
            fallbackImg.decoding = 'async';
            fallbackImg.onload = () => runProcessing(fallbackImg, true);
            fallbackImg.onerror = () => {
              st.inFlightTextures.delete(cacheKey);
              reject(new Error(`Failed loading ${el.url}`));
            };
            fallbackImg.src = el.url;
          };
          img.src = el.url;
        });

        st.inFlightTextures.set(cacheKey, promise);
        return promise;
      };

      // Sort back-to-front by Z (with sortOrder tie-breaker) for clean transparent layering
      const sortedByZ = [...elements].sort(
        (a, b) => a.z - b.z || a.sortOrder - b.sortOrder,
      );

      const pendingLoads: Array<{ el: CanvasElement; mesh: THREE.Mesh; cacheKey: string }> = [];

      sortedByZ.forEach((el, idx) => {
        let mesh = st.meshMap.get(el.id);
        if (!mesh) {
          const geo = new THREE.PlaneGeometry(1, 1);
          const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: el.opacity,
            alphaTest: 0.03,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          mesh = new THREE.Mesh(geo, mat);
          mesh.visible = false; // Never show untextured white placeholder plane
          mesh.userData.elementId = el.id;
          mesh.userData.aspect = 1;
          st.elementGroup.add(mesh);
          st.meshMap.set(el.id, mesh);
        }

        mesh.renderOrder = idx + 1;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = el.opacity;

        const cacheKey = `${el.url}|${el.removeWhiteBg ? 'cutout' : 'raw'}|${el.centerWindow ? 'win' : 'solid'}`;
        const cached = st.textureCache.get(cacheKey);
        mesh.userData.textureKey = cacheKey;
        if (cached) {
          if (mat.map !== cached.texture) {
            mat.map = cached.texture;
            mat.needsUpdate = true;
          }
          mesh.userData.aspect = cached.aspect;
          mesh.visible = el.visible;
        } else {
          mat.map = null;
          mesh.visible = false;
          pendingLoads.push({ el, mesh, cacheKey });
        }
      });

      // Load Scene 1 (chapterIndex === 0) immediately, then stagger deeper scenes so initial render never stalls
      pendingLoads.sort((a, b) => a.el.chapterIndex - b.el.chapterIndex);

      const attachTexture = (item: { el: CanvasElement; mesh: THREE.Mesh; cacheKey: string }) => {
        loadOrReuseTexture(item.el, item.cacheKey)
          .then((entry) => {
            if (cancelled || !threeStateRef.current) return;
            if (item.mesh.userData.textureKey === item.cacheKey) {
              const m = item.mesh.material as THREE.MeshBasicMaterial;
              m.map = entry.texture;
              m.needsUpdate = true;
              item.mesh.userData.aspect = entry.aspect;
              item.mesh.visible = item.el.visible;
            }
          })
          .catch(() => {
            // Ignore failed or superseded image load
          });
      };

      const scene1Items = pendingLoads.filter((item) => item.el.chapterIndex === 0);
      const laterItems = pendingLoads.filter((item) => item.el.chapterIndex > 0);

      scene1Items.forEach(attachTexture);

      laterItems.forEach((item, idx) => {
        const delayMs = Math.min(900, 140 + item.el.chapterIndex * 110 + idx * 18);
        const id = window.setTimeout(() => {
          if (!cancelled) attachTexture(item);
        }, delayMs);
        timerIds.push(id);
      });

      return () => {
        cancelled = true;
        timerIds.forEach((id) => window.clearTimeout(id));
      };
    }, [elements]);

    // 4. Sync TransformControls attachment & gizmo mode in Editor
    useEffect(() => {
      const st = threeStateRef.current;
      if (!st) return;

      const gizmoHelper = st.transformControls.getHelper();
      if (mode === 'editor' && isOrbitMode && selectedElementId) {
        const targetMesh = st.meshMap.get(selectedElementId);
        if (targetMesh && targetMesh.visible) {
          st.transformControls.setMode(gizmoMode);
          st.transformControls.attach(targetMesh);
          st.transformControls.enabled = true;
          gizmoHelper.visible = true;
          return;
        }
      }

      st.transformControls.detach();
      st.transformControls.enabled = false;
      gizmoHelper.visible = false;
    }, [mode, isOrbitMode, selectedElementId, gizmoMode, elements]);

    return (
      <div
        ref={mountRef}
        className="w-full h-full relative select-none"
        aria-label="Kanvas 3D Floral Interaktif"
      />
    );
  },
);
