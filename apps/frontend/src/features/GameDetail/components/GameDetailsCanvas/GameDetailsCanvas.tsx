/* eslint-disable react-hooks/immutability */
import { Suspense, useRef, useState, useCallback } from 'react';

import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { CityMesh } from './GameDetailScene';
import { MapNodes } from './MapNodes';
import { NodeCard } from './NodeCard';

import type { Achievement } from '@repo/shared';

// Fog + ambient scene setup
function SceneSetup() {
  const { scene } = useThree();

  // Configure scene
  scene.fog = new THREE.FogExp2('#080c12', 0.016);
  scene.background = new THREE.Color('#0c0f15');

  return null;
}

// Subtle camera drift when nothing is being interacted
function CameraIdleDrift({ active }: { active: boolean }) {
  const driftRef = useRef({ x: 0, z: 0, t: 0 });
  const { camera } = useThree();

  useFrame(({ clock }) => {
    if (active) return;
    const t = clock.getElapsedTime();
    const speed = 0.04;
    const radius = 0.3;
    camera.position.x += (Math.sin(t * speed) * radius - driftRef.current.x) * 0.008;
    camera.position.z += (Math.cos(t * speed * 0.7) * radius - driftRef.current.z) * 0.008;
    driftRef.current.x = Math.sin(t * speed) * radius;
    driftRef.current.z = Math.cos(t * speed * 0.7) * radius;
  });

  return null;
}

interface MapCanvasProps {
  achievements?: Achievement[];
  className?: string;
  style?: React.CSSProperties;
}

export function MapCanvas({ achievements = [], className, style }: MapCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<Achievement | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNodeSelect = useCallback((node: Achievement | null) => {
    setSelectedNode(node);
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#0a0c10',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Scanline overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Corner decorations */}
      <CornerDecorations />

      {/* View controls top-right */}
      <ZoomControls />

      {/* THREE.js Canvas */}
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onPointerDown={() => setIsInteracting(true)}
        onPointerUp={() => setIsInteracting(false)}
        style={{ position: 'absolute', inset: 0 }}
      >
        <SceneSetup />

        {/* Camera */}
        <PerspectiveCamera makeDefault position={[0, 18, 22]} fov={52} near={0.1} far={200} />

        {/* MAIN AMBIENT - Soft base illumination */}
        <ambientLight intensity={1.6} color="#a8c8e8" />

        {/* PRIMARY DIRECTIONAL - Strong southeast light, dramatic shadows */}
        <directionalLight
          position={[18, 26, 12]}
          intensity={3.2}
          color="#e0e8f8"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={90}
          shadow-camera-left={-35}
          shadow-camera-right={35}
          shadow-camera-top={35}
          shadow-camera-bottom={-35}
        />

        {/* SECONDARY DIRECTIONAL - Fill from northwest, reduces harsh shadows */}
        <directionalLight position={[-16, 15, -10]} intensity={1.4} color="#b8d0e8" />

        {/* POINT LIGHT 1 - Downtown cluster highlight (warm) */}
        <pointLight
          position={[-8, 12, -6]}
          intensity={2.2}
          color="#e0c8a0"
          distance={45}
          decay={2}
        />

        {/* POINT LIGHT 2 - Residential area fill (cool-neutral) */}
        <pointLight position={[8, 10, 8]} intensity={1.8} color="#b8d8f0" distance={50} decay={2} />

        {/* POINT LIGHT 3 - Industrial area accent (cool blue) */}
        <pointLight
          position={[-12, 8, 15]}
          intensity={1.4}
          color="#1a5a9e"
          distance={40}
          decay={2}
        />

        {/* POINT LIGHT 4 - Water reflection highlight (blue) */}
        <pointLight
          position={[25, 10, 0]}
          intensity={1.6}
          color="#0a3a8e"
          distance={55}
          decay={2}
        />

        {/* POINT LIGHT 5 - Overhead fill light (neutral) */}
        <pointLight
          position={[0, 32, 0]}
          intensity={1.2}
          color="#d8e8ff"
          distance={85}
          decay={1.8}
        />

        {/* RIM LIGHT - Soft backlight from behind */}
        <pointLight
          position={[-8, 12, -25]}
          intensity={0.9}
          color="#7aa0c8"
          distance={50}
          decay={2}
        />

        {/* City */}
        <Suspense fallback={null}>
          <CityMesh />
          <MapNodes
            achievements={achievements}
            selectedId={selectedNode?.id ?? null}
            onSelect={handleNodeSelect}
          />
        </Suspense>

        {/* Camera drift + controls */}
        <CameraIdleDrift active={isInteracting} />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={5}
          maxDistance={45}
          maxPolarAngle={Math.PI / 2.4}
          minPolarAngle={Math.PI / 8}
          dampingFactor={0.08}
          enableDamping
          target={[0, 0, 0]}
        />
      </Canvas>

      {/* Node info card (HTML overlay) */}
      <NodeCard node={selectedNode} onClose={() => setSelectedNode(null)} />

      {/* CSS for scan animation */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');

        @keyframes scanDown {
          0%   { top: 0%; opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function CornerDecorations() {
  const corner = (pos: React.CSSProperties, _rx: string, _ry: string) => (
    <div
      style={{
        position: 'absolute',
        width: '20px',
        height: '20px',
        borderColor: '#2d3a52',
        borderStyle: 'solid',
        borderWidth: 0,
        borderTopWidth: pos.top !== undefined ? '1px' : 0,
        borderBottomWidth: pos.bottom !== undefined ? '1px' : 0,
        borderLeftWidth: pos.left !== undefined ? '1px' : 0,
        borderRightWidth: pos.right !== undefined ? '1px' : 0,
        zIndex: 3,
        ...pos,
      }}
    />
  );

  return (
    <>
      {corner({ top: 6, left: 6 }, '0', '0')}
      {corner({ top: 6, right: 6 }, '0', '0')}
      {corner({ bottom: 6, left: 6 }, '0', '0')}
      {corner({ bottom: 6, right: 6 }, '0', '0')}
    </>
  );
}

function ZoomControls() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '16px',
        zIndex: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        pointerEvents: 'none',
      }}
    >
      {['+', '-', '⊡'].map((icon) => (
        <div
          key={icon}
          style={{
            width: '24px',
            height: '24px',
            background: 'rgba(13, 15, 20, 0.7)',
            border: '1px solid #1e2535',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4a5568',
            fontSize: icon === '⊡' ? '10px' : '14px',
            fontFamily: 'monospace',
          }}
        >
          {icon}
        </div>
      ))}
    </div>
  );
}
