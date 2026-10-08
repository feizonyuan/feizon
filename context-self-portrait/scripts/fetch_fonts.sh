#!/usr/bin/env bash
# Download the open-licensed (SIL OFL) fonts the film uses into fonts/ (not committed: ~50 MB).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p fonts && cd fonts
tmp=$(mktemp -d)
if [ ! -f SourceHanSansSC-ExtraLight.otf ]; then
  curl -sSL -o "$tmp/shs.zip" https://github.com/adobe-fonts/source-han-sans/releases/download/2.005R/09_SourceHanSansSC.zip
  unzip -q -j -o "$tmp/shs.zip" 'OTF/SimplifiedChinese/SourceHanSansSC-ExtraLight.otf' \
    'OTF/SimplifiedChinese/SourceHanSansSC-Light.otf' 'OTF/SimplifiedChinese/SourceHanSansSC-Normal.otf' -d .
fi
if [ ! -f JetBrainsMono-Light.ttf ]; then
  curl -sSL -o "$tmp/jbm.zip" https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip
  unzip -q -j -o "$tmp/jbm.zip" 'fonts/ttf/JetBrainsMono-Light.ttf' 'fonts/ttf/JetBrainsMono-ExtraLight.ttf' -d .
fi
if [ ! -f InterDisplay-Thin.otf ]; then
  curl -sSL -o "$tmp/inter.zip" https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
  unzip -q -j -o "$tmp/inter.zip" 'extras/otf/InterDisplay-Thin.otf' 'extras/otf/InterDisplay-Light.otf' -d .
fi
rm -rf "$tmp"
ls -1
