
import React, { useState } from 'react';
import type { StoryInput, FormData, Character } from '../types';
import { BookIcon, BrainIcon, ChevronLeftIcon, ChevronRightIcon, SparklesIcon, UserGroupIcon } from './icons';

interface StoryInputFormProps {
  onGenerate: (inputs: StoryInput, rawData: FormData) => void;
  initialValues?: FormData;
}

const initialFormDataState: FormData = {
    storyDuration: '3 دقیقه',
    sceneDuration: '10 ثانیه',
    imageStyle: 'انیمیشن سه بعدی',
    locations: ['مدرسه'],
    storyText: '',
    storyDetails: '',
    characters: [{ name: '', age: '', appearance: '', personality: '' }],
    educationalText: '',
};

const locationOptions = ['مدرسه', 'مسجد', 'خیابان', 'خانه', 'جنگل', 'طبیعت'];
const TOTAL_STEPS = 4;

export const StoryInputForm: React.FC<StoryInputFormProps> = ({ onGenerate, initialValues }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialValues || initialFormDataState);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData((prev) => {
      const currentLocations = prev.locations;
      if (checked) {
        return { ...prev, locations: [...currentLocations, value] };
      } else {
        return { ...prev, locations: currentLocations.filter((loc) => loc !== value) };
      }
    });
  };

  const handleNumCharactersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = Math.max(1, Math.min(10, Number(e.target.value)));
    setFormData(prev => {
        const currentCharacters = prev.characters;
        if (num > currentCharacters.length) {
            const newChars = Array(num - currentCharacters.length).fill({ name: '', age: '', appearance: '', personality: '' });
            return { ...prev, characters: [...currentCharacters, ...newChars] };
        } else {
            return { ...prev, characters: currentCharacters.slice(0, num) };
        }
    });
  };

  const handleCharacterChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const updatedCharacters = [...formData.characters];
    updatedCharacters[index] = { ...updatedCharacters[index], [name]: value };
    setFormData(prev => ({ ...prev, characters: updatedCharacters }));
  };


  const handleNext = () => setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  const handlePrev = () => setStep((prev) => Math.max(prev - 1, 1));
  
  const parseDurationToSeconds = (durationStr: string): number => {
      const parts = durationStr.split(' ');
      if (parts.length < 2) return 0;
      const value = parseInt(parts[0], 10);
      const unit = parts[1];
      if (isNaN(value)) return 0;

      if (unit.startsWith('دقیقه')) return value * 60;
      if (unit.startsWith('ثانیه')) return value;
      return 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.storyText.trim() === '' || formData.educationalText.trim() === '') {
        alert('لطفا متن داستان و محتوای آموزشی را وارد کنید.');
        return;
    }
     if (formData.characters.some(c => c.name.trim() === '' || c.appearance.trim() === '' || c.personality.trim() === '')) {
        alert('لطفا نام، ویژگی‌های ظاهری و شخصیتی همه شخصیت‌ها را وارد کنید.');
        return;
    }
    if (formData.locations.length === 0) {
        alert('لطفا حداقل یک مکان اصلی برای داستان انتخاب کنید.');
        return;
    }

    const totalSeconds = parseDurationToSeconds(formData.storyDuration);
    const sceneSeconds = parseDurationToSeconds(formData.sceneDuration);

    if (sceneSeconds <= 0) {
        alert('مدت زمان هر سکانس باید بیشتر از صفر باشد.');
        return;
    }

    const numScenes = Math.round(totalSeconds / sceneSeconds);
    
    if (numScenes < 1) {
        alert('با توجه به زمان‌بندی، حداقل یک صحنه باید وجود داشته باشد. لطفا زمان کل یا زمان سکانس را تنظیم کنید.');
        return;
    }
    
    const characterSummary = formData.characters.map((c, i) => c.name.trim() || `شخصیت ${i+1}`).join(' و ');
    const characterDetails = formData.characters.map((c, i) => 
        `شخصیت ${i + 1}: ${c.name.trim()}\n- سن: ${c.age.trim() || 'نامشخص'}\n- ویژگی‌های ظاهری: ${c.appearance.trim()}\n- ویژگی‌های شخصیتی: ${c.personality.trim()}`
    ).join('\n---\n');

    const finalInputs: StoryInput = {
        ...formData,
        characters: characterSummary,
        characterDetails: characterDetails,
        numScenes: numScenes,
    };

    onGenerate(finalInputs, formData);
  };
  
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-center text-sky-300 flex items-center justify-center gap-2"><SparklesIcon />قدم اول: اطلاعات کلی داستان</h3>
            <div>
              <label htmlFor="storyDuration" className="block text-md font-medium text-gray-300 mb-2">مدت زمان داستان</label>
              <select name="storyDuration" id="storyDuration" value={formData.storyDuration} onChange={handleChange} className="w-full p-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition">
                {['1 دقیقه', '2 دقیقه', '3 دقیقه', '4 دقیقه', '5 دقیقه', '10 دقیقه', '15 دقیقه', '20 دقیقه', '30 دقیقه'].map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sceneDuration" className="block text-md font-medium text-gray-300 mb-2">مدت زمان هر سکانس</label>
              <select name="sceneDuration" id="sceneDuration" value={formData.sceneDuration} onChange={handleChange} className="w-full p-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition">
                {['5 ثانیه', '10 ثانیه', '15 ثانیه', '20 ثانیه', '30 ثانیه', '1 دقیقه'].map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="imageStyle" className="block text-md font-medium text-gray-300 mb-2">سبک تصاویر داستان</label>
              <select name="imageStyle" id="imageStyle" value={formData.imageStyle} onChange={handleChange} className="w-full p-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition">
                {['فیلم', 'انیمیشن دو بعدی', 'انیمیشن سه بعدی', 'انیمه', 'واقع گرایانه'].map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
                <label className="block text-md font-medium text-gray-300 mb-2">مکان های اصلی داستان (چند انتخاب)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 p-3 bg-gray-700 border border-gray-600 rounded-xl">
                    {locationOptions.map(loc => (
                        <label key={loc} className="flex items-center gap-2 text-gray-200 cursor-pointer">
                            <input type="checkbox" value={loc} checked={formData.locations.includes(loc)} onChange={handleLocationChange} className="w-5 h-5 accent-indigo-500 bg-gray-600 rounded border-gray-500 focus:ring-indigo-500" />
                            {loc}
                        </label>
                    ))}
                </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-center text-sky-300 flex items-center justify-center gap-2"><BookIcon />قدم دوم: متن و جزئیات داستان</h3>
            <div>
                <label htmlFor="storyText" className="block text-md font-medium text-gray-300 mb-2">متن اصلی داستان</label>
                <textarea id="storyText" name="storyText" value={formData.storyText} onChange={handleChange} rows={8} className="w-full p-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition placeholder:text-gray-500" placeholder="یکی بود یکی نبود..."></textarea>
            </div>
            <div>
                <label htmlFor="storyDetails" className="block text-md font-medium text-gray-300 mb-2">جزئیات یا ملاحظات</label>
                <textarea id="storyDetails" name="storyDetails" value={formData.storyDetails} onChange={handleChange} rows={4} className="w-full p-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition placeholder:text-gray-500" placeholder="نکات مهم، تغییرات ناگهانی داستان یا تاکیدهای خاص را اینجا بنویسید..."></textarea>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-center text-sky-300 flex items-center justify-center gap-2"><UserGroupIcon />قدم سوم: شخصیت‌ها</h3>
            <div className="flex items-center justify-center gap-4">
              <label htmlFor="numCharacters" className="block text-md font-medium text-gray-300">تعداد شخصیت‌ها:</label>
              <input type="number" id="numCharacters" name="numCharacters" min="1" max="10" value={formData.characters.length} onChange={handleNumCharactersChange} className="w-20 p-2 text-center bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition" />
            </div>
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                {formData.characters.map((char, index) => (
                    <div key={index} className="p-4 bg-gray-900/50 border border-gray-700 rounded-xl space-y-3">
                        <h4 className="font-bold text-sky-400">شخصیت {index + 1}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input type="text" name="name" placeholder="نام" value={char.name} onChange={(e) => handleCharacterChange(index, e)} className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500" />
                            <input type="text" name="age" placeholder="سن" value={char.age} onChange={(e) => handleCharacterChange(index, e)} className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500" />
                        </div>
                        <textarea name="appearance" placeholder="ویژگی‌های ظاهری" value={char.appearance} onChange={(e) => handleCharacterChange(index, e)} rows={2} className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"></textarea>
                        <textarea name="personality" placeholder="ویژگی‌های شخصیتی" value={char.personality} onChange={(e) => handleCharacterChange(index, e)} rows={2} className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"></textarea>
                    </div>
                ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-center text-sky-300 flex items-center justify-center gap-2"><BrainIcon/>قدم چهارم: محتوای آموزشی</h3>
            <p className="text-sm text-gray-400 text-center">متن آموزشی خود (مثلا از یک کتاب درسی یا فایل PDF) را اینجا کپی کنید.</p>
            <textarea name="educationalText" value={formData.educationalText} onChange={handleChange} rows={12} className="w-full p-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition placeholder:text-gray-500" placeholder="درس امروز درباره چرخه آب است..."></textarea>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-800/70 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-xl max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="min-h-[480px]">
          {renderStepContent()}
        </div>
        
        <div className="mt-8 flex justify-between items-center">
          <button type="button" onClick={handlePrev} disabled={step === 1} className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-gray-200 font-bold rounded-full hover:bg-gray-500 transition disabled:opacity-50 disabled:cursor-not-allowed">
            <ChevronRightIcon/>
            <span>قبلی</span>
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-700 rounded-full"><div className="h-2 bg-indigo-500 rounded-full transition-all duration-500" style={{width: `${(step/TOTAL_STEPS)*100}%`}}></div></div>
          </div>

          {step < TOTAL_STEPS ? (
            <button type="button" onClick={handleNext} className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white font-bold rounded-full hover:bg-indigo-600 transition shadow-lg">
              <span>بعدی</span>
              <ChevronLeftIcon/>
            </button>
          ) : (
            <button type="submit" className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white font-bold rounded-full hover:bg-green-600 transition shadow-lg animate-pulse">
              <span>ساخت استوری‌برد</span>
              <SparklesIcon/>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
