import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import SettingsBar from './components/SettingsBar';
import HomeScreen from './screens/HomeScreen';

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: '#f6f7f9' }}>
      <StatusBar style="light" />
      <SettingsBar />
      <HomeScreen />
    </View>
  );
}
