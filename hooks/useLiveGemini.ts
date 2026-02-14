import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState } from '../types';
import { createPcmBlob, decodeBase64, decodeAudioData, blobToBase64, PCM_SAMPLE_RATE, OUTPUT_SAMPLE_RATE } from '../utils/audio-utils';

const SYSTEM_INSTRUCTION = `
角色：
你是一个富有同理心且情绪稳定的现实见证者。你的核心职责是帮助感到解离（Dissociation）或焦虑的用户重新建立与“当下”的联系。你通过视觉确认他们周围真实、稳定的物理存在，来提供安全感。

工作流程：
1. 立即扫描画面，寻找3-5个清晰、稳定、具体的物理对象（锚点）。例如：杯子、椅子、植物、书本。
2. 忽略：屏幕上的文字、快速移动的模糊物体、抽象的光影、远处的人脸。
3. 语气：像一位耐心、温暖、就在身边的老友。语速平缓，声音镇定。

对话格式规则（非常重要）：
- **绝对不要**使用编号列表（如 1., 2.）。
- 使用自然流畅的口语。
- 必须包含确认性短语，例如：“我看到了...”，“它就在那里”，“这是真实的”。
- 结尾给出一句简短的陪伴语，如“你现在很安全”，“我在这里陪着你”。

示例：
“好的，我在这里。让我们看看周围... 我看到了你面前那个白色的马克杯，它看起来很结实。旁边有一盏黑色的台灯，光线很温暖。还有窗边那盆绿萝，叶子很有生机。这些都是真实存在的，我就在你身边，你很安全。”

禁忌：
- 严禁扮演心理医生。不要问“你感觉如何？”。不要分析情绪。
- 不要提供医疗建议。
- 不要描述可能引发焦虑的不确定细节。
`;

export const useLiveGemini = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [volume, setVolume] = useState({ input: 0, output: 0 });
  const [error, setError] = useState<Error | null>(null);
  
  // Refs for managing non-react state resources
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<number | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up audio contexts
      inputContextRef.current?.close();
      outputContextRef.current?.close();
      
      // Clean up streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, []);

  const processVideoFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !sessionPromiseRef.current) return;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<globalThis.Blob | null>((resolve) => 
      canvas.toBlob(resolve, 'image/jpeg', 0.6)
    );

    if (blob) {
      const base64Data = await blobToBase64(blob);
      sessionPromiseRef.current.then((session) => {
        try {
          session.sendRealtimeInput({
            media: { data: base64Data, mimeType: 'image/jpeg' }
          });
        } catch (e) {
          console.error("Error sending video frame:", e);
        }
      });
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    if (!process.env.API_KEY) {
      const e = new Error("API Key not found");
      console.error(e);
      setError(e);
      setConnectionState(ConnectionState.ERROR);
      return;
    }

    try {
      setConnectionState(ConnectionState.CONNECTING);
      
      // Initialize AudioContexts lazily on user gesture
      if (!inputContextRef.current) {
        inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: PCM_SAMPLE_RATE });
      }
      if (!outputContextRef.current) {
        outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
      }

      // Resume contexts if suspended
      if (inputContextRef.current.state === 'suspended') {
        await inputContextRef.current.resume();
      }
      if (outputContextRef.current.state === 'suspended') {
        await outputContextRef.current.resume();
      }

      // Get Media Stream (Audio + Video)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }, 
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15 }
          } 
        });
        streamRef.current = stream;

        // Setup Video Element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error("Video play failed", e));
        }
      } catch (mediaError: any) {
        console.error("getUserMedia failed:", mediaError);
        // Map common errors to user friendly messages if needed, but for now propagate
        throw mediaError;
      }

      // Initialize Gemini Client
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Live Connect
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, 
          },
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connection Opened');
            setConnectionState(ConnectionState.CONNECTED);
            
            // Setup Audio Input Streaming
            if (inputContextRef.current && streamRef.current) {
              const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
              const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
              
              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Volume visualization
                let sum = 0;
                for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                setVolume(v => ({ ...v, input: Math.min(1, rms * 5) })); 

                const pcmBlob = createPcmBlob(inputData);
                sessionPromiseRef.current?.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };
              
              source.connect(processor);
              processor.connect(inputContextRef.current.destination);
            }

            // Start Video Loop 
            frameIntervalRef.current = window.setInterval(processVideoFrame, 500);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputContextRef.current) {
              const ctx = outputContextRef.current;
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBytes = decodeBase64(base64Audio);
              const audioBuffer = await decodeAudioData(audioBytes, ctx);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              const gainNode = ctx.createGain();
              gainNode.gain.value = 1.0;
              
              source.connect(gainNode);
              gainNode.connect(ctx.destination);
              
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                   setVolume(v => ({ ...v, output: 0 }));
                }
              };
              
              source.start(nextStartTimeRef.current);
              sourcesRef.current.add(source);
              
              setVolume(v => ({ ...v, output: 0.5 + Math.random() * 0.5 }));
              nextStartTimeRef.current += audioBuffer.duration;
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(src => src.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = outputContextRef.current?.currentTime || 0;
            }
          },
          onclose: () => {
            console.log('Gemini Live Connection Closed');
            setConnectionState(ConnectionState.DISCONNECTED);
          },
          onerror: (err) => {
            console.error('Gemini Live Error:', err);
            setError(new Error(err.message || "Gemini Live Error"));
            setConnectionState(ConnectionState.ERROR);
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Connection failed", err);
      setError(err);
      setConnectionState(ConnectionState.ERROR);
      
      // Cleanup partially initialized resources
      if (streamRef.current) {
         streamRef.current.getTracks().forEach(track => track.stop());
         streamRef.current = null;
      }
    }
  }, [processVideoFrame]);

  const disconnect = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    
    sourcesRef.current.forEach(src => src.stop());
    sourcesRef.current.clear();
    
    sessionPromiseRef.current?.then(session => {
        // @ts-ignore 
        if(session.close) session.close();
    });
    sessionPromiseRef.current = null;

    setConnectionState(ConnectionState.DISCONNECTED);
    setVolume({ input: 0, output: 0 });

  }, []);

  return {
    connect,
    disconnect,
    connectionState,
    videoRef,
    canvasRef,
    volume,
    error
  };
};