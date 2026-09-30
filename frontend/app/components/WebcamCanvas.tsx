import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import type { Detection } from '../utils/detection';

type Props = {
  stream: MediaStream | null;
  detections: Detection[];
  onVideoElement: (element: HTMLVideoElement | null) => void;
  onVideoSize: (width: number, height: number) => void;
};

const PALETTE = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899'];

function colorForClass(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default function WebcamCanvas({ stream, detections, onVideoElement, onVideoSize }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [videoSize, setVideoSize] = useState({ width: 16, height: 9 });

  useEffect(() => {
    const video = videoRef.current;
    onVideoElement(video);
    if (!video) return undefined;

    video.srcObject = stream;
    if (stream) {
      void video.play().catch(() => undefined);
    }

    return () => {
      onVideoElement(null);
      video.srcObject = null;
    };
  }, [stream, onVideoElement]);

  const aspectRatio = videoSize.width / videoSize.height;
  const containerHeight = containerWidth > 0 ? containerWidth / aspectRatio : 0;
  const scale = useMemo(
    () => (videoSize.width > 0 && containerWidth > 0 ? containerWidth / videoSize.width : 1),
    [containerWidth, videoSize.width],
  );

  if (Platform.OS !== 'web') {
    return <Text>Webcam input is currently available on Expo Web.</Text>;
  }

  const videoElement = React.createElement('video', {
    ref: (element: HTMLVideoElement | null) => {
      videoRef.current = element;
      if (element) onVideoElement(element);
    },
    autoPlay: true,
    muted: true,
    playsInline: true,
    onLoadedMetadata: (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const element = event.currentTarget;
      const width = element.videoWidth || 16;
      const height = element.videoHeight || 9;
      setVideoSize({ width, height });
      onVideoSize(width, height);
    },
    style: {
      width: '100%',
      height: containerHeight || '100%',
      objectFit: 'contain',
      display: 'block',
      backgroundColor: '#111827',
    },
  });

  return (
    <View
      testID="webcam-canvas"
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={{
        width: '100%',
        aspectRatio,
        backgroundColor: '#111827',
        overflow: 'hidden',
        borderRadius: 12,
      }}
    >
      {videoElement}

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
