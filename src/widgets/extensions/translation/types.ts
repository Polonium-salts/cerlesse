export interface DictExample {
  src: string;
  dst: string;
}

export interface DictEntry {
  translation: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  examples?: DictExample[];
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  voiceLang: string;
}

export interface TranslationData {
  sourceText: string;
  targetLanguage: string;
  sourceLanguage?: string;
  translation: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  examples?: DictExample[];
  detectedLanguage?: string;
}
