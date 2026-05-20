/**
 * useAlignmentRenderer — renders the active alignment's IP points and
 * element geometry in the shared Three.js scene.
 *
 * IP points are rendered as small spheres:
 *   - Red   (#ef4444) for unselected points
 *   - Yellow (#fbbf24) for the selected point
 *
 * Alignment elements (tangents and circular curves) are rendered as
 * thin line segments lying in the XZ plane (y = 0).
 *
 * Click selection: a pointerup listener on the renderer DOM element uses
 * THREE.Raycaster to hit-test the IP point spheres, then calls
 * alignmentStore.setSelectedIpId() to sync the 2D panel and 3D view.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAlignmentStore } from "@/state/alignmentStore";
import {
  getActiveCamera,
  getActiveScene,
  getOrbitControls,
  getRendererDomElement,
} from "@/lib/threeContext";

const IP_SPHERE_RADIUS = 0.5;
const IP_COLOR_DEFAULT = 0xef4444; // red
const IP_COLOR_SELECTED = 0xfbbf24; // yellow
const ELEMENT_COLOR = 0x3b82f6; // blue
const GROUP_NAME = "__alignment_renderer__";

function buildIpMaterial(selected: boolean): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: selected ? IP_COLOR_SELECTED : IP_COLOR_DEFAULT,
    roughness: 0.6,
    metalness: 0.1,
  });
}

function buildLineMaterial(): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color: ELEMENT_COLOR, linewidth: 2 });
}

export function useAlignmentRenderer() {
  const alignments = useAlignmentStore((s) => s.alignments);
  const activeId = useAlignmentStore((s) => s.activeId);
  const selectedIpId = useAlignmentStore((s) => s.selectedIpId);
  const setSelectedIpId = useAlignmentStore((s) => s.setSelectedIpId);
  const groupRef = useRef<THREE.Group | null>(null);

  // Main rendering effect: rebuild geometry when alignment data changes
  useEffect(() => {
    const scene = getActiveScene();
    if (!scene) return;

    // Remove previous group if it exists
    const prev = scene.getObjectByName(GROUP_NAME);
    if (prev) {
      prev.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
        if (obj instanceof THREE.Line) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      scene.remove(prev);
    }

    const activeAlignment = alignments.find((a) => a.id === activeId);
    if (!activeAlignment) {
      groupRef.current = null;
      return;
    }

    const group = new THREE.Group();
    group.name = GROUP_NAME;

    // Render IP point spheres in the XZ plane (y=0)
    const geo = new THREE.SphereGeometry(IP_SPHERE_RADIUS, 12, 8);
    activeAlignment.ipPoints.forEach((ip) => {
      const mesh = new THREE.Mesh(geo, buildIpMaterial(ip.id === selectedIpId));
      mesh.position.set(ip.x, 0, ip.z);
      mesh.userData = { ipId: ip.id, alignmentId: activeAlignment.id };
      mesh.name = `ip-${ip.id}`;
      group.add(mesh);
    });

    // Render alignment elements as line segments
    activeAlignment.elements.forEach((el, i) => {
      const points = [
        new THREE.Vector3(el.startX, 0, el.startZ),
        new THREE.Vector3(el.endX, 0, el.endZ),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, buildLineMaterial());
      line.name = `element-${i}`;
      group.add(line);
    });

    scene.add(group);
    groupRef.current = group;

    // Focus camera on the alignment when active alignment changes
    const orbitControls = getOrbitControls();
    if (orbitControls && activeAlignment.ipPoints.length > 0) {
      const avgX =
        activeAlignment.ipPoints.reduce((s, p) => s + p.x, 0) /
        activeAlignment.ipPoints.length;
      const avgZ =
        activeAlignment.ipPoints.reduce((s, p) => s + p.z, 0) /
        activeAlignment.ipPoints.length;
      orbitControls.target.set(avgX, 0, avgZ);
      orbitControls.update();
    }
  }, [alignments, activeId, selectedIpId]);

  // Click selection via raycasting
  useEffect(() => {
    const domElMaybe = getRendererDomElement();
    if (!domElMaybe) return;
    const domEl = domElMaybe; // narrow to HTMLElement for closure

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function onPointerUp(e: PointerEvent) {
      const scene = getActiveScene();
      const camera = getActiveCamera();
      const group = groupRef.current;
      if (!scene || !camera || !group) return;

      const rect = domEl.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const ipMeshes = group.children.filter(
        (c) => c instanceof THREE.Mesh && c.userData.ipId,
      );
      const hits = raycaster.intersectObjects(ipMeshes, false);

      if (hits.length > 0) {
        const ipId = hits[0].object.userData.ipId as string;
        setSelectedIpId(ipId === selectedIpId ? null : ipId);
      }
    }

    domEl.addEventListener("pointerup", onPointerUp);
    return () => {
      domEl.removeEventListener("pointerup", onPointerUp);
    };
  }, [selectedIpId, setSelectedIpId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const scene = getActiveScene();
      if (!scene) return;
      const group = scene.getObjectByName(GROUP_NAME);
      if (group) {
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
          if (obj instanceof THREE.Line) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });
        scene.remove(group);
      }
    };
  }, []);
}
