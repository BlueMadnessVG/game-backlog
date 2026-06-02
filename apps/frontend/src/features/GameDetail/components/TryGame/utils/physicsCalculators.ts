// utils/physicsCalculators.ts
/**
 * @deprecated
 * This file is superseded by utils/vehiclePhysics.ts which implements
 * the full arcade physics pipeline (tapered acceleration, speed-dependent
 * steering, grip/drift, cornering friction).
 *
 * All call sites that import from physicsCalculators should be updated
 * to import from vehiclePhysics instead:
 *
 *   // Before
 *   import { calculateSpeedChange, clampSpeed } from './physicsCalculators';
 *
 *   // After
 *   import { calculateNextVehicleState } from './vehiclePhysics';
 *
 * Re-exports are provided below for backward compatibility during migration.
 */
export {
  calculateSpeedChange,
  applyBraking,
  clampSpeed,
  calculateSteeringAngle,
  calculateNextVehicleState,
  isValidDeltaTime,
  isMoving,
} from './vehiclePhysics';
