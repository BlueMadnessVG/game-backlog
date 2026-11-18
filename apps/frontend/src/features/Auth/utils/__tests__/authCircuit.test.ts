import { describe, expect, it } from 'vitest';

import { buildAuthCircuit, CUBE_SOCKET_SCALE, type AuthCircuitInput } from '../authCircuit';

/** U2 for a dock box: a square of height × CUBE_SOCKET_SCALE, centred on the box. */
const socketOf = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => {
  const side = h * CUBE_SOCKET_SCALE;
  return { left: x + w / 2 - side / 2, top: y + h / 2 - side / 2 };
};

/** Every x/y point a path visits (paths use only M/H/V/L with absolute coordinates). */
function points(d: string): [number, number][] {
  const out: [number, number][] = [];
  const tokens = d.trim().split(/\s+/);
  let x = 0;
  let y = 0;
  for (let i = 0; i < tokens.length; i++) {
    const cmd = tokens[i];
    if (cmd === 'M' || cmd === 'L') {
      x = Number(tokens[++i]);
      y = Number(tokens[++i]);
    } else if (cmd === 'H') {
      x = Number(tokens[++i]);
    } else if (cmd === 'V') {
      y = Number(tokens[++i]);
    } else {
      continue;
    }
    out.push([x, y]);
  }
  return out;
}

/** 1440×900 desktop, measured from the real /auth page (relative to the page). */
const DESKTOP: AuthCircuitInput = {
  page: { w: 1376, h: 900 },
  panel: { x: 143, y: 337, w: 416, h: 465 },
  cube: { x: 921, y: 292, w: 312, h: 306 },
};

/** 390×844 phone: the panel nearly fills the width, the cube docks small below it. */
const PHONE: AuthCircuitInput = {
  page: { w: 326, h: 844 },
  panel: { x: 15, y: 150, w: 296, h: 440 },
  cube: { x: 15, y: 630, w: 60, h: 60 },
};

describe('buildAuthCircuit', () => {
  it('runs the bus horizontally into the cube socket when the cube is beside the panel', () => {
    const { bus } = buildAuthCircuit(DESKTOP);
    expect(bus).toHaveLength(3);
    for (const d of bus) {
      const pts = points(d);
      const [startX] = pts[0];
      const [endX] = pts[pts.length - 1];
      expect(startX).toBeLessThan(endX);
      // Lands on the cube socket's left edge (outside the rendered cube).
      expect(endX).toBeCloseTo(socketOf(DESKTOP.cube!).left, 0);
    }
  });

  it('runs the bus vertically when the cube sits below the panel', () => {
    const { bus } = buildAuthCircuit(PHONE);
    expect(bus).toHaveLength(3);
    for (const d of bus) {
      const pts = points(d);
      expect(pts[0][0]).toBe(pts[pts.length - 1][0]);
      // Ends on U2's top edge: just above the 60px dock box (the board edge
      // clamps the phone socket to ~62px, so it barely grows past the box).
      const endY = pts[pts.length - 1][1];
      expect(endY).toBeLessThanOrEqual(630);
      expect(endY).toBeGreaterThan(620);
    }
  });

  it('keeps every trace inside the board edge', () => {
    for (const input of [DESKTOP, PHONE]) {
      const { edge, traces, bus, nodes, platformTraces } = buildAuthCircuit(input);
      const edgePts = points(edge);
      const minX = Math.min(...edgePts.map(([x]) => x));
      const maxX = Math.max(...edgePts.map(([x]) => x));
      const minY = Math.min(...edgePts.map(([, y]) => y));
      const maxY = Math.max(...edgePts.map(([, y]) => y));
      expect(minX).toBeGreaterThan(0);
      expect(maxX).toBeLessThan(input.page.w);

      const all = [...traces, ...bus, ...platformTraces.map((t) => t.d)]
        .flatMap(points)
        .concat(nodes);
      for (const [x, y] of all) {
        expect(x).toBeGreaterThanOrEqual(minX);
        expect(x).toBeLessThanOrEqual(maxX);
        expect(y).toBeGreaterThanOrEqual(minY);
        expect(y).toBeLessThanOrEqual(maxY);
      }
    }
  });

  it('feeds the cube socket from J1, one trace per platform in pin order', () => {
    const { j1, platformTraces } = buildAuthCircuit(DESKTOP);
    expect(j1?.pins.map((p) => p.platform)).toEqual(['steam', 'xbox', 'playstation', 'unified']);
    expect(platformTraces.map((t) => t.platform)).toEqual([
      'steam',
      'xbox',
      'playstation',
      'unified',
    ]);
    const socketTop = socketOf(DESKTOP.cube!).top;
    const ends = platformTraces.map((t) => points(t.d).at(-1)!);
    for (const [, y] of ends) expect(y).toBeCloseTo(socketTop, 0);
    // Left to right, without crossing.
    const xs = ends.map(([x]) => x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it('keeps J1 clear of the heading column (right of the panel)', () => {
    const { j1 } = buildAuthCircuit(DESKTOP);
    const panelRight = DESKTOP.panel.x + DESKTOP.panel.w;
    for (const pin of j1!.pins) expect(pin.x).toBeGreaterThan(panelRight);
  });

  it('on a phone: J1 sits on the edge with no routing, and all four mounting holes are drawn', () => {
    const { j1, platformTraces, holes } = buildAuthCircuit(PHONE);
    expect(j1).not.toBeNull();
    expect(platformTraces).toHaveLength(0);
    expect(holes).toHaveLength(4);
    // Above the heading, which starts 30px down the phone page.
    for (const pin of j1!.pins) expect(pin.y).toBeLessThan(30);
  });

  it('draws no side traces when a side has too little room (phone gutters)', () => {
    const { traces } = buildAuthCircuit(PHONE);
    // Only vertical traces remain: none start beside the panel.
    for (const d of traces) {
      const [[x0]] = points(d);
      expect(x0).toBeGreaterThan(PHONE.panel.x - 1);
      expect(x0).toBeLessThan(PHONE.panel.x + PHONE.panel.w + 1);
    }
  });

  it('never draws a trace upward into the heading above the panel', () => {
    const { traces } = buildAuthCircuit(DESKTOP);
    const top = DESKTOP.panel.y - 20 - 24; // socket top minus the largest jog
    for (const [, y] of traces.flatMap(points)) {
      expect(y).toBeGreaterThanOrEqual(top);
    }
  });

  it('sizes the cube socket by the dock box height, like the rig draws the cube', () => {
    // Wider than tall would have given a smaller socket under min(w, h); this box is
    // narrower than tall, which is the case the bigger cube creates.
    const tall: AuthCircuitInput = { ...DESKTOP, cube: { x: 921, y: 252, w: 300, h: 396 } };
    const { platformTraces, bus } = buildAuthCircuit(tall);
    const { left, top } = socketOf(tall.cube!);
    for (const t of platformTraces) expect(points(t.d).at(-1)![1]).toBeCloseTo(top, 0);
    for (const d of bus) expect(points(d).at(-1)![0]).toBeCloseTo(left, 0);
  });

  it('keeps the cube socket inside the board when the dock box nears the edge', () => {
    const edgy: AuthCircuitInput = { ...DESKTOP, cube: { x: 1200, y: 252, w: 160, h: 396 } };
    const { edge, sockets } = buildAuthCircuit(edgy);
    const maxX = Math.max(...points(edge).map(([x]) => x));
    for (const [x] of sockets.flatMap(points)) expect(x).toBeLessThanOrEqual(maxX);
  });

  it('never routes a bus line backwards when U1 and U2 are close (1280px layout)', () => {
    // Measured at 1280×800: ~61px between the panel socket and U2.
    const tight: AuthCircuitInput = {
      page: { w: 1216, h: 800 },
      panel: { x: 129, y: 279, w: 413, h: 474 },
      cube: { x: 715, y: 233, w: 274, h: 352 },
    };
    const { bus } = buildAuthCircuit(tight);
    expect(bus).toHaveLength(3);
    for (const d of bus) {
      const xs = points(d).map(([x]) => x);
      for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
    }
    // Still ordered top to bottom where they land, so they don't cross.
    const ends = bus.map((d) => points(d).at(-1)![1]);
    expect([...ends].sort((a, b) => a - b)).toEqual(ends);
  });

  it('works without a cube', () => {
    const { bus, sockets } = buildAuthCircuit({ ...DESKTOP, cube: null });
    expect(bus).toHaveLength(0);
    expect(sockets.length).toBeGreaterThan(0);
  });
});
