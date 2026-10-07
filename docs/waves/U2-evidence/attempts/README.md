# Retained failed attempts

- `stale-preview.json/png`: the source tour gained `propFixture` before the production preview was rebuilt. The old bundle lacked that harness method. Rebuilt with `npm run build:game` before the next tour.
- `prop-order.json/png`: the new test exposed real incorrect occlusion. Re-adding an existing actor every frame moved it to the end without invalidating the unchanged depth value. Actors now attach once; Pixi sorts them with props by world-foot Y. Both front/behind fixtures pass in the final tour.
- `gate-worker-warning.txt`: all 156 + ten tests and the full gate passed (exit 0), but Vitest reported slow fork-worker termination for existing camp/season tests. Retained the output and reran the gate: the final run passed without the warning. No gameplay/test code was changed for it.
- Earlier layout iterations found menu and Parley button wrapping; labels/insets were corrected before the retained final build. Their screenshots were superseded by the reruns.

These attempts are not the final result. Read `../browser.json` and the final report.
