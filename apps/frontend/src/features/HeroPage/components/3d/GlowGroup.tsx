/**
 * 3D hit area for a controller face button.
 *
 * Wraps a button's meshes and toggles an `activeRef` boolean on pointer
 * over/out (R3F raycast events, no React state) so the per-frame glow and
 * depress effects react to hover without re-rendering.
 *
 * Exports:
 *  - GlowGroup (default): <group> that flips activeRef on pointer enter/leave.
 */
export default function GlowGroup({
  name,
  activeRef,
  children,
}: {
  name: string;
  activeRef: React.MutableRefObject<boolean>;
  children: React.ReactNode;
}) {
  return (
    <group
      name={name}
      onPointerOver={(e) => {
        e.stopPropagation();
        activeRef.current = true;
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        activeRef.current = false;
      }}
    >
      {children}
    </group>
  );
}
