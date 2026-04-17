const express = require('express');
const router = express.Router();

router.post('/ask', async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: "Message is required" });
    }

    // ✅ Dummy smart response (safe for demo)
    const reply = `🌱 Smart Farming Assistant:\n\nBased on your query "${userMessage}", I suggest checking weather conditions, soil quality, and crop type for better yield.`;

    res.json({ reply });

  } catch (error) {
    console.error("Chat error:", error.message);
    res.status(500).json({ error: "Chatbot failed" });
  }
});

module.exports = router;