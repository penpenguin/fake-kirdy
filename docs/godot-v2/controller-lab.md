# Godot v2 Controller Lab

The controller lab is the canonical movement tuning scene for the Godot mainline. It exists to tune platformer feel with deterministic replay and trace evidence.

## Running the Lab

Open `godot/project.godot` in Godot and run the main scene. The main scene is `res://scenes/Main.tscn`, and the standalone controller lab scene is `res://levels/controller_lab.tscn`.

The lab contains a player, a long floor, a ledge for coyote time checks, and a small platform for jump buffer checks. Use it to review controller changes before applying movement assumptions to larger gameplay rooms.

## Controls

- Move left: Left Arrow or `A`
- Move right: Right Arrow or `D`
- Jump: Space, Up Arrow, or `W`
- Hover: hold Jump while airborne and falling

## Tuning Fields

`Player.tscn` assigns a `PlayerTuning` resource to `PlayerController.gd`. Tune these values first:

- `max_speed`: top horizontal speed.
- `ground_accel`: how quickly the player reaches target speed on the floor.
- `ground_decel`: how quickly the player stops on the floor when there is no horizontal input.
- `air_accel`: how much control the player has while airborne.
- `air_decel`: how quickly airborne horizontal speed eases when input is released.
- `jump_velocity`: initial upward jump speed.
- `gravity_up`: gravity while rising.
- `gravity_down`: gravity while falling.
- `jump_cut_multiplier`: how much upward velocity remains when jump is released early.
- `coyote_time_ms`: late-jump grace period after leaving a floor.
- `jump_buffer_ms`: early-jump grace period before touching a floor.
- `hover_gravity_scale`: gravity multiplier while hover is active.
- `hover_max_fall_speed`: maximum downward speed during hover.

## Tuning Workflow

Start with horizontal movement. Adjust `max_speed`, `ground_accel`, and `ground_decel` until ground movement feels responsive without snapping instantly to full speed.

Tune air control separately with `air_accel` and `air_decel`. Air control should be useful enough to correct jumps, but lower than ground control.

Tune jump shape with `jump_velocity`, `gravity_up`, `gravity_down`, and `jump_cut_multiplier`. A good baseline has a clean high jump when held and a visibly shorter hop when the jump button is released early.

Tune forgiveness with `coyote_time_ms` and `jump_buffer_ms`. Keep both small enough to feel intentional, but large enough to remove common missed inputs around platform edges and landings.

Tune hover last. Hold jump while falling and adjust `hover_gravity_scale` and `hover_max_fall_speed` until descent feels controlled without erasing the need to land.

## Trace Hooks

`PlayerController.gd` emits lightweight `trace_event` signals for spawn, jump start, jump cut, hover start/end, and landing. `godot/tests/run_replay.gd` also records `player.sampled` during scene replays so movement tuning can be compared frame by frame.

Use the canonical replay and summary commands:

```bash
npm run godot:replay -- --replay res://tests/replays/controller_lab_jump.json --out /tmp/fake-kirdy-controller-lab.ndjson
npm run trace:summary -- /tmp/fake-kirdy-controller-lab.ndjson
```

The summary includes `player_motion` with sample count, min/max position, max absolute velocity, max falling speed, and max rising speed. These metrics make controller changes reviewable without relying only on subjective feel.

When tuning, note which trace events changed and why. Good controller changes should explain the movement feel improvement and preserve deterministic event timing where practical.
