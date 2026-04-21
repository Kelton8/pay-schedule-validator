import { useState, useRef, useCallback } from "react";

const CHARTER_ORANGE = "#F47B20";
const CHARTER_RED = "#9B2335";
const CHARTER_DARK = "#1A1A2E";

function ScoreRing({ score }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? "#22c55e" : score >= 70 ? CHARTER_ORANGE : "#ef4444";

  return (
    <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto" }}>
      <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{score}</div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          / 100
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pass: { bg: "rgba(34,197,94,0.15)", color: "#22c55e", label: "Pass", icon: "✓" },
    partial: { bg: "rgba(244,123,32,0.15)", color: CHARTER_ORANGE, label: "Partial", icon: "◑" },
    fail: { bg: "rgba(239,68,68,0.15)", color: "#ef4444", label: "Fail", icon: "✗" },
  };
  const s = map[status] || map.fail;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: s.bg,
        color: s.color,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.05em",
      }}
    >
      <span>{s.icon}</span> {s.label}
    </span>
  );
}

function RequirementRow({ req }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((req.score / req.max_score) * 100);
  const barColor =
    req.status === "pass" ? "#22c55e" : req.status === "partial" ? CHARTER_ORANGE : "#ef4444";

  return (
    <div
      onClick={() => setOpen((o) => !o)}
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: 10,
        padding: "14px 18px",
        marginBottom: 8,
        cursor: "pointer",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{req.name}</span>
            <StatusBadge status={req.status} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                flex: 1,
                height: 5,
                background: "rgba(255,255,255,0.1)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: barColor,
                  borderRadius: 10,
                  transition: "width 1s ease",
                }}
              />
            </div>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, whiteSpace: "nowrap" }}>
              {req.score} / {req.max_score}
            </span>
          </div>
        </div>
        <span
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 18,
            transform: open ? "rotate(180deg)" : "none",
          }}
        >
          ▾
        </span>
      </div>
      {open && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.07)",
            color: "rgba(255,255,255,0.65)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {req.notes}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState("");
  const [inputMode, setInputMode] = useState("upload");
  const [checkboxes, setCheckboxes] = useState({
    boardApproved: false,
    publiclyPosted: false,
    includesStipends: false,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  const analyze = async () => {
    if (inputMode === "upload" && !file) {
      setError("Please upload a file before analyzing.");
      return;
    }
    if (inputMode === "paste" && !pastedText.trim()) {
      setError("Please paste document text before analyzing.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let response;

      if (inputMode === "upload") {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("checkboxes", JSON.stringify(checkboxes));

        response = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: pastedText,
            checkboxes,
          }),
        });
      }

  const raw = await response.text();
let data;

try {
  data = JSON.parse(raw);
} catch {
  throw new Error(raw || "The server returned an invalid response.");
}

if (!response.ok) {
  throw new Error(data.error || "Analysis failed.");
}

      setResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPastedText("");
    setResult(null);
    setError(null);
    setCheckboxes({
      boardApproved: false,
      publiclyPosted: false,
      includesStipends: false,
    });
  };

  const statusColor = result
    ? result.status === "Strong"
      ? "#22c55e"
      : result.status === "Partial"
      ? CHARTER_ORANGE
      : "#ef4444"
    : CHARTER_ORANGE;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${CHARTER_DARK} 0%, #2D1B3D 50%, #1A0A0A 100%)`,
        fontFamily: "'Georgia', 'Times New Roman', serif",
        color: "#fff",
      }}
    >
      <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto", padding: "40px 24px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 46px)",
              fontWeight: 700,
              lineHeight: 1.15,
              margin: "0 0 14px",
              background: `linear-gradient(135deg, #fff 30%, ${CHARTER_ORANGE})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Pay Schedule Validator
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 16,
              maxWidth: 520,
              margin: "0 auto",
              lineHeight: 1.65,
              fontFamily: "sans-serif",
            }}
          >
            Upload your salary schedule or compensation document to check for key CalSTRS AB 1997 documentation indicators.
          </p>
        </div>

        {!result ? (
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(20px)",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "36px",
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {["upload", "paste"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setInputMode(mode)}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    background:
                      inputMode === mode
                        ? `linear-gradient(135deg, ${CHARTER_ORANGE}, #9B2335)`
                        : "rgba(255,255,255,0.08)",
                    color: "#fff",
                  }}
                >
                  {mode === "upload" ? "Upload File" : "Paste Text"}
                </button>
              ))}
            </div>

            {inputMode === "upload" ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? CHARTER_ORANGE : "rgba(255,255,255,0.2)"}`,
                  borderRadius: 14,
                  padding: "40px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver ? "rgba(244,123,32,0.05)" : "transparent",
                  marginBottom: 24,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  style={{ display: "none" }}
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <div style={{ fontSize: 36, marginBottom: 10 }}>{file ? "✅" : "📄"}</div>
                {file ? (
                  <>
                    <div style={{ color: "#fff", fontFamily: "sans-serif", fontSize: 15, fontWeight: 600 }}>{file.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "sans-serif", fontSize: 12, marginTop: 4 }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontFamily: "sans-serif", fontSize: 15, marginBottom: 4 }}>
                      Drop your file here, or click to browse
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontFamily: "sans-serif", fontSize: 12 }}>
                      PDF, DOCX, or TXT
                    </div>
                  </>
                )}
              </div>
            ) : (
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste the full text of your pay schedule or compensation document here..."
                style={{
                  width: "100%",
                  minHeight: 180,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 12,
                  color: "#fff",
                  padding: "16px",
                  fontFamily: "sans-serif",
                  fontSize: 14,
                  lineHeight: 1.6,
                  resize: "vertical",
                  outline: "none",
                  marginBottom: 24,
                  boxSizing: "border-box",
                }}
              />
            )}

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 12,
                padding: "20px",
                marginBottom: 28,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  fontFamily: "sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: CHARTER_ORANGE,
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Confirm what you know about this document
              </div>
              {[
                { key: "boardApproved", label: "This document has been approved by the governing board" },
                { key: "publiclyPosted", label: "This document is publicly posted or accessible online" },
                { key: "includesStipends", label: "Stipend and additional pay documentation is included in this file" },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={checkboxes[key]}
                    onChange={() => setCheckboxes((c) => ({ ...c, [key]: !c[key] }))}
                  />
                  <span style={{ fontFamily: "sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  marginBottom: 20,
                  color: "#fca5a5",
                  fontFamily: "sans-serif",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={analyze}
              disabled={loading || (inputMode === "upload" ? !file : !pastedText.trim())}
              style={{
                width: "100%",
                padding: "16px",
                background: loading ? "rgba(255,255,255,0.1)" : `linear-gradient(135deg, ${CHARTER_ORANGE} 0%, ${CHARTER_RED} 100%)`,
                border: "none",
                borderRadius: 12,
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading || (inputMode === "upload" ? !file : !pastedText.trim()) ? 0.5 : 1,
              }}
            >
              {loading ? "Analyzing document..." : "Analyze Document"}
            </button>
          </div>
        ) : (
          <div>
            <div
              style={{
                background: `linear-gradient(135deg, rgba(155,35,53,0.4) 0%, rgba(244,123,32,0.2) 100%)`,
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "36px",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              <ScoreRing score={result.overall_score} />
              <div
                style={{
                  marginTop: 16,
                  display: "inline-block",
                  background: `${statusColor}22`,
                  border: `1px solid ${statusColor}55`,
                  borderRadius: 20,
                  padding: "6px 20px",
                  color: statusColor,
                  fontFamily: "sans-serif",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {result.status}
              </div>
              <p
                style={{
                  color: "rgba(255,255,255,0.65)",
                  fontFamily: "sans-serif",
                  fontSize: 14,
                  lineHeight: 1.65,
                  maxWidth: 520,
                  margin: "16px auto 0",
                }}
              >
                {result.summary}
              </p>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "28px",
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  fontFamily: "sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: CHARTER_ORANGE,
                  textTransform: "uppercase",
                  marginTop: 0,
                  marginBottom: 16,
                }}
              >
                Requirement Breakdown
              </h3>
              {result.requirements?.map((req) => (
                <RequirementRow key={req.id} req={req} />
              ))}
            </div>

            {result.flags?.length > 0 && (
              <div
                style={{
                  background: "rgba(239,68,68,0.07)",
                  borderRadius: 20,
                  border: "1px solid rgba(239,68,68,0.2)",
                  padding: "28px",
                  marginBottom: 20,
                }}
              >
                <h3
                  style={{
                    fontFamily: "sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "#ef4444",
                    textTransform: "uppercase",
                    marginTop: 0,
                    marginBottom: 16,
                  }}
                >
                  Issues Flagged
                </h3>
                {result.flags.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      marginBottom: 10,
                      color: "rgba(255,255,255,0.7)",
                      fontFamily: "sans-serif",
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }}>•</span>
                    {f}
                  </div>
                ))}
              </div>
            )}

            {result.suggestions?.length > 0 && (
              <div
                style={{
                  background: "rgba(34,197,94,0.07)",
                  borderRadius: 20,
                  border: "1px solid rgba(34,197,94,0.2)",
                  padding: "28px",
                  marginBottom: 20,
                }}
              >
                <h3
                  style={{
                    fontFamily: "sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "#22c55e",
                    textTransform: "uppercase",
                    marginTop: 0,
                    marginBottom: 16,
                  }}
                >
                  Suggested Fixes
                </h3>
                {result.suggestions.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      marginBottom: 10,
                      color: "rgba(255,255,255,0.7)",
                      fontFamily: "sans-serif",
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: "#22c55e", flexShrink: 0, marginTop: 2 }}>→</span>
                    {s}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={reset}
              style={{
                width: "100%",
                padding: "14px",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                color: "rgba(255,255,255,0.6)",
                fontSize: 14,
                fontFamily: "sans-serif",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Analyze Another Document
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
