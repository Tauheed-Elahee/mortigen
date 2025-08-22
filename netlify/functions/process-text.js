// netlify/functions/process-text.js
// Stateless transform: transcript -> { front_matter, markdown } -> assembled .md

exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*', // tighten to your domain in prod
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'OpenAI API key not configured. Add OPENAI_API_KEY in your Netlify environment variables.'
        })
      };
    }

    let parsedBody = {};
    try {
      parsedBody = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const text = (parsedBody && parsedBody.text) ? String(parsedBody.text) : '';
    if (!text || !text.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text input is required' }) };
    }

    // ---- Rules (SYSTEM) ----
    const SYSTEM_PROMPT = [
      'You are a medical scribe formatter for oncology.',
      'Return JSON ONLY that matches the MortigenNote schema provided via Structured Outputs.',
      'Taxonomy terms must be lowercase, hyphenated slugs (e.g., "dan-lee", "catherine-doe").',
      'Author must be "dan-lee".',
      'Derive the patient\'s first name from the transcript; if no last name is present, use "doe".',
      'Do not invent facts; if unknown, omit.',
      'Markdown section headings must be EXACTLY and in this order:',
      'Reason for Consultation, HPI, Past Medical History, Medications, Allergies, Social History, Family History, Physical Exam, Investigations, Impression/Plan.',
      'Do NOT include code fences. Do NOT include any extra prose or keys beyond the schema.'
    ].join(' ');

    const defaults = {
      date: new Date().toISOString(),
      conditions: ['breast-cancer'],
      note_type: ['consult'],
      module: ['oncology'],
      anatomy: ['breast']
    };

    // ---- Structured Outputs schema ----
    const jsonSchema = {
      name: 'MortigenNote',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['front_matter', 'markdown'],
        properties: {
          front_matter: {
            type: 'object',
            additionalProperties: false,
            required: [
              'title',
              'date',
              'conditions',
              'note_type',
              'module',
              'authors',
              'patients',
              'anatomy',
              'params'
            ],
            properties: {
              title: { type: 'string' },
              date: { type: 'string' },
              conditions: { type: 'array', items: { type: 'string' } },
              note_type: { type: 'array', items: { type: 'string' } },
              module: { type: 'array', items: { type: 'string' } },
              authors: { type: 'array', items: { type: 'string' } },
              patients: { type: 'array', items: { type: 'string' } },
              anatomy: { type: 'array', items: { type: 'string' } },
              params: { type: 'object', additionalProperties: true }
            }
          },
          markdown: { type: 'string' }
        }
      }
    };

    // Single user message (stateless)
    const user =
      'TRANSCRIPT: """\n' + text + '\n"""' +
      '\n\nDEFAULTS: ' + JSON.stringify(defaults, null, 2);

    // ---- Call OpenAI Responses API ----
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: user }
        ],
        temperature: 0,
        text: {
          format: 'json_schema',
          json_schema: jsonSchema
        }
      })
    });

    if (!resp.ok) {
      let errObj = {};
      try { errObj = await resp.json(); } catch (e) {}
      console.error('OpenAI error:', errObj);
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({ error: (errObj && errObj.error && errObj.error.message) || 'OpenAI API error' })
      };
    }

    const data = await resp.json();

    // Prefer convenience field; fallback to nested content
    const raw =
      (data && data.output_text) ||
      (data && data.output && data.output[0] && data.output[0].content &&
       data.output[0].content[0] && data.output[0].content[0].text) ||
      '';

    if (!raw) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Empty model output' }) };
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = JSON.parse(String(raw).trim());
    }

    // ---- Harden taxonomy slugs post-parse ----
    function slug(s) {
      return String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Force author to dan-lee
    parsed.front_matter.authors = ['dan-lee'];

    // Ensure patient has a last name; if single-part slug, append "-doe"
    if (parsed.front_matter && Array.isArray(parsed.front_matter.patients) && parsed.front_matter.patients.length > 0) {
      parsed.front_matter.patients = parsed.front_matter.patients.map(function (p) {
        var s = slug(p);
        if (s.indexOf('-') === -1) s = s + '-doe';
        return s;
      });
    } else {
      parsed.front_matter.patients = ['patient-doe'];
    }

    // Normalize other taxonomy arrays
    ['conditions', 'note_type', 'module', 'anatomy'].forEach(function (k) {
      if (parsed.front_matter && Array.isArray(parsed.front_matter[k])) {
        parsed.front_matter[k] = parsed.front_matter[k].map(slug).filter(Boolean);
      }
    });

    // Assemble a .md file
    const mdFile =
      JSON.stringify(parsed.front_matter, null, 2) + '\n\n' + parsed.markdown + '\n';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        result: String(mdFile).trim(),
        data: parsed
      })
    };
  } catch (error) {
    console.error('Function Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error: ' + (error && error.message ? error.message : 'unknown') })
    };
  }
};
