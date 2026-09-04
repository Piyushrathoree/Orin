import { Router } from 'express';
import { BASE_PROMPT } from '../prompts';
import { basePrompt as reactBasePrompt } from '../defaults/react';
import { ErrorResponse, TemplateResponse } from '../types';

const router = Router();

router.post('/', async (req, res) => {
  const prompt = req.body?.prompt;

  if (typeof prompt !== 'string' || !prompt.trim()) {
    const errorResponse: ErrorResponse = { error: 'prompt is required' };
    res.status(400).json(errorResponse);
    return;
  }

  // WebContainer only auto-starts Vite apps, so always use the React template.
  const response: TemplateResponse = {
    prompts: [
      BASE_PROMPT,
      `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n `,
    ],
  };
  res.json(response);
});

export default router;
