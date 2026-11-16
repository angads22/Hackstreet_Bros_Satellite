# Rebuilds the seven slides of deck/GRAVITRON.pptx in place for version 2.1 (same master, layout, colours and fonts).
# Usage: python3 build_deck.py <deck dir>      (needs python-pptx; pictures come from <deck dir>/img)
import sys, os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR
from PIL import Image

DECK = sys.argv[1]
IMG = os.path.join(DECK, 'img')
INK, MUTED, ORANGE, TEAL, PANEL, LINE = 'F1EEE6', 'A9B2BD', 'F0803C', '5CBAB4', '1B222B', '3A4654'
BODY = 24      # body text
SMALL = 16     # captions and credits
L, R = 0.6, 12.73   # left and right margins, inches

prs = Presentation(os.path.join(DECK, 'GRAVITRON.pptx'))

def clear(slide):
    for sh in list(slide.shapes):
        if sh.is_placeholder: continue          # the slide number stays
        if sh.shape_type == 13:
            rid = sh._element.blipFill.blip.rEmbed
            sh._element.getparent().remove(sh._element)
            slide.part.drop_rel(rid)            # so the old picture or GIF leaves the file
        else:
            sh._element.getparent().remove(sh._element)

def text(slide, name, x, y, w, h, paras, size=BODY, color=INK, font='Calibri', anchor='t', spc=None, after=6):
    """paras: a string, a list of runs [(text, bold)], or a list of such lists (one per paragraph)."""
    if isinstance(paras, str): paras = [[(paras, False)]]
    elif paras and isinstance(paras[0], tuple): paras = [paras]
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h)); box.name = name
    tf = box.text_frame; tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = {'t': MSO_ANCHOR.TOP, 'ctr': MSO_ANCHOR.MIDDLE, 'b': MSO_ANCHOR.BOTTOM}[anchor]
    for i, runs in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(after)
        for t, bold in runs:
            r = p.add_run(); r.text = t
            f = r.font; f.size = Pt(size); f.bold = bool(bold); f.name = font
            f.color.rgb = RGBColor.from_string(bold if isinstance(bold, str) else color)
            if isinstance(bold, str): f.bold = True
            if spc: r._r.get_or_add_rPr().set('spc', str(spc))
    return box

def title(slide, t):  text(slide, 'Title', L, 0.35, R - L, 0.85, [(t, True)], size=34, font='Arial', anchor='ctr')
def label(slide, t, x, y, w=6.0, color=ORANGE): text(slide, 'Label ' + t, x, y, w, 0.3, [(t, True)], size=14, color=color, font='Courier New', anchor='ctr', spc=200)
def tag(slide, t):    # the judging criterion this slide answers, bottom left, level with the slide number
    text(slide, 'Criterion', L, 7.05, 8.0, 0.3, [('CRITERION  ', False), (t, ORANGE)], size=12, color=MUTED, font='Courier New', anchor='ctr', spc=200)

def picture(slide, name, file, x, y, w=None, h=None):
    """A flat framed picture; never stretched. Returns (width, height) in inches."""
    iw, ih = Image.open(os.path.join(IMG, file)).size
    if w is None: w = h * iw / ih
    h = w * ih / iw
    m = 0.04
    fr = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x - m), Inches(y - m), Inches(w + 2 * m), Inches(h + 2 * m)); fr.name = name + ' frame'
    fr.fill.solid(); fr.fill.fore_color.rgb = RGBColor.from_string(PANEL)
    fr.line.color.rgb = RGBColor.from_string(LINE); fr.line.width = Emu(12700)
    st = fr._element.find('{http://schemas.openxmlformats.org/presentationml/2006/main}style')
    if st is not None: fr._element.remove(st)   # no theme effects: flat, no shadow
    pic = slide.shapes.add_picture(os.path.join(IMG, file), Inches(x), Inches(y), Inches(w), Inches(h)); pic.name = name
    return w, h

def notes(slide, t):
    slide.notes_slide.notes_text_frame.text = t

S = list(prs.slides)
for s in S: clear(s)

# ---- 1 Cover
s = S[0]
w, h = picture(s, 'Home page', 'home.png', 0.6, 1.0, w=8.6)
label(s, 'NASA SPACE APPS 2026', 9.6, 1.1, 3.2, TEAL)
text(s, 'Subtitle', 9.6, 1.55, 3.13, 1.5, [('The Gravitronical Odyssey', ORANGE)], size=30, font='Arial')
text(s, 'Pitch', 9.6, 3.25, 3.13, 1.3, 'Design a satellite. Launch it. Learn why.')
text(s, 'Challenge', 9.6, 4.7, 3.13, 1.1, [('Challenge: ', True), ('Space Mission Design Game', False)], size=20)
text(s, 'Team', 9.6, 5.65, 3.13, 0.4, [('Team: ', True), ('Hackstreet Bros', False)], size=20)
text(s, 'Footnote', 0.6, 1.0 + h + 0.2, 8.6, 0.4, 'A browser game in plain HTML, CSS and JavaScript. No install. Plays offline.', size=SMALL, color=MUTED)
notes(s, "1 Cover. One breath: you design a satellite, launch it and learn why it worked or failed. "
  "Shows what the rules ask of a deck: the challenge (Space Mission Design Game, SPEC.md line 7), the team, an image of the project. "
  "The picture is the real home page of version 2.1 with its three mode cards: Part 1 (Austin's first satellite, 1958), Part 2 (Ajay's comeback) and Quick mode. "
  "The Quick card reads ONLINE OFF because the game was opened from a file; that is correct and we say so on slide 7. "
  "TO DO BY A PERSON: check the team name against the team page; the member names are on slide 7.")

# ---- 2 Why (Impact)
s = S[1]
title(s, 'Anyone with a browser can design a mission')
y = 1.55
for lab, body in [('THE PROBLEM', 'Every part fixes one problem and creates the next. Few people ever get to try.'),
                  ('THE SOLUTION', 'A game: build a satellite, fly it, read why it worked or failed.'),
                  ('WHY IT MATTERS', 'It runs in any browser, offline, on real NASA and Canadian data.')]:
    label(s, lab, L, y); text(s, 'Body ' + lab, L, y + 0.4, 6.5, 1.2, body); y += 1.8
w, h = picture(s, 'Satellite', 'satellite.png', 7.6, 1.95, w=5.13)
text(s, 'Satellite caption', 7.6, 1.95 + h + 0.15, 5.13, 0.4, 'From the home page of the game.', size=SMALL, color=MUTED)
tag(s, 'IMPACT')
notes(s, "2 Why. Criterion: IMPACT (a real problem, a large audience, inspiring). Pitch shape from the event: the problem, the solution, why it is important. "
  "Problem: spacecraft design is a chain of trade-offs, each part fixes one problem and creates the next (SPEC.md, Build section). "
  "Solution: the game loop (slide 3). Why it matters: it teaches mission design to anyone with a browser (SPEC.md line 28, Impact row); it needs no install and plays offline from a data snapshot. "
  "The Canadian data is the Canadian Space Agency's Alouette-1 soundings (SOURCES.md). The picture is the low-poly satellite on the home page.")

# ---- 3 The loop (Presentation)
s = S[2]
title(s, 'One loop: design, fly, read why')
w, h = picture(s, 'Base map', 'map.png', L, 1.55, w=6.9)
text(s, 'Map caption', L, 1.55 + h + 0.15, 6.9, 0.4, 'The base map. A gold route points to the next stop.', size=SMALL, color=MUTED)
stops = [('Mission Control', 'the job'), ('Tracking Station', 'the orbit'), ('Workshop', 'build'), ('Rocket Yard', 'the rocket'),
         ('Launch Pad', 'the review'), ('Mission', 'fly it'), ('Debrief', 'read why')]
for i, (a, b) in enumerate(stops):
    yy = 1.5 + i * 0.7
    text(s, 'Stop number %d' % (i + 1), 7.95, yy, 0.5, 0.55, [(str(i + 1), ORANGE)], size=26, font='Arial', anchor='ctr')
    text(s, 'Stop %d' % (i + 1), 8.55, yy, 4.18, 0.55, [(a, True), (', ' + b, False)], anchor='ctr')
tag(s, 'PRESENTATION')
notes(s, "3 The loop. Criterion: PRESENTATION (the user experience, told as one clear story). Run through the seven stops out loud in under a minute. "
  "The picture is the base map in Part 2 on version 2.1: places 1 and 2 done, the gold route to the Workshop. Place names and the route: SPEC.md, base map. "
  "In Part 1 the job, the orbit and the rocket are set for you at first, so the player starts at the Workshop; in Part 2 the player picks all of it. "
  "From the second flight of Part 2 the walk is instant (CHANGELOG.md 2.0). Demo script: build, fail, read the debrief, fix, succeed.")

# ---- 4 Build (Validity)
s = S[3]
title(s, 'Every part costs mass, power and money')
w, h = picture(s, 'Build', 'build.png', L, 1.55, w=7.9)
text(s, 'Build caption', L, 1.55 + h + 0.15, 7.9, 0.4, 'Build: the satellite, three gauges, the live bars. Money is a game value.', size=SMALL, color=MUTED)
w2, h2 = picture(s, 'Review', 'review.png', 8.85, 1.55, w=3.88)
text(s, 'Review caption', 8.85, 1.55 + h2 + 0.15, 3.88, 0.4, 'The review says GO or NO GO.', size=SMALL, color=MUTED)
text(s, 'Facts', L, 1.55 + h + 0.75, R - L, 1.0, [[('41 parts, 7 rockets, 3 orbits.', True)], [('Eight real formulas, each with a hand-worked test.', False)]], after=2)
tag(s, 'VALIDITY')
notes(s, "4 Build. Criterion: VALIDITY (scientifically sound, feasible, usable). Counts recounted from data/ on the 2.1 build with tests/load.js: 41 parts in 7 bins, 7 rockets, 3 orbits, 6 topics, 27 events, 14 real missions. "
  "Eight real formulas with hand-worked tests: SPEC.md line 30; node tests/formulas.js passes (16 checks). "
  "The picture is Part 2 on Normal, a solar contract: the satellite drawn from the parts on board, the three gauges DATA, COST and TIME (new in 2.1), PROFIT, and the bars for mass, power, budget and data home. "
  "On Normal and Hard some part facts show '?' until you pay the engineers (2.0). The review picture is the same design: READY, ALL SYSTEMS GO. "
  "Do not say: any dollar figure as fact. Money, payouts and odds are game values; part masses and powers are sourced in SOURCES.md, and five lead-time source rows still need a human check.")

# ---- 5 Fly and data (Relevance)
s = S[4]
title(s, 'NASA and Canadian data drive the flight')
pw = (R - L - 0.25) / 2
w, h = picture(s, 'Mission', 'mission.png', L, 1.55, w=pw)
w2, h2 = picture(s, 'Debrief', 'debrief.png', L + pw + 0.25, 1.55, w=pw)
cy = 1.55 + max(h, h2) + 0.13
text(s, 'Mission caption', L, cy, pw, 0.3, 'March: 288,836 fire detections (NASA FIRMS 2025).', size=SMALL, color=MUTED)
text(s, 'Debrief caption', L + pw + 0.25, cy, pw, 0.3, 'The debrief: the verdict, then what limited the flight.', size=SMALL, color=MUTED)
by = cy + 0.55
text(s, 'Data sets', L, by, pw, 1.9, [[('Wildfire: ', True), ('NASA FIRMS', False)], [('Sea ice: ', True), ('NSIDC Sea Ice Index', False)],
                                      [('Sun: ', True), ('SILSO sunspots', False)], [('Ionosphere: ', True), ('CSA Alouette', False)]], after=2)
text(s, 'Orbit fact', L + pw + 0.25, by, pw, 1.3, [('A low orbit ', True), ('sees 92% of the 3,693,555 fire detections. A polar orbit sees all.', False)])
text(s, 'Credits', L + pw + 0.25, by + 1.35, pw, 0.5, 'Sources and credits: SOURCES.md. Money shown is a game value.', size=SMALL, color=MUTED)
tag(s, 'RELEVANCE')
notes(s, "5 Fly it. Criterion: RELEVANCE (NASA data is a core part, not an add-on). Each topic's science per month comes from a real data set in data/earth.js (SOURCES.md rows read 'Downloaded and processed'): "
  "wildfire from NASA FIRMS MODIS active-fire detections, all countries, 2025 (3,693,555 detections); sea ice from the NSIDC Sea Ice Index version 4 (NSIDC is a NASA DAAC, with NOAA); "
  "the Sun from the SILSO monthly sunspot number (Royal Observatory of Belgium, CC BY-NC 4.0); the ionosphere from the Canadian Space Agency's Alouette-1 soundings (699,369). "
  "Orbit coverage: data/earth.js wildfire.orbit_view is 0.921 low orbit, 1.0 polar, 0.687 one geostationary slot. "
  "Say 'fire detections', never 'fires': a MODIS detection is a hot pixel. The game plays from this snapshot offline; live feeds (NOAA SWPC, NASA EONET, CWFIS) refresh it only when online, so do not say 'live NASA data'. "
  "The pictures are a Part 2 wildfire contract on Normal. Left, month 3 of the flight: the line under the science bar reads 'March: 288,836 fire detections worldwide (NASA FIRMS 2025)', which is detections x monthly_share for March in data/earth.js. "
  "Right, the debrief of the same flight, which leads with the verdict and the money (new in 2.1): PAID IN PART, then ATTITUDE CONTROL LIMITED THIS MISSION and TRY THIS. An event stops the clock during a flight and shows what each choice costs. "
  "Every dollar figure and score in the pictures is a game value.")

# ---- 6 Story and modes (Creativity)
s = S[5]
title(s, 'Three ways to play, one story')
y = 1.55
for lab, body, hh in [('PART 1 · 1958', [('Austin Albert, NASA engineer, ', True), ('builds the first satellite in three guided steps.', False)], 1.95),
                      ('PART 2 · TODAY', [('His grandson Ajay ', True), ('flies satellites for paying customers to clear a debt.', False)], 1.95),
                      ('QUICK MODE', [('One flight, ', True), ('a new job each time.', False)], 1.0)]:
    label(s, lab, L, y); text(s, 'Body ' + lab, L, y + 0.4, 5.6, hh - 0.5, body); y += hh
w, h = picture(s, 'Workshop', 'workshop.png', 6.6, 1.55, w=R - 6.6)
text(s, 'Workshop caption', 6.6, 1.55 + h + 0.15, R - 6.6, 0.4, "Part 2's workshop. Money shown is a game value.", size=SMALL, color=MUTED)
text(s, 'Economy', 6.6, 1.55 + h + 0.8, R - 6.6, 1.9, [[('Loans, a credit score ', True), ('from 300 to 850, and rockets that can fail.', False)],
                                                          [('Easy, Normal, Hard: ', True), ('the harder, the less help.', False)]])
tag(s, 'CREATIVITY')
notes(s, "6 Story and modes. Criterion: CREATIVITY (original, improves on existing ideas). Three modes on the home page (CHANGELOG.md, Unreleased, Quick mode). "
  "Part 1, 1958: Austin Albert's first satellite, three guided steps that teach the loop. Part 2, today: his grandson Ajay owes the lenders and flies satellites for paying customers to clear the debt. "
  "Quick mode: one flight from a seeded job, a new one each time, works offline, never touches your saves. Each part has seven endings (the home page shows ENDINGS 0 / 7). "
  "The picture is the Part 2 workshop on Normal (2.1): the ledger strip CASH, DEBT, MONTHS LEFT with the interest a month, CREDIT 720 GOOD, and three contracts sorted by pay. "
  "Credit is a score from 300 to 850 worked out from payments, debt, history, new loans and mix; the band sets the interest and the loan limit (CHANGELOG.md, Unreleased; node tests/credit.js, 56 checks). "
  "A rocket can fail at launch, seeded so the same run ends the same way (CHANGELOG.md 2.0). Easy, Normal and Hard change the cash, the debt, the deadline and how much help you get; "
  "on Normal and Hard you pay engineers for part information. Do not say: any cash, debt, interest or payout figure as fact; they are game values.")

# ---- 7 Proof and honesty (Validity, Presentation)
s = S[6]
title(s, 'Tested, sourced and honest about limits')
text(s, 'Proof', L, 1.55, 7.3, 5.3, [
    [('Tested: ', True), ('over 900 automated checks pass.', False)],
    [('Offline: ', True), ('no install. It plays from a data snapshot.', False)],
    [('Online: ', True), ('leaderboard and 1v1 duel are built, not hosted yet. Scores are self-reported.', False)],
    [('Open: ', True), ('five lead-time sources still need a human check.', False)],
    [('SI: ', True), ('built with SI tools, recorded in SI_USE.md.', False)],
    [('Sources: ', True), ('SOURCES.md. ', False), ('Team: ', True), ('Yareem, data and rules. angads22, screens.', False)]], after=13)
w, h = picture(s, 'Quick menu', 'quick.png', 8.3, 1.55, w=R - 8.3)
text(s, 'Quick caption', 8.3, 1.55 + h + 0.15, R - 8.3, 0.7, 'Opened from a file, online is off and the game says why.', size=SMALL, color=MUTED)
tag(s, 'VALIDITY · PRESENTATION')
notes(s, "7 Proof. Criteria: VALIDITY and PRESENTATION (the whole project is judged, so say what is not done). "
  "Tested: on the 2.1 build, node tests/<name>.js, all passing: formulas 16, api 143, campaign 61, comeback 151, debrief 35, migration 177, saves 35, clarity 30, info 45, online 126, world 19, credit 56, verdict 16, uib 49, speed 6, version 8 (973 checks in 16 files). "
  "Not rerun for this deck: tests/balance.js, tests/simulate.js, the browser scripts; CHANGELOG.md 2.0 says balance was not re-measured with loans, launch failures and fees together, so do not quote a balance figure. "
  "Online: the leaderboard and the 1v1 duel are written and tested (server/, node tests/online.js) but no server is hosted, so the buttons read ONLINE OFF; scores are self-reported (CHANGELOG.md 2.0). Never present them as live. "
  "Open: five rows of SOURCES.md (lines 37 to 41, the part lead times and the supply chain) are marked NEEDS HUMAN CHECK. Structure: plain HTML, CSS and JavaScript, 15 data files with one global each, js/game.js never touches the page, fetch only in js/live-data.js; it plays offline from the snapshot in data/earth.js. "
  "SI: the use of SI is recorded in SI_USE.md and goes in the form field 'Use of Super Intelligence (SI)'. References: SOURCES.md (NASA data: FIRMS, NSIDC; partner and other data: SILSO, CSA Alouette). "
  "TO DO BY A PERSON: add the other members' names (story, game experience) to the Team line, or roles only if anyone is under 18 (event rule: no name, face or voice of a minor).")

prs.save(os.path.join(DECK, 'GRAVITRON.pptx'))
print('saved', len(prs.slides), 'slides')
