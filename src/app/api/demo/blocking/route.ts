
import { generateText } from 'ai';
import { google } from "@ai-sdk/google";



export async function POST(req: Request) {
  const response = await generateText({
    model: google("gemini-2.5-flash"),
    prompt: "Hello, how are you?",
  });

  return Response.json({ message: response.text });
}

