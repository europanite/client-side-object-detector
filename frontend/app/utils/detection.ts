export type RawPrediction = {
  bbox: [number, number, number, number];
  class: string;
  score: number;
};

export type Detection = {
  id: number;
  class: string;
  score: number;
  x: number;
  y: number;
  width: number;
  height: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

export function normalizeClassFilter(input: string): string[] | null {
  const classes = input
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (classes.length === 0 || classes.includes('all') || classes.includes('*')) {
    return null;
  }

  return Array.from(new Set(classes));
}

export function toFilteredDetections(
  predictions: RawPrediction[],
  minimumScore = 0.5,
  allowedClasses: string[] | null = null,
): Detection[] {
  const allowAll = !allowedClasses || allowedClasses.length === 0;
  const allowSet = new Set((allowedClasses ?? []).map((value) => value.toLowerCase()));

  return predictions
    .filter((prediction) => {
      if (prediction.score < minimumScore) return false;
      if (allowAll) return true;
      return allowSet.has(prediction.class.toLowerCase());
    })
    .map((prediction, index) => {
      const [x, y, width, height] = prediction.bbox;
      return {
        id: index + 1,
        class: prediction.class,
        score: round(prediction.score),
        x: round(x),
        y: round(y),
        width: round(width),
        height: round(height),
        x1: round(x),
        y1: round(y),
        x2: round(x + width),
        y2: round(y + height),
      };
    });
}

export function buildDetectionOutput(
  imageWidth: number,
  imageHeight: number,
  detections: Detection[],
  requestedClasses: string[] | null = null,
) {
  const countsByClass = detections.reduce<Record<string, number>>((accumulator, detection) => {
    accumulator[detection.class] = (accumulator[detection.class] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    image: {
      width: imageWidth,
      height: imageHeight,
      coordinateSystem: 'pixels; origin=(0,0) at top-left',
    },
    totalCount: detections.length,
    countsByClass,
    requestedClasses: requestedClasses ?? 'all',
    detections,
  };
}
