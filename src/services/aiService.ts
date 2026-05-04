import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface AIAnalysis {
  incidentType: "MEDICAL" | "FIRE" | "CRIME" | "DISTURBANCE" | "OTHER";
  severityScore: number; // 1-10
  urgency: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  summary: string;
  recommendedResponders: string[];
  riskFactors: string[];
}

export async function analyzeIncident(description: string, initialType?: string): Promise<AIAnalysis> {
  if (!navigator.onLine) {
    return {
      incidentType: (initialType as any).toUpperCase() || "OTHER",
      severityScore: 5,
      urgency: "NORMAL",
      summary: description || "SOS Alert received (Offline).",
      recommendedResponders: ["Tanod"],
      riskFactors: ["Offline - No AI Analysis"]
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the following emergency SOS description and categorize it. 
      Initial reported type: ${initialType || 'Unknown'}
      Description: ${description}
      
      Respond in strict JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            incidentType: {
              type: Type.STRING,
              enum: ["MEDICAL", "FIRE", "CRIME", "DISTURBANCE", "OTHER"],
              description: "The primary category of the incident."
            },
            severityScore: {
              type: Type.NUMBER,
              description: "Severity score from 1 to 10 (10 being most severe)."
            },
            urgency: {
              type: Type.STRING,
              enum: ["LOW", "NORMAL", "HIGH", "CRITICAL"],
              description: "Urgency level based on time-sensitive risk."
            },
            summary: {
              type: Type.STRING,
              description: "A very brief (1-sentence) tactical summary of the situation."
            },
            recommendedResponders: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of specialized units needed (e.g., Tanod, BFP, PNP, Ambulance)."
            },
            riskFactors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Key risk elements identified (e.g., weapon present, elderly involved, fire spreading)."
            }
          },
          required: ["incidentType", "severityScore", "urgency", "summary", "recommendedResponders", "riskFactors"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result as AIAnalysis;
  } catch (error) {
    console.error("AI Analysis failed:", error);
    // Return sensible defaults if AI fails
    return {
      incidentType: (initialType as any) || "OTHER",
      severityScore: 5,
      urgency: "NORMAL",
      summary: description || "SOS Alert received.",
      recommendedResponders: ["Tanod"],
      riskFactors: ["Offline/Manual categorization fallback"]
    };
  }
}
