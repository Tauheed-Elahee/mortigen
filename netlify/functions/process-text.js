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

    const text = (payload && payload.text) ? String(payload.text) : '';
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

    // Schema lives directly under text.format
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
              params: { type: 'object', additionalProperties: true }
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
        text: { format: formatSchema }   // <-- key fix: include name/schema/strict here
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

    const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    parsed.front_matter.authors = ['dan-lee'];
    if (Array.isArray(parsed.front_matter.patients) && parsed.front_matter.patients.length > 0) {
      parsed.front_matter.patients = parsed.front_matter.patients.map(p => {
        let s = slug(p); if (s.indexOf('-') === -1) s = s + '-doe'; return s;
      });
    } else {
      parsed.front_matter.patients = ['patient-doe'];
    }
    ['conditions','note_type','module','anatomy'].forEach(k => {
      if (Array.isArray(parsed.front_matter[k])) parsed.front_matter[k] = parsed.front_matter[k].map(slug).filter(Boolean);
    });

    const mdFile = JSON.stringify(parsed.front_matter, null, 2) + '\n\n' + parsed.markdown + '\n';

    return { statusCode: 200, headers, body: JSON.stringify({ result: mdFile.trim(), data: parsed }) };
  } catch (error) {
    console.error('Function Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + (error.message || 'unknown') }) };
  }
};