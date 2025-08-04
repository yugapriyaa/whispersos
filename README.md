# WhisperSOS - Voice-Activated Emergency Response System (Prototype)

[![React Native](https://img.shields.io/badge/React%20Native-0.79.5-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-53.0.20-blue.svg)](https://expo.dev/)
[![React](https://img.shields.io/badge/React-19.1.0-blue.svg)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12.0.0-orange.svg)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Prototype-orange.svg)](https://github.com/yourusername/whispersoscursor)

**⚠️ PROTOTYPE WARNING: This is a research prototype and should not be used in production emergency situations. This system is for demonstration and development purposes only.**

WhisperSOS is a **prototype** emergency response system that demonstrates the concept of combining voice monitoring, AI-powered transcription, and automated emergency alerts. The system consists of a mobile application for continuous voice monitoring and a web portal for real-time emergency management and response coordination.

## 🚀 Features

### Mobile Application (React Native/Expo)
- **Continuous Voice Monitoring**: Background audio recording with automatic upload
- **Real-time Location Tracking**: GPS coordinates for emergency response
- **Background Processing**: Persistent monitoring even when app is minimized
- **Emergency Detection**: AI-powered voice analysis for SOS detection
- **Battery Optimization**: Efficient power management for extended monitoring
- **Offline Capability**: Local storage with sync when connectivity returns

### Web Portal (React)
- **Real-time Audio Processing**: Live transcription of uploaded voice recordings
- **AI-Powered Analysis**: Multiple AI models for emergency detection:
  - Hugging Face Whisper for speech-to-text
  - Gemma for semantic analysis
  - SpeechBrain for voice matching
- **Emergency Dashboard**: Centralized monitoring and alert management
- **Automated Response System**: 
  - Emergency services notification
  - Police station alerts
  - Contact list notifications
- **Voice Print Matching**: User identification through voice analysis
- **Interactive Maps**: Location visualization for emergency response

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Firebase      │    │   Web Portal    │
│   (React Native)│◄──►│   (Backend)     │◄──►│   (React)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   Voice Recording         Data Storage          Emergency Dashboard
   Location Tracking       Audio Files          AI Analysis
   Background Processing   User Profiles        Alert Management
```
Web app 

<img width="725" height="323" alt="image" src="https://github.com/user-attachments/assets/4716cdd3-b940-459c-8ca2-c0ca3dabb40f" />


## 📱 Mobile Application

### Key Components
- **HomeScreen**: Main monitoring interface with status indicators
- **BackgroundRecordingService**: Persistent audio recording service
- **VoiceprintSetupScreen**: User voice sample collection
- **AuthScreen**: User authentication and onboarding
- **Location Services**: Real-time GPS tracking

### Permissions Required
- **Microphone**: Voice monitoring and recording
- **Location**: Emergency tracking and metadata
- **Background Processing**: Continuous monitoring
- **Storage**: Local audio file management

### Setup Instructions
```bash
cd App
npm install
npx expo start
```

## 🌐 Web Portal

### Key Features
- **Audio Transcription**: Real-time speech-to-text conversion
- **Emergency Detection**: Multi-model AI analysis for SOS detection
- **Voice Matching**: User identification through voice patterns
- **Alert Management**: Automated emergency response coordination
- **Data Visualization**: Interactive maps and status dashboards

### AI Models Integration
- **Hugging Face Whisper**: High-accuracy speech transcription
- **Gemma**: Semantic analysis for emergency detection
- **SpeechBrain**: Voice print matching and analysis
- **Fallback Systems**: Multiple redundancy layers for reliability

### Setup Instructions
```bash
cd Portal
npm install
npm start
```

## 🔧 Technology Stack

### Mobile Application
- **Framework**: React Native with Expo
- **Audio Processing**: Expo AV
- **Location Services**: Expo Location
- **Background Tasks**: Expo Task Manager
- **Storage**: AsyncStorage + Firebase Storage
- **Authentication**: Firebase Auth

### Web Portal
- **Framework**: React 19
- **AI Services**: Gemma 3n 4B, Hugging Face API, SpeechBrain
- **Maps**: Google Maps Integration
- **Styling**: CSS3 with responsive design
- **Deployment**: Firebase Hosting

### Backend Services
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Hosting

## 🚨 Emergency Response Workflow

1. **Mobile app - Gathering audio input for voiceprint creation**: User voice data is captured at setup to enable secure voiceprint identification
2. **Upload**: Audio files automatically uploaded to Firebase
3. **Mobile app monitoring**: Actively listens to messages and updates firebase every 10 seconds
4. **Web portal Monitoring**: Web portal actively listens for SOS messages
5. **Web portal Detection**: Detects a new message from firebase
6. **Transcription**: Web portal processes audio with Whisper
7. **Analysis**: Gemma 3n 4B is used to analyze for emergency indicators
8. **Verification**: Voice print matching by Gemma 3n 4B and SpeechBrain for user identity confirmation
9. **Alert**: Automated notifications to emergency services
10. **Location**: Maps display the last known location of the user for emergency tracking
11. **Live Dashboard for Emergency Coordination**: Real-time coordination through web dashboard

## 📋 Prerequisites

### Mobile Development
- Node.js 18+
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Web Development
- Node.js 18+
- npm
- React v19.1.0
- Firebase v12.0.0
- Web browser
- Hugging Face API token

### Environment Variables
Create `.env` files in both directories with:

**Portal/.env:**
```
REACT_APP_HUGGING_FACE_TOKEN=your_hugging_face_token
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id
```

**App/.env:**
```
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
```

## 🛠️ Installation

### Clone the Repository
```bash
git clone https://github.com/yourusername/whispersoscursor.git
cd whispersoscursor
```

### Mobile Application Setup
```bash
cd App
npm install
cp env-template.txt .env
npx expo start
```

### Web Portal Setup
```bash
cd Portal
npm install
cp env-template.txt .env
npm start
```
## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

This project builds upon the following open-source technologies:

- **Speech Recognition**: OpenAI Whisper (MIT License)
- **Language Models**: Google Gemma 3n (Google Gemma License)
- **Voice Processing**: SpeechBrain (Apache 2.0)
- **Cloud Platform**: Firebase (Apache 2.0)
- **Frontend Framework**: React.js (MIT License)
- **Maps Integration**: Google Maps Platform

All technologies are used in compliance with their respective licenses.

## 🆘 Emergency Use

**⚠️ CRITICAL WARNING**: This is a **prototype system** and should **NOT** be used in actual emergency situations. This system is for:

- **Research and development purposes only**
- **Educational demonstrations**
- **Proof of concept validation**
- **Academic study and learning**

**For actual emergencies, always:**
- Call emergency services directly (911, 112, etc.)
- Use established, certified emergency response systems
- Follow official emergency protocols
- Do not rely on prototype or experimental systems


---

## 📋 Prototype Status

This project is currently in **prototype/development phase**. Key limitations include:

- **Not production-ready**: System has not undergone comprehensive testing
- **Limited reliability**: AI models may have accuracy limitations
- **No certification**: Not certified for emergency use by any authority
- **Experimental features**: Some functionality is still in development
- **Limited scalability**: Designed for demonstration, not large-scale deployment

## 🔬 Research Purpose

This prototype serves as a proof-of-concept for:
- Voice-activated emergency detection systems
- AI-powered speech analysis for safety applications
- Real-time emergency response coordination
- Mobile-to-web emergency communication systems

**Disclaimer**: This prototype system is for research and demonstration purposes only. It should not replace direct emergency services contact. Always call emergency services (911, 112, etc.) in life-threatening situations. This system has not been tested, certified, or approved for production emergency use. 
