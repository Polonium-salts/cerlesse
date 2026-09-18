import type { DictEntry, LanguageOption } from "./types.js";

export const SUPPORTED_LANGS: LanguageOption[] = [
  { code: "zh", name: "中文 (简体)", nativeName: "中文", voiceLang: "zh-CN" },
  { code: "en", name: "英语 (English)", nativeName: "English", voiceLang: "en-US" },
  { code: "ja", name: "日语 (日本語)", nativeName: "日本語", voiceLang: "ja-JP" },
  { code: "ko", name: "韩语 (한국어)", nativeName: "한국어", voiceLang: "ko-KR" },
  { code: "fr", name: "法语 (Français)", nativeName: "Français", voiceLang: "fr-FR" },
  { code: "de", name: "德语 (Deutsch)", nativeName: "Deutsch", voiceLang: "de-DE" },
  { code: "es", name: "西语 (Español)", nativeName: "Español", voiceLang: "es-ES" },
  { code: "ru", name: "俄语 (Русский)", nativeName: "Русский", voiceLang: "ru-RU" }
];

// 本地离线高频词典（毫秒级极速直出，无需等待网络）
export const LOCAL_DICTIONARY: Record<string, Record<string, DictEntry>> = {
  // 中译英
  "苹果": {
    en: {
      translation: "Apple",
      phonetic: "/ˈæp.əl/",
      partOfSpeech: "n.",
      definition: "一种通常呈圆形、表皮为红黄绿色的温带水果；苹果公司 (Apple Inc.) 代称。",
      examples: [
        { src: "一天一苹果，医生远离我。", dst: "An apple a day keeps the doctor away." },
        { src: "她咬了一口红苹果。", dst: "She took a bite of the crisp red apple." }
      ]
    },
    ja: {
      translation: "リンゴ (林檎)",
      phonetic: "[rin-go]",
      partOfSpeech: "名詞",
      definition: "バラ科の落葉高木、またはその果実。",
      examples: [{ src: "おいしいリンゴを食べる。", dst: "吃美味的苹果。" }]
    },
    ko: {
      translation: "사과 (Sagwa)",
      phonetic: "[sa-gwa]",
      partOfSpeech: "명사",
      definition: "사과나무의 열매; 또한 사죄(谢罪)의 뜻도 가짐.",
      examples: [{ src: "빨간 사과。", dst: "红苹果。" }]
    }
  },
  "香蕉": {
    en: {
      translation: "Banana",
      phonetic: "/bəˈnæn.ə/",
      partOfSpeech: "n.",
      definition: "一种弯曲的长形热带水果，黄色果皮，果肉甘甜软糯。",
      examples: [{ src: "猴子喜欢吃香蕉。", dst: "Monkeys love eating bananas." }]
    }
  },
  "人工智能": {
    en: {
      translation: "Artificial Intelligence (AI)",
      phonetic: "/ˌɑːtɪˈfɪʃl ɪnˈtelɪdʒəns/",
      partOfSpeech: "n. phrase",
      definition: "由机器特别是计算机系统所展现的人类智能模拟与自主决策技术。",
      examples: [
        { src: "人工智能正在重塑现代科技。", dst: "Artificial intelligence is reshaping modern technology." }
      ]
    }
  },
  "你好": {
    en: {
      translation: "Hello / Hi",
      phonetic: "/həˈləʊ/",
      partOfSpeech: "int.",
      definition: "通用的问候语与致意口语。",
      examples: [
        { src: "你好！见到你很高兴。", dst: "Hello! Nice to meet you." }
      ]
    },
    ja: {
      translation: "こんにちは (Konnichiwa)",
      phonetic: "[kon-ni-chi-wa]",
      partOfSpeech: "挨拶",
      definition: "日间常用的礼貌问候语。",
      examples: [{ src: "皆さん、こんにちは！", dst: "大家中午好！" }]
    }
  },
  "谢谢": {
    en: {
      translation: "Thank you / Thanks",
      phonetic: "/θæŋk juː/",
      partOfSpeech: "phrase",
      definition: "表达感谢、感激或客气的通用礼貌用语。",
      examples: [{ src: "非常感谢你的耐心帮助。", dst: "Thank you very much for your kind help." }]
    },
    ja: {
      translation: "ありがとう (Arigatou)",
      phonetic: "[a-ri-ga-tou]",
      partOfSpeech: "挨拶",
      definition: "感谢の言葉。",
      examples: [{ src: "どうもありがとうございます。", dst: "非常感谢。" }]
    }
  },
  "机器学习": {
    en: {
      translation: "Machine Learning (ML)",
      phonetic: "/məˈʃiːn ˈlɜːnɪŋ/",
      partOfSpeech: "n.",
      definition: "人工智能核心分支，使系统能从经验数据中自动学习与改进算法性能。",
      examples: [
        { src: "深度学习是机器学习的重要子集。", dst: "Deep learning is a key subset of machine learning." }
      ]
    }
  },
  "世界": {
    en: {
      translation: "World",
      phonetic: "/wɜːld/",
      partOfSpeech: "n.",
      definition: "地球、人类社会或全部存在之总体宇宙。",
      examples: [{ src: "世界你好！", dst: "Hello, World!" }]
    }
  },
  // 英译中
  "apple": {
    zh: {
      translation: "苹果；苹果树；苹果公司",
      phonetic: "/ˈæp.əl/",
      partOfSpeech: "n.",
      definition: "A round fruit with firm, white flesh and a green, red, or yellow skin.",
      examples: [
        { src: "An apple a day keeps the doctor away.", dst: "一天一苹果，医生远离我。" }
      ]
    }
  },
  "hello": {
    zh: {
      translation: "你好；喂；问候",
      phonetic: "/həˈləʊ/",
      partOfSpeech: "int. / n.",
      definition: "Used when meeting or greeting someone, or answering the phone.",
      examples: [
        { src: "Hello! How are you doing today?", dst: "你好！你今天过得怎么样？" }
      ]
    }
  },
  "translate": {
    zh: {
      translation: "翻译；转化；解释",
      phonetic: "/trænzˈleɪt/",
      partOfSpeech: "v.",
      definition: "To express the sense of words or text in another language.",
      examples: [
        { src: "Can you translate this sentence for me?", dst: "你能帮我翻译这个句子吗？" }
      ]
    }
  }
};
