
import { GoogleGenAI } from "@google/genai";
import { User, Goal } from '../types';

// Initialize Gemini client
// API Key must be provided via process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateIcebreaker = async (userA: User, userB: User): Promise<string> => {
  try {
    const prompt = `
      Generate a friendly, professional, and engaging single-sentence icebreaker message for a chat between two entrepreneurs.
      
      User A (Sender): ${userA.name}, Role: ${userA.role}, Industry: ${userA.industry}, Bio: ${userA.bio}, Tags: ${userA.tags.join(', ')}.
      User B (Recipient): ${userB.name}, Role: ${userB.role}, Industry: ${userB.industry}, Bio: ${userB.bio}, Tags: ${userB.tags.join(', ')}.
      
      The message should be from User A to User B. Mention a specific common interest or complementary skill. Keep it under 30 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || "Hey! I think our skills would complement each other perfectly.";
  } catch (error) {
    console.error("Error generating icebreaker:", error);
    return "Hey! I noticed we work in similar industries. Would love to connect.";
  }
};

export const generateSharedGoals = async (topic: string): Promise<string[]> => {
  try {
    const prompt = `
      Generate a list of 3 concise, actionable checklist items for a co-working session focusing on: "${topic}".
      Return ONLY the list items, one per line, no numbering.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || "";
    return text.split('\n').filter(line => line.trim().length > 0).slice(0, 3);
  } catch (error) {
    console.error("Error generating goals:", error);
    return ["Review current progress", "Identify blockers", "Set next milestones"];
  }
};

export const enhanceBio = async (currentBio: string): Promise<string> => {
  try {
    const prompt = `
      Rewrite the following entrepreneur bio to be more impactful, professional, and concise (max 25 words). 
      Highlight ambition and competence.
      
      Current Bio: "${currentBio}"
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || currentBio;
  } catch (error) {
    return currentBio;
  }
};

export const generateMeetingSummary = async (goals: Goal[], notes: string): Promise<string> => {
  try {
    const completedGoals = goals.filter(g => g.completed).map(g => g.text).join(', ');
    const pendingGoals = goals.filter(g => !g.completed).map(g => g.text).join(', ');
    
    const prompt = `
      You are an AI assistant summarizing a co-working session for entrepreneurs.
      
      Session Data:
      - Completed Goals: ${completedGoals || "None"}
      - Pending Goals: ${pendingGoals || "None"}
      - Shared Notes: "${notes}"
      
      Please provide a concise, encouraging summary of the session (max 60 words). 
      Highlight what was achieved and suggest a focus for next time based on the notes and pending goals.
      Do not use markdown formatting like **bold**.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || "Great session! You made progress on your goals. Keep it up next time.";
  } catch (error) {
    console.error("Error generating summary:", error);
    return "Session ended. Great work today! Review your notes to keep the momentum going.";
  }
};
