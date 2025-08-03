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
- **AI Services**: Hugging Face API, SpeechBrain
- **Audio Processing**: Web Audio API
- **Maps**: Google Maps Integration
- **Styling**: CSS3 with responsive design
- **Deployment**: Firebase Hosting

### Backend Services
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Hosting
- **Functions**: Firebase Cloud Functions

## 🚨 Emergency Response Workflow

1. **Detection**: Mobile app continuously monitors voice input
2. **Upload**: Audio files automatically uploaded to Firebase
3. **Transcription**: Web portal processes audio with AI models
4. **Analysis**: Multiple AI models analyze for emergency indicators
5. **Verification**: Voice print matching confirms user identity
6. **Alert**: Automated notifications to emergency services
7. **Response**: Real-time coordination through web dashboard

## 📋 Prerequisites

### Mobile Development
- Node.js 18+
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Web Development
- Node.js 18+
- npm or yarn
- Modern web browser
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

## 🔒 Security Features

- **Encrypted Storage**: All sensitive data encrypted at rest
- **Secure Authentication**: Firebase Auth with multi-factor support
- **API Security**: Rate limiting and token-based access
- **Data Privacy**: GDPR-compliant data handling
- **Audit Logging**: Comprehensive activity tracking

## 📊 Performance Optimization

- **Background Processing**: Efficient mobile resource usage
- **Audio Compression**: Optimized file sizes for upload
- **Caching**: Intelligent data caching for faster response
- **Lazy Loading**: On-demand component loading
- **CDN Integration**: Global content delivery

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

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
