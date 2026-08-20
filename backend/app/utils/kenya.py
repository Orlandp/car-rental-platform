import random
import re
import string

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


def generate_mock_mpesa_receipt():
    """Return a Safaricom-style mock M-Pesa receipt code, e.g. QGR7XJ9K2L."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=10))


def generate_mock_transaction_id():
    return f"MOCK{''.join(random.choices(string.digits, k=12))}"
