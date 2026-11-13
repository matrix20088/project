# NEON VOW — 3D Co-op Combat Prototype (Android)

An **actual playable third-person 3D Android game**, built with Three.js, WebGL, skinned photo-scanned character rigs, a deterministic host-authoritative game simulator, and Bluetooth Classic pairing.

## What is implemented now

- 2 human playable characters (Adam, melee energy sword; Layla, ranged energy attacks), with real 3D PBR textures and rigged anatomy.
- 12 selectable campaign missions, each with **3 combat sectors** and a sector boss.
- Multiple enemy AI classes: pursuing drones, ranged robots, armored tanks, and a giant sector boss with a 5-projectile spread.
- Keyboard and multitouch joystick, attack (hold), dash with cooldown, charged radial EMP special move.
- Character HP, drops (medkits and crystals), score, energy recovery, player-down/revival and defeat/victory.
- Interactive co-op gates; both characters must reach them, including the AI companion when offline solo.
- Android Bluetooth Classic peer-to-peer connection (no accounts, servers, or internet needed after installation).
- Solo mode features an AI-powered *rule-based* companion (not a cloud AI agent).
- Enemy waves and settings scale with mission level.
- Android APK built by CI after passing unit tests and headless WebGL screenshot test.

## Install and play

Install the same APK on both Android phones. Pair the phones once in Android Bluetooth settings.
On one phone choose **«أنشئ غرفة لشخصين»**, the other choose **«انضم»** and pick the first phone. The host controls Adam; the guest controls Layla. The host chooses **ابدأ**.

You can also select **ابدأ المغامرة الفردية** to test Android controls without the second phone.

## Controls

- Left-bottom virtual stick: freely move 3D character.
- Right big button: hold to attack.
- Blue dash: dodge with short invulnerability, 2.5-second cooldown.
- Gold star: special energy pulse (charges from kills).
- Stay next to a fallen partner to revive automatically.
- Go near both floor pads by an unlocked neon gate after defeating all enemies.
- Desktop test: WASD/arrow keys, Space, Shift, E, Escape.

## Build

Entry points: `src/play.mjs`, `src/simulation.mjs` (pure game logic), `src/visuals.mjs` (Three.js renderer).
The GitHub Actions workflow `.github/workflows/neon-vow-coop-game.yml` converts the character scans to optimized GLB assets, bundles `game.js`, performs 2-layer tests (simulation and browser), compiles Android, and publishes an APK plus **unedited real-time screenshot files**.

## Important limitations

This is a **vertical slice** and not a finished AAA-budget title. It does not include recorded full-body mocap, cinematic story scenes, large open-world content, or robust network lag compensation. Android hardware framerate and real two-phone Bluetooth play remain unverified until physical testing.

Character models: Renderpeople Nathan & Sophia (bundled through https://github.com/s0ck3t/VideoIntoBlenderModel, whose asset manifest documents usage terms). Verify third-party redistribution terms prior to public commercial release. The game does not export or redistribute original FBX source in the repository; CI packages converted in-app assets for test builds.

Game code and city environment authored for this prototype. No external accounts or telemetry.
