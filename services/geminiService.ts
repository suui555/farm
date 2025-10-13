
import { GoogleGenAI, Type } from "@google/genai";

// Conditionally initialize the Gemini AI client to prevent app crash if API key is missing.
let ai: GoogleGenAI | null = null;
export let isGeminiAvailable = false;

// The application will gracefully handle the absence of an API key by disabling AI features.
if (process.env.API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    isGeminiAvailable = true;
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI. AI features will be disabled.", error);
    isGeminiAvailable = false;
  }
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "The full name of the company or person.",
    },
    bank: {
      type: Type.STRING,
      description: "The full name of the bank, including the branch.",
    },
    bankCode: {
      type: Type.STRING,
      description: "The bank's identification code.",
    },
    accountNumber: {
        type: Type.STRING,
        description: "The payee's bank account number. If not present in the text, return an empty string.",
    },
    taxId: {
        type: Type.STRING,
        description: "The company's Tax ID (統一編號). If not present, return an empty string.",
    },
    address: {
        type: Type.STRING,
        description: "The company's address. If not present, return an empty string.",
    },
    remarks: {
        type: Type.STRING,
        description: "Any remarks or notes. If not present, return an empty string.",
    }
  },
  required: ["name", "bank", "bankCode", "accountNumber"],
};

interface ParsedVendor {
    name: string;
    bank: string;
    bankCode: string;
    accountNumber: string;
    taxId?: string;
    address?: string;
    remarks?: string;
}

export const parseVendorInfo = async (text: string): Promise<ParsedVendor | null> => {
  if (!ai || !isGeminiAvailable) {
    console.warn("Cannot parse vendor info: Gemini AI service is not available.");
    return null;
  }
  
  if (!text.trim()) {
    return null;
  }
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: text,
      config: {
        systemInstruction: `Parse the text which contains vendor information into a JSON object. Extract the company name, bank name with branch, bank code, account number, and if available, also extract the Tax ID (統一編號), address, and any remarks.`,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });
    
    const jsonString = response.text.trim();
    const parsedData = JSON.parse(jsonString) as ParsedVendor;
    return parsedData;

  } catch (error) {
    console.error("Error parsing vendor info with Gemini:", error);
    return null;
  }
};
