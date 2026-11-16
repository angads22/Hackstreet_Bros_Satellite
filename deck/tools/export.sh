#!/bin/sh
# Exports the deck to PDF and to PNGs for a look. Usage: export.sh <deck dir> <scratch dir>
D=$1; O=$2; mkdir -p $O/pdf $O/after
soffice -env:UserInstallation=file://$O/lo --headless --convert-to pdf --outdir $O/pdf $D/GRAVITRON.pptx >/dev/null 2>&1
cp $O/pdf/GRAVITRON.pdf $D/GRAVITRON-static.pdf
rm -f $O/after/*.png; pdftoppm -r 80 -png $O/pdf/GRAVITRON.pdf $O/after/s
