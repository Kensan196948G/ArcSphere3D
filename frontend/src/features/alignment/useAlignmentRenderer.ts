import { useEffect, useRef } from "react";
import {
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { getActiveScene } from "@/lib/threeContext";
import { useAlignmentStore, type Alignment } from "@/state/alignmentStore";

const IP_COLOR = 0xef4444;
const TANGENT_COLOR = 0x22c55e;
const CURVE_COLOR = 0xf59e0b;
const IP_RADIUS = 0.2;
const ARC_SEGMENTS = 48;

type SceneObj = Mesh | Line;

function buildIpSphere(x: number, z: number, id: string): Mesh {
  const geom = new SphereGeometry(IP_RADIUS, 12, 12);
  const mat = new MeshBasicMaterial({ color: IP_COLOR });
  const sphere = new Mesh(geom, mat);
  sphere.position.set(x, 0, z);
  sphere.userData = { alignmentRole: "ip-point", ipId: id };
  return sphere;
}

function buildTangentLine(
  sx: number,
  sz: number,
  ex: number,
  ez: number,
): Line {
  const pts = [new Vector3(sx, 0, sz), new Vector3(ex, 0, ez)];
  const geom = new BufferGeometry().setFromPoints(pts);
  const mat = new LineBasicMaterial({ color: TANGENT_COLOR });
  return new Line(geom, mat);
}

function buildCurveArc(
  sx: number,
  sz: number,
  ex: number,
  ez: number,
  cx: number,
  cz: number,
  radius: number,
): Line {
  const aStart = Math.atan2(sz - cz, sx - cx);
  const aEnd = Math.atan2(ez - cz, ex - cx);
  let delta = aEnd - aStart;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;

  const pts: Vector3[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const angle = aStart + (delta * i) / ARC_SEGMENTS;
    pts.push(new Vector3(cx + radius * Math.cos(angle), 0, cz + radius * Math.sin(angle)));
  }

  const geom = new BufferGeometry().setFromPoints(pts);
  const mat = new LineBasicMaterial({ color: CURVE_COLOR });
  return new Line(geom, mat);
}

function disposeObj(obj: SceneObj): void {
  obj.geometry.dispose();
  if (obj instanceof Mesh) (obj.material as MeshBasicMaterial).dispose();
  else (obj.material as LineBasicMaterial).dispose();
}

function getActiveAlignment(
  state: ReturnType<typeof useAlignmentStore.getState>,
): Alignment | null {
  return state.alignments.find((a) => a.id === state.activeId) ?? null;
}

export function useAlignmentRenderer(): void {
  const objsRef = useRef<SceneObj[]>([]);

  useEffect(() => {
    function clearAll(): void {
      const scene = getActiveScene();
      objsRef.current.forEach((obj) => {
        scene?.remove(obj);
        disposeObj(obj);
      });
      objsRef.current = [];
    }

    function rebuild(alignment: Alignment | null): void {
      clearAll();
      const scene = getActiveScene();
      if (!scene || !alignment) return;

      for (const pt of alignment.ipPoints) {
        const sphere = buildIpSphere(pt.x, pt.z, pt.id);
        scene.add(sphere);
        objsRef.current.push(sphere);
      }

      for (const el of alignment.elements) {
        if (el.type === "tangent") {
          const line = buildTangentLine(el.startX, el.startZ, el.endX, el.endZ);
          scene.add(line);
          objsRef.current.push(line);
        } else if (
          el.type === "curve" &&
          el.centerX !== undefined &&
          el.centerZ !== undefined &&
          el.radius !== undefined
        ) {
          const arc = buildCurveArc(
            el.startX,
            el.startZ,
            el.endX,
            el.endZ,
            el.centerX,
            el.centerZ,
            el.radius,
          );
          scene.add(arc);
          objsRef.current.push(arc);
        }
      }
    }

    rebuild(getActiveAlignment(useAlignmentStore.getState()));

    let prevActiveId = useAlignmentStore.getState().activeId;
    let prevAlignments = useAlignmentStore.getState().alignments;

    const unsubscribe = useAlignmentStore.subscribe((state) => {
      if (state.activeId !== prevActiveId || state.alignments !== prevAlignments) {
        prevActiveId = state.activeId;
        prevAlignments = state.alignments;
        rebuild(getActiveAlignment(state));
      }
    });

    return () => {
      clearAll();
      unsubscribe();
    };
  }, []);
}
