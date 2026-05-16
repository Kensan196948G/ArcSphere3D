import { useEffect, useRef } from "react";
import Delaunator from "delaunator";
import {
  BufferGeometry,
  Float32BufferAttribute,
  LineSegments,
  LineBasicMaterial,
  Mesh,
  MeshPhongMaterial,
  DoubleSide,
  Color,
} from "three";
import { getActiveScene } from "@/lib/threeContext";
import { useTerrainStore, type TerrainPoint } from "@/state/terrainStore";

const EDGE_COLOR = 0x166534;

function buildTinMesh(points: TerrainPoint[]): Mesh | null {
  if (points.length < 3) return null;

  const coords = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    coords[i * 2] = points[i].x;
    coords[i * 2 + 1] = points[i].z;
  }

  const d = new Delaunator(coords);
  const { triangles } = d;

  const positions = new Float32Array(triangles.length * 3);

  for (let i = 0; i < triangles.length; i++) {
    const p = points[triangles[i]];
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();

  // Height-based vertex color using elevation
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const range = maxY - minY || 1;

  const colors = new Float32Array(triangles.length * 3);
  for (let i = 0; i < triangles.length; i++) {
    const t = (points[triangles[i]].y - minY) / range;
    const c = new Color();
    c.setHSL(0.33 - t * 0.33, 0.8, 0.45 + t * 0.2); // green → yellow
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute("color", new Float32BufferAttribute(colors, 3));

  const mat = new MeshPhongMaterial({
    vertexColors: true,
    side: DoubleSide,
    transparent: true,
    opacity: 0.85,
  });

  return new Mesh(geom, mat);
}

function buildEdges(points: TerrainPoint[]): LineSegments | null {
  if (points.length < 3) return null;

  const coords = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    coords[i * 2] = points[i].x;
    coords[i * 2 + 1] = points[i].z;
  }

  const d = new Delaunator(coords);
  const { triangles } = d;

  const edgeSet = new Set<string>();
  const lineVerts: number[] = [];

  for (let i = 0; i < triangles.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const a = triangles[i + j];
      const b = triangles[i + ((j + 1) % 3)];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        const pa = points[a];
        const pb = points[b];
        lineVerts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      }
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(lineVerts, 3));
  const mat = new LineBasicMaterial({ color: EDGE_COLOR });
  return new LineSegments(geom, mat);
}

export function useTinSurface() {
  const meshRef = useRef<Mesh | null>(null);
  const edgesRef = useRef<LineSegments | null>(null);

  useEffect(() => {
    const unsub = useTerrainStore.subscribe((state) => {
      const scene = getActiveScene();
      if (!scene) return;

      // Remove previous objects
      if (meshRef.current) {
        scene.remove(meshRef.current);
        meshRef.current.geometry.dispose();
        meshRef.current = null;
      }
      if (edgesRef.current) {
        scene.remove(edgesRef.current);
        edgesRef.current.geometry.dispose();
        edgesRef.current = null;
      }

      if (!state.showTin || state.points.length < 3) return;

      const mesh = buildTinMesh(state.points);
      if (mesh) {
        scene.add(mesh);
        meshRef.current = mesh;
      }

      if (state.showContours) {
        const edges = buildEdges(state.points);
        if (edges) {
          scene.add(edges);
          edgesRef.current = edges;
        }
      }
    });

    return () => {
      unsub();
      const scene = getActiveScene();
      if (scene) {
        if (meshRef.current) scene.remove(meshRef.current);
        if (edgesRef.current) scene.remove(edgesRef.current);
      }
    };
  }, []);
}
