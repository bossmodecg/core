# BossmodeCG #
BossmodeCG is a simple, highly-extensible core architecture designed to power visualization and computer graphics frontends for video streams. If you're looking for deep customization and integration with services across the spectrum for your live streams,BossmodeCG might just be the tool for you. Inspired by the fantastic [NodeCG](https://github.com/nodecg/nodecg) project, BossmodeCG focuses on ease of use and programmer friendliness to help make your streams awesome.

## You can use BossmodeCG with: ##
- **OBS Studio**
- **OBS Classic**
- **XSplit**
- **vMix**
- any other streaming solution that offers a browser/webpage overlay source

*Please note:* at present, OBS Studio 0.18.x and up are the primary targeted platform. OBS Studio tends to keep its browser plugin (a derivative of the Chromium browser) most up-to-date and it's the most reliable and performant HTML5 overlay choice. vMix is also generally very reliable--but if you're using vMix you're paying a bunch of money, you don't need me to tell you this.

## Supported integrations and services ##
- `bossmodecg-module-example`: A really simple demonstration service that just increments a counter based on some 
- `bossmodecg-module-twitch`: Twitch integration and alerts (messages, resubs, etc.).
- `bossmodecg-module-obs_studio`: API for retrieving information from OBS Studio (scene transitions, dropped frames, etc.) and controlling some OBS actions through the [obs-websocket](https://github.com/Palakis/obs-websocket) system.
- `bossmodecg-module-simplestore`: SimpleStore is a service that allows for global access to its state; your management system can just update a key and your graphics frontend can subscribe to state updates without having to write your own logic in BossmodeCG itself.

## Planned future integrations ##
- `bossmodecg-module-streamtip`: StreamTip integration for streamers to notify when viewers have put a couple bucks in the hat.
- `bossmodecg-module-extralife`: Extra Life integration for user and team donation alerts.
- `bossmodecg-module-beam`: Beam integration for chat, followers, etc.
- `bossmodecg-module-vmix`: Integration with the vMix broadcasting suite.

## The architecture ##
BossmodeCG is a simple client-server application and places few restrictions on what clients can actually do. In practice, however, clients are divided into _frontend_ clients and _management_ clients. Management clients provide all the bells and whistles you need to work with your stream (and maybe a few more besides, like the way the Twitch service can update the game currently being played on your channel), while frontend clients consume data and events coming back out of BossmodeCG to draw those overlays.

The easiest management tool is to leverage `bossmodecg-manager`, a React-based management tool. It's really easy to consume control panels for existing BossmodeCG services and write your own--most of the ones I end up writing for clients take maybe twenty minutes to write and I can be confident that they work!

Frontends are typically bespoke and are wholly decoupled from the BossmodeCG framework. Connect to BossmodeCG, hook into the events that your components care about, and you're off to the races. `bossmodecg-example` has a pretty good starting point available to you that uses modern ES6 and React to serve as a wrapper around Canvas.  **Building reusable components in either HTML5 or Canvas would be a great way to contribute to BossmodeCG!**


## Future work ##
- Conservative state locking; right now, data races can conceivably occur inside a BossmodeCG module if multiple events need to write in quick succession. They're very unlikely (no more likely than any other NodeJS application that relies on nonblocking continuations), but I believe in bulletproof software and I want to patch this. 
