export default async function handler(req, res) {
  try {
    // everything
    return res.status(200).json(parsedResult);
  } catch (error) {
    console.error("Analyze API error:", error);
    return res.status(500).json({
      error: error.message || "Analysis failed."
    });
  }
}
