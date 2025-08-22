// CommonJS style to match your current function
exports.handler = async (event, context) => {
  // CORS
  const headers = {
    "Access-Control-Allow-Origin": "*", // tighten to your domain in prod
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error:
            "OpenAI API key not configured. Add OPENAI_API_KEY in Netlify environment variables.",
        }),
      };
    }

    const { text } = JSON.parse(event.body || "{}");
    if (!text || !text.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Text input is required" }) };
    }

    // ---------- STATeless rules (system prompt) ----------
    const SYSTEM_PROMPT = `
You are a medical scribe formatter for oncology.
Return JSON ONLY that matches the MortigenNote schema via Structured Outputs.
Taxonomy terms must be lowercase, hyphenated slugs.
Author must be "dan-lee".
Derive the patient's first name from text; if no last name is present, use "doe".
Do not invent facts; omit unknowns.
Markdown section headings must be EXACTLY and in this order:
Reason for Consultation, HPI, Past Medical History, Medications, Allergies, Social History, Family History, Physical Exam, Investigations, Impression/Plan.
No code fences. No extra prose.
`;

    // Minimal defaults you can tweak or extend on the client if needed
    const defaults = {
      conditions: ["breast-cancer"],
      note_type: ["consult"],
      module: ["oncology"],
      anatomy: ["breast"],
      date: new Date().toISOString(),
    };

    // JSON Schema for Structured Outputs
    const jsonSchema = {
      name: "MortigenNote",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["front_matter", "markdown"],
        properties: {
          front_matter: {
            type: "object",
            additionalProperties: false,
            required: [
              "title",
              "date",
              "conditions",
              "note_type",
              "module",
              "authors",
              "patients",
              "anatomy",
              "params",
            ],
            properties: {
              title: { type: "string" },
              date: { type: "string" },
              conditions: { type: "array", items: { type: "string" } },
              note_type: { type: "array", items: { type: "string" } },
              module: { type: "array", items: { type: "string" } },
              authors: { type: "array", items: { type: "string" } },
              patients: { type: "array", items: { type: "string" } },
              anatomy: { type: "array", items: { type: "string" } },
              params: { type: "object", additionalProperties: true }
            }
          },
          markdown: { type: "string" }
        }
      },
      strict: true
    };

    // Single user message => fully stateless (no history carried between calls)
    const user = [
      `TRANSCRIPT: """\n${text}\n"""`,
      `DEFAULTS: ${JSON.stringify(defaults, null, 2)}`
    ].join("\n\n");

    // ---------- Call OpenAI Responses API (Structured Outputs) ----------
    // Docs: https://platform.openai.com/docs/guides/structured-outputs
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // fast/cheap; swap to another model if you prefer
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user }
        ],
        temperature: 0,
        // Seed can help repeatability, not a hard guarantee:
        seed: 12345,
        response_format: { type: "json_schema", json_schema: jsonSchema }
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error("OpenAI error:", err);
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({ error: err?.error?.message || "OpenAI API error" }),
      };
    }

    const data = await resp.json();

    // With Structured Outputs, OpenAI often gives a convenience field `output_text`.
    // Fallback parses the first text block if needed.
    const raw = data.output_text ||
      (data.output &&
        data.output[0] &&
        data.output[0].content &&
        data.output[0].content[0] &&
        data.output[0].content[0].text) ||
      "";

    if (!raw) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Empty model output" }) };
    }

    let parsed;
    try {
      parsed = JSON.parse(raw); // { front_matter, markdown }
    } catch (e) {
      // If the model ever returns stray whitespace, try to clean + reparse
      parsed = JSON.parse(raw.trim());
    }

    // Assemble a .md file for convenience (JSON front matter + body)
    const mdFile =
      JSON.stringify(parsed.front_matter, null, 2) + "\n\n" + parsed.markdown + "\n";

    // Back-compat: your old client expects { result: string }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        result: mdFile.trim(),
        data: parsed // keep the structured pieces too
      }),
    };
  } catch (error) {
    console.error("Function Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Server error: ${error.message}` }),
    };
  }
};
