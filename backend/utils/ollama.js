import ollama from "ollama";

// 1. Safe JSON parser
export function safeParseJSON(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// 2. Prompt builder
export function buildKeywordExtractPrompt(jdText) {
  return `
    You are a recruitment AI assistant.  
    Extract the most important role-related keywords from the Job Description below.  
    These keywords should reflect **skills, tools, certifications, and responsibilities**.  

    Job Description:
    """${jdText}"""

    ⚠️ Return ONLY valid JSON in this format:
    {
      "role": "<job role>",
      "skills": ["skill1", "skill2", "skill3", ...]
    }
  `;
}

// 3. Call Ollama
export async function callOllamaGenerate(prompt) {
  const response = await ollama.chat({
    model: "qwen2.5:3b", // or "llama2", "mistral"
    messages: [{ role: "user", content: prompt }],
  });
  return response.message?.content || "{}";
}
