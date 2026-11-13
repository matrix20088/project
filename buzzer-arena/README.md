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

## 2.0: More categories + energetic Arabic-speaking referee
- 800+ offline, original Arabic multiple-choice questions across cinema, songs, football, geography, history, literature, science, technology, cooking, animals, gaming, language, rapid maths, reversed words and more.
- The host device uses Android TextToSpeech with an Arabic language pack (attempts Egyptian Arabic then Saudi Arabic, then generic Arabic). It is a synthetic announcer voice, **not** an imitation of any specific real presenter.
- The buzzer stays locked until the question narration finishes and a short grace interval passes; if Arabic TTS is unavailable, the question is displayed and an extra reading interval is provided.
- Host can preview or disable the synthesized voice in settings.
- Referee calls out the buzzer winner, congratulates or teases answers, and announces the champion.

The app is meant for social play; Bluetooth arrival ordering is not latency-compensated and is not suitable for tournament-grade millisecond timing.

## v3.0 — Surprise buzzer, challenging trivia and slow voice-only reversed words
- More than 1,000 original Arabic questions across 20 categories, including five genuinely more challenging categories.
- In mixed mode approximately 65% of questions are drawn from the challenging categories. Categories are sampled first, preventing arithmetic questions from dominating.
- Judge reads the question first. Once speech finishes, the referee privately chooses a **uniformly random surprise delay in [0, 15,000] milliseconds**. No countdown or buzzer button is displayed during that delay. All buzzer timing is dictated by the host.
- Buzz in first 2 seconds after reveal = speed challenge: 6 seconds to choose; correct +1, wrong or unanswered -2. Later buzz = 12 seconds; correct +1, wrong or unanswered -1. No buzz = 0.
- Reversed-word prompts display *no word or spelling*. The host Android TTS speaks the reversed letters one at a time as Arabic letter names (e.g. ة ص ق ل ا → تاء مربوطة، صاد، قاف، لام، ألف), with a deliberate ~470ms pause after each letter and slower speech rate. Multiple-choice answers appear only after someone wins the buzzer.
- Reverse-word rounds require a supported Arabic TTS engine. If not available, the mixed game skips them; the single-category game pauses and explains the limitation. No silent unsolvable prompts.
- Bluetooth host uses receive ordering; not certified latency compensation.
