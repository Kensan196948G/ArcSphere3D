import { useEffect, useRef } from "react";
import {
  Mesh,
  MeshBasicMaterial,
  Plane,
  Raycaster,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import {
  getActiveCamera,
  getActiveScene,
  getOrbitControls,
  getRendererDomElement,
} from "@/lib/threeContext";
import { useMeasureStore } from "@/state/measureStore";

const MARKER_COLOR = 0xf59e0b;
const MARKER_RADIUS = 0.08;
// Infinite XZ plane at y=0 used when no mesh is hit
const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), 0);

export function useMeasureTool() {
  const markersRef = useRef<Mesh[]>([]);

  useEffect(() => {
    const raycaster = new Raycaster();
    const mouse = new Vector2();

    function addMarker(pos: Vector3) {
      const scene = getActiveScene();
      if (!scene) return;
      const geom = new SphereGeometry(MARKER_RADIUS, 12, 12);
      const mat = new MeshBasicMaterial({ color: MARKER_COLOR });
      const sphere = new Mesh(geom, mat);
      sphere.position.copy(pos);
      scene.add(sphere);
      markersRef.current.push(sphere);
    }

    function clearMarkers() {
      const scene = getActiveScene();
      if (!scene) return;
      markersRef.current.forEach((m) => {
        scene.remove(m);
        m.geometry.dispose();
        (m.material as MeshBasicMaterial).dispose();
      });
      markersRef.current = [];
    }

    let pointerDownX = 0;
    let pointerDownY = 0;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      const store = useMeasureStore.getState();
      if (store.mode === "off") return;

      const dx = e.clientX - pointerDownX;
      const dy = e.clientY - pointerDownY;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;

      const camera = getActiveCamera();
      const domElement = getRendererDomElement();
      const scene = getActiveScene();
      if (!camera || !domElement || !scene) return;

      const rect = domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // Try scene meshes first; fall back to floor plane
      const meshes: Mesh[] = [];
      scene.traverse((obj) => {
        const m = obj as Mesh;
        if (m.isMesh) meshes.push(m);
      });

      const hits = raycaster.intersectObjects(meshes, false);
      let hitPoint: Vector3;
      if (hits.length > 0) {
        hitPoint = hits[0].point.clone();
      } else {
        const p = new Vector3();
        raycaster.ray.intersectPlane(FLOOR_PLANE, p);
        hitPoint = p;
      }

      addMarker(hitPoint);
      store.addPoint(hitPoint);
    };

    // Subscribe to mode changes to clear markers when mode resets
    const unsub = useMeasureStore.subscribe((state, prev) => {
      if (
        state.mode !== prev.mode ||
        state.points.length < prev.points.length
      ) {
        clearMarkers();
        // Re-add markers for current points (after mode switch they'll be empty)
        state.points.forEach(addMarker);
      }
    });

    // Attach/detach events based on mode
    function attachEvents() {
      const el = getRendererDomElement();
      if (!el) return;
      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("pointerup", onPointerUp);
    }

    function detachEvents() {
      const el = getRendererDomElement();
      if (!el) return;
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
    }

    // Watch for mode changes to toggle OrbitControls
    const unsubMode = useMeasureStore.subscribe((state, prev) => {
      const orbit = getOrbitControls();
      if (!orbit) return;
      const wasOff = prev.mode === "off";
      const isOff = state.mode === "off";
      if (wasOff && !isOff) {
        attachEvents();
      } else if (!wasOff && isOff) {
        detachEvents();
      }
    });

    // If already active on mount (e.g. hot reload), attach events
    if (useMeasureStore.getState().mode !== "off") {
      attachEvents();
    }

    return () => {
      unsub();
      unsubMode();
      detachEvents();
      clearMarkers();
    };
  }, []);
}
