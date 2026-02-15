import { Matrix, EigenvalueDecomposition } from 'ml-matrix';

/**
 * Perform Principal Component Analysis (PCA) to reduce high-dimensional data to 3D
 * @param data - Array of vectors (each vector is an array of numbers)
 * @param dimensions - Number of dimensions to reduce to (default: 3)
 * @returns Array of reduced vectors (3D coordinates)
 */
export function performPCA(
  data: number[][],
  dimensions: number = 3
): number[][] {
  if (data.length === 0) {
    return [];
  }

  if (data.length < dimensions) {
    // If we have fewer samples than dimensions, pad with zeros
    return data.map((vector) => {
      const padded = [...vector];
      while (padded.length < dimensions) {
        padded.push(0);
      }
      return padded.slice(0, dimensions);
    });
  }

  // Convert to matrix format
  const matrix = new Matrix(data);

  // Center the data (subtract mean from each feature)
  const means = [];
  for (let i = 0; i < matrix.columns; i++) {
    const column = matrix.getColumn(i);
    const mean = column.reduce((a, b) => a + b, 0) / column.length;
    means.push(mean);
  }

  const centered = matrix.clone();
  for (let i = 0; i < matrix.rows; i++) {
    for (let j = 0; j < matrix.columns; j++) {
      centered.set(i, j, matrix.get(i, j) - means[j]);
    }
  }

  // Compute covariance matrix
  const covariance = centered.transpose().mmul(centered);
  const covarianceScaled = covariance.mul(1 / (matrix.rows - 1));

  // Compute eigenvalues and eigenvectors
  const eigens = new EigenvalueDecomposition(covarianceScaled);
  const eigenvectors = eigens.eigenvectorMatrix;
  const eigenvalues = eigens.realEigenvalues;

  // Sort eigenvectors by eigenvalues (descending)
  const eigenPairs: Array<[number, number[]]> = [];
  for (let i = 0; i < eigenvalues.length; i++) {
    eigenPairs.push([
      eigenvalues[i],
      eigenvectors.getColumn(i),
    ]);
  }

  eigenPairs.sort((a, b) => b[0] - a[0]);

  // Take top 'dimensions' eigenvectors
  const projectionMatrix = new Matrix(
    eigenPairs.slice(0, dimensions).map((pair) => pair[1])
  ).transpose();

  // Project data onto principal components
  const projected = centered.mmul(projectionMatrix);

  // Convert back to array format
  const result: number[][] = [];
  for (let i = 0; i < projected.rows; i++) {
    result.push(projected.getRow(i));
  }

  return result;
}

/**
 * Normalize 3D coordinates to fit within a bounding box, centered at (0,0,0)
 * @param points - Array of 3D points
 * @param scale - Scale factor (default: 1)
 * @returns Normalized points centered around (0,0,0)
 */
export function normalize3D(
  points: number[][],
  scale: number = 1
): number[][] {
  if (points.length === 0) {
    return [];
  }

  // Find min and max for each dimension
  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];

  for (const point of points) {
    for (let i = 0; i < 3; i++) {
      mins[i] = Math.min(mins[i], point[i] || 0);
      maxs[i] = Math.max(maxs[i], point[i] || 0);
    }
  }

  // Calculate ranges and centers
  const ranges = maxs.map((max, i) => max - mins[i]);
  const centers = maxs.map((max, i) => (max + mins[i]) / 2);
  const maxRange = Math.max(...ranges);

  if (maxRange === 0) {
    // All points are the same, center them
    return points.map(() => [0, 0, 0]);
  }

  // Center around (0,0,0) and normalize to [-scale, scale] range
  return points.map((point) => {
    return [
      ((point[0] || 0) - centers[0]) / maxRange * 2 * scale,
      ((point[1] || 0) - centers[1]) / maxRange * 2 * scale,
      ((point[2] || 0) - centers[2]) / maxRange * 2 * scale,
    ];
  });
}

