import OpenAI from "openai";
import pdf from "pdf-parse";
import mammoth from "mammoth";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    const body = Buffer.concat(buffers).toString();

    const { content } = JSON.parse(body);

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: `Analyze the following charter school salary schedule for CalSTRS AB 1997 compliance and return a JSON scoring summary:\n\n${content}`
    });

    return res.status(200).json({ result: response.output_text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Analysis failed" });
  }
}
