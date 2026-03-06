import anthropic
import base64
import json
import re
from typing import Optional
from app.core.config import settings
from app.models.schemas import FraudReport, FraudFlag, Severity

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

FRAUD_ANALYSIS_PROMPT = """You are FraudScan, an expert AI system for detecting fraudulent or tampered business documents in India.

Analyze the provided document and return a STRICT JSON fraud analysis report.

You must evaluate:
1. Document authenticity markers
2. GST number validity (format: 2-digit state code + 10-char PAN + 1Z + 2 alphanumeric)
3. PAN number format (5 uppercase letters + 4 digits + 1 uppercase letter)
4. Invoice math consistency (line items × quantity = subtotal, + GST = total)
5. Visual layout anomalies, font inconsistencies
6. Suspicious patterns: round numbers, unusual wording, missing mandatory fields
7. Bank account format (9-18 digits), IFSC code format (4 alpha + 0 + 6 alphanumeric)
8. Signature presence and consistency
9. Date logic (invoice date before due date, not future-dated)
10. Company registration patterns

Trust Score Guidelines:
- 90-100: Appears authentic, no issues found
- 70-89: Minor concerns, proceed with caution  
- 40-69: Multiple red flags, verify manually
- 20-39: Likely fraudulent, do not proceed
- 0-19: Almost certainly fraudulent

Severity:
- LOW: Trust score 70+
- MEDIUM: Trust score 40-69
- HIGH: Trust score 20-39  
- CRITICAL: Trust score 0-19

Return ONLY valid JSON. No markdown, no explanation, no backticks. Exactly this structure:
{
  "document_type": "string (Invoice/GST Certificate/KYC Document/Bank Statement/Contract/Unknown)",
  "trust_score": integer 0-100,
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "flags": [
    {
      "type": "string (METADATA_TAMPERING|GST_INVALID|PAN_INVALID|MATH_ERROR|FONT_ANOMALY|MISSING_FIELD|SUSPICIOUS_PATTERN|LAYOUT_ANOMALY|DATE_INCONSISTENCY|SIGNATURE_MISSING|DUPLICATE_RISK)",
      "detail": "specific explanation of what was found",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "confidence": integer 0-100
    }
  ],
  "recommendation": "PROCEED|PROCEED WITH CAUTION|VERIFY MANUALLY|DO NOT PROCEED",
  "summary": "2-3 sentence plain English summary of findings"
}"""


async def analyze_document_with_claude(
    file_content: bytes,
    file_type: str,
    metadata_flags: list,
    extracted_text: str = ""
) -> FraudReport:
    """
    Core AI fraud detection engine.
    Sends document to Claude with metadata context and returns structured fraud report.
    """
    messages = []

    # Build context from metadata pre-analysis
    metadata_context = ""
    if metadata_flags:
        metadata_context = f"\n\nPRE-ANALYSIS METADATA FLAGS:\n" + "\n".join(
            f"- {f['type']}: {f['detail']}" for f in metadata_flags
        )

    if extracted_text:
        metadata_context += f"\n\nEXTRACTED TEXT:\n{extracted_text[:3000]}"

    user_message_content = []

    # Attach document as image or base64
    if file_type in ["image/jpeg", "image/jpg", "image/png", "image/webp"]:
        encoded = base64.standard_b64encode(file_content).decode("utf-8")
        user_message_content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": file_type,
                "data": encoded
            }
        })
    elif file_type == "application/pdf":
        encoded = base64.standard_b64encode(file_content).decode("utf-8")
        user_message_content.append({
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": encoded
            }
        })

    user_message_content.append({
        "type": "text",
        "text": f"Analyze this document for fraud indicators.{metadata_context}\n\nReturn ONLY the JSON report."
    })

    messages.append({"role": "user", "content": user_message_content})

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=FRAUD_ANALYSIS_PROMPT,
        messages=messages
    )

    raw_text = response.content[0].text.strip()

    # Strip any accidental markdown
    raw_text = re.sub(r"```json\s*", "", raw_text)
    raw_text = re.sub(r"```\s*", "", raw_text)
    raw_text = raw_text.strip()

    try:
        report_data = json.loads(raw_text)
    except json.JSONDecodeError:
        # Fallback if Claude returns malformed JSON
        report_data = {
            "document_type": "Unknown",
            "trust_score": 50,
            "severity": "MEDIUM",
            "flags": [{
                "type": "ANALYSIS_ERROR",
                "detail": "Could not fully parse document. Manual review recommended.",
                "severity": "MEDIUM",
                "confidence": 60
            }],
            "recommendation": "VERIFY MANUALLY",
            "summary": "Automated analysis encountered an issue. The document should be reviewed manually."
        }

    # Validate and coerce
    flags = [FraudFlag(**f) for f in report_data.get("flags", [])]

    return FraudReport(
        document_type=report_data.get("document_type", "Unknown"),
        trust_score=max(0, min(100, int(report_data.get("trust_score", 50)))),
        severity=Severity(report_data.get("severity", "MEDIUM")),
        flags=flags,
        recommendation=report_data.get("recommendation", "VERIFY MANUALLY"),
        summary=report_data.get("summary", "")
    )
