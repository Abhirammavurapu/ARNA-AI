
export function detectLanguageStyle(text = '') {
  const message = String(text).trim();

  if (/[\u0C00-\u0C7F]/.test(message)) {
    return 'TELUGU';
  }

  const words = message.toLowerCase().match(/[a-z]+/g) || [];
  if (words.length === 0) {
    return 'ENGLISH';
  }

  const teluguWords = new Set([
    'nenu', 'naaku', 'naku', 'naa', 'naatho', 'natho',
    'neeku', 'neku', 'meeku', 'miku', 'nuvvu',
    'nuv', 'meeru', 'memu', 'manam', 'mana', 'maa',
    'ela', 'yela', 'unnava', 'unnavu', 'unnav', 'unnaru',
    'vunnava', 'vunnavu', 'vunnav', 'vunnaru',
    'untava', 'untaru', 'enti', 'emiti', 'enduku', 'evaru',
    'evvaru', 'ekkada', 'eppudu', 'em', 'emi', 'cheppu',
    'cheppandi', 'cheppava', 'cheppali', 'cheptava', 'cheptanu', 'chey',
    'cheyyi', 'cheyyandi', 'chesava', 'chesanu', 'chesaru',
    'chestunnav', 'chesthunav', 'chestunnaru', 'chesthunaru',
    'kavali', 'kaavali', 'kavala', 'ledu', 'leduga', 'undi',
    'undhi', 'unnadi', 'unna', 'nerpinchu', 'nerchuko',
    'nerchukovali', 'telusu', 'teliyadu', 'telidu', 'kuda',
    'kauda', 'kaani', 'kani', 'chala', 'chaala', 'konchem',
    'ippudu', 'ivala', 'eeroju', 'repu', 'ninna', 'bagunnava',
    'baagunnava', 'bagunnanu', 'baagunnanu', 'vachava',
    'vachanu', 'vastava', 'vastanu', 'vellava', 'vellanu',
    'vellali', 'avunu', 'kaadu', 'kadu', 'sare', 'aithe',
    'kosam', 'nunchi', 'ivvu',
    'ivvandi', 'chudu', 'chudali', 'chustunna', 'randi',
    'akka', 'nanna', 'inka', 'tinu', 'tinava', 'tinanu',
    'chesuko', 'chesukondi', 'avtundi', 'avutundi',
    'pettu', 'pettandi', 'raayi', 'chadhuvu', 'matladu',
    'matladandi', 'sahayam'
  ]);

  return words.some(word => teluguWords.has(word))
    ? 'TELUGU'
    : 'ENGLISH';
}

export function buildSystemPrompt({
  voice = false,
  lang = 'en-US',
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

  const language = detectLanguageStyle(currentMessage);

  const parts = [
    `You are ARNA, a friendly, intelligent and helpful AI assistant.`,

    `STRICT LANGUAGE RULES:

    The detected language of the latest user message is: ${language}.
    REQUIRED RESPONSE LANGUAGE: ${language === 'TELUGU' ? 'Telugu' : 'English'}.
    Follow this requirement for the entire response, regardless of earlier conversation.

    RULE 1 - ENGLISH:
    If the latest user message is English, reply only in English.

    RULE 2 - TELUGU SCRIPT:
    If the latest user message is Telugu, reply in natural Telugu script.

    RULE 3 - TELUGU USING ENGLISH LETTERS:
    If the user writes Telugu using English letters (Roman Telugu),
    understand it as Telugu and reply in Telugu script, not English or Roman Telugu.

    RULE 4 - MIXED LANGUAGE:
    If the user mixes Telugu and English, reply primarily in Telugu script.
    Keep technical terms such as Java, Python, React, SQL, HTML and CSS in English.

    STRICT RESTRICTIONS:
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
      For Telugu, generate natural Telugu sentences in Telugu script.
      Do not generate Roman Telugu for speech.`
    );
  }

  return parts.join('\n\n');
}
