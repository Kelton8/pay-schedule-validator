import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const bodyBuffer = Buffer.concat(chunks);
        const contentType = req.headers["content-type"] || "";
        const boundaryMatch = contentType.match(/boundary=(.+)$/);

        if (!boundaryMatch) {
          throw new Error("Missing multipart boundary.");
        }

        const boundary = `--${boundaryMatch[1]}`;
        const raw = bodyBuffer.toString("latin1");
        const parts = raw.split(boundary).filter((part) => {
          const trimmed = part.trim();
          return trimmed && trimmed !== "--";
        });

        let file = null;
        let checkboxes = {};

        for (const part of parts) {
          const [headerBlock, bodyBlock] = part.split("\r\n\r\n");
          if (!headerBlock || !bodyBlock) continue;

          const nameMatch = headerBlock.match(/name="([^"]+)"/);
          const filenameMatch = headerBlock.match(/filename="([^"]+)"/);

          let cleanedBody = bodyBlock;
          if (cleanedBody.endsWith("\r\n")) cleanedBody = cleanedBody.slice(0, -2);
          if (cleanedBody.endsWith("--")) cleanedBody = cleanedBody.slice(0, -2);

          if (filenameMatch) {
            file = {
              filename: filenameMatch[1],
              content: Buffer.from(cleanedBody, "latin1").toString("utf8"),
            };
          } else if (nameMatch && nameMatch[1] === "checkboxes") {
            checkboxes = JSON.parse(Buffer.from(cleanedBody, "latin1").toString("utf8"));
          }
        }

        resolve({ file, checkboxes });
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const contentType = req.headers["content-type"] || "";

    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({ error: "Expected a file upload." });
    }

    const { file, checkboxes } = await parseMultipart(req);

    if (!file) {
      return res.status(400).json({ error: "No file was uploaded." });
    }

    if (!file.filename.toLowerCase().endsWith(".txt")) {
      return res.status(400).json({
        error: "Please upload a .txt file for this version.",
      });
    }

    const content = file.content?.trim();

    if (!content) {
      return res.status(400).json({
        error: "The uploaded file appears to be empty.",
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
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
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
