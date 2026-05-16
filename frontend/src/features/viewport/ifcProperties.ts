import { getIfcPropertySets } from "./ifcLoader";
import type { IFCPropertySet, IFCProperty } from "@/state/ifcStore";

export async function fetchPropertiesForElement(
  modelId: number,
  expressId: number,
): Promise<IFCPropertySet[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSets = (await getIfcPropertySets(modelId, expressId)) as any[];
  return rawSets.map((set) => ({
    name: set?.Name?.value ?? set?.name ?? "PropertySet",
    properties: extractProperties(set),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractProperties(set: any): IFCProperty[] {
  const props: IFCProperty[] = [];
  const candidates = set?.HasProperties ?? set?.Quantities ?? [];
  for (const p of candidates) {
    const name = p?.Name?.value ?? p?.name ?? "";
    const raw =
      p?.NominalValue ??
      p?.LengthValue ??
      p?.AreaValue ??
      p?.VolumeValue ??
      p?.Value;
    const value = raw?.value ?? raw ?? null;
    if (name) props.push({ name, value: value === undefined ? null : value });
  }
  return props;
}
