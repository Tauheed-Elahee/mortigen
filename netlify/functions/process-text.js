exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Check if OpenAI API key is configured
    const apiKey = process.env.OPENAI_API_KEY;
    
    // Debug logging (remove this after testing)
    console.log('Environment check:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey ? apiKey.length : 0,
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('OPENAI'))
    });
    
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: `OpenAI API key not configured. Please add OPENAI_API_KEY to your Netlify environment variables. Available env keys: ${Object.keys(process.env).filter(key => key.includes('OPENAI')).join(', ') || 'none found'}` 
        }),
      };
    }

    // Parse the request body
    const { text } = JSON.parse(event.body);
    
    if (!text || text.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Text input is required' }),
      };
    }

    // Prepare the prompt with predetermined context
    const systemPrompt = `You are a helpful AI assistant that improves and enhances text. Your task is to:

1. Improve clarity and readability
2. Fix any grammar or spelling errors
3. Enhance the overall quality while maintaining the original meaning
4. Make the text more engaging and professional
5. If the text is a question, provide a helpful and informative answer

Please provide a refined version of the user's text that is clear, well-structured, and professional.`;

    const userPrompt = `Please improve and enhance the following text:\n\n${text}`;

    // Make request to OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API Error:', errorData);
      
      return {
        statusCode: openaiResponse.status,
        headers,
        body: JSON.stringify({ 
          error: `OpenAI API Error: ${errorData.error?.message || 'Unknown error'}` 
        }),
      };
    }

    const openaiData = await openaiResponse.json();
    const result = openaiData.choices[0]?.message?.content;

    if (!result) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'No response generated from AI' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result: result.trim() }),
    };

  } catch (error) {
    console.error('Function Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: `Server error: ${error.message}` 
      }),
    };
  }
};