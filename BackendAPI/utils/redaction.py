import json

def redact_phone(phone: str) -> str:
    """Masks all but the last 4 digits of a phone number."""
    if not phone:
        return ""
    return "*" * (len(phone) - 4) + phone[-4:] if len(phone) > 4 else "*" * len(phone)

def redact_payload(payload_str: str) -> str:
    """Redacts sensitive PII from a JSON payload string."""
    try:
        data = json.loads(payload_str)
        # Redact M-PESA phone number which is deeply nested in CallbackMetadata
        if "Body" in data and "stkCallback" in data["Body"]:
            callback = data["Body"]["stkCallback"]
            if "CallbackMetadata" in callback and "Item" in callback["CallbackMetadata"]:
                for item in callback["CallbackMetadata"]["Item"]:
                    if item.get("Name") == "PhoneNumber" and "Value" in item:
                        item["Value"] = redact_phone(str(item["Value"]))
        return json.dumps(data)
    except Exception:
        # If parsing fails, just return a highly redacted version or the raw string 
        # (Be careful, if it's not JSON, we might just want to hide digits)
        import re
        return re.sub(r'\d{9,}', lambda m: redact_phone(m.group(0)), payload_str)
