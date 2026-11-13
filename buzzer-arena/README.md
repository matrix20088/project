# جرس التحدي 🔔

Android game show quiz for **2, 3, or 4 real human players**, each playing from their own paired Android phone over Bluetooth Classic RFCOMM. **No computer opponent.**

Host phone is simultaneously player 1 and the authoritative referee: first buzz message **received by host** locks the question, the selected player gets the multiple choice options, and the judge awards +1 for a correct answer, -1 for a wrong one, up to 10 to win.

Original Arabic question bank across cinema, music, sports, geography, general culture, and scrambled words. Includes rounds, timed buzzer, timed answers, scoreboard, a clear result screen, TTS (Arabic voice if available), haptic and sound effects.

## Start
1. Install same APK on each Android phone, pair devices through system Bluetooth settings.
2. Host enters a nickname and chooses **2/3/4** players, and a category / mixed.
3. Host taps "Create Room". Guests enter nicknames, tap "Join Room", select the host among paired devices.
4. Once everyone is connected, host starts. Only one buzzer can win a given question.
5. The host acts as the referee; no separate judge device.

### Fairness note
Bluetooth may introduce small network differences: **order of arrivals at host** determines the winner, not the exact local touch timestamp. For casual play on nearby phones this is a practical approximation; not a tournament-grade buzzer.

No accounts, external servers or internet needed. No original third-party audiovisual footage, show branding, or copied card design.

## Development
`gradle -p buzzer-arena :app:assembleDebug` with Android SDK 35 and JDK17.
