export function buildQuestionPrompt(jdText) {
  return `
    You are a recruitment AI assistant.  
    Generate up to 5 interview questions based on the following Job Description.  
    Focus on the required skills, tools, and responsibilities.

    Job Description:
    """${jdText}"""

    ⚠️ Return ONLY valid JSON in this format:
    {
      "questions": [
        "Question 1",
        "Question 2",
        "Question 3",
        "Question 4",
        "Question 5"
      ]
    }
  `;
}
