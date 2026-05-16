import { useEffect } from "react";
import { useAlignmentStore, IpPoint, AlignmentElement } from "@/state/alignmentStore";

/** Compute IP-method horizontal alignment elements for a set of IP points.
 *  Returns tangent and arc elements for each IP in sequence.
 *  Elevations are ignored (this is purely a plan-view / XZ calculation).
 */
export function computeElements(ipPoints: IpPoint[]): AlignmentElement[] {
  if (ipPoints.length < 2) return [];

  const elements: AlignmentElement[] = [];

  // For a simple open alignment: start point → IP_1 → ... → IP_{n-1} → end point
  // ipPoints[0] = start, ipPoints[n-1] = end (no radius needed at endpoints)
  const n = ipPoints.length;

  // Cumulative tangent lengths so we know where each tangent segment starts
  // Between two consecutive points we may insert a curve arc.
  type Seg = { from: IpPoint; to: IpPoint; bearing: number; dist: number };
  const segs: Seg[] = [];
  for (let i = 0; i < n - 1; i++) {
    const from = ipPoints[i];
    const to = ipPoints[i + 1];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    segs.push({ from, to, bearing: Math.atan2(dz, dx), dist: Math.hypot(dx, dz) });
  }

  // Track current position in plan
  let curX = ipPoints[0].x;
  let curZ = ipPoints[0].z;

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const ip = ipPoints[i + 1]; // intersection point at end of this seg
    const isLast = i === segs.length - 1;

    if (isLast || ip.radius <= 0) {
      // Pure tangent to next IP (or end)
      elements.push({
        type: "tangent",
        startX: curX,
        startZ: curZ,
        endX: ip.x,
        endZ: ip.z,
        length: seg.dist,
      });
      curX = ip.x;
      curZ = ip.z;
      continue;
    }

    const nextSeg = segs[i + 1];
    // Intersection angle (exterior deflection)
    let ia = nextSeg.bearing - seg.bearing;
    // Normalize to (-π, π]
    while (ia > Math.PI) ia -= 2 * Math.PI;
    while (ia <= -Math.PI) ia += 2 * Math.PI;
    const absIa = Math.abs(ia);

    const R = ip.radius;
    const TL = R * Math.tan(absIa / 2);
    const CL = R * absIa;

    // BC (begin of curve) = IP - TL along incoming tangent
    const bcX = ip.x - TL * Math.cos(seg.bearing);
    const bcZ = ip.z - TL * Math.sin(seg.bearing);

    // Tangent from curPos to BC
    const tangDist = Math.hypot(bcX - curX, bcZ - curZ);
    if (tangDist > 0.001) {
      elements.push({
        type: "tangent",
        startX: curX,
        startZ: curZ,
        endX: bcX,
        endZ: bcZ,
        length: tangDist,
      });
    }

    // EC (end of curve) = IP + TL along outgoing tangent
    const ecX = ip.x + TL * Math.cos(nextSeg.bearing);
    const ecZ = ip.z + TL * Math.sin(nextSeg.bearing);

    // Center of circle: perpendicular to incoming tangent at BC
    const sign = ia > 0 ? 1 : -1;
    const perpBearing = seg.bearing + sign * (Math.PI / 2);
    const cX = bcX + R * Math.cos(perpBearing);
    const cZ = bcZ + R * Math.sin(perpBearing);

    elements.push({
      type: "curve",
      startX: bcX,
      startZ: bcZ,
      endX: ecX,
      endZ: ecZ,
      length: CL,
      radius: R,
      centerX: cX,
      centerZ: cZ,
    });

    curX = ecX;
    curZ = ecZ;
  }

  return elements;
}

/** Hook that recomputes alignment elements whenever IP points change. */
export function useAlignment(alignmentId: string | null) {
  const store = useAlignmentStore();
  const alignment = store.alignments.find((a) => a.id === alignmentId) ?? null;

  useEffect(() => {
    if (!alignmentId || !alignment) return;
    const els = computeElements(alignment.ipPoints);
    store.setElements(alignmentId, els);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alignmentId, alignment?.ipPoints]);

  return alignment;
}
