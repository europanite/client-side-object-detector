import React, { useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';

import type { Detection } from '../utils/detection';

type Props = {
  uri: string;
  naturalWidth: number;
  naturalHeight: number;
  detections: Detection[];
};

const PALETTE = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899'];

function colorForClass(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default function DetectionCanvas({
  uri,
  naturalWidth,
  naturalHeight,
  detections,
}: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const aspectRatio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1;
  const containerHeight = containerWidth > 0 ? containerWidth / aspectRatio : 0;
  const scale = useMemo(
    () => (naturalWidth > 0 && containerWidth > 0 ? containerWidth / naturalWidth : 1),
    [containerWidth, naturalWidth],
  );

  return (
    <View
      testID="detection-canvas"
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={{
        width: '100%',
        aspectRatio,
        backgroundColor: '#111827',
        overflow: 'hidden',
        borderRadius: 12,
      }}
    >
      <Image
        source={{ uri }}
        resizeMode="contain"
        style={{ width: '100%', height: containerHeight || '100%' }}
      />

      {containerWidth > 0 &&
        detections.map((detection) => {
          const color = colorForClass(detection.class);
          return (
            <View
              key={detection.id}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: detection.x * scale,
                top: detection.y * scale,
                width: detection.width * scale,
                height: detection.height * scale,
                borderWidth: 3,
                borderColor: color,
              }}
            >
              <Text
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: color,
                  color: '#111827',
                  fontSize: 12,
                  fontWeight: '800',
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                }}
              >
                #{detection.id} {detection.class} {(detection.score * 100).toFixed(0)}%
              </Text>
            </View>
          );
        })}
    </View>
  );
}
