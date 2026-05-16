import { useEffect } from "react";
import { useVerticalStore, Vip, VerticalElement } from "@/state/verticalStore";

/**
 * Compute vertical alignment elements from a sorted set of VIPs.
 *
 * Each VIP has a station, elevation, and optional vertical curve length.
 * Between consecutive VIPs we insert:
 *   1. grade segment (before VPC)
 *   2. vertical curve (VPC → VPT) if vcLength > 0
 *   3. grade segment (VPT → next VIP or end)
 *
 * VPC station = VIP.station - L/2
 * VPT station = VIP.station + L/2
 * VPC elevation = VIP.elevation - g1 * (L/2)      (g1 in fraction, not %)
 * VPT elevation = VIP.elevation + g2 * (L/2)
 * K = L / |g2 - g1|  (in absolute grade fractions)
 */
export function computeVerticalElements(vips: Vip[]): VerticalElement[] {
  const sorted = [...vips].sort((a, b) => a.station - b.station);
  if (sorted.length < 2) return [];

  const elements: VerticalElement[] = [];

  // Compute grade between each consecutive pair (fraction per metre → %)
  const n = sorted.length;
  const grades: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const ds = sorted[i + 1].station - sorted[i].station;
    const dz = sorted[i + 1].elevation - sorted[i].elevation;
    grades.push(ds > 0 ? (dz / ds) * 100 : 0); // grade in %
  }

  // Track current "cursor" as we emit elements
  let curStation = sorted[0].station;
  let curElevation = sorted[0].elevation;

  for (let i = 0; i < n - 1; i++) {
    const vip = sorted[i + 1]; // this VIP ends the current segment
    const g1 = grades[i] / 100; // fraction/m
    const g2 = i + 1 < n - 1 ? grades[i + 1] / 100 : g1; // last grade repeats

    const L = vip.vcLength;
    const halfL = L / 2;

    if (L <= 0) {
      // Pure grade — straight from cursor to VIP
      elements.push({
        type: "grade",
        startStation: curStation,
        endStation: vip.station,
        startElevation: curElevation,
        endElevation: vip.elevation,
        grade: grades[i],
      });
      curStation = vip.station;
      curElevation = vip.elevation;
    } else {
      // VPC and VPT around this VIP
      const vpcSta = vip.station - halfL;
      const vpcElev = vip.elevation - g1 * halfL;
      const vptSta = vip.station + halfL;
      const vptElev = vip.elevation + g2 * halfL;

      // Grade from cursor to VPC
      if (vpcSta > curStation + 0.001) {
        elements.push({
          type: "grade",
          startStation: curStation,
          endStation: vpcSta,
          startElevation: curElevation,
          endElevation: vpcElev,
          grade: grades[i],
        });
      }

      // Vertical curve VPC → VPT
      const deltaG = Math.abs(g2 - g1) * 100; // %
      const kValue = deltaG > 0.001 ? L / deltaG : Infinity;
      elements.push({
        type: "vcurve",
        startStation: vpcSta,
        endStation: vptSta,
        startElevation: vpcElev,
        endElevation: vptElev,
        length: L,
        kValue: isFinite(kValue) ? kValue : undefined,
        vpcStation: vpcSta,
        vptStation: vptSta,
        vpcElevation: vpcElev,
        vptElevation: vptElev,
      });

      curStation = vptSta;
      curElevation = vptElev;
    }
  }

  // Final grade to last VIP if cursor hasn't reached it
  const last = sorted[n - 1];
  if (curStation < last.station - 0.001) {
    elements.push({
      type: "grade",
      startStation: curStation,
      endStation: last.station,
      startElevation: curElevation,
      endElevation: last.elevation,
      grade: grades[n - 2],
    });
  }

  return elements;
}

/** Hook that recomputes vertical elements whenever VIPs change. */
export function useVertical(verticalId: string | null) {
  const store = useVerticalStore();
  const vertical = store.verticals.find((v) => v.id === verticalId) ?? null;

  useEffect(() => {
    if (!verticalId || !vertical) return;
    const els = computeVerticalElements(vertical.vips);
    store.setElements(verticalId, els);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verticalId, vertical?.vips]);

  return vertical;
}
