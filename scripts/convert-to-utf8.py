"""Reproduce the byte-preserving Latin-1 -> UTF-8 dictionary conversion.

Only SET changes in aff; the dictionary entries and rules remain identical.
Original and derived dictionary data: GPL-2.0 OR GPL-3.0.
"""
from pathlib import Path
root = Path(__file__).resolve().parent
for ext in ('aff', 'dic'):
    source = (root / f'de_DE_frami.{ext}').read_bytes().decode('latin1')
    if ext == 'aff':
        source = source.replace('SET ISO8859-1', 'SET UTF-8')
    (root / f'de_DE_frami.utf8.{ext}').write_bytes(source.encode('utf-8'))
