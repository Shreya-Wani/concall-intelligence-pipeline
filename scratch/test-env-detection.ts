import '../apps/backend/src/config/env';

function verifySafeEnv() {
  const provider = (process.env.LLM_PROVIDER || '').toLowerCase();
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);

  console.log(`\n========================================`);
  console.log(`🔒 SAFE ENVIRONMENT DIAGNOSTIC REPORT`);
  console.log(`LLM_PROVIDER: "${provider}"`);
  console.log(`GEMINI_API_KEY configured: ${hasGeminiKey ? 'YES ✅' : 'NO ❌'}`);
  console.log(`OPENAI_API_KEY configured: ${hasOpenAIKey ? 'YES ✅' : 'NO ❌'}`);
  console.log(`========================================\n`);
}

verifySafeEnv();
