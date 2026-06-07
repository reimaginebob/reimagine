#!/usr/bin/env python3
"""
Build the Reimagine User Guide PDF from the canonical repo markdown chapters.

Reads:  <repo>/src/data/user-guide/*.md   (canonical source)
Writes: <repo>/public/reimagine-user-guide.pdf

Repointed from the deprecated workspace copy (Output/docs/reimagine-user-guide/)
to the repo source per Output/handoff/2026-06-07_pdf-pipeline-repoint-and-regen.md.
Run weekly (Sunday night) via scheduled task.
"""

import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    ListFlowable,
    ListItem,
    HRFlowable,
)


BODY_FONT = "Helvetica"
BODY_FONT_BOLD = "Helvetica-Bold"
BODY_FONT_ITALIC = "Helvetica-Oblique"


# Repo-relative resolution: the script lives at <repo>/scripts/, the chapters
# live at <repo>/src/data/user-guide/, the PDF target lives at <repo>/public/.
REPO_ROOT = Path(__file__).resolve().parent.parent
CHAPTERS_DIR = REPO_ROOT / "src" / "data" / "user-guide"
OUTPUT_PDF = REPO_ROOT / "public" / "reimagine-user-guide.pdf"

if not CHAPTERS_DIR.is_dir():
    print(f"ERROR: chapters dir not found at {CHAPTERS_DIR}", file=sys.stderr)
    sys.exit(1)


INLINE_CODE_RE = re.compile(r"`([^`]+)`")
BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")
ITALIC_RE = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)")
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
BULLET_RE = re.compile(r"^[-*]\s+(.*)$")
NUMBERED_RE = re.compile(r"^(\d+)\.\s+(.*)$")
BLOCKQUOTE_RE = re.compile(r"^>\s?(.*)$")
HR_RE = re.compile(r"^-{3,}$|^\*{3,}$")


def escape_xml(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_inline(text: str) -> str:
    text = escape_xml(text)
    text = INLINE_CODE_RE.sub(
        lambda m: f'<font face="Courier" size="10">{m.group(1)}</font>', text
    )
    text = BOLD_RE.sub(r"<b>\1</b>", text)
    text = ITALIC_RE.sub(r"<i>\1</i>", text)

    def _link(m):
        label, url = m.group(1), m.group(2)
        if url.startswith(("http://", "https://", "mailto:")):
            return f'<link href="{url}"><font color="#1a4fb8">{label}</font></link>'
        return label

    text = LINK_RE.sub(_link, text)
    return text


def make_styles():
    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        name="Body", parent=styles["BodyText"], fontName=BODY_FONT,
        fontSize=10.5, leading=15, spaceBefore=2, spaceAfter=6,
        alignment=TA_LEFT, textColor=colors.HexColor("#222222"),
    )
    h1 = ParagraphStyle(
        name="H1", parent=styles["Heading1"], fontName=BODY_FONT_BOLD,
        fontSize=22, leading=26, spaceBefore=0, spaceAfter=14,
        textColor=colors.HexColor("#111111"),
    )
    h2 = ParagraphStyle(
        name="H2", parent=styles["Heading2"], fontName=BODY_FONT_BOLD,
        fontSize=15, leading=19, spaceBefore=14, spaceAfter=6,
        textColor=colors.HexColor("#111111"),
    )
    h3 = ParagraphStyle(
        name="H3", parent=styles["Heading3"], fontName=BODY_FONT_BOLD,
        fontSize=12, leading=15, spaceBefore=10, spaceAfter=4,
        textColor=colors.HexColor("#111111"),
    )
    blockquote = ParagraphStyle(
        name="Blockquote", parent=body, leftIndent=16, rightIndent=8,
        fontName=BODY_FONT_ITALIC, textColor=colors.HexColor("#555555"),
        spaceBefore=6, spaceAfter=8,
    )
    cover_title = ParagraphStyle(
        name="CoverTitle", parent=h1, fontSize=30, leading=36,
        alignment=TA_CENTER, spaceBefore=120, spaceAfter=20,
    )
    cover_sub = ParagraphStyle(
        name="CoverSub", parent=body, fontSize=14, leading=20,
        alignment=TA_CENTER, textColor=colors.HexColor("#555555"), spaceAfter=80,
    )
    cover_meta = ParagraphStyle(
        name="CoverMeta", parent=body, fontSize=10, alignment=TA_CENTER,
        textColor=colors.HexColor("#888888"),
    )
    return {
        "body": body, "h1": h1, "h2": h2, "h3": h3, "blockquote": blockquote,
        "cover_title": cover_title, "cover_sub": cover_sub, "cover_meta": cover_meta,
    }


def parse_markdown(md_text: str, styles: dict, skip_first_h1: bool = False):
    flowables = []
    lines = md_text.split("\n")
    skipped_h1 = False
    pending_para: list[str] = []
    pending_bullets: list[str] = []
    pending_quote: list[str] = []

    def flush_para():
        nonlocal pending_para
        if pending_para:
            text = " ".join(pending_para).strip()
            if text:
                flowables.append(Paragraph(render_inline(text), styles["body"]))
            pending_para = []

    def flush_bullets():
        nonlocal pending_bullets
        if pending_bullets:
            items = [
                ListItem(Paragraph(render_inline(b), styles["body"]),
                         leftIndent=14, value="bullet")
                for b in pending_bullets
            ]
            flowables.append(ListFlowable(
                items, bulletType="bullet", start="•",
                leftIndent=18, bulletFontSize=9,
            ))
            flowables.append(Spacer(1, 4))
            pending_bullets = []

    def flush_quote():
        nonlocal pending_quote
        if pending_quote:
            text = " ".join(pending_quote).strip()
            if text:
                flowables.append(Paragraph(render_inline(text), styles["blockquote"]))
            pending_quote = []

    def flush_all():
        flush_para()
        flush_bullets()
        flush_quote()

    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            flush_all()
            i += 1
            continue
        if HR_RE.match(line.strip()):
            flush_all()
            flowables.append(Spacer(1, 6))
            flowables.append(HRFlowable(
                width="100%", thickness=0.5,
                color=colors.HexColor("#cccccc"),
                spaceBefore=2, spaceAfter=8,
            ))
            i += 1
            continue
        m = HEADING_RE.match(line)
        if m:
            flush_all()
            level = len(m.group(1))
            text = m.group(2).strip()
            if level == 1 and skip_first_h1 and not skipped_h1:
                skipped_h1 = True
                i += 1
                continue
            style = styles["h1"] if level == 1 else (
                styles["h2"] if level == 2 else styles["h3"]
            )
            flowables.append(Paragraph(render_inline(text), style))
            i += 1
            continue
        m = BLOCKQUOTE_RE.match(line)
        if m:
            flush_para()
            flush_bullets()
            pending_quote.append(m.group(1))
            i += 1
            continue
        m = BULLET_RE.match(line)
        if m:
            flush_para()
            flush_quote()
            pending_bullets.append(m.group(1))
            i += 1
            continue
        m = NUMBERED_RE.match(line)
        if m:
            flush_para()
            flush_quote()
            pending_bullets.append(m.group(2))
            i += 1
            continue
        flush_bullets()
        flush_quote()
        pending_para.append(line.strip())
        i += 1

    flush_all()
    return flowables


def on_later_pages(canvas, doc):
    canvas.saveState()
    canvas.setFont(BODY_FONT, 8)
    canvas.setFillColor(colors.HexColor("#999999"))
    canvas.drawCentredString(LETTER[0] / 2, 0.5 * inch, f"{doc.page}")
    canvas.drawString(0.75 * inch, 0.5 * inch, "Reimagine — User Guide")
    canvas.restoreState()


def on_first_page(canvas, doc):
    pass


def chapter_files():
    return sorted(p for p in CHAPTERS_DIR.glob("*.md") if p.name != "index.md")


def build():
    styles = make_styles()
    flowables = []

    flowables.append(Paragraph("Reimagine", styles["cover_title"]))
    flowables.append(Paragraph("User Guide", styles["cover_title"]))
    flowables.append(Paragraph(
        "A plain-English guide to using Reimagine to build your career strategy.",
        styles["cover_sub"],
    ))
    flowables.append(Spacer(1, 60))
    flowables.append(Paragraph(
        "Career Club &nbsp;·&nbsp; reimagine.career.club",
        styles["cover_meta"],
    ))
    flowables.append(PageBreak())

    index_path = CHAPTERS_DIR / "index.md"
    if index_path.exists():
        index_md = index_path.read_text(encoding="utf-8")
        flowables.extend(parse_markdown(index_md, styles, skip_first_h1=True))
        flowables.append(PageBreak())

    for ch_path in chapter_files():
        md = ch_path.read_text(encoding="utf-8")
        flowables.extend(parse_markdown(md, styles, skip_first_h1=False))
        flowables.append(PageBreak())

    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=LETTER,
        leftMargin=0.85 * inch, rightMargin=0.85 * inch,
        topMargin=0.85 * inch, bottomMargin=0.85 * inch,
        title="Reimagine — User Guide",
        author="Career Club / Decima LLC",
        subject="Reimagine User Guide",
    )
    doc.build(flowables, onFirstPage=on_first_page, onLaterPages=on_later_pages)

    size = OUTPUT_PDF.stat().st_size
    print(f"Built {OUTPUT_PDF} ({size} bytes)")


if __name__ == "__main__":
    build()
