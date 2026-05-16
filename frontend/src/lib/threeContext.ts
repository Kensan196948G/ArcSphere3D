import type { PerspectiveCamera, Scene } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

interface ThreeRegistry {
  scene: Scene | null;
  transformControls: TransformControls | null;
  camera: PerspectiveCamera | null;
  orbitControls: OrbitControls | null;
  domElement: HTMLElement | null;
}

const registry: ThreeRegistry = {
  scene: null,
  transformControls: null,
  camera: null,
  orbitControls: null,
  domElement: null,
};

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

export function setActiveCamera(camera: PerspectiveCamera | null) {
  registry.camera = camera;
}

export function getActiveCamera(): PerspectiveCamera | null {
  return registry.camera;
}

export function setOrbitControls(controls: OrbitControls | null) {
  registry.orbitControls = controls;
}

export function getOrbitControls(): OrbitControls | null {
  return registry.orbitControls;
}

export function setRendererDomElement(el: HTMLElement | null) {
  registry.domElement = el;
}

export function getRendererDomElement(): HTMLElement | null {
  return registry.domElement;
}
