/**
 * CAD primitive shape generators backed by Three.js geometry.
 *
 * Design intent: the public API (PrimitiveSpec + createPrimitive) mirrors
 * what a real OpenCascade.js integration would expose — callers only deal
 * with named parameters and receive a Three.js Object3D.  When OCC.js WASM
 * becomes available, swap the implementation here without touching the UI.
 */

import * as THREE from "three";

export type PrimitiveType = "box" | "sphere" | "cylinder" | "cone" | "torus";

export interface BoxParams {
  type: "box";
  width: number;
  height: number;
  depth: number;
}

export interface SphereParams {
  type: "sphere";
  radius: number;
  segments: number;
}

export interface CylinderParams {
  type: "cylinder";
  radiusTop: number;
  radiusBottom: number;
  height: number;
  segments: number;
}

export interface ConeParams {
  type: "cone";
  radius: number;
  height: number;
  segments: number;
}

export interface TorusParams {
  type: "torus";
  radius: number;
  tube: number;
  radialSegments: number;
  tubularSegments: number;
}

export type PrimitiveSpec =
  | BoxParams
  | SphereParams
  | CylinderParams
  | ConeParams
  | TorusParams;

function defaultMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x5588cc,
    roughness: 0.6,
    metalness: 0.1,
  });
}

export function createPrimitive(spec: PrimitiveSpec): THREE.Mesh {
  let geometry: THREE.BufferGeometry;

  switch (spec.type) {
    case "box":
      geometry = new THREE.BoxGeometry(spec.width, spec.height, spec.depth);
      break;
    case "sphere":
      geometry = new THREE.SphereGeometry(
        spec.radius,
        spec.segments,
        spec.segments,
      );
      break;
    case "cylinder":
      geometry = new THREE.CylinderGeometry(
        spec.radiusTop,
        spec.radiusBottom,
        spec.height,
        spec.segments,
      );
      break;
    case "cone":
      geometry = new THREE.ConeGeometry(
        spec.radius,
        spec.height,
        spec.segments,
      );
      break;
    case "torus":
      geometry = new THREE.TorusGeometry(
        spec.radius,
        spec.tube,
        spec.radialSegments,
        spec.tubularSegments,
      );
      break;
  }

  const mesh = new THREE.Mesh(geometry, defaultMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function primitiveLabel(spec: PrimitiveSpec): string {
  switch (spec.type) {
    case "box":
      return `Box(${spec.width}×${spec.height}×${spec.depth})`;
    case "sphere":
      return `Sphere(r=${spec.radius})`;
    case "cylinder":
      return `Cylinder(r=${spec.radiusTop},h=${spec.height})`;
    case "cone":
      return `Cone(r=${spec.radius},h=${spec.height})`;
    case "torus":
      return `Torus(R=${spec.radius},r=${spec.tube})`;
  }
}
