import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from './firebaseConfig';
import { registerBackgroundRecording, unregisterBackgroundRecording, isBackgroundRecordingRegistered } from './BackgroundRecordingService';

export default function HomeScreen() {
  const [status, setStatus] = useState('Voice Monitoring Active');
  const [location, setLocation] = useState('Unknown');
  const [battery, setBattery] = useState('Good');
  const [connectivity, setConnectivity] = useState('Online');
  const [tracking, setTracking] = useState(true);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [lastUpload, setLastUpload] = useState('Never');
  const [backgroundTaskRegistered, setBackgroundTaskRegistered] = useState(false);
  
  const locationSubscription = useRef(null);
  const recordingInterval = useRef(null);
  const audioRecording = useRef(null);

  // Request audio and location permissions
  useEffect(() => {
    (async () => {
      // Request audio permissions
      const audioPermission = await Audio.requestPermissionsAsync();
      if (audioPermission.status !== 'granted') {
        Alert.alert('Permission Required', 'Audio permission is required for voice monitoring.');
        setStatus('Audio Permission Denied');
        return;
      }

      // Request location permissions
      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (locationPermission.status !== 'granted') {
        setLocation('Permission denied');
        setTracking(false);
        return;
      }

      // Configure audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });

      // Check if background task is registered
      const isRegistered = await isBackgroundRecordingRegistered();
      setBackgroundTaskRegistered(isRegistered);

      // Start monitoring
      startVoiceMonitoring();
    })();

    return () => {
      stopVoiceMonitoring();
    };
  }, []);

  // Start voice monitoring
  const startVoiceMonitoring = async () => {
    try {
      setIsRecording(true);
      setStatus('Voice Monitoring Active');
      
      // Register background task if not already registered
      if (!backgroundTaskRegistered) {
        await registerBackgroundRecording();
        setBackgroundTaskRegistered(true);
      }
      
      // Start location tracking
      if (tracking) {
        locationSubscription.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000 },
          (loc) => {
            const locString = `Lat: ${loc.coords.latitude.toFixed(4)}, Lon: ${loc.coords.longitude.toFixed(4)}`;
            setLocation(locString);
            console.log('Location update:', locString);
          }
        );
      }

      // Start recording cycle
      startRecordingCycle();
    } catch (error) {
      console.error('Error starting voice monitoring:', error);
      setStatus('Monitoring Error');
    }
  };

  // Stop voice monitoring
  const stopVoiceMonitoring = async () => {
    setIsRecording(false);
    setStatus('Voice Monitoring Stopped');
    
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }
    
    if (audioRecording.current) {
      audioRecording.current.stopAndUnloadAsync();
      audioRecording.current = null;
    }

    // Unregister background task
    if (backgroundTaskRegistered) {
      await unregisterBackgroundRecording();
      setBackgroundTaskRegistered(false);
    }
  };

  // Start recording cycle (record for 8 seconds, upload for 2 seconds)
  const startRecordingCycle = () => {
    recordingInterval.current = setInterval(async () => {
      try {
        // Get current location first
        let currentLocation = location;
        try {
          const locationResult = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeout: 5000,
          });
          currentLocation = `Lat: ${locationResult.coords.latitude.toFixed(4)}, Lon: ${locationResult.coords.longitude.toFixed(4)}`;
          setLocation(currentLocation);
        } catch (error) {
          console.error('Error getting location for recording:', error);
          // Use last known location if available
          if (location === 'Unknown') {
            currentLocation = 'Location unavailable';
          }
        }

        // Start recording
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        audioRecording.current = recording;
        
        // Record for 8 seconds
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Stop recording
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        
        // Upload to Firebase with location
        await uploadRecordingToFirebase(uri, currentLocation);
        
        // Update last upload time
        const now = new Date();
        setLastUpload(now.toLocaleTimeString());
        
      } catch (error) {
        console.error('Error in recording cycle:', error);
      }
    }, 10000); // 10 second intervals
  };

  // Upload recording to Firebase Storage
  const uploadRecordingToFirebase = async (audioUri, currentLocation) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error('No authenticated user');
        return;
      }

      const timestamp = new Date().toISOString();
      const audioFileName = `voice_recording_${user.uid}_${timestamp}.m4a`;
      const locationFileName = `location_data_${user.uid}_${timestamp}.json`;
      
      // Delete previous recording and location first
      await deletePreviousRecording(user.uid);
      await deletePreviousLocation(user.uid);
      
      // Upload audio recording
      const audioStorageRef = ref(storage, `voice_recordings/${user.uid}/${audioFileName}`);
      const audioResponse = await fetch(audioUri);
      const audioBlob = await audioResponse.blob();
      const audioUploadResult = await uploadBytes(audioStorageRef, audioBlob);
      const audioDownloadURL = await getDownloadURL(audioUploadResult.ref);
      
      // Upload location data
      const locationData = {
        userId: user.uid,
        timestamp: timestamp,
        location: currentLocation,
        source: 'foreground'
      };
      
      const locationStorageRef = ref(storage, `location_data/${user.uid}/${locationFileName}`);
      const locationBlob = new Blob([JSON.stringify(locationData, null, 2)], { type: 'application/json' });
      const locationUploadResult = await uploadBytes(locationStorageRef, locationBlob);
      const locationDownloadURL = await getDownloadURL(locationUploadResult.ref);
      
      // Create combined metadata
      const metadata = {
        userId: user.uid,
        timestamp: timestamp,
        location: currentLocation,
        audioUrl: audioDownloadURL,
        locationUrl: locationDownloadURL,
        audioFileName: audioFileName,
        locationFileName: locationFileName,
        source: 'foreground'
      };
      
      console.log('Recording and location uploaded successfully:', metadata);
      
    } catch (error) {
      console.error('Error uploading recording and location:', error);
    }
  };

  // Delete previous recording
  const deletePreviousRecording = async (userId) => {
    try {
      const { listAll, deleteObject } = await import('firebase/storage');
      const userRecordingsRef = ref(storage, `voice_recordings/${userId}`);
      
      // List all recordings for this user
      const result = await listAll(userRecordingsRef);
      
      // Delete all existing recordings
      for (const item of result.items) {
        const recordingRef = ref(storage, `voice_recordings/${userId}/${item.name}`);
        await deleteObject(recordingRef);
        console.log(`Deleted previous recording: ${item.name}`);
      }
      
      if (result.items.length > 0) {
        console.log(`Deleted ${result.items.length} previous recording(s)`);
      }
      
    } catch (error) {
      console.error('Error deleting previous recording:', error);
    }
  };

  // Delete previous location data
  const deletePreviousLocation = async (userId) => {
    try {
      const { listAll, deleteObject } = await import('firebase/storage');
      const userLocationRef = ref(storage, `location_data/${userId}`);
      
      // List all location files for this user
      const result = await listAll(userLocationRef);
      
      // Delete all existing location files
      for (const item of result.items) {
        const locationRef = ref(storage, `location_data/${userId}/${item.name}`);
        await deleteObject(locationRef);
        console.log(`Deleted previous location: ${item.name}`);
      }
      
      if (result.items.length > 0) {
        console.log(`Deleted ${result.items.length} previous location file(s)`);
      }
      
    } catch (error) {
      console.error('Error deleting previous location:', error);
    }
  };

  // Extract timestamp from filename
  const extractTimestampFromFileName = (fileName) => {
    try {
      // Extract timestamp from filename format: voice_recording_uid_timestamp.m4a
      const timestampMatch = fileName.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
      return timestampMatch ? timestampMatch[1] : new Date().toISOString();
    } catch (error) {
      console.error('Error extracting timestamp from filename:', error);
      return new Date().toISOString();
    }
  };

  // Placeholder handlers
  const handleTestCall = () => Alert.alert('Emergency Call', 'This would trigger an emergency call.');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WhisperSOS Dashboard</Text>
      <View style={styles.statusBox}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={styles.statusValue}>{status}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Last Synced Location:</Text>
        <Text style={styles.infoValue}>{location}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Battery:</Text>
        <Text style={styles.infoValue}>{battery}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Connectivity:</Text>
        <Text style={styles.infoValue}>{connectivity}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Last Upload:</Text>
        <Text style={styles.infoValue}>{lastUpload}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Recording:</Text>
        <Text style={styles.infoValue}>{isRecording ? 'Active' : 'Inactive'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Background Task:</Text>
        <Text style={styles.infoValue}>{backgroundTaskRegistered ? 'Registered' : 'Not Registered'}</Text>
      </View>
      <View style={styles.optionsBox}>
        <TouchableOpacity style={styles.optionButton} onPress={handleTestCall}>
          <Text style={styles.optionText}>Emergency Call</Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#222',
  },
  statusBox: {
    backgroundColor: '#e6f7ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  statusValue: {
    fontSize: 18,
    color: '#222',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  infoLabel: {
    fontSize: 15,
    color: '#555',
    flex: 1,
  },
  infoValue: {
    fontSize: 15,
    color: '#222',
    flex: 1,
    textAlign: 'right',
  },
  optionsBox: {
    marginTop: 32,
    width: '100%',
    alignItems: 'center',
  },
  optionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 16,
    width: '90%',
    alignItems: 'center',
  },
  optionText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
}); 