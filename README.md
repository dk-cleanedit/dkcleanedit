# DKcleanedit — CO3202 Entrepreneurial Project 2025/26

**Author:** da324  
**University of Leicester — School of Computing and Mathematical Sciences**

---

## Project Description

DKcleanedit is a full-stack web application for a professional sneaker cleaning and restoration business operating across two locations — Charles Street, Leicester and Canada Water, London.

Customers can book cleaning services, track their order through every stage in real time, upload shoe photos, and earn loyalty points. Admins can manage bookings, set slot availability, assign staff, view analytics, and send automated emails.

---

## Software Artefacts

All source files are in the root of this repository.

| File | Description |
|------|-------------|
| `app.js` | Main application logic — auth, booking, tracking, admin, analytics |
| `firebase.js` | Firebase configuration and initialisation |
| `home.html` | Homepage with carousel, service cards, and loyalty tier info |
| `booking.html` | Customer booking page — service, add-ons, calendar, time slots |
| `track.html` | Real-time order tracking page |
| `customer.html` | Customer account — loyalty points, tier progress, order history |
| `admin.html` | Admin orders dashboard — status updates, staff assignment, CSV export |
| `schedule.html` | Admin schedule — availability calendar, daily timeline |
| `analytics.html` | Admin analytics — Chart.js KPI cards and booking charts |
| `settings.html` | User settings — profile, avatar, password, dark mode |
| `login.html` | Login page with email 2FA (OTP via EmailJS) |
| `register.html` | New customer registration |
| `customer.js` | Customer account page logic |
| `login.js` | Login page logic |
| `tracking.js` | Tracking page logic |
| `theme.js` | Dark mode persistence |
| `analytics.js` | Analytics page logic |
| `token.css` | CSS design tokens |
| `global.css` | Global styles |
| `booking.css` | Booking page styles |
| `schedule.css` | Schedule page styles |
| `analytics.css` | Analytics page styles |
| `account.css` | Customer account styles |
| `auth.css` | Login/register styles |
| `home.css` | Homepage styles |
| `order-tracking.css` | Order card and progress tracker styles |
| `timeslot.css` | Time slot button styles |
| `videos/` | Images and video assets used across the site |

---

## Requirements

- **No local installation required** — this is a browser-based web application
- A modern web browser: Chrome, Firefox, Edge, or Safari (latest version)
- An active internet connection (required for Firebase, EmailJS, and Google Maps)

---

## Running the Project

### Option 1 — Open directly in a browser
Open `home.html` directly in any modern browser. Most features work without a server.

### Option 2 — Local development server (recommended)

Using Python (no install needed on most systems):
```bash
python -m http.server 8000
```
Then open: [http://localhost:8000/home.html](http://localhost:8000/home.html)

Using Node.js live-server:
```bash
npx live-server
```

---

## Demo Access

| Role | Email | Notes |
|------|-------|-------|
| Admin | dkcleaneditnotts@gmail.com | Access to orders, schedule, analytics, staff |
| Customer | Register via `register.html` | Full booking and tracking access |
 password - danielasouzu

After login, a 4-digit OTP is sent to the email address to complete 2FA before accessing the app.

---

## External Services

| Service | Purpose |
|---------|---------|
| Firebase Auth | User authentication and 2FA session management |
| Firebase Firestore | Database for orders, users, availability, and staff |
| Firebase Storage | Customer shoe photo and avatar uploads |
| EmailJS | Booking confirmations, 2FA codes, missed appointment emails |
| Chart.js | Analytics dashboard charts |
| Google Maps Embed | Branch location map on booking page |

---

## Key Features

- **Booking system** — service selection, add-ons (coin painting, UX treatment, odour removal), calendar date picker, real-time slot availability with Firestore listeners
- **Atomic double-booking prevention** — Firestore `runTransaction()` sentinel pattern
- **Real-time order tracking** — live Firestore `onSnapshot()` with progress bar across 7 stages
- **Loyalty tier system** — Carbon / Stone / Pearl tiers with automatic discount application at booking
- **Admin dashboard** — status management, staff assignment, delivery mode, points awarding, CSV export
- **Schedule management** — per-slot open/close calendar, conflict detection, reschedule modal
- **2FA login** — email OTP sent via EmailJS on every login
- **Dark mode** — persisted via localStorage, applied before paint to prevent flash

---

## Project Log

Located at `log.md` in the root of this repository. Updated weekly throughout the project.

---

## References (IEEE Format)

[1] MDN Web Docs (n.d.) "Location.href." Available at: https://developer.mozilla.org/en-US/docs/Web/API/Location/href [Accessed: 27 Apr. 2026]. Used in: `goLogin()` redirect helper in `app.js`.

[2] Anthropic (2025) Claude AI Assistant. Available at: https://www.anthropic.com [Accessed: 27 Apr. 2026]. Used as a development aid for debugging and code structure guidance. All final implementation decisions remain the author's own.

[3] GreatStack (n.d.) "Build a Complete Booking System with JavaScript." Available at: https://greatstack.dev [Accessed: 27 Apr. 2026]. The calendar grid day-cell rendering pattern and slot open/closed toggle UI in `buildCalendar()` and `initSchedule()` were informed by this reference.

[4] GeeksforGeeks (n.d.) "Build a Todo App using HTML CSS and JavaScript." Available at: https://www.geeksforgeeks.org/html/web-development-projects/ [Accessed: 27 Apr. 2026]. The debounced search filter pattern in `debounce()` and `renderAll()` was informed by this reference.

[5] GitHub (n.d.) "firebase-js-sdk — Firestore runTransaction example." Available at: https://github.com/topics/web-development-project [Accessed: 27 Apr. 2026]. The atomic double-booking sentinel pattern in `initBooking()` using `runTransaction()` was informed by this reference.

[6] CodingNepal (n.d.) "Responsive Image Slider in HTML CSS & JavaScript." Available at: https://www.codingnepalweb.com/best-30-javascript-projects-with-source-code/ [Accessed: 27 Apr. 2026]. The carousel auto-advance timer and touch-swipe detection in `initCarousel()` were informed by this reference.

[7] ProjectWorlds (n.d.) "Order Tracking System with Source Code." Available at: https://projectworlds.com/500-coding-projects-with-source-code/ [Accessed: 27 Apr. 2026]. The order status progress-bar and tracking page flow in `renderProgress()` and `initTracking()` were informed by this reference.

[8] 100 JS Projects (n.d.) "Real-time Form Validation." Available at: https://www.100jsprojects.com [Accessed: 27 Apr. 2026]. The inline field validation pattern in `initRegister()` and `initBooking()` was informed by this reference.

[9] Bootdey (n.d.) "2-step verification form inside a card." Available at: https://www.bootdey.com/snippets/view/2-step-verification-form-inside-a-card#css [Accessed: 23 Apr. 2026]. The 2FA input auto-focus behaviour and step-switch UI in `initLogin()` was adapted from this snippet.

[10] MDN Web Docs (n.d.) "Window.localStorage." Available at: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage [Accessed: 27 Apr. 2026]. Used in `initTheme()` — reading and writing the "theme" key to localStorage so the user's dark/light preference persists across sessions.

[11] MDN Web Docs (n.d.) "Element.classList." Available at: https://developer.mozilla.org/en-US/docs/Web/API/Element/classList [Accessed: 27 Apr. 2026]. Used in `initTheme()` — `classList.add("dark-mode")` and `classList.remove("dark-mode")` on `document.documentElement`.

[12] MDN Web Docs (n.d.) "HTMLElement.hidden." Available at: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/hidden [Accessed: 27 Apr. 2026]. Used in `setupNav()` — `el.hidden = !visible` applied to each nav link to show or hide it based on the user's role.

[13] DKcleanedit (2026) Loyalty Tier Specification — internal project design document. University of Leicester CO3202 Entrepreneurial Project 2025/26. Carbon tier (0–99 pts): no discount. Stone tier (100–499 pts): 10% discount on base service price. Pearl tier (500+ pts): free standard clean. Used in `getTierDiscount()`, `getTotalPriceStr()`, `initBooking()`, `renderOrderCard()`, `renderAdminCard()`, and `applyCustomerTier()`.

[14] W3Schools (n.d.) "HTML Semantic Elements." Available at: https://www.w3schools.com/html/html5_semantic_elements.asp [Accessed: 27 Apr. 2026]. Used for semantic landmark elements throughout `home.html`.

[15] MDN Web Docs (n.d.) "ARIA: role attribute." Available at: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles [Accessed: 27 Apr. 2026]. Used for aria-label, aria-labelledby, aria-current, aria-hidden, aria-live attributes across all pages.

[16] Google Fonts (n.d.) "Fonts." Available at: https://fonts.google.com [Accessed: 27 Apr. 2026]. Used for importing Syne (display headings) and DM Sans (body text) in `home.html`.

[17] CSS-Tricks (2021) "A Complete Guide to Flexbox." Available at: https://css-tricks.com/snippets/css/a-guide-to-flexbox/ [Accessed: 27 Apr. 2026]. Flexbox layout patterns used in hero, metric pills, tier cards, and footer grid.

[18] Bootdey (n.d.) "Pricing / Service Flip Cards." Available at: https://www.bootdey.com/snippets/view/pricing-cards [Accessed: 27 Apr. 2026]. The service flip-card HTML structure in `home.html` was adapted from this snippet.

[19] W3C (2023) "Web Content Accessibility Guidelines (WCAG) 2.2." Available at: https://www.w3.org/TR/WCAG22/ [Accessed: 27 Apr. 2026]. Used for descriptive alt text, video fallback text, role="list" on navigation and steps, and aria-label on interactive controls.

[20] Bootdey (n.d.) "Account Setting or Edit Profile." Available at: https://www.bootdey.com/snippets/view/account-setting-or-edit-profile [Accessed: 27 Apr. 2026]. Adapted for the profile strip layout in `customer.html` and `settings.html`.

[21] Bootdey (n.d.) "Profile Edit Settings." Available at: https://www.bootdey.com/snippets/view/profile-edit-settings [Accessed: 27 Apr. 2026]. Avatar-left / form-right two-column layout adapted in `settings.html`.

[22] Chart.js (n.d.) "Chart.js — Simple yet flexible JavaScript charting." Available at: https://www.chartjs.org [Accessed: 27 Apr. 2026]. Used for all charts in `analytics.html` and `analytics.js`.

[23] Firebase (n.d.) "Firebase Documentation." Available at: https://firebase.google.com/docs [Accessed: 27 Apr. 2026]. Used for Firestore, Auth, and Storage throughout the project.

[24] EmailJS (n.d.) "EmailJS — Send Email Directly From JavaScript." Available at: https://www.emailjs.com [Accessed: 27 Apr. 2026]. Used for all transactional emails including booking confirmations, 2FA OTP codes, missed appointment reminders, and pickup summaries.

[25] DKcleanedit (2026) Instagram. Available at: https://www.instagram.com/dkcleanedit_/ [Accessed: 27 Apr. 2026]. Social media link in site footer.

[26] DKcleanedit (2026) TikTok. Available at: https://www.tiktok.com/@dk_asz [Accessed: 27 Apr. 2026]. Social media link in site footer.

[27] C. Coyier, "A Complete Guide to Custom Properties," CSS-Tricks, Oct. 2024. [Online]. Available: https://css-tricks.com/a-complete-guide-to-custom-properties/ [Accessed: 27 Apr. 2026]. Used for: the `:root` custom property pattern throughout `token.css`; globally available CSS variables via the cascade.

[28] C. Coyier, "Making Custom Properties (CSS Variables) More Dynamic," CSS-Tricks, Jun. 2017. [Online]. Available: https://css-tricks.com/making-custom-properties-css-variables-dynamic/ [Accessed: 27 Apr. 2026]. Used for: splitting multi-value properties into separate custom property components in the shadow scale and motion tokens.

[29] C. Coyier, "CSS Custom Properties and Theming," CSS-Tricks, Apr. 2020. [Online]. Available: https://css-tricks.com/css-custom-properties-theming/ [Accessed: 27 Apr. 2026]. Used for: the dark-mode override pattern — a single `:root` block updated by a class on `<html>` rather than duplicating declarations per component.

[30] P. Sam, "The Times You Need a Custom @property Instead of a CSS Variable," Smashing Magazine, May 2024. [Online]. Available: https://www.smashingmagazine.com/2024/05/times-need-custom-property-instead-css-variable/ [Accessed: 27 Apr. 2026]. Used for: understanding limits of standard custom properties for animated gradients; motivated keeping gradient tokens as static strings.

[31] MDN Web Docs, "Using CSS Custom Properties (Variables)," Mozilla, 2025. [Online]. Available: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties [Accessed: 27 Apr. 2026]. Used for: confirming custom property name case-sensitivity and cascade inheritance rules.

[32] D. Mawer, "Using CSS Custom Properties with Fallbacks for Efficiency," dainemawer.com, May 2024. [Online]. Available: https://dainemawer.com/articles/using-css-custom-properties-with-fallbacks-for-efficiency [Accessed: 27 Apr. 2026]. Used for: the fallback-in-var() pattern on motion tokens and semantic aliases in `token.css`.

[33] A. Wathan and S. Schoger, Refactoring UI. Self-published, 2018. Used for: the "layer dark surfaces in 4–6% lightness steps, never flat black" principle applied in the surface scale in `token.css` and `home.css`; navy-shifted borders using low-opacity white rather than fixed hex values.

[34] Google, "Material Design 3 — Dark Theme," Google, 2022. [Online]. Available: https://m3.material.io/styles/color/dark-theme [Accessed: 27 Apr. 2026]. Used for: the tonal brand-blue overlay approach — surfaces tinted with the brand hue rather than neutral grey or pure black.

[35] A. Shadeed, "Designing Dark Mode — Best Practices," Smashing Magazine, Nov. 2020. [Online]. Available: https://www.smashingmagazine.com/2020/11/designing-dark-mode-best-practices/ [Accessed: 27 Apr. 2026]. Used for: radial glow overlays on `.hero` and section dividers using rgba tints of the brand blue; gold/amber contrast against cool navy to signal reward/premium status.

[36] Nielsen Norman Group, "Color in UI Design," 2020. [Online]. Available: https://www.nngroup.com/articles/color-enhance-design/ [Accessed: 27 Apr. 2026]. Used for: consistent semantic colour system — gold for loyalty points, green for success states — to aid scannability across all pages.

[37] C. Coyier, "A Complete Guide to CSS Animations," CSS-Tricks, 2022. [Online]. Available: https://css-tricks.com/almanac/properties/a/animation/ [Accessed: 27 Apr. 2026]. Used for: staggered fade-up entrance animations on `.page-shell` children, the float keyframe on the hero shoe image, and the shimmer keyframe on section dividers in `home.css`.

[38] C. Coyier, "A Complete Guide to CSS Grid," CSS-Tricks, 2021. [Online]. Available: https://css-tricks.com/snippets/css/complete-guide-grid/ [Accessed: 27 Apr. 2026]. Used for: `.hero`, `.steps-grid`, `.tier-cards`, `.tutorial-grid`, `.testimonials-grid`, and `.footer-grid` CSS grid layouts in `home.css`.

[39] W3C, "WCAG 2.1 Success Criterion 1.4.3 — Contrast (Minimum)," Jun. 2018. [Online]. Available: https://www.w3.org/TR/WCAG21/#contrast-minimum [Accessed: 27 Apr. 2026]. Normal text: 4.5:1 minimum. Large text: 3:1 minimum. Used for all text colour and contrast ratio decisions throughout `token.css` and `home.css`.

---

## Use of AI and YouTube in Development

**Generative AI (Claude — Anthropic)** was used as a development aid throughout this project, in accordance with the CO3202 module guidelines. Specifically:

- In the **early stages** of the project, Claude was used to help plan the overall software architecture, suggest appropriate Firebase data structures, and clarify technical concepts (e.g. Firestore transactions, sessionStorage vs localStorage).
- During **development**, Claude was used to help debug logic errors, improve code structure, cross-check contrast ratios in CSS, and suggest clearer comment phrasing in HTML and CSS files.
- Claude was also used to help improve animation timings and strengthen the luxury aesthetic direction in `home.css` and `APP.JS`.

All final implementation decisions, design choices, and business logic remain the author's own work. AI-generated suggestions were always reviewed, adapted, and verified before use. No AI-generated text was used directly in any written submission. This use is disclosed in accordance with Section 10 of the CO3202 Study Guide 2025/26.

**YouTube tutorials** were watched during the early stages of development to build foundational understanding of Firebase, EmailJS integration, and JavaScript booking system patterns. Key channels and videos consulted include tutorials on Firebase Firestore CRUD operations, Firebase Authentication flows, and EmailJS setup. These informed the overall approach rather than providing directly copied code, and the relevant written references (GreatStack, CodingNepal, ProjectWorlds) are cited above where specific patterns were adopted.