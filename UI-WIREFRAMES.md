
## 10. Create Proposal — Step 3: Parameters

```
┌──────────────────────────────────────────────────────────┐
│  Create Proposal                                          │
│  Step 3 of 4: Voting Parameters                           │
│  ◉◉●○                                                     │
│                                                          │
│  Type: 🏛️ Chain Selection                                │
│  Title: Which blockchain should $OMNOM relaunch on?       │
│                                                          │
│  Voting Duration *                                        │
│  ┌──────────────────────────────────────────────────────┐│
│  │  [72 hours ▼]                                        ││
│  │  Options: 24h · 72h · 7 days · 14 days · 30 days   ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  Quorum Requirement                                      │
│  ┌──────────────────────────────────────────────────────┐│
│  │  Minimum % of total supply that must vote:           ││
│  │  ○───●────── 10%  (31B OMNOM required)               ││
│  │  5%       10%      20%      50%                     ││
│  └──────────────────────────────────────────────────────┘│
│  ⚠️ Lower quorum = easier to pass, less legitimacy       │
│                                                          │
│  Tags (optional)                                         │
│  ┌──────────────────────────────────────────────────────┐│
│  │  [chain-selection] [relaunch] [+ Add tag]            ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ⚙️ Advanced                                             │
│  ┌──────────────────────────────────────────────────────┐│
│  │  ☐ Require wallet verification to vote               ││
│  │  ☐ Allow delegates to vote on behalf                 ││
│  │  ☐ Show voter addresses publicly                     ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│                              [← Back]  [Next →]         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Components:** StepIndicator, DropdownField, SliderField, TagInput, CheckboxGroup, WarningAlert, NavigationButtons
**Interactions:** Slider drag → updates required OMNOM count in real-time

---

## 11. Create Proposal — Step 4: Review

```
┌──────────────────────────────────────────────────────────┐
│  Create Proposal                                          │
│  Step 4 of 4: Review & Submit                             │
│  ◉◉◉●                                                     │
│                                                          │
│  ⚠️  Please review carefully. Submitted proposals        │
│     cannot be edited after creation.                     │
│                                                          │
│  ┌─ Type ───────────────────────────────── [Edit] ────┐ │
│  │ 🏛️ Chain Selection                                │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Content ─────────────────────────── [Edit] ────────┐ │
│  │ Title: Which blockchain should $OMNOM relaunch on?   │ │
│  │ Description: (preview of Markdown content...)         │ │
│  │ Attachments: research-base-chain.pdf                 │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Parameters ───────────────────────── [Edit] ────────┐ │
│  │ Duration: 72 hours                                   │ │
│  │ Quorum: 10% of supply (31B OMNOM)                   │ │
│  │ Tags: chain-selection, relaunch                      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Your Vote Power ───────────────────────────────────┐ │
│  │ You will vote with: 12,345,678 power                │ │
│  │ Your vote weight: 0.004% of total supply             │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ☐ I confirm this proposal is accurate and complete.     │
│                                                          │
│  [← Back]                      [🚀 Submit Proposal]      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Components:** StepIndicator, ReviewSection (×4 with Edit buttons), Checkbox, SubmitButton, ConfirmationAlert
**States:**
- Confirmation unchecked: Submit button disabled
- Submitting: Spinner + "Submitting..." on button
- Success: Redirect to proposal detail page with confetti animation
- Error: "Submission failed. Please try again."

---

## 12. Settings Page

```
┌──────────────────────────────────────────────────────────┐
│  🐕 $OMNOM DAO    [Dashboard] [Proposals] [Settings]     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Settings                                                │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  ── Connected Wallet ────────────────────────────────── │
│  ┌────────────────────────────────────────────────────┐  │
│  │  🦊 MetaMask                                        │  │
│  │  0x1a2b...3c4d...5e6f                              │  │
│  │  🐬 Dolphin · #847 · Verified Jun 23, 2026         │  │
│  │  [Disconnect]                                       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ── Profile ────────────────────────────────────────── │
│  Display Name                                           │
│  ┌──────────────────────────────────────────────────────┐│
│  │ DanielOMNOM                                          ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ── Notifications ──────────────────────────────────── │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Email Notifications     [🔴 ON]                     │  │
│  │   notify@daniel.com                                 │  │
│  │ Telegram Notifications   [🟢 ON]                     │  │
│  │   @PennybagsCX                                     │  │
│  │ In-App Notifications    [🟢 ON]                     │  │
│  │ Vote Reminders           [🟢 ON]  (24h before end)  │  │
│  │ New Proposal Alerts      [🔴 OFF]                  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ── Preferences ─────────────────────────────────────── │
│  Default Sort:  [Newest First ▼]                        │
│  Language:       [English ▼]                             │
│                                                          │
│  ── Danger Zone ────────────────────────────────────── │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ⚠️ Delete Account                                   │  │
│  │ This removes your profile and voting history.       │  │
│  │ Your wallet can be reconnected at any time.          │  │
│  │ [Delete My Account]                                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Components:** SectionHeader, WalletCard, InputField, ToggleRow (×5), DropdownField, DangerZone, DeleteButton
**States:**
- Disconnected: Wallet card shows "No wallet connected" with "Connect Wallet" CTA
- Mobile: All sections full-width, toggles accessible

---

## Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|---|---|---|
| Desktop | ≥1024px | Full layout, sidebar nav, 3-4 column grids |
| Tablet | 768-1023px | 2-column grids, compact sidebar |
| Mobile | <768px | Single column, bottom nav, full-width cards, sticky vote bar |

## Loading States

All screens show skeleton placeholders during data fetching:
- Card skeletons with pulsing gray bars
- Stat cards with circular progress indicators
- Proposal list with 3 skeleton cards

## Error States

- Network error: Toast notification + retry button
- Session expired: "Your session expired. Please reconnect your wallet."
- Proposal not found: 404 page with "Back to Proposals" link
