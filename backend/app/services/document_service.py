import io
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from PIL import Image
import pytesseract

def analyze_pdf_metadata(file_content: bytes) -> List[Dict[str, Any]]:
    """
    Layer 1: PDF metadata forensics.
    Checks creation date, modification date, producer software, suspicious timestamps.
    """
    flags = []

    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_content))
        meta = reader.metadata

        if meta:
            creation_date = meta.get("/CreationDate", "")
            mod_date = meta.get("/ModDate", "")
            producer = meta.get("/Producer", "")
            creator = meta.get("/Creator", "")

            # Check if modified after creation
            if creation_date and mod_date and creation_date != mod_date:
                try:
                    # PDF date format: D:YYYYMMDDHHmmSSOHH'mm'
                    c_str = creation_date[2:16] if creation_date.startswith("D:") else creation_date[:14]
                    m_str = mod_date[2:16] if mod_date.startswith("D:") else mod_date[:14]
                    c_dt = datetime.strptime(c_str, "%Y%m%d%H%M%S")
                    m_dt = datetime.strptime(m_str, "%Y%m%d%H%M%S")
                    diff_days = (m_dt - c_dt).days

                    if diff_days > 0:
                        flags.append({
                            "type": "METADATA_TAMPERING",
                            "detail": f"PDF modified {diff_days} day(s) after creation. Creation: {c_dt.strftime('%Y-%m-%d')}, Modified: {m_dt.strftime('%Y-%m-%d')}",
                            "severity": "HIGH" if diff_days > 7 else "MEDIUM",
                            "confidence": 85
                        })
                except Exception:
                    pass

            # Check for suspicious editing software
            suspicious_tools = ["libreoffice", "openoffice", "gimp", "photoshop", "illustrator", "inkscape"]
            producer_lower = (producer + creator).lower()
            for tool in suspicious_tools:
                if tool in producer_lower:
                    flags.append({
                        "type": "METADATA_TAMPERING",
                        "detail": f"Document created/edited with '{producer or creator}' — unusual for official business documents",
                        "severity": "MEDIUM",
                        "confidence": 70
                    })
                    break

            # Future-dated document
            if creation_date:
                try:
                    c_str = creation_date[2:16] if creation_date.startswith("D:") else creation_date[:14]
                    c_dt = datetime.strptime(c_str, "%Y%m%d%H%M%S")
                    if c_dt > datetime.utcnow():
                        flags.append({
                            "type": "DATE_INCONSISTENCY",
                            "detail": f"Document creation date is in the future: {c_dt.strftime('%Y-%m-%d')}",
                            "severity": "CRITICAL",
                            "confidence": 99
                        })
                except Exception:
                    pass

        # Check page count anomalies
        num_pages = len(reader.pages)
        if num_pages == 0:
            flags.append({
                "type": "LAYOUT_ANOMALY",
                "detail": "PDF contains no readable pages",
                "severity": "HIGH",
                "confidence": 95
            })

    except Exception as e:
        flags.append({
            "type": "ANALYSIS_ERROR",
            "detail": f"Could not read PDF metadata: {str(e)}",
            "severity": "LOW",
            "confidence": 50
        })

    return flags


def extract_text_from_document(file_content: bytes, file_type: str) -> str:
    """Extract raw text from PDF or image for data validation layer."""
    text = ""

    try:
        if file_type == "application/pdf":
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_content))
            for page in reader.pages:
                text += page.extract_text() or ""

        elif file_type.startswith("image/"):
            img = Image.open(io.BytesIO(file_content))
            text = pytesseract.image_to_string(img)

    except Exception:
        pass

    return text


def validate_indian_business_data(text: str) -> List[Dict[str, Any]]:
    """
    Layer 3: Data validation.
    Validates GST numbers, PAN, invoice math, IFSC codes.
    """
    flags = []

    # GST Number validation
    gst_pattern = r'\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b'
    gst_matches = re.findall(gst_pattern, text.upper())

    if gst_matches:
        for gst in gst_matches:
            state_code = int(gst[:2])
            if state_code < 1 or state_code > 37:
                flags.append({
                    "type": "GST_INVALID",
                    "detail": f"GST number {gst} has invalid state code: {state_code}",
                    "severity": "HIGH",
                    "confidence": 95
                })
    else:
        # Check if document likely needs a GST number
        gst_keywords = ["invoice", "tax invoice", "gst", "gstin", "cgst", "sgst", "igst"]
        if any(kw in text.lower() for kw in gst_keywords):
            flags.append({
                "type": "MISSING_FIELD",
                "detail": "Document appears to be a tax invoice but no valid GSTIN found",
                "severity": "HIGH",
                "confidence": 80
            })

    # PAN validation
    pan_pattern = r'\b[A-Z]{5}\d{4}[A-Z]{1}\b'
    pan_matches = re.findall(pan_pattern, text.upper())
    if pan_matches:
        for pan in pan_matches:
            entity_char = pan[3]
            valid_entities = ['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G']
            if entity_char not in valid_entities:
                flags.append({
                    "type": "PAN_INVALID",
                    "detail": f"PAN {pan} has invalid entity type character '{entity_char}'",
                    "severity": "HIGH",
                    "confidence": 92
                })

    # IFSC code validation
    ifsc_pattern = r'\b[A-Z]{4}0[A-Z0-9]{6}\b'
    ifsc_matches = re.findall(ifsc_pattern, text.upper())
    # IFSC is valid format if found — no flags needed

    # Invoice math check
    amount_pattern = r'(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{2})?)'
    amounts = re.findall(amount_pattern, text.lower())
    if amounts:
        amounts_clean = []
        for a in amounts:
            try:
                amounts_clean.append(float(a.replace(",", "")))
            except:
                pass

        if len(amounts_clean) >= 3:
            # Simple check: largest amount should be roughly equal to sum of 2nd and 3rd largest
            sorted_amounts = sorted(amounts_clean, reverse=True)
            if sorted_amounts[0] > 0:
                ratio = (sorted_amounts[1] + sorted_amounts[2]) / sorted_amounts[0]
                if ratio < 0.5 or ratio > 2.0:
                    flags.append({
                        "type": "MATH_ERROR",
                        "detail": "Invoice amounts appear inconsistent — totals may not match line items",
                        "severity": "MEDIUM",
                        "confidence": 65
                    })

    # Suspicious round number check
    large_round_pattern = r'(?:rs\.?|inr|₹)\s*([\d,]+)\.00'
    round_amounts = re.findall(large_round_pattern, text.lower())
    suspiciously_round = [a for a in round_amounts if len(a.replace(",", "")) >= 6]
    if len(suspiciously_round) >= 3:
        flags.append({
            "type": "SUSPICIOUS_PATTERN",
            "detail": f"Multiple large round-number amounts detected — unusual in real invoices",
            "severity": "LOW",
            "confidence": 55
        })

    return flags
