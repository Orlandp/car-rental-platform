import base64
from datetime import datetime

import requests
from flask import current_app


class MpesaError(Exception):
    """Raised when Safaricom's Daraja API rejects a request or is unreachable."""


def _get_access_token():
    consumer_key = current_app.config["MPESA_CONSUMER_KEY"]
    consumer_secret = current_app.config["MPESA_CONSUMER_SECRET"]
    if not consumer_key or not consumer_secret:
        raise MpesaError("MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET are not configured")

    resp = requests.get(
        f"{current_app.config['MPESA_BASE_URL']}/oauth/v1/generate",
        params={"grant_type": "client_credentials"},
        auth=(consumer_key, consumer_secret),
        timeout=15,
    )
    if not resp.ok:
        raise MpesaError(f"failed to get M-Pesa access token ({resp.status_code}): {resp.text}")

    token = (resp.json() or {}).get("access_token")
    if not token:
        raise MpesaError(f"no access_token in M-Pesa OAuth response: {resp.text}")
    return token


def _password_and_timestamp():
    shortcode = current_app.config["MPESA_SHORTCODE"]
    passkey = current_app.config["MPESA_PASSKEY"]
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode()
    return password, timestamp


def initiate_stk_push(*, phone_number, amount, account_reference, transaction_desc):
    """Trigger an STK push PIN prompt on the customer's phone for `amount`
    (whole KES - Safaricom's sandbox/production APIs don't take decimals).

    `phone_number` must already be normalized to 254XXXXXXXXX form (see
    app.utils.kenya.normalize_kenyan_phone).

    Returns the parsed JSON response from Daraja (MerchantRequestID,
    CheckoutRequestID, ResponseCode, ...) on success. Raises MpesaError
    otherwise - callers should turn that into a 502 for the client rather
    than pretending the payment was created successfully.
    """
    callback_url = current_app.config["MPESA_CALLBACK_URL"]
    if not callback_url:
        raise MpesaError(
            "MPESA_CALLBACK_URL is not configured - Safaricom needs a public HTTPS "
            "URL to POST the payment result back to"
        )

    token = _get_access_token()
    password, timestamp = _password_and_timestamp()
    shortcode = current_app.config["MPESA_SHORTCODE"]

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(round(amount)),
        "PartyA": phone_number,
        "PartyB": shortcode,
        "PhoneNumber": phone_number,
        "CallBackURL": callback_url,
        # Daraja caps these at 12 / 13 characters respectively.
        "AccountReference": (account_reference or "CarRental")[:12],
        "TransactionDesc": (transaction_desc or "Car rental payment")[:13],
    }

    resp = requests.post(
        f"{current_app.config['MPESA_BASE_URL']}/mpesa/stkpush/v1/processrequest",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    data = resp.json() if resp.content else {}

    if not resp.ok or str(data.get("ResponseCode")) != "0":
        message = data.get("errorMessage") or data.get("ResponseDescription") or resp.text
        raise MpesaError(f"STK push request was rejected: {message}")

    return data


def parse_stk_callback(payload):
    """Extract the fields we care about from a Daraja STK callback POST body.

    Safaricom only includes CallbackMetadata (amount/receipt/etc.) when
    result_code == 0, so those four fields are None on a failed/cancelled push.
    """
    stk = ((payload or {}).get("Body") or {}).get("stkCallback") or {}
    items = ((stk.get("CallbackMetadata") or {}).get("Item")) or []
    values = {item.get("Name"): item.get("Value") for item in items}

    return {
        "merchant_request_id": stk.get("MerchantRequestID"),
        "checkout_request_id": stk.get("CheckoutRequestID"),
        "result_code": stk.get("ResultCode"),
        "result_desc": stk.get("ResultDesc"),
        "amount": values.get("Amount"),
        "mpesa_receipt": values.get("MpesaReceiptNumber"),
        "transaction_date": values.get("TransactionDate"),
        "phone_number": values.get("PhoneNumber"),
    }
