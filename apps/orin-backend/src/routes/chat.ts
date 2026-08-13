import { Router } from 'express';
import { callGroq } from '../services/ai.service';
import { getSystemPrompt } from '../prompts';
import { AIMessage, ChatResponse, ErrorResponse } from '../types';

const router = Router();
const MAX_COMPLETION_TOKENS = 6000;

router.post('/', async (req, res) => {
  const userMessages = req.body?.messages;

  if (!Array.isArray(userMessages)) {
    const errorResponse: ErrorResponse = { error: 'messages must be an array' };
    res.status(400).json(errorResponse);
    return;
  }

  const messages = userMessages.flatMap((message: unknown): AIMessage[] => {
    if (!message || typeof message !== 'object') return [];

    const { content, role } = message as { content?: unknown; role?: unknown };
    if (typeof content !== 'string' || !content.trim()) return [];

    return [
      {
        // Only the backend controls system messages.
        role: role === 'assistant' ? 'assistant' : 'user',
        content: content.trim(),
      },
    ];
  });

  if (messages.length === 0) {
    const errorResponse: ErrorResponse = { error: 'At least one message is required' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const groqMessages: AIMessage[] = [
      {
        role: 'system',
        content: getSystemPrompt(),
      },
      ...messages,
    ];

    const output = await callGroq(groqMessages, MAX_COMPLETION_TOKENS);

    const response: ChatResponse = {
      response: output,
    };

    res.json(response);
  } catch (error) {
    console.error('[Orin API] Chat request failed:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to process chat request' };
    res.status(500).json(errorResponse);
  }
});

export default router; 
