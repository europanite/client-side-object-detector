import {
  buildDetectionOutput,
  normalizeClassFilter,
  toFilteredDetections,
} from '../utils/detection';

describe('detection utilities', () => {
  test('normalizes class filter text', () => {
    expect(normalizeClassFilter(' person, car,person ')).toEqual(['person', 'car']);
    expect(normalizeClassFilter('')).toBeNull();
    expect(normalizeClassFilter('all')).toBeNull();
  });

  test('keeps only requested classes at or above the threshold', () => {
    const result = toFilteredDetections(
      [
        { bbox: [10, 20, 30, 40], class: 'car', score: 0.91 },
        { bbox: [1, 2, 3, 4], class: 'truck', score: 0.99 },
        { bbox: [5, 6, 7, 8], class: 'person', score: 0.8 },
        { bbox: [9, 9, 9, 9], class: 'car', score: 0.4 },
      ],
      0.5,
      ['car', 'person'],
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 1,
      class: 'car',
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      x2: 40,
      y2: 60,
    });
    expect(result[1]).toMatchObject({
      id: 2,
      class: 'person',
      x: 5,
      y: 6,
      width: 7,
      height: 8,
      x2: 12,
      y2: 14,
    });
  });

  test('builds serializable output with counts by class and source image coordinates', () => {
    const detections = toFilteredDetections(
      [
        { bbox: [0, 0, 50, 20], class: 'car', score: 0.8 },
        { bbox: [1, 1, 10, 10], class: 'person', score: 0.9 },
      ],
      0.5,
      null,
    );
    expect(buildDetectionOutput(640, 480, detections, ['car', 'person'])).toEqual({
      image: {
        width: 640,
        height: 480,
        coordinateSystem: 'pixels; origin=(0,0) at top-left',
      },
      totalCount: 2,
      countsByClass: {
        car: 1,
        person: 1,
      },
      requestedClasses: ['car', 'person'],
      detections,
    });
  });
});
