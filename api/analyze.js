const response = await openai.responses.create({
  model: process.env.OPENAI_MODEL || "gpt-4.1",
  input: [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: buildPrompt(),
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_file",
          filename: fileName,
          file_data: `data:${normalizedMimeType};base64,${base64Data}`,
        },
        {
          type: "input_text",
          text: `Please analyze this document: ${fileName}. Return valid JSON only.`,
        },
      ],
    },
  ],
});
