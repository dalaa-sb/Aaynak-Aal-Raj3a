"""
Sanitization helpers.

`reject_operators` blocks NoSQL injection attempts where a client sends a dict like
{"username": {"$ne": null}} — Pydantic schemas prevent this for typed fields, but
this is a defense-in-depth check before passing anything to MongoDB.

`clean_text` strips HTML/script tags from user-provided strings before storage.
"""
import re
import bleach

# Mongo operators we never accept from user input.
_FORBIDDEN_OPERATOR_PATTERN = re.compile(r"^\$")


def reject_operators(value):
    """
    Recursively reject any dict key starting with $ (Mongo operator).
    Use on anything destined for a query filter or document write.

    Returns: sanitized value (with offending keys stripped) — but for safety
    we raise instead of silently accepting partial input.
    """
    if isinstance(value, dict):
        for k in value.keys():
            if isinstance(k, str) and _FORBIDDEN_OPERATOR_PATTERN.match(k):
                raise ValueError(f"Disallowed operator in input: {k}")
            reject_operators(value[k])
    elif isinstance(value, list):
        for item in value:
            reject_operators(item)
    return value


def clean_text(value: str, *, max_length: int = 500) -> str:
    """
    Strip ALL HTML tags and dangerous attributes from user text.
    Returns plain text suitable for safe DB storage and rendering anywhere.
    """
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)

    # bleach.clean with no allowed tags = strip everything
    cleaned = bleach.clean(value, tags=[], attributes={}, strip=True)
    # Remove residual control chars and null bytes
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", cleaned)
    cleaned = cleaned.strip()
    return cleaned[:max_length]


def safe_filename(name: str) -> str:
    """Reduce a filename to safe characters only — used for uploads."""
    if not isinstance(name, str):
        return "file"
    name = re.sub(r"[^A-Za-z0-9._\-]", "_", name)
    name = name.strip("._")
    return name[:80] or "file"
