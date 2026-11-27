# Requirements Document

## Introduction

Boo is the ghost guide. Between phases Boo roams the screen and reacts to the person; when a popup is waiting, Boo perches beside it and offers to talk. Boo must be playful without ever getting in the way.

## Requirements

### Requirement 1

**User Story:** As a person watching the demo, I want Boo to feel alive, so that the switch feels friendly instead of scary.

#### Acceptance Criteria

1. WHILE the person has nothing to do THEN Boo SHALL roam, walk on window ledges, hop and react to clicks.
2. WHEN the person drags and throws Boo THEN Boo SHALL fly with physics and land on a ledge or the floor.
3. WHEN Boo is double-tapped THEN Boo SHALL tuck into the bottom-left corner.
4. WHEN Boo is left alone for 25 seconds THEN Boo SHALL nap in the bottom-left corner.

### Requirement 2

**User Story:** As a person, I want Boo near whatever needs me, so that I always know I can ask.

#### Acceptance Criteria

1. WHEN a popup waits for the person THEN Boo SHALL fly beside it, clear of the popup and its speech bubble, and say "Tap me" in one short line.
2. WHEN the person taps Boo THEN the chat SHALL open beside Boo.

### Requirement 3

**User Story:** As a person, I want Boo never to hide behind things, so that the easter egg feels deliberate.

#### Acceptance Criteria

1. WHEN Boo meets the "Powered by Netlify" badge THEN Boo SHALL bump its side or hop on top of it, and SHALL NOT pass behind it.
2. WHEN Boo works THEN the roaming ghost SHALL hand over to the working ghost at the same spot, and back again.
