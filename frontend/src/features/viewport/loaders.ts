import {
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
export type SupportedExt = "stl" | "obj" | "gltf" | "glb" | "ifc";

const DEFAULT_MATERIAL = new MeshStandardMaterial({
  color: 0x9ca3af,
  roughness: 0.5,
  metalness: 0.1,
});

export function extOf(filename: string): SupportedExt | null {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return null;
  const ext = m[1];
  if (ext === "stl" || ext === "obj" || ext === "gltf" || ext === "glb" || ext === "ifc") {
    return ext as SupportedExt;
  }
  return null;
}

async function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

async function readText(file: File): Promise<string> {
  return await file.text();
}

/** Load a 3D model from a remote URL (e.g. S3 pre-signed URL). */
export async function loadFromUrl(url: string, filename: string): Promise<Object3D> {
  const ext = extOf(filename);
  if (!ext) throw new Error(`Unsupported file extension: ${filename}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  switch (ext) {
    case "stl": {
      const buf = await res.arrayBuffer();
      const geom: BufferGeometry = new STLLoader().parse(buf);
      geom.computeVertexNormals();
      const mesh = new Mesh(geom, DEFAULT_MATERIAL.clone());
      mesh.name = filename;
      return mesh;
    }
    case "obj": {
      const txt = await res.text();
      const group: Group = new OBJLoader().parse(txt);
      group.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh && !m.material) m.material = DEFAULT_MATERIAL.clone();
      });
      group.name = filename;
      return group;
    }
    case "gltf":
    case "glb": {
      const buf = await res.arrayBuffer();
      const loader = new GLTFLoader();
      return await new Promise<Object3D>((resolve, reject) => {
        loader.parse(
          buf,
          "",
          (gltf) => {
            const scene = gltf.scene;
            scene.name = filename;
            resolve(scene);
          },
          (err) => reject(err),
        );
      });
    }
    case "ifc": {
      const buf = await res.arrayBuffer();
      const { loadIfc } = await import("./ifcLoader");
      return await loadIfc(buf, filename);
    }
  }
}

export async function loadFile(file: File): Promise<Object3D> {
  const ext = extOf(file.name);
  if (!ext) {
    throw new Error(`Unsupported file extension: ${file.name}`);
  }

  switch (ext) {
    case "stl": {
      const buf = await readArrayBuffer(file);
      const geom: BufferGeometry = new STLLoader().parse(buf);
      geom.computeVertexNormals();
      const mesh = new Mesh(geom, DEFAULT_MATERIAL.clone());
      mesh.name = file.name;
      return mesh;
    }
    case "obj": {
      const txt = await readText(file);
      const group: Group = new OBJLoader().parse(txt);
      group.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh && !m.material) m.material = DEFAULT_MATERIAL.clone();
      });
      group.name = file.name;
      return group;
    }
    case "gltf":
    case "glb": {
      const buf = await readArrayBuffer(file);
      const loader = new GLTFLoader();
      return await new Promise<Object3D>((resolve, reject) => {
        loader.parse(
          buf,
          "",
          (gltf) => {
            const scene = gltf.scene;
            scene.name = file.name;
            resolve(scene);
          },
          (err) => reject(err),
        );
      });
    }
    case "ifc": {
      const buf = await readArrayBuffer(file);
      const { loadIfc } = await import("./ifcLoader");
      return await loadIfc(buf, file.name);
    }
  }
}
