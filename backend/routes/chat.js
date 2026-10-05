const express = require('express');
const axios = require('axios');

const router = express.Router();

router.post('/ask', async (req, res) => {
  try {
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'AI assistant is not configured',
        message: 'Add GEMINI_API_KEY to backend/.env before using the chatbot.',
      });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`;

    const response = await axios.post(url, {
      contents: [{
        parts: [{
          text: `SYSTEM INSTRUCTIONS:\n1. Role: You are a professional Smart Farming Assistant.\n2. LANGUAGE MATCHING: Respond in the exact same language the user uses.\n3. BREVITY: Never write more than 150 words.\n4. FORMATTING: Use Markdown and bullet points for steps.\n5. Give direct, practical farming advice and avoid unsupported claims.\n\nUSER QUESTION: ${message}`,
        }],
      }],
    }, {
      params: { key: apiKey },
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
    });

    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!reply) {
      return res.status(502).json({ error: 'Empty AI response from Google' });
    }

    return res.json({ reply });
  } catch (error) {
    console.error('AI request failed:', error.response?.data?.error?.message || error.message);

    return res.status(error.response?.status === 401 || error.response?.status === 403 ? 502 : 502).json({
      error: 'AI assistant request failed',
      message: error.response?.data?.error?.message || 'The AI provider did not return a usable response.',
    });
  }
});

module.exports = router;
