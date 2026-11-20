export function formatFriendlyAIError(rawMsg: string): string {
  const safeMsg = String(rawMsg || 'AI service request failed.')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[redacted-key]')
    .replace(/AIza[A-Za-z0-9_-]{12,}/g, '[redacted-key]')
    .trim();
  const low = safeMsg.toLowerCase();

  if (
    low.includes('exceeded your current quota') ||
    low.includes('quota exceeded') ||
    low.includes('insufficient_quota') ||
    low.includes('http 429') ||
    low.includes('rate limit')
  ) {
    return 'Live AI rate limit or quota was reached on the selected provider. Please wait a moment, check provider billing/quota, or switch to another configured provider in Settings.';
  }

  if (
    low.includes('is not configured on the backend server') ||
    low.includes('no ai provider is configured on the server')
  ) {
    return safeMsg;
  }

  if (
    low.includes('incorrect api key') ||
    low.includes('invalid_api_key') ||
    low.includes('invalid api key') ||
    low.includes('api_key_invalid') ||
    low.includes('api key not valid') ||
    low.includes('http 401') ||
    low.includes('unauthorized')
  ) {
    if (low.includes('openai')) {
      return 'OpenAI API key was rejected or is invalid (HTTP 401). Verify OPENAI_API_KEY in backend Secrets / Environment Variables, or switch providers in Settings.';
    }
    if (low.includes('gemini') || low.includes('google')) {
      return 'Google Gemini API key was rejected or is invalid. Verify GEMINI_API_KEY in backend Secrets / Environment Variables, or switch providers in Settings.';
    }
    if (low.includes('groq')) {
      return 'Groq API key was rejected or is invalid. Verify GROQ_API_KEY in backend Secrets / Environment Variables.';
    }
    if (low.includes('openrouter')) {
      return 'OpenRouter API key was rejected or is invalid. Verify OPENROUTER_API_KEY in backend Secrets / Environment Variables.';
    }
    if (low.includes('mistral')) {
      return 'Mistral API key was rejected or is invalid. Verify MISTRAL_API_KEY in backend Secrets / Environment Variables.';
    }
    return 'Selected AI provider API key was rejected or is invalid (HTTP 401). Verify your key in backend Secrets / Environment Variables, or switch providers in Settings.';
  }

  return safeMsg;
}

export function shouldTriggerOnlineSearch(
  message: string,
  plugins: string[] = [],
  _subjectFocus?: string
): boolean {
  const hasWebSearchPlugin = plugins.some((p) => {
    const low = p.toLowerCase();
    return low.includes('web') || low.includes('search') || low.includes('syllabus');
  });
  if (hasWebSearchPlugin) return true;

  const trimmed = (message || '').trim();
  if (!trimmed || trimmed.length < 8) return false;

  // Skip casual greetings
  if (
    /^(hi+|hey+|hello+|yo+|good\s*(morning|afternoon|evening)|how\s+are\s+you|what'?s\s*up|thanks?|thank\s+you|ok(ay)?|bye)[\s!.?]*$/i.test(
      trimmed
    )
  ) {
    return false;
  }

  // Skip pure math expressions without research keywords
  if (/^[\d\s+\-*/^=().,xXyYzZ]+$/.test(trimmed)) {
    return false;
  }

  return /\b(search(\s+the\s+web|\s+online)?|look\s+up|find\s+(sources?|links?|articles?|papers?)|verify|citations?|references?|wikipedia|sources?|current|latest|recent|updated|today|this\s+year|202[0-9]|news|statistics|population\s+of|capital\s+of|who\s+is|president|prime\s+minister|noble|nobel|discovery|curriculum|syllabus(\s+topics)?|mostly\s+comes|frequently\s+examined|common\s+exam|past\s+paper|exam\s+pattern|likely\s+questions|kicd|knec|kcse|cbc|igcse|gcse|what\s+is\s+happening|research\s+online)\b/i.test(
    trimmed
  );
}

export function extractSourceDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
};

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  n: 'ⁿ',
};

function convertLatexInner(expr: string): string {
  let out = expr
    .replace(/\\text\{([^{}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^{}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^{}]+)\}/g, '$1')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\approx/g, '≈')
    .replace(/\\neq/g, '≠')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\rightarrow|\\to/g, '→')
    .replace(/\\leftrightarrow/g, '↔')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\degree|\^\\circ/g, '°');

  out = out.replace(/_\{([0-9+-]+)\}|_([0-9])/g, (_, grp, single) => {
    const chars = String(grp || single || '');
    return chars
      .split('')
      .map((ch) => SUBSCRIPT_MAP[ch] ?? ch)
      .join('');
  });

  out = out.replace(/\^\{([0-9+-n]+)\}|\^([0-9n])/g, (_, grp, single) => {
    const chars = String(grp || single || '');
    return chars
      .split('')
      .map((ch) => SUPERSCRIPT_MAP[ch] ?? ch)
      .join('');
  });

  return out.replace(/\s+/g, ' ').trim();
}

export function formatReadableProseMath(text: string): string {
  if (!text || (!text.includes('$') && !text.includes('\\'))) {
    return text;
  }
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, inner) => convertLatexInner(String(inner)))
    .replace(/(?<!\\)\$([^$\n]+?)\$/g, (full, inner) => {
      const s = String(inner || '').trim();
      // Preserve currency like "$5 and $10" when there are digits without math/latex cues
      if (/^\d+(?:[.,]\d+)?(?:\s|$)/.test(s) && !/[\\^_{}=+\-*/]/.test(s)) {
        return full;
      }
      return convertLatexInner(s);
    });
}

