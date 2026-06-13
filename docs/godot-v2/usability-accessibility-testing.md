# Godot v2 Usability and Accessibility Testing

The explicit usability/accessibility gate is:

```bash
npm run godot:usability
```

The command reads `godot/tests/usability_accessibility_contract.json` and checks the current Godot-owned UI and input surface:

- keyboard mappings exist for core movement, combat, map, pause, and result actions
- representative replays cover difficulty, touch controls, pause, settings-from-pause, and restart flows
- visible UI scenes contain labels with text
- visual feedback paths exist for touch buttons, combat damage, and map completion
- minimap color roles are present and separated enough to avoid relying on a single indistinct hue
- tutorial size ratios keep the player, enemies, heal pickups, and item/door/goal markers readable against each other
- HUD runtime values include semantic captions such as `HEALTH`, `ABILITY`, `ITEMS`, `SCORE`, `OBJECTIVE`, `ATTACK`, and `STATUS`
- representative player, door, heal pickup, and enemy visuals stay within the one-block readability envelope
- `central_hub` door markers have a nearby support platform so exits are not floating without obvious footing

This is a static contract, not a replacement for user research or full screen-reader support. It keeps the current Godot migration from regressing on the basic usability evidence that agents can verify quickly.
