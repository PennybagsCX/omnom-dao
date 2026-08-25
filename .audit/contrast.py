"""Compute WCAG 2.1 contrast ratios for every text token against every surface layer."""
def lin(c):
    c = c/255
    return c/12.92 if c <= 0.03928 else ((c+0.055)/1.055)**2.4

def L(hexstr):
    hexstr = hexstr.lstrip('#')
    r,g,b = int(hexstr[0:2],16), int(hexstr[2:4],16), int(hexstr[4:6],16)
    return 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b)

def ratio(fg, bg):
    L1, L2 = L(fg), L(bg)
    hi, lo = max(L1,L2), min(L1,L2)
    return (hi+0.05)/(lo+0.05)

surfaces = {
    "bg-deep #000000": "000000",
    "bg-surface #0a0a0a": "0a0a0a",
    "bg-elevated #141414": "141414",
}
text_tokens = {
    "text-primary #fafafa": "fafafa",
    "text-muted #a1a1aa": "a1a1aa",
    "text-dim #8b8b96": "8b8b96",
    "gold #ffd700 (primary)": "ffd700",
    "purple #8b5cf6 (secondary)": "8b5cf6",
    "success #10b981": "10b981",
    "danger #ef4444": "ef4444",
    "warning #f59e0b": "f59e0b",
}
# Also test colored backgrounds (e.g., gold button with black text, status badges)
badge_bgs = {
    "success #10b981 bg (white text)": ("10b981", "ffffff"),
    "danger #ef4444 bg (white text)": ("ef4444", "ffffff"),
    "warning #f59e0b bg (black text)": ("f59e0b", "000000"),
    "gold #ffd700 bg (black text)": ("ffd700", "000000"),
    "purple #8b5cf6 bg (white text)": ("8b5cf6", "ffffff"),
}

def verdict(r, large=False):
    # WCAG AA: 4.5:1 normal text, 3.0:1 large text (>=18pt or >=14pt bold)
    threshold = 3.0 if large else 4.5
    return "PASS" if r >= threshold else "FAIL"

print("="*88)
print("WCAG 2.1 CONTRAST — text tokens on surface layers (NORMAL text, AA threshold 4.5:1)")
print("="*88)
print(f"{'TEXT TOKEN':<32} {'SURFACE':<22} {'RATIO':>7}  {'AA':<6} {'AAA':<6}")
print("-"*88)
for tk, t_hex in text_tokens.items():
    for surf, s_hex in surfaces.items():
        r = ratio(t_hex, s_hex)
        aaa = "PASS" if r >= 7.0 else "FAIL"
        print(f"{tk:<32} {surf:<22} {r:>6.2f}:1  {verdict(r):<6} {aaa:<6}")

print()
print("="*88)
print("COLORED BACKGROUND USAGES (button text, badges, status pills)")
print("="*88)
print(f"{'COMBO':<46} {'RATIO':>7}  {'AA':<6}")
print("-"*88)
for label, (bg, fg) in badge_bgs.items():
    r = ratio(fg, bg)
    print(f"{label:<46} {r:>6.2f}:1  {verdict(r):<6}")
