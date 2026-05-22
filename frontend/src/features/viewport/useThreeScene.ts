import { useEffect, useRef } from "react";
import {
  AmbientLight,
  AxesHelper,
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { useSceneStore, type SceneObject } from "@/state/sceneStore";
import { useIfcStore } from "@/state/ifcStore";
import { useThemeStore } from "@/state/themeStore";
import { useViewportStore } from "@/state/viewportStore";
import {
  setActiveCamera,
  setActiveScene,
  setOrbitControls,
  setRendererDomElement,
  setTransformControls,
} from "@/lib/threeContext";

const MAX_DPR = 2;

const THEME_BG = { dark: "#0b1020", light: "#e8edf2" } as const;
const GRID_COLORS = {
  dark: [0x4b5563, 0x1f2937] as [number, number],
  light: [0x9ca3af, 0xd1d5db] as [number, number],
};

function setSelectionHighlight(
  objects: SceneObject[],
  selectedId: string | null,
) {
  objects.forEach(({ id, object }) => {
    object.traverse((child) => {
      const m = child as Mesh;
      if (!m.isMesh) return;
      const mat = m.material;
      const highlight = id === selectedId;
      const applyHighlight = (x: MeshStandardMaterial) => {
        x.emissive.setHex(highlight ? 0x2563eb : 0x000000);
        x.emissiveIntensity = highlight ? 0.3 : 0;
      };
      if (Array.isArray(mat)) {
        mat.forEach((x) => {
          if (x instanceof MeshStandardMaterial) applyHighlight(x);
        });
      } else if (mat instanceof MeshStandardMaterial) {
        applyHighlight(mat);
      }
    });
  });
}

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
    camera.position.set(
      DEFAULT_CAM_POS.x,
      DEFAULT_CAM_POS.y,
      DEFAULT_CAM_POS.z,
    );
    camera.lookAt(0, 0, 0);

    // --- Renderer ---
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
    } catch {
      // WebGL not available (headless browsers, old GPU drivers)
      useSceneStore
        .getState()
        .log("[viewport] WebGL unavailable — 3D rendering disabled");
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
        const t = useThemeStore.getState().theme;
        const [c1, c2] = GRID_COLORS[t];
        grid = new GridHelper(size, size, c1, c2);
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
    setActiveCamera(camera);
    setOrbitControls(controls);
    setRendererDomElement(renderer.domElement);
    useSceneStore.getState().log("[viewport] WebGL initialised");

    // --- sceneStore subscription ---
    const applyStoreState = (
      selectedId: string | null,
      mode: "translate" | "rotate" | "scale",
    ) => {
      tcontrols.setMode(mode);
      if (!selectedId) {
        tcontrols.detach();
      } else {
        const target = useSceneStore
          .getState()
          .objects.find((o) => o.id === selectedId)?.object;
        if (target) tcontrols.attach(target);
        else tcontrols.detach();
      }
      setSelectionHighlight(useSceneStore.getState().objects, selectedId);
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
        setSelectionHighlight(state.objects, state.selectedId);
      }
    });

    // --- viewportStore subscription ---
    const unsubViewport = useViewportStore.subscribe((state, prev) => {
      if (state.bgColor !== prev.bgColor) {
        scene.background = new Color(state.bgColor);
      }
      if (
        state.showGrid !== prev.showGrid ||
        state.gridSize !== prev.gridSize
      ) {
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
              if (x instanceof MeshStandardMaterial)
                x.wireframe = state.wireframe;
            });
          } else if (mat instanceof MeshStandardMaterial) {
            mat.wireframe = state.wireframe;
          }
        });
      }
      if (state._cameraResetCount !== prev._cameraResetCount) {
        const PRESET_CAM: Record<
          string,
          { pos: [number, number, number]; target: [number, number, number] }
        > = {
          perspective: {
            pos: [DEFAULT_CAM_POS.x, DEFAULT_CAM_POS.y, DEFAULT_CAM_POS.z],
            target: [0, 0.5, 0],
          },
          top: { pos: [0, 20, 0.001], target: [0, 0, 0] },
          front: { pos: [0, 5, 20], target: [0, 0, 0] },
          side: { pos: [20, 5, 0], target: [0, 0, 0] },
        };
        const { pos, target } =
          PRESET_CAM[state._cameraPreset] ?? PRESET_CAM.perspective;
        camera.position.set(...pos);
        camera.lookAt(...target);
        controls.target.set(...target);
        controls.update();
      }
      if (state._focusCount !== prev._focusCount) {
        const selectedId = useSceneStore.getState().selectedId;
        const target = selectedId
          ? useSceneStore.getState().objects.find((o) => o.id === selectedId)
              ?.object
          : null;
        if (target) {
          const box = new Box3().setFromObject(target);
          const center = new Vector3();
          box.getCenter(center);
          const size = new Vector3();
          box.getSize(size);
          const distance = Math.max(size.length() * 1.5, 1);
          const dir = camera.position.clone().sub(center).normalize();
          camera.position.copy(center).addScaledVector(dir, distance);
          camera.lookAt(center);
          controls.target.copy(center);
          controls.update();
        }
      }
    });

    // --- themeStore subscription: sync 3D background + grid with UI theme ---
    const unsubTheme = useThemeStore.subscribe((state, prev) => {
      if (state.theme === prev.theme) return;
      const newBg = THEME_BG[state.theme];
      scene.background = new Color(newBg);
      useViewportStore.getState().setBgColor(newBg);
      rebuildGrid(useViewportStore.getState().gridSize);
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
      else if (e.key === "f" || e.key === "F") {
        if (store.selectedId) useViewportStore.getState().focusObject();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (store.selectedId) store.removeObject(store.selectedId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        if (store.selectedId) store.duplicateObject(store.selectedId);
      }
    };
    window.addEventListener("keydown", onKey);

    // --- Raycasting click selection ---
    const raycaster = new Raycaster();
    const mouse = new Vector2();
    let pointerDownX = 0;
    let pointerDownY = 0;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownX;
      const dy = e.clientY - pointerDownY;
      // Skip if pointer moved more than 5px — treat as orbit drag, not click.
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // Collect all Mesh objects in the scene, excluding TransformControls helper.
      const meshes: Mesh[] = [];
      scene.traverse((obj) => {
        if (obj === gizmoHelper) return;
        let node: Object3D | null = obj;
        while (node) {
          if (node === gizmoHelper) return;
          node = node.parent;
        }
        const m = obj as Mesh;
        if (m.isMesh) meshes.push(m);
      });

      const hits = raycaster.intersectObjects(meshes, false);
      const store = useSceneStore.getState();

      if (hits.length > 0) {
        const hitObj = hits[0].object;
        // Walk parent chain to find a matching sceneStore entry.
        let node: Object3D | null = hitObj;
        let entry = store.objects.find((o) => o.object === node);
        while (!entry && node !== null && node.parent !== null) {
          node = node.parent;
          entry = store.objects.find((o) => o.object === node);
        }
        if (entry) store.select(entry.id);

        // Check for IFC expressID walking up from the hit mesh.
        let ifcNode: Object3D | null = hitObj;
        while (ifcNode) {
          if (ifcNode.userData.ifcExpressId != null) {
            useIfcStore
              .getState()
              .selectElement(ifcNode.userData.ifcExpressId as number);
            break;
          }
          ifcNode = ifcNode.parent;
        }
      } else {
        store.select(null);
        useIfcStore.getState().selectElement(null);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

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
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      unsubScene();
      unsubViewport();
      unsubTheme();
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
      setActiveCamera(null);
      setOrbitControls(null);
      setRendererDomElement(null);
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
