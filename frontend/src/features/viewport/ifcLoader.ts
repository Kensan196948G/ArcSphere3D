/**
 * IFC loader using web-ifc's IfcAPI.
 * Loads geometry from an IFC file and returns a Three.js Group.
 *
 * web-ifc needs its WASM binary. We ship it from the public folder.
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
import { IfcAPI } from "web-ifc";

let _api: IfcAPI | null = null;

async function getApi(): Promise<IfcAPI> {
  if (_api) return _api;
  _api = new IfcAPI();
  // Tell web-ifc where to find the wasm binary.
  // Vite copies files in public/ to dist/ as-is, so we place it there via vite.config.
  _api.SetWasmPath("/web-ifc/");
  await _api.Init();
  return _api;
}

/** Load an IFC file from an ArrayBuffer and return a Three.js Group. */
export async function loadIfc(buffer: ArrayBuffer, filename: string): Promise<Group> {
  const api = await getApi();
  const data = new Uint8Array(buffer);
  const modelId = api.OpenModel(data);

  const group = new Group();
  group.name = filename;

  // Iterate over all mesh data provided by web-ifc
  api.StreamAllMeshes(modelId, (flatMesh) => {
    const meshGroup = new Group();

    for (let g = 0; g < flatMesh.geometries.size(); g++) {
      const placedGeom = flatMesh.geometries.get(g);
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

      // Apply the transform matrix from web-ifc
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
