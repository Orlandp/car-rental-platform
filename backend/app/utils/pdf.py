import os
from io import BytesIO

from flask import current_app
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    Flowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.graphics.barcode import code128, qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

PAGE_WIDTH, PAGE_HEIGHT = A4

# Header band shared by every page: logo box (left) + company name/details (centre) +
# QR code (right), with a divider line beneath it. Content flowables start below this.
HEADER_TOP = PAGE_HEIGHT - 15 * mm
LOGO_X = 20 * mm
LOGO_W, LOGO_H = 30 * mm, 20 * mm
LOGO_Y = HEADER_TOP - LOGO_H
HEADER_DIVIDER_Y = LOGO_Y - 8 * mm
CONTENT_TOP_MARGIN = PAGE_HEIGHT - HEADER_DIVIDER_Y + 6 * mm


def _draw_watermark(c, text, angle=42, font_size=64, alpha=0.07):
    """Large diagonal text behind the page content - the standard low-tech anti-tamper
    treatment (same idea as a bank statement or exam certificate watermark)."""
    c.saveState()
    c.setFont("Helvetica-Bold", font_size)
    c.setFillColor(colors.Color(0, 0, 0, alpha=alpha))
    c.translate(PAGE_WIDTH / 2, PAGE_HEIGHT / 2)
    c.rotate(angle)
    c.drawCentredString(0, 0, text)
    c.restoreState()


def _draw_qr(c, data, x, y, size=32 * mm):
    widget = qr.QrCodeWidget(data)
    x0, y0, x1, y1 = widget.getBounds()
    w, h = x1 - x0, y1 - y0
    drawing = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, x, y)


class _BarcodeFlowable(Flowable):
    """The doc-number barcode as a Platypus flowable, so it lands in normal document
    flow (below the items/amount table) rather than pinned to a fixed canvas position.
    code128.Code128 is a Widget, not a Shape/UserNode, so it can't be added as a child
    of a graphics Drawing/Group - it has to draw itself straight onto the canvas."""

    def __init__(self, value, bar_height=13 * mm, bar_width=0.32 * mm):
        super().__init__()
        self.barcode = code128.Code128(value, barHeight=bar_height, barWidth=bar_width)
        self.width = self.barcode.width
        self.height = self.barcode.height

    def draw(self):
        self.barcode.drawOn(self.canv, 0, 0)


def _barcode_flowable(value, bar_height=13 * mm, bar_width=0.32 * mm):
    return _BarcodeFlowable(value, bar_height=bar_height, bar_width=bar_width)


def _company_initials(name):
    words = [w for w in (name or "").split() if w]
    if not words:
        return "?"
    if len(words) == 1:
        return words[0][:2].upper()
    return (words[0][0] + words[1][0]).upper()


def _draw_logo_box(c, company, x, y, w, h):
    """Draws the company's uploaded logo image if one is on file, otherwise a bordered
    placeholder box with the company's initials - this box is reserved for the logo
    specifically, so no other text is ever placed inside it."""
    c.saveState()
    logo_drawn = False
    if company.logo_path:
        try:
            upload_folder = current_app.config["COMPANY_UPLOAD_FOLDER"]
        except RuntimeError:
            upload_folder = None
        if upload_folder:
            logo_path = os.path.join(upload_folder, company.logo_path)
            if os.path.isfile(logo_path):
                try:
                    c.drawImage(
                        logo_path,
                        x,
                        y,
                        width=w,
                        height=h,
                        preserveAspectRatio=True,
                        anchor="c",
                        mask="auto",
                    )
                    logo_drawn = True
                except Exception:
                    logo_drawn = False

    if not logo_drawn:
        c.setFillColor(colors.HexColor("#f1f5f9"))
        c.setStrokeColor(colors.HexColor("#cbd5e0"))
        c.roundRect(x, y, w, h, 3, fill=1, stroke=1)
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(x + w / 2, y + h / 2 - 4, _company_initials(company.name))
        c.setFont("Helvetica", 6)
        c.drawCentredString(x + w / 2, y + 4, "COMPANY LOGO")
    c.restoreState()


def _draw_header(c, company, doc_number, qr_payload, issued_label):
    """Canvas-drawn page furniture repeated on every page: logo (left), company name +
    contact details (centre - deliberately NOT in the logo's box), and the QR code
    (right, near the top of the page) with the document number/issue date beneath it."""
    c.saveState()

    _draw_logo_box(c, company, LOGO_X, LOGO_Y, LOGO_W, LOGO_H)

    info_x = LOGO_X + LOGO_W + 6 * mm
    info_y = HEADER_TOP - 4 * mm
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(colors.black)
    c.drawString(info_x, info_y, company.name or "Company name not set")

    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.grey)
    line_y = info_y - 10
    for line in filter(
        None,
        [
            company.address,
            company.city,
            f"Tel: {company.phone}" if company.phone else None,
            company.email,
            f"KRA PIN: {company.kra_pin}" if company.kra_pin else None,
        ],
    ):
        c.drawString(info_x, line_y, line)
        line_y -= 8.5

    qr_size = 22 * mm
    qr_x = PAGE_WIDTH - 20 * mm - qr_size
    qr_y = HEADER_TOP - qr_size
    _draw_qr(c, qr_payload, qr_x, qr_y, size=qr_size)
    c.setFont("Helvetica", 6)
    c.setFillColor(colors.grey)
    c.drawCentredString(qr_x + qr_size / 2, qr_y - 8, "Scan to verify")
    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColor(colors.black)
    c.drawRightString(PAGE_WIDTH - 20 * mm, qr_y - 18, doc_number)
    c.setFont("Helvetica", 6.5)
    c.setFillColor(colors.grey)
    c.drawRightString(PAGE_WIDTH - 20 * mm, qr_y - 26, issued_label)

    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.setLineWidth(0.75)
    c.line(20 * mm, HEADER_DIVIDER_Y, PAGE_WIDTH - 20 * mm, HEADER_DIVIDER_Y)
    c.restoreState()


def _draw_footer_line(c, label):
    c.saveState()
    c.setFont("Helvetica", 6.5)
    c.setFillColor(colors.grey)
    c.drawCentredString(PAGE_WIDTH / 2, 12 * mm, label)
    c.restoreState()


def render_invoice_pdf(invoice, booking, company):
    """Render a VAT invoice for a booking as PDF bytes."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=CONTENT_TOP_MARGIN,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title=f"Invoice {invoice.invoice_number}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "InvoiceTitle", parent=styles["Title"], fontSize=20, spaceAfter=2
    )
    normal = styles["Normal"]
    small_grey = ParagraphStyle("SmallGrey", parent=normal, fontSize=7.5, textColor=colors.grey)

    elements = []

    elements.append(Paragraph("TAX INVOICE", title_style))
    elements.append(Spacer(1, 4 * mm))

    client_name = booking.client.name if booking.client else (booking.guest_name or "Walk-in guest")
    client_lines = [f"<b>Bill To:</b> {client_name}"]
    if booking.client and booking.client.email:
        client_lines.append(booking.client.email)
    elif booking.guest_email:
        client_lines.append(booking.guest_email)
    if booking.guest_phone:
        client_lines.append(booking.guest_phone)

    meta_data = [
        [Paragraph("<br/>".join(client_lines), normal), ""],
    ]
    meta_table = Table(meta_data, colWidths=[100 * mm, 70 * mm])
    meta_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(meta_table)
    elements.append(Spacer(1, 4 * mm))

    booking_reference = booking.reference or f"BK-{booking.id:06d}"
    info_data = [
        ["Invoice Number:", invoice.invoice_number],
        ["Invoice Date:", invoice.issued_at.strftime("%Y-%m-%d") if invoice.issued_at else "-"],
        ["Booking Reference:", booking_reference],
    ]
    info_table = Table(info_data, colWidths=[45 * mm, 60 * mm])
    info_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    elements.append(info_table)
    elements.append(Spacer(1, 8 * mm))

    # Vehicle rental and (if hired) the professional driver are billed as two separate
    # line items so the customer can see exactly what they paid for. The invoice's VAT-
    # exclusive subtotal is split between them proportionally to the day-rate each
    # contributed, which keeps the lines summing to the subtotal even if an admin later
    # overrode the invoice's total amount by hand.
    days = (booking.end_date - booking.start_date).days
    vehicle_desc = booking.vehicle.name if booking.vehicle else "Vehicle rental"
    vehicle_rate = float(booking.vehicle.price_per_day) if booking.vehicle else 0.0
    driver_rate = float(booking.driver_rate) if booking.with_driver else 0.0
    raw_vehicle_total = days * vehicle_rate
    raw_driver_total = days * driver_rate
    raw_combined = raw_vehicle_total + raw_driver_total

    subtotal, vat_amount, total = invoice.vat_breakdown

    if raw_combined > 0:
        vehicle_line_amount = round(subtotal * (raw_vehicle_total / raw_combined), 2)
    else:
        vehicle_line_amount = subtotal
    driver_line_amount = round(subtotal - vehicle_line_amount, 2)

    day_word = "day" if days == 1 else "days"
    items_data = [
        ["Description", "Amount (KES)"],
        [
            Paragraph(
                f"{vehicle_desc} rental<br/>{booking.start_date} to {booking.end_date} "
                f"({days} {day_word})",
                normal,
            ),
            f"{vehicle_line_amount:,.2f}",
        ],
    ]
    if booking.with_driver:
        items_data.append(
            [
                Paragraph(
                    f"Professional driver<br/>{days} {day_word} @ KSh {driver_rate:,.2f}/day",
                    normal,
                ),
                f"{driver_line_amount:,.2f}",
            ]
        )
    if booking.late_fee and float(booking.late_fee) > 0:
        items_data.append(
            [
                Paragraph(
                    "Late return fee <font color='grey'>(billed separately, not "
                    "included in the total below)</font>",
                    normal,
                ),
                f"{float(booking.late_fee):,.2f}",
            ]
        )

    items_table = Table(items_data, colWidths=[110 * mm, 40 * mm])
    items_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2d3748")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(items_table)
    elements.append(Spacer(1, 4 * mm))

    totals_data = [
        ["Subtotal", f"{subtotal:,.2f}"],
        [f"VAT ({float(invoice.vat_rate):g}%)", f"{vat_amount:,.2f}"],
        ["Total (KES)", f"{total:,.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[110 * mm, 40 * mm])
    totals_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("LINEABOVE", (0, -1), (-1, -1), 0.75, colors.black),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(totals_table)
    elements.append(Spacer(1, 10 * mm))

    elements.append(Paragraph(f"Document reference — {invoice.invoice_number}", small_grey))
    elements.append(Spacer(1, 2 * mm))
    elements.append(_barcode_flowable(invoice.invoice_number))
    elements.append(Spacer(1, 8 * mm))

    footer_text = "This is a computer-generated tax invoice."
    if company.kra_pin:
        footer_text += f" Company KRA PIN: {company.kra_pin}."
    elements.append(Paragraph(footer_text, ParagraphStyle("Footer", parent=normal, fontSize=8, textColor=colors.grey)))

    company_name = company.name or "Company name not set"
    qr_payload = (
        f"INVOICE:{invoice.invoice_number}\n"
        f"BOOKING:{booking_reference}\n"
        f"VEHICLE:{vehicle_desc}\n"
        f"WITH_DRIVER:{'yes' if booking.with_driver else 'no'}\n"
        f"TOTAL_KES:{total:,.2f}\n"
        f"DATE:{invoice.issued_at.strftime('%Y-%m-%d') if invoice.issued_at else '-'}\n"
        f"KRA_PIN:{company.kra_pin or '-'}\n"
        f"COMPANY:{company_name}"
    )

    def _page_furniture(c, _doc):
        _draw_watermark(c, company_name.upper() if company_name else "UNOFFICIAL")
        _draw_header(
            c,
            company,
            invoice.invoice_number,
            qr_payload,
            f"Issued {invoice.issued_at.strftime('%Y-%m-%d') if invoice.issued_at else '-'}",
        )
        _draw_footer_line(c, f"{company_name} — {invoice.invoice_number}")

    doc.build(elements, onFirstPage=_page_furniture, onLaterPages=_page_furniture)
    return buffer.getvalue()


def render_receipt_pdf(receipt, payment, booking, company, invoice=None):
    """Render a payment receipt as PDF bytes - a separate document from the invoice,
    issued once a specific payment is confirmed. `invoice` (if passed) is the booking's
    invoice, so the receipt can state which invoice this payment is being paid against."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=CONTENT_TOP_MARGIN,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title=f"Receipt {receipt.receipt_number}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("ReceiptTitle", parent=styles["Title"], fontSize=20, spaceAfter=2)
    normal = styles["Normal"]
    small_grey = ParagraphStyle("SmallGrey", parent=normal, fontSize=7.5, textColor=colors.grey)

    elements = []

    elements.append(Paragraph("PAYMENT RECEIPT", title_style))
    elements.append(Spacer(1, 6 * mm))

    client_name = booking.client.name if booking.client else (booking.guest_name or "Walk-in guest")
    booking_reference = booking.reference or f"BK-{booking.id:06d}"

    info_data = [
        ["Receipt Number:", receipt.receipt_number],
        ["Invoice Number:", invoice.invoice_number if invoice else "not yet issued"],
        ["Issued:", receipt.issued_at.strftime("%Y-%m-%d %H:%M") if receipt.issued_at else "-"],
        ["Received From:", client_name],
        ["Booking Reference:", booking_reference],
        ["Vehicle:", booking.vehicle.name if booking.vehicle else "-"],
        ["With Driver:", "Yes" if booking.with_driver else "No"],
        ["Payment Method:", payment.method.replace("_", " ").title()],
    ]
    if payment.mpesa_receipt:
        info_data.append(["M-Pesa Code:", payment.mpesa_receipt])
    info_table = Table(info_data, colWidths=[45 * mm, 100 * mm])
    info_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(info_table)
    elements.append(Spacer(1, 10 * mm))

    amount_data = [["Amount Received (KES)", f"{float(payment.amount):,.2f}"]]
    amount_table = Table(amount_data, colWidths=[110 * mm, 40 * mm])
    amount_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#166534")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(amount_table)
    elements.append(Spacer(1, 10 * mm))

    elements.append(Paragraph(f"Document reference — {receipt.receipt_number}", small_grey))
    elements.append(Spacer(1, 2 * mm))
    elements.append(_barcode_flowable(receipt.receipt_number))
    elements.append(Spacer(1, 8 * mm))

    elements.append(
        Paragraph(
            "This receipt confirms payment was received and recorded against the "
            f"booking and invoice above{' (' + invoice.invoice_number + ')' if invoice else ''}.",
            ParagraphStyle("Footer", parent=normal, fontSize=8, textColor=colors.grey),
        )
    )

    company_name = company.name or "Company name not set"
    qr_payload = (
        f"RECEIPT:{receipt.receipt_number}\n"
        f"INVOICE:{invoice.invoice_number if invoice else '-'}\n"
        f"BOOKING:{booking_reference}\n"
        f"AMOUNT_KES:{float(payment.amount):,.2f}\n"
        f"METHOD:{payment.method}\n"
        f"DATE:{receipt.issued_at.strftime('%Y-%m-%d') if receipt.issued_at else '-'}\n"
        f"COMPANY:{company_name}"
    )

    def _page_furniture(c, _doc):
        _draw_watermark(c, "PAID", font_size=90, alpha=0.09)
        _draw_header(
            c,
            company,
            receipt.receipt_number,
            qr_payload,
            f"Issued {receipt.issued_at.strftime('%Y-%m-%d') if receipt.issued_at else '-'}",
        )
        _draw_footer_line(c, f"{company_name} — {receipt.receipt_number}")

    doc.build(elements, onFirstPage=_page_furniture, onLaterPages=_page_furniture)
    return buffer.getvalue()
