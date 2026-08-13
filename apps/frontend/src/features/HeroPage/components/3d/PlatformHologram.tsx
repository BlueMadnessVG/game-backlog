import { useMemo, useRef, useState } from 'react';

import { Line, Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lerp } from 'three/src/math/MathUtils.js';

import HologramShell from './HologramShell';

/**
 * The platform hologram plate that blooms under a face button during its
 * scroll window.
 *
 * Full "analysis" animation loop: idle pulse when dormant, a rising scan
 * sweep + 0→100% progress readout, and periodic glitch bursts (RGB ghost
 * copies via HologramShell + point-light flicker) while active. Activation is
 * driven per-frame from an `activeRef` number (0..1) so the plate scales up
 * smoothly and never re-renders React.
 *
 * Exports:
 *  - PlatformHologram (default): the animated hologram group.
 *  - Shared plate dims used by HologramShell: PLATE_W/H/THICK, PANEL_TILT,
 *    OUTER_X/Y, ARM_LEN, FRAME_SX/SY.
 */

/* ═══════════════════════════════════════════
   SIZE CONFIG — tweak these to resize the panel
   ═══════════════════════════════════════════ */
export const PLATE_W = 84;
export const PLATE_H = 84;
export const PLATE_THICK = 3.6;
export const PANEL_TILT = 0.45;

export const OUTER_X = 40;
export const OUTER_Y = 40;
export const ARM_LEN = 21;

export const FRAME_SX = 18;
export const FRAME_SY = 18;

const SCAN_DURATION = 2.4;
const GLITCH_INTERVAL = 5;
const GLITCH_DURATION = 0.3;

/* Backlog HUD theme tokens */
const THEME_MAGENTA = '#ffafd3';
const THEME_GREEN = '#45dfa4';
const THEME_VIOLET = '#d0bcff';

const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

function bump(phase: number) {
  return 0.4 + 0.6 * Math.sin(phase * Math.PI);
}

export default function PlatformHologram({
  position,
  color,
  activeRef,
  label = 'Analyzing specimen',
  ghostAColor = THEME_MAGENTA,
  ghostBColor = THEME_GREEN,
}: {
  position: [number, number, number];
  color: string;
  activeRef: React.MutableRefObject<number>;
  label?: string;
  ghostAColor?: string;
  ghostBColor?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const originalRef = useRef<THREE.Group>(null);
  const dupARef = useRef<THREE.Group>(null);
  const dupBRef = useRef<THREE.Group>(null);

  const scanRef = useRef<THREE.Mesh>(null);
  const scanMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const glyphRef = useRef<THREE.Group>(null);

  const baseMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const borderMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const traceRef = useRef<React.ComponentRef<typeof Line> | null>(null);
  const frameRef = useRef<React.ComponentRef<typeof Line> | null>(null);
  const bracketRefs = useRef<(React.ComponentRef<typeof Line> | null)[]>([]);

  const lightRef = useRef<THREE.PointLight>(null);

  const [percent, setPercent] = useState(0);
  const lastLabelUpdate = useRef(0);

  /* Glitch state */
  const glitchRef = useRef({ active: false, startTime: 0 });
  const nextGlitchRef = useRef(5);
  const wasIdleRef = useRef(true);

  /* ── Vertical blob in XY plane ── */
  const blobPoints = useMemo(() => {
    const angles = [0, 40, 75, 110, 150, 190, 230, 270, 310, 350];
    const radii = [15.6, 13.8, 12.6, 15.0, 13.2, 16.8, 14.4, 12.0, 15.6, 13.8];
    const controls = angles.map((deg, i) => {
      const rad = (deg * Math.PI) / 180;
      return new THREE.Vector3(Math.cos(rad) * radii[i], Math.sin(rad) * radii[i], 0);
    });
    const curve = new THREE.CatmullRomCurve3(controls, true, 'catmullrom', 0.5);
    const pts = curve.getPoints(80);
    return [...pts, pts[0].clone()];
  }, []);

  const blobLength = useMemo(() => {
    let len = 0;
    for (let i = 1; i < blobPoints.length; i++) {
      len += blobPoints[i].distanceTo(blobPoints[i - 1]);
    }
    return len;
  }, [blobPoints]);

  /* ── Vertical frame in XY plane ── */
  const framePoints = useMemo(() => {
    const sx = FRAME_SX;
    const sy = FRAME_SY;
    return [
      new THREE.Vector3(-sx, sy, 0),
      new THREE.Vector3(sx, sy, 0),
      new THREE.Vector3(sx, -sy, 0),
      new THREE.Vector3(-sx, -sy, 0),
      new THREE.Vector3(-sx, sy, 0),
    ];
  }, []);

  /* ── Brackets: vertical L-shapes in XY plane at z = 0.3 ── */
  const bracketPoints = useMemo(
    () =>
      CORNERS.map(
        ([sx, sy]) =>
          [
            new THREE.Vector3(sx * (OUTER_X - ARM_LEN), sy * OUTER_Y, 0.3),
            new THREE.Vector3(sx * OUTER_X, sy * OUTER_Y, 0.3),
            new THREE.Vector3(sx * OUTER_X, sy * (OUTER_Y - ARM_LEN), 0.3),
          ] as [THREE.Vector3, THREE.Vector3, THREE.Vector3],
      ),
    [],
  );

  const sweepTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 64);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.45, 'rgba(255,255,255,1)');
      grad.addColorStop(0.55, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const resetDup = (group: THREE.Group | null) => {
    if (!group) return;
    group.visible = false;
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.scale.setScalar(1);
  };

  const resetGhosts = () => {
    if (originalRef.current) originalRef.current.visible = true;
    resetDup(dupARef.current);
    resetDup(dupBRef.current);
  };

  const updateScan = (t: number) => {
    const phase = (t % SCAN_DURATION) / SCAN_DURATION;
    if (scanRef.current) {
      const range = 7;
      scanRef.current.position.y = -range + phase * range * 2;
    }
    if (scanMatRef.current) {
      const fade = phase < 0.08 ? phase / 0.08 : phase > 0.92 ? (1 - phase) / 0.08 : 1;
      scanMatRef.current.opacity = fade * 0.6;
    }
    if (t - lastLabelUpdate.current > 0.15) {
      lastLabelUpdate.current = t;
      setPercent(Math.floor(phase * 100));
    }
  };

  const applyGlitch = (group: THREE.Group, t: number) => {
    const elapsed = t - glitchRef.current.startTime;
    const intensity = 1 - elapsed / GLITCH_DURATION;
    const r = () => (Math.random() - 0.5) * 2;
    const baseY = position[1] + Math.sin(t * 3) * 1.5;

    if (originalRef.current) {
      originalRef.current.visible = Math.random() > 0.35;
    }

    if (dupARef.current) {
      dupARef.current.visible = true;
      dupARef.current.position.set(
        r() * 27 * intensity,
        r() * 21 * intensity,
        r() * 15 * intensity,
      );
      dupARef.current.rotation.z = r() * 0.6 * intensity;
      dupARef.current.rotation.y = r() * 0.25 * intensity;
      dupARef.current.scale.setScalar(0.75 + Math.random() * 0.5);
    }

    if (dupBRef.current) {
      dupBRef.current.visible = Math.random() > 0.25;
      dupBRef.current.position.set(
        r() * 33 * intensity,
        r() * 24 * intensity,
        r() * 18 * intensity,
      );
      dupBRef.current.rotation.z = r() * 0.9 * intensity;
      dupBRef.current.rotation.y = r() * 0.4 * intensity;
      dupBRef.current.scale.setScalar(1.0 + Math.random() * 0.4);
    }

    // Parent jitter
    group.position.x = position[0] + r() * 3.6 * intensity;
    group.position.y = baseY + r() * 2.4 * intensity;
    group.rotation.z = r() * 0.9 * intensity;

    if (glyphRef.current) {
      glyphRef.current.rotation.z = r() * 3.0 * intensity;
      glyphRef.current.position.z = 0.3 + r() * 1.8 * intensity;
    }

    if (lightRef.current) {
      lightRef.current.intensity = 20 + Math.random() * 120 * intensity;
      lightRef.current.color.set(THEME_VIOLET);
    }

    updateScan(t);
  };

  const updateIdlePulse = (group: THREE.Group, t: number) => {
    group.position.y = position[1] + Math.sin(t * 3) * 1.5;
    group.position.x = position[0];
    group.rotation.set(PANEL_TILT, 0, 0);

    resetGhosts();

    if (glyphRef.current) {
      glyphRef.current.rotation.z = 0;
      glyphRef.current.position.z = 0.3;
    }

    if (lightRef.current) lightRef.current.color.set(color);

    const phase = (t % SCAN_DURATION) / SCAN_DURATION;
    const pulse = bump(phase);

    if (baseMatRef.current) baseMatRef.current.opacity = 0.06 * (0.6 + pulse * 0.4);
    if (borderMatRef.current) borderMatRef.current.opacity = pulse;
    if (frameRef.current?.material) frameRef.current.material.opacity = pulse;
    bracketRefs.current.forEach((line) => {
      if (line?.material) line.material.opacity = pulse;
    });
    if (lightRef.current) lightRef.current.intensity = 14 + pulse * 12;

    if (traceRef.current?.material) {
      traceRef.current.material.dashOffset = blobLength * (1 - phase);
      traceRef.current.material.opacity = 0.6 + 0.4 * pulse;
    }

    updateScan(t);
  };

  const updateActive = (group: THREE.Group, t: number) => {
    if (!glitchRef.current.active && t >= nextGlitchRef.current) {
      glitchRef.current = { active: true, startTime: t };
      nextGlitchRef.current = t + GLITCH_INTERVAL;
    }

    if (glitchRef.current.active) {
      const elapsed = t - glitchRef.current.startTime;
      if (elapsed <= GLITCH_DURATION) {
        applyGlitch(group, t);
        return;
      }
      glitchRef.current.active = false;
      resetGhosts();
    }

    updateIdlePulse(group, t);
  };

  const updateIdle = (group: THREE.Group) => {
    group.position.set(position[0], position[1], position[2]);
    group.rotation.set(PANEL_TILT, 0, 0);
    glitchRef.current.active = false;

    resetGhosts();

    if (baseMatRef.current) baseMatRef.current.opacity = 0.06;
    if (borderMatRef.current) borderMatRef.current.opacity = 0.75;
    if (frameRef.current?.material) frameRef.current.material.opacity = 0.75;
    bracketRefs.current.forEach((line) => {
      if (line?.material) line.material.opacity = 0.75;
    });
    if (traceRef.current?.material) {
      traceRef.current.material.dashOffset = 0;
      traceRef.current.material.opacity = 0.7;
    }
    if (scanMatRef.current) scanMatRef.current.opacity = 0.12;
    if (lightRef.current) {
      lightRef.current.intensity = 14;
      lightRef.current.color.set(color);
    }
  };

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const t = state.clock.elapsedTime;
    const target = activeRef.current;
    const s = lerp(group.scale.x, target, 0.12);
    group.scale.setScalar(Math.max(0, s));

    if (target > 0.01 && s > 0.01) {
      if (wasIdleRef.current) {
        wasIdleRef.current = false;
        nextGlitchRef.current = t + GLITCH_INTERVAL;
        glitchRef.current.active = false;
        if (originalRef.current) originalRef.current.visible = true;
        if (dupARef.current) dupARef.current.visible = false;
        if (dupBRef.current) dupBRef.current.visible = false;
      }
      updateActive(group, t);
    } else {
      wasIdleRef.current = true;
      updateIdle(group);
    }
  });

  return (
    <group ref={groupRef} position={position} scale={0} userData={{ hologram: true }}>
      {/* ORIGINAL */}
      <group ref={originalRef}>
        <mesh raycast={() => null}>
          <boxGeometry args={[PLATE_W, PLATE_H, PLATE_THICK]} />
          <meshBasicMaterial
            ref={baseMatRef}
            color={color}
            transparent
            opacity={0.06}
            toneMapped={false}
          />
        </mesh>

        <mesh raycast={() => null}>
          <boxGeometry args={[PLATE_W, PLATE_H, PLATE_THICK]} />
          <meshBasicMaterial
            ref={borderMatRef}
            color={color}
            wireframe
            transparent
            opacity={0.9}
            toneMapped={false}
          />
        </mesh>

        {bracketPoints.map((pts, i) => (
          <group key={i}>
            <Line
              points={pts}
              color={color}
              lineWidth={6}
              transparent
              opacity={0.25}
              toneMapped={false}
            />
            <Line
              ref={(l) => {
                bracketRefs.current[i] = l;
              }}
              points={pts}
              color={color}
              lineWidth={2.5}
              transparent
              opacity={0.9}
              toneMapped={false}
            />
          </group>
        ))}

        <group ref={glyphRef} position={[0, 1.5, 0.3]}>
          <Line
            ref={frameRef}
            points={framePoints}
            color={color}
            lineWidth={1.5}
            transparent
            opacity={0.9}
            toneMapped={false}
          />
          <Line
            points={blobPoints}
            color={color}
            lineWidth={5}
            transparent
            opacity={0.2}
            toneMapped={false}
          />
          <Line
            ref={traceRef}
            points={blobPoints}
            color={color}
            lineWidth={1.8}
            dashed
            dashSize={blobLength}
            gapSize={blobLength}
            transparent
            opacity={0.95}
            toneMapped={false}
          />
        </group>

        <Billboard position={[0, -OUTER_Y - 8, 0.5]}>
          <Text
            fontSize={0.6}
            color={color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0}
            letterSpacing={0.05}
          >
            {`${label} — ${percent}%`}
          </Text>
        </Billboard>

        <mesh
          ref={scanRef}
          position={[0, 0, 0.3]}
          rotation={[0, 0, Math.PI / 4]}
          raycast={() => null}
        >
          <planeGeometry args={[PLATE_W + 6, 1.8]} />
          <meshBasicMaterial
            ref={scanMatRef}
            map={sweepTexture}
            color={color}
            transparent
            opacity={0.5}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* GHOST A — magenta */}
      <group ref={dupARef} visible={false}>
        <HologramShell
          color={ghostAColor}
          bracketPoints={bracketPoints}
          framePoints={framePoints}
          blobPoints={blobPoints}
          sweepTexture={sweepTexture}
          label={label}
          percent={percent}
          opacity={0.6}
        />
      </group>

      {/* GHOST B — green */}
      <group ref={dupBRef} visible={false}>
        <HologramShell
          color={ghostBColor}
          bracketPoints={bracketPoints}
          framePoints={framePoints}
          blobPoints={blobPoints}
          sweepTexture={sweepTexture}
          label={label}
          percent={percent}
          opacity={0.45}
        />
      </group>

      <pointLight ref={lightRef} color={color} intensity={20} distance={30} />
    </group>
  );
}
