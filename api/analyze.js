import OpenAI from "openai";
import pdf from "pdf-parse";
import mammoth from "mammoth";

const openai = new OpenAI({
  apiKey: payschedulevalidator,
});

const SYSTEM_PROMPT = `You are a CalSTRS AB 1997 pay schedule compliance reviewer for California charter schools.

Your job is to analyze compensation documents and score them against Charter Impact's defined compliance indicators. Review ONLY against these specific criteria and do not invent requirements not in this rubric.

Return ONLY a valid JSON object with this exact schema:

{
  "overall_score": <number 0-100>,
  "status": <"Strong" | "Partial" | "High Risk">,
  "requirements": [
    {
      "id": "position_titles",
      "name": "Unique Position Titles",
      "score": <0-20>,
      "max_score": 20,
      "status": <"pass" | "partial" | "fail">,
      "notes": "<concise finding>"
    },
    {
      "id": "annualized_pay",
      "name": "Annualized Pay Rate",
      "score": <0-20>,
      "max_score": 20,
      "status": <"pass" | "partial" | "fail">,
      "notes": "<concise finding>"
    },
    {
      "id": "no_external_refs",
      "name": "No References to Other Documents",
      "score": <0-15>,
      "max_score": 15,
      "status": <"pass" | "partial" | "fail">,
      "notes": "<concise finding>"
    },
    {
      "id": "stipends",
      "name": "Stipends / Additional Pay Separated",
      "score": <0-15>,
      "max_score": 15,
      "status": <"pass" | "partial" | "fail">,
      "notes": "<concise finding>"
    },
    {
      "id": "effective_date",
      "name": "Effective Date Present",
      "score": <0-10>,
      "max_score": 10,
      "status": <"pass" | "partial" | "fail">,
      "notes": "<concise finding>"
    },
    {
      "id": "board_approval",
      "name": "Board Approval Evidence",
      "score": <0-10>,
      "max_score": 10,
      "status": <"pass" | "partial" | "fail">,
      "notes": "<concise finding>"
    },
    {
      "id": "public_access",
      "name": "Publicly Accessible",
      "score": <0-10>,
      "max_score": 10,
      "status": <"pass" | "partial" | "fail">,
      "notes": "<concise finding>"
    }
  ],
  "flags": ["<specific issue found>"],
  "suggestions": ["<direct actionable fix>"],
  "summary": "<2-3 sentence plain language summary>"
}`;

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));

    req.on("end", () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers["content-type"] || "";
        const boundaryMatch = contentType.match(/boundary=(.+)$/);

        if (!boundaryMatch) {
          throw new Error("Missing multipart boundary.");
        }

        const boundary = `--${boundaryMatch[1]}`;
        const parts = buffer
          .toString("binary")
          .split(boundary)
          .filter((p) => p.trim() && p.trim() !== "--");

        const fields = {};
        let file = null;

        for (const part of parts) {
          const [rawHeaders, rawBody] = part.split("\r\n\r\n");
          if (!rawHeaders || !rawBody) continue;

          const nameMatch = rawHeaders.match(/name="([^"]+)"/);
          const filenameMatch = rawHeaders.match(/filename="([^"]+)"/);
          const contentTypeMatch = rawHeaders.match(/Content-Type:\s([^\r\n]+)/i);

          const bodyBinary = rawBody.replace(/\r\n--$/, "").replace(/\r\n$/, "");

          if (filenameMatch) {
            file = {
              filename: filenameMatch[1],
              contentType: contentTypeMatch ? contentTypeMatch[1] : "application/octet-stream",
              buffer: Buffer.from(bodyBinary, "binary"),
            };
          } else if (nameMatch) {
            fields[nameMatch[1]] = Buffer.from(bodyBinary, "binary").toString("utf8");
          }
        }

        resolve({ fields, file });
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

async function extractTextFromFile(file) {
  if (!file) return "";

  const name = file.filename.toLowerCase();

  if (name.endsWith(".txt")) {
    return file.buffer.toString("utf8");
  }

  if (name.endsWith(".pdf")) {
    const parsed = await pdf(file.buffer);
    return parsed.text || "";
  }

  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || "";
  }

  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    let content = "";
    let checkboxes = {};

    const contentType = req.headers["content-type"] || "";

    if (contentType.includes("multipart/form-data")) {
      const { fields, file } = await parseMultipart(req);
      content = await extractTextFromFile(file);
      checkboxes = fields.checkboxes ? JSON.parse(fields.checkboxes) : {};
    } else {
      const body = await readJsonBody(req);
      content = body.content || "";
      checkboxes = body.checkboxes || {};
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        error:
          "We could not extract usable text from that file. Please try a text-based PDF, DOCX, or TXT file.",
      });
    }

    const userMessage = `Please analyze this compensation document for CalSTRS AB 1997 compliance.

User-confirmed context:
- Board approved: ${checkboxes.boardApproved ? "YES (user confirmed)" : "NOT confirmed"}
- Publicly posted: ${checkboxes.publiclyPosted ? "YES (user confirmed)" : "NOT confirmed"}
- Stipends included in this file: ${checkboxes.includesStipends ? "YES (user confirmed)" : "NOT confirmed"}

Document content:
---
${content}
---

Return only the JSON object as specified.`;

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1",
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const raw = (response.output_text || "").trim();

    if (!raw) {
      throw new Error("Model returned an empty response.");
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(raw);
    } catch {
      throw new Error(`Model returned invalid JSON: ${raw.slice(0, 300)}`);
    }

    return res.status(200).json(parsedResult);
  } catch (error) {
    console.error("Analyze API error:", error);
    return res.status(500).json({
      error: error.message || "Analysis failed.",
    });
  }
}
