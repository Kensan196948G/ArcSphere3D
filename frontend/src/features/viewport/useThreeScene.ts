import { useEffect, useRef } from "react";
import {
  AmbientLight,
  AxesHelper,
  BoxGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { useSceneStore } from "@/state/sceneStore";
import { useViewportStore } from "@/state/viewportStore";
import { setActiveScene, setTransformControls } from "@/lib/threeContext";

const MAX_DPR = 2;

export function useThreeScene(containerRef: React.RefObject<HTMLDivElement>) {
  const initRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (initRef.current) return;
    initRef.current = true;

    const { clientWidth: w, clientHeight: h } = container;

    // --- Scene ---
    const scene = new Scene();
    const vp = useViewportStore.getState();
    scene.background = new Color(vp.bgColor);

    // --- Camera ---
    const camera = new PerspectiveCamera(45, w / h, 0.1, 1000);
    const DEFAULT_CAM_POS = { x: 6, y: 5, z: 8 };
    camera.position.set(DEFAULT_CAM_POS.x, DEFAULT_CAM_POS.y, DEFAULT_CAM_POS.z);
    camera.lookAt(0, 0, 0);

    // --- Renderer ---
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      // WebGL not available (headless browsers, old GPU drivers)
      useSceneStore.getState().log("[viewport] WebGL unavailable — 3D rendering disabled");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    // --- Lights ---
    const ambient = new AmbientLight(0xffffff, vp.ambientIntensity);
    const dir = new DirectionalLight(0xffffff, vp.dirIntensity);
    dir.position.set(8, 12, 6);
    scene.add(ambient, dir);

    // --- Helpers (mutable refs so viewportStore can swap them) ---
    let grid: GridHelper | null = null;
    let axes: AxesHelper | null = null;

    function rebuildGrid(size: number) {
      if (grid) {
        scene.remove(grid);
        grid.dispose();
      }
      if (useViewportStore.getState().showGrid) {
        grid = new GridHelper(size, size, 0x4b5563, 0x1f2937);
        scene.add(grid);
      } else {
        grid = null;
      }
    }

    function rebuildAxes() {
      if (axes) {
        scene.remove(axes);
        axes.dispose();
      }
      if (useViewportStore.getState().showAxes) {
        axes = new AxesHelper(2);
        scene.add(axes);
      } else {
        axes = null;
      }
    }

    rebuildGrid(vp.gridSize);
    rebuildAxes();

    // --- Demo cube ---
    const cubeGeom = new BoxGeometry(1.5, 1.5, 1.5);
    const cubeMat = new MeshStandardMaterial({
      color: 0x5eead4,
      roughness: 0.4,
      metalness: 0.15,
    });
    const cube = new Mesh(cubeGeom, cubeMat);
    cube.position.set(0, 0.75, 0);
    cube.name = "demo-cube";
    scene.add(cube);
    useSceneStore.getState().addObject({
      id: "demo-cube",
      name: "Demo Cube",
      object: cube,
    });

    // --- Camera controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.5, 0);
    controls.update();

    // --- Transform gizmo ---
    const tcontrols = new TransformControls(camera, renderer.domElement);
    tcontrols.setSize(0.9);
    tcontrols.addEventListener("dragging-changed", (e) => {
      controls.enabled = !e.value;
    });
    const gizmoHelper = tcontrols.getHelper();
    scene.add(gizmoHelper);

    setActiveScene(scene);
    setTransformControls(tcontrols);
    useSceneStore.getState().log("[viewport] WebGL initialised");

    // --- sceneStore subscription ---
    const applyStoreState = (
      selectedId: string | null,
      mode: "translate" | "rotate" | "scale",
    ) => {
      tcontrols.setMode(mode);
      if (!selectedId) {
        tcontrols.detach();
        return;
      }
      const target = useSceneStore
        .getState()
        .objects.find((o) => o.id === selectedId)?.object;
      if (target) tcontrols.attach(target);
      else tcontrols.detach();
    };
    const initial = useSceneStore.getState();
    applyStoreState(initial.selectedId, initial.transformMode);
    const unsubScene = useSceneStore.subscribe((state, prev) => {
      if (
        state.selectedId !== prev.selectedId ||
        state.transformMode !== prev.transformMode ||
        state.objects !== prev.objects
      ) {
        applyStoreState(state.selectedId, state.transformMode);
      }
    });

    // --- viewportStore subscription ---
    const unsubViewport = useViewportStore.subscribe((state, prev) => {
      if (state.bgColor !== prev.bgColor) {
        scene.background = new Color(state.bgColor);
      }
      if (state.showGrid !== prev.showGrid || state.gridSize !== prev.gridSize) {
        rebuildGrid(state.gridSize);
      }
      if (state.showAxes !== prev.showAxes) {
        rebuildAxes();
      }
      if (state.ambientIntensity !== prev.ambientIntensity) {
        ambient.intensity = state.ambientIntensity;
      }
      if (state.dirIntensity !== prev.dirIntensity) {
        dir.intensity = state.dirIntensity;
      }
      if (state.wireframe !== prev.wireframe) {
        scene.traverse((obj) => {
          const m = obj as Mesh;
          if (!m.isMesh) return;
          const mat = m.material;
          if (Array.isArray(mat)) {
            mat.forEach((x) => {
              if (x instanceof MeshStandardMaterial) x.wireframe = state.wireframe;
            });
          } else if (mat instanceof MeshStandardMaterial) {
            mat.wireframe = state.wireframe;
          }
        });
      }
      if (state._cameraResetCount !== prev._cameraResetCount) {
        camera.position.set(DEFAULT_CAM_POS.x, DEFAULT_CAM_POS.y, DEFAULT_CAM_POS.z);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0.5, 0);
        controls.update();
      }
    });

    // --- Keyboard shortcuts ---
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const store = useSceneStore.getState();
      if (e.key === "w" || e.key === "W") store.setTransformMode("translate");
      else if (e.key === "e" || e.key === "E") store.setTransformMode("rotate");
      else if (e.key === "r" || e.key === "R") store.setTransformMode("scale");
      else if (e.key === "Escape") store.select(null);
    };
    window.addEventListener("keydown", onKey);

    // --- Resize ---
    const resize = () => {
      const W = container.clientWidth;
      const H = container.clientHeight;
      if (W === 0 || H === 0) return;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // --- Render loop ---
    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      unsubScene();
      unsubViewport();
      ro.disconnect();
      tcontrols.detach();
      scene.remove(gizmoHelper);
      tcontrols.dispose();
      controls.dispose();
      scene.traverse((obj) => {
        const m = obj as Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat && "dispose" in mat)
          (mat as { dispose: () => void }).dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      setActiveScene(null);
      setTransformControls(null);
      useSceneStore.setState({
        objects: [],
        logs: [],
        selectedId: null,
        transformMode: "translate",
      });
      initRef.current = false;
    };
  }, [containerRef]);
}
