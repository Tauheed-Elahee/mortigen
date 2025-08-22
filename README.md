# AI Text Processor

A simple Netlify application that uses ChatGPT to improve and enhance text input.

## Features

- Clean, responsive web interface
- Text input with AI processing
- Netlify Functions for secure API handling
- Real-time loading states
- Error handling and validation

## Setup

1. Deploy this project to Netlify
2. In your Netlify site settings, go to Environment Variables
3. Add a new environment variable:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (get one from https://platform.openai.com/api-keys)

## How it works

1. User enters text in the input field
2. Clicks "Process with AI" button
3. Text is sent to a Netlify Function
4. The function calls OpenAI's ChatGPT API with predetermined context
5. AI response is displayed below the input

## AI Context

The AI is configured to:
- Improve clarity and readability
- Fix grammar and spelling errors
- Enhance overall quality while maintaining original meaning
- Make text more engaging and professional
- Answer questions if the input is a question

## Local Development

```bash
npm install
netlify dev
```

Make sure to set your `OPENAI_API_KEY` in a `.env` file for local development.