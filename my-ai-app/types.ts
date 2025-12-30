
export interface Character {
  name: string;
  age: string;
  appearance: string;
  personality: string;
}

export interface FormData {
  storyDuration: string;
  sceneDuration: string;
  imageStyle: string;
  locations: string[];
  storyText: string;
  storyDetails: string;
  characters: Character[];
  educationalText: string;
}

export interface StoryInput {
  storyDuration: string;
  sceneDuration: string;
  imageStyle: string;
  locations: string[];
  storyText: string;
  storyDetails: string;
  characters: string;
  characterDetails: string;
  educationalText: string;
  numScenes: number;
}

export interface Scene {
  sceneNumber: number;
  sceneDescriptionPersian: string;
  sceneDescriptionEnglish: string;
  sceneDescriptionArabic: string;
  imagePromptEnglish: string;
  imagePromptArabic: string;
  imagePromptPersian: string;
  soundAtmosphere?: string;
}

export interface StoryboardResponse {
  styleGuideEnglish: string;
  scenes: Scene[];
}
