# cache-clock

Shows a countdown to the prompt cache going cold in the status line. Keep-warm pings 45 s before expiry and stops at the break-even against one cold restart (11 pings on a 5 minute cache, 19 on 1 hour), after two hours, or when you send a message. Chats under 20k tokens never ping.

Command: `/cache-clock ttl 5m|1h, /cache-clock warm on|off`

## Install

```
/plugin marketplace add mahboobmonnamd/claude-mods
/plugin install cache-clock@claude-mods
```

Part of the token-saving pack; see the repo README.
