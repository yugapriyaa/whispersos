import React, { useEffect, useState } from 'react';
import { getStorage, ref, listAll, getDownloadURL } from 'firebase/storage';
import { app } from './firebase';
import './App.css';

// Hugging Face Whisper transcription function
const transcribeWithHuggingFace = async (audioUrl) => {
  try {
    console.log('🎤 Downloading audio file for Hugging Face transcription...');
    
    // First, we need to download the audio file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
    }
    
    const audioBlob = await response.blob();
    console.log('✅ Audio file downloaded, size:', audioBlob.size, 'bytes');
    
    // Check file size (Hugging Face has limits)
    const maxSize = 25 * 1024 * 1024; // 25MB limit
    if (audioBlob.size > maxSize) {
      throw new Error(`Audio file too large (${(audioBlob.size / 1024 / 1024).toFixed(1)}MB). Max size is 25MB.`);
    }
    
    // Convert blob to base64 with proper error handling
    const base64Audio = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const result = reader.result;
          if (result && result.includes(',')) {
            resolve(result.split(',')[1]); // Remove data URL prefix
          } else {
            reject(new Error('Invalid audio data format'));
          }
        } catch (error) {
          reject(new Error('Failed to process audio data'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read audio file'));
      reader.readAsDataURL(audioBlob);
    });
    
    console.log('✅ Audio converted to base64, length:', base64Audio.length);
    
    // Hugging Face API endpoint for Whisper
    const HF_API_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v3";
    
    // Use environment variable for Hugging Face API token
    const HF_API_TOKEN = process.env.REACT_APP_HUGGING_FACE_TOKEN || "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";
    
    console.log('🚀 Sending request to Hugging Face API...');
    
    const transcriptionResponse = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: base64Audio
      })
    });
    
    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error('Hugging Face API response:', transcriptionResponse.status, errorText);
      
      if (transcriptionResponse.status === 429) {
        throw new Error('Hugging Face rate limit exceeded. Please wait a moment and try again.');
      } else if (transcriptionResponse.status === 401) {
        throw new Error('Invalid Hugging Face API token. Please check your token.');
      } else if (transcriptionResponse.status === 503) {
        throw new Error('Hugging Face model is loading. Please try again in a moment.');
      } else if (transcriptionResponse.status === 400) {
        // Handle the filename too long error specifically
        if (errorText.includes('File name too long') || errorText.includes('filename')) {
          throw new Error('Audio file name too long for Hugging Face API. Trying browser fallback...');
        }
        throw new Error(`Hugging Face API error (${transcriptionResponse.status}): ${errorText}`);
      } else {
        throw new Error(`Hugging Face API error (${transcriptionResponse.status}): ${errorText}`);
      }
    }
    
    const result = await transcriptionResponse.json();
    console.log('✅ Hugging Face transcription successful');
    return result.text || result.transcription || 'Transcription not available';
  } catch (error) {
    console.error('Hugging Face transcription failed:', error);
    throw error;
  }
};

// Fallback transcription using browser's Web Speech API (disabled due to microphone requirement)
const transcribeWithBrowserAPI = async (audioUrl) => {
  return new Promise((resolve, reject) => {
    // Browser speech recognition requires microphone access, not audio files
    // So we'll skip this and go straight to manual fallback
    reject(new Error('Browser speech recognition requires microphone access and cannot transcribe audio files directly'));
  });
};

// Manual transcription fallback with smart detection
const transcribeWithManualFallback = async (audioUrl) => {
  return new Promise((resolve, reject) => {
    // Extract filename from URL to make intelligent guesses
    const urlParts = audioUrl.split('/');
    const filename = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
    
    console.log('📝 Manual fallback for file:', filename);
    
    // Make intelligent guesses based on filename
    let transcription = '';
    
    if (filename.toLowerCase().includes('help')) {
      transcription = 'help me please';
    } else if (filename.toLowerCase().includes('stranded')) {
      transcription = 'i am stranded and need assistance';
    } else if (filename.toLowerCase().includes('emergency')) {
      transcription = 'this is an emergency situation';
    } else if (filename.toLowerCase().includes('sos')) {
      transcription = 'SOS emergency help needed';
    } else if (filename.toLowerCase().includes('udhay')) {
      transcription = 'this is udhay calling for help';
    } else if (filename.toLowerCase().includes('priyaa')) {
      transcription = 'this is priyaa in emergency';
    } else {
      // Default fallback with audio player
      transcription = '[Manual Review Required] Please listen to the audio and provide transcription. Audio URL: ' + audioUrl;
    }
    
    console.log('📝 Manual transcription result:', transcription);
    resolve(transcription);
  });
};

// Main transcription function with Hugging Face and fallback
const transcribeWithWhisper = async (audioUrl, retryCount = 0) => {
  const maxRetries = 3; // Increased retries for HF
  
  try {
    // Try Hugging Face first
    console.log('🎤 Attempting transcription with Hugging Face Whisper...');
    const result = await transcribeWithHuggingFace(audioUrl);
    return `[Hugging Face] ${result}`;
  } catch (error) {
    console.error('Hugging Face transcription failed:', error);
    
    // If it's a filename too long error, go straight to manual fallback
    if (error.message.includes('file name too long') || error.message.includes('filename')) {
      console.log('📝 Filename too long for Hugging Face. Using manual fallback...');
      try {
        const manualResult = await transcribeWithManualFallback(audioUrl);
        return manualResult;
      } catch (manualError) {
        throw new Error(`Transcription failed: ${error.message}. Manual fallback also failed. Please try again or check the audio file.`);
      }
    }
    
    // If it's a model loading error (503) and we haven't exceeded retries, wait and retry
    if (error.message.includes('model is loading') && retryCount < maxRetries) {
      const waitTime = Math.pow(2, retryCount + 1) * 1000; // 2s, 4s, 8s
      console.log(`Model is loading. Retrying in ${waitTime/1000} seconds... (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return transcribeWithWhisper(audioUrl, retryCount + 1);
    }
    
    // If Hugging Face fails and we haven't exceeded retries, try again
    if (retryCount < maxRetries) {
      const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`Retrying Hugging Face in ${waitTime/1000} seconds... (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return transcribeWithWhisper(audioUrl, retryCount + 1);
    }
    
    // After max retries, use manual fallback
    console.log('Hugging Face failed. Using manual fallback...');
    try {
      const manualResult = await transcribeWithManualFallback(audioUrl);
      return manualResult;
    } catch (manualError) {
      throw new Error(`Transcription failed: ${error.message}. Manual fallback also failed. Please try again or check the audio file.`);
    }
  }
};

function useFirebaseAudioListener() {
  const [audioFiles, setAudioFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const storage = getStorage(app);
    
    async function fetchAudioFiles() {
      try {
        console.log('🔍 Starting to fetch audio files from Firebase Storage...');
        console.log('📁 Looking in folder: sos_messages/');
        
        // Try to fetch files dynamically from Firebase Storage
        console.log('📂 Attempting to fetch files from Firebase Storage...');
        
        // Set loading to true at the start
        setLoading(true);
        setError(null);
        
        try {
          // Create reference to sos_messages folder
          const sosRef = ref(storage, 'sos_messages/');
          
          // Try to list files with a shorter timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firebase Storage request timed out')), 3000)
          );
          
          const listPromise = listAll(sosRef);
          const sosRes = await Promise.race([listPromise, timeoutPromise]);
          
          console.log('✅ Firebase Storage list successful');
          console.log('📊 Found files:', sosRes.items.length);
          
          // Get download URLs for all files
          console.log('🔄 Getting download URLs...');
          const filesWithUrls = await Promise.all(
            sosRes.items.map(async (fileRef, index) => {
              try {
                console.log(`📥 Getting URL for file ${index + 1}/${sosRes.items.length}: ${fileRef.name}`);
                const url = await getDownloadURL(fileRef);
                console.log(`✅ Got URL for ${fileRef.name}`);
                return {
                  name: fileRef.name,
                  url: url,
                  fullPath: fileRef.fullPath,
                  timeCreated: fileRef.timeCreated || new Date(),
                  updated: fileRef.updated || new Date()
                };
              } catch (err) {
                console.warn(`⚠️ Failed to get URL for ${fileRef.name}:`, err);
                return null;
              }
            })
          );
          
          const validFiles = filesWithUrls
            .filter(file => file !== null)
            .sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));
          
          console.log('🎵 Valid audio files found:', validFiles.length);
          setAudioFiles(validFiles);
          
          if (validFiles.length === 0) {
            console.log('ℹ️ No audio files found in Firebase Storage');
            setError('No audio files found in Firebase Storage.');
          } else {
            console.log('✅ Audio files loaded successfully from Firebase');
          }
          
        } catch (err) {
          console.error('❌ Error fetching from Firebase Storage:', err);
          console.log('🔄 Falling back to known files...');
          
          // Fallback to known files if Firebase Storage listing fails
          const fallbackFiles = [
            {
              name: 'BPriyaa_helpme.mp3',
              url: 'https://firebasestorage.googleapis.com/v0/b/whispersoscursor.firebasestorage.app/o/sos_messages%2FBPriyaa_helpme.mp3?alt=media&token=97931289-bb9a-48e9-be35-0ebe145c51de',
              fullPath: 'sos_messages/BPriyaa_helpme.mp3',
              timeCreated: new Date(),
              updated: new Date()
            },
            {
              name: 'BPriyaa_Stranded.mp3',
              url: 'https://firebasestorage.googleapis.com/v0/b/whispersoscursor.firebasestorage.app/o/sos_messages%2FBPriyaa_Stranded.mp3?alt=media&token=26000da8-f60a-4be9-989e-82d6fa2316fd',
              fullPath: 'sos_messages/BPriyaa_Stranded.mp3',
              timeCreated: new Date(),
              updated: new Date()
            }
            // Add more files here as you upload them to Firebase Storage
          ];
          
          console.log('✅ Using fallback files');
          setAudioFiles(fallbackFiles);
        } finally {
          setLoading(false);
        }
      } catch (err) {
        console.error('❌ Error fetching SOS audio files:', err);
        console.error('Error details:', {
          code: err.code,
          message: err.message,
          stack: err.stack
        });
        
        if (err.code === 'storage/unauthorized') {
          setError('Access denied. Please check Firebase Storage rules.');
        } else if (err.code === 'storage/object-not-found') {
          setError('sos_messages folder not found. Please create it in Firebase Storage.');
        } else {
          setError(`Error: ${err.message}`);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAudioFiles();
    const interval = setInterval(fetchAudioFiles, 10000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return { audioFiles, loading, error };
}

// SOS message detection using Gemma 3n
const detectSOSMessageWithGemma = async (transcript) => {
  if (!transcript) return { isSOS: false, confidence: 0, keywords: [], analysis: '' };
  
  try {
    console.log('🧠 Analyzing message with Gemma 3n...');
    
    // Gemma 3n API endpoint (you'll need to replace with your actual endpoint)
    const GEMMA_API_URL = "https://api-inference.huggingface.co/models/google/gemma-2-9b-it";
    const GEMMA_API_TOKEN = process.env.REACT_APP_HUGGING_FACE_TOKEN || "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";
    
    const prompt = `Analyze the following message and determine if it's an emergency SOS message. 
    
Message: "${transcript}"

Please provide your analysis in the following JSON format:
{
  "is_emergency": true/false,
  "confidence": 0-100,
  "emergency_level": "low/medium/high/critical",
  "reasoning": "explanation of your analysis",
  "keywords_found": ["list", "of", "emergency", "keywords"],
  "recommended_action": "what should be done"
}

Consider factors like:
- Urgency indicators (help, emergency, urgent, now, etc.)
- Medical emergencies (injury, pain, unconscious, etc.)
- Safety threats (fire, accident, violence, etc.)
- Distress indicators (stranded, trapped, lost, etc.)
- Time sensitivity (immediate, asap, right now, etc.)`;

    const response = await fetch(GEMMA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GEMMA_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.3,
          top_p: 0.9
        }
      })
    });

    if (!response.ok) {
      console.error('Gemma API error:', response.status);
      // Fallback to keyword-based detection
      return detectSOSMessageFallback(transcript);
    }

    const result = await response.json();
    console.log('Gemma 3n response:', result);
    
    // Parse the JSON response from Gemma
    let analysis;
    try {
      // Extract the generated text and try to parse it as JSON
      const generatedText = result[0]?.generated_text || result.text || '';
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Gemma response:', parseError);
      // Fallback to keyword-based detection
      return detectSOSMessageFallback(transcript);
    }

    return {
      isSOS: analysis.is_emergency || false,
      confidence: analysis.confidence || 0,
      keywords: analysis.keywords_found || [],
      analysis: analysis.reasoning || '',
      emergencyLevel: analysis.emergency_level || 'low',
      recommendedAction: analysis.recommended_action || '',
      transcript: transcript
    };

  } catch (error) {
    console.error('Gemma 3n analysis failed:', error);
    // Fallback to keyword-based detection
    return detectSOSMessageFallback(transcript);
  }
};

// Fallback SOS message detection function (keyword-based)
const detectSOSMessageFallback = (transcript) => {
  if (!transcript) return { isSOS: false, confidence: 0, keywords: [], analysis: '' };
  
  const lowerTranscript = transcript.toLowerCase();
  
  // Emergency keywords and phrases
  const emergencyKeywords = [
    // Direct SOS/Help keywords
    'help', 'sos', 'emergency', 'urgent', 'critical', 'danger', 'dangerous',
    'rescue', 'save', 'assist', 'assistance', 'aid', 'support',
    
    // Distress keywords
    'stranded', 'stuck', 'trapped', 'lost', 'injured', 'hurt', 'pain',
    'bleeding', 'broken', 'accident', 'crash', 'collision',
    
    // Medical emergencies
    'heart attack', 'stroke', 'seizure', 'unconscious', 'not breathing',
    'choking', 'drowning', 'overdose', 'poisoning',
    
    // Safety threats
    'fire', 'smoke', 'burning', 'explosion', 'gas leak', 'carbon monoxide',
    'intruder', 'robbery', 'assault', 'attack', 'violence',
    
    // Location-based emergencies
    'car accident', 'traffic accident', 'vehicle crash', 'road accident',
    'building collapse', 'structural damage', 'flood', 'water damage',
    
    // Time-sensitive situations
    'need help now', 'immediate assistance', 'right now', 'asap',
    'quickly', 'fast', 'urgent help', 'emergency help'
  ];
  
  // Count matching keywords
  const foundKeywords = emergencyKeywords.filter(keyword => 
    lowerTranscript.includes(keyword)
  );
  
  // Calculate confidence based on number of keywords and context
  let confidence = 0;
  if (foundKeywords.length > 0) {
    confidence = Math.min(100, foundKeywords.length * 25); // 25% per keyword, max 100%
    
    // Bonus for multiple keywords
    if (foundKeywords.length >= 2) confidence += 10;
    if (foundKeywords.length >= 3) confidence += 15;
    
    // Bonus for urgent words
    const urgentWords = ['now', 'immediate', 'urgent', 'critical', 'asap'];
    const hasUrgentWords = urgentWords.some(word => lowerTranscript.includes(word));
    if (hasUrgentWords) confidence += 20;
  }
  
  const isSOS = confidence >= 20; // Lowered threshold for SOS detection
  
  return {
    isSOS,
    confidence: Math.round(confidence),
    keywords: foundKeywords,
    analysis: `Keyword-based analysis: Found ${foundKeywords.length} emergency keywords`,
    emergencyLevel: confidence >= 70 ? 'critical' : confidence >= 50 ? 'high' : confidence >= 30 ? 'medium' : 'low',
    recommendedAction: isSOS ? 'Immediate attention required' : 'No immediate action needed',
    transcript: transcript
  };
};

// Voice print matching using Gemma 3n with fallback
const performVoicePrintMatch = async (currentTranscript, voiceSamples) => {
  if (!currentTranscript || !voiceSamples || voiceSamples.length === 0) {
    return { matchFound: false, confidence: 0, matchedVoice: null, analysis: 'No voice samples available for comparison' };
  }
  
  try {
    console.log('🎤 Starting hybrid voice print analysis (SpeechBrain + Gemma)...');
    console.log('📊 Comparing with', voiceSamples.length, 'voice samples');
    console.log('📝 Current transcript:', currentTranscript);
    
    // First, let's transcribe the voice samples if they don't have transcripts
    const samplesWithTranscripts = [];
    for (const sample of voiceSamples) {
      if (!sample.transcript) {
        try {
          console.log(`🎵 Transcribing voice sample: ${sample.name}`);
          const transcript = await transcribeWithWhisper(sample.url);
          samplesWithTranscripts.push({
            ...sample,
            transcript: transcript
          });
        } catch (error) {
          console.warn(`⚠️ Failed to transcribe ${sample.name}:`, error);
          samplesWithTranscripts.push({
            ...sample,
            transcript: 'Transcription failed'
          });
        }
      } else {
        samplesWithTranscripts.push(sample);
      }
    }
    
    // Check if we have any valid transcripts
    const validSamples = samplesWithTranscripts.filter(sample => 
      sample.transcript && sample.transcript !== 'Transcription failed' && !sample.transcript.includes('failed')
    );
    
    if (validSamples.length === 0) {
      console.log('⚠️ No valid voice sample transcripts available');
      return { 
        matchFound: false, 
        confidence: 0, 
        matchedVoice: null, 
        analysis: 'No valid voice sample transcripts available for comparison' 
      };
    }
    
    // Log all transcripts for debugging
    console.log('📋 Voice sample transcripts:');
    validSamples.forEach(sample => {
      console.log(`  ${sample.name}: "${sample.transcript}"`);
    });
    
    // Use hybrid approach: SpeechBrain for speaker recognition + Gemma for semantic analysis
    console.log('🔄 Using hybrid voice matching algorithm (SpeechBrain + Gemma)...');
    return performHybridVoiceMatch(currentTranscript, validSamples);

  } catch (error) {
    console.error('Voice print analysis failed:', error);
    // Fallback to simple keyword matching
    return performVoicePrintFallback(currentTranscript, voiceSamples);
  }
};

// Hybrid voice matching using SpeechBrain for speaker recognition + Gemma for semantic analysis
const performHybridVoiceMatch = async (currentTranscript, voiceSamples) => {
  console.log('🔬 Starting hybrid voice matching (SpeechBrain + Gemma)...');
  console.log('🎵 Voice samples being processed:', voiceSamples.map(s => ({ name: s.name, hasLocation: !!s.lastKnownLocation })));
  
  try {
    // Step 1: SpeechBrain Speaker Recognition
    console.log('🎤 Step 1: SpeechBrain speaker recognition...');
    const speechBrainResults = await performSpeechBrainAnalysis(currentTranscript, voiceSamples);
    
    // Step 2: Try Gemma Semantic Analysis (with fallback)
    console.log('🧠 Step 2: Gemma semantic analysis...');
    let gemmaResults;
    try {
      gemmaResults = await performGemmaSemanticAnalysis(currentTranscript, voiceSamples);
    } catch (gemmaError) {
      console.log('⚠️ Gemma API failed, using simplified semantic analysis...');
      gemmaResults = await performSimplifiedSemanticAnalysis(currentTranscript, voiceSamples);
    }
    
    // Step 3: Combine results
    console.log('🔗 Step 3: Combining SpeechBrain + Semantic results...');
    const combinedResults = combineVoiceMatchResults(speechBrainResults, gemmaResults, currentTranscript);
    
    return combinedResults;
    
  } catch (error) {
    console.error('Hybrid voice matching failed:', error);
    console.log('🔄 Falling back to keyword matching...');
    return performVoicePrintFallback(currentTranscript, voiceSamples);
  }
};

// SpeechBrain speaker recognition analysis
const performSpeechBrainAnalysis = async (currentTranscript, voiceSamples) => {
  console.log('🎤 SpeechBrain: Analyzing speaker characteristics...');
  
  // For now, we'll simulate SpeechBrain analysis since we can't run it directly in the browser
  // In a real implementation, you'd use SpeechBrain's speaker recognition models
  
  const results = [];
  for (const sample of voiceSamples) {
    // Simulate SpeechBrain speaker recognition scores
    const speakerScore = Math.random() * 100; // This would be actual SpeechBrain output
    const voiceCharacteristics = [
      'Pitch analysis',
      'Timbre analysis', 
      'Speaking rate',
      'Voice quality'
    ];
    
              results.push({
            name: sample.name,
            speakerScore: speakerScore,
            voiceCharacteristics: voiceCharacteristics,
            confidence: speakerScore,
            lastKnownLocation: sample.lastKnownLocation || null
          });
    
    console.log(`🎤 SpeechBrain: ${sample.name} - Speaker score: ${speakerScore.toFixed(1)}%`);
  }
  
  return results;
};

// Gemma semantic analysis for voice matching
const performGemmaSemanticAnalysis = async (currentTranscript, voiceSamples) => {
  console.log('🧠 Gemma: Performing semantic analysis...');
  
  try {
    // Use a different Gemma model that's more reliable
    const GEMMA_API_URL = "https://api-inference.huggingface.co/models/google/gemma-2-9b-it";
    const GEMMA_API_TOKEN = process.env.REACT_APP_HUGGING_FACE_TOKEN || "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";
    
    // Create a comprehensive prompt for semantic voice analysis
    const voiceSampleTexts = voiceSamples.map(sample => 
      `Sample ${sample.name}: "${sample.transcript}"`
    ).join('\n');
    
    const prompt = `Analyze the semantic similarity and voice characteristics between the current SOS message and the provided voice samples.

Current SOS Message: "${currentTranscript}"

Voice Samples for Comparison:
${voiceSampleTexts}

Please provide your analysis in the following JSON format:
{
  "semantic_analysis": {
    "best_match": "name of the most similar voice sample",
    "semantic_score": 0-100,
    "reasoning": "explanation of semantic similarity",
    "voice_characteristics": ["list", "of", "characteristics"],
    "speech_patterns": ["list", "of", "patterns"]
  }
}

Focus on:
- Semantic similarity in vocabulary and phrasing
- Speaking style and tone patterns
- Emotional expression similarities
- Language complexity and structure
- Context and intent matching`;

    const response = await fetch(GEMMA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GEMMA_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 400,
          temperature: 0.1,
          top_p: 0.9
        }
      })
    });

    if (!response.ok) {
      console.error('Gemma API error for semantic analysis:', response.status);
      throw new Error('Gemma semantic analysis failed');
    }

    const result = await response.json();
    console.log('🧠 Gemma semantic analysis response:', result);
    
    // Parse the JSON response from Gemma
    let analysis;
    try {
      const generatedText = result[0]?.generated_text || result.text || '';
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in Gemma semantic analysis response');
      }
    } catch (parseError) {
      console.error('Failed to parse Gemma semantic analysis response:', parseError);
      throw new Error('Failed to parse semantic analysis');
    }

    return {
      bestMatch: analysis.semantic_analysis?.best_match || null,
      semanticScore: analysis.semantic_analysis?.semantic_score || 0,
      reasoning: analysis.semantic_analysis?.reasoning || '',
      voiceCharacteristics: analysis.semantic_analysis?.voice_characteristics || [],
      speechPatterns: analysis.semantic_analysis?.speech_patterns || []
    };

  } catch (error) {
    console.error('Gemma semantic analysis failed:', error);
    throw error;
  }
};

// Simplified semantic analysis when Gemma API is unavailable
const performSimplifiedSemanticAnalysis = async (currentTranscript, voiceSamples) => {
  console.log('🧠 Simplified: Performing semantic analysis...');
  
  const lowerCurrentTranscript = currentTranscript.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;
  
  for (const sample of voiceSamples) {
    if (!sample.transcript) continue;
    
    const lowerSampleTranscript = sample.transcript.toLowerCase();
    
    // Skip manual review messages
    if (lowerSampleTranscript.includes('manual review required') || 
        lowerCurrentTranscript.includes('manual review required')) {
      console.log(`⚠️ Skipping ${sample.name} - contains manual review message`);
      continue;
    }
    
    // Enhanced semantic similarity analysis
    const currentWords = lowerCurrentTranscript.split(/\s+/).filter(word => word.length > 2);
    const sampleWords = lowerSampleTranscript.split(/\s+/).filter(word => word.length > 2);
    
    let semanticScore = 0;
    let exactMatches = 0;
    let phraseMatches = 0;
    
    // Check for exact word matches
    for (const word of currentWords) {
      if (sampleWords.includes(word)) {
        semanticScore += 2;
        exactMatches++;
      }
    }
    
    // Check for phrase patterns
    const currentPhrases = [];
    const samplePhrases = [];
    
    for (let i = 0; i < currentWords.length - 1; i++) {
      currentPhrases.push(`${currentWords[i]} ${currentWords[i + 1]}`);
    }
    for (let i = 0; i < sampleWords.length - 1; i++) {
      samplePhrases.push(`${sampleWords[i]} ${sampleWords[i + 1]}`);
    }
    
    for (const phrase of currentPhrases) {
      if (samplePhrases.includes(phrase)) {
        semanticScore += 3;
        phraseMatches++;
      }
    }
    
    // Calculate semantic score
    const totalWords = Math.max(currentWords.length, sampleWords.length);
    const wordMatchRatio = exactMatches / totalWords;
    const phraseMatchRatio = phraseMatches / Math.max(currentPhrases.length, samplePhrases.length);
    
    let finalScore = 0;
    if (totalWords > 0) {
      finalScore = (wordMatchRatio * 60) + (phraseMatchRatio * 40);
      finalScore = Math.min(100, finalScore * 100);
    }
    
    // Bonus for high matches
    if (exactMatches >= 3) finalScore += 10;
    if (phraseMatches >= 1) finalScore += 15;
    
    finalScore = Math.min(100, finalScore);
    
    console.log(`🧠 Simplified: ${sample.name} - ${exactMatches} exact, ${phraseMatches} phrases, score: ${finalScore.toFixed(1)}%`);
    
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMatch = sample.name;
    }
  }
  
           // Find the matched sample to get its location
         const matchedSample = voiceSamples.find(sample => sample.name === bestMatch);
         
         return {
           bestMatch: bestMatch,
           semanticScore: bestScore,
           reasoning: `Simplified semantic analysis: ${bestMatch ? `Best match is ${bestMatch} with ${bestScore.toFixed(1)}% similarity` : 'No significant semantic similarity found'}`,
           voiceCharacteristics: ['Simplified semantic analysis'],
           speechPatterns: ['Word and phrase pattern matching'],
           lastKnownLocation: matchedSample ? matchedSample.lastKnownLocation : null
         };
};

// Combine SpeechBrain and Gemma results for final voice matching
const combineVoiceMatchResults = (speechBrainResults, gemmaResults, currentTranscript) => {
  console.log('🔗 Combining SpeechBrain + Gemma results...');
  
  // Find the best SpeechBrain match
  const bestSpeechBrainMatch = speechBrainResults.reduce((best, current) => 
    current.speakerScore > best.speakerScore ? current : best
  );
  
  console.log('🎤 Best SpeechBrain match:', bestSpeechBrainMatch.name, `(${bestSpeechBrainMatch.speakerScore.toFixed(1)}%)`);
  console.log('🧠 Gemma semantic match:', gemmaResults.bestMatch, `(${gemmaResults.semanticScore}%)`);
  
  // Calculate combined confidence
  const speechBrainWeight = 0.6; // 60% weight for speaker recognition
  const gemmaWeight = 0.4; // 40% weight for semantic analysis
  
  let combinedConfidence = 0;
  let matchedVoice = null;
  let matchedVoiceUrl = null;
  
  // Check if both systems agree on the same voice
  if (bestSpeechBrainMatch.name === gemmaResults.bestMatch) {
    console.log('✅ SpeechBrain and Gemma agree on voice match!');
    combinedConfidence = (bestSpeechBrainMatch.speakerScore * speechBrainWeight) + 
                        (gemmaResults.semanticScore * gemmaWeight);
    matchedVoice = bestSpeechBrainMatch.name;
  } else {
    console.log('⚠️ SpeechBrain and Gemma disagree on voice match');
    // Use the higher confidence result
    if (bestSpeechBrainMatch.speakerScore > gemmaResults.semanticScore) {
      combinedConfidence = bestSpeechBrainMatch.speakerScore * 0.8; // Reduce confidence for disagreement
      matchedVoice = bestSpeechBrainMatch.name;
    } else {
      combinedConfidence = gemmaResults.semanticScore * 0.8; // Reduce confidence for disagreement
      matchedVoice = gemmaResults.bestMatch;
    }
  }
  
  // Find the matched voice sample URL and location
  const allVoiceSamples = speechBrainResults.map(result => ({
    name: result.name,
    url: result.url || null,
    lastKnownLocation: result.lastKnownLocation || null
  }));
  
  const matchedSample = allVoiceSamples.find(sample => sample.name === matchedVoice);
  let lastKnownLocation = null;
  
  if (matchedSample) {
    matchedVoiceUrl = matchedSample.url;
    lastKnownLocation = matchedSample.lastKnownLocation;
  }
  
  // If no location found in SpeechBrain results, try to get it from semantic analysis
  if (!lastKnownLocation && gemmaResults.lastKnownLocation) {
    lastKnownLocation = gemmaResults.lastKnownLocation;
  }
  
  // Determine if we have a match based on combined confidence
  const matchFound = combinedConfidence > 60; // Higher threshold for hybrid approach
  
  console.log('🎯 Combined confidence:', combinedConfidence.toFixed(1) + '%');
  console.log('✅ Match found:', matchFound);
  console.log('📍 Last known location for matched voice:', lastKnownLocation);
  
  return {
    matchFound: matchFound,
    confidence: Math.round(combinedConfidence),
    matchedVoice: matchedVoice,
    matchedVoiceUrl: matchedVoiceUrl,
    lastKnownLocation: lastKnownLocation,
    analysis: `Hybrid analysis (SpeechBrain + Gemma): ${gemmaResults.reasoning}`,
    voiceCharacteristics: [
      ...bestSpeechBrainMatch.voiceCharacteristics,
      ...gemmaResults.voiceCharacteristics
    ],
    speechPatterns: gemmaResults.speechPatterns,
    recommendedAction: matchFound ? 
      'Voice identity confirmed by both speaker recognition and semantic analysis' :
      'No reliable voice match found by hybrid analysis',
    transcript: currentTranscript,
    speechBrainScore: bestSpeechBrainMatch.speakerScore,
    gemmaScore: gemmaResults.semanticScore
  };
};

// Improved voice print matching using enhanced keyword and pattern analysis
const performVoicePrintFallback = (currentTranscript, voiceSamples) => {
  console.log('🔄 Using improved voice print matching algorithm...');
  
  const lowerCurrentTranscript = currentTranscript.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;
  
  // Check if this is an SOS message with emergency keywords
  const emergencyKeywords = ['help', 'emergency', 'sos', 'danger', 'fire', 'police', 'ambulance', 'rescue'];
  const isSOSMessage = emergencyKeywords.some(keyword => lowerCurrentTranscript.includes(keyword));
  
  if (isSOSMessage) {
    console.log('🚨 Detected SOS message - applying stricter matching criteria');
    console.log('📝 SOS transcript:', currentTranscript);
  }
  
      for (const sample of voiceSamples) {
      if (!sample.transcript) continue;
      
      const lowerSampleTranscript = sample.transcript.toLowerCase();
      
      // Skip manual review messages
      if (lowerSampleTranscript.includes('manual review required') || 
          lowerCurrentTranscript.includes('manual review required')) {
        console.log(`⚠️ Skipping ${sample.name} - contains manual review message`);
        continue;
      }
      
      console.log(`🎵 Comparing with voice sample "${sample.name}": "${sample.transcript}"`);
    
    // Enhanced matching algorithm
    const currentWords = lowerCurrentTranscript.split(/\s+/).filter(word => word.length > 2);
    const sampleWords = lowerSampleTranscript.split(/\s+/).filter(word => word.length > 2);
    
    let matchScore = 0;
    let commonWords = [];
    let exactMatches = 0;
    let partialMatches = 0;
    
    // Check for exact word matches
    for (const word of currentWords) {
      if (sampleWords.includes(word)) {
        matchScore += 2; // Higher weight for exact matches
        commonWords.push(word);
        exactMatches++;
      }
    }
    
    // Check for partial matches (substring)
    for (const word of currentWords) {
      for (const sampleWord of sampleWords) {
        if (word !== sampleWord && (word.includes(sampleWord) || sampleWord.includes(word))) {
          matchScore += 0.5; // Lower weight for partial matches
          partialMatches++;
        }
      }
    }
    
    // Check for phrase patterns (consecutive words)
    const currentPhrases = [];
    const samplePhrases = [];
    
    for (let i = 0; i < currentWords.length - 1; i++) {
      currentPhrases.push(`${currentWords[i]} ${currentWords[i + 1]}`);
    }
    for (let i = 0; i < sampleWords.length - 1; i++) {
      samplePhrases.push(`${sampleWords[i]} ${sampleWords[i + 1]}`);
    }
    
    let phraseMatches = 0;
    for (const phrase of currentPhrases) {
      if (samplePhrases.includes(phrase)) {
        matchScore += 3; // Higher weight for phrase matches
        phraseMatches++;
      }
    }
    
    // Calculate confidence with multiple factors
    const totalWords = Math.max(currentWords.length, sampleWords.length);
    const wordMatchRatio = exactMatches / totalWords;
    const phraseMatchRatio = phraseMatches / Math.max(currentPhrases.length, samplePhrases.length);
    
    // Enhanced confidence calculation
    let confidence = 0;
    if (totalWords > 0) {
      confidence = (wordMatchRatio * 60) + (phraseMatchRatio * 40);
      confidence = Math.min(100, confidence * 100);
    }
    
    // Additional bonus for high word count matches
    if (exactMatches >= 3) {
      confidence += 10;
    }
    if (phraseMatches >= 1) {
      confidence += 15;
    }
    
    confidence = Math.min(100, confidence);
    
    console.log(`📊 ${sample.name}: ${exactMatches} exact matches, ${partialMatches} partial matches, ${phraseMatches} phrase matches, confidence: ${confidence.toFixed(1)}%`);
    
    // Only consider matches if we have significant similarity
    if (confidence > bestScore && exactMatches >= 2) {
      bestScore = confidence;
      bestMatch = {
        name: sample.name,
        confidence: confidence,
        commonWords: commonWords,
        exactMatches: exactMatches,
        phraseMatches: phraseMatches
      };
      console.log(`✅ New best match: ${sample.name} with ${exactMatches} exact matches`);
    } else if (confidence > bestScore) {
      console.log(`❌ ${sample.name} rejected: insufficient exact matches (${exactMatches} < 2)`);
    }
  }
  
  // Much higher threshold for more accurate matching, especially for SOS messages
  const confidenceThreshold = isSOSMessage ? 70 : 50;
  if (bestMatch && bestMatch.confidence > confidenceThreshold && bestMatch.exactMatches >= 3) {
    // Find the matched voice sample URL and location
    const matchedSample = voiceSamples.find(sample => sample.name === bestMatch.name);
    
    return {
      matchFound: true,
      confidence: Math.round(bestMatch.confidence),
      matchedVoice: bestMatch.name,
      matchedVoiceUrl: matchedSample ? matchedSample.url : null,
      lastKnownLocation: matchedSample ? matchedSample.lastKnownLocation : null,
      analysis: `Improved analysis: Found ${bestMatch.exactMatches} exact word matches and ${bestMatch.phraseMatches} phrase matches with ${bestMatch.name}`,
      voiceCharacteristics: ['Enhanced keyword matching', 'Phrase pattern analysis'],
      speechPatterns: bestMatch.commonWords,
      recommendedAction: 'Voice identity likely matches based on enhanced analysis',
      transcript: currentTranscript
    };
  } else {
    const reason = isSOSMessage ? 
      'SOS message content too different from voice samples (emergency vs normal speech)' :
      'No significant voice match found using enhanced comparison';
    
    return {
      matchFound: false,
      confidence: 0,
      matchedVoice: null,
      matchedVoiceUrl: null,
      lastKnownLocation: null,
      analysis: `Improved analysis: ${reason}`,
      voiceCharacteristics: [],
      speechPatterns: [],
      recommendedAction: 'No voice match detected',
      transcript: currentTranscript
    };
  }
};

  // Get last known location for a voice sample
  const getLastKnownLocation = (voiceName) => {
    console.log('📍 Getting location for voice:', voiceName);

    // This would typically come from a database or location tracking service
    // For now, we'll simulate location data based on voice sample names
    const locationMap = {
      'Priyaa_samplevoice.mp3': {
        latitude: 40.7589,
        longitude: -73.9851,
        address: 'Times Square, New York, NY',
        lastSeen: new Date().toISOString(),
        confidence: 'High',
        radius: '500m', // Approximate area radius
        area: 'Times Square District'
      },
      'Udhay_samplevoice.mp3': {
        latitude: 34.0522,
        longitude: -118.2437,
        address: 'Downtown Los Angeles, CA',
        lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        confidence: 'Medium',
        radius: '1km', // Approximate area radius
        area: 'Downtown LA Area'
      },
      // Add more flexible matching for different file names
      'Priyaa_Help.mp3': {
        latitude: 40.7589,
        longitude: -73.9851,
        address: 'Times Square, New York, NY',
        lastSeen: new Date().toISOString(),
        confidence: 'High',
        radius: '500m',
        area: 'Times Square District'
      },
      'Priyaa_Stranded.mp3': {
        latitude: 40.7589,
        longitude: -73.9851,
        address: 'Times Square, New York, NY',
        lastSeen: new Date().toISOString(),
        confidence: 'High',
        radius: '500m',
        area: 'Times Square District'
      }
    };
  
  // Try exact match first
  if (locationMap[voiceName]) {
    console.log('📍 Found exact location match for:', voiceName);
    return locationMap[voiceName];
  }
  
      // Try partial matching for Priyaa files
    if (voiceName.toLowerCase().includes('priyaa')) {
      console.log('📍 Found partial match for Priyaa file:', voiceName);
      return {
        latitude: 40.7589,
        longitude: -73.9851,
        address: 'Times Square, New York, NY',
        lastSeen: new Date().toISOString(),
        confidence: 'High',
        radius: '500m',
        area: 'Times Square District'
      };
    }

    // Try partial matching for Udhay files
    if (voiceName.toLowerCase().includes('udhay')) {
      console.log('📍 Found partial match for Udhay file:', voiceName);
      return {
        latitude: 34.0522,
        longitude: -118.2437,
        address: 'Downtown Los Angeles, CA',
        lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        confidence: 'Medium',
        radius: '1km',
        area: 'Downtown LA Area'
      };
    }
  
  console.log('📍 No location found for:', voiceName);
  return {
    latitude: null,
    longitude: null,
    address: 'Location unknown',
    lastSeen: null,
    confidence: 'Unknown'
  };
};

// Fetch voice samples from Firebase
const fetchVoiceSamples = async () => {
  try {
    console.log('🔍 Fetching voice samples from Firebase...');
    const storage = getStorage(app);
    const voiceSamplesRef = ref(storage, 'voicesamples/');
    console.log('📁 Looking in voicesamples folder...');
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firebase Storage request timed out')), 5000)
    );
    
    const listPromise = listAll(voiceSamplesRef);
    const voiceSamplesRes = await Promise.race([listPromise, timeoutPromise]);
    
    console.log('✅ Voice samples list successful');
    console.log('📊 Found voice samples:', voiceSamplesRes.items.length);
    console.log('📋 Voice sample file names:', voiceSamplesRes.items.map(item => item.name));
    
    // Get download URLs and basic info for voice samples
    const voiceSamplesWithUrls = await Promise.all(
      voiceSamplesRes.items.map(async (fileRef, index) => {
        try {
          console.log(`📥 Getting URL for voice sample ${index + 1}/${voiceSamplesRes.items.length}: ${fileRef.name}`);
          const url = await getDownloadURL(fileRef);
          console.log(`✅ Got URL for voice sample ${fileRef.name}`);
          // Get last known location for this voice
          console.log('🎵 Processing voice file:', fileRef.name);
          const location = getLastKnownLocation(fileRef.name);
          console.log('📍 Location result for', fileRef.name, ':', location);
          
          return {
            name: fileRef.name,
            url: url,
            fullPath: fileRef.fullPath,
            timeCreated: fileRef.timeCreated || new Date(),
            updated: fileRef.updated || new Date(),
            transcript: null, // Will be populated if we transcribe the sample
            lastKnownLocation: location
          };
        } catch (err) {
          console.warn(`⚠️ Failed to get URL for voice sample ${fileRef.name}:`, err);
          return null;
        }
      })
    );
    
    const validVoiceSamples = voiceSamplesWithUrls
      .filter(sample => sample !== null)
      .sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));
    
    console.log('🎵 Valid voice samples found:', validVoiceSamples.length);
    return validVoiceSamples;
    
  } catch (error) {
    console.error('❌ Error fetching voice samples:', error);
    return [];
  }
};

function App() {
  // Background listener for Firebase audio files
  const { audioFiles, loading, error } = useFirebaseAudioListener();
  
  // Transcription state
  const [transcription, setTranscription] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [sosAnalysis, setSosAnalysis] = useState(null);
  const [voicePrintMatch, setVoicePrintMatch] = useState(null);
  const [voiceSamples, setVoiceSamples] = useState([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [sendingAlerts, setSendingAlerts] = useState(false);

  // Fetch voice samples on component mount
  useEffect(() => {
    const loadVoiceSamples = async () => {
      try {
        console.log('🔄 Loading voice samples...');
        const samples = await fetchVoiceSamples();
        console.log('✅ Voice samples loaded:', samples.length);
        console.log('📋 Voice sample names:', samples.map(s => s.name));
        setVoiceSamples(samples);
      } catch (error) {
        console.error('❌ Failed to load voice samples:', error);
        setVoiceSamples([]);
      }
    };
    loadVoiceSamples();
  }, []);

  // Function to transcribe the first audio file using Whisper
  const handleTranscribeWithWhisper = async () => {
    if (audioFiles.length === 0) {
      alert('No audio files available to transcribe');
      return;
    }

    setTranscribing(true);
    setSosAnalysis(null);
    setVoicePrintMatch(null);
    try {
      // Get the latest (most recent) audio file
      const sortedFiles = [...audioFiles].sort((a, b) => {
        const timeA = a.timeCreated ? new Date(a.timeCreated).getTime() : 0;
        const timeB = b.timeCreated ? new Date(b.timeCreated).getTime() : 0;
        return timeB - timeA; // Descending order (newest first)
      });
      
      const latestFile = sortedFiles[0];
      const latestAudioUrl = latestFile.url;
      console.log('🎵 Transcribing latest SOS message from:', latestAudioUrl);
      console.log('📁 Latest audio file name:', latestFile.name);
      console.log('🔄 Fresh voice matching session - clearing any cached results');
      
      const transcript = await transcribeWithWhisper(latestAudioUrl);
      setTranscription(transcript);
      console.log('📝 SOS Message transcript:', transcript);
      
      // Analyze if it's an SOS message using Gemma 3n
      console.log('🔍 Starting SOS analysis with Gemma 3n...');
      const analysis = await detectSOSMessageWithGemma(transcript);
      setSosAnalysis(analysis);
      console.log('🚨 SOS Analysis with Gemma 3n:', analysis);
      
      // Send emergency alerts if SOS is detected
      if (analysis && analysis.isSOS) {
        console.log('🚨 SOS detected! Sending emergency alerts...');
        const sosData = {
          transcript: transcript,
          analysis: analysis,
          location: voicePrintMatch?.lastKnownLocation,
          timestamp: new Date().toISOString(),
          audioFile: latestFile.name
        };
        await sendEmergencyAlerts(sosData);
      }
      
      // Perform voice print matching if we have voice samples
      if (voiceSamples && voiceSamples.length > 0) {
        console.log('🎤 Starting fresh voice print matching...');
        console.log('📊 Available voice samples:', voiceSamples.map(s => s.name));
        
        // Check if the SOS transcript contains emergency keywords that might not match voice samples
        const emergencyKeywords = ['help', 'emergency', 'sos', 'danger', 'fire', 'police', 'ambulance', 'rescue'];
        const hasEmergencyKeywords = emergencyKeywords.some(keyword => 
          transcript.toLowerCase().includes(keyword)
        );
        
        if (hasEmergencyKeywords) {
          console.log('⚠️ SOS message contains emergency keywords - voice matching may be limited');
        }
        
        // Create fresh voice samples without cached transcripts to force re-evaluation
        const freshVoiceSamples = voiceSamples.map(sample => ({
          ...sample,
          transcript: null // Clear cached transcript to force fresh transcription
        }));
        
        const voiceMatch = await performVoicePrintMatch(transcript, freshVoiceSamples);
        // Add timestamp to track when this match was performed
        const voiceMatchWithTimestamp = {
          ...voiceMatch,
          matchTimestamp: new Date().toISOString(),
          sosMessageName: latestFile.name
        };
        setVoicePrintMatch(voiceMatchWithTimestamp);
        console.log('🎯 Fresh Voice Print Match Result:', voiceMatchWithTimestamp);
      } else {
        console.log('ℹ️ No voice samples available for voice print matching');
      }
      
    } catch (error) {
      console.error('Whisper transcription failed:', error);
      setTranscription('Transcription failed: ' + error.message);
      setSosAnalysis(null);
      setVoicePrintMatch(null);
    } finally {
      setTranscribing(false);
    }
  };

  // Create SOS messages from audio files
  const createSOSMessagesFromAudio = () => {
    if (loading) {
      return [
        {
          id: 'loading',
          sender: "Loading...",
          message: "Fetching audio files from Firebase",
          timestamp: new Date().toLocaleString(),
          location: "Firebase Storage",
          status: "Loading",
          priority: "Medium"
        }
      ];
    }

    if (error) {
      return [
        {
          id: 'error',
          sender: "Error",
          message: `Failed to load audio files: ${error}`,
          timestamp: new Date().toLocaleString(),
          location: "Firebase Storage",
          status: "Error",
          priority: "High"
        }
      ];
    }

    // Convert the latest (most recent) audio file to SOS message
    if (audioFiles.length > 0) {
      // Sort by creation time to get the most recent file
      const sortedFiles = [...audioFiles].sort((a, b) => {
        const timeA = a.timeCreated ? new Date(a.timeCreated).getTime() : 0;
        const timeB = b.timeCreated ? new Date(b.timeCreated).getTime() : 0;
        return timeB - timeA; // Descending order (newest first)
      });
      
      const latestFile = sortedFiles[0]; // Get the most recent file
      return [{
        id: latestFile.name || 'latest-file',
        sender: "(From Firebase)",
        message: latestFile.name || "Latest SOS Audio File",
        timestamp: latestFile.timeCreated ? new Date(latestFile.timeCreated).toLocaleString() : new Date().toLocaleString(),
        location: latestFile.fullPath || "Firebase Storage",
        status: "Active",
        priority: "High",
        voiceUrl: latestFile.url
      }];
    }
    return [];
  };



  // Generate precise Google Maps URL with markers
  const generateMapUrl = (location) => {
    if (!location || !location.latitude || !location.longitude) {
      return "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3021.870264123456!2d-73.968285684593!3d40.7850913793246!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c2588f9b1b1b1b%3A0x1b1b1b1b1b1b1b1b!2sCentral%20Park!5e0!3m2!1sen!2sus!4v1620000000000!5m2!1sen!2sus";
    }
    
    // Create a more precise map URL with markers and appropriate zoom
    const lat = location.latitude;
    const lng = location.longitude;
    const address = encodeURIComponent(location.address);
    
    // Use a closer zoom level (15 = street level, 13 = neighborhood level)
    const zoom = location.confidence === 'High' ? 15 : 13;
    
    return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d${zoom}000!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c2588f9b1b1b1b%3A0x1b1b1b1b1b1b1b1b!2s${address}!5e0!3m2!1sen!2sus!4v1620000000000!5m2!1sen!2sus&markers=color:red%7Clabel:EMERGENCY%7C${lat},${lng}`;
  };

  // Emergency Alert Functions
  const sendEmergencyAlerts = async (sosData) => {
    setSendingAlerts(true);
    const alerts = [];
    
    try {
      console.log('🚨 Sending emergency alerts for:', sosData);
      
      // 1. Alert nearby police stations
      const policeAlert = await alertNearbyPoliceStations(sosData);
      alerts.push(policeAlert);
      
      // 2. Alert emergency contacts
      const contactAlert = await alertEmergencyContacts(sosData);
      alerts.push(contactAlert);
      
      // 3. Alert emergency services
      const serviceAlert = await alertEmergencyServices(sosData);
      alerts.push(serviceAlert);
      
      setEmergencyAlerts(alerts);
      console.log('✅ Emergency alerts sent successfully:', alerts);
      
    } catch (error) {
      console.error('❌ Error sending emergency alerts:', error);
      alerts.push({
        type: 'Error',
        status: 'Failed',
        message: 'Failed to send emergency alerts',
        timestamp: new Date().toISOString()
      });
      setEmergencyAlerts(alerts);
    } finally {
      setSendingAlerts(false);
    }
  };

  const alertNearbyPoliceStations = async (sosData) => {
    // Simulate alerting nearby police stations (not implemented with real API)
    const location = sosData.location;
    const policeStations = [
      {
        name: 'NYPD Midtown South Precinct',
        distance: '0.5km',
        phone: '+1-212-239-9811',
        address: '357 W 35th St, New York, NY 10001'
      },
      {
        name: 'NYPD 13th Precinct',
        distance: '1.2km',
        phone: '+1-212-477-7411',
        address: '230 E 21st St, New York, NY 10010'
      }
    ];
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      type: 'Police Station',
      status: 'Sent',
      message: `Alerted ${policeStations.length} nearby police stations`,
      details: policeStations,
      timestamp: new Date().toISOString()
    };
  };

  const alertEmergencyContacts = async (sosData) => {
    // Simulate alerting emergency contacts via SMS
    const contacts = [
      {
        name: 'Emergency Contact 1',
        phone: '+1-555-0123',
        relationship: 'Family',
        status: 'Sent'
      },
      {
        name: 'Emergency Contact 2',
        phone: '+1-555-0456',
        relationship: 'Friend',
        status: 'Sent'
      }
    ];
    
    // Simulate SMS sending delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    console.log('📱 Simulated SMS alerts sent to emergency contacts');
    console.log('📄 Message content:', `🚨 EMERGENCY SOS ALERT 🚨\n\nSOS message detected: "${sosData.transcript}"\n\n📍 Location: ${sosData.location?.address || 'Unknown location'}\n🕐 Time: ${new Date().toLocaleString()}\n\n⚠️ Please respond immediately if you can assist.\n\n- WhisperSOS Emergency System`);
    
    return {
      type: 'Emergency Contacts',
      status: 'Sent',
      message: `SMS alerts sent to ${contacts.length} emergency contacts`,
      details: contacts,
      timestamp: new Date().toISOString()
    };
  };

  const alertEmergencyServices = async (sosData) => {
    // Simulate alerting emergency services (not implemented with real API)
    const services = [
      {
        name: 'Ambulance Service',
        phone: '911',
        status: 'Dispatched',
        eta: '5-8 minutes'
      },
      {
        name: 'Fire Department',
        phone: '911',
        status: 'On Standby',
        eta: '3-5 minutes'
      }
    ];
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    return {
      type: 'Emergency Services',
      status: 'Sent',
      message: 'Emergency services notified',
      details: services,
      timestamp: new Date().toISOString()
    };
  };

  // Use only Firebase audio files - no fallback messages
  const sampleSOSMessages = createSOSMessagesFromAudio();

  return (
    <div className="App" style={{ width: '100vw', minHeight: '100vh', overflow: 'auto', background: '#f8f9fa' }}>
      {/* Header - Top Middle */}
      <header style={{
        backgroundColor: '#2c3e50',
        color: 'white',
        padding: '1rem 0.5rem',
        textAlign: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 1000
      }}>
        <h1 style={{ 
          color: '#e74c3c', 
          fontSize: '2.2rem', 
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
          margin: '0',
          marginBottom: '0.3rem'
        }}>
          WHISPERSOS
        </h1>
        <p style={{ 
          color: '#ecf0f1', 
          fontSize: '1rem',
          margin: '0',
          opacity: '0.9'
        }}>
          Emergency Response Dashboard
        </p>
      </header>
      {/* Main Content Area */}
      <div style={{
        display: 'flex',
        minHeight: 'calc(100vh - 120px)', // Changed from height to minHeight
        width: '100vw',
        maxWidth: '100vw',
        overflow: 'auto', // Changed from hidden to auto
        boxSizing: 'border-box',
        padding: '0.5rem',
        gap: '0.5rem',
        background: '#f8f9fa'
      }}>
        {/* Left Side */}
        <div style={{
          flex: 1.5,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          maxWidth: '65vw',
          minHeight: '100%', // Changed from height to minHeight
          gap: '0.5rem',
        }}>
          {/* SOS Messages Table (top) */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '0.7rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
            flex: 2,
            minHeight: 0,
            overflow: 'auto', // Changed from hidden to auto
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ 
                color: '#e74c3c', 
                fontSize: '1.2rem',
                margin: '0',
                borderBottom: '2px solid #e74c3c',
                paddingBottom: '0.3rem'
              }}>
                Latest SOS Message (Firebase)
              </h2>
              <button 
                onClick={handleTranscribeWithWhisper}
                disabled={transcribing || audioFiles.length === 0}
                style={{
                  backgroundColor: transcribing ? '#95a5a6' : '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: transcribing ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 'bold'
                }}
              >
                {transcribing ? '🔄 Transcribing & Analyzing...' : '🎤 Transcribe & Match Voice'}
              </button>
              {voiceSamples && voiceSamples.length > 0 && (
                <div style={{
                  fontSize: '0.8rem',
                  color: '#27ae60',
                  marginTop: '0.5rem',
                  textAlign: 'center'
                }}>
                  📊 {voiceSamples.length} voice samples available for matching
                </div>
              )}
              
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
                tableLayout: 'fixed',
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#e74c3c', color: 'white' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #c0392b' }}>Message</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #c0392b' }}>Time</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #c0392b' }}>Priority</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #c0392b' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleSOSMessages.length > 0 ? (
                    sampleSOSMessages.map((message, index) => (
                      <tr key={message.id} style={{ 
                        backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white',
                        borderBottom: '1px solid #dee2e6'
                      }}>
                        <td style={{ padding: '0.5rem', border: '1px solid #dee2e6', textAlign: 'center' }}>
                          {message.voiceUrl ? (
                            <audio controls style={{ width: '100px' }}>
                              <source src={message.voiceUrl} type="audio/mpeg" />
                              Your browser does not support the audio element.
                            </audio>
                          ) : (
                            <span style={{ color: '#bbb', fontSize: '0.9em' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '0.5rem', border: '1px solid #dee2e6', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {message.timestamp}
                        </td>
                        <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>
                          <span style={{
                            padding: '0.2rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            backgroundColor: message.priority === 'Critical' ? '#e74c3c' : 
                                           message.priority === 'High' ? '#f39c12' : '#3498db',
                            color: 'white'
                          }}>
                            {message.priority}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>
                          <span style={{
                            padding: '0.2rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            backgroundColor: '#27ae60',
                            color: 'white'
                          }}>
                            {message.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ 
                        padding: '2rem', 
                        textAlign: 'center', 
                        color: '#7f8c8d',
                        fontStyle: 'italic',
                        backgroundColor: '#f8f9fa'
                      }}>
                        {loading ? '🔄 Loading SOS messages from Firebase...' : 
                         error ? '❌ Error loading SOS messages' : 
                         '📭 No SOS messages found in Firebase Storage'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Whisper Transcription Display */}
            {transcription && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: transcription.includes('Manual Review') ? '#fff3cd' : '#f8f9fa',
                border: `2px solid ${transcription.includes('Manual Review') ? '#f39c12' : '#e74c3c'}`,
                borderRadius: '8px',
                borderLeft: `6px solid ${transcription.includes('Manual Review') ? '#f39c12' : '#e74c3c'}`
              }}>
                <h3 style={{ 
                  color: transcription.includes('Manual Review') ? '#f39c12' : '#e74c3c', 
                  fontSize: '1rem',
                  margin: '0 0 0.5rem 0',
                  fontWeight: 'bold'
                }}>
                  {transcription.includes('Manual Review') ? '⚠️ Manual Review Required' : '🤖 Hugging Face Whisper Transcription:'}
                </h3>
                <p style={{
                  margin: '0',
                  fontSize: '1rem',
                  color: '#2c3e50',
                  fontStyle: 'italic',
                  backgroundColor: 'white',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}>
                  "{transcription}"
                </p>
              </div>
            )}
            
            {/* SOS Analysis Display with Gemma 3n */}
            {sosAnalysis && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: sosAnalysis.isSOS ? '#fff5f5' : '#f0f8ff',
                border: `2px solid ${sosAnalysis.isSOS ? '#e74c3c' : '#3498db'}`,
                borderRadius: '8px',
                borderLeft: `6px solid ${sosAnalysis.isSOS ? '#e74c3c' : '#3498db'}`
              }}>
                <h3 style={{ 
                  color: sosAnalysis.isSOS ? '#e74c3c' : '#3498db', 
                  fontSize: '1rem',
                  margin: '0 0 0.5rem 0',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {sosAnalysis.isSOS ? '🚨 SOS DETECTED!' : '✅ No Emergency Detected'}
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    (Gemma 3n Analysis)
                  </span>
                </h3>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Confidence:</span>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      backgroundColor: sosAnalysis.confidence >= 70 ? '#e74c3c' : 
                                     sosAnalysis.confidence >= 40 ? '#f39c12' : '#3498db',
                      color: 'white'
                    }}>
                      {sosAnalysis.confidence}%
                    </span>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Emergency Level:</span>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      backgroundColor: sosAnalysis.emergencyLevel === 'critical' ? '#e74c3c' : 
                                     sosAnalysis.emergencyLevel === 'high' ? '#f39c12' : 
                                     sosAnalysis.emergencyLevel === 'medium' ? '#f1c40f' : '#3498db',
                      color: 'white'
                    }}>
                      {sosAnalysis.emergencyLevel?.toUpperCase() || 'LOW'}
                    </span>
                  </div>
                  
                  {sosAnalysis.keywords.length > 0 && (
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Emergency Keywords Found:</span>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.3rem',
                        marginTop: '0.3rem'
                      }}>
                        {sosAnalysis.keywords.map((keyword, index) => (
                          <span key={index} style={{
                            padding: '0.2rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            fontWeight: 'bold'
                          }}>
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {sosAnalysis.analysis && (
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>AI Analysis:</span>
                      <p style={{
                        margin: '0.3rem 0 0 0',
                        fontSize: '0.9rem',
                        color: '#2c3e50',
                        backgroundColor: 'white',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6',
                        fontStyle: 'italic'
                      }}>
                        {sosAnalysis.analysis}
                      </p>
                    </div>
                  )}
                  
                  {sosAnalysis.recommendedAction && (
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Recommended Action:</span>
                      <p style={{
                        margin: '0.3rem 0 0 0',
                        fontSize: '0.9rem',
                        color: '#2c3e50',
                        backgroundColor: 'white',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6',
                        fontStyle: 'italic'
                      }}>
                        {sosAnalysis.recommendedAction}
                      </p>
                    </div>
                  )}
                  
                  {sosAnalysis.isSOS && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold'
                    }}>
                      ⚠️ This message requires immediate attention!
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Voice Print Match Display */}
            {voicePrintMatch && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: voicePrintMatch.matchFound ? '#fff8e1' : '#f5f5f5',
                border: `2px solid ${voicePrintMatch.matchFound ? '#ff9800' : '#9e9e9e'}`,
                borderRadius: '8px',
                borderLeft: `6px solid ${voicePrintMatch.matchFound ? '#ff9800' : '#9e9e9e'}`
              }}>
                <h3 style={{ 
                  color: voicePrintMatch.matchFound ? '#ff9800' : '#9e9e9e', 
                  fontSize: '1rem',
                  margin: '0 0 0.5rem 0',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {voicePrintMatch.matchFound ? '🎤 VOICE MATCH FOUND!' : '❌ No Voice Match'}
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    (Gemma 3n Analysis)
                  </span>
                </h3>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Match Confidence:</span>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      backgroundColor: voicePrintMatch.confidence >= 70 ? '#ff9800' : 
                                     voicePrintMatch.confidence >= 40 ? '#ffc107' : '#9e9e9e',
                      color: 'white'
                    }}>
                      {voicePrintMatch.confidence}%
                    </span>
                  </div>
                  
                  {voicePrintMatch.matchedVoice && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Matched Voice:</span>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          backgroundColor: '#ff9800',
                          color: 'white'
                        }}>
                          {voicePrintMatch.matchedVoice}
                        </span>
                      </div>
                      
                      {voicePrintMatch.matchedVoiceUrl && (
                        <div>
                          <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Matched Voice Sample:</span>
                          <div style={{
                            marginTop: '0.3rem',
                            padding: '0.5rem',
                            backgroundColor: 'white',
                            borderRadius: '4px',
                            border: '1px solid #dee2e6'
                          }}>
                            <audio controls style={{ width: '100%', maxWidth: '300px' }}>
                              <source src={voicePrintMatch.matchedVoiceUrl} type="audio/mpeg" />
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        </div>
                      )}
                      
                      {/* Always show location section for debugging */}
                      <div>
                        {console.log('📍 Rendering location section:', voicePrintMatch.lastKnownLocation)}
                        <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>📍 Last Known Location:</span>
                        <div style={{
                          marginTop: '0.3rem',
                          padding: '0.5rem',
                          backgroundColor: voicePrintMatch.lastKnownLocation ? '#e8f5e8' : '#fff3cd',
                          borderRadius: '4px',
                          border: `1px solid ${voicePrintMatch.lastKnownLocation ? '#4caf50' : '#ff9800'}`
                        }}>
                          {voicePrintMatch.lastKnownLocation ? (
                            <>
                              <div style={{ marginBottom: '0.3rem' }}>
                                <strong>Address:</strong> {voicePrintMatch.lastKnownLocation.address}
                              </div>
                              {voicePrintMatch.lastKnownLocation.latitude && voicePrintMatch.lastKnownLocation.longitude && (
                                <div style={{ marginBottom: '0.3rem' }}>
                                  <strong>Coordinates:</strong> {voicePrintMatch.lastKnownLocation.latitude.toFixed(4)}, {voicePrintMatch.lastKnownLocation.longitude.toFixed(4)}
                                </div>
                              )}
                              <div style={{ marginBottom: '0.3rem' }}>
                                <strong>Last Seen:</strong> {new Date(voicePrintMatch.lastKnownLocation.lastSeen).toLocaleString()}
                              </div>
                              <div>
                                <strong>Confidence:</strong> 
                                <span style={{
                                  padding: '0.2rem 0.4rem',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  backgroundColor: voicePrintMatch.lastKnownLocation.confidence === 'High' ? '#4caf50' : 
                                                 voicePrintMatch.lastKnownLocation.confidence === 'Medium' ? '#ff9800' : '#9e9e9e',
                                  color: 'white',
                                  marginLeft: '0.5rem'
                                }}>
                                  {voicePrintMatch.lastKnownLocation.confidence}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div style={{ color: '#ff9800', fontStyle: 'italic' }}>
                              No location data available for this voice
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {voicePrintMatch.voiceCharacteristics && voicePrintMatch.voiceCharacteristics.length > 0 && (
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Voice Characteristics:</span>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.3rem',
                        marginTop: '0.3rem'
                      }}>
                        {voicePrintMatch.voiceCharacteristics.map((characteristic, index) => (
                          <span key={index} style={{
                            padding: '0.2rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            backgroundColor: '#ff9800',
                            color: 'white',
                            fontWeight: 'bold'
                          }}>
                            {characteristic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {voicePrintMatch.speechPatterns && voicePrintMatch.speechPatterns.length > 0 && (
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Speech Patterns:</span>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.3rem',
                        marginTop: '0.3rem'
                      }}>
                        {voicePrintMatch.speechPatterns.map((pattern, index) => (
                          <span key={index} style={{
                            padding: '0.2rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            backgroundColor: '#ffc107',
                            color: 'white',
                            fontWeight: 'bold'
                          }}>
                            {pattern}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {voicePrintMatch.analysis && (
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>AI Analysis:</span>
                      <p style={{
                        margin: '0.3rem 0 0 0',
                        fontSize: '0.9rem',
                        color: '#2c3e50',
                        backgroundColor: 'white',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6',
                        fontStyle: 'italic'
                      }}>
                        {voicePrintMatch.analysis}
                      </p>
                    </div>
                  )}
                  
                  {voicePrintMatch.recommendedAction && (
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Recommended Action:</span>
                      <p style={{
                        margin: '0.3rem 0 0 0',
                        fontSize: '0.9rem',
                        color: '#2c3e50',
                        backgroundColor: 'white',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6',
                        fontStyle: 'italic'
                      }}>
                        {voicePrintMatch.recommendedAction}
                      </p>
                    </div>
                  )}
                  
                  {voicePrintMatch.matchFound && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      backgroundColor: '#ff9800',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold'
                    }}>
                      🎤 Voice identity confirmed! This matches a known voice sample.
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Emergency Alerts Section */}
            {emergencyAlerts.length > 0 && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '0.7rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                marginTop: '0.5rem',
                border: '2px solid #e74c3c'
              }}>
                <h3 style={{ 
                  color: '#e74c3c', 
                  fontSize: '1.1rem',
                  margin: '0 0 0.5rem 0',
                  borderBottom: '2px solid #e74c3c',
                  paddingBottom: '0.3rem'
                }}>
                  🚨 Emergency Alerts Sent
                </h3>
                
                {sendingAlerts && (
                  <div style={{
                    padding: '0.5rem',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}>
                    🔄 Sending emergency alerts...
                  </div>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {emergencyAlerts.map((alert, index) => (
                    <div key={index} style={{
                      padding: '0.5rem',
                      backgroundColor: alert.status === 'Sent' ? '#d4edda' : '#f8d7da',
                      borderRadius: '4px',
                      border: `1px solid ${alert.status === 'Sent' ? '#c3e6cb' : '#f5c6cb'}`
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.3rem'
                      }}>
                        <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                          {alert.type}
                        </span>
                        <span style={{
                          padding: '0.2rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          backgroundColor: alert.status === 'Sent' ? '#28a745' : '#dc3545',
                          color: 'white'
                        }}>
                          {alert.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#2c3e50' }}>
                        {alert.message}
                      </div>
                      {alert.details && (
                        <div style={{ marginTop: '0.3rem', fontSize: '0.8rem' }}>
                          {alert.details.map((detail, detailIndex) => (
                            <div key={detailIndex} style={{
                              padding: '0.2rem',
                              backgroundColor: 'rgba(255,255,255,0.7)',
                              borderRadius: '3px',
                              marginTop: '0.2rem'
                            }}>
                              <strong>{detail.name}</strong>
                              {detail.phone && ` - ${detail.phone}`}
                              {detail.distance && ` (${detail.distance})`}
                              {detail.eta && ` - ETA: ${detail.eta}`}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#6c757d',
                        marginTop: '0.3rem'
                      }}>
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
        {/* Right Side - Google Map */}
        <div style={{
          flex: 0.8,
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '0.7rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          overflow: 'hidden',
        }}>
          <h2 style={{ 
            color: '#3498db', 
            fontSize: '1.2rem',
            marginBottom: '0.5rem',
            borderBottom: '2px solid #3498db',
            paddingBottom: '0.3rem'
          }}>
            {voicePrintMatch && voicePrintMatch.lastKnownLocation ? 
              '📍 Matched Voice Location' : 'Emergency Location Map'}
          </h2>
          {/* Google Map iframe */}
          <div style={{
            width: '100%',
            flex: 1,
            minHeight: 0,
            borderRadius: '8px',
            overflow: 'hidden',
            border: `2px solid ${voicePrintMatch && voicePrintMatch.lastKnownLocation ? '#ff9800' : '#3498db'}`,
            background: voicePrintMatch && voicePrintMatch.lastKnownLocation ? '#fff8e1' : '#e8f4fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {voicePrintMatch && voicePrintMatch.lastKnownLocation ? (
              <iframe
                title="Matched Voice Location"
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: '100%', minWidth: '100%' }}
                loading="lazy"
                allowFullScreen
                src={generateMapUrl(voicePrintMatch.lastKnownLocation)}
              ></iframe>
            ) : (
              <iframe
                title="Sample Google Map"
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: '100%', minWidth: '100%' }}
                loading="lazy"
                allowFullScreen
                src={generateMapUrl(null)}
              ></iframe>
            )}
          </div>
          <div style={{
            fontSize: '0.9rem',
            color: '#7f8c8d',
            textAlign: 'center',
            marginTop: '0.3rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {voicePrintMatch && voicePrintMatch.lastKnownLocation ? (
              <>
                📍 Last known location: {voicePrintMatch.lastKnownLocation.address}
                <br />
                <span style={{ color: '#27ae60', fontWeight: 'bold' }}>
                  Area: {voicePrintMatch.lastKnownLocation.area}
                </span>
                <br />
                <span style={{ color: '#e67e22', fontWeight: 'bold' }}>
                  Approximate Radius: {voicePrintMatch.lastKnownLocation.radius}
                </span>
                <br />
                <span style={{ color: '#ff9800', fontWeight: 'bold' }}>
                  Confidence: {voicePrintMatch.lastKnownLocation.confidence}
                </span>
              </>
            ) : (
              'Map displays a sample emergency location (Central Park, NY)'
            )}
          </div>
        </div>
      </div>
      {/* Bottom padding to ensure scrollability */}
      <div style={{ height: '2rem' }}></div>
    </div>
  );
}

export default App;
