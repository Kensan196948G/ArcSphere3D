/**
 * STEP / IGES loader using OpenCascade.js (WASM).
 *
 * OpenCascade.js is served as an IIFE from /opencascade/ to avoid bundling
 * its large WASM binary through rollup (same pattern as web-ifc).
 *
 * Setup (when ready to enable):
 *   1. Download opencascade.js from https://github.com/donalffons/opencascade.js/releases
 *   2. Place opencascade.wasm + opencascade.js in public/opencascade/
 *   3. Add the script tag to index.html:
 *      <script src="/opencascade/opencascade.js"></script>
 */

import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";

// opencascade.js global — loaded as IIFE before the app bundle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const initOpenCascade: (() => Promise<any>) | undefined;

const DEFAULT_MATERIAL = new MeshStandardMaterial({
  color: 0x94a3b8,
  roughness: 0.4,
  metalness: 0.1,
  side: 2, // DoubleSide
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _oc: any | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOc(): Promise<any> {
  if (_oc) return _oc;
  if (typeof initOpenCascade === "undefined") {
    throw new Error(
      "OpenCascade.js not loaded — place opencascade.js + opencascade.wasm in public/opencascade/ " +
        "and add <script src=\"/opencascade/opencascade.js\"></script> to index.html",
    );
  }
  _oc = await initOpenCascade();
  return _oc;
}

export interface OccResult {
  group: Group;
}

/** Load a STEP or IGES file from an ArrayBuffer and return a Three.js Group. */
export async function loadStep(
  buffer: ArrayBuffer,
  filename: string,
): Promise<OccResult> {
  const oc = await getOc();
  const ext = filename.toLowerCase().endsWith(".iges") ? "file.iges" : "file.step";

  // Write the file into the in-memory FS that OCC.js exposes
  oc.FS.createDataFile("/", ext, new Uint8Array(buffer), true, true, true);

  const reader = new oc.STEPControl_Reader_1();
  const readStatus = reader.ReadFile(`/${ext}`);
  if (readStatus !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
    throw new Error(`OpenCascade failed to read ${filename} (status ${readStatus})`);
  }
  reader.TransferRoots(new oc.Message_ProgressRange_1());
  const shape = reader.OneShape();

  const group = new Group();
  group.name = filename;
  _shapeToGroup(oc, shape, group);

  oc.FS.unlink(`/${ext}`);
  return { group };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _shapeToGroup(oc: any, shape: any, group: Group): void {
  const mesher = new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, false);
  mesher.Perform(new oc.Message_ProgressRange_1());

  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  for (; explorer.More(); explorer.Next()) {
    const face = oc.TopoDS.Face_1(explorer.Current());
    const location = new oc.TopLoc_Location_1();
    const triangulation = oc.BRep_Tool.Triangulation(face, location, 0);
    if (triangulation.IsNull()) continue;

    const tri = triangulation.get();
    const nNodes = tri.NbNodes();
    const nTri = tri.NbTriangles();

    for (let i = 1; i <= nNodes; i++) {
      const pt = tri.Node(i);
      positions.push(pt.X(), pt.Y(), pt.Z());
      normals.push(0, 0, 1); // placeholder — normals computed from geometry
    }
    for (let i = 1; i <= nTri; i++) {
      const t = tri.Triangle(i);
      const [n1, n2, n3] = [t.Value(1) - 1, t.Value(2) - 1, t.Value(3) - 1];
      indices.push(indexOffset + n1, indexOffset + n2, indexOffset + n3);
    }
    indexOffset += nNodes;
  }

  if (positions.length === 0) return;

  const geom = new BufferGeometry();
  geom.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geom.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mesh = new Mesh(geom, DEFAULT_MATERIAL.clone());
  group.add(mesh);
}
