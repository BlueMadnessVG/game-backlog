/* eslint-disable react-hooks/purity */
import { useLayoutEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

const CityZone = {
  DOWNTOWN: 'DOWNTOWN',
  RESIDENTIAL: 'RESIDENTIAL',
  INDUSTRIAL: 'INDUSTRIAL',
} as const;

export type CityZone = (typeof CityZone)[keyof typeof CityZone];

interface BuildingData {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  isLandmark: boolean;
  zone: CityZone;
}

interface ZoneConfig {
  maxDistance: number;
  density: number;
  skipChance: number;
  heightMultiplier: number;
}

// ============================================================================
// UTILITIES - Deterministic Random
// ============================================================================

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ============================================================================
// UTILITIES - Zone Configuration
// ============================================================================

function getCityZones(): Record<CityZone, ZoneConfig> {
  return {
    [CityZone.DOWNTOWN]: {
      maxDistance: 0.25,
      density: 0.88,
      skipChance: 0.08,
      heightMultiplier: 5.2,
    },
    [CityZone.RESIDENTIAL]: {
      maxDistance: 0.55,
      density: 0.72,
      skipChance: 0.18,
      heightMultiplier: 2.4,
    },
    [CityZone.INDUSTRIAL]: {
      maxDistance: 1.0,
      density: 0.45,
      skipChance: 0.35,
      heightMultiplier: 1.8,
    },
  };
}

// ============================================================================
// UTILITIES - Zone Detection
// ============================================================================

function determineZone(
  normalizedDistance: number,
  zoneConfigs: Record<CityZone, ZoneConfig>,
): CityZone {
  if (normalizedDistance <= zoneConfigs[CityZone.DOWNTOWN].maxDistance) {
    return CityZone.DOWNTOWN;
  }

  if (normalizedDistance <= zoneConfigs[CityZone.RESIDENTIAL].maxDistance) {
    return CityZone.RESIDENTIAL;
  }

  return CityZone.INDUSTRIAL;
}

// ============================================================================
// UTILITIES - Building Placement Validation
// ============================================================================

function shouldSkipPosition(
  normalizedDistance: number,
  zone: CityZone,
  randomValue: number,
  zoneConfigs: Record<CityZone, ZoneConfig>,
): boolean {
  const zoneConfig = zoneConfigs[zone];

  if (randomValue < zoneConfig.skipChance) {
    return true;
  }

  const zoneSpacing = (1 - zoneConfig.density) * 0.8;
  if (randomValue < zoneSpacing) {
    return true;
  }

  return false;
}

// ============================================================================
// UTILITIES - Building Dimensions
// ============================================================================

function calculateBuildingDimensions(
  cellSize: number,
  randomValue: number,
): { width: number; depth: number } {
  const padding = cellSize * 0.12;
  const maxW = cellSize - padding * 2;
  const maxD = cellSize - padding * 2;

  return {
    width: maxW * (0.45 + randomValue * 0.55),
    depth: maxD * (0.45 + randomValue * 0.55),
  };
}

// ============================================================================
// UTILITIES - Building Height Calculation
// ============================================================================

function calculateBuildingHeight(
  cellSize: number,
  zone: CityZone,
  normalizedDistance: number,
  randomMultiplier: number,
  zoneConfigs: Record<CityZone, ZoneConfig>,
): number {
  const zoneConfig = zoneConfigs[zone];
  const baseHeight = 0.25 + randomMultiplier * 0.45;

  let heightBoost = 1.0;
  if (zone === CityZone.DOWNTOWN) {
    heightBoost = Math.max(0.6, 1 - normalizedDistance * 2.2);
  } else if (zone === CityZone.RESIDENTIAL) {
    heightBoost = 0.6 + randomMultiplier * 0.4;
  }

  return (baseHeight + heightBoost * randomMultiplier * zoneConfig.heightMultiplier) * cellSize;
}

// ============================================================================
// UTILITIES - Building Color
// ============================================================================

function calculateBuildingColor(zone: CityZone, _randomValue: number): THREE.Color {
  const r = seededRand(
    zone === CityZone.DOWNTOWN ? 101 : zone === CityZone.RESIDENTIAL ? 102 : 103,
  );

  switch (zone) {
    case CityZone.DOWNTOWN: {
      // Warmer, slightly brighter for downtown
      const dwVal = 0.26 + r() * 0.16;
      return new THREE.Color(dwVal, dwVal * 0.98, dwVal * 0.95);
    }

    case CityZone.RESIDENTIAL: {
      // Neutral mid-tone
      const resVal = 0.2 + r() * 0.12;
      return new THREE.Color(resVal, resVal * 1.02, resVal * 1.05);
    }

    case CityZone.INDUSTRIAL: {
      // Cooler, darker
      const indVal = 0.18 + r() * 0.11;
      return new THREE.Color(indVal, indVal * 1.04, indVal * 1.08);
    }

    default:
      return new THREE.Color(0.22, 0.22, 0.22);
  }
}

// ============================================================================
// UTILITIES - Building Factory
// ============================================================================

function createBuilding(
  gridX: number,
  gridZ: number,
  gridW: number,
  gridH: number,
  cellSize: number,
  zone: CityZone,
  normalizedDistance: number,
  width: number,
  depth: number,
  height: number,
): BuildingData {
  const landmarkThreshold = CityZone.DOWNTOWN ? cellSize * 3.5 : cellSize * 2.8;

  return {
    x: (gridX - gridW / 2) * cellSize + cellSize / 2,
    z: (gridZ - gridH / 2) * cellSize + cellSize / 2,
    width,
    depth,
    height,
    zone,
    isLandmark: height > landmarkThreshold,
  };
}

// ============================================================================
// MAIN - City Generation
// ============================================================================

function generateCity(
  gridW: number,
  gridH: number,
  cellSize: number,
  rand: () => number,
): BuildingData[] {
  const buildings: BuildingData[] = [];
  const zoneConfigs = getCityZones();

  for (let gx = 0; gx < gridW; gx++) {
    for (let gz = 0; gz < gridH; gz++) {
      // Calculate distance from center
      const centerX = gx - gridW / 2;
      const centerZ = gz - gridH / 2;
      const normalizedDistance = Math.sqrt(centerX * centerX + centerZ * centerZ) / (gridW / 2);

      // Determine which zone this cell belongs to
      const zone = determineZone(normalizedDistance, zoneConfigs);

      // Check if we should skip this position
      if (shouldSkipPosition(normalizedDistance, zone, rand(), zoneConfigs)) {
        continue;
      }

      // Calculate building dimensions
      const { width, depth } = calculateBuildingDimensions(cellSize, rand());

      // Calculate building height
      const height = calculateBuildingHeight(
        cellSize,
        zone,
        normalizedDistance,
        rand(),
        zoneConfigs,
      );

      // Create building
      const building = createBuilding(
        gx,
        gz,
        gridW,
        gridH,
        cellSize,
        zone,
        normalizedDistance,
        width,
        depth,
        height,
      );

      buildings.push(building);
    }
  }

  return buildings;
}

// ============================================================================
// COMPONENT - Instanced City Mesh
// ============================================================================

export function CityMesh() {
  const rand = useMemo(() => seededRand(42), []);
  const buildings = useMemo(() => generateCity(32, 32, 1.8, rand), [rand]);

  const regularMeshRef = useRef<THREE.InstancedMesh>(null!);
  const landmarkMeshRef = useRef<THREE.InstancedMesh>(null!);
  const edgeMaterialRef = useRef<THREE.MeshStandardMaterial>(null!);

  // Separate buildings by landmark status
  const regular = useMemo(() => buildings.filter((b) => !b.isLandmark), [buildings]);
  const landmarks = useMemo(() => buildings.filter((b) => b.isLandmark), [buildings]);

  // Build matrices and colors for regular buildings
  const { matrices: regMatrices, colors: regColors } = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const dummy = new THREE.Object3D();

    for (const building of regular) {
      dummy.position.set(building.x, building.height / 2, building.z);
      dummy.scale.set(building.width, building.height, building.depth);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      colors.push(calculateBuildingColor(building.zone, Math.random()));
    }

    return { matrices, colors };
  }, [regular]);

  // Build matrices and colors for landmark buildings
  const { matrices: lmMatrices, colors: lmColors } = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const dummy = new THREE.Object3D();

    for (const building of landmarks) {
      dummy.position.set(building.x, building.height / 2, building.z);
      dummy.scale.set(building.width, building.height, building.depth);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());

      // Brighter coloring for landmarks based on zone
      const _zoneRand = Math.random();
      let lmColor: THREE.Color;

      if (building.zone === CityZone.DOWNTOWN) {
        lmColor = new THREE.Color(0.32, 0.28, 0.26);
      } else if (building.zone === CityZone.RESIDENTIAL) {
        lmColor = new THREE.Color(0.26, 0.26, 0.28);
      } else {
        lmColor = new THREE.Color(0.24, 0.25, 0.28);
      }

      colors.push(lmColor);
    }

    return { matrices, colors };
  }, [landmarks]);

  // Apply matrices and colors to regular buildings
  useLayoutEffect(() => {
    if (!regularMeshRef.current) return;

    regMatrices.forEach((matrix, index) => {
      regularMeshRef.current.setMatrixAt(index, matrix);
      regularMeshRef.current.setColorAt(index, regColors[index]);
    });

    regularMeshRef.current.instanceMatrix.needsUpdate = true;
    if (regularMeshRef.current.instanceColor) {
      regularMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [regMatrices, regColors]);

  // Apply matrices and colors to landmark buildings
  useLayoutEffect(() => {
    if (!landmarkMeshRef.current) return;

    lmMatrices.forEach((matrix, index) => {
      landmarkMeshRef.current.setMatrixAt(index, matrix);
      landmarkMeshRef.current.setColorAt(index, lmColors[index]);
    });

    landmarkMeshRef.current.instanceMatrix.needsUpdate = true;
    if (landmarkMeshRef.current.instanceColor) {
      landmarkMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [lmMatrices, lmColors]);

  // Animate landmark building emissive intensity
  useFrame(({ clock }) => {
    if (!edgeMaterialRef.current) return;

    const pulse = Math.sin(clock.getElapsedTime() * 0.6) * 0.5 + 0.5;
    edgeMaterialRef.current.emissiveIntensity = 0.15 + pulse * 0.2;
  });

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color="#141820" roughness={1} />
      </mesh>

      {/* Road grid lines */}
      <GridLines />

      {/* Regular buildings */}
      <instancedMesh
        ref={regularMeshRef}
        args={[undefined, undefined, regular.length]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.68} metalness={0.22} vertexColors />
      </instancedMesh>

      {/* Landmark/skyscraper buildings */}
      <instancedMesh
        ref={landmarkMeshRef}
        args={[undefined, undefined, landmarks.length]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          ref={edgeMaterialRef}
          roughness={0.7}
          metalness={0.28}
          vertexColors
          emissive={new THREE.Color(0.25, 0.35, 0.5)}
          emissiveIntensity={0.08}
        />
      </instancedMesh>

      {/* Water plane */}
      <WaterPlane />
    </group>
  );
}

// ============================================================================
// COMPONENT - Grid Lines
// ============================================================================

function GridLines() {
  const geometry = useMemo(() => {
    const points: number[] = [];
    const size = 56;
    const step = 1.8;

    for (let i = -size / 2; i <= size / 2; i += step) {
      points.push(-size / 2, 0, i, size / 2, 0, i);
      points.push(i, 0, -size / 2, i, 0, size / 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geo;
  }, []);

  return (
    <lineSegments geometry={geometry} position={[0, 0.01, 0]}>
      <lineBasicMaterial color="#252c3d" transparent opacity={0.65} />
    </lineSegments>
  );
}

// ============================================================================
// COMPONENT - Water Plane
// ============================================================================

function WaterPlane() {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;

    const t = clock.getElapsedTime();
    materialRef.current.opacity = 0.72 + Math.sin(t * 0.4) * 0.06;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, -0.05, 0]}>
      <planeGeometry args={[28, 70]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#050c18"
        roughness={0.08}
        metalness={0.52}
        transparent
        opacity={0.75}
        emissive={new THREE.Color(0.0, 0.08, 0.18)}
        emissiveIntensity={0.6}
      />
    </mesh>
  );
}
