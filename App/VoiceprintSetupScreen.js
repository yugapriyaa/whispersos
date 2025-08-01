import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Animated, Dimensions, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from './AuthContext';

const WAVEFORM_BARS = 40;
const WAVEFORM_WIDTH = 220;
const WAVEFORM_HEIGHT = 60;

export default function VoiceprintSetupScreen({ navigation }) {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [sound, setSound] = useState(null);
  const [waveform, setWaveform] = useState(Array(WAVEFORM_BARS).fill(2));
  const [isSaving, setIsSaving] = useState(false);
  const waveformAnim = useRef(new Animated.Value(0)).current;
  const recordingUri = useRef(null);
  const waveformInterval = useRef(null);

  // Helper to get random amplitude for visual effect
  const getRandomAmplitude = () => Math.floor(Math.random() * (WAVEFORM_HEIGHT / 2)) + 4;

  // Start recording
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setHasRecording(false);
      // Start waveform animation
      waveformInterval.current = setInterval(() => {
        setWaveform((prev) => {
          const next = prev.slice(1);
          next.push(getRandomAmplitude());
          return next;
        });
      }, 60);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      if (!recording) return;
      clearInterval(waveformInterval.current);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingUri.current = uri;
      console.log('Recording stopped. URI:', uri); // Debug log
      setRecording(null);
      setIsRecording(false);
      setHasRecording(true);
      setWaveform(Array(WAVEFORM_BARS).fill(2));
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  // Play back the recording
  const handleReplay = async () => {
    if (!recordingUri.current) {
      console.log('No recording URI available for playback'); // Debug log
      return;
    }
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      console.log('Attempting to play URI:', recordingUri.current); // Debug log
      const { sound: playbackSound } = await Audio.Sound.createAsync({ uri: recordingUri.current });
      setSound(playbackSound);
      await playbackSound.playAsync();
    } catch (err) {
      console.error('Failed to play sound', err); // Debug log
    }
  };

  // Re-record
  const handleReRecord = () => {
    setIsRecording(false);
    setHasRecording(false);
    setRecording(null);
    recordingUri.current = null;
    setWaveform(Array(WAVEFORM_BARS).fill(2));
  };

  // Save voice sample to Firebase Storage
  const saveVoiceSample = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save your voice sample');
      return;
    }
    
    if (!recordingUri.current) {
      Alert.alert('Error', 'No recording available. Please record your voice sample first.');
      return;
    }

    setIsSaving(true);
    try {
      // Convert URI to blob
      const response = await fetch(recordingUri.current);
      if (!response.ok) {
        throw new Error('Failed to fetch recording file');
      }
      const blob = await response.blob();
      
      // Create a reference to the voice sample in Firebase Storage
      const voiceSampleRef = ref(storage, `voiceprints/${user.uid}/voice_sample.m4a`);
      
      // Upload the blob to Firebase Storage
      const uploadResult = await uploadBytes(voiceSampleRef, blob);
      console.log('Upload completed:', uploadResult);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(voiceSampleRef);
      
      console.log('Voice sample saved successfully:', downloadURL);
      Alert.alert('Success', 'Voice sample saved successfully!');
      
      // Navigate to home screen
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error saving voice sample:', error);
      Alert.alert('Error', `Failed to save voice sample: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle record button
  const handleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Clean up sound on unmount
  React.useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      clearInterval(waveformInterval.current);
    };
  }, [sound]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set Up Your Voiceprint</Text>
      <Text style={styles.instructions}>Press the button below and say your chosen phrase clearly to record your unique voice sample.</Text>
      {/* Waveform visual */}
      <View style={styles.waveformContainer}>
        {waveform.map((amp, i) => (
          <View
            key={i}
            style={[
              styles.waveBar,
              {
                height: amp,
                backgroundColor: isRecording ? '#FF3B30' : '#007AFF',
              },
            ]}
          />
        ))}
      </View>
      <TouchableOpacity
        style={[styles.recordButton, isRecording && styles.recording]}
        onPress={handleRecord}
      >
        <Text style={styles.recordButtonText}>{isRecording ? 'Stop' : 'Record'}</Text>
      </TouchableOpacity>
      <View style={styles.optionsRow}>
        <TouchableOpacity onPress={handleReplay} disabled={!hasRecording} style={styles.optionButton}>
          <Text style={[styles.optionText, !hasRecording && styles.disabledText]}>Replay</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleReRecord} disabled={!hasRecording} style={styles.optionButton}>
          <Text style={[styles.optionText, !hasRecording && styles.disabledText]}>Re-record</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.ctaButton, (!hasRecording || isSaving) && styles.disabledButton]}
        onPress={saveVoiceSample}
        disabled={!hasRecording || isSaving}
      >
        <Text style={styles.ctaText}>{isSaving ? 'Saving...' : 'Continue'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setShowTooltip(true)}>
        <Text style={styles.tooltipText}>What happens to my voice sample?</Text>
      </TouchableOpacity>
      <Modal visible={showTooltip} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.tooltipModal}>
            <Text style={styles.tooltipModalText}>
              Stored securely using on-device AI with Gemma 3n.
            </Text>
            <TouchableOpacity onPress={() => setShowTooltip(false)}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#222',
    textAlign: 'center',
  },
  instructions: {
    fontSize: 16,
    color: '#555',
    marginBottom: 24,
    textAlign: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: WAVEFORM_WIDTH,
    height: WAVEFORM_HEIGHT,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  waveBar: {
    width: WAVEFORM_WIDTH / WAVEFORM_BARS - 2,
    marginHorizontal: 1,
    borderRadius: 2,
  },
  recordButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    marginBottom: 16,
  },
  recording: {
    backgroundColor: '#FF3B30',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  optionsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  optionButton: {
    marginHorizontal: 12,
  },
  optionText: {
    fontSize: 16,
    color: '#007AFF',
  },
  disabledText: {
    color: '#aaa',
  },
  ctaButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginBottom: 16,
  },
  disabledButton: {
    backgroundColor: '#aaa',
  },
  ctaText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tooltipText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
    fontSize: 14,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipModal: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 300,
  },
  tooltipModalText: {
    fontSize: 16,
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  closeModalText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 