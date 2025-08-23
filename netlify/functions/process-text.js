// STRICT Structured Outputs schema (all objects closed)
const formatSchema = {
  type: 'json_schema',
  name: 'MortigenNote',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,                 // <-- root must be closed
    required: ['front_matter', 'markdown'],
    properties: {
      front_matter: {
        type: 'object',
        additionalProperties: false,             // <-- closed
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
            additionalProperties: false,         // <-- closed
            properties: {
              tnm: {
                type: 'object',
                additionalProperties: false,     // <-- closed
                properties: {
                  prefix: { type: 'string' },
                  T: { type: 'string' },
                  N: { type: 'string' },
                  M: { type: 'string' }
                }
              },
              nodes: {
                type: 'object',
                additionalProperties: false,     // <-- closed
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
                additionalProperties: false,     // <-- closed
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