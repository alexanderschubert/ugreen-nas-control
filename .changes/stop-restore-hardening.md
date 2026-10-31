---
type: fix
---

Fans: stopping or restoring now waits for a busy tool instead of giving up, and a slow embedded controller, a hung helper or a broker restart no longer leaves fans, LEDs, MQTT availability or state files in a bad state.
