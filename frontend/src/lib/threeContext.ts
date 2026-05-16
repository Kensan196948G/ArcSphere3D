import type { Scene } from "three";

interface ThreeRegistry {
  scene: Scene | null;
}

const registry: ThreeRegistry = { scene: null };

export function setActiveScene(scene: Scene | null) {
  registry.scene = scene;
}

export function getActiveScene(): Scene | null {
  return registry.scene;
}
