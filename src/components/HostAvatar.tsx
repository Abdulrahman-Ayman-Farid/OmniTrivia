import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, Sparkles, MessageSquare } from 'lucide-react';
import { HostPersona } from '../data/hosts';

interface HostAvatarProps {
  host: HostPersona;
  isSpeaking: boolean;
  mood?: 'idle' | 'happy' | 'shocked' | 'smug' | 'roasting' | 'impressed';
  reactionText?: string;
  onReplayAudio?: () => void;
  hasAudio?: boolean;
  audioLoading?: boolean;
}

export const HostAvatar: React.FC<HostAvatarProps> = ({
  host,
  isSpeaking,
  mood = 'idle',
  reactionText,
  onReplayAudio,
  hasAudio = false,
  audioLoading = false,
}) => {
  const [pulseBars, setPulseBars] = useState<number[]>([12, 24, 18, 30, 15]);

  // Audio equalizer simulation for speaking state
  useEffect(() => {
    if (!isSpeaking) return;
    const interval = setInterval(() => {
      setPulseBars([
        Math.floor(Math.random() * 26) + 8,
        Math.floor(Math.random() * 32) + 12,
        Math.floor(Math.random() * 28) + 10,
        Math.floor(Math.random() * 36) + 14,
        Math.floor(Math.random() * 24) + 6,
      ]);
    }, 120);
    return () => clearInterval(interval);
  }, [isSpeaking]);

  const getMoodEmoji = () => {
    switch (mood) {
      case 'happy':
      case 'impressed':
        return '🤩';
      case 'shocked':
        return '😱';
      case 'smug':
      case 'roasting':
        return '😏';
      default:
        return host.avatarEmoji;
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Studio Spotlight Glow */}
      <div
        className={`absolute -inset-4 bg-gradient-to-r ${host.themeColor} opacity-25 blur-2xl transition-all duration-700 pointer-events-none rounded-full ${
          isSpeaking ? 'scale-125 opacity-40' : 'scale-100'
        }`}
      />

      {/* Host Avatar Ring & Container */}
      <div className="relative group">
        <div
          className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 transition-all duration-300 shadow-2xl flex items-center justify-center ${
            isSpeaking
              ? 'border-amber-400 ring-4 ring-amber-400/30 scale-105'
              : 'border-white/20 hover:border-white/40'
          } bg-stone-900`}
        >
          <img
            src={host.avatar}
            alt={host.name}
            className="w-full h-full object-cover filter brightness-95 group-hover:brightness-105 transition-all duration-500"
          />

          {/* Dynamic Mood Emoji Overlay badge */}
          <div className="absolute top-1.5 right-1.5 bg-stone-900/90 backdrop-blur-md rounded-lg px-1.5 py-0.5 text-base border border-white/10 shadow-lg">
            {getMoodEmoji()}
          </div>

          {/* Speaking Audio Waveform overlay */}
          {isSpeaking && (
            <div className="absolute inset-x-0 bottom-0 py-1.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-end justify-center gap-1">
              {pulseBars.map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}px` }}
                  className="w-1 bg-gradient-to-t from-amber-400 to-yellow-200 rounded-full transition-all duration-100"
                />
              ))}
            </div>
          )}
        </div>

        {/* Live Audio Replay / Mute Button */}
        {hasAudio && onReplayAudio && (
          <button
            onClick={onReplayAudio}
            disabled={audioLoading}
            title="Replay Host Audio"
            className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 shadow-lg border border-amber-300 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            {audioLoading ? (
              <div className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
            ) : isSpeaking ? (
              <Volume2 className="w-4 h-4 animate-pulse" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Host Name & Voice Persona Info */}
      <div className="mt-3 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <h3 className="font-bold text-white text-base tracking-wide flex items-center gap-1">
            {host.name}
          </h3>
          <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-white/10 text-stone-300 border border-white/10">
            {host.voiceName} Voice
          </span>
        </div>
        <p className="text-xs text-stone-400 mt-0.5">{host.title}</p>
      </div>

      {/* Host Speech Balloon / Banter preview */}
      {reactionText && (
        <div className="mt-3 relative max-w-xs sm:max-w-md px-4 py-2.5 rounded-2xl bg-stone-900/90 border border-white/15 text-stone-200 text-xs sm:text-sm shadow-xl backdrop-blur-md text-center animate-fade-in">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-stone-900/90 border-t border-l border-white/15 rotate-45" />
          <div className="flex items-center justify-center gap-1.5 text-amber-400 text-[10px] font-semibold tracking-wider uppercase mb-1">
            <Sparkles className="w-3 h-3" /> Host Commentary
          </div>
          <p className="italic font-medium leading-relaxed">
            "{reactionText.replace(/<[^>]+>|\|[^|]+\|/g, '').trim()}"
          </p>
        </div>
      )}
    </div>
  );
};
