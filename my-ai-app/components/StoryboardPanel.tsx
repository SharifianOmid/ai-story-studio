
import React, { useState } from 'react';
import type { Scene } from '../types';
// Added VolumeIcon to imports
import { ImageIcon, TextIcon, RefreshIcon, VolumeIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';

interface StoryboardPanelProps {
  scene: Scene;
  styleGuide: string;
  imageStatus: {
    url: string | null;
    isLoading: boolean;
    error: string | null;
  };
  onUpdatePrompt: (newPrompt: string) => void;
  onRegenerate: () => void;
}

export const StoryboardPanel: React.FC<StoryboardPanelProps> = ({ scene, imageStatus, onRegenerate }) => {
  const [langTab, setLangTab] = useState<'FA' | 'EN' | 'AR'>('FA');

  const getDescription = () => {
    if (langTab === 'FA') return scene.sceneDescriptionPersian;
    if (langTab === 'EN') return scene.sceneDescriptionEnglish;
    return scene.sceneDescriptionArabic;
  };

  return (
    <div className="bg-gray-800/90 rounded-3xl shadow-xl overflow-hidden border border-gray-700/50 flex flex-col md:flex-row h-full group hover:border-indigo-500/40 transition-all duration-300">
      <div className="relative w-full md:w-1/2 aspect-video bg-gray-900 flex items-center justify-center overflow-hidden">
        {imageStatus.isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner />
            <span className="text-xs text-indigo-300">در حال تولید...</span>
          </div>
        ) : imageStatus.url ? (
          <img src={imageStatus.url} className="w-full h-full object-cover transition-transform duration-700" alt={`Scene ${scene.sceneNumber}`} />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="text-red-400 text-sm font-bold">{imageStatus.error || "خطای بارگذاری"}</div>
            <button 
              onClick={onRegenerate}
              className="bg-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-500 transition"
            >
              تلاش مجدد
            </button>
          </div>
        )}
        
        <div className="absolute top-4 right-4 bg-indigo-600/90 backdrop-blur-md text-white w-10 h-10 flex items-center justify-center rounded-xl font-bold shadow-xl border border-white/20">
          {scene.sceneNumber}
        </div>

        {imageStatus.url && !imageStatus.isLoading && (
          <button 
            onClick={onRegenerate}
            className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md hover:bg-black/80 text-white p-3 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-lg border border-white/10"
            title="تولید مجدد تصویر این صحنه"
          >
            <RefreshIcon />
          </button>
        )}
      </div>

      <div className="p-8 w-full md:w-1/2 space-y-6 flex flex-col justify-center">
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
             <h4 className="font-bold text-sky-400 text-lg flex items-center gap-2"><TextIcon /> متن صحنه</h4>
             <div className="flex bg-gray-900/50 p-1 rounded-xl gap-1 border border-gray-700">
               {['FA', 'EN', 'AR'].map(t => (
                 <button key={t} onClick={() => setLangTab(t as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${langTab === t ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800'}`}>{t}</button>
               ))}
             </div>
          </div>
          <p className={`text-gray-200 text-base leading-relaxed h-24 overflow-y-auto pr-2 ${langTab === 'EN' ? 'ltr text-left italic' : 'rtl text-right font-medium'}`}>
            {getDescription()}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 pt-4 border-t border-gray-700/50">
          <div className="bg-gray-900/40 p-3 rounded-2xl border border-amber-500/10">
            <h5 className="text-[10px] text-amber-400 font-bold mb-1 uppercase tracking-widest flex items-center gap-1">
              {/* VolumeIcon is now correctly imported */}
              <VolumeIcon className="w-3 h-3" /> فضای صوتی
            </h5>
            <p className="text-[11px] text-gray-400 italic">
              {scene.soundAtmosphere || "Ambient background"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
