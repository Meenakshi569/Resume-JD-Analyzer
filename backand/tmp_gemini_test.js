const { GoogleGenAI } = require('@google/genai');
const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema');
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });

const interviewReportSchema = z.object({
  matchScore: z.number(),
  technicalQuestions: z.array(z.object({ question: z.string(), intention: z.string(), answer: z.string() })),
  behavioralQuestions: z.array(z.object({ question: z.string(), intention: z.string(), answer: z.string() })),
  skillGaps: z.array(z.object({ skill: z.string(), severity: z.enum(['low','medium','high']) })),
  preparationPlan: z.array(z.object({ day: z.number(), focus: z.string(), tasks: z.array(z.string()) })),
  title: z.string(),
});

const prompt = `Generate a detailed interview report for a candidate using the following information.

Resume: I build responsive user experiences and lead frontend architecture in agile teams.
Self Description: I build responsive user experiences and lead frontend architecture in agile teams.
Job Description: Senior frontend engineer role requiring React, TypeScript, and modern UX.

Return a JSON object with these fields:
- title: a concise job-specific title for the role.
- matchScore: a numeric score from 0 to 100.
- technicalQuestions: an array of at least 3 interview technical questions with intention and model answer.
- behavioralQuestions: an array of at least 3 interview behavioral questions with intention and model answer.
- skillGaps: an array of at least 1 skill gap with severity (low/medium/high).
- preparationPlan: an array of at least 3 daily preparation steps with focus and tasks.

Use the resume and self description to personalize the report and make the answers practical and role-specific.
`;

(async () => {
  try {
    const response = await ai.models.generateContent({
      model: 'models/gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: zodToJsonSchema(interviewReportSchema),
      }
    });
    console.log('RAW_TEXT:');
    console.log(response.text);
  } catch (err) {
    console.error(err);
  }
})();
