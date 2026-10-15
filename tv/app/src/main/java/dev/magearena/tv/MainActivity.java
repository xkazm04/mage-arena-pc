package dev.magearena.tv;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * A full-screen WebView around the browser game. The game, its camp server and the Director stay
 * on the dev machine; the TV only renders and reads input.
 *
 * Remote keys: the game's menus read KeyboardEvent.code (ArrowUp, Enter, Escape). Android WebView
 * delivers D-pad presses with an empty `code`, so remote and keyboard keys are re-sent to the page
 * as synthetic events carrying the code the game expects. Gamepads are left alone: the game reads
 * them through the standard Gamepad API, and forwarding their D-pad as well would double every press.
 *
 * Logcat tag MageArena: the loaded URL, WebView console lines and load errors.
 * Debugging: chrome://inspect on the dev machine sees this WebView over adb.
 */
public class MainActivity extends Activity {
    private static final String TAG = "MageArena";
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WebView.setWebContentsDebuggingEnabled(true);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        // The game unlocks audio on its first input; a TV has no click to give it.
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.setBackgroundColor(0xff000000);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i(TAG, "console " + m.messageLevel() + " " + m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                Log.i(TAG, "loaded " + url);
                view.evaluateJavascript(
                    "'gamepadApi=' + (typeof navigator.getGamepads) + ' viewport=' + innerWidth + 'x' + innerHeight + ' dpr=' + devicePixelRatio",
                    v -> Log.i(TAG, "probe " + v));
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (!req.isForMainFrame()) return;
                Log.e(TAG, "load failed " + req.getUrl() + ": " + err.getErrorCode() + " " + err.getDescription());
                view.loadData(
                    "<body style='background:#0b1114;color:#cfe;font:28px sans-serif;padding:60px'>"
                        + "<h2>Mage Arena could not reach the game</h2><p>" + req.getUrl() + "<br>" + err.getDescription()
                        + "</p><p>On the dev machine: <code>npm run camp</code>, then <code>tv/tv.ps1 -Stage deploy</code>"
                        + " (it sets up <code>adb reverse tcp:5173 tcp:5173</code>). OK retries.</p></body>",
                    "text/html", "utf-8");
                retryUrl = req.getUrl().toString();
            }
        });

        setContentView(web);
        hideSystemUi();

        String url = getIntent().getStringExtra("url");
        if (url == null || url.isEmpty()) url = BuildConfig.GAME_URL;
        Log.i(TAG, "loading " + url);
        web.loadUrl(url);
        web.requestFocus();
    }

    private String retryUrl;

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    /** KeyboardEvent.code for a remote or keyboard key, or null to let the WebView handle it. */
    private static String codeFor(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP: return "ArrowUp";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "ArrowDown";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "ArrowLeft";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "ArrowRight";
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER: return "Enter";
            // Back and Play/Pause open the game's pause menu, which is also how it backs out of screens.
            case KeyEvent.KEYCODE_BACK:
            case KeyEvent.KEYCODE_ESCAPE:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MENU: return "Escape";
            default: return null;
        }
    }

    private static boolean fromGamepad(KeyEvent e) {
        int src = e.getSource();
        return (src & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
            || (src & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK;
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        String code = fromGamepad(e) ? null : codeFor(e.getKeyCode());
        if (code == null) return super.dispatchKeyEvent(e);
        if (retryUrl != null) {
            if (e.getAction() == KeyEvent.ACTION_UP && "Enter".equals(code)) {
                String url = retryUrl;
                retryUrl = null;
                Log.i(TAG, "retry " + url);
                web.loadUrl(url);
            }
            return true;
        }
        String type = e.getAction() == KeyEvent.ACTION_DOWN ? "keydown" : e.getAction() == KeyEvent.ACTION_UP ? "keyup" : null;
        if (type == null) return true;
        boolean repeat = e.getRepeatCount() > 0;
        web.evaluateJavascript(
            "(function(){var t=document.activeElement||document.body||document;"
                + "t.dispatchEvent(new KeyboardEvent('" + type + "',{key:'" + code + "',code:'" + code + "',repeat:" + repeat
                + ",bubbles:true,cancelable:true}));})()",
            null);
        return true;
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
