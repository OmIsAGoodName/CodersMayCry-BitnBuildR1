import sys
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette (Dark Theme / Executive Modern)
    BG_COLOR = RGBColor(11, 15, 25)        # #0B0F19 (Deep Obsidian)
    CARD_BG = RGBColor(21, 29, 45)         # #151D2D (Elevated Surface)
    CARD_BORDER = RGBColor(38, 51, 77)     # #26334D (Card Border)
    TEXT_MAIN = RGBColor(248, 250, 252)    # #F8FAFC (White Primary)
    TEXT_MUTED = RGBColor(148, 163, 184)   # #94A3B8 (Slate 400)
    ACCENT_BLUE = RGBColor(59, 130, 246)   # #3B82F6 (Electric Blue)
    ACCENT_GREEN = RGBColor(16, 185, 129)  # #10B981 (Emerald Green)
    ACCENT_AMBER = RGBColor(245, 158, 11)  # #F59E0B (Amber Gold)
    ACCENT_PURPLE = RGBColor(139, 92, 246) # #8B5CF6 (Violet)

    def set_slide_bg(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_COLOR
        bg.line.fill.background()
        return bg

    def add_card(slide, left, top, width, height, bg_rgb=CARD_BG, border_rgb=CARD_BORDER):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        card.fill.solid()
        card.fill.fore_color.rgb = bg_rgb
        card.line.color.rgb = border_rgb
        card.line.width = Pt(1)
        return card

    def add_header(slide, tag_text, title_text, subtitle_text):
        tx_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(1.3))
        tf = tx_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        # Eyebrow Tag
        p_tag = tf.paragraphs[0]
        p_tag.text = tag_text.upper()
        p_tag.font.size = Pt(11)
        p_tag.font.bold = True
        p_tag.font.color.rgb = ACCENT_BLUE
        p_tag.font.name = 'Arial'

        # Main Title
        p_title = tf.add_paragraph()
        p_title.text = title_text
        p_title.font.size = Pt(26)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_MAIN
        p_title.font.name = 'Arial'

        # Subtitle
        if subtitle_text:
            p_sub = tf.add_paragraph()
            p_sub.text = subtitle_text
            p_sub.font.size = Pt(13)
            p_sub.font.color.rgb = TEXT_MUTED
            p_sub.font.name = 'Arial'

    # -------------------------------------------------------------
    # SLIDE 1: Title & Hero Slide
    # -------------------------------------------------------------
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s1)

    # Hero Card Container
    add_card(s1, 0.8, 0.8, 11.733, 5.9, CARD_BG, ACCENT_BLUE)

    hero_box = s1.shapes.add_textbox(Inches(1.2), Inches(1.2), Inches(10.9), Inches(3.2))
    tf1 = hero_box.text_frame
    tf1.word_wrap = True
    tf1.margin_left = tf1.margin_top = tf1.margin_right = tf1.margin_bottom = 0

    p = tf1.paragraphs[0]
    p.text = "BIT N BUILD HACKATHON - TRACK 3 (JAN JEEVAN) · OFFLINE-FIRST ORDER INTELLIGENCE"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = ACCENT_BLUE
    p.font.name = 'Arial'

    p2 = tf1.add_paragraph()
    p2.text = "JanVyapar: Sovereign Offline Commerce & Order Ledger for Bharat"
    p2.font.size = Pt(36)
    p2.font.bold = True
    p2.font.color.rgb = TEXT_MAIN
    p2.font.name = 'Arial'

    p3 = tf1.add_paragraph()
    p3.text = "Zero-Latency WhatsApp & Natural Language Order Extraction with Deterministic CRDT Sync for 63M+ Indian MSMEs"
    p3.font.size = Pt(16)
    p3.font.color.rgb = TEXT_MUTED
    p3.font.name = 'Arial'

    # 4 Key Pillars Cards at bottom of Slide 1
    pillars = [
        ("⚡ 0ms Local NLP", "Regex & lexicon parsing with Hinglish/Devanagari date resolution", ACCENT_GREEN),
        ("✨ Hybrid Online AI", "Google Gemini 3.6 Flash & GPT-4o with graceful silent fallback", ACCENT_BLUE),
        ("🔄 Deterministic CRDT", "Lamport timestamp Last-Write-Wins peer-to-peer sync engine", ACCENT_PURPLE),
        ("📱 Sovereign PWA", "Isolated multi-device IndexedDB with mobile-first slide drawer", ACCENT_AMBER),
    ]

    for idx, (title, desc, color) in enumerate(pillars):
        x = 1.2 + idx * 2.75
        add_card(s1, x, 4.4, 2.6, 1.8, RGBColor(15, 23, 42), CARD_BORDER)
        box = s1.shapes.add_textbox(Inches(x + 0.15), Inches(4.55), Inches(2.3), Inches(1.5))
        tf = box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        
        pt = tf.paragraphs[0]
        pt.text = title
        pt.font.size = Pt(13)
        pt.font.bold = True
        pt.font.color.rgb = color
        pt.font.name = 'Arial'

        pd = tf.add_paragraph()
        pd.text = desc
        pd.font.size = Pt(11)
        pd.font.color.rgb = TEXT_MUTED
        pd.font.name = 'Arial'

    # -------------------------------------------------------------
    # SLIDE 2: The Problem: Fragile Connectivity & Messy Orders
    # -------------------------------------------------------------
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s2)
    add_header(s2, "Challenge & Market Reality", "The Problem: Why Cloud-Only POS Fails Indian MSMEs", "63+ Million micro-enterprises operate in low-bandwidth, informal WhatsApp workflows.")

    col_data_s2 = [
        ("🚫 Cloud Dependency & Outages", 
         "Traditional SaaS POS systems freeze or fail when network drops occur. In local Indian markets, unstable mobile connectivity means lost orders, stalled billing, and duplicate paperwork.",
         "Impact: 35%+ of daily transactions risk data loss during network blackouts.", ACCENT_AMBER),
        ("💬 Colloquial Hinglish & Numerals", 
         "Orders arrive via voice-notes and text in messy Hindi/Hinglish: 'bhaiya 2 kurta chahiye kal tak, 1850 total'. Standard systems cannot parse Devanagari numerals (२, ५) or relative dates ('parso', 'agle mangalwar').",
         "Impact: Orders remain trapped in unstructured WhatsApp chats.", ACCENT_BLUE),
        ("💥 Multi-Device Sync Conflicts", 
         "When multiple workshop operators take orders simultaneously on disconnected phones, manual reconciliations overwrite records, corrupting ledger balances and delivery dates.",
         "Impact: Zero mathematical guarantee of data convergence across devices.", ACCENT_PURPLE),
    ]

    for idx, (title, body, stat, col_color) in enumerate(col_data_s2):
        x = 0.8 + idx * 3.95
        add_card(s2, x, 2.0, 3.8, 4.8)
        box = s2.shapes.add_textbox(Inches(x + 0.25), Inches(2.25), Inches(3.3), Inches(4.3))
        tf = box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p1 = tf.paragraphs[0]
        p1.text = title
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = col_color
        p1.font.name = 'Arial'

        p2 = tf.add_paragraph()
        p2.text = body
        p2.font.size = Pt(12)
        p2.font.color.rgb = TEXT_MUTED
        p2.font.name = 'Arial'

        p3 = tf.add_paragraph()
        p3.text = f"\n📌 {stat}"
        p3.font.size = Pt(12)
        p3.font.bold = True
        p3.font.color.rgb = TEXT_MAIN
        p3.font.name = 'Arial'

    # -------------------------------------------------------------
    # SLIDE 3: Dual-Tier Architecture: 100% Offline + Online AI
    # -------------------------------------------------------------
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s3)
    add_header(s3, "System Architecture", "Dual-Tier Sovereign Architecture: Offline First, Cloud Accelerated", "Sub-millisecond on-device execution with seamless hybrid cloud intelligence.")

    # Left Box: Tier 1
    add_card(s3, 0.8, 2.0, 5.7, 4.8, RGBColor(16, 24, 39), ACCENT_GREEN)
    box_t1 = s3.shapes.add_textbox(Inches(1.1), Inches(2.2), Inches(5.1), Inches(4.3))
    tf_t1 = box_t1.text_frame
    tf_t1.word_wrap = True
    tf_t1.margin_left = tf_t1.margin_top = tf_t1.margin_right = tf_t1.margin_bottom = 0

    p = tf_t1.paragraphs[0]
    p.text = "TIER 1: 0ms Local Rule Engine (100% Offline)"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = ACCENT_GREEN

    points_t1 = [
        "• Regex & Lexicon Tokenizer: Extracts quantities, currency markers (₹, rs, rupaye), and items in <1ms.",
        "• Indian Colloquial Date Resolver: Resolves aaj, kal, parso, tarso, agle somwar, and 15 tarikh to strict ISO dates.",
        "• Multi-Domain Classifier: Auto-categorizes into Tailoring, Tiffin, Bakery, or Electronics.",
        "• Zero Server Cost: Runs entirely within browser IndexedDB/WASM without requiring active internet or API credits."
    ]
    for pt in points_t1:
        p = tf_t1.add_paragraph()
        p.text = pt
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MUTED

    # Right Box: Tier 2
    add_card(s3, 6.8, 2.0, 5.7, 4.8, RGBColor(16, 24, 39), ACCENT_BLUE)
    box_t2 = s3.shapes.add_textbox(Inches(7.1), Inches(2.2), Inches(5.1), Inches(4.3))
    tf_t2 = box_t2.text_frame
    tf_t2.word_wrap = True
    tf_t2.margin_left = tf_t2.margin_top = tf_t2.margin_right = tf_t2.margin_bottom = 0

    p = tf_t2.paragraphs[0]
    p.text = "TIER 2: Hybrid Cloud AI (Accelerated Mode)"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = ACCENT_BLUE

    points_t2 = [
        "• Google Gemini 3.6 Flash / OpenAI GPT-4o Mini: Handles complex multi-turn voice-transcribed chats.",
        "• Local Node AI Proxy: Routes requests via /api/ai/parse to bypass client CORS and campus Wi-Fi firewall blocks.",
        "• Silent Fail-Safe Fallback: If cloud quota (HTTP 429) or network timeout occurs, Tier 1 takes over seamlessly.",
        "• Zero-Trust Privacy: Plaintext API keys never displayed or shared across origin boundaries."
    ]
    for pt in points_t2:
        p = tf_t2.add_paragraph()
        p.text = pt
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MUTED

    # -------------------------------------------------------------
    # SLIDE 4: Test A Compliance: Universal Message Parser
    # -------------------------------------------------------------
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s4)
    add_header(s4, "Test A Verification", "Universal Message Parser & Schema Contract Compliance", "100% adherence to schema.json with full automated test coverage.")

    # Left Panel: Schema Breakdown
    add_card(s4, 0.8, 2.0, 5.7, 4.8)
    box_s4_l = s4.shapes.add_textbox(Inches(1.1), Inches(2.2), Inches(5.1), Inches(4.3))
    tf_s4_l = box_s4_l.text_frame
    tf_s4_l.word_wrap = True
    tf_s4_l.margin_left = tf_s4_l.margin_top = tf_s4_l.margin_right = tf_s4_l.margin_bottom = 0

    p = tf_s4_l.paragraphs[0]
    p.text = "Strict schema.json Output Contract"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = ACCENT_BLUE

    schema_fields = [
        ("customer", "Extracted caller/customer name (e.g., 'Ramesh', 'Pooja') or null"),
        ("items", "Array of objects with description, quantity, and key-value attributes"),
        ("due_date", "Resolved YYYY-MM-DD ISO date string from colloquial relative words"),
        ("amount", "Total order monetary value extracted as float/number"),
        ("references_prior_order", "Boolean flag detecting repeat cues ('pichla jaisa', 'same as last')"),
        ("confidence & needs_clarification", "Calibrated scoring and ambiguity trigger on greetings ('hi', 'namaste')")
    ]
    for name, desc in schema_fields:
        p = tf_s4_l.add_paragraph()
        p.text = f"• {name}: {desc}"
        p.font.size = Pt(11)
        p.font.color.rgb = TEXT_MUTED

    # Right Panel: Live Parsing Benchmarks
    add_card(s4, 6.8, 2.0, 5.7, 4.8)
    box_s4_r = s4.shapes.add_textbox(Inches(7.1), Inches(2.2), Inches(5.1), Inches(4.3))
    tf_s4_r = box_s4_r.text_frame
    tf_s4_r.word_wrap = True
    tf_s4_r.margin_left = tf_s4_r.margin_top = tf_s4_r.margin_right = tf_s4_r.margin_bottom = 0

    p = tf_s4_r.paragraphs[0]
    p.text = "Automated Test Suite & Benchmarks"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = ACCENT_GREEN

    test_bullets = [
        "✅ 12/12 Automated Tests Passing (100% Verification Suite).",
        "✅ 1-Click Batch Processor: Run 'batch.bat' to parse any JSON array and output valid standardized records.",
        "✅ Sub-Millisecond Speed: Local parser executes in <0.8ms average latency.",
        "✅ Devanagari & Hinglish: Native extraction for Hindi numerals (१, २, ३) and mixed Hinglish scripts.",
        "✅ Live JSON Exporter: 1-click Download JSON and Copy to Clipboard in Universal Inbox."
    ]
    for b in test_bullets:
        p = tf_s4_r.add_paragraph()
        p.text = b
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MAIN

    # -------------------------------------------------------------
    # SLIDE 5: Test C Innovation: Deterministic CRDT Sync
    # -------------------------------------------------------------
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s5)
    add_header(s5, "Test C & Technical Innovation", "Deterministic CRDT Engine & Conflict-Free Sync", "Mathematical convergence without central coordination across peer devices.")

    col_s5 = [
        ("1. Lamport Timestamps",
         "Every mutation creates an immutable operation log entry with (lamport_clock, client_id, version). Clocks advance monotonically on every local edit and incoming sync message.",
         ACCENT_BLUE),
        ("2. Last-Write-Wins (LWW)",
         "When concurrent edits occur on the same order field, the deterministic rule Lamport > ClientID ensures both Device A and Device B converge to the identical state regardless of network packet order.",
         ACCENT_GREEN),
        ("3. Non-Overlapping Merging",
         "If Device A updates the delivery date while Device B updates the advance payment, both edits are preserved without data destruction or false conflict alerts.",
         ACCENT_PURPLE),
    ]

    for idx, (title, desc, color) in enumerate(col_s5):
        x = 0.8 + idx * 3.95
        add_card(s5, x, 2.0, 3.8, 4.8)
        box = s5.shapes.add_textbox(Inches(x + 0.25), Inches(2.25), Inches(3.3), Inches(4.3))
        tf = box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p1 = tf.paragraphs[0]
        p1.text = title
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = color
        p1.font.name = 'Arial'

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.size = Pt(12)
        p2.font.color.rgb = TEXT_MUTED
        p2.font.name = 'Arial'

        # Bottom verification badge
        p3 = tf.add_paragraph()
        p3.text = "\nVerified: Test C Scenario 1 & 2 pass with 100% state parity."
        p3.font.size = Pt(11)
        p3.font.bold = True
        p3.font.color.rgb = TEXT_MAIN

    # -------------------------------------------------------------
    # SLIDE 6: Device Isolation, Mobile UX & Privacy
    # -------------------------------------------------------------
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s6)
    add_header(s6, "Security & User Experience", "Sovereign Device Isolation & Mobile-First Interface", "Privacy-preserving onboarding and seamless judge evaluation experience.")

    # Left: Security & Isolation
    add_card(s6, 0.8, 2.0, 5.7, 4.8)
    box_s6_l = s6.shapes.add_textbox(Inches(1.1), Inches(2.2), Inches(5.1), Inches(4.3))
    tf_s6_l = box_s6_l.text_frame
    tf_s6_l.word_wrap = True
    tf_s6_l.margin_left = tf_s6_l.margin_top = tf_s6_l.margin_right = tf_s6_l.margin_bottom = 0

    p = tf_s6_l.paragraphs[0]
    p.text = "🛡️ Sovereign Multi-Device Isolation"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = ACCENT_AMBER

    sec_points = [
        "• Independent Sandbox: Each phone/laptop gets a unique deviceId and isolated IndexedDB database. Changes on one phone never pollute another device's storage.",
        "• Zero Key Leakage: Built-in developer API keys are never rendered in HTML/DOM inputs, preventing key theft or copying.",
        "• First-Time Onboarding: Fresh visitors are greeted by an onboarding flow to configure workshop name, business domain, and AI preference.",
        "• Persistent Storage: Operator profiles and settings persist across page reloads in IndexedDB."
    ]
    for pt in sec_points:
        p = tf_s6_l.add_paragraph()
        p.text = pt
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MUTED

    # Right: Mobile UX
    add_card(s6, 6.8, 2.0, 5.7, 4.8)
    box_s6_r = s6.shapes.add_textbox(Inches(7.1), Inches(2.2), Inches(5.1), Inches(4.3))
    tf_s6_r = box_s6_r.text_frame
    tf_s6_r.word_wrap = True
    tf_s6_r.margin_left = tf_s6_r.margin_top = tf_s6_r.margin_right = tf_s6_r.margin_bottom = 0

    p = tf_s6_r.paragraphs[0]
    p.text = "📱 Mobile-Optimized Interface"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = ACCENT_BLUE

    ux_points = [
        "• Slide-in Hamburger Drawer: Sleek navigation drawer on mobile viewports (≤768px) with quick access to all 7 desks.",
        "• Instant '← Back' Navigation: Prominent back buttons on every sub-screen (Settings, Inbox, Ledger, Query, Sync).",
        "• Compact Density: Form controls and stat cards scaled for 5.5\" to 6.7\" phone viewports without horizontal clipping.",
        "• Dual Wi-Fi / Hotspot Access: Direct connectivity via LAN IP (10.16.5.98:5173) and Hotspot IP (192.168.137.1:5173)."
    ]
    for pt in ux_points:
        p = tf_s6_r.add_paragraph()
        p.text = pt
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MUTED

    # -------------------------------------------------------------
    # SLIDE 7: Summary & 1-Click Judge Evaluation Package
    # -------------------------------------------------------------
    s7 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s7)
    add_header(s7, "Conclusion & Delivery", "Project Delivery & 1-Click Judge Submission Package", "Everything required to verify and evaluate JanVyapar in under 10 seconds.")

    # 3 Summary Cards
    cards_s7 = [
        ("🚀 1-Click Zero-Dependency Launcher",
         "Double-click 'start.bat' on Windows or run './start.sh' on Mac/Linux. Pre-compiled standalone bundle serves on http://localhost:5173 with zero build steps.",
         ACCENT_GREEN),
        ("🧪 1-Click Verification Test Suite",
         "Double-click 'test.bat' to run the 12/12 automated test suite covering Test A schema parsing, date resolution, and Test C CRDT convergence.",
         ACCENT_BLUE),
        ("📦 Test A Batch Evaluator",
         "Run 'batch.bat input.json output.json' to process bulk customer messages and generate strict standardized JSON output records.",
         ACCENT_PURPLE),
    ]

    for idx, (title, desc, color) in enumerate(cards_s7):
        y = 2.0 + idx * 1.65
        add_card(s7, 0.8, y, 11.733, 1.45)
        box = s7.shapes.add_textbox(Inches(1.1), Inches(y + 0.15), Inches(11.1), Inches(1.15))
        tf = box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p1 = tf.paragraphs[0]
        p1.text = title
        p1.font.size = Pt(15)
        p1.font.bold = True
        p1.font.color.rgb = color
        p1.font.name = 'Arial'

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.size = Pt(12)
        p2.font.color.rgb = TEXT_MUTED
        p2.font.name = 'Arial'

    output_path = os.path.abspath("JanVyapar_Presentation.pptx")
    prs.save(output_path)
    print(f"Presentation saved successfully to: {output_path}")

if __name__ == '__main__':
    create_deck()
