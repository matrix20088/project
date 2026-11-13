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

## v4.0 — Cinema-heavy, adaptive and replayable
- Score-tier questions: leader at 0–2 => easy, 3–5 => medium, 6+ => hard. Explicit category selection remains respected, with fallback to the closest available tier.
- 212 additional categorized questions, heavy on Egyptian comedy, movie one-liners (short references only), film directors, singers, composers, classic TV and some world cinema.
- Mixed category draws entertainment around 62% of the time when the chosen score tier includes both entertainment and non-entertainment categories. Original geography, sports, math, words, history and science still remain.
- All 4 choices appear **on every device** once a contestant wins the buzzer, while only that contestant can answer.
- A wrong answer or unanswered buzz applies the existing speed-dependent penalty and opens the same question again after a short result window. All contestants (including the person who just answered) can buzz again.
- Wrong answer options are visibly crossed out and cannot be picked again, but the correct answer is withheld until the question ends.
- **Two distinct wrong option selections end the question** and force a new question, showing the correct answer. If nobody presses the re-opened buzzer before the timer expires, the question also ends. To avoid endless unanswered loops, 3 answer timeouts also end the question.
- Host can skip any live question immediately without a penalty. Guests can submit skip requests; the host sees a request count.
- An accepted buzzer press triggers an original, locally synthesized double metallic bell via Android AudioTrack on each participating device. It is not an external audio file, copied show effect or sample.
- Host's Bluetooth message order still determines which contestant wins; timestamps are not compensated across phones.
- 15-second secret post-speech window remains for the **first reveal**. Re-openings are immediate after short feedback.
