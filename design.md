# DESIGN.md

## 🧭 Design Principles

* Modern, clean and visually appealing
* Mobile-first and responsive
* Focus on clarity and ease of booking
* High contrast for accessibility
* Soft, friendly UI with subtle depth

---

## 🎨 Color System

### Brand Colors

* Primary: Blue (trust, reliability)
* Secondary: Pink (emotion, highlights, CTAs)

### Palette

```yaml
colors:
  primary:
    50:  #EFF6FF
    100: #DBEAFE
    200: #BFDBFE
    300: #93C5FD
    400: #60A5FA
    500: #3B82F6
    600: #2563EB
    700: #1D4ED8
    800: #1E40AF
    900: #1E3A8A

  secondary:
    50:  #FDF2F8
    100: #FCE7F3
    200: #FBCFE8
    300: #F9A8D4
    400: #F472B6
    500: #EC4899
    600: #DB2777
    700: #BE185D
    800: #9D174D
    900: #831843

  neutral:
    50:  #F9FAFB
    100: #F3F4F6
    200: #E5E7EB
    300: #D1D5DB
    400: #9CA3AF
    500: #6B7280
    600: #4B5563
    700: #374151
    800: #1F2933
    900: #111827

  success: #22C55E
  warning: #F59E0B
  error:   #EF4444
```

### Usage Guidelines

* Primary → main actions, buttons, links
* Secondary → highlights, promotions, prices
* Neutral → backgrounds, text, borders

---

## ✍️ Typography

### Font Family

* Primary: Inter, sans-serif

### Scale (based on 16px root)

```yaml
typography:
  xs: 12px
  sm: 14px
  base: 16px
  lg: 18px
  xl: 20px
  2xl: 24px
  3xl: 30px
  4xl: 36px
```

### Usage

* Headings → semi-bold or bold
* Body → regular
* Line height → 1.4–1.6

---

## 📐 Spacing System

Based on 8px grid

```yaml
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 20px
  6: 24px
  8: 32px
  10: 40px
  12: 48px
  16: 64px
```

### Rules

* Always use spacing scale (no arbitrary values)
* Prefer breathing space in layouts (travel apps benefit from this)

---

## 🔲 Border Radius

```yaml
radius:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
```

### Usage

* Buttons → md
* Cards → lg
* Modals → xl

---

## 🌫️ Shadows

```yaml
shadows:
  sm: 0 1px 2px rgba(0,0,0,0.05)
  md: 0 4px 8px rgba(0,0,0,0.08)
  lg: 0 10px 20px rgba(0,0,0,0.12)
```

---

## 📱 Breakpoints (Responsive)

```yaml
breakpoints:
  sm: 640px
  md: 768px
  lg: 1024px
  xl: 1280px
```

---

## 🧩 Components Guidelines

### Buttons

* Primary: blue background, white text
* Secondary: pink background
* Rounded: md
* Hover: slightly darker shade

### Cards (Hotel Listings)

* White background
* Rounded lg
* Shadow md
* Padding 16–24px

### Date Picker

* Clean minimal UI
* Highlight selected dates with primary color
* Range selection with soft background

### Carousel (Images)

* Smooth scroll
* Snap behavior
* Dots indicator using primary color

### Modal (Room Details)

* Centered
* Rounded xl
* Shadow lg
* Overlay: rgba(0,0,0,0.5)

---

## ✨ Interaction & Motion

* Transition: 150ms–250ms ease
* Hover: subtle scale (1.02)
* Focus: visible outline (accessibility)

---

## 🧠 Design Tone (Important for AI)

* Clean and modern like Airbnb
* Friendly but premium
* Spacious layout with strong imagery
* Focus on conversion (booking)

---
