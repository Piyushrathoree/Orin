// src/inngest/functions.ts
import { generateText } from 'ai';
import { inngest } from './client';
import { google } from "@ai-sdk/google";

export const demoFunction = inngest.createFunction(
    { id: 'demo-function', triggers: { event: 'demo/generate' } },
    async ({ event, step }) => {
        const result = await step.run('generate-text', async () => {
            return await generateText({
                model: google('gemini-2.5-flash'),
                prompt: '2+2+5',
            });
        });
    },
);
 