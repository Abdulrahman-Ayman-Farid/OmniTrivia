import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Sparkles,
  Volume2,
  AlertCircle,
  MessageSquare,
  Bot,
  User,
} from 'lucide-react';
import { HostPersona } from '../data/hosts';
import { LiveAudioPlayer, pcmFloat32ToBase64 } from '../utils/audio';

interface LiveVoiceStageProps {
  host: HostPersona;
  onClose: () => void;
  currentScore?: number;
  currentTopic?: string;
}

interface DialogueTurn {
  sender: 'host' | 'user';
  text: string;
  timestamp: string;
}

export const LiveVoiceStage: React.FC<LiveVoiceStageProps> = ({
  host,
  onClose,
  currentScore = 0,
  currentTopic = 'Trivia Mastery',
}) => {
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'ready' | 'error' | 'disconnected'
  >('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isHostSpeaking, setIsHostSpeaking] = useState(false);
  const [userSpeakingLevel, setUserSpeakingLevel] = useState(0);

  // Subtitles / Dialogue transcript history
  const [dialogueHistory, setDialogueHistory] = useState<DialogueTurn[]>([]);
  const [currentHostText, setCurrentHostText] = useState('');
  const [currentUserText, setCurrentUserText] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const isMutedRef = useRef(isMicMuted);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  // Auto-scroll transcription feed
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [dialogueHistory, currentHostText, currentUserText]);

  useEffect(() => {
    // 1. Initialize 24kHz Live Audio Player
    const player = new LiveAudioPlayer();
    playerRef.current = player;

    // 2. Open WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/live`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send start message with host persona
      ws.send(
        JSON.stringify({
          type: 'start',
          hostPersona: host,
          context: {
            currentScore,
            currentTopic,
          },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'ready') {
          setConnectionStatus('ready');
          startMicrophone();
        } else if (msg.type === 'audio') {
          setIsHostSpeaking(true);
          player.playChunk(msg.audio);
        } else if (msg.type === 'host_transcription') {
          setCurrentHostText((prev) => prev + ' ' + msg.text);
        } else if (msg.type === 'user_transcription') {
          setCurrentUserText((prev) => prev + ' ' + msg.text);
        } else if (msg.type === 'interrupted') {
          player.stopAll();
          setIsHostSpeaking(false);
        } else if (msg.type === 'turn_complete') {
          setIsHostSpeaking(false);
          // Commit current turns to history if available
          setCurrentHostText((hostText) => {
            if (hostText.trim()) {
              setDialogueHistory((prev) => [
                ...prev,
                {
                  sender: 'host',
                  text: hostText.trim(),
                  timestamp: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                },
              ]);
            }
            return '';
          });
          setCurrentUserText((userText) => {
            if (userText.trim()) {
              setDialogueHistory((prev) => [
                ...prev,
                {
                  sender: 'user',
                  text: userText.trim(),
                  timestamp: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                },
              ]);
            }
            return '';
          });
        } else if (msg.type === 'error') {
          setConnectionStatus('error');
          setErrorMessage(msg.error || 'Live API connection error');
        }
      } catch (e) {
        console.error('Error handling WebSocket message:', e);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket connection error:', err);
      setConnectionStatus('error');
      setErrorMessage('Could not connect to Live Voice server');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };

    // Cleanup on unmount
    return () => {
      stopMicrophone();
      if (playerRef.current) {
        playerRef.current.close();
      }
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop' }));
          wsRef.current.close();
        }
      }
    };
  }, [host]);

  // Microphone capture with 16kHz Web Audio
  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      micAudioCtxRef.current = inputCtx;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate simple volume level for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i += 16) {
          sum += Math.abs(inputData[i]);
        }
        const avg = sum / (inputData.length / 16);
        setUserSpeakingLevel(Math.min(100, Math.round(avg * 400)));

        // Send 16kHz PCM chunk to Gemini Live via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const base64Audio = pcmFloat32ToBase64(inputData);
          wsRef.current.send(
            JSON.stringify({
              type: 'audio',
              audio: base64Audio,
            })
          );
        }
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);
    } catch (err: any) {
      console.error('Error acquiring microphone:', err);
      setErrorMessage(
        'Microphone access denied or unavailable. Please grant permission.'
      );
    }
  };

  const stopMicrophone = () => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (micAudioCtxRef.current) {
      micAudioCtxRef.current.close();
      micAudioCtxRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
  };

  const sendQuickTextPrompt = (text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Add immediately to UI
      setDialogueHistory((prev) => [
        ...prev,
        {
          sender: 'user',
          text,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
      wsRef.current.send(
        JSON.stringify({
          type: 'text',
          text,
        })
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="flex h-3 w-3">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    connectionStatus === 'ready'
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    connectionStatus === 'ready'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">
                  Live Stage with {host.name}
                </h3>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Powered by Gemini 3.8 Live API • 24kHz Real-Time Voice
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <PhoneOff className="w-5 h-5 text-rose-400" />
          </button>
        </div>

        {/* Center Arena: Visualizer & Host Presence */}
        <div className="p-6 flex flex-col items-center justify-center bg-gradient-to-b from-stone-900 via-stone-900/90 to-stone-950 border-b border-white/10 relative">
          {/* Spotlight aura */}
          <div
            className={`absolute w-64 h-64 bg-gradient-to-r ${host.themeColor} rounded-full blur-3xl opacity-30 pointer-events-none transition-all duration-500 ${
              isHostSpeaking ? 'scale-125 opacity-50' : 'scale-100'
            }`}
          />

          <div className="relative z-10 flex flex-col items-center">
            {/* Host Avatar with animated reactive ring */}
            <div
              className={`relative w-28 h-28 rounded-3xl overflow-hidden border-4 transition-all duration-300 shadow-2xl ${
                isHostSpeaking
                  ? 'border-amber-400 ring-8 ring-amber-400/20 scale-105'
                  : 'border-white/20'
              }`}
            >
              <img
                src={host.avatar}
                alt={host.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 bg-stone-950/80 backdrop-blur-md rounded-lg px-2 py-0.5 text-base border border-white/15">
                {host.avatarEmoji}
              </div>
            </div>

            <h4 className="mt-3 font-bold text-white text-lg tracking-wide">
              {host.name}
            </h4>
            <p className="text-xs text-amber-300 font-medium italic text-center max-w-sm">
              "{host.catchphrase}"
            </p>

            {/* Connection Status indicator */}
            <div className="mt-2 flex items-center gap-2">
              {connectionStatus === 'connecting' && (
                <span className="text-xs text-amber-400 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Connecting audio channel to Gemini 3.8 Live...
                </span>
              )}
              {connectionStatus === 'ready' && isHostSpeaking && (
                <span className="text-xs text-amber-300 font-semibold flex items-center gap-1.5 animate-pulse">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  {host.name} is speaking...
                </span>
              )}
              {connectionStatus === 'ready' && !isHostSpeaking && (
                <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Listening to you! Speak freely or use quick prompts.
                </span>
              )}
              {connectionStatus === 'error' && (
                <span className="text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errorMessage || 'Connection failed'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Subtitles & Conversation Transcript */}
        <div
          ref={scrollRef}
          className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[160px] max-h-[220px] bg-stone-950/40 text-sm"
        >
          {dialogueHistory.length === 0 &&
            !currentHostText &&
            !currentUserText && (
              <div className="h-full flex flex-col items-center justify-center text-stone-500 text-xs text-center py-6">
                <MessageSquare className="w-6 h-6 mb-2 opacity-50" />
                <p>Start speaking into your mic to chat with {host.name}!</p>
                <p className="text-stone-600 mt-1">
                  Ask for trivia hints, request a roast, or challenge them.
                </p>
              </div>
            )}

          {dialogueHistory.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${
                item.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {item.sender === 'host' && (
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-xs">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm ${
                  item.sender === 'user'
                    ? 'bg-amber-500 text-stone-950 font-medium rounded-tr-sm'
                    : 'bg-stone-800 text-stone-200 border border-white/10 rounded-tl-sm'
                }`}
              >
                <div className="text-[10px] font-bold opacity-60 mb-0.5 flex items-center justify-between gap-2">
                  <span>{item.sender === 'user' ? 'You' : host.name}</span>
                  <span>{item.timestamp}</span>
                </div>
                <p className="leading-relaxed">{item.text}</p>
              </div>
              {item.sender === 'user' && (
                <div className="w-6 h-6 rounded-lg bg-white/10 text-stone-300 border border-white/10 flex items-center justify-center flex-shrink-0 text-xs">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {/* Active Streaming Subtitles */}
          {currentHostText && (
            <div className="flex items-start gap-2.5 justify-start">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-xs">
                <Bot className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div className="max-w-[80%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm bg-stone-800 text-amber-200 border border-amber-500/30 rounded-tl-sm animate-pulse">
                <div className="text-[10px] font-bold text-amber-400 mb-0.5">
                  {host.name} (Speaking)
                </div>
                <p className="leading-relaxed">{currentHostText}</p>
              </div>
            </div>
          )}

          {currentUserText && (
            <div className="flex items-start gap-2.5 justify-end">
              <div className="max-w-[80%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm bg-amber-500/80 text-stone-950 font-medium rounded-tr-sm animate-pulse">
                <div className="text-[10px] font-bold opacity-75 mb-0.5">
                  You (Speaking)
                </div>
                <p className="leading-relaxed">{currentUserText}</p>
              </div>
              <div className="w-6 h-6 rounded-lg bg-white/10 text-stone-300 border border-white/10 flex items-center justify-center flex-shrink-0 text-xs">
                <User className="w-3.5 h-3.5" />
              </div>
            </div>
          )}
        </div>

        {/* Quick Conversation Starter Chips */}
        <div className="px-4 py-2 bg-stone-950/60 border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold whitespace-nowrap flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Quick Ask:
          </span>
          {[
            'Roast my trivia knowledge!',
            'Hit me with an impossible riddle',
            'Give me a game show host pep talk',
            'What is the weirdest fact you know?',
          ].map((prompt, i) => (
            <button
              key={i}
              onClick={() => sendQuickTextPrompt(prompt)}
              className="text-xs bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-300 hover:text-white px-3 py-1 rounded-full whitespace-nowrap border border-white/10 transition cursor-pointer"
            >
              "{prompt}"
            </button>
          ))}
        </div>

        {/* Footer Microphone Controls */}
        <div className="p-4 bg-stone-900 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mic Audio Level meter */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-end gap-0.5 h-6 w-12 bg-stone-950 rounded-lg p-1 border border-white/10">
                {[0.2, 0.4, 0.6, 0.8, 1.0].map((thresh, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 rounded-sm transition-all duration-75 ${
                      !isMicMuted && userSpeakingLevel / 100 >= thresh
                        ? 'bg-emerald-400'
                        : 'bg-stone-800'
                    }`}
                    style={{ height: `${thresh * 100}%` }}
                  />
                ))}
              </div>
              <span className="text-xs text-stone-400">
                {isMicMuted ? 'Mic Muted' : 'Mic Active'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mute / Unmute Button */}
            <button
              onClick={() => setIsMicMuted(!isMicMuted)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                isMicMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-stone-800 text-stone-200 border border-white/15 hover:bg-stone-700'
              }`}
            >
              {isMicMuted ? (
                <>
                  <MicOff className="w-4 h-4 text-rose-400" /> Unmute Mic
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-emerald-400" /> Mute Mic
                </>
              )}
            </button>

            {/* End Call / Return to Game */}
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              Return to Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
