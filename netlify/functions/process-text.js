// netlify/functions/process-text.js
exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*', // lock to your domain in prod
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

    // ---------- Rules (SYSTEM) ----------
    const SYSTEM_PROMPT = [
      'You are a medical scribe formatter for oncology.',
      'Return JSON ONLY that matches the MortigenNote schema.',
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

    // ---------- Looser JSON Schema (max compatibility) ----------
    // Keep declared properties, but allow additional keys so the API won't 400 over small deviations.
    const formatSchema = {
      type: 'json_schema',
      name: 'MortigenNote',
      schema: {
        type: 'object',
        additionalProperties: true,
        required: ['front_matter', 'markdown'],
        properties: {
          front_matter: {
            type: 'object',
            additionalProperties: true,
            required: ['title','date','conditions','note_type','module','authors','patients','anatomy','params'],
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
                additionalProperties: true,
                properties: {
                  tnm: {
                    type: 'object',
                    additionalProperties: true,
                    properties: { prefix: { type: 'string' }, T: { type: 'string' }, N: { type: 'string' }, M: { type: 'string' } }
                  },
                  nodes: {
                    type: 'object',
                    additionalProperties: true,
                    properties: { examined: { type: 'number' }, positive: { type: 'number' }, sentinel: { type: 'boolean' } }
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
                    additionalProperties: true,
                    properties: { score: { type: 'number' }, risk_9y_pct: { type: 'number' } }
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

    // ---------- OpenAI Responses API call ----------
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
        text: { format: formatSchema }
      })
    });

    if (!resp.ok) {
      // Pass full error details back to client so you can see exactly what's wrong
      const bodyText = await resp.text().catch(() => '');
      let message = 'OpenAI API error';
      try {
        const j = JSON.parse(bodyText);
        if (j && j.error && j.error.message) message = j.error.message;
      } catch {}
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({
          error: 'Failed to process text',
          openai_status: resp.status,
          openai_error: message,
          openai_body: bodyText.slice(0, 2000) // truncate for safety
        })
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

    // Safe JSON parse (strip accidental code fences/newlines if they ever appear)
    function safeParseJSON(s) {
      let t = String(s || '').trim();
      if (t.startsWith('```')) {
        t = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n```$/, '').trim();
      }
      return JSON.parse(t);
    }

    let parsed;
    try { parsed = safeParseJSON(raw); }
    catch (e) {
      // As a last resort, try to extract the first JSON object
      const m = String(raw).match(/\{[\s\S]*\}$/);
      if (!m) throw e;
      parsed = JSON.parse(m[0]);
    }

    // ---------- Harden taxonomy slugs post-parse ----------
    const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Force author to dan-lee
    if (!parsed.front_matter) parsed.front_matter = {};
    parsed.front_matter.authors = ['dan-lee'];

    // Ensure patient has a last name; if single-part slug, append "-doe"
    if (Array.isArray(parsed.front_matter.patients) && parsed.front_matter.patients.length > 0) {
      parsed.front_matter.patients = parsed.front_matter.patients.map(p => {
        let s = slug(p);
        if (s.indexOf('-') === -1) s = s + '-doe';
        return s;
      });
    } else {
      parsed.front_matter.patients = ['patient-doe'];
    }

    // Normalize other taxonomy arrays
    ['conditions','note_type','module','anatomy'].forEach(k => {
      if (Array.isArray(parsed.front_matter[k])) {
        parsed.front_matter[k] = parsed.front_matter[k].map(slug).filter(Boolean);
      }
    });

    // ---------- Assemble .md file ----------
    const mdFile = JSON.stringify(parsed.front_matter, null, 2) + '\n\n' + parsed.markdown + '\n';

    return { statusCode: 200, headers, body: JSON.stringify({ result: mdFile.trim(), data: parsed }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + (error.message || 'unknown') }) };
  }
};
