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

## v5.0 — Four choices BEFORE the surprise buzzer
- Once the referee finishes speaking the question (or spelling the reverse word), all players see the answer choices being revealed one by one. The first choice appears after 350 ms, then each of the next three appears about 1.05 seconds apart.
- Each choice reveal is controlled by the **Bluetooth host** and the entire state is broadcast to the other 1–3 players, guaranteeing that the game shares the same reveal count.
- The very last choice is displayed before the secret reveal timer is ever started. The host randomly opens the buzzer **1–10 seconds after option four**; the exact timing is kept private, with no visible countdown.
- The answer choices remain visible while the buzzer is waiting, and throughout the rest of the question; contestants cannot select them unless they won the buzzer.
- All existing mechanics preserved: 2–4 humans, adaptive difficulty, scorecards, speed penalties, multiple attempts after wrong/timeouts, two distinct wrong choices to end the question, host skip and guest skip requests, synthetic double-bell.
- On mobile portrait screens, the active buzzer is fixed near the bottom so it cannot be hidden below the options.
- The first buzzer is surprise-timed; repeat buzzer on an incorrect answer retains the earlier fast reopening rule.

## v6.0 — Immediate buzzer + interrupted choice narration
- The buzzer is visible to all 2–4 phones immediately upon completion of the question narration.
- All choices are then spoken aloud by the host's Arabic text-to-speech referee one by one, and displayed as they are spoken. No hidden surprise delay.
- An accepted buzz freezes the audience's visible choices immediately and **stops the rest of the choice narration**. The buzz winner is privately shown all four tappable answer options, since the app needs a way to submit a multiple-choice answer. Other players see only options already read.
- On a wrong response or answer timeout, the same question and buzzer reopen, and each choice is spoken **again from option A** (with previously wrong choices crossed out). After 2 distinct wrong selections, the round ends as before.
- A richer original synthesized double metallic bell sounds on every connected device when the host accepts a buzz. All audio assets are generated programmatically, no samples copied from broadcast.
- 10+ varied Egyptian Arabic referee phrases per category, with immediate repetitions prevented; spoken pacing and pitch vary lightly to feel less repetitive.
- If Android Arabic TTS is missing, options continue revealing on a fixed fallback timer. On actual phones, speech callbacks coordinate the sequence; the host remains authoritative.
- A 22-second open-buzzer window allows multiple spoken options to play; the previous fast/late buzzer score rules and winner target remain.
- Phone-to-phone Bluetooth clock synchronization is not perfect; buzz winner is determined by message arrival at the host.

## v7.0 — Early buzz is now a written-answer challenge; real country flag pictures
- First two seconds still count as a risky fast buzz: score penalty -2 if wrong or unanswered, +1 if correct. Delayed press keeps -1 penalty. Existing 6-second fast and 12-second delayed response timers remain.
- Any buzz before all four choices have been narrated freezes public choices and presents the winning contestant with a **blank typed answer form** (not the four hidden answers). A contestant hears/sees only the choices read aloud before buzzing; other players see no additional choices either.
- Android input auto-correction is disabled on the typed form. Answer scoring occurs on the **host**; the host compares conservative normalized Arabic strings (diacritics, common Alef/Hamza differences, final Ta Marbuta, optional definite article) plus a small explicit alias table, without loose fuzzy matching.
- All network state packets to guests redact every answer option not yet publicly spoken, even if a player checks message contents.
- After all four options have been spoken, normal selectable multiple-choice buttons are available to the first buzzer winner.
- Every failed written or selected answer counts as a wrong attempt. Two wrong answers end the question; unanswered buzzes still reopen until the existing max timeout threshold. Incorrect option choices stay crossed out, without revealing the correct answer before the round ends.
- True vector **country flag images** (e.g. Brazil), displayed locally as SVG files inside the Android APK, appear in flag questions. The referee asks **"لأي دولة هذا العلم؟"** without reading the flag emoji or country name.
- Dedicated "🚩 تحدي أعلام العالم" category adds 68 flags and converts the earlier flag-emoji questions to the same picture format. Capitals and other text-only questions remain unchanged.
- Flag art from [lipis/flag-icons](https://github.com/lipis/flag-icons), release v7.3.2, MIT License. The MIT license is bundled under `assets/flags/LICENSE` inside the APK. SVG files are downloaded from the pinned repository release **during CI**, then bundled for offline operation; no internet access is needed during gameplay.
- No background server, ads, or computer players. 2–4 human players, Bluetooth, locally synthesized bell and Arabic TTS.
