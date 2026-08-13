import { Router } from 'express';
import { callGroq } from '../services/ai.service';
import { BASE_PROMPT } from '../prompts';
import { basePrompt as nodeBasePrompt } from '../defaults/node';
import { basePrompt as reactBasePrompt } from '../defaults/react';
import { AIMessage, ErrorResponse, TemplateResponse } from '../types';

const router = Router();

router.post('/', async (req, res) => {
  const prompt = req.body?.prompt;

  if (typeof prompt !== 'string' || !prompt.trim()) {
    const errorResponse: ErrorResponse = { error: 'prompt is required' };
    res.status(400).json(errorResponse);
    return;
  }

  const messages: AIMessage[] = [
    {
      role: 'user',
      content:
        "Return either node or react based on what you think this project should be. Only return a single word, either 'node' or 'react'. Do not return anything extra\n\n" + prompt.trim(),
    },
  ];

  try {
    const answer = (await callGroq(messages, 200)).trim().toLowerCase().split(/\s+/)[0];

    if (answer === 'react') {
      const response: TemplateResponse = {
        prompts: [
          BASE_PROMPT,
          `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n `,
        ],
        uiPrompts: [reactBasePrompt],
      };
      res.json(response);
    } else if (answer === 'node') {
      const response: TemplateResponse = {
        prompts: [
          BASE_PROMPT,
          `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${nodeBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`,
        ],
        uiPrompts: [nodeBasePrompt],
      };
      res.json(response);
    } else {
      const errorResponse: ErrorResponse = { error: 'The AI returned an unsupported template type' };
      res.status(502).json(errorResponse);
    }
  } catch (error) {
    console.error('[Orin API] Template request failed:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to process template request' };
    res.status(500).json(errorResponse);
  }
});

export default router; 
