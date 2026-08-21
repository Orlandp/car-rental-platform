import re

KENYA_LOCATIONS = [
    "Nairobi CBD",
    "Nairobi JKIA",
    "Nairobi Westlands",
    "Mombasa",
    "Kisumu",
    "Nakuru",
    "Eldoret",
    "Naivasha",
    "Malindi",
    "Kiambu",
    "Thika",
]

VEHICLE_CATEGORIES = [
    "sedan",
    "suv",
    "van",
    "pickup",
    "minibus",
    "tuk_tuk",
    "other",
]

_PHONE_RE = re.compile(r"^(?:\+?254|0)([17]\d{8})$")

# Kenyan national ID numbers are numeric-only. Historical IDs (issued since the 1970s)
# run as short as 6 digits; the current format issued today is 8 digits - so 6-8 covers
# a real ID belonging to anyone still alive without accepting obviously-wrong input.
_ID_NUMBER_RE = re.compile(r"^\d{6,8}$")

# NTSA driving licence numbers are also numeric-only and, in practice, the same length
# range as a national ID (many licences are numbered off the holder's ID). This is a
# format/length check, not a live NTSA registry lookup - same "not an automated
# authenticity check" caveat as the rest of identity verification in this app.
_DL_NUMBER_RE = re.compile(r"^\d{5,8}$")


def normalize_kenyan_phone(raw):
    """Validate a Kenyan mobile number and return it in 254XXXXXXXXX form.

    Accepts 07XXXXXXXX / 01XXXXXXXX (10 digits) and +254/254 equivalents.
    Raises ValueError with a user-facing message if the format is invalid.
    """
    cleaned = re.sub(r"[\s\-]", "", raw or "")
    match = _PHONE_RE.match(cleaned)
    if not match:
        raise ValueError("phone number must be a valid Kenyan mobile number (07XXXXXXXX or 01XXXXXXXX)")
    return f"254{match.group(1)}"


def validate_kenyan_id_number(raw):
    """Validate a Kenyan national ID number (digits only, 6-8 long) and return it
    normalized (whitespace/dashes stripped). Raises ValueError if malformed."""
    cleaned = re.sub(r"[\s\-]", "", raw or "")
    if not _ID_NUMBER_RE.match(cleaned):
        raise ValueError("national ID number must be 6-8 digits")
    return cleaned


def validate_kenyan_dl_number(raw):
    """Validate a Kenyan driving licence number (digits only, 5-8 long) and return it
    normalized. Raises ValueError if malformed."""
    cleaned = re.sub(r"[\s\-]", "", raw or "")
    if not _DL_NUMBER_RE.match(cleaned):
        raise ValueError("driver's license number must be 5-8 digits")
    return cleaned
