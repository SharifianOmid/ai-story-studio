import React, { useState, useCallback, useRef } from 'react';
import type { StoryInput, Scene, FormData } from './types';
import { StoryInputForm } from './components/StoryInputForm';
import { StoryboardPanel } from './components/StoryboardPanel';
import { LoadingSpinner } from './components/LoadingSpinner';
import { generateStoryboardFromInputs, generateImageFromPrompt, generateAudioFromText, generateAnimation } from './services/geminiService';
import { HeaderIcon, VolumeIcon, ManIcon, WomanIcon, ChildIcon, DownloadIcon, PlayIcon, RefreshIcon, VideoIcon, SparklesIcon } from './components/icons';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// --- ابزارهای کمکی برای مدیریت صدا ---
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

function bufferToWav(buffer: AudioBuffer) {
  const length = buffer.length * 2 + 44;
  const view = new DataView(new ArrayBuffer(length));
  const channels = [];
  const sampleRate = buffer.sampleRate;
  let offset = 0;

  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    offset += str.length;
  };

  writeString('RIFF');
  view.setUint32(offset, length - 8, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, buffer.numberOfChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * 2 * buffer.numberOfChannels, true); offset += 4;
  view.setUint16(offset, buffer.numberOfChannels * 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString('data');
  view.setUint32(offset, length - offset - 4, true); offset += 4;

  for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  let index = 0;
  while (index < buffer.length) {
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][index]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    index++;
  }
  return new Blob([view], { type: 'audio/wav' });
}

type ItemStatus = {
  url: string | null;
  isLoading: boolean;
  error: string | null;
};

type VoiceType = 'Kore' | 'Zephyr' | 'Puck';
type LanguageType = 'Persian' | 'English' | 'Arabic';

const App: React.FC = () => {
  const [storyInputs, setStoryInputs] = useState<StoryInput | null>(null);
  const [savedFormData, setSavedFormData] = useState<FormData | undefined>(undefined);
  const [storyboard, setStoryboard] = useState<Scene[]>([]);
  const [styleGuide, setStyleGuide] = useState<string>('');
  
  const [imageStatuses, setImageStatuses] = useState<Record<number, ItemStatus>>({});
  const [animationStatuses, setAnimationStatuses] = useState<Record<string, ItemStatus>>({});
  const [audioStatus, setAudioStatus] = useState<ItemStatus & { buffer: AudioBuffer | null }>({ url: null, isLoading: false, error: null, buffer: null });
  const [videoStatus, setVideoStatus] = useState<ItemStatus>({ url: null, isLoading: false, error: null });

  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [selectedVoice, setSelectedVoice] = useState<VoiceType>('Kore');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageType>('Persian');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // --- اصلاح شده: حذف وابستگی به محیط داخلی گوگل ---
  const checkApiKey = async () => {
    // در نسخه Netlify، فرض بر این است که کلید در geminiService ست شده است
    return true; 
  };

  const fetchImagesSequentially = async (scenes: Scene[], guide: string) => {
    for (const scene of scenes) {
      setImageStatuses(prev => ({ ...prev, [scene.sceneNumber]: { url: null, isLoading: true, error: null } }));
      try {
        const fullPrompt = `STYLE: ${guide}. ACTION: ${scene.imagePromptEnglish}`;
        const url = await generateImageFromPrompt(fullPrompt);
        setImageStatuses(prev => ({ ...prev, [scene.sceneNumber]: { url, isLoading: false, error: null } }));
      } catch (err) {
        setImageStatuses(prev => ({ ...prev, [scene.sceneNumber]: { url: null, isLoading: false, error: 'خطا' } }));
      }
    }
  };

  const handleGenerateStoryboard = useCallback(async (inputs: StoryInput, rawData?: FormData) => {
    setIsGeneratingStoryboard(true);
    setGlobalError(null);
    setStoryboard([]);
    setStyleGuide('');
    setImageStatuses({});
    setAnimationStatuses({});
    setAudioStatus({ url: null, isLoading: false, error: null, buffer: null });
    setVideoStatus({ url: null, isLoading: false, error: null });
    setStoryInputs(inputs);
    if (rawData) setSavedFormData(rawData);

    try {
      const res = await generateStoryboardFromInputs(inputs);
      setStoryboard(res.scenes);
      setStyleGuide(res.styleGuideEnglish);
      await fetchImagesSequentially(res.scenes, res.styleGuideEnglish);
    } catch (err) {
      setGlobalError("خطا در طراحی سناریو. لطفاً دوباره تلاش کنید.");
    } finally {
      setIsGeneratingStoryboard(false);
    }
  }, []);

  const handleRegenerateImage = useCallback(async (sceneNumber: number) => {
    const scene = storyboard.find(s => s.sceneNumber === sceneNumber);
    if (!scene || !styleGuide) return;
    setImageStatuses(prev => ({ ...prev, [sceneNumber]: { ...prev[sceneNumber], isLoading: true, error: null } }));
    try {
      const url = await generateImageFromPrompt(`STYLE: ${styleGuide}. ACTION: ${scene.imagePromptEnglish}`);
      setImageStatuses(prev => ({ ...prev, [sceneNumber]: { url, isLoading: false, error: null } }));
    } catch (err) {
      setImageStatuses(prev => ({ ...prev, [sceneNumber]: { ...prev[sceneNumber], isLoading: false, error: 'خطا' } }));
    }
  }, [storyboard, styleGuide]);

  const handlePlayAudio = () => {
    if (!audioStatus.buffer || !audioCtxRef.current) return;
    if (currentAudioSourceRef.current) {
        currentAudioSourceRef.current.stop();
    }
    const source = audioCtxRef.current.createBufferSource();
    source.buffer = audioStatus.buffer;
    source.connect(audioCtxRef.current.destination);
    source.start();
    currentAudioSourceRef.current = source;
  };

  const handleDownloadAudio = () => {
    if (!audioStatus.buffer) return;
    const wavBlob = bufferToWav(audioStatus.buffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `story_narration_${selectedLanguage}_${selectedVoice}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReadStory = async () => {
    if (storyboard.length === 0 || audioStatus.isLoading) return;
    setAudioStatus(prev => ({ ...prev, isLoading: true, error: null }));
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

    try {
      const fullText = storyboard.map(s => (selectedLanguage === 'Persian' ? s.sceneDescriptionPersian : selectedLanguage === 'Arabic' ? s.sceneDescriptionArabic : s.sceneDescriptionEnglish)).join('. ');
      const atmospheres = storyboard.map(s => s.soundAtmosphere || "cinematic background music").join(', ');
      const base64 = await generateAudioFromText(fullText, selectedVoice, atmospheres);
      const buffer = await decodeAudioData(decodeBase64(base64), audioCtxRef.current, 24000, 1);
      setAudioStatus({ url: 'ready', isLoading: false, error: null, buffer });
      
      const source = audioCtxRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtxRef.current.destination);
      source.start();
      currentAudioSourceRef.current = source;
    } catch (err: any) {
      setAudioStatus(prev => ({ ...prev, isLoading: false, error: err.message || "خطا در تولید صدا" }));
    }
  };

  const handleGenerateVideo = async () => {
    if (!audioStatus.buffer || videoStatus.isLoading) return;
    setVideoStatus({ url: null, isLoading: true, error: null });
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280; canvas.height = 720;
      const ctx = canvas.getContext('2d')!;
      const stream = canvas.captureStream(30);
      const vAudioCtx = new AudioContext();
      const dest = vAudioCtx.createMediaStreamDestination();
      const source = vAudioCtx.createBufferSource();
      source.buffer = audioStatus.buffer;
      source.connect(dest);
      const recorder = new MediaRecorder(new MediaStream([...stream.getTracks(), ...dest.stream.getTracks()]), { mimeType: 'video/webm;codecs=vp9' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      const videoReady = new Promise<string>(res => recorder.onstop = () => res(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }))));
      recorder.start();
      source.start();
      const sceneDur = audioStatus.buffer.duration / storyboard.length;
      for (const scene of storyboard) {
        const imgUrl = imageStatuses[scene.sceneNumber]?.url;
        if (imgUrl) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = imgUrl;
          await new Promise(r => img.onload = r);
          ctx.drawImage(img, 0, 0, 1280, 720);
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.fillRect(0, 600, 1280, 120);
          ctx.fillStyle = 'white';
          ctx.font = 'bold 28px Vazirmatn';
          ctx.textAlign = 'center';
          ctx.fillText(scene.sceneDescriptionPersian, 640, 670);
        }
        await new Promise(r => setTimeout(r, sceneDur * 1000));
      }
      recorder.stop();
      source.stop();
      const finalUrl = await videoReady;
      setVideoStatus({ url: finalUrl, isLoading: false, error: null });
    } catch (err) {
      setVideoStatus({ url: null, isLoading: false, error: "ساخت ویدیو با شکست مواجه شد." });
    }
  };

  const handleMakeAnimation = async (idx: number) => {
    const sA = storyboard[idx], sB = storyboard[idx+1];
    const key = `${sA.sceneNumber}-${sB.sceneNumber}`;
    setAnimationStatuses(prev => ({ ...prev, [key]: { url: null, isLoading: true, error: null } }));
    try {
      const url = await generateAnimation(imageStatuses[sA.sceneNumber].url!, imageStatuses[sB.sceneNumber].url!, sA.imagePromptEnglish);
      setAnimationStatuses(prev => ({ ...prev, [key]: { url, isLoading: false, error: null } }));
    } catch (err) {
      setAnimationStatuses(prev => ({ ...prev, [key]: { url: null, isLoading: false, error: "خطا" } }));
    }
  };

  const handleDownloadExcel = () => {
    const data = storyboard.map(s => ({ 
      'شماره صحنه': s.sceneNumber, 
      'توضیح فارسی': s.sceneDescriptionPersian, 
      'پرامپت تصویر': s.imagePromptEnglish 
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Storyboard");
    XLSX.writeFile(wb, "storyboard_prompts.xlsx");
  };

  const handleDownloadAllImagesZip = async () => {
    setIsDownloadingZip(true);
    const zip = new JSZip();
    for (const scene of storyboard) {
      const url = imageStatuses[scene.sceneNumber]?.url;
      if (url && url.startsWith('data:image')) {
        const base64Data = url.split(',')[1];
        zip.file(`scene_${scene.sceneNumber}.png`, base64Data, { base64: true });
      }
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = 'storyboard_images.zip';
    a.click();
    setIsDownloadingZip(false);
  };

  return (
    <div className="min-h-screen text-gray-200 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-4 bg-gradient-to-r from-indigo-600 to-sky-600 p-6 rounded-3xl shadow-2xl border border-white/20">
            <HeaderIcon />
            <div>
              <h1 className="text-3xl font-bold text-white">استودیو استوری‌برد حرفه‌ای</h1>
              <p className="text-sky-100 text-sm">تولید محتوای آموزشی و سینمایی با هوش مصنوعی</p>
            </div>
          </div>
        </header>

        <main>
          {!storyInputs ? (
            <StoryInputForm onGenerate={handleGenerateStoryboard} initialValues={savedFormData} />
          ) : (
            <div className="space-y-12">
              {isGeneratingStoryboard && (
                <div className="flex flex-col items-center justify-center p-20 bg-gray-800/80 rounded-3xl border border-indigo-500/20">
                  <LoadingSpinner />
                  <p className="mt-6 text-xl text-indigo-300 font-bold animate-pulse">در حال خلق دنیای شما...</p>
                </div>
              )}
              
              {globalError && <div className="p-6 bg-red-900/40 border border-red-500 rounded-3xl text-center text-red-100 font-bold">{globalError}</div>}

              {storyboard.length > 0 && !globalError && (
                <div className="animate-fadeIn">
                  <div className="p-8 bg-gray-800/60 backdrop-blur-xl rounded-[40px] shadow-3xl border border-white/5 mb-12">
                    <div className="flex flex-col lg:flex-row gap-8">
                      <div className="flex-1 space-y-6">
                        <h2 className="text-2xl font-bold text-sky-400 flex items-center gap-3"><SparklesIcon /> تنظیمات زبان و صدای راوی</h2>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-black/30 p-4 rounded-2xl space-y-3">
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">انتخاب زبان</p>
                            <div className="flex gap-2">
                              {[{ id: 'Persian', label: 'فارسی' }, { id: 'English', label: 'EN' }, { id: 'Arabic', label: 'العربية' }].map(l => (
                                <button key={l.id} onClick={() => setSelectedLanguage(l.id as any)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${selectedLanguage === l.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                                  {l.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="bg-black/30 p-4 rounded-2xl space-y-3">
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">انتخاب نوع صدا</p>
                            <div className="flex gap-2">
                              <button onClick={() => setSelectedVoice('Kore')} className={`flex-1 p-2 rounded-xl border ${selectedVoice === 'Kore' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-gray-800 border-gray-700'}`}><ManIcon /></button>
                              <button onClick={() => setSelectedVoice('Zephyr')} className={`flex-1 p-2 rounded-xl border ${selectedVoice === 'Zephyr' ? 'bg-pink-600 border-pink-400 text-white' : 'bg-gray-800 border-gray-700'}`}><WomanIcon /></button>
                              <button onClick={() => setSelectedVoice('Puck')} className={`flex-1 p-2 rounded-xl border ${selectedVoice === 'Puck' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-gray-800 border-gray-700'}`}><ChildIcon /></button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <button onClick={handleReadStory} disabled={audioStatus.isLoading} className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl transition-all disabled:opacity-50">
                            {audioStatus.isLoading ? <LoadingSpinner /> : <VolumeIcon />}
                            <span>{audioStatus.url ? 'بازتولید صدای راوی و موسیقی' : 'تولید صدای راوی و فضای سینمایی'}</span>
                          </button>
                          
                          {audioStatus.buffer && (
                            <div className="flex gap-2">
                              <button onClick={handlePlayAudio} className="flex-1 bg-gray-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-gray-600"><PlayIcon /> پخش</button>
                              <button onClick={handleDownloadAudio} className="flex-1 bg-gray-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-gray-600"><DownloadIcon /> دانلود صوت</button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 bg-black/40 p-8 rounded-[35px] border border-purple-500/20 text-center space-y-6 flex flex-col justify-center">
                        <h3 className="text-xl font-bold text-purple-400 flex items-center justify-center gap-2"><VideoIcon /> تولید فیلم نهایی</h3>
                        {!videoStatus.url ? (
                          <button onClick={handleGenerateVideo} disabled={!audioStatus.buffer || videoStatus.isLoading} className="w-full h-44 bg-gradient-to-br from-purple-700/50 to-indigo-700/50 rounded-3xl font-bold flex flex-col items-center justify-center gap-4 border border-purple-400/20 disabled:opacity-30">
                            {videoStatus.isLoading ? <LoadingSpinner /> : <VideoIcon className="w-12 h-12" />}
                            <span className="text-lg">تولید فیلم HD با زیرنویس</span>
                          </button>
                        ) : (
                          <div className="space-y-4">
                            <video src={videoStatus.url} controls className="w-full rounded-2xl border-2 border-white/10" />
                            <a href={videoStatus.url} download="final_movie.webm" className="block w-full bg-purple-600 py-3 rounded-xl font-bold shadow-lg">دانلود ویدیو</a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-8 pt-8 border-t border-white/5">
                      <button onClick={handleDownloadExcel} className="px-5 py-2.5 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-2"><DownloadIcon /> اکسل پرامپت‌ها</button>
                      <button onClick={handleDownloadAllImagesZip} disabled={isDownloadingZip} className="px-5 py-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50">{isDownloadingZip ? 'درحال فشرده‌سازی...' : 'دانلود تصاویر (ZIP)'}</button>
                    </div>
                  </div>

                  <div className="space-y-16">
                    {storyboard.map((scene, idx) => {
                      const key = `${scene.sceneNumber}-${storyboard[idx+1]?.sceneNumber}`;
                      const anim = animationStatuses[key];
                      return (
                        <div key={scene.sceneNumber}>
                          <StoryboardPanel 
                            scene={scene} 
                            styleGuide={styleGuide}
                            imageStatus={imageStatuses[scene.sceneNumber] || { url: null, isLoading: false, error: null }}
                            onUpdatePrompt={() => {}} 
                            onRegenerate={() => handleRegenerateImage(scene.sceneNumber)}
                          />
                          
                          {idx < storyboard.length - 1 && (
                            <div className="flex flex-col items-center py-12 gap-8">
                              {!anim?.url ? (
                                <button onClick={() => handleMakeAnimation(idx)} disabled={anim?.isLoading || !imageStatuses[scene.sceneNumber]?.url} className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/40 px-10 py-5 rounded-full font-bold shadow-xl transition-all">
                                  {anim?.isLoading ? <LoadingSpinner /> : <SparklesIcon />}
                                  <span className="ml-3">ساخت انیمیشن ۵ ثانیه‌ای</span>
                                </button>
                              ) : (
                                <div className="w-full max-w-2xl bg-black/60 p-4 rounded-[40px] border border-indigo-500/40 shadow-2xl">
                                  <video src={anim.url} controls className="w-full rounded-[30px]" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;