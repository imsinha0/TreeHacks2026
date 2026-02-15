/**
 * Fast approximation of PCA using first 3 principal components
 * This is much faster than full PCA but less accurate
 * Good for visualization when speed is more important than precision
 */

/**
 * Fast PCA approximation: just take first 3 dimensions
 * This is O(n) instead of O(n*d²) for full PCA
 */
export function performFastPCA(
  data: number[][],
  dimensions: number = 3
): number[][] {
  if (data.length === 0) {
    return [];
  }

  // Simply take the first 'dimensions' dimensions from each vector
  // This is a very fast approximation
  return data.map((vector) => vector.slice(0, dimensions));
}

/**
 * Alternative: Use mean-centered first 3 dimensions
 * Slightly better than raw first 3, still very fast
 */
export function performFastPCACentered(
  data: number[][],
  dimensions: number = 3
): number[][] {
  if (data.length === 0) {
    return [];
  }

  // Calculate mean for each dimension
  const means: number[] = [];
  for (let d = 0; d < dimensions; d++) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i][d] || 0;
    }
    means[d] = sum / data.length;
  }

  // Center and return first dimensions
  return data.map((vector) => {
    return vector.slice(0, dimensions).map((val, d) => (val || 0) - means[d]);
  });
}

