
export function detectLanguageStyle(text = '', fallbackLang = 'auto') {
  const message = String(text).trim();

  if (/[\u0C00-\u0C7F]/.test(message)) {
    return 'TELUGU';
  }
  if (/[\u0900-\u097F]/.test(message)) {
    return 'HINDI';
  }

  const words = message.toLowerCase().match(/[a-z]+/g) || [];

  const hindiWords = new Set([
    'aap', 'aapko', 'achha', 'acha', 'batao', 'bataiye',
    'chahiye', 'dhanyavaad', 'dijiye', 'kaise', 'kaisa',
    'kaisi', 'kahan', 'kab', 'karna', 'karo', 'kijiye',
    'kripya', 'kya', 'kyun', 'madad', 'mein', 'mujhe',
    'mujhko', 'nahi', 'nahin', 'samjhao', 'sikhao',
    'suno', 'theek', 'tum', 'tumhe', 'tumko', 'unka',
    'unko', 'vo', 'woh', 'yaar', 'yeh', 'mera', 'meri',
    'mere', 'hum', 'hume', 'hain', 'hai', 'hoon', 'hu',
    'bhasha', 'jawab', 'likho', 'boliye', 'bolo', 'seekhna',
  ]);
  if (words.some((word) => hindiWords.has(word))) {
    return 'HINDI';
  }

  const englishWords = new Set([
    'i', 'you', 'we', 'they', 'he', 'she', 'it', 'the', 'is',
    'are', 'am', 'was', 'were', 'do', 'does', 'did', 'can',
    'could', 'would', 'should', 'will', 'what', 'when', 'where',
    'who', 'why', 'how', 'please', 'tell', 'explain', 'show',
    'give', 'help', 'want', 'need', 'know', 'like', 'today',
    'weather', 'time', 'name', 'hello', 'hi', 'thanks', 'thank',
    'good', 'morning', 'about', 'not', 'this', 'that', 'my',
    'your', 'me', 'and', 'or', 'to', 'of', 'in', 'on', 'for',
    'with', 'from', 'have', 'has', 'had', 'make', 'let', 'teach',
    'learn', 'write', 'speak', 'talk', 'question', 'answer',
  ]);
  const isClearlyEnglish = words.some((word) => englishWords.has(word));

  const teluguWords = new Set([
    'nenu', 'naaku', 'naku', 'naa', 'naatho', 'natho',
    'neeku', 'neku', 'meeku', 'miku', 'mee', 'nuvvu',
    'nuv', 'meeru', 'memu', 'manam', 'mana', 'maa',
    'ela', 'elaa', 'yela', 'yelaa', 'unnava', 'unnavu', 'unnav', 'unnaru',
    'vunnava', 'vunnavu', 'vunnav', 'vunnaru',
    'untava', 'untaru', 'enti', 'emiti', 'enduku', 'endhuku', 'evaru',
    'evvaru', 'ekkada', 'eppudu', 'em', 'emi', 'yenti', 'cheppu',
    'cheppandi', 'cheppava', 'cheppali', 'cheptava', 'cheptanu', 'cheppanu',
    'chey', 'cheyyi', 'cheyyandi', 'cheyyali', 'chesava', 'chesanu', 'chesaru',
    'chesa', 'chestunnav', 'chesthunav', 'chestunnaru', 'chesthunaru',
    'matladutunnanu', 'maatladutunnanu', 'matladandi',
    'kavali', 'kaavali', 'kavala', 'ledu', 'leduga', 'undi',
    'undhi', 'unnadi', 'unna', 'bagundi', 'baagundi', 'bagundhi',
    'nerpinchu', 'nerchuko', 'nerchukovali', 'telusu', 'telsu',
    'teliyadu', 'telidu', 'kuda', 'kauda', 'kaani', 'kani',
    'chala', 'chaala', 'konchem', 'gurinchi', 'gurunchi', 'nunchi',
    'ippudu', 'ivala', 'eeroju', 'repu', 'ninna', 'bagunnava',
    'baagunnava', 'bagunnanu', 'baagunnanu', 'vachava',
    'vachanu', 'vastava', 'vastanu', 'vellava', 'vellanu',
    'vellali', 'avunu', 'kaadu', 'kadu', 'sare', 'aithe',
    'kosam', 'ivvu', 'ivvandi', 'andi', 'ayya',
    'chudu', 'chudali', 'chustunna', 'randi',
    'akka', 'nanna', 'inka', 'tinu', 'tinava', 'tinanu',
    'chesuko', 'chesukondi', 'avtundi', 'avutundi',
    'pettu', 'pettandi', 'raayi', 'chadhuvu', 'matladu',
    'matladandi', 'sahayam'
  ]);

  if (words.some((word) => teluguWords.has(word))) {
    return 'TELUGU';
  }
  if (isClearlyEnglish) {
    return 'ENGLISH';
  }
  if (fallbackLang.toLowerCase().startsWith('te')) {
    return 'TELUGU';
  }
  if (fallbackLang.toLowerCase().startsWith('hi')) {
    return 'HINDI';
  }
  return 'ENGLISH';
}

export function buildSystemPrompt({
  voice = false,
  lang = 'auto',
  name = '',
  mode = 'friendly',
  messages = [],
  latestMessage = '',
} = {}) {
  // Get the latest user message
  const currentMessage =
    latestMessage ||
    [...messages]
      .reverse()
      .find(message => message.role === 'user')
      ?.content ||
    '';

  const language = detectLanguageStyle(currentMessage, voice ? lang : 'auto');
  const languageName = {
    ENGLISH: 'English',
    HINDI: 'Hindi',
    TELUGU: 'Telugu',
  }[language] || 'English';

  const parts = [
    `You are ARNA, a friendly, intelligent and helpful AI assistant.`,

    `STRICT LANGUAGE RULES:

    The detected language of the latest user message is: ${language}.
    REQUIRED RESPONSE LANGUAGE: ${languageName}.
    Follow this requirement for the entire response, regardless of earlier conversation.

    RULE 1 - ENGLISH:
    If the latest user message is English, reply only in English.

    RULE 2 - HINDI:
    If the latest user message is Hindi, reply in natural Hindi using Devanagari script.

    RULE 3 - TELUGU SCRIPT:
    If the latest user message is Telugu, reply in natural Telugu script.

    RULE 4 - TELUGU USING ENGLISH LETTERS:
    If the user writes Telugu using English letters (Roman Telugu),
    understand it as Telugu and reply in Telugu script, not English or Roman Telugu.

    RULE 5 - MIXED LANGUAGE:
    If the user mixes Hindi or Telugu with English, reply primarily in the detected Indian language's script.
    Keep technical terms such as Java, Python, React, SQL, HTML and CSS in English.

    STRICT RESTRICTIONS:
    - Never write Hindi sentences using English letters; use Devanagari.
    - Never reply in Tenglish or Roman Telugu.
    - Never write Telugu sentences using English letters.
    - Never translate a Telugu question into an English answer.
    - Detect the language again for every new user message.
    - Always prioritize the latest user message.
    - Never use previous messages to decide the current language.
    - Switch languages immediately when the user switches languages.

    EXAMPLES:

    User: Hello ARNA, how are you?
    Assistant: Hello! I'm doing great. How can I help you?

    User: Nuvvu ela unnav?
    Assistant: నేను బాగున్నాను. మీరు ఎలా ఉన్నారు?

    User: Naaku Java nerpinchu.
    Assistant: తప్పకుండా! మనం Java నేర్చుకుందాం.

    User: What is React?
    Assistant: React is a JavaScript library used to build user interfaces.

    User: मुझे हिंदी में जवाब दो।
    Assistant: ज़रूर, मैं हिंदी में जवाब दूँगा।

    User: Mujhe Hindi mein jawab do.
    Assistant: ज़रूर, मैं हिंदी में जवाब दूँगा।

    User: నాకు Python నేర్పించు.
    Assistant: తప్పకుండా! నేను మీకు Python ను దశలవారీగా నేర్పిస్తాను.

    User: Nuvvu em chestunnav?
    Assistant: నేను మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను.

    User: Hi, naaku Java nerpinchu.
    Assistant: తప్పకుండా! నేను మీకు Java నేర్పిస్తాను.`,

    `PERSONALITY:
    Be friendly, helpful, respectful and conversational.
    Explain technical topics step by step.
    Be accurate and honest.
    Never invent facts or claim to be human.`,

    `FORMATTING:
    Use simple explanations.
    Use headings, lists and examples when helpful.
    Keep answers concise when appropriate.`,

    `SAFETY:
    Give general medical information only.
    Never diagnose or prescribe medicines.
    Recommend professional help when necessary.`
  ];

  if (mode === 'health') {
    parts.push(
      `You are ARNA Health Assistant.
      Give safe general wellness information.
      Never diagnose or prescribe medicines.
      Follow the detected response language.`
    );
  }

  if (mode === 'interview') {
    parts.push(
      `You are ARNA Interview Coach.
      Help with technical and HR interview preparation.
      Follow the detected response language.`
    );
  }

  if (mode === 'friendly') {
    parts.push(
      `You are ARNA Friendly Chat.
      Be warm, natural and conversational.
      Follow the detected response language.`
    );
  }

  if (name) {
    parts.push(`The user's name is ${name}.`);
  }

  if (voice) {
    parts.push(
      `Write the response as natural language ARNA can read aloud.
      Keep voice responses clear and concise.
      Speak in the detected language.
      For Hindi, generate natural Hindi sentences in Devanagari script.
      For Telugu, generate natural Telugu sentences in Telugu script.
      Do not generate Roman Hindi for speech.
      Do not generate Roman Telugu for speech.`
    );
  }

  return parts.join('\n\n');
}
