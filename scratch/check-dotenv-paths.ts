import fs from 'fs';
import path from 'path';

function checkEnvPaths() {
  const pathsToCheck = [
    path.resolve(__dirname, '../.env'),                                     // workspace root
    path.resolve(__dirname, '../apps/backend/.env'),                       // apps/backend/.env
    path.resolve(__dirname, '../../.env'),                                  // parent of workspace
    path.resolve(process.cwd(), '.env'),                                    // cwd .env
    path.resolve(process.cwd(), '../../.env'),
  ];

  console.log('🔍 Checking .env file locations...\n');
  for (const p of pathsToCheck) {
    const exists = fs.existsSync(p);
    console.log(`Path: ${p}`);
    console.log(`  Exists: ${exists ? 'YES ✅' : 'NO ❌'}`);
    if (exists) {
      const content = fs.readFileSync(p, 'utf-8');
      const hasGeminiKey = /GEMINI_API_KEY\s*=\s*\S+/.test(content);
      const hasOpenAIKey = /OPENAI_API_KEY\s*=\s*\S+/.test(content);
      const hasLlmProvider = /LLM_PROVIDER\s*=\s*\S+/.test(content);
      console.log(`  Contains LLM_PROVIDER: ${hasLlmProvider}`);
      console.log(`  Contains GEMINI_API_KEY: ${hasGeminiKey}`);
      console.log(`  Contains OPENAI_API_KEY: ${hasOpenAIKey}`);
    }
    console.log('--------------------------------------------------');
  }
}

checkEnvPaths();
