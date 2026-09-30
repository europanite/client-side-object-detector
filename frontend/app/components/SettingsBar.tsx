import React from 'react';
import { Text, View } from 'react-native';

export default function SettingsBar() {
  return (
    <View
      style={{
        backgroundColor: '#111827',
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 14,
      }}
    >
      <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center' }}>
        <Text style={{ color: '#ffffff', fontSize: 21, fontWeight: '800' }}>
          Browser Object Detector
        </Text>
        <Text style={{ color: '#cbd5e1', marginTop: 4 }}>
          Browser-only object detection. Images and webcam frames stay on your device.
        </Text>
      </View>
    </View>
  );
}
