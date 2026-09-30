import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import DetectionCanvas from '../components/DetectionCanvas';
import WebcamCanvas from '../components/WebcamCanvas';
import {
  buildDetectionOutput,
  normalizeClassFilter,
  toFilteredDetections,
  type Detection,
  type RawPrediction,
} from '../utils/detection';

type DetectableElement = HTMLImageElement | HTMLVideoElement;

type ModelLike = {
  detect: (source: DetectableElement, maxNumBoxes?: number, minScore?: number) => Promise<RawPrediction[]>;
};

type SelectedImage = {
  name: string;
  uri: string;
  element: HTMLImageElement;
  width: number;
  height: number;
};

type SourceMode = 'image' | 'webcam';

const CARD = {
  backgroundColor: '#ffffff',
  borderRadius: 14,
  padding: 16,
  borderWidth: 1,
  borderColor: '#e5e7eb',
} as const;

export default function HomeScreen() {
  const modelRef = useRef<ModelLike | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [sourceMode, setSourceMode] = useState<SourceMode>('image');
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [thresholdText, setThresholdText] = useState('0.50');
  const [classFilterText, setClassFilterText] = useState('');
  const [status, setStatus] = useState('Choose an image or start the webcam.');
  const [busy, setBusy] = useState(false);
  const [backend, setBackend] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const threshold = useMemo(() => {
    const parsed = Number(thresholdText);
    if (!Number.isFinite(parsed)) return 0.5;
    return Math.min(0.99, Math.max(0.05, parsed));
  }, [thresholdText]);

  const requestedClasses = useMemo(() => normalizeClassFilter(classFilterText), [classFilterText]);

  const sourceWidth = sourceMode === 'webcam' ? videoSize.width : image?.width ?? 0;
  const sourceHeight = sourceMode === 'webcam' ? videoSize.height : image?.height ?? 0;

  const output = useMemo(
    () => buildDetectionOutput(sourceWidth, sourceHeight, detections, requestedClasses),
    [sourceWidth, sourceHeight, detections, requestedClasses],
  );

  const outputText = useMemo(() => JSON.stringify(output, null, 2), [output]);

  const getModel = useCallback(async (): Promise<ModelLike> => {
    if (modelRef.current) return modelRef.current;

    setStatus('Loading TensorFlow.js and COCO-SSD…');
    const tf = await import('@tensorflow/tfjs-core');
    await import('@tensorflow/tfjs-backend-cpu');
    await import('@tensorflow/tfjs-backend-webgl');

    let selectedBackend = 'webgl';
    try {
      const ready = await tf.setBackend('webgl');
      if (!ready) throw new Error('WebGL backend unavailable');
    } catch {
      await tf.setBackend('cpu');
      selectedBackend = 'cpu';
    }
    await tf.ready();
    setBackend(selectedBackend);

    const cocoSsd = await import('@tensorflow-models/coco-ssd');
    const model = (await cocoSsd.load({ base: 'lite_mobilenet_v2' })) as ModelLike;
    modelRef.current = model;
    return model;
  }, []);

  const detectSource = useCallback(
    async (source: DetectableElement) => {
      const model = await getModel();
      const predictions = await model.detect(source, 100, threshold);
      return toFilteredDetections(predictions, threshold, requestedClasses);
    },
    [getModel, threshold, requestedClasses],
  );

  const analyzeImage = useCallback(
    async (selected: SelectedImage) => {
      setBusy(true);
      setDetections([]);
      try {
        setStatus('Detecting objects…');
        const items = await detectSource(selected.element);
        setDetections(items);
        setStatus(`Done. ${items.length} object${items.length === 1 ? '' : 's'} detected.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Detection failed: ${message}`);
      } finally {
        setBusy(false);
      }
    },
    [detectSource],
  );

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStream(null);
    setCameraActive(false);
    setVideoElement(null);
    setVideoSize({ width: 0, height: 0 });
  }, []);

  const startWebcam = useCallback(
    async (deviceId?: string) => {
      if (Platform.OS !== 'web' || !navigator.mediaDevices?.getUserMedia) {
        setStatus('Webcam access is available on supported browsers in Expo Web.');
        return;
      }

      stopWebcam();
      setSourceMode('webcam');
      setDetections([]);
      setBusy(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
        streamRef.current = stream;
        setCameraStream(stream);
        setCameraActive(true);
        setSelectedCameraId(deviceId ?? stream.getVideoTracks()[0]?.getSettings().deviceId ?? null);

        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameraDevices(devices.filter((device) => device.kind === 'videoinput'));
        setStatus('Webcam started. Detecting continuously in the browser…');
        await getModel();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Could not start webcam: ${message}`);
        stopWebcam();
      } finally {
        setBusy(false);
      }
    },
    [getModel, stopWebcam],
  );

  useEffect(() => {
    if (!cameraActive || sourceMode !== 'webcam' || !videoElement) return undefined;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (cancelled) return;
      if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
        try {
          const items = await detectSource(videoElement);
          if (!cancelled) {
            setDetections(items);
            setStatus(`Live webcam: ${items.length} object${items.length === 1 ? '' : 's'} detected.`);
          }
        } catch (error) {
          if (!cancelled) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus(`Webcam detection failed: ${message}`);
          }
        }
      }
      if (!cancelled) timer = setTimeout(run, 500);
    };

    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [cameraActive, sourceMode, videoElement, detectSource]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const chooseImage = useCallback(() => {
    if (Platform.OS !== 'web') {
      setStatus('This prototype currently runs on Expo Web.');
      return;
    }

    stopWebcam();
    setSourceMode('image');

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const uri = URL.createObjectURL(file);
      objectUrlRef.current = uri;

      const element = new window.Image();
      await new Promise<void>((resolve, reject) => {
        element.onload = () => resolve();
        element.onerror = () => reject(new Error('Could not decode the selected image.'));
        element.src = uri;
      });

      const selected: SelectedImage = {
        name: file.name,
        uri,
        element,
        width: element.naturalWidth,
        height: element.naturalHeight,
      };
      setImage(selected);
      setStatus(`Loaded ${file.name}. Starting detection…`);
      await analyzeImage(selected);
    };
    input.click();
  }, [analyzeImage, stopWebcam]);

  const copyJson = useCallback(async () => {
    if (Platform.OS !== 'web' || !navigator.clipboard) {
      setStatus('Clipboard API is not available in this environment.');
      return;
    }
    await navigator.clipboard.writeText(outputText);
    setStatus('JSON copied to clipboard.');
  }, [outputText]);

  const downloadJson = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const blob = new Blob([outputText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = sourceMode === 'webcam' ? 'webcam-detections.json' : `${image?.name ?? 'detections'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [image?.name, outputText, sourceMode]);

  const countsByClassEntries = useMemo(
    () => Object.entries(output.countsByClass).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    [output.countsByClass],
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 64 }}>
      <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', gap: 16 }}>
        <View style={CARD}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827' }}>
            Browser Object Detector
          </Text>
          <Text style={{ color: '#4b5563', marginTop: 6, lineHeight: 21 }}>
            Use a local image or your local webcam. TensorFlow.js and COCO-SSD run entirely in the
            browser and return bounding boxes, classes, scores, counts, and source coordinates.
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <Pressable
              accessibilityRole="button"
              onPress={chooseImage}
              disabled={busy}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1d4ed8' : '#2563eb',
                borderRadius: 10,
                paddingHorizontal: 18,
                paddingVertical: 12,
                opacity: busy ? 0.6 : 1,
              })}
            >
              <Text style={{ color: '#ffffff', fontWeight: '800' }}>Choose image</Text>
            </Pressable>

            {!cameraActive ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void startWebcam()}
                disabled={busy}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#047857' : '#059669',
                  borderRadius: 10,
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  opacity: busy ? 0.6 : 1,
                })}
              >
                <Text style={{ color: '#ffffff', fontWeight: '800' }}>Start webcam</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={stopWebcam}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#b91c1c' : '#dc2626',
                  borderRadius: 10,
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                })}
              >
                <Text style={{ color: '#ffffff', fontWeight: '800' }}>Stop webcam</Text>
              </Pressable>
            )}

            {sourceMode === 'image' && image && (
              <Pressable
                accessibilityRole="button"
                onPress={() => analyzeImage(image)}
                disabled={busy}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#374151' : '#4b5563',
                  borderRadius: 10,
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  opacity: busy ? 0.6 : 1,
                })}
              >
                <Text style={{ color: '#ffffff', fontWeight: '800' }}>Run again</Text>
              </Pressable>
            )}

            <View style={{ minWidth: 130 }}>
              <Text style={{ color: '#374151', fontSize: 12, marginBottom: 3 }}>Minimum score</Text>
              <TextInput
                value={thresholdText}
                onChangeText={setThresholdText}
                keyboardType="decimal-pad"
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  backgroundColor: '#ffffff',
                }}
              />
            </View>

            <View style={{ minWidth: 260, flexGrow: 1 }}>
              <Text style={{ color: '#374151', fontSize: 12, marginBottom: 3 }}>
                Classes (comma-separated, blank = all)
              </Text>
              <TextInput
                value={classFilterText}
                onChangeText={setClassFilterText}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="person, car, bus"
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  backgroundColor: '#ffffff',
                }}
              />
            </View>
          </View>

          {cameraDevices.length > 1 && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: '#374151', fontSize: 12, marginBottom: 6 }}>Available webcams</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {cameraDevices.map((device, index) => (
                  <Pressable
                    key={device.deviceId}
                    onPress={() => void startWebcam(device.deviceId)}
                    style={{
                      borderWidth: 1,
                      borderColor: selectedCameraId === device.deviceId ? '#2563eb' : '#d1d5db',
                      backgroundColor: selectedCameraId === device.deviceId ? '#dbeafe' : '#ffffff',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                    }}
                  >
                    <Text style={{ color: '#111827', fontWeight: '700' }}>
                      {device.label || `Camera ${index + 1}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 10 }}>
            Examples: person, car, truck, bus, bicycle. Leave blank to keep every COCO class.
            Webcam detection updates about twice per second.
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            {busy && <ActivityIndicator />}
            <Text style={{ color: '#374151' }}>{status}</Text>
          </View>
          {backend && (
            <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
              TensorFlow.js backend: {backend}
            </Text>
          )}
        </View>

        {sourceMode === 'image' && image && (
          <View style={CARD}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>
                  Objects: {detections.length}
                </Text>
                <Text style={{ color: '#6b7280' }}>
                  {image.name} — {image.width} × {image.height}px
                </Text>
              </View>
              <Text style={{ color: '#6b7280', fontSize: 12 }}>Coordinates use the original image.</Text>
            </View>

            {countsByClassEntries.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {countsByClassEntries.map(([label, count]) => (
                  <View
                    key={label}
                    style={{
                      backgroundColor: '#f3f4f6',
                      borderWidth: 1,
                      borderColor: '#e5e7eb',
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: '#111827', fontWeight: '700' }}>
                      {label}: {count}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <DetectionCanvas
              uri={image.uri}
              naturalWidth={image.width}
              naturalHeight={image.height}
              detections={detections}
            />
          </View>
        )}

        {sourceMode === 'webcam' && cameraActive && (
          <View style={CARD}>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>
                Live webcam — Objects: {detections.length}
              </Text>
              {videoSize.width > 0 && (
                <Text style={{ color: '#6b7280' }}>
                  {videoSize.width} × {videoSize.height}px source coordinates
                </Text>
              )}
            </View>

            {countsByClassEntries.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {countsByClassEntries.map(([label, count]) => (
                  <View
                    key={label}
                    style={{
                      backgroundColor: '#f3f4f6',
                      borderWidth: 1,
                      borderColor: '#e5e7eb',
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: '#111827', fontWeight: '700' }}>
                      {label}: {count}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <WebcamCanvas
              stream={cameraStream}
              detections={detections}
              onVideoElement={setVideoElement}
              onVideoSize={(width, height) => setVideoSize({ width, height })}
            />
          </View>
        )}

        <View style={CARD}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>Detection output</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={copyJson}
                style={{ backgroundColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text style={{ fontWeight: '700', color: '#111827' }}>Copy JSON</Text>
              </Pressable>
              <Pressable
                onPress={downloadJson}
                style={{ backgroundColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text style={{ fontWeight: '700', color: '#111827' }}>Download JSON</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView horizontal style={{ marginTop: 12 }}>
            <Text
              selectable
              style={{
                fontFamily: Platform.select({ web: 'monospace', default: 'monospace' }),
                backgroundColor: '#111827',
                color: '#e5e7eb',
                padding: 14,
                borderRadius: 10,
                minWidth: 620,
                lineHeight: 19,
              }}
            >
              {outputText}
            </Text>
          </ScrollView>
        </View>
      </View>
    </ScrollView>
  );
}
