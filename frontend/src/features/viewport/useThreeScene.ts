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
import { useSceneStore } from "@/state/sceneStore";
import { setActiveScene } from "@/lib/threeContext";

const MAX_DPR = 2;

/**
 * Mounts a Three.js scene into the given container.
 * Returns a cleanup function (handled internally via useEffect).
 *
 * StrictMode-safe: full disposal of renderer, controls, geometry, materials.
 */
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
    scene.background = new Color("#0b1020");

    // --- Camera ---
    const camera = new PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(6, 5, 8);
    camera.lookAt(0, 0, 0);

    // --- Renderer ---
    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    // --- Lights ---
    const ambient = new AmbientLight(0xffffff, 0.6);
    const dir = new DirectionalLight(0xffffff, 0.9);
    dir.position.set(8, 12, 6);
    scene.add(ambient, dir);

    // --- Helpers ---
    const grid = new GridHelper(20, 20, 0x4b5563, 0x1f2937);
    const axes = new AxesHelper(2);
    scene.add(grid, axes);

    // --- Demo cube (removable via right panel) ---
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

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.5, 0);
    controls.update();

    // Expose scene to FileLoader & other features.
    setActiveScene(scene);
    useSceneStore.getState().log("[viewport] WebGL initialised");

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
      ro.disconnect();
      controls.dispose();
      // Dispose all geometries / materials we added.
      scene.traverse((obj) => {
        const m = obj as Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat && "dispose" in mat) (mat as { dispose: () => void }).dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      setActiveScene(null);
      // Clear store so the next mount starts clean (StrictMode double-mount).
      useSceneStore.setState({ objects: [], logs: [] });
      initRef.current = false;
    };
  }, [containerRef]);
}
