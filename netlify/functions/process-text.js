// netlify/functions/process-text.js
exports.handler = async function (event) {
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
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };
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
      'Return JSON ONLY that matches the MortigenNote schema.',
      'Taxonomy terms must be lowercase, hyphenated slugs (e.g., "dan-lee", "catherine-doe").',
      'Author must be "dan-lee".',
      'Derive the patient\'s first name; if no last name is present, use "doe".',
      'Do not invent facts; if unknown, omit.',
      'Markdown headings (exact order): Reason for Consultation, HPI, Past Medical History, Medications, Allergies, Social History, Family History, Physical Exam, Investigations, Impression/Plan.',
      'No code fences. No extra prose or keys.'
    ].join(' ');

    const defaults = {
      date: new Date().toISOString(),
      conditions: ['breast-cancer'],
      note_type: ['consult'],
      module: ['oncology'],
      anatomy: ['breast']
    };

    // STRICT Structured Outputs schema (all objects closed)
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
                additionalProperties: false,
                required: [
                  // nothing has to be listed here unless you want *params* itself to require keys
                  // we’ll require keys inside the nested objects instead
                ],
                properties: {
                  tnm: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['prefix','T','N','M'],
                    properties: {
                      prefix: { type: 'string', nullable: true },
                      T:      { type: 'string', nullable: true },
                      N:      { type: 'string', nullable: true },
                      M:      { type: 'string', nullable: true }
                    }
                  },
                  nodes: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['examined','positive','sentinel'],
                    properties: {
                      examined: { type: 'number',  nullable: true },
                      positive: { type: 'number',  nullable: true },
                      sentinel: { type: 'boolean', nullable: true }
                    }
                  },
                  tumor_size_mm: { type: 'number', nullable: true },
                  histology:     { type: 'string', nullable: true },
                  grade:         { type: 'number', nullable: true },
                  er_status:     { type: 'string', nullable: true },
                  er_allred:     { type: 'number', nullable: true },
                  pr_status:     { type: 'string', nullable: true },
                  pr_allred:     { type: 'number', nullable: true },
                  her2_status:   { type: 'string', nullable: true },
                  her2_ihc:      { type: 'string', nullable: true },
                  her2_fish:     { type: 'string', nullable: true },
                  dcis_present:  { type: 'boolean', nullable: true },
                  dcis_margin_mm:{ type: 'number', nullable: true },
                  surgery_date:  { type: 'string', nullable: true },
                  surgery_type:  { type: 'string', nullable: true },
                  oncotype_dx: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['score','risk_9y_pct'],
                    properties: {
                      score:       { type: 'number', nullable: true },
                      risk_9y_pct: { type: 'number', nullable: true }
                    }
                  },
                  ecog:             { type: 'number', nullable: true },
                  menopausal_status:{ type: 'string', nullable: true },
                  featured:         { type: 'boolean', nullable: true },
                  lastmod:          { type: 'string', nullable: true }
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
        text: { format: formatSchema }
      })
    });

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => '');
      let message = 'OpenAI API error';
      try {
        const j = JSON.parse(bodyText);
        if (j && j.error && j.error.message) message = j.error.message;
      } catch {}
      // Return the actual OpenAI message in error so your UI shows it
      return {
        statusCode: 400, // keep 400 so your client sees it's a bad request
        headers,
        body: JSON.stringify({
          error: `Failed to process text — ${message}`,
          openai_status: resp.status,
          openai_body: bodyText.slice(0, 2000)
        })
      };
    }

    const data = await resp.json();

    const raw =
      (data && data.output_text) ||
      (data && data.output && data.output[0] && data.output[0].content &&
       data.output[0].content[0] && data.output[0].content[0].text) ||
      '';

    if (!raw) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Empty model output' }) };
    }

    // Parse JSON safely
    let parsed;
    try {
      parsed = JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    } catch {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Model returned non-JSON text' }) };
    }

    // Post-process slugs
    const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!parsed.front_matter) parsed.front_matter = {};
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
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + (error.message || 'unknown') }) };
  }
};