import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Audio } from 'expo-av';
import { storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { auth } from './firebaseConfig';
import * as Location from 'expo-location';

const BACKGROUND_RECORDING_TASK = 'background-recording-task';

// Define the background task
TaskManager.defineTask(BACKGROUND_RECORDING_TASK, async () => {
  try {
    console.log('Background recording task started');
    
    // Check if user is authenticated
    const user = auth.currentUser;
    if (!user) {
      console.log('No authenticated user in background task');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Get current location
    let currentLocation = 'Unknown';
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 5000,
      });
      currentLocation = `Lat: ${location.coords.latitude.toFixed(4)}, Lon: ${location.coords.longitude.toFixed(4)}`;
    } catch (error) {
      console.error('Error getting location in background:', error);
      currentLocation = 'Location unavailable';
    }

    // Record audio
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    // Record for 8 seconds
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Stop recording
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();

    // Upload to Firebase
    await uploadRecordingToFirebase(uri, currentLocation);

    console.log('Background recording completed successfully');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Error in background recording task:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Upload recording to Firebase Storage
const uploadRecordingToFirebase = async (audioUri, currentLocation) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No authenticated user');
      return;
    }

    const timestamp = new Date().toISOString();
    const audioFileName = `background_recording_${user.uid}_${timestamp}.m4a`;
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
      source: 'background'
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
      source: 'background'
    };
    
    console.log('Background recording and location uploaded successfully:', metadata);
    
  } catch (error) {
    console.error('Error uploading background recording and location:', error);
  }
};

// Delete previous recording
const deletePreviousRecording = async (userId) => {
  try {
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

// Register background task
export const registerBackgroundRecording = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_RECORDING_TASK, {
      minimumInterval: 10, // 10 seconds
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('Background recording task registered');
  } catch (error) {
    console.error('Error registering background task:', error);
  }
};

// Unregister background task
export const unregisterBackgroundRecording = async () => {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_RECORDING_TASK);
    console.log('Background recording task unregistered');
  } catch (error) {
    console.error('Error unregistering background task:', error);
  }
};

// Check if background task is registered
export const isBackgroundRecordingRegistered = async () => {
  try {
    const tasks = await TaskManager.getRegisteredTasksAsync();
    return tasks.some(task => task.taskName === BACKGROUND_RECORDING_TASK);
  } catch (error) {
    console.error('Error checking background task registration:', error);
    return false;
  }
}; 