import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Flame,
  RotateCcw,
  Sparkles,
  Volume2,
  Mic,
  Award,
  BarChart3,
  Sliders,
} from 'lucide-react';
import { HostPersona } from '../data/hosts';
import { sfx } from '../utils/audio';

interface GameSummaryProps {
  score: number;
  correctCount: number;
  totalQuestions: number;
  bestStreak: number;
  host: HostPersona;
  topic: string;
  onPlayAgain: () => void;
  onChangeSetup: () => void;
  onOpenLiveVoice: () => void;
  playTTS: (text: string) => Promise<void>;
  ttsLoading: boolean;
  isTTSSpeaking: boolean;
}

export const GameSummary: React.FC<GameSummaryProps> = ({
  score,
  correctCount,
  totalQuestions,
  bestStreak,
  host,
  topic,
  onPlayAgain,
  onChangeSetup,
  onOpenLiveVoice,
  playTTS,
  ttsLoading,
  isTTSSpeaking,
}) => {
  const [hostVerdict, setHostVerdict] = useState<string>('');
  const [loadingVerdict, setLoadingVerdict] = useState(true);

  const accuracy = Math.round((correctCount / totalQuestions) * 100);

  useEffect(() => {
    sfx.playFanfare();
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.5 },
    });

    // Fetch custom host final commentary
    const fetchVerdict = async () => {
      try {
        const res = await fetch('/api/trivia/host-reaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: `Final Round Summary for Topic: ${topic}`,
            chosenOption: `${correctCount} out of ${totalQuestions} correct (${score} pts, ${bestStreak} streak)`,
            correctOption: `${totalQuestions} correct`,
            isCorrect: accuracy >= 60,
            hostPersona: {
              ...host,
              tonePrompt: `deliver your final grand game show closing judgment and grade for the player. Be authentic to ${host.name} persona: praise excellence, roast mediocrity, or impart philosophical wisdom. Include fun vocal cues like <laugh> or <gasp> if fitting.`,
            },
            streak: bestStreak,
            score: score,
          }),
        });
        const data = await res.json();
        const text =
          data.reaction?.reactionText ||
          `Splendid effort! You finished with ${score} points!`;
        setHostVerdict(text);
        playTTS(text).catch(() => {});
      } catch {
        const fallback = `Game complete! You scored ${score} points with ${accuracy}% accuracy. Well played!`;
        setHostVerdict(fallback);
        playTTS(fallback).catch(() => {});
      } finally {
        setLoadingVerdict(false);
      }
    };

    fetchVerdict();
  }, []);

  const getRankTitle = () => {
    if (accuracy >= 90) return 'Grandmaster of Trivia';
    if (accuracy >= 70) return 'Distinguished Scholar';
    if (accuracy >= 50) return 'Honorable Competitor';
    return 'Amateur Explorer';
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-5 animate-fade-in">
      {/* Trophy / Result Banner */}
      <div className="relative bg-stone-900 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden">
        {/* Glow */}
        <div
          className={`absolute -inset-10 bg-gradient-to-r ${host.themeColor} opacity-20 blur-3xl pointer-events-none`}
        />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border-2 border-amber-500/40 text-amber-400 flex items-center justify-center mb-4 shadow-xl shadow-amber-500/10">
            <Trophy className="w-10 h-10 animate-bounce" />
          </div>

          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-2">
            Game Over • Final Results
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            {getRankTitle()}
          </h2>
          <p className="text-sm text-stone-400 mt-1">
            Category: <strong className="text-stone-200">{topic}</strong>
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 w-full mt-6">
            <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-white/10">
              <span className="text-[11px] font-semibold text-stone-400 uppercase block">
                Total Score
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-amber-400 mt-0.5 block">
                {score}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-white/10">
              <span className="text-[11px] font-semibold text-stone-400 uppercase block">
                Accuracy
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-400 mt-0.5 block">
                {accuracy}%
              </span>
              <span className="text-[10px] text-stone-500">
                {correctCount}/{totalQuestions} Correct
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-white/10">
              <span className="text-[11px] font-semibold text-stone-400 uppercase block">
                Max Streak
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-orange-400 mt-0.5 block flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 fill-orange-400" />
                {bestStreak}
              </span>
            </div>
          </div>

          {/* Host Commentary Speech Box */}
          <div className="w-full mt-6 p-4 rounded-2xl bg-stone-950/80 border border-white/10 text-left relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{host.avatarEmoji}</span>
                <span className="text-xs font-bold text-amber-300">
                  {host.name}'s Post-Game Verdict:
                </span>
              </div>

              {hostVerdict && (
                <button
                  onClick={() => playTTS(hostVerdict)}
                  disabled={ttsLoading}
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition cursor-pointer"
                  title="Replay Verdict Audio"
                >
                  {isTTSSpeaking ? (
                    <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            {loadingVerdict ? (
              <div className="flex items-center gap-2 text-xs text-stone-500 py-2">
                <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span>{host.name} is preparing your personalized verdict...</span>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-stone-300 italic leading-relaxed">
                "{hostVerdict.replace(/<[^>]+>|\|[^|]+\|/g, '').trim()}"
              </p>
            )}
          </div>

          {/* Live Voice Stage CTA Banner */}
          <div className="w-full mt-4 p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-purple-950/40 to-stone-900 border border-red-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  Want to debate your score with {host.name}?
                </h4>
              </div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Jump into the Live Voice Stage to speak directly via microphone!
              </p>
            </div>

            <button
              onClick={onOpenLiveVoice}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition cursor-pointer flex-shrink-0"
            >
              <Mic className="w-4 h-4" /> Talk with Host
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onPlayAgain}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 font-bold text-sm shadow-xl shadow-amber-500/20 transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Play Another Round
        </button>
        <button
          onClick={onChangeSetup}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-white font-semibold text-sm border border-white/10 transition cursor-pointer"
        >
          <Sliders className="w-4 h-4" /> Change Host / Topic
        </button>
      </div>
    </div>
  );
};
