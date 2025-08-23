// netlify/functions/process-text.js
exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OpenAI API key not configured. Set OPENAI_API_KEY.' })
      };
    }

    let payload = {};
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

    const text = payload && payload.text ? String(payload.text) : '';
    if (!text.trim())
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text input is required' }) };

    // ---- Rules (SYSTEM) ----
    const SYSTEM_PROMPT = [
      'You are a medical scribe formatter for oncology.',
      'Return JSON ONLY that matches the MortigenNote schema via Structured Outputs.',
      'Taxonomy terms must be lowercase, hyphenated slugs (e.g., "dan-lee", "catherine-doe").',
      'Author must be "dan-lee".',
      'Derive the patient\'s first name; if no last name is present, use "doe".',
      'Do not invent facts; if unknown, omit.',
      'Markdown section headings must be EXACTLY and in this order:',
      'Reason for Consultation, HPI, Past Medical History, Medications, Allergies, Social History, Family History, Physical Exam, Investigations, Impression/Plan.',
      'No code fences. No extra prose or keys.'
    ].join(' ');

    const defaults = {
      date: new Date().toISOString(),
      conditions: ['breast-cancer'],
      note_type: ['consult'],
      module: ['oncology'],
      anatomy: ['breast']
    };

    // ---- STRICT Structured Outputs schema (all objects closed) ----
    const formatSchema = {
      type: 'json_schema',
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
              'title','date','conditions','note_type','module','authors','patients','anatomy','params'
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
              params: {
                type: 'object',
                additionalProperties: false, // <-- key fix
                properties: {
                  tnm: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      prefix: { type: 'string' },
                      T: { type: 'string' },
                      N: { type: 'string' },
                      M: { type: 'string' }
                    }
                  },
                  nodes: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      examined: { type: 'number' },
                      positive: { type: 'number' },
                      sentinel: { type: 'boolean' }
                    }
                  },
                  tumor_size_mm: { type: 'number' },
                  histology: { type: 'string' },
                  grade: { type: 'number' },
                  er_status: { type: 'string' },
                  er_allred: { type: 'number' },
                  pr_status: { type: 'string' },
                  pr_allred: { type: 'number' },
                  her2_status: { type: 'string' },
                  her2_ihc: { type: 'string' },
                  her2_fish: { type: 'string' },
                  dcis_present: { type: 'boolean' },
                  dcis_margin_mm: { type: 'number' },
                  surgery_date: { type: 'string' },
                  surgery_type: { type: 'string' },
                  oncotype_dx: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      score: { type: 'number' },
                      risk_9y_pct: { type: 'number' }
                    }
                  },
                  ecog: { type: 'number' },
                  menopausal_status: { type: 'string' },
                  featured: { type: 'boolean' },
                  lastmod: { type: 'string' }
                }
              }
            }
          },
          markdown: { type: 'string' }
        }
      }
    };

    const user =
      'TRANSCRIPT: """\n' + text + '\n"""' +
      '\n\nDEFAULTS: ' + JSON.stringify(defaults, null, 2);

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: user }
        ],
        temperature: 0,
        text: { format: formatSchema } // schema lives directly under text.format
      })
    });

    if (!resp.ok) {
      let errObj = {}; try { errObj = await resp.json(); } catch {}
      console.error('OpenAI error:', errObj);
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({ error: (errObj.error && errObj.error.message) || 'OpenAI API error' })
      };
    }

    const data = await resp.json();
    const raw =
      (data && data.output_text) ||
      (data && data.output && data.output[0] && data.output[0].content &&
       data.output[0].content[0] && data.output[0].content[0].text) ||
      '';

    if (!raw)
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Empty model output' }) };

    let parsed; try { parsed = JSON.parse(raw); } catch { parsed = JSON.parse(String(raw).trim()); }

    // ---- Harden taxonomy slugs post-parse ----
    const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    parsed.front_matter.authors = ['dan-lee'];
    if (Array.isArray(parsed.front_matter.patients) && parsed.front_matter.patients.length > 0) {
      parsed.front_matter.patients = parsed.front_matter.patie
