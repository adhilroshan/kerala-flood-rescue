# Kerala Flood Rescue — First Playable Design

## Goal and scope

Build a browser-based, third-person 3D rescue game set in a **fictional composite Kerala neighborhood** during the 2018 floods. The first playable is one complete, roughly 10–15-minute mission that combines boat navigation, relief coordination, and human-scale storytelling. It is a respectful interpretation of the event, not a reconstruction of named survivors or a claim to simulate the historical response.

The first mission is single-player and keyboard-first. It does not include combat, a score leaderboard, a real-time casualty countdown, multiple levels, or mobile touch steering.

## Player journey

1. An opening card establishes the fictional framing, the flooding, and the player's role as a volunteer boat operator. A short help panel explains controls and the objective.
2. The player launches from a relief shelter into a compact flooded neighborhood. Radio calls and visible signals identify households and supply requests; a map lists known requests and their locations.
3. The player pilots the boat through streets, avoiding buildings and shallow obstructions, and docks within an interaction radius of a marked stop.
4. At a stop, a concise dialogue presents the people and their needs. The player chooses whether to board passengers or deliver requested supplies, subject to capacity and inventory. The map updates immediately.
5. The player returns passengers to the shelter and reloads supplies there. Later radio dialogue acknowledges the player's choices and progress.
6. After every required evacuation and delivery is complete, a short epilogue summarizes the neighborhood response and the people helped.

## Mission rules

- Three households have **two, one, and one evacuee**, respectively. The boat holds **two passengers** at a time, so the player must return to the shelter at least once. Boarding a household's evacuees is one action and requires enough free seats for that household.
- Two of those stops also request **one supply crate each for neighbors remaining nearby**. The shelter starts with exactly two crates; the boat holds two. It starts loaded with both, and the player may reload any undelivered crates left at the shelter. A delivered crate cannot be loaded again.
- Known requests appear on a schematic map. Radio calls introduce requests in a fixed, short sequence as the player starts exploring; approaching a stop also discovers it, so the player may choose any route. Each request remains available until resolved.
- The mission has no fail-by-timer condition. Changing rain, water lighting, and radio urgency suggest pressure without making people disappear because the player explored slowly.
- An interaction checks proximity, available passenger seats or crates, and whether a request is still unresolved. If an action cannot happen, the dialogue explains why and offers the next useful step.
- The mission is complete when all four people have been delivered to the shelter and both crates have been delivered. Completion does not depend on the order of visits. The epilogue may acknowledge visit order but does not rank the player.
- Boat collisions slow or redirect the boat rather than destroying it. If the boat becomes stuck, a reset-to-last-safe-water action is available from pause/help.

## World and presentation

Use stylized, grounded low-poly 3D: a navigable water surface, flooded lanes, distinct tiled-roof homes, palms, local vegetation, a visible shelter, rain, and warm signals from occupied buildings. Landmarks and stop markers must remain readable in poor weather. The camera follows behind and above the boat, with controls tuned for navigation rather than simulation realism.

Fictional character names and concise radio/dialogue text give context to each request. Text avoids claiming that any fictional event occurred to a specific real person. The opening and closing cards acknowledge the real 2018 Kerala floods and collective rescue efforts. Sound and weather support atmosphere; neither sensationalizes harm.

## Interface and controls

- `W/S` or up/down: accelerate and reverse; `A/D` or left/right: steer. `E`: interact at a stop. `M`: open or close the request map. `Esc`: pause/help. A visible button also opens the map and pause/help screens.
- The HUD shows current passengers, crates, the nearest available stop, and a compact objective summary. The map shows the shelter, discovered households, unresolved requests, and the boat's location.
- Map, dialogue, opening card, and pause/help are HTML interface layers above the canvas. They are operable by keyboard and mouse, expose readable labels and focus states, and pause boat input while open. Pause/help includes controls, sound settings, and reset-to-safe-water.
- Desktop browsers are the supported input target. The interface adapts to smaller windows without clipping text, but the first playable does not promise touch driving.
- Honor reduced-motion preferences where practical: minimize camera sway and nonessential transitions. If WebGL is unavailable, show an informative fallback rather than a blank canvas.

## Technical structure

Use TypeScript, Three.js, and Vite. Keep the mission model independent of Three.js and DOM code:

- **Mission state and rules:** requests, passengers, cargo, shelter inventory, discoveries, dialogue flags, and completion. Exposes explicit actions such as discover, board, deliver crate, unload, and reload; rejects invalid actions with displayable reasons.
- **3D world:** scene, camera, lighting, weather, terrain/water, boat movement, collision boundaries, and spatial stop proximity. Emits interaction candidates but does not decide mission outcomes.
- **Game controller:** connects player input and nearby stops to mission actions, advances radio beats, and coordinates pause/map state.
- **HTML interface:** renders HUD, map, dialogues, help, opening, and epilogue from mission/controller state. UI interactions call controller actions rather than mutating the scene directly.

Use authored, local geometry and materials for the first mission so it runs without external asset services. Keep the world small enough for a smooth desktop browser experience. A development build should be runnable locally with a single documented command after dependency installation.

## Verification and acceptance

- A fresh player can start, understand the controls, find requests, rescue all four people, deliver both crates, and see the epilogue without leaving the game.
- Passenger and cargo limits hold for every order of visits; invalid interactions explain the constraint; returning to shelter unloads passengers and permits reloading crates.
- The boat cannot pass through major buildings or become permanently trapped; reset-to-safe-water restores play.
- Map and dialogue remain usable with keyboard and mouse, and pause prevents unintended boat movement.
- Verify mission rules with focused automated tests and play the mission end to end in a browser at desktop and narrower viewport sizes; check the WebGL fallback and reduced-motion behavior.

## Out of scope for this first mission

Historically precise geographic reconstruction, named real survivors, networked multiplayer, procedural world generation, multiple chapters, voice acting, and mobile touch controls. These can be considered after the core mission is enjoyable and complete.
