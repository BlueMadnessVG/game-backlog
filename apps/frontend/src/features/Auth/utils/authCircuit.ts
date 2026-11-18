import type { PlatformKey } from '@/common/utils/platformColors';

/**
 * Geometry for the Auth page's circuit board, in page pixels.
 *
 * The page is a PCB: a chamfered board edge inset from the page, a mounting
 * hole in each corner. The auth panel is chip U1: a socket outline sits around
 * it, pins stick out of its left, right and bottom edges, and dim traces fan
 * out from them to the board edge. The assistant cube is chip U2, with a
 * smaller socket; a three-line bus links the two (horizontal when the cube is
 * beside the panel, vertical when it sits below it). A header J1 on the top
 * edge carries one pin per platform, and its traces feed U2 from above:
 * "your platforms plug into the assistant".
 *
 * Everything is deterministic: same rects in, same board out.
 *
 * Exports:
 *  - Rect, AuthCircuitInput, AuthCircuit, BoardLabel, PlatformTrace
 *  - MIN_TRACE_ROOM, J1_PLATFORMS
 *  - buildAuthCircuit
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AuthCircuitInput {
  /** Page size; the board is drawn in a 0..w × 0..h box. */
  page: { w: number; h: number };
  /** The auth panel, relative to the page. */
  panel: Rect;
  /** The box the cube docks in, relative to the page (null when hidden). */
  cube: Rect | null;
}

export interface BoardLabel {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
}

export interface PlatformTrace {
  d: string;
  platform: PlatformKey;
}

export interface AuthCircuit {
  /** The PCB outline. */
  edge: string;
  /** Mounting hole centres, one per corner. */
  holes: [number, number][];
  /** Socket outlines and pin stubs (panel + cube). */
  sockets: string[];
  /** Dim decorative traces. */
  traces: string[];
  /** The three bus lines from the panel to the cube (empty without a cube). */
  bus: string[];
  /** The platform header on the top edge (null when there is no room for it). */
  j1: { housing: string; pins: { x: number; y: number; platform: PlatformKey }[] } | null;
  /** J1 → cube socket, one per platform (empty when J1 can't reach the cube). */
  platformTraces: PlatformTrace[];
  /** Silkscreen reference designators. */
  labels: BoardLabel[];
  /** Node dots (trace bends and vias). */
  nodes: [number, number][];
}

/** J1's pins, left to right. */
export const J1_PLATFORMS: PlatformKey[] = ['steam', 'xbox', 'playstation', 'unified'];

/** Board edge inset from the page (shrinks on tight pages so the panel socket fits inside). */
const EDGE_INSET = 12;
const EDGE_CHAMFER = 16;
/** Gap between the panel and its socket outline (shrinks when the page is tight). */
const SOCKET_PAD = 20;
const CHAMFER = 12;
const PIN = 8;
const PIN_STEP = 48;
/** A side needs this much room beyond its pins before it gets traces. */
export const MIN_TRACE_ROOM = 48;
const BUS_GAP = 12;
const JOG = 12;
/** J1 header: pin pitch, housing height, and the room it needs to route down to the cube. */
const J1_PITCH = 22;
const J1_HEIGHT = 20;
const J1_MIN_ROUTE = 96;

const r = (n: number) => Math.round(n * 10) / 10;

/** The value inside [lo, hi] nearest `v`. */
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Evenly spaced pin positions along [start, end], inset from both ends. */
function pinsAlong(start: number, end: number, insetStart: number, insetEnd: number): number[] {
  const out: number[] = [];
  for (let p = start + insetStart; p <= end - insetEnd; p += PIN_STEP) out.push(r(p));
  return out;
}

/** Rectangle with the bottom-left corner chamfered (the socket shape). */
function socketOutline(s: Rect, chamfer: number): string {
  const right = s.x + s.w;
  const bottom = s.y + s.h;
  return `M ${r(s.x)} ${r(s.y)} H ${r(right)} V ${r(bottom)} H ${r(s.x + chamfer)} L ${r(s.x)} ${r(bottom - chamfer)} Z`;
}

/** Rectangle with all four corners chamfered (the board edge). */
function boardOutline(b: Rect, k: number): string {
  const right = b.x + b.w;
  const bottom = b.y + b.h;
  return [
    `M ${r(b.x + k)} ${r(b.y)}`,
    `H ${r(right - k)} L ${r(right)} ${r(b.y + k)}`,
    `V ${r(bottom - k)} L ${r(right - k)} ${r(bottom)}`,
    `H ${r(b.x + k)} L ${r(b.x)} ${r(bottom - k)}`,
    `V ${r(b.y + k)} Z`,
  ].join(' ');
}

/**
 * A trace leaving a pin: straight out for `lead`, one 45° jog of `dy` across
 * the travel axis, then on to `end`. `dir` is +1/-1 along the travel axis.
 */
function horizontalTrace(x0: number, y: number, dir: 1 | -1, lead: number, dy: number, end: number) {
  const bendX = x0 + dir * lead;
  const afterJogX = bendX + dir * Math.abs(dy);
  // Not enough room for the jog: run straight.
  if ((end - afterJogX) * dir < 8) {
    return { d: `M ${r(x0)} ${r(y)} H ${r(end)}`, bend: null as [number, number] | null, endY: y };
  }
  return {
    d: `M ${r(x0)} ${r(y)} H ${r(bendX)} L ${r(afterJogX)} ${r(y + dy)} H ${r(end)}`,
    bend: [r(bendX), r(y)] as [number, number],
    endY: y + dy,
  };
}

function verticalTrace(x: number, y0: number, lead: number, dx: number, end: number) {
  const bendY = y0 + lead;
  const afterJogY = bendY + Math.abs(dx);
  if (end - afterJogY < 8) {
    return { d: `M ${r(x)} ${r(y0)} V ${r(end)}`, bend: null as [number, number] | null, endX: x };
  }
  return {
    d: `M ${r(x)} ${r(y0)} V ${r(bendY)} L ${r(x + dx)} ${r(afterJogY)} V ${r(end)}`,
    bend: [r(x), r(bendY)] as [number, number],
    endX: x + dx,
  };
}

/** Mutable output the routing stages below write into. */
type Out = Pick<AuthCircuit, 'sockets' | 'traces' | 'bus' | 'nodes' | 'labels' | 'platformTraces'>;

/** Shared geometry every stage reads. */
interface Ctx {
  /** Board edge. */
  b: Rect;
  edgeChamfer: number;
  /** Panel socket (U1). */
  s: Rect;
  /** Cube socket (U2), if any. */
  c: Rect | null;
  busHorizontal: boolean;
  busVertical: boolean;
}

const rightOf = (rect: Rect) => rect.x + rect.w;
const bottomOf = (rect: Rect) => rect.y + rect.h;

/** Board edge (inset from the page) and one mounting hole per corner. */
function boardFrame(page: { w: number; h: number }, panel: Rect) {
  const inset = clamp(panel.x / 2.5, 4, EDGE_INSET);
  const b: Rect = { x: inset, y: inset, w: page.w - inset * 2, h: page.h - inset * 2 };
  const edgeChamfer = inset < EDGE_INSET ? EDGE_CHAMFER * 0.6 : EDGE_CHAMFER;
  const holeIn = inset + 10;
  const holes: [number, number][] = [
    [r(holeIn), r(holeIn)],
    [r(page.w - holeIn), r(holeIn)],
    [r(holeIn), r(page.h - holeIn)],
    [r(page.w - holeIn), r(page.h - holeIn)],
  ];
  return { b, edgeChamfer, edge: boardOutline(b, edgeChamfer), holes };
}

/** The panel's socket outline, padded but kept inside the board edge. */
function panelSocket(panel: Rect, b: Rect): Rect {
  const pad = Math.max(
    4,
    Math.min(SOCKET_PAD, panel.x - b.x - 4, rightOf(b) - rightOf(panel) - 4, panel.y - b.y - 4),
  );
  return { x: panel.x - pad, y: panel.y - pad, w: panel.w + pad * 2, h: panel.h + pad * 2 };
}

/**
 * The cube's socket: a square centred on its dock box. The assistant rig draws
 * the cube at the box's height (whatever its width), so the socket follows the
 * height too, shrunk only if it would cross the board edge.
 */
function cubeSocket(cube: Rect | null, b: Rect): Rect | null {
  if (!cube || cube.w <= 0 || cube.h <= 0) return null;
  const cx = cube.x + cube.w / 2;
  const cy = cube.y + cube.h / 2;
  const maxHalf = Math.min(cx - b.x, rightOf(b) - cx, cy - b.y, bottomOf(b) - cy) - PIN;
  const side = Math.max(0, Math.min(cube.h, maxHalf * 2));
  if (side === 0) return null;
  return { x: cx - side / 2, y: cy - side / 2, w: side, h: side };
}

/** J1 on the top edge; when it sits above the cube, one trace per platform down into U2. */
function routeJ1({ b, edgeChamfer, c, busHorizontal }: Ctx, out: Out): AuthCircuit['j1'] {
  const housingW = J1_PLATFORMS.length * J1_PITCH + 8;
  const top = b.y;
  const bottom = top + J1_HEIGHT;
  // Beside the panel: centred above the cube. Below it (phone): tucked into the top-right corner.
  const cx = c && busHorizontal ? c.x + c.w / 2 : rightOf(b) - edgeChamfer - 16 - housingW / 2;
  const hx = cx - housingW / 2;
  if (hx <= b.x + edgeChamfer) return null;

  const pins = J1_PLATFORMS.map((platform, i) => ({
    x: r(cx + (i - (J1_PLATFORMS.length - 1) / 2) * J1_PITCH),
    y: r(top + J1_HEIGHT / 2),
    platform,
  }));
  out.labels.push({ text: 'J1', x: r(hx - 6), y: r(bottom - 3), anchor: 'end' });

  if (c && busHorizontal && c.y - bottom >= J1_MIN_ROUTE) {
    pins.forEach(({ x, platform }, i) => {
      const tx = c.x + c.w * (0.2 + 0.2 * i);
      out.platformTraces.push({ d: verticalTrace(x, bottom, 24, tx - x, c.y).d, platform });
    });
  }
  return {
    housing: `M ${r(hx)} ${r(top)} H ${r(hx + housingW)} V ${r(bottom)} H ${r(hx)} Z`,
    pins,
  };
}

/** The three-line bus U1 → U2. Returns the panel pins it uses, so side traces skip them. */
function routeBus({ s, c, busHorizontal, busVertical }: Ctx, sidePins: number[], out: Out) {
  const busPins = new Set<number>();
  const busXs: number[] = [];
  if (!c) return { busPins, busXs };

  if (busHorizontal && sidePins.length) {
    // The three right pins nearest the cube's centre → the cube's left edge.
    const cy = c.y + c.h / 2;
    let k = 0;
    sidePins.forEach((p, i) => {
      if (Math.abs(p - cy) < Math.abs(sidePins[k] - cy)) k = i;
    });
    const start = clamp(k - 1, 0, Math.max(0, sidePins.length - 3));
    const chosen = sidePins.slice(start, start + 3);
    const x1 = rightOf(s) + PIN + 24;
    chosen.forEach((py, i) => {
      busPins.add(py);
      const t = cy + (i - (chosen.length - 1) / 2) * BUS_GAP;
      out.bus.push(
        `M ${r(rightOf(s))} ${r(py)} H ${r(x1)} L ${r(x1 + Math.abs(t - py))} ${r(t)} H ${r(c.x)}`,
      );
    });
  } else if (busVertical) {
    // Straight down from the panel socket to the cube's top edge.
    const cx = c.x + c.w / 2;
    for (let i = -1; i <= 1; i++) {
      const x = clamp(cx + i * BUS_GAP, s.x + CHAMFER + 4, rightOf(s) - 4);
      busXs.push(x);
      out.bus.push(`M ${r(x)} ${r(bottomOf(s))} V ${r(c.y)}`);
    }
  }
  return { busPins, busXs };
}

/** Left pins, each with a trace to the board's left edge (every third stops early at a via). */
function routeLeft({ b, s }: Ctx, pins: number[], out: Out) {
  const room = s.x - PIN - b.x;
  pins.forEach((y, i) => {
    out.sockets.push(`M ${r(s.x)} ${r(y)} H ${r(s.x - PIN)}`);
    if (room < MIN_TRACE_ROOM) return;
    const lead = 16 + (i % 3) * 14;
    const dy = (i % 2 === 0 ? -1 : 1) * JOG * (1 + (i % 2));
    const early = i % 3 === 2;
    const end = early ? Math.max(b.x + 4, s.x - PIN - lead - Math.abs(dy) - 28) : b.x;
    const t = horizontalTrace(s.x - PIN, y, -1, lead, dy, end);
    out.traces.push(t.d);
    if (t.bend) out.nodes.push(t.bend);
    if (early) out.nodes.push([r(end), r(t.endY)]);
  });
}

/** Where a right-side trace ends: the board edge, a via short of U2, or an early via. */
function rightTraceEnd(
  { b, s, c, busHorizontal }: Ctx,
  y: number,
  i: number,
  lead: number,
  dy: number,
) {
  const blocked = !!c && busHorizontal && y + dy > c.y - 16 && y + dy < bottomOf(c) + 16;
  if (!blocked && i % 3 !== 2) return { end: rightOf(b), early: false };
  const stop =
    blocked && c ? c.x - 24 - (i % 3) * 16 : rightOf(s) + PIN + lead + Math.abs(dy) + 28;
  return { end: Math.min(rightOf(b) - 4, stop), early: true };
}

/** Right pins (minus the bus), with traces to the board's right edge, stopping short of U2. */
function routeRight(ctx: Ctx, pins: number[], busPins: Set<number>, out: Out) {
  const sRight = rightOf(ctx.s);
  const room = rightOf(ctx.b) - (sRight + PIN);
  const busMid = busPins.size ? [...busPins].reduce((a, v) => a + v, 0) / busPins.size : null;
  pins.forEach((y, i) => {
    if (busPins.has(y)) return;
    out.sockets.push(`M ${r(sRight)} ${r(y)} H ${r(sRight + PIN)}`);
    if (room < MIN_TRACE_ROOM) return;
    // Away from the bus: pins above it jog up, pins below jog down.
    const away = busMid !== null && y < busMid ? -1 : 1;
    const lead = 16 + (i % 3) * 14;
    const dy = away * JOG * (1 + (i % 2));
    const { end, early } = rightTraceEnd(ctx, y, i, lead, dy);
    if (end <= sRight + PIN + 8) return;
    const t = horizontalTrace(sRight + PIN, y, 1, lead, dy, end);
    out.traces.push(t.d);
    if (t.bend) out.nodes.push(t.bend);
    if (early) out.nodes.push([r(end), r(t.endY)]);
  });
}

/** A few pins on the panel socket's bottom edge, with traces down to the board's bottom edge. */
function routeBottom({ b, s, c, busVertical }: Ctx, busXs: number[], out: Out) {
  const sBottom = bottomOf(s);
  const room = bottomOf(b) - (sBottom + PIN);
  [0.3, 0.55, 0.8].forEach((f, i) => {
    const x = r(s.x + s.w * f);
    if (busXs.some((bx) => Math.abs(bx - x) < 24)) return;
    if (c && busVertical && x > c.x - 16 && x < rightOf(c) + 16) return;
    out.sockets.push(`M ${x} ${r(sBottom)} V ${r(sBottom + PIN)}`);
    if (room < MIN_TRACE_ROOM) return;
    const dx = (i % 2 === 0 ? -1 : 1) * JOG * (1 + (i % 2));
    const early = i === 1;
    const end = early ? Math.min(bottomOf(b) - 4, sBottom + PIN + 72) : bottomOf(b);
    const t = verticalTrace(x, sBottom + PIN, 20 + i * 10, dx, end);
    out.traces.push(t.d);
    if (t.bend) out.nodes.push(t.bend);
    if (early) out.nodes.push([r(t.endX), r(end)]);
  });
}

/** One of U2's pin positions: right-side pin + trace, top stub, bottom stub + trace, left stub. */
function routeCubePin(
  { b, c, busHorizontal, busVertical }: Ctx & { c: Rect },
  f: number,
  i: number,
  topFedByJ1: boolean,
  out: Out,
) {
  const side = c.w;
  const pin = Math.min(PIN, side / 8);
  const o = f * side;
  const y = c.y + o;
  const x = c.x + o;

  out.sockets.push(`M ${r(rightOf(c))} ${r(y)} H ${r(rightOf(c) + pin)}`);
  if (rightOf(b) - (rightOf(c) + pin) >= MIN_TRACE_ROOM) {
    const t = horizontalTrace(rightOf(c) + pin, y, 1, 12 + i * 10, (i - 1) * JOG, rightOf(b));
    out.traces.push(t.d);
    if (t.bend) out.nodes.push(t.bend);
  }
  // Top: J1's traces land here when present; otherwise plain stubs.
  if (!topFedByJ1 && !(busVertical && i === 1)) {
    out.sockets.push(`M ${r(x)} ${r(c.y)} V ${r(c.y - pin)}`);
  }
  out.sockets.push(`M ${r(x)} ${r(bottomOf(c))} V ${r(bottomOf(c) + pin)}`);
  if (bottomOf(b) - (bottomOf(c) + pin) >= MIN_TRACE_ROOM && side >= 96) {
    const end = Math.min(bottomOf(b) - 4, bottomOf(c) + pin + 40 + i * 14);
    const t = verticalTrace(x, bottomOf(c) + pin, 10, (i - 1) * JOG, end);
    out.traces.push(t.d);
    out.nodes.push([r(t.endX), r(end)]);
  }
  // Left side: pins where the horizontal bus lands are drawn by the bus itself.
  if (!busHorizontal) out.sockets.push(`M ${r(c.x)} ${r(y)} H ${r(c.x - pin)}`);
}

export function buildAuthCircuit({ page, panel, cube }: AuthCircuitInput): AuthCircuit {
  const out: Out = { sockets: [], traces: [], bus: [], nodes: [], labels: [], platformTraces: [] };

  const { b, edgeChamfer, edge, holes } = boardFrame(page, panel);
  const s = panelSocket(panel, b);
  const c = cubeSocket(cube, b);
  const busHorizontal = !!c && c.x >= rightOf(s) + MIN_TRACE_ROOM;
  const busVertical = !!c && !busHorizontal && c.y >= bottomOf(s) + 16;
  const ctx: Ctx = { b, edgeChamfer, s, c, busHorizontal, busVertical };

  out.sockets.push(socketOutline(s, CHAMFER));
  out.labels.push({ text: 'U1', x: r(s.x), y: r(s.y - 6), anchor: 'start' });
  if (c) {
    out.sockets.push(socketOutline(c, Math.min(CHAMFER, c.w / 6)));
    out.labels.push({ text: 'U2', x: r(c.x), y: r(c.y - 6), anchor: 'start' });
  }

  const j1 = routeJ1(ctx, out);
  const sidePins = pinsAlong(s.y, bottomOf(s), 32, 24);
  const { busPins, busXs } = routeBus(ctx, sidePins, out);
  routeLeft(ctx, sidePins, out);
  routeRight(ctx, sidePins, busPins, out);
  routeBottom(ctx, busXs, out);
  if (c) {
    const topFedByJ1 = out.platformTraces.length > 0;
    [0.3, 0.5, 0.7].forEach((f, i) => routeCubePin({ ...ctx, c }, f, i, topFedByJ1, out));
  }

  return { edge, holes, j1, ...out };
}
