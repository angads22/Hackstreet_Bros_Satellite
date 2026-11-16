# Crops the fresh 2.1 screenshots (1440x900 CSS px at 2x) to the panel each slide is about. Usage: crops.py <shots dir> <deck/img dir>
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
C = {  # name: (shot, css box x0,y0,x1,y1)
  'home':     ('home',     (0, 0, 1440, 845)),
  'satellite':('home',     (770, 170, 1400, 560)),
  'map':      ('map',      (93, 281, 1032, 844)),
  'build':    ('build',    (93, 282, 1347, 842)),
  'review':   ('review',   (758, 282, 1347, 758)),
  'mission':  ('mission-wildfire', (93, 275, 880, 592)),
  'debrief':  ('debrief-wildfire', (93, 194, 1347, 700)),
  'workshop': ('workshop', (93, 140, 1347, 700)),
  'quick':    ('quick',    (85, 70, 640, 372)),
}
for name, (shot, b) in C.items():
    im = Image.open('%s/%s.png' % (src, shot)).convert('RGB').crop(tuple(v * 2 for v in b))
    if im.width > 2000: im = im.resize((2000, round(im.height * 2000 / im.width)), Image.LANCZOS)
    im.save('%s/%s.png' % (out, name), optimize=True)
    print(name, im.size)
