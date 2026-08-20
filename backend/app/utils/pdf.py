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


def render_invoice_pdf(invoice, booking, company):
    """Render a VAT invoice for a booking as PDF bytes."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
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

    info_data = [
        ["Invoice Number:", invoice.invoice_number],
        ["Invoice Date:", invoice.issued_at.strftime("%Y-%m-%d") if invoice.issued_at else "-"],
        ["Booking Reference:", f"BK-{booking.id:06d}"],
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

    doc.build(elements)
    return buffer.getvalue()
