# What2Play Roadmap

**Product Owner:** James (AI)
**Dev Team:** Claude Code

## Current State (v0.2)

✅ Core collection management
✅ BGG integration (search, import, collection sync)
✅ Photo scan with AI recognition
✅ Tags & custom tags
✅ Play groups & players
✅ "Heute spielen" recommendations
✅ Batch delete (manage page)
✅ APK builds via GitHub Actions

## Roadmap

### v0.3 - Core UX ✅ COMPLETED (2026-03-19)
- [x] Merge feature branches to master
- [x] 🎲 Random Picker with animation ("Überrasch mich!")
- [x] ⚡ Quick filters on home (player count, duration, complexity)
- [x] 🌙 Dark mode
- [x] "Zuletzt gespielt" section on home
- [x] Onboarding flow for new users

### User Research Insights (2026-03-19)
**Power Users want:** BGG ratings in app, mechanics search, shame pile tracker
**Casual Users want:** Random picker (KILLER FEATURE), one-tap filters, simple UI
**Deprioritized:** Play session logging (only power users care)

### v0.4 - Play Sessions
- [ ] Log played games (date, players, winner)
- [ ] Play history per game
- [ ] Statistics dashboard (most played, win rates)
- [ ] "Lange nicht gespielt" filter

### v0.5 - Smart Recommendations
- [ ] Improve "Heute spielen" algorithm
- [ ] Consider player preferences from groups
- [ ] "Überrasch mich" random picker with animation
- [ ] Quick filters on home (2-player, party, quick games)

### v0.6 - Social & Sharing
- [ ] Share collection as link
- [ ] "Ich bring mit" for game nights
- [ ] QR code for quick sharing
- [ ] Export/Import collection (JSON backup)

### v0.7 - Cloud & Sync
- [ ] Optional account system
- [ ] Cloud backup
- [ ] Multi-device sync

### Backlog
- Wishlist with BGG watchlist sync
- Price alerts (too complex for now)
- Barcode scanner
- Widget for "Spiel des Tages"
- Notifications ("Du hast X seit 3 Monaten nicht gespielt")

---

## Development Process

1. James (PO) prioritizes features
2. Claude Code implements
3. Push to feature branch
4. Test APK from GitHub Actions
5. Merge to master when stable

## Notes

- Keep it simple - mobile-first
- German UI, English code
- Capacitor for Android APK
- No backend needed (local-first with IndexedDB)
