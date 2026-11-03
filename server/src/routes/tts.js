
import express from 'express';
import { EdgeTTS } from 'node-edge-tts';

const router = express.Router();

const TELUGU_VOICES = {
  female: 'te-IN-ShrutiNeural',
  male: 'te-IN-MohanNeural'
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateAudio(text, voice) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[ARNA TTS] Attempt ${attempt}/${maxAttempts}`);

      const tts = new EdgeTTS({
        voice,
        lang: 'te-IN',
        timeout: 45000
      });

      const chunks = [];

      for await (const chunk of tts.streamAudio(text)) {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else if (chunk instanceof Uint8Array) {
          chunks.push(Buffer.from(chunk));
        }
      }

      if (chunks.length === 0) {
        throw new Error('No audio chunks received from Edge TTS.');
      }

      const audio = Buffer.concat(chunks);

      if (audio.length === 0) {
        throw new Error('Generated audio is empty.');
      }

      console.log('[ARNA TTS] Audio generated:', audio.length, 'bytes');

      return audio;

    } catch (error) {
      const message = error.message || '';

      const retryable =
        /429|No audio chunks|empty|ECONNRESET|ETIMEDOUT|timeout|socket|network/i.test(message);

      console.error(`[ARNA TTS] Attempt ${attempt} failed:`, message);

      if (!retryable || attempt === maxAttempts) {
        throw error;
      }

      const delay = attempt * 5000;
      console.log(`[ARNA TTS] Retrying in ${delay / 1000} seconds...`);

      await wait(delay);
    }
  }
}

router.post('/', async (req, res) => {
  try {
    const { text, gender = 'female' } = req.body || {};

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide text.'
      });
    }

    if (text.length > 3000) {
      return res.status(400).json({
        success: false,
        message: 'Text cannot exceed 3000 characters.'
      });
    }

    const voice = gender === 'male'
      ? TELUGU_VOICES.male
      : TELUGU_VOICES.female;

    console.log('[ARNA TTS] Starting:', voice);

    const audioBuffer = await generateAudio(text.trim(), voice);

    if (res.destroyed) return;

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audioBuffer.length),
      'Cache-Control': 'no-store'
    });

    return res.status(200).end(audioBuffer);

  } catch (error) {
    console.error('[ARNA TTS ERROR]', error);

    if (!res.headersSent && !res.destroyed) {
      return res.status(503).json({
        success: false,
        message: 'Telugu audio service is temporarily unavailable. Please try again.',
        error: error.message
      });
    }
  }
});

export default router;
