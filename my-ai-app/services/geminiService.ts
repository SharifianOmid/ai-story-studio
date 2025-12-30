import { GoogleGenAI, Type, Modality } from "@google/genai";
// از دو نقطه استفاده می‌کنیم تا از پوشه services خارج شده و types را در ریشه پیدا کنیم
import type { StoryInput, StoryboardResponse } from '../types'; 

// ادامه کد...
// ۱. کلید API شما با موفقیت در کد جایگذاری شد
const MY_API_KEY = "AIzaSyBcxfHkbDR4NnH4T7LM0IfsfAklX_i_9-0";

// ۲. تنظیم اولیه کلاینت گوگل برای اتصال به هوش مصنوعی
const aiClient = new GoogleGenAI({ apiKey: MY_API_KEY });

/**
 * تولید ساختار متنی استوری‌برد شامل صحنه‌ها به زبان‌های مختلف
 */
export async function generateStoryboardFromInputs(inputs: StoryInput): Promise<StoryboardResponse> {
  const prompt = `
    **Role:** Animation Storyboard Expert.
    **Task:** Create ${inputs.numScenes} detailed scenes for a children's story.
    
    **CHARACTER CONSISTENCY:**
    - Style Guide: Describe characters' clothing, hair, and face in English with extreme detail.
    - Environment: ${inputs.locations.join(', ')}.

    **Instructions:**
    - Descriptions in Persian (FA), English (EN), Arabic (AR).
    - EN Image Prompts: Highly descriptive for AI generation.
    - Sound Atmosphere: Brief English description of ambient sounds/music (e.g., "birds chirping, soft piano").

    **Story:** ${inputs.storyText}
    **Education:** ${inputs.educationalText}
    **Characters:** ${inputs.characterDetails}

    Return JSON only.
  `;

  try {
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        styleGuideEnglish: { type: Type.STRING },
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sceneNumber: { type: Type.INTEGER },
              sceneDescriptionPersian: { type: Type.STRING },
              sceneDescriptionEnglish: { type: Type.STRING },
              sceneDescriptionArabic: { type: Type.STRING },
              imagePromptEnglish: { type: Type.STRING },
              imagePromptArabic: { type: Type.STRING },
              imagePromptPersian: { type: Type.STRING },
              soundAtmosphere: { type: Type.STRING },
            },
            required: ["sceneNumber", "sceneDescriptionPersian", "sceneDescriptionEnglish", "sceneDescriptionArabic", "imagePromptEnglish", "imagePromptArabic", "imagePromptPersian", "soundAtmosphere"],
          },
        },
      },
      required: ["styleGuideEnglish", "scenes"],
    };

    const response = await aiClient.models.generateContent({
      model: 'gemini-1.5-flash', // مدل فوق‌سریع و پایدار برای خروجی JSON
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) throw new Error("Output is empty");
    return JSON.parse(jsonText) as StoryboardResponse;
  } catch (error) {
    console.error("Storyboard Error:", error);
    throw new Error("خطا در تولید ساختار استوری‌برد.");
  }
}

/**
 * تولید تصویر برای هر صحنه بر اساس پرامپت انگلیسی
 */
export async function generateImageFromPrompt(prompt: string): Promise<string> {
  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.0-flash-exp', // مدل قدرتمند برای تولید تصویر
      contents: { parts: [{ text: `${prompt}. 3D Pixar animation style, highly detailed, vibrant colors, 8k.` }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image data");
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw new Error("خطا در ساخت تصویر.");
  }
}

/**
 * تولید صدای راوی (TTS) بر اساس متن صحنه‌ها
 */
export async function generateAudioFromText(text: string, voiceName: string, atmosphere: string = ""): Promise<string> {
  try {
    const simplifiedText = text.length > 1500 ? text.substring(0, 1500) + "..." : text;

    const response = await aiClient.models.generateContent({
      model: "gemini-2.0-flash-exp", 
      contents: [{ 
        parts: [{ 
          text: `Narrate with emotion. Background: ${atmosphere || "gentle music"}. Text: "${simplifiedText}"` 
        }] 
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName as any } },
        },
      },
    });
    
    const base64Data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Data) throw new Error("No audio bytes received");
    return base64Data;
  } catch (error: any) {
    console.error("Audio API Error:", error);
    throw new Error("خطا در تولید صدای راوی.");
  }
}

/**
 * تولید انیمیشن ۵ ثانیه‌ای بین دو تصویر
 */
export async function generateAnimation(startImg: string, endImg: string, prompt: string): Promise<string> {
  try {
    let op = await aiClient.models.generateVideos({
      model: 'veo-2.0-generate-preview', 
      prompt: `Cinematic camera move: ${prompt}`,
      image: { imageBytes: startImg.split(',')[1], mimeType: 'image/png' },
      config: { 
        resolution: '720p', 
        aspectRatio: '16:9', 
        lastFrame: { imageBytes: endImg.split(',')[1], mimeType: 'image/png' } 
      }
    });

    // انتظار برای اتمام پردازش ویدیو در سرورهای گوگل
    while (!op.done) {
      await new Promise(r => setTimeout(r, 10000));
      op = await aiClient.operations.getVideosOperation({ operation: op });
    }

    const uri = op.response?.generatedVideos?.[0]?.video?.uri;
    // اضافه کردن کلید به لینک برای اجازه دانلود در مرورگر
    const res = await fetch(`${uri}&key=${MY_API_KEY}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Animation Error:", error);
    throw new Error("خطا در ساخت انیمیشن.");
  }
}