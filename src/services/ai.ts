import { Settings } from '../db';
import { GoogleGenAI } from '@google/genai';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function* streamAIResponse(
  messages: ChatMessage[],
  settings: Settings
): AsyncGenerator<string, void, unknown> {
  const systemMessage = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const conversation = messages.filter(m => m.role !== 'system');

  if (settings.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: settings.apiKey || process.env.GEMINI_API_KEY || '' });
    
    // Convert messages to Gemini format
    // Gemini expects 'user' or 'model'
    const geminiMessages = conversation.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // We only send the last message to sendMessageStream, and the rest as history if we use Chat.
    // Or we can just use generateContentStream with all messages.
    const contents = conversation.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContentStream({
      model: settings.modelName || 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemMessage,
      }
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } else if (settings.provider === 'openai' || settings.provider === 'openrouter') {
    const baseUrl = settings.provider === 'openai' 
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        ...(settings.provider === 'openrouter' ? {
          'HTTP-Referer': window.location.origin,
          'X-Title': 'WP Plugin AI Builder'
        } : {})
      },
      body: JSON.stringify({
        model: settings.modelName,
        messages: messages,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error('No reader available');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices[0]?.delta?.content) {
              yield data.choices[0].delta.content;
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  } else if (settings.provider === 'ollama') {
    const response = await fetch(`${settings.ollamaUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: settings.modelName,
        messages: messages,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama Error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error('No reader available');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            yield data.message.content;
          }
        } catch (e) {
          // Ignore
        }
      }
    }
  }
}
