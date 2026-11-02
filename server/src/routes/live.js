
import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

import env from '../config/env.js';
import AppError from '../utils/AppError.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';

router.post('/token', authenticate, aiLimiter, async (req, res, next) => {
  try {
    const apiKey = env.ai.gemini.key;

    if (!apiKey) {
      throw new AppError(
        'Gemini API key is not configured on the server.',
        503,
        'AI_NOT_CONFIGURED'
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const expireTime = new Date(
      Date.now() + 30 * 60 * 1000
    ).toISOString();

    const newSessionExpireTime = new Date(
      Date.now() + 60 * 1000
    ).toISOString();

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: ['AUDIO'],
            systemInstruction: `
You are ARNA, a friendly, helpful voice assistant.
Speak naturally and conversationally.
Keep answers clear and concise.
Help with everyday questions, learning, and interview preparation.
Do not claim to be a human.
`
          }
        }
      }
    });

    if (!token?.name) {
      throw new Error('Gemini did not return an ephemeral token.');
    }

    res.json({
      success: true,
      token: token.name,
      model: LIVE_MODEL,
      expiresAt: expireTime
    });
  } catch (err) {
    console.error('[ARNA] Gemini Live token error:', err.message);

    next(
      new AppError(
        'Unable to start ARNA Live voice. Please try again.',
        502,
        'LIVE_TOKEN_FAILED'
      )
    );
  }
});

export default router;
