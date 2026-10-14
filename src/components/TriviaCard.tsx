import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  HelpCircle,
  Clock,
  Flame,
  Volume2,
  ShieldCheck,
  Search,
  CheckCircle,
  XCircle,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import { HostPersona } from '../data/hosts';
import { sfx } from '../utils/audio';

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hostBanter: string;
  topic?: string;
}

interface TriviaCardProps {
  question: TriviaQuestion;
  questionIndex: number;
  totalQuestions: number;
  score: number;
  streak: number;
  host: HostPersona;
  onAnswer: (isCorrect: boolean, chosenIndex: number) => void;
  onNextQuestion: () => void;
  onOpenSearchSources: () => void;
  playTTS: (text: string) => Promise<void>;
  ttsLoading: boolean;
  isTTSSpeaking: boolean;
}

export const TriviaCard: React.FC<TriviaCardProps> = ({
  question,
  questionIndex,
  totalQuestions,
  score,
  streak,
  host,
  onAnswer,
  onNextQuestion,
  onOpenSearchSources,
  playTTS,
  ttsLoading,
  isTTSSpeaking,
}) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [hostHint, setHostHint] = useState<string | null>(null);
  const [loadingHint, setLoadingHint] = useState(false);
  const [lifeline50Used, setLifeline50Used] = useState(false);
  const [lifelineHintUsed, setLifelineHintUsed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25);
  const [factCheckDetail, setFactCheckDetail] = useState<string | null>(null);
  const [loadingFactCheck, setLoadingFactCheck] = useState(false);

  // Reset state when new question arrives
  useEffect(() => {
    setSelectedOption(null);
    setIsAnswered(false);
    setEliminatedOptions([]);
    setHostHint(null);
    setFactCheckDetail(null);
    setTimeLeft(25);

    // Auto-read question and host banter with gemini-3.8-flash-tts
    const narrationText = `${question.hostBanter} Question: ${question.question}`;
    playTTS(narrationText).catch(() => {});
  }, [question.id]);

  // Timer countdown
  useEffect(() => {
    if (isAnswered) return;
    if (timeLeft <= 0) {
      // Time expired
      handleSelectOption(-1);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 5 && prev > 1) {
          sfx.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isAnswered]);

  const handleSelectOption = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);

    const isCorrect = index === question.correctIndex;
    if (isCorrect) {
      sfx.playCorrect();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899'],
      });
    } else {
      sfx.playWrong();
    }

    onAnswer(isCorrect, index);
  };

  // 50/50 Lifeline: eliminates two wrong options
  const handleUse5050 = () => {
    if (lifeline50Used || isAnswered) return;
    sfx.playLifeline();
    setLifeline50Used(true);

    const wrongIndexes = [0, 1, 2, 3].filter((i) => i !== question.correctIndex);
    // Shuffle and pick 2
    const toEliminate = wrongIndexes.sort(() => 0.5 - Math.random()).slice(0, 2);
    setEliminatedOptions(toEliminate);
  };

  // Host Hint Lifeline
  const handleUseHostHint = async () => {
    if (lifelineHintUsed || isAnswered || loadingHint) return;
    sfx.playLifeline();
    setLifelineHintUsed(true);
    setLoadingHint(true);

    try {
      const res = await fetch('/api/trivia/host-reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.question,
          chosenOption: 'Lifeline Hint Request',
          correctOption: question.options[question.correctIndex],
          isCorrect: false,
          hostPersona: {
            ...host,
            tonePrompt: `give a subtle, witty 1-sentence cryptic hint for the answer without revealing it outright as ${host.name}`,
          },
        }),
      });
      const data = await res.json();
      const hint = data.reaction?.reactionText || 'Trust your first instinct!';
      setHostHint(hint);
      playTTS(hint);
    } catch {
      setHostHint('Look carefully at the wording of the choices!');
    } finally {
      setLoadingHint(false);
    }
  };

  // Deep Fact-Check with Google Search
  const handleFactCheckDeepDive = async () => {
    if (loadingFactCheck) return;
    setLoadingFactCheck(true);
    try {
      const res = await fetch('/api/trivia/fact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.question,
          answer: question.options[question.correctIndex],
          topic: question.topic || 'Trivia',
        }),
      });
      const data = await res.json();
      if (data.factCheckText) {
        setFactCheckDetail(data.factCheckText);
      }
    } catch {
      setFactCheckDetail('Unable to fetch deep dive right now.');
    } finally {
      setLoadingFactCheck(false);
    }
  };

  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col space-y-4">
      {/* Top Bar: Progress, Timer, Streak */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            Question {questionIndex + 1} of {totalQuestions}
          </span>
          {streak > 1 && (
            <span className="text-xs font-bold text-orange-400 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/20 animate-pulse">
              <Flame className="w-3.5 h-3.5 fill-orange-400" />
              {streak}x Streak!
            </span>
          )}
        </div>

        {/* Timer Bar */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-stone-800 border border-white/10 text-stone-200">
            <Clock
              className={`w-3.5 h-3.5 ${
                timeLeft <= 5 ? 'text-rose-400 animate-spin' : 'text-stone-400'
              }`}
            />
            <span
              className={
                timeLeft <= 5 ? 'text-rose-400 font-bold' : 'text-stone-200'
              }
            >
              {timeLeft}s
            </span>
          </div>

          {/* Search Grounding Badge */}
          <button
            onClick={onOpenSearchSources}
            title="View Google Search Sources"
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 transition cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Google Grounded</span>
          </button>
        </div>
      </div>

      {/* Main Question Arena Card */}
      <div className="bg-stone-900/90 border border-white/15 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Subtle timer line at top */}
        <div
          className="absolute top-0 left-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-1000"
          style={{ width: `${(timeLeft / 25) * 100}%` }}
        />

        {/* Host Banter Callout */}
        <div className="flex items-start justify-between gap-3 mb-4 p-3 rounded-2xl bg-stone-950/70 border border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{host.avatarEmoji}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-amber-400">
                  {host.name}
                </span>
                <span className="text-[10px] text-stone-500 uppercase tracking-wider">
                  Host Prompt
                </span>
              </div>
              <p className="text-xs text-stone-300 italic mt-0.5">
                "{question.hostBanter}"
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              playTTS(`${question.hostBanter} Question: ${question.question}`)
            }
            disabled={ttsLoading}
            title="Listen to Host Audio"
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-300 hover:text-white border border-white/10 transition cursor-pointer flex-shrink-0"
          >
            {ttsLoading ? (
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            ) : isTTSSpeaking ? (
              <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Question Text */}
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide leading-relaxed mb-6">
          {question.question}
        </h2>

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {question.options.map((option, index) => {
            const isEliminated = eliminatedOptions.includes(index);
            const isSelected = selectedOption === index;
            const isCorrect = index === question.correctIndex;

            let buttonStyle =
              'bg-stone-800/80 hover:bg-stone-800 text-stone-200 border-white/10 hover:border-white/25';
            let badgeStyle = 'bg-stone-700 text-stone-300 border-white/10';

            if (isAnswered) {
              if (isCorrect) {
                buttonStyle =
                  'bg-emerald-950/80 border-emerald-500 text-emerald-100 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10';
                badgeStyle = 'bg-emerald-500 text-stone-950 border-emerald-400';
              } else if (isSelected && !isCorrect) {
                buttonStyle =
                  'bg-rose-950/80 border-rose-500 text-rose-100 ring-2 ring-rose-500/40 shadow-lg shadow-rose-500/10';
                badgeStyle = 'bg-rose-500 text-stone-950 border-rose-400';
              } else {
                buttonStyle = 'bg-stone-800/40 text-stone-500 border-transparent opacity-40';
              }
            } else if (isEliminated) {
              buttonStyle =
                'bg-stone-800/30 text-stone-600 border-transparent line-through cursor-not-allowed opacity-30';
            }

            return (
              <button
                key={index}
                disabled={isAnswered || isEliminated}
                onClick={() => handleSelectOption(index)}
                className={`relative p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-3 group cursor-pointer ${buttonStyle}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span
                    className={`w-7 h-7 rounded-xl border flex items-center justify-center text-xs font-bold flex-shrink-0 transition ${badgeStyle}`}
                  >
                    {optionLetters[index]}
                  </span>
                  <span className="text-sm font-medium leading-snug group-hover:translate-x-0.5 transition-transform">
                    {option}
                  </span>
                </div>

                {isAnswered && isCorrect && (
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                )}
                {isAnswered && isSelected && !isCorrect && (
                  <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Lifeline Row */}
        {!isAnswered && (
          <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs">
            <span className="text-stone-400 font-semibold tracking-wider uppercase text-[11px] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Lifelines:
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleUse5050}
                disabled={lifeline50Used}
                className={`px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer ${
                  lifeline50Used
                    ? 'bg-stone-800 text-stone-600 border-transparent cursor-not-allowed line-through'
                    : 'bg-stone-800 hover:bg-stone-700 text-amber-300 border-amber-500/30'
                }`}
              >
                50 / 50
              </button>
              <button
                onClick={handleUseHostHint}
                disabled={lifelineHintUsed || loadingHint}
                className={`px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                  lifelineHintUsed
                    ? 'bg-stone-800 text-stone-600 border-transparent cursor-not-allowed'
                    : 'bg-stone-800 hover:bg-stone-700 text-cyan-300 border-cyan-500/30'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {loadingHint ? 'Thinking...' : 'Host Hint'}
              </button>
            </div>
          </div>
        )}

        {/* Host Hint Display */}
        {hostHint && (
          <div className="mt-3 p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs flex items-start gap-2.5 animate-fade-in">
            <Lightbulb className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-cyan-300">
                {host.name}'s Cryptic Hint:
              </span>
              <p className="mt-0.5 italic">{hostHint}</p>
            </div>
          </div>
        )}

        {/* Answer Explanation & Fact Check Section (When Answered) */}
        {isAnswered && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3 animate-fade-in">
            <div className="p-4 rounded-2xl bg-stone-950/70 border border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Verified Trivia Fact:
                </span>
                <button
                  onClick={handleFactCheckDeepDive}
                  disabled={loadingFactCheck}
                  className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition cursor-pointer"
                >
                  <Search className="w-3 h-3" />
                  {loadingFactCheck ? 'Searching web...' : 'Google Deep-Dive'}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                {question.explanation}
              </p>

              {factCheckDetail && (
                <div className="mt-3 p-3 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs text-blue-200 space-y-1">
                  <span className="font-semibold text-blue-300">
                    Deep Dive Fact Check:
                  </span>
                  <p className="leading-relaxed">{factCheckDetail}</p>
                </div>
              )}
            </div>

            {/* Next Question / Finish Button */}
            <div className="flex justify-end pt-1">
              <button
                onClick={onNextQuestion}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:scale-95 text-stone-950 font-bold text-sm shadow-xl shadow-amber-500/20 transition cursor-pointer"
              >
                <span>
                  {questionIndex + 1 === totalQuestions
                    ? 'View Final Standings'
                    : 'Next Question'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
