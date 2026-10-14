import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Mic,
  Volume2,
  VolumeX,
  Wand2,
  ShieldCheck,
  Trophy,
  Flame,
  Radio,
  Globe,
  Atom,
  Film,
  Landmark,
  Gamepad2,
  Utensils,
  ChevronRight,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { HostPersona, PRESET_HOSTS, TRIVIA_CATEGORIES } from './data/hosts';
import { HostAvatar } from './components/HostAvatar';
import { TriviaCard, TriviaQuestion } from './components/TriviaCard';
import { LiveVoiceStage } from './components/LiveVoiceStage';
import { HostCustomizerModal } from './components/HostCustomizerModal';
import { SearchSourcesModal, SearchSource } from './components/SearchSourcesModal';
import { GameSummary } from './components/GameSummary';
import { sfx, speakBrowserFallback, stopBrowserFallback } from './utils/audio';

type GameState = 'lobby' | 'loading' | 'playing' | 'summary';

export default function App() {
  // Game Configuration State
  const [selectedHost, setSelectedHost] = useState<HostPersona>(PRESET_HOSTS[0]);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    TRIVIA_CATEGORIES[0].name
  );
  const [customTopic, setCustomTopic] = useState<string>('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState<number>(5);

  // Active Game State
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [searchSources, setSearchSources] = useState<SearchSource[]>([]);
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  // Host Reactions & TTS Audio State
  const [hostMood, setHostMood] = useState<
    'idle' | 'happy' | 'shocked' | 'smug' | 'roasting' | 'impressed'
  >('idle');
  const [hostReactionText, setHostReactionText] = useState<string>('');
  const [isTTSSpeaking, setIsTTSSpeaking] = useState<boolean>(false);
  const [ttsLoading, setTtsLoading] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  // Modals
  const [isLiveVoiceOpen, setIsLiveVoiceOpen] = useState<boolean>(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState<boolean>(false);

  // Audio elements
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Play TTS speech using gemini-3.8-flash-tts with seamless speech synthesis fallback
  const playTTS = async (text: string, style?: string): Promise<void> => {
    if (isAudioMuted || !text.trim()) return;

    try {
      // Stop existing audio or browser speech
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      stopBrowserFallback();

      setTtsLoading(true);
      const res = await fetch('/api/trivia/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          hostPersona: selectedHost,
          style: style || selectedHost.speechStyle,
        }),
      });

      const data = await res.json();
      if (data.audioBase64) {
        const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
        currentAudioRef.current = audio;

        audio.onplay = () => setIsTTSSpeaking(true);
        audio.onended = () => {
          setIsTTSSpeaking(false);
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          setIsTTSSpeaking(false);
          currentAudioRef.current = null;
        };

        await audio.play();
      } else if (data.fallbackToBrowser) {
        // Smoothly speak via browser speech synthesis with host voice styling
        speakBrowserFallback(
          text,
          { id: selectedHost.id, voiceName: selectedHost.voiceName },
          () => setIsTTSSpeaking(true),
          () => setIsTTSSpeaking(false)
        );
      }
    } catch (err) {
      console.warn('TTS fetch error, using browser speech fallback:', err);
      speakBrowserFallback(
        text,
        { id: selectedHost.id, voiceName: selectedHost.voiceName },
        () => setIsTTSSpeaking(true),
        () => setIsTTSSpeaking(false)
      );
    } finally {
      setTtsLoading(false);
    }
  };

  const stopTTS = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    stopBrowserFallback();
    setIsTTSSpeaking(false);
  };

  // Start Game
  const handleStartGame = async () => {
    stopTTS();
    setGameState('loading');
    setLoadingMessage(
      `Summoning ${selectedHost.name} and fact-checking trivia questions with Google Search...`
    );

    const activeTopic = customTopic.trim() || selectedCategory;

    try {
      const res = await fetch('/api/trivia/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: activeTopic,
          difficulty,
          count: questionCount,
          hostPersona: selectedHost,
        }),
      });

      const data = await res.json();

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setSearchSources(data.searchSources || []);
        setCurrentQuestionIndex(0);
        setScore(0);
        setCorrectCount(0);
        setStreak(0);
        setBestStreak(0);
        setHostMood('idle');
        setHostReactionText('');
        setGameState('playing');
        sfx.playFanfare();
      } else {
        throw new Error('No questions received');
      }
    } catch (err) {
      console.error('Error starting game:', err);
      alert('Failed to generate trivia questions. Please try again.');
      setGameState('lobby');
    }
  };

  // User answered a question
  const handleAnswerQuestion = async (isCorrect: boolean, chosenIndex: number) => {
    const currentQ = questions[currentQuestionIndex];
    const chosenText = chosenIndex >= 0 ? currentQ.options[chosenIndex] : 'Time expired';
    const correctText = currentQ.options[currentQ.correctIndex];

    const newStreak = isCorrect ? streak + 1 : 0;
    const pointsGained = isCorrect ? 100 * (1 + newStreak * 0.5) : 0;
    const newScore = Math.round(score + pointsGained);

    setStreak(newStreak);
    if (newStreak > bestStreak) setBestStreak(newStreak);
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      setScore(newScore);
      setHostMood(newStreak >= 3 ? 'impressed' : 'happy');
    } else {
      setHostMood(selectedHost.id === 'sarcasmo' ? 'roasting' : 'shocked');
    }

    // Request dynamic host reaction commentary from server
    try {
      const res = await fetch('/api/trivia/host-reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQ.question,
          chosenOption: chosenText,
          correctOption: correctText,
          isCorrect,
          hostPersona: selectedHost,
          streak: newStreak,
          score: newScore,
        }),
      });
      const data = await res.json();
      if (data.reaction?.reactionText) {
        setHostReactionText(data.reaction.reactionText);
        // Play host voice commentary!
        playTTS(data.reaction.reactionText);
      }
    } catch (err) {
      console.warn('Reaction error:', err);
    }
  };

  // Move to next question or finish
  const handleNextQuestion = () => {
    stopTTS();
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setHostMood('idle');
      setHostReactionText('');
    } else {
      setGameState('summary');
    }
  };

  // Helper icons for categories
  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Globe':
        return <Globe className="w-5 h-5" />;
      case 'Atom':
        return <Atom className="w-5 h-5" />;
      case 'Film':
        return <Film className="w-5 h-5" />;
      case 'Landmark':
        return <Landmark className="w-5 h-5" />;
      case 'Gamepad2':
        return <Gamepad2 className="w-5 h-5" />;
      default:
        return <Utensils className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-sans relative overflow-x-hidden">
      {/* Background Studio Grid & Atmosphere */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/2 -right-40 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Game Show Navigation Header */}
      <header className="sticky top-0 z-40 bg-stone-950/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-stone-950 font-black flex items-center justify-center shadow-lg shadow-amber-500/20 text-lg">
            Ω
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-white flex items-center gap-2">
              OmniTrivia
              <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                AI Arena
              </span>
            </h1>
          </div>
        </div>

        {/* Global Controls: Audio Mute, Live Stage CTA, Score */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {gameState === 'playing' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900 border border-white/10 text-xs">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="font-extrabold text-white text-sm">{score}</span>
              <span className="text-stone-400 text-[10px] uppercase">pts</span>
            </div>
          )}

          {/* Real-Time Live Voice Button */}
          <button
            onClick={() => setIsLiveVoiceOpen(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-red-600/20 border border-red-400/30 transition cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden sm:inline">Live Voice Stage</span>
            <span className="sm:hidden">Live</span>
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={() => {
              if (isAudioMuted) {
                setIsAudioMuted(false);
              } else {
                stopTTS();
                setIsAudioMuted(true);
              }
            }}
            className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white border border-white/10 transition cursor-pointer"
            title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isAudioMuted ? (
              <VolumeX className="w-4 h-4 text-stone-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-400" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center px-4 py-6 sm:py-10 max-w-5xl mx-auto w-full z-10">
        {/* VIEW 1: LOBBY & HOST SETUP */}
        {gameState === 'lobby' && (
          <div className="space-y-8 animate-fade-in">
            {/* Hero Title */}
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Next-Gen AI Game Show
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Pick Your AI Quizmaster
              </h2>
              <p className="text-stone-400 text-sm sm:text-base">
                Each host brings a completely unique personality, voice, humor,
                and commentary. Challenge them over speech or real-time voice!
              </p>
            </div>

            {/* Host Personality Selection Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                  <span>Step 1: Choose Host Persona</span>
                </h3>
                <button
                  onClick={() => setIsCustomizerOpen(true)}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Custom Persona Studio</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {PRESET_HOSTS.map((host) => {
                  const isSelected = selectedHost.id === host.id;
                  return (
                    <div
                      key={host.id}
                      onClick={() => setSelectedHost(host)}
                      className={`relative p-4 rounded-3xl border transition-all duration-300 cursor-pointer flex flex-col justify-between group ${
                        isSelected
                          ? 'bg-stone-900 border-amber-400 ring-2 ring-amber-400/30 shadow-xl'
                          : 'bg-stone-900/60 hover:bg-stone-900 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-white/20 flex-shrink-0">
                          <img
                            src={host.avatar}
                            alt={host.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <span className="absolute bottom-1 right-1 bg-stone-950/80 backdrop-blur-md rounded px-1 text-xs">
                            {host.avatarEmoji}
                          </span>
                        </div>

                        <div className="overflow-hidden flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-bold text-white text-sm truncate">
                              {host.name}
                            </h4>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-stone-300 border border-white/10 flex-shrink-0">
                              {host.voiceName}
                            </span>
                          </div>
                          <p className="text-xs text-amber-400/90 font-medium truncate mt-0.5">
                            {host.title}
                          </p>
                          <p className="text-xs text-stone-400 line-clamp-2 mt-1 leading-relaxed">
                            {host.description}
                          </p>
                        </div>
                      </div>

                      {/* Catchphrase & Audio Preview sample button */}
                      <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                        <span className="text-stone-400 italic truncate max-w-[70%]">
                          "{host.catchphrase}"
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHost(host);
                            playTTS(host.sampleGreeting);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center gap-1 text-[11px] font-semibold border border-white/10 transition cursor-pointer"
                          title="Sample Host Voice"
                        >
                          <Volume2 className="w-3 h-3 text-amber-400" />
                          <span>Voice</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Card to create custom host */}
                <div
                  onClick={() => setIsCustomizerOpen(true)}
                  className="p-4 rounded-3xl border border-dashed border-white/20 hover:border-amber-400/50 bg-stone-900/30 hover:bg-stone-900/60 transition flex flex-col items-center justify-center text-center cursor-pointer min-h-[140px] group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Wand2 className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">
                    Design Your Own Host
                  </h4>
                  <p className="text-xs text-stone-400 mt-1 max-w-xs">
                    Choose any custom tone, catchphrase, and voice avatar.
                  </p>
                </div>
              </div>
            </div>

            {/* Category & Topic Selection */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Step 2: Trivia Category (Google Search Grounded)
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {TRIVIA_CATEGORIES.map((cat) => {
                  const isSelected =
                    !customTopic && selectedCategory === cat.name;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        setCustomTopic('');
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-400 text-amber-100 shadow-lg'
                          : 'bg-stone-900/60 hover:bg-stone-900 border-white/10 text-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="text-amber-400">
                          {getCategoryIcon(cat.icon)}
                        </div>
                        <span className="font-bold text-xs sm:text-sm text-white">
                          {cat.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-400 line-clamp-2">
                        {cat.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Or enter custom topic */}
              <div className="pt-2">
                <div className="relative">
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="Or enter any custom topic (e.g., 2026 Space Missions, 90s Hip Hop, Quantum Physics)..."
                    className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400 placeholder:text-stone-500 transition"
                  />
                  {customTopic && (
                    <button
                      onClick={() => setCustomTopic('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Difficulty & Length Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-3xl bg-stone-900/60 border border-white/10">
              <div>
                <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider block mb-2">
                  Difficulty
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficulty(diff)}
                      className={`py-2 text-xs font-bold rounded-xl border capitalize transition cursor-pointer ${
                        difficulty === diff
                          ? 'bg-amber-500 text-stone-950 border-amber-400 shadow'
                          : 'bg-stone-800 text-stone-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider block mb-2">
                  Questions per Episode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 10].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setQuestionCount(cnt)}
                      className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                        questionCount === cnt
                          ? 'bg-amber-500 text-stone-950 border-amber-400 shadow'
                          : 'bg-stone-800 text-stone-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {cnt} Qs
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch Game Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleStartGame}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 active:scale-95 text-stone-950 font-black text-base shadow-2xl shadow-amber-500/25 transition cursor-pointer flex items-center justify-center gap-3"
              >
                <Play className="w-5 h-5 fill-stone-950" />
                <span>Start Show with {selectedHost.name}</span>
              </button>

              <button
                onClick={() => setIsLiveVoiceOpen(true)}
                className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm border border-white/15 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Mic className="w-4 h-4 text-red-400 animate-pulse" />
                <span>Talk with Host via Live Mic</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: LOADING SCREEN */}
        {gameState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-fade-in">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-amber-500/20 border-2 border-amber-500/30 text-amber-400 flex items-center justify-center shadow-2xl animate-pulse">
                <Sparkles className="w-10 h-10 animate-spin" />
              </div>
              <div className="absolute -inset-4 bg-amber-500/20 blur-xl rounded-full -z-10" />
            </div>

            <h3 className="text-xl font-bold text-white">
              Preparing Your Game Show
            </h3>
            <p className="text-stone-400 text-xs sm:text-sm max-w-md">
              {loadingMessage}
            </p>
          </div>
        )}

        {/* VIEW 3: PLAYING SCREEN */}
        {gameState === 'playing' && questions.length > 0 && (
          <div className="space-y-6 animate-fade-in">
            {/* Host Podium at Top */}
            <HostAvatar
              host={selectedHost}
              isSpeaking={isTTSSpeaking}
              mood={hostMood}
              reactionText={hostReactionText}
              hasAudio={true}
              audioLoading={ttsLoading}
              onReplayAudio={() => {
                if (hostReactionText) {
                  playTTS(hostReactionText);
                } else if (questions[currentQuestionIndex]) {
                  const q = questions[currentQuestionIndex];
                  playTTS(`${q.hostBanter} Question: ${q.question}`);
                }
              }}
            />

            {/* Trivia Card */}
            <TriviaCard
              question={questions[currentQuestionIndex]}
              questionIndex={currentQuestionIndex}
              totalQuestions={questions.length}
              score={score}
              streak={streak}
              host={selectedHost}
              onAnswer={handleAnswerQuestion}
              onNextQuestion={handleNextQuestion}
              onOpenSearchSources={() => setIsSourcesModalOpen(true)}
              playTTS={playTTS}
              ttsLoading={ttsLoading}
              isTTSSpeaking={isTTSSpeaking}
            />
          </div>
        )}

        {/* VIEW 4: GAME SUMMARY & PODIUM */}
        {gameState === 'summary' && (
          <GameSummary
            score={score}
            correctCount={correctCount}
            totalQuestions={questions.length}
            bestStreak={bestStreak}
            host={selectedHost}
            topic={customTopic.trim() || selectedCategory}
            onPlayAgain={handleStartGame}
            onChangeSetup={() => {
              stopTTS();
              setGameState('lobby');
            }}
            onOpenLiveVoice={() => setIsLiveVoiceOpen(true)}
            playTTS={playTTS}
            ttsLoading={ttsLoading}
            isTTSSpeaking={isTTSSpeaking}
          />
        )}
      </main>

      {/* MODAL: LIVE VOICE STAGE (Gemini 3.8 Live API) */}
      {isLiveVoiceOpen && (
        <LiveVoiceStage
          host={selectedHost}
          onClose={() => setIsLiveVoiceOpen(false)}
          currentScore={score}
          currentTopic={customTopic.trim() || selectedCategory}
        />
      )}

      {/* MODAL: HOST CUSTOMIZER */}
      <HostCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        onSave={(newHost) => {
          setSelectedHost(newHost);
          playTTS(newHost.sampleGreeting);
        }}
        initialHost={selectedHost}
      />

      {/* MODAL: GOOGLE SEARCH GROUNDING SOURCES */}
      <SearchSourcesModal
        isOpen={isSourcesModalOpen}
        onClose={() => setIsSourcesModalOpen(false)}
        sources={searchSources}
        topic={customTopic.trim() || selectedCategory}
      />
    </div>
  );
}
