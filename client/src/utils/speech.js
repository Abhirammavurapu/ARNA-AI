// Helpers that turn chat Markdown into something pleasant to hear.

const EMOJI = /\p{Extended_Pictographic}|\u200d|\ufe0f/gu;

export function cleanForSpeech(text) {
  return String(text || '')
    .replace(/```[\s\S]*?(```|$)/g, ' ') // code blocks are not read out
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[*_~#^]+/g, '')
    .replace(EMOJI, '')
    .replace(/\s*\n\s*/g, '. ')
    .replace(/\.\s*\.+/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Split into chunks the speech engine handles reliably (long utterances get cut off on some browsers). */
export function chunkForSpeech(text, max = 180) {
  const sentences = text.match(/[^.!?।。！？]+[.!?।。！？]*\s*/g) || [text];
  const out = [];
  let cur = '';
  const push = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = '';
  };
  for (const s of sentences) {
    if (s.length > max) {
      push();
      let rest = s;
      while (rest.length > max) {
        let cut = rest.lastIndexOf(',', max);
        if (cut < max * 0.4) cut = rest.lastIndexOf(' ', max);
        if (cut < 1) cut = max;
        out.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1);
      }
      cur = rest;
    } else if ((cur + s).length > max) {
      push();
      cur = s;
    } else {
      cur += s;
    }
  }
  push();
  return out;
}

/**
 * Feed streamed text deltas in, get complete sentences out. Lets ARNA start talking
 * while the rest of the answer is still being generated.
 */
export function createSentenceSplitter(onSentence) {
  let buf = '';
  let inCode = false;
  const emit = (raw) => {
    const clean = cleanForSpeech(raw);
    if (clean && /[\p{L}\p{N}]/u.test(clean)) onSentence(clean);
  };
  return {
    push(delta) {
      buf += delta;
      // Skip fenced code entirely.
      while (true) {
        const fence = buf.indexOf('```');
        if (fence === -1) break;
        if (!inCode) {
          emit(buf.slice(0, fence));
          buf = buf.slice(fence + 3);
          inCode = true;
        } else {
          buf = buf.slice(fence + 3);
          inCode = false;
        }
      }
      if (inCode) {
        buf = '';
        return;
      }
      const re = /[.!?।。！？\n]+(\s|$)/g;
      let last = 0;
      let m;
      while ((m = re.exec(buf))) {
        const end = m.index + m[0].length;
        // Wait for more text if the terminator sits at the very end (might be "3.14" or "Dr.").
        if (end === buf.length && !/\n/.test(m[0])) break;
        const piece = buf.slice(last, end);
        if (piece.trim().length >= 12 || /[!?\n]/.test(m[0])) {
          emit(piece);
          last = end;
        }
      }
      buf = buf.slice(last);
    },
    flush() {
      if (!inCode) emit(buf);
      buf = '';
      inCode = false;
    },
  };
}
