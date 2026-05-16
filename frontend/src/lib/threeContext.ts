import type { Scene } from "three";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

interface ThreeRegistry {
  scene: Scene | null;
  transformControls: TransformControls | null;
}

const registry: ThreeRegistry = { scene: null, transformControls: null };

export function setActiveScene(scene: Scene | null) {
  registry.scene = scene;
}

export function getActiveScene(): Scene | null {
  return registry.scene;
}

export function setTransformControls(controls: TransformControls | null) {
  registry.transformControls = controls;
}

export function getTransformControls(): TransformControls | null {
  return registry.transformControls;
}
