# UX/UI evidence

Captured locally on 2026-10-21 with synthetic teacher identity and CSP-blocked cloud connections. These are audit evidence, not a working hosted-service demo.

- home-desktop.png, login-desktop.png, admin-overview-desktop.png, question-bank-desktop.png, import-dialog-desktop.png, skills-editor-desktop.png, quiz-editor-desktop.png, analytics-desktop.png: 1440×1000 browser viewport.
- home-native-mobile.png and login-mobile.png: the initial IAB viewport was 421×1763; these are not 390px device-emulation captures.
- panel-measurements.json: DOM measurements for the 11 additional admin panels, with 44 native inputs/textarea/select and 38 lacking programmatic labels in the captured state. Custom FormSelect buttons are not counted as native inputs.
- public-route-measurements.json: failed preview navigations. Browser error pages are limitations of this local run, not verified product errors. Error-page screenshots were excluded from this evidence directory.

Cloud reads/writes, real student data, real microphone/camera, successful student submissions, touch gestures and a complete mobile admin pass were not performed. Local browser access was disabled in Work settings before the mobile admin pass. The preview server was stopped after the audit.
