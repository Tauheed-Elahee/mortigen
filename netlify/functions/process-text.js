// netlify/functions/process-text.js
// Stateless transform: transcript -> { front_matter, markdown } -> assembled .md
exports.handler = async (event, context) => {
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
            "OpenAI API key not configured. Add OPENAI_API_KEY in your Netlify environment variables.",
        }),
      };
    }

    const { text } = JSON.parse(event.body || "{}");
    if (!text || !text.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Text input is required" }) };
    }

    // ---- Rules (SYSTEM) ----
    const SYSTEM_PROMPT = `
You are a medical scribe formatter for oncology.
Return JSON ONLY that matches the MortigenNote schema provided via Structured Outputs.
Taxonomy terms must be lowercase, hyphenated slugs (e.g., "dan-lee", "catherine-doe").
Author must be "dan-lee".
Derive the patient's first name from the transcript; if no last name is present, use "doe".
Do not invent facts; if unknown, omit.
Markdown section headings must be EXACTLY and in this order:
Reason for Consultation, HPI, Past Medical History, Medications, Allergies, Social History, Family History, Physical Exam, Investigations, Impression/Plan.
Do NOT include code fences. Do NOT include any extra prose or keys beyond the schema.
`.trim();

    // Minimal defaults (you may also pass these from the client if needed)
    const defaults = {
      date: new Date().toISOString(),
      conditions: ["breast-cancer"],
      note_type: ["consult"],
      module: ["oncology"],
      anatomy: ["breast"],
    };

    // ---- Structured Outputs schema (Responses API expects under text.format) ----
    const jsonSchema = {
      name: "MortigenNote",
      strict: true,
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
              "params"
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
      }
    };

    // Single user message => fully stateless per request
    const user = [
      `TRANSCRIPT: """\n${text}\n"""`,
      `DEFAULTS: ${JSON.stringify(defaults, null, 2)}`
    ].join("\n\n");

    // ---- Call OpenAI Responses API ----
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user }
        ],
        temperature: 0,
        seed: 12345, // improves repeatability, not a hard guarantee
        text: {
          format: "json_schema",
          json_schema: jsonSchema
        }
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

    // Prefer convenience field; fall back to digging into the content
    const raw =
      data.output_text ||
      (data.output &&
        data.output[0] &&
        data.output[0].content &&
        data.output[0].content[0] &&
        data.output[0].content[0].text) ||
      "";

    if (!raw) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Empty model output" }) };
    }

    // Parse JSON; tolerate extra whitespace
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = JSON.parse(raw.trim());
    }

    // ---- Harden taxonomy slugs post-parse ----
    const slug = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    // Force author to dan-lee
    parsed.front_matter.authors = ["dan-lee"];

    // Ensure patient has a last name; if single-part slug, append "-doe"
    if (Array.isArray(parsed.front_matter.patients) && parsed.front_matter.patients.length > 0) {
      parsed.front_matter.patients = parsed.front_matter.patients.map((p) => {
        let s = slug(p);
        if (!s.includes("-")) s = `${s}-doe`;
        return s;
      });
    } else {
      // Fallback if model omitted patients
      parsed.front_matter.patients = ["patient-doe"];
    }

    // Normalize other taxonomy arrays just in case
    ["conditions", "note_type", "module", "anatomy"].forEach((k) => {
      if (Array.isArray(parsed.front_matter[k])) {
        parsed.front_matter[k] = parsed.front_matter[k].map(slug).filter(Boolean);
      }
    });

    // Assemble a .md file (JSON front matter at top, then body)
    const mdFile =
      JSON.stringify(parsed.front_matter, null, 2) + "\n\n" + parsed.markdown + "\n";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        result: mdFile.trim(),        // full .md string (for immediate use/download)
        data: parsed                  // original structured { front_matter, markdown }
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
