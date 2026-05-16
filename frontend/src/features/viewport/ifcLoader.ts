/**
 * IFC loader using web-ifc's IfcAPI (loaded as IIFE from /web-ifc/web-ifc-api.js).
 * web-ifc is NOT bundled by rollup — it is served from public/web-ifc/ to avoid
 * a 5.7 MB minified-JS OOM during rollup transform (ADR: web-ifc public IIFE).
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";

// web-ifc is loaded as a global IIFE before the module bundle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const WebIFC: any;

let _api: unknown | null = null;

async function getApi(): Promise<unknown> {
  if (_api) return _api;
  if (typeof WebIFC === "undefined") {
    throw new Error("web-ifc IIFE not loaded — ensure /web-ifc/web-ifc-api.js is present in public/");
  }
  const api = new WebIFC.IfcAPI();
  api.SetWasmPath("/web-ifc/");
  await api.Init();
  _api = api;
  return api;
}

/** Load an IFC file from an ArrayBuffer and return a Three.js Group. */
export async function loadIfc(buffer: ArrayBuffer, filename: string): Promise<Group> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = (await getApi()) as any;
  const data = new Uint8Array(buffer);
  const modelId = api.OpenModel(data);

  const group = new Group();
  group.name = filename;

  api.StreamAllMeshes(modelId, (flatMesh: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fm = flatMesh as any;
    const meshGroup = new Group();

    for (let g = 0; g < fm.geometries.size(); g++) {
      const placedGeom = fm.geometries.get(g);
      const geomData = api.GetGeometry(modelId, placedGeom.geometryExpressID);

      const vertices = api.GetVertexArray(
        geomData.GetVertexData(),
        geomData.GetVertexDataSize(),
      );
      const indices = api.GetIndexArray(
        geomData.GetIndexData(),
        geomData.GetIndexDataSize(),
      );

      // web-ifc interleaves position (xyz) + normal (xyz) = 6 floats per vertex
      const positions = new Float32Array(vertices.length / 2);
      const normals = new Float32Array(vertices.length / 2);
      for (let i = 0; i < vertices.length / 6; i++) {
        positions[i * 3] = vertices[i * 6];
        positions[i * 3 + 1] = vertices[i * 6 + 1];
        positions[i * 3 + 2] = vertices[i * 6 + 2];
        normals[i * 3] = vertices[i * 6 + 3];
        normals[i * 3 + 1] = vertices[i * 6 + 4];
        normals[i * 3 + 2] = vertices[i * 6 + 5];
      }

      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("normal", new BufferAttribute(normals, 3));
      geometry.setIndex(new BufferAttribute(indices, 1));

      const c = placedGeom.color;
      const material = new MeshStandardMaterial({
        color: new Color(c.x, c.y, c.z),
        opacity: c.w,
        transparent: c.w < 1,
        side: DoubleSide,
        roughness: 0.6,
        metalness: 0.0,
      });

      const mesh = new Mesh(geometry, material);
      const matrix = placedGeom.flatTransformation;
      mesh.matrix.fromArray(matrix);
      mesh.matrixAutoUpdate = false;

      meshGroup.add(mesh);
      geomData.delete();
    }

    group.add(meshGroup);
  });

  api.CloseModel(modelId);
  return group;
}
