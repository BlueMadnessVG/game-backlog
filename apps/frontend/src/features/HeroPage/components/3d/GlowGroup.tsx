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
