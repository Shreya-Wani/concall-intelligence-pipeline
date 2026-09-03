import '../apps/backend/src/config/env';
import axios from 'axios';

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;

  const modelsToTest = [
    'gemini-2.5-flash-latest',
    'gemini-3.6-flash',
    'gemini-1.5-flash-latest',
    'gemini-2.0-flash-exp',
    'gemini-2.5-pro',
  ];

  for (const model of modelsToTest) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      console.log(`Testing model endpoint: ${model}...`);
      const res = await axios.post(
        url,
        {
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Hello, respond with JSON {"status": "ok"}' }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        },
        { timeout: 10000 }
      );

      console.log(`✅ SUCCESS (${model}):`, res.data?.candidates?.[0]?.content?.parts?.[0]?.text);
      return model;
    } catch (err: any) {
      console.log(`❌ FAILED (${model}): ${err.response?.status} - ${err.response?.data?.error?.message || err.message}`);
    }
  }
}

testGemini();
