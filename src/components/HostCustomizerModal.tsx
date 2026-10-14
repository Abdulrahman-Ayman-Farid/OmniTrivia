import React, { useState } from 'react';
import { Sparkles, X, Mic, Wand2, Check } from 'lucide-react';
import { HostPersona } from '../data/hosts';

interface HostCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customHost: HostPersona) => void;
  initialHost?: HostPersona;
}

export const HostCustomizerModal: React.FC<HostCustomizerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialHost,
}) => {
  const [name, setName] = useState(initialHost?.name || 'Sir Archibald Blunder');
  const [title, setTitle] = useState(initialHost?.title || 'The Exasperated Historian');
  const [avatarEmoji, setAvatarEmoji] = useState(initialHost?.avatarEmoji || '🧐');
  const [voiceName, setVoiceName] = useState<'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'>(
    initialHost?.voiceName || 'Fenrir'
  );
  const [speechStyle, setSpeechStyle] = useState(
    initialHost?.speechStyle || 'Pompous, theatrical, highly articulated, punctuated with sighs'
  );
  const [tonePrompt, setTonePrompt] = useState(
    initialHost?.tonePrompt ||
      'dramatic and theatrical, treats every correct answer like a triumph of the cosmos and wrong answers like a personal Shakespearean tragedy'
  );
  const [catchphrase, setCatchphrase] = useState(
    initialHost?.catchphrase || 'Alas, reality is often disappointing!'
  );

  if (!isOpen) return null;

  const handleSave = () => {
    const customHost: HostPersona = {
      id: `custom_${Date.now()}`,
      name: name.trim() || 'Custom Host',
      title: title.trim() || 'Custom Personality',
      avatar:
        initialHost?.avatar ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=faces',
      avatarEmoji: avatarEmoji || '🎙️',
      themeColor: 'from-purple-600 via-indigo-600 to-stone-900',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      description: tonePrompt,
      voiceName: voiceName,
      speechStyle: speechStyle,
      tonePrompt: tonePrompt,
      catchphrase: catchphrase,
      sampleGreeting: `Welcome contestants, I am ${name}! Let the contest begin!`,
    };
    onSave(customHost);
    onClose();
  };

  const applyPresetIdea = (presetType: string) => {
    if (presetType === 'pirate') {
      setName('Captain Redbeard');
      setTitle('Scourge of the Seven Trivia Seas');
      setAvatarEmoji('🏴‍☠️');
      setVoiceName('Fenrir');
      setSpeechStyle('Gravelly pirate voice with hearty belly laughs and sea dog terminology');
      setTonePrompt('boisterous pirate captain who demands trivia gold and threatens to make contestants walk the plank for foolish answers');
      setCatchphrase('Shiver me timbers, that was a blunder fit for Davy Jones!');
    } else if (presetType === 'cyberpunk') {
      setName('CYBER-9000');
      setTitle('Sentient Supercomputer & Quiz AI');
      setAvatarEmoji('🤖');
      setVoiceName('Puck');
      setSpeechStyle('Calculated, futuristic synth cadence with digital glitch sound effects');
      setTonePrompt('hyper-intelligent rogue AI analyzing contestant meatbag brains with ironic superiority and statistical humor');
      setCatchphrase('Contestant neural accuracy detected at 98.4% efficiency!');
    } else if (presetType === 'valley') {
      setName('Chloe Luxe');
      setTitle('Beverly Hills Influencer & Secret Genius');
      setAvatarEmoji('✨');
      setVoiceName('Kore');
      setSpeechStyle('Upbeat, bubbly influencer cadence, stylish vocal fry, secretly encyclopedic');
      setTonePrompt('fashion-forward socialite who acts casual but drops mind-blowing astrophysics and historical facts with nonchalant glam');
      setCatchphrase('Literally obsessed with that correct answer, darling!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-stone-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Create Dynamic AI Host Persona
              </h3>
              <p className="text-xs text-stone-400">
                Custom voice, tone, and personality for your game show
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Quick Idea Chips */}
          <div>
            <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1.5">
              Instant Persona Inspirations:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPresetIdea('pirate')}
                className="px-3 py-1 text-xs rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/20 transition cursor-pointer"
              >
                🏴‍☠️ Pirate Captain
              </button>
              <button
                type="button"
                onClick={() => applyPresetIdea('cyberpunk')}
                className="px-3 py-1 text-xs rounded-xl bg-stone-800 hover:bg-stone-700 text-cyan-300 border border-cyan-500/20 transition cursor-pointer"
              >
                🤖 Rogue Cyber-AI
              </button>
              <button
                type="button"
                onClick={() => applyPresetIdea('valley')}
                className="px-3 py-1 text-xs rounded-xl bg-stone-800 hover:bg-stone-700 text-pink-300 border border-pink-500/20 transition cursor-pointer"
              >
                ✨ Glam Genius Influencer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Host Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-stone-800 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
                placeholder="e.g. Duke Von Trivia"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Emoji Icon
              </label>
              <input
                type="text"
                value={avatarEmoji}
                onChange={(e) => setAvatarEmoji(e.target.value)}
                className="w-full bg-stone-800 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-center text-white focus:outline-none focus:border-amber-400 transition"
                maxLength={4}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1">
              Title / Subtitle
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-stone-800 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
              placeholder="e.g. Master of Obscure Curiosities"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1">
              Gemini Voice Profile (TTS & Live Audio)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as const).map(
                (v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVoiceName(v)}
                    className={`py-2 px-1 text-center rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      voiceName === v
                        ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md'
                        : 'bg-stone-800 text-stone-300 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {v}
                  </button>
                )
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1">
              Personality & Humor Guidelines (Prompt)
            </label>
            <textarea
              rows={2}
              value={tonePrompt}
              onChange={(e) => setTonePrompt(e.target.value)}
              className="w-full bg-stone-800 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition resize-none"
              placeholder="Describe how the host talks, roasts bad guesses, and celebrates wins..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1">
              Speech Synthesis Style (gemini-3.8-flash-tts)
            </label>
            <input
              type="text"
              value={speechStyle}
              onChange={(e) => setSpeechStyle(e.target.value)}
              className="w-full bg-stone-800 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
              placeholder="e.g. Dramatic, theatrical, punctuated with theatrical gasps"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1">
              Signature Catchphrase
            </label>
            <input
              type="text"
              value={catchphrase}
              onChange={(e) => setCatchphrase(e.target.value)}
              className="w-full bg-stone-800 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
              placeholder="e.g. Absolutely sensational!"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-950/60 border-t border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-stone-400 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <Check className="w-4 h-4" /> Save Host Persona
          </button>
        </div>
      </div>
    </div>
  );
};
