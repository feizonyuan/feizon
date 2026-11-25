// Level topology: named zones (rectangles), door portals between them, floor height (stairs).
// Used by the stalker's pathfinding, spawn picking, camera labels and footstep/fog moods.

export interface Zone { id: string; label: string; x0: number; x1: number; z0: number; z1: number; floor: number }
export interface Portal { a: string; b: string; pa: [number, number]; pb: [number, number]; enabled: boolean }

export const STAIR_X0 = 36, STAIR_X1 = 44, BASEMENT_Y = -3.6;

export const ZONES: Zone[] = [
  { id: 'A', label: 'CORRIDOR A', x0: -2.2, x1: 2.2, z0: -36, z1: 0.4, floor: 0 },
  { id: 'R1', label: 'ROOM 1', x0: 2.4, x1: 8.2, z0: -11, z1: -5, floor: 0 },
  { id: 'R2', label: 'PUMP ROOM 07', x0: 2.4, x1: 8.2, z0: -28, z1: -22, floor: 0 },
  { id: 'J', label: 'JUNCTION', x0: -2.2, x1: 2.4, z0: -44.3, z1: -36, floor: 0 },
  { id: 'B', label: 'CORRIDOR B', x0: 2.4, x1: STAIR_X0, z0: -42.5, z1: -38.5, floor: 0 },
  { id: 'LOCK', label: 'LOCKER ROOM', x0: 8, x1: 16, z0: -50.5, z1: -42.7, floor: 0 },
  { id: 'SEC', label: 'SECURITY', x0: 14, x1: 20, z0: -38.3, z1: -32, floor: 0 },
  { id: 'STOR', label: 'STORAGE', x0: 24, x1: 31, z0: -38.3, z1: -32, floor: 0 },
  { id: 'STAIR', label: 'STAIRWELL', x0: STAIR_X0, x1: STAIR_X1, z0: -42.5, z1: -38.5, floor: 0 },
  { id: 'BOIL', label: 'BOILER ROOM B2', x0: STAIR_X1, x1: 56, z0: -48, z1: -33, floor: BASEMENT_Y },
];

export const PORTALS: Portal[] = [
  { a: 'A', b: 'R1', pa: [1.4, -7.2], pb: [3.4, -7.2], enabled: true },
  { a: 'A', b: 'R2', pa: [1.4, -24], pb: [3.4, -24], enabled: true },
  { a: 'A', b: 'J', pa: [0, -35], pb: [0, -37.2], enabled: true },
  { a: 'J', b: 'B', pa: [1.2, -40.5], pb: [3.4, -40.5], enabled: true },
  { a: 'B', b: 'LOCK', pa: [11, -41.5], pb: [11, -43.8], enabled: true },
  { a: 'B', b: 'SEC', pa: [17, -39.5], pb: [17, -37.2], enabled: false },
  { a: 'B', b: 'STOR', pa: [27.5, -39.5], pb: [27.5, -37.2], enabled: true },
  { a: 'B', b: 'STAIR', pa: [35, -40.5], pb: [37, -40.5], enabled: true },
  { a: 'STAIR', b: 'BOIL', pa: [43, -40.5], pb: [45, -40.5], enabled: true },
];

export function zoneOf(x: number, z: number): Zone {
  let best = ZONES[0], bd = Infinity;
  for (const zn of ZONES) {
    const dx = Math.max(zn.x0 - x, 0, x - zn.x1), dz = Math.max(zn.z0 - z, 0, z - zn.z1);
    const d = dx * dx + dz * dz;
    if (d === 0) return zn;
    if (d < bd) { bd = d; best = zn; }
  }
  return best;
}

/** Walkable floor height. The stairwell is a straight ramp (visual steps match within a few cm). */
export function groundY(x: number, z: number) {
  if (z < -38 && z > -43) {
    if (x >= STAIR_X1) return BASEMENT_Y;
    if (x > STAIR_X0) return ((x - STAIR_X0) / (STAIR_X1 - STAIR_X0)) * BASEMENT_Y;
  }
  return x >= STAIR_X1 ? BASEMENT_Y : 0;
}

/** Breadth-first search over zones; returns the next portal to walk through (oriented from->to). */
export function nextPortal(from: string, to: string): { pa: [number, number]; pb: [number, number] } | null {
  if (from === to) return null;
  const prev = new Map<string, { zone: string; p: Portal }>();
  const q = [from];
  const seen = new Set([from]);
  while (q.length) {
    const cur = q.shift()!;
    if (cur === to) break;
    for (const p of PORTALS) {
      if (!p.enabled) continue;
      const nb = p.a === cur ? p.b : p.b === cur ? p.a : null;
      if (!nb || seen.has(nb)) continue;
      seen.add(nb); prev.set(nb, { zone: cur, p }); q.push(nb);
    }
  }
  if (!prev.has(to)) return null;
  let z = to;
  while (prev.get(z)!.zone !== from) z = prev.get(z)!.zone;
  const p = prev.get(z)!.p;
  return p.a === from ? { pa: p.pa, pb: p.pb } : { pa: p.pb, pb: p.pa };
}

/** Grid of candidate points inside every zone (for spawning / relocating the stalker). */
export function candidatePoints(step = 1.6): { x: number; z: number; zone: string }[] {
  const out: { x: number; z: number; zone: string }[] = [];
  for (const zn of ZONES) {
    if (zn.id === 'STAIR') continue;
    for (let x = zn.x0 + 0.7; x <= zn.x1 - 0.7; x += step)
      for (let z = zn.z0 + 0.7; z <= zn.z1 - 0.7; z += step) out.push({ x, z, zone: zn.id });
  }
  return out;
}

export function setPortal(zone: string, enabled: boolean) {
  for (const p of PORTALS) if (p.a === zone || p.b === zone) p.enabled = enabled;
}
