import { useMemo, useRef, useState } from 'react';

import { Line, Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lerp } from 'three/src/math/MathUtils.js';

const OUTER = 5.5;
const ARM_LEN = 3;
const SCAN_DURATION = 2.4;

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
}: {
  position: [number, number, number];
  color: string;
  activeRef: React.MutableRefObject<number>;
  label?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
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

  /* ── Vertical blob in XY plane ── */
  const blobPoints = useMemo(() => {
    const angles = [0, 40, 75, 110, 150, 190, 230, 270, 310, 350];
    const radii = [1.7, 1.5, 1.35, 1.6, 1.4, 1.75, 1.55, 1.3, 1.65, 1.5];
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
    const s = 2.15;
    return [
      new THREE.Vector3(-s, s, 0),
      new THREE.Vector3(s, s, 0),
      new THREE.Vector3(s, -s, 0),
      new THREE.Vector3(-s, -s, 0),
      new THREE.Vector3(-s, s, 0),
    ];
  }, []);

  /* ── Brackets: vertical L-shapes in XY plane at z = 0.3 ── */
  const bracketPoints = useMemo(
    () =>
      CORNERS.map(
        ([sx, sy]) =>
          [
            new THREE.Vector3(sx * (OUTER - ARM_LEN), sy * OUTER, 0.3),
            new THREE.Vector3(sx * OUTER, sy * OUTER, 0.3),
            new THREE.Vector3(sx * OUTER, sy * (OUTER - ARM_LEN), 0.3),
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

  const updateActive = (group: THREE.Group, t: number) => {
    group.position.y = position[1] + Math.sin(t * 3) * 1.5;
    group.rotation.y = t * 1.5;

    if (Math.random() > 0.94) {
      group.position.x = position[0] + (Math.random() - 0.5) * 0.8;
    } else {
      group.position.x = position[0];
    }

    if (glyphRef.current) {
      glyphRef.current.rotation.z = -t * 1.2;
      glyphRef.current.rotation.x = Math.sin(t * 2) * 0.25;
    }

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

  const updateIdle = (group: THREE.Group) => {
    group.position.x = position[0];
    group.position.y = position[1];

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
    if (lightRef.current) lightRef.current.intensity = 14;
  };

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const t = state.clock.elapsedTime;
    const target = activeRef.current;
    const s = lerp(group.scale.x, target, 0.12);
    group.scale.setScalar(Math.max(0, s));

    if (target > 0.01 && s > 0.01) {
      updateActive(group, t);
    } else {
      updateIdle(group);
    }
  });

  return (
    <group ref={groupRef} position={position} scale={0}>
      {/* ── Base platform: vertical plate in XY plane ── */}
      <mesh raycast={() => null}>
        <boxGeometry args={[12, 12, 0.5]} />
        <meshBasicMaterial
          ref={baseMatRef}
          color={color}
          transparent
          opacity={0.06}
          toneMapped={false}
        />
      </mesh>

      <mesh raycast={() => null}>
        <boxGeometry args={[12, 12, 0.5]} />
        <meshBasicMaterial
          ref={borderMatRef}
          color={color}
          wireframe
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>

      {/* ── Corner brackets: vertical L-shapes framing the plate ── */}
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

      {/* ── Glyph group: vertical in XY plane, slightly in front ── */}
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

      {/* ── HUD Label: below the vertical plate ── */}
      <Billboard position={[0, -OUTER - 1.5, 0.5]}>
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

      {/* ── Scan sweep: vertical beam sweeping through Y ── */}
      <mesh
        ref={scanRef}
        position={[0, 0, 0.3]}
        rotation={[0, 0, Math.PI / 4]}
        raycast={() => null}
      >
        <planeGeometry args={[14, 0.25]} />
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

      <pointLight ref={lightRef} color={color} intensity={20} distance={30} />
    </group>
  );
}
