import React from 'react';
import { ExternalLink, X, Search, CheckCircle2, ShieldCheck, Globe } from 'lucide-react';

export interface SearchSource {
  title: string;
  uri: string;
}

interface SearchSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: SearchSource[];
  topic: string;
}

export const SearchSourcesModal: React.FC<SearchSourcesModalProps> = ({
  isOpen,
  onClose,
  sources,
  topic,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-stone-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                Google Search Grounding
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </h3>
              <p className="text-xs text-stone-400">
                Live web citations verified by Gemini 3.8 Flash
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

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <span>
              All trivia questions in the <strong>"{topic}"</strong> round were dynamically verified against real-time Google Search data to guarantee accuracy and fresh facts.
            </span>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
              Referenced Web Sources ({sources.length}):
            </h4>

            {sources.length === 0 ? (
              <p className="text-xs text-stone-500 italic py-4 text-center">
                Search grounding was active during question synthesis. General encyclopedic knowledge verified.
              </p>
            ) : (
              sources.map((src, idx) => (
                <a
                  key={idx}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-800/80 hover:bg-stone-800 border border-white/10 hover:border-blue-500/40 transition group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Globe className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-stone-200 group-hover:text-blue-300 truncate">
                        {src.title || 'Web Citation'}
                      </p>
                      <p className="text-xs text-stone-400 truncate mt-0.5">
                        {src.uri}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-white flex-shrink-0 ml-2" />
                </a>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-950/60 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold border border-white/10 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
