from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
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


def _draw_barcode(c, value, x, y, bar_height=12 * mm, bar_width=0.32 * mm):
    barcode = code128.Code128(value, barHeight=bar_height, barWidth=bar_width)
    barcode.drawOn(c, x, y)


def _draw_verification_footer(c, doc_number, qr_payload, issued_label):
    """Bottom-of-page QR + barcode block shared by invoices and receipts. Scanning the QR
    reveals the same structured details printed on the document (no live verification
    portal exists yet - this is an offline-readable anti-tamper aid, not a KRA/NTSA lookup)."""
    c.saveState()
    left = 20 * mm
    _draw_qr(c, qr_payload, left, 12 * mm, size=26 * mm)
    c.setFont("Helvetica", 6.5)
    c.setFillColor(colors.grey)
    c.drawCentredString(left + 13 * mm, 9 * mm, "Scan for document details")

    barcode_x = left + 40 * mm
    _draw_barcode(c, doc_number, barcode_x, 14 * mm)
    c.setFont("Helvetica", 7)
    c.setFillColor(colors.grey)
    c.drawString(barcode_x, 9 * mm, doc_number)

    c.setFont("Helvetica", 6.5)
    c.drawRightString(PAGE_WIDTH - 20 * mm, 10 * mm, issued_label)
    c.restoreState()


def render_invoice_pdf(invoice, booking, company):
    """Render a VAT invoice for a booking as PDF bytes."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=38 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title=f"Invoice {invoice.invoice_number}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "InvoiceTitle", parent=styles["Title"], fontSize=20, spaceAfter=2
    )
    company_name_style = ParagraphStyle(
        "CompanyName", parent=styles["Heading2"], spaceAfter=2
    )
    normal = styles["Normal"]

    elements = []

    company_name = company.name or "Company name not set"
    elements.append(Paragraph(company_name, company_name_style))
    company_lines = []
    if company.address:
        company_lines.append(company.address)
    if company.city:
        company_lines.append(company.city)
    if company.phone:
        company_lines.append(f"Tel: {company.phone}")
    if company.email:
        company_lines.append(company.email)
    if company.kra_pin:
        company_lines.append(f"KRA PIN: {company.kra_pin}")
    for line in company_lines:
        elements.append(Paragraph(line, normal))

    elements.append(Spacer(1, 10 * mm))
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

    vehicle_desc = booking.vehicle.name if booking.vehicle else "Vehicle rental"
    description = (
        f"{vehicle_desc} rental<br/>{booking.start_date} to {booking.end_date}"
    )
    subtotal, vat_amount, total = invoice.vat_breakdown

    items_data = [
        ["Description", "Amount (KES)"],
        [Paragraph(description, normal), f"{subtotal:,.2f}"],
    ]
    if booking.late_fee and float(booking.late_fee) > 0:
        items_data.append(["Late return fee (included above)", ""])

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
    elements.append(Spacer(1, 12 * mm))

    footer_text = "This is a computer-generated tax invoice."
    if company.kra_pin:
        footer_text += f" Company KRA PIN: {company.kra_pin}."
    elements.append(Paragraph(footer_text, ParagraphStyle("Footer", parent=normal, fontSize=8, textColor=colors.grey)))

    qr_payload = (
        f"INVOICE:{invoice.invoice_number}\n"
        f"BOOKING:{booking_reference}\n"
        f"TOTAL_KES:{total:,.2f}\n"
        f"DATE:{invoice.issued_at.strftime('%Y-%m-%d') if invoice.issued_at else '-'}\n"
        f"KRA_PIN:{company.kra_pin or '-'}\n"
        f"COMPANY:{company_name}"
    )

    def _page_furniture(c, _doc):
        _draw_watermark(c, company_name.upper() if company_name else "UNOFFICIAL")
        _draw_verification_footer(
            c,
            invoice.invoice_number,
            qr_payload,
            f"Issued {invoice.issued_at.strftime('%Y-%m-%d') if invoice.issued_at else '-'}",
        )

    doc.build(elements, onFirstPage=_page_furniture, onLaterPages=_page_furniture)
    return buffer.getvalue()


def render_receipt_pdf(receipt, payment, booking, company):
    """Render a payment receipt as PDF bytes - a separate document from the invoice,
    issued once a specific payment is confirmed."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=38 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title=f"Receipt {receipt.receipt_number}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("ReceiptTitle", parent=styles["Title"], fontSize=20, spaceAfter=2)
    company_name_style = ParagraphStyle("CompanyName", parent=styles["Heading2"], spaceAfter=2)
    normal = styles["Normal"]

    elements = []

    company_name = company.name or "Company name not set"
    elements.append(Paragraph(company_name, company_name_style))
    for line in filter(None, [company.address, company.city, company.email, company.kra_pin and f"KRA PIN: {company.kra_pin}"]):
        elements.append(Paragraph(line, normal))

    elements.append(Spacer(1, 10 * mm))
    elements.append(Paragraph("PAYMENT RECEIPT", title_style))
    elements.append(Spacer(1, 6 * mm))

    client_name = booking.client.name if booking.client else (booking.guest_name or "Walk-in guest")
    booking_reference = booking.reference or f"BK-{booking.id:06d}"

    info_data = [
        ["Receipt Number:", receipt.receipt_number],
        ["Issued:", receipt.issued_at.strftime("%Y-%m-%d %H:%M") if receipt.issued_at else "-"],
        ["Received From:", client_name],
        ["Booking Reference:", booking_reference],
        ["Vehicle:", booking.vehicle.name if booking.vehicle else "-"],
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
    elements.append(Spacer(1, 12 * mm))

    elements.append(
        Paragraph(
            "This receipt confirms payment was received and recorded against the booking above.",
            ParagraphStyle("Footer", parent=normal, fontSize=8, textColor=colors.grey),
        )
    )

    qr_payload = (
        f"RECEIPT:{receipt.receipt_number}\n"
        f"BOOKING:{booking_reference}\n"
        f"AMOUNT_KES:{float(payment.amount):,.2f}\n"
        f"METHOD:{payment.method}\n"
        f"DATE:{receipt.issued_at.strftime('%Y-%m-%d') if receipt.issued_at else '-'}\n"
        f"COMPANY:{company_name}"
    )

    def _page_furniture(c, _doc):
        _draw_watermark(c, "PAID", font_size=90, alpha=0.09)
        _draw_verification_footer(
            c,
            receipt.receipt_number,
            qr_payload,
            f"Issued {receipt.issued_at.strftime('%Y-%m-%d') if receipt.issued_at else '-'}",
        )

    doc.build(elements, onFirstPage=_page_furniture, onLaterPages=_page_furniture)
    return buffer.getvalue()
