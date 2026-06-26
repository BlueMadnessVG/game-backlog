interface GetColumnCountOptions {
  containerWidth: number;
  minCardWidth?: number;
  maxCardWidth?: number;
  gap?: number;
  paddingX?: number;
  minColumns?: number;
  maxColumns?: number;
}

export function getColumnCount({
  containerWidth,
  minCardWidth = 200,
  maxCardWidth = 300,
  gap = 24,
  paddingX = 48,
  minColumns = 2,
  maxColumns = 8,
}: GetColumnCountOptions): number {
  if (containerWidth <= 0) return minColumns;

  const availableWidth = containerWidth - paddingX;
  const baseColumns = Math.floor((availableWidth + gap) / (maxCardWidth + gap));

  if (baseColumns < minColumns) return minColumns;
  if (baseColumns > maxColumns) return maxColumns;

  // Verify actual card width stays within bounds
  const actualCardWidth = (availableWidth - (baseColumns - 1) * gap) / baseColumns;

  if (actualCardWidth < minCardWidth && baseColumns > minColumns) {
    return baseColumns - 1;
  }

  return baseColumns;
}
