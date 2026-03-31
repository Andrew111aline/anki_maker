/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Plus, 
  Trash2, 
  Settings, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  RefreshCw,
  ExternalLink,
  BookOpen,
  Layers,
  Terminal,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface AnkiCard {
  id: string;
  front: string;
  back: string;
  example: string;
  tags: string[];
}

interface AnkiConnectResponse {
  result: any;
  error: string | null;
}

// --- Constants ---

const DEFAULT_ANKI_URL = "http://localhost:8765";
const DEFAULT_DECK = "AI Generated";
const DEFAULT_MODEL = "Basic";

// --- App Component ---

export default function App() {
  const [inputText, setInputText] = useState('');
  const [cards, setCards] = useState<AnkiCard[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ankiUrl, setAnkiUrl] = useState(DEFAULT_ANKI_URL);
  const [deckName, setDeckName] = useState(DEFAULT_DECK);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null, message: string }>({ type: null, message: '' });

  // --- Gemini Integration ---

  const generateCards = async () => {
    if (!inputText.trim()) {
      setStatus({ type: 'error', message: 'Please enter some text first.' });
      return;
    }

    setIsGenerating(true);
    setStatus({ type: 'info', message: 'Gemini is analyzing your content...' });

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are an expert Anki card creator. Given the following text, generate a list of high-quality flashcards. 
        For each card, provide:
        - front: The question or term.
        - back: The answer or definition.
        - example: A sentence using the term.
        - tags: Relevant categories (array of strings).
        
        Text to analyze: "${inputText}"
        
        Return ONLY a JSON array of objects.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                front: { type: Type.STRING },
                back: { type: Type.STRING },
                example: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["front", "back", "example", "tags"],
            },
          },
        },
      });

      const generatedData = JSON.parse(response.text || "[]");
      const newCards = generatedData.map((c: any) => ({
        ...c,
        id: Math.random().toString(36).substr(2, 9)
      }));

      setCards(prev => [...newCards, ...prev]);
      setStatus({ type: 'success', message: `Successfully generated ${newCards.length} cards!` });
      setInputText('');
    } catch (error) {
      console.error("Generation error:", error);
      setStatus({ type: 'error', message: 'Failed to generate cards. Please check your API key or input.' });
    } finally {
      setIsGenerating(false);
    }
  };

  // --- AnkiConnect Integration ---

  const syncToAnki = async () => {
    if (cards.length === 0) return;

    setIsSyncing(true);
    setStatus({ type: 'info', message: 'Connecting to Anki...' });

    try {
      // 1. Create deck if it doesn't exist
      await fetch(ankiUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: "createDeck",
          version: 6,
          params: { deck: deckName }
        })
      });

      // 2. Add notes
      const notes = cards.map(card => ({
        deckName: deckName,
        modelName: DEFAULT_MODEL,
        fields: {
          Front: card.front,
          Back: `${card.back}<br><br><i>Example: ${card.example}</i>`
        },
        tags: card.tags
      }));

      const response = await fetch(ankiUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: "addNotes",
          version: 6,
          params: { notes }
        })
      });

      const result: AnkiConnectResponse = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setStatus({ type: 'success', message: `Successfully synced ${cards.length} cards to Anki!` });
      setCards([]); // Clear cards after sync
    } catch (error) {
      console.error("Sync error:", error);
      setStatus({ 
        type: 'error', 
        message: 'Could not connect to Anki. Ensure Anki is open with AnkiConnect installed and running at ' + ankiUrl 
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const removeCard = (id: string) => {
    setCards(cards.filter(c => c.id !== id));
  };

  const exportToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cards, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "anki_cards.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#141414] rounded-full flex items-center justify-center text-[#E4E3E0]">
            <Cpu size={24} />
          </div>
          <div>
            <h1 className="font-serif italic text-2xl leading-none">AI Anki Master</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-50 font-mono mt-1">Automated Workflow v1.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors rounded-full"
          >
            <Settings size={20} />
          </button>
          <div className="h-8 w-[1px] bg-[#141414]/20 mx-2" />
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-[10px] font-mono uppercase tracking-tighter opacity-60">
              {isSyncing ? 'Syncing...' : 'System Ready'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Input & Settings */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Input Section */}
          <section className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif italic text-lg flex items-center gap-2">
                <BookOpen size={18} />
                Content Source
              </h2>
              <span className="text-[10px] font-mono opacity-40 uppercase tracking-widest">Input Layer</span>
            </div>
            
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste text, vocabulary, or notes here to generate flashcards..."
              className="w-full h-48 p-4 bg-[#F5F5F5] border border-[#141414]/10 focus:border-[#141414] outline-none transition-all resize-none font-mono text-sm"
            />
            
            <button
              onClick={generateCards}
              disabled={isGenerating || !inputText.trim()}
              className="w-full mt-4 bg-[#141414] text-[#E4E3E0] py-4 flex items-center justify-center gap-2 hover:bg-[#141414]/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Zap size={18} />
              )}
              <span className="uppercase font-mono tracking-widest text-xs font-bold">
                {isGenerating ? 'Generating...' : 'Generate Cards'}
              </span>
            </button>
          </section>

          {/* Settings Section (Collapsible) */}
          <AnimatePresence>
            {showSettings && (
              <motion.section 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-[#141414] text-[#E4E3E0] p-6 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif italic text-lg flex items-center gap-2">
                    <Terminal size={18} />
                    Configuration
                  </h2>
                </div>
                
                <div className="space-y-4 font-mono text-xs">
                  <div>
                    <label className="block opacity-50 uppercase tracking-widest mb-2">AnkiConnect URL</label>
                    <input 
                      type="text" 
                      value={ankiUrl}
                      onChange={(e) => setAnkiUrl(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 p-2 outline-none focus:border-white/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block opacity-50 uppercase tracking-widest mb-2">Target Deck</label>
                    <input 
                      type="text" 
                      value={deckName}
                      onChange={(e) => setDeckName(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 p-2 outline-none focus:border-white/50 transition-all"
                    />
                  </div>
                  <div className="pt-2">
                    <p className="opacity-40 leading-relaxed">
                      Ensure Anki is open with the AnkiConnect plugin installed. 
                      Enable 'ANKICONNECT_WILDCARD_ORIGIN' in settings for web access.
                    </p>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Status Bar */}
          {status.type && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 border flex items-start gap-3 ${
                status.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' :
                status.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' :
                'bg-blue-50 border-blue-500 text-blue-800'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : 
               status.type === 'error' ? <AlertCircle size={18} className="shrink-0 mt-0.5" /> : 
               <RefreshCw size={18} className="shrink-0 mt-0.5 animate-spin" />}
              <p className="text-xs font-mono leading-tight">{status.message}</p>
            </motion.div>
          )}
        </div>

        {/* Right Column: Card Preview */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-[#141414] min-h-[600px] flex flex-col">
            <div className="p-4 border-b border-[#141414] flex justify-between items-center bg-[#F5F5F5]">
              <div className="flex items-center gap-2">
                <Layers size={18} />
                <h2 className="font-serif italic text-lg">Card Queue</h2>
                <span className="bg-[#141414] text-[#E4E3E0] text-[10px] px-2 py-0.5 font-mono rounded-full">
                  {cards.length}
                </span>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={exportToJson}
                  disabled={cards.length === 0}
                  className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors disabled:opacity-20"
                  title="Export to JSON"
                >
                  <Download size={18} />
                </button>
                <button 
                  onClick={syncToAnki}
                  disabled={cards.length === 0 || isSyncing}
                  className="bg-[#141414] text-[#E4E3E0] px-4 py-2 flex items-center gap-2 hover:bg-[#141414]/90 transition-all disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  <span className="uppercase font-mono tracking-widest text-[10px] font-bold">Sync to Anki</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[700px] p-4 space-y-4">
              {cards.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                  <Layers size={64} strokeWidth={1} />
                  <p className="font-serif italic mt-4">Queue is empty</p>
                  <p className="text-[10px] font-mono uppercase tracking-widest mt-2">Generate cards to begin</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {cards.map((card) => (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="group border border-[#141414]/10 p-4 hover:border-[#141414] transition-all relative"
                    >
                      <button 
                        onClick={() => removeCard(card.id)}
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest opacity-40 font-mono mb-1">Front</p>
                          <p className="font-medium text-sm">{card.front}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest opacity-40 font-mono mb-1">Back</p>
                          <p className="text-sm">{card.back}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-[#141414]/5">
                        <p className="text-[9px] uppercase tracking-widest opacity-40 font-mono mb-1">Example</p>
                        <p className="text-xs italic opacity-70">"{card.example}"</p>
                      </div>
                      
                      <div className="mt-3 flex flex-wrap gap-1">
                        {card.tags.map(tag => (
                          <span key={tag} className="text-[8px] font-mono uppercase border border-[#141414]/20 px-1.5 py-0.5 opacity-50">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
            
            <div className="p-4 border-t border-[#141414] bg-[#F5F5F5] text-[10px] font-mono opacity-40 uppercase tracking-widest flex justify-between">
              <span>Local Storage Active</span>
              <span>AnkiConnect Protocol v6</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-6xl mx-auto p-6 mt-12 border-t border-[#141414]/10 flex flex-col md:flex-row justify-between gap-8 pb-20">
        <div className="max-w-md">
          <h3 className="font-serif italic text-lg mb-2">How it works</h3>
          <p className="text-xs leading-relaxed opacity-60">
            This tool streamlines the Anki card creation process by leveraging Gemini AI to parse unstructured text into structured flashcards. 
            The cards are then pushed directly to your local Anki instance via the AnkiConnect API.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-serif italic text-lg mb-2">Resources</h3>
          <a href="https://foosoft.net/projects/anki-connect/" target="_blank" className="text-xs flex items-center gap-2 hover:underline">
            <ExternalLink size={12} /> AnkiConnect Documentation
          </a>
          <a href="https://apps.ankiweb.net/" target="_blank" className="text-xs flex items-center gap-2 hover:underline">
            <ExternalLink size={12} /> Download Anki Desktop
          </a>
        </div>
      </footer>
    </div>
  );
}
