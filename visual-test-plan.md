# OMNOM DAO Visual & Functional Testing Plan

## Automated Visual Testing
Since I cannot see the browser, I will perform comprehensive code verification and create a detailed testing checklist.

## Screen Size Testing Matrix

### Mobile Viewports
- [ ] 320px width (iPhone SE) - Minimum supported
- [ ] 375px width (iPhone 12/13) - Standard mobile  
- [ ] 414px width (iPhone 14 Pro Max) - Large mobile
- [ ] 360px width (Android) - Android standard

### Tablet Viewports
- [ ] 768px width (iPad Mini) - Standard tablet
- [ ] 1024px width (iPad Pro) - Large tablet

### Desktop Viewports
- [ ] 1280px width (Laptop) - Standard desktop
- [ ] 1440px width (Desktop) - Large desktop
- [ ] 1920px width (Wide) - Ultra-wide

## Component Testing Checklist

### Homepage (src/app/page.tsx)
- [ ] Hero section displays correctly
- [ ] Stats bar shows holder distribution
- [ ] How it works section layout
- [ ] Active proposals preview cards
- [ ] Recent proposals list
- [ ] Footer CTA section
- [ ] Mobile navigation menu

### Voting Components
- [ ] VoteButton - Touch targets ≥44px
- [ ] VoteConfirmation - Modal readability
- [ ] VoteSuccess - Animation timing
- [ ] LiveVoteDisplay - Real-time updates
- [ ] VoteHistory - Expand/collapse functionality

### Notification Center  
- [ ] Bell icon with badge positioning
- [ ] Dropdown panel overlay
- [ ] Notification list scrolling
- [ ] Mark all read button
- [ ] Click handling for navigation

### Proposal Pages
- [ ] Proposal detail layout
- [ ] Vote panel sidebar (desktop)
- [ ] Mobile bottom bar
- [ ] Comments threading
- [ ] Timeline display

## Code Verification

I'll systematically check each component for responsive design patterns.
