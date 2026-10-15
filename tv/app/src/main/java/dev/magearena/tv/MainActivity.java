package dev.magearena.tv;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A full-screen WebView around the browser game. The game, its camp server and the Director stay
 * on the dev machine; the TV only renders and reads input.
 *
 * Remote keys: the game's menus read KeyboardEvent.code (ArrowUp, Enter, Escape). Android WebView
 * delivers D-pad presses with an empty `code`, so remote and keyboard keys are re-sent to the page
 * as synthetic events carrying the code the game expects. Gamepads are left alone: the game reads
 * them through the standard Gamepad API, and forwarding their D-pad as well would double every press.
 *
 * Phone controller: [PadLink] serves the controller page on the LAN and seats one phone; its state
 * reaches the game as a synthetic standard Gamepad (assets/pad-shim.js), injected at the top of the
 * game's HTML before any game script, and [PairingOverlay] shows the QR and PIN. Long-press Menu
 * toggles the overlay.
 *
 * Logcat tag MageArena: the loaded URL, the controller URL and PIN, WebView console lines, load errors.
 * Debugging: chrome://inspect on the dev machine sees this WebView over adb.
 */
public class MainActivity extends Activity implements PadLink.Host {
    private static final String TAG = "MageArena";
    private static final Pattern HEAD = Pattern.compile("<head[^>]*>", Pattern.CASE_INSENSITIVE);
    private final Handler ui = new Handler(Looper.getMainLooper());
    private WebView web;
    private PairingOverlay overlay;
    private PadLink link;
    private String shim = "", feed = "pull", screen = "";
    private int screenPollMs;
    private long menuLongPressMs;
    private boolean menuLong;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WebView.setWebContentsDebuggingEnabled(true);

        JSONObject tuning = new JSONObject();
        byte[] page = new byte[0];
        try {
            tuning = new JSONObject(new String(asset("controller/tuning.json"), StandardCharsets.UTF_8));
            shim = new String(asset("pad-shim.js"), StandardCharsets.UTF_8);
            // The phone page's numbers come from the same file the shell reads; one authority.
            page = new String(asset("controller/index.html"), StandardCharsets.UTF_8)
                .replace("/*TUNING*/{}", tuning.getJSONObject("phone").toString()).getBytes(StandardCharsets.UTF_8);
        } catch (Exception e) {
            Log.e(TAG, "controller assets unreadable: " + e);
        }
        JSONObject linkTuning = tuning.optJSONObject("link"), overlayTuning = tuning.optJSONObject("overlay");
        if (linkTuning == null) linkTuning = new JSONObject();
        if (overlayTuning == null) overlayTuning = new JSONObject();
        String feedExtra = getIntent().getStringExtra("feed");
        feed = "push".equals(feedExtra) || "pull".equals(feedExtra) ? feedExtra : linkTuning.optString("feed", "pull");
        screenPollMs = linkTuning.optInt("screenPollMs", 250);
        menuLongPressMs = overlayTuning.optLong("menuLongPressMs", 600);

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
        web.addJavascriptInterface(new Bridge(), "MageArenaPad");

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i(TAG, "console " + m.messageLevel() + " " + m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return req.isForMainFrame() && "GET".equals(req.getMethod()) ? withShim(req) : null;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                Log.i(TAG, "loaded " + url);
                view.evaluateJavascript(
                    "'gamepadApi=' + (typeof navigator.getGamepads) + ' viewport=' + innerWidth + 'x' + innerHeight + ' dpr=' + devicePixelRatio"
                        + " + ' padShim=' + (window.__mPad ? __mPad.stats().feed : 'missing')",
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

        overlay = new PairingOverlay(this, overlayTuning);
        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        root.addView(overlay, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        hideSystemUi();

        link = new PadLink(this, linkTuning, page, BuildConfig.DEBUG);
        Log.i(TAG, "controller feed " + feed);

        String url = getIntent().getStringExtra("url");
        if (url == null || url.isEmpty()) url = BuildConfig.GAME_URL;
        Log.i(TAG, "loading " + url);
        web.loadUrl(url);
        web.requestFocus();
    }

    private String retryUrl;

    private byte[] asset(String name) throws IOException {
        try (InputStream in = getAssets().open(name)) { return readAll(in); }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        for (int n; (n = in.read(buf)) > 0; ) b.write(buf, 0, n);
        return b.toByteArray();
    }

    /**
     * The game's document with the gamepad shim as the first thing in <head>, so it runs before any game script and the
     * game's first getGamepads call already sees the phone. (WebViewCompat.addDocumentStartJavaScript would do the same
     * but androidx.webkit is not in this machine's offline Gradle cache.) Anything that is not a plain 200 HTML page,
     * or any failure, returns null and the WebView loads it itself, so load errors still reach onReceivedError.
     */
    private WebResourceResponse withShim(WebResourceRequest req) {
        String scheme = req.getUrl().getScheme();
        if (shim.isEmpty() || !("http".equals(scheme) || "https".equals(scheme))) return null;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(req.getUrl().toString()).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(30000);
            // Not Accept-Encoding: set by hand, HttpURLConnection would hand back undecoded gzip.
            for (Map.Entry<String, String> h : req.getRequestHeaders().entrySet())
                if (!"accept-encoding".equalsIgnoreCase(h.getKey())) c.setRequestProperty(h.getKey(), h.getValue());
            CookieManager cookies = CookieManager.getInstance();
            String url = req.getUrl().toString(), cookie = cookies.getCookie(url);
            if (cookie != null) c.setRequestProperty("Cookie", cookie);
            String type = c.getContentType();
            List<String> setCookies = c.getHeaderFields().get("Set-Cookie");
            if (setCookies != null) for (String sc : setCookies) cookies.setCookie(url, sc);
            if (c.getResponseCode() != 200 || type == null || !type.toLowerCase().startsWith("text/html")) return null;
            String html = new String(readAll(c.getInputStream()), StandardCharsets.UTF_8);
            Matcher m = HEAD.matcher(html);
            String tag = "<script>" + shim + "</script>";
            html = m.find() ? html.substring(0, m.end()) + tag + html.substring(m.end()) : tag + html;
            Map<String, String> headers = new HashMap<>();
            for (Map.Entry<String, List<String>> h : c.getHeaderFields().entrySet()) {
                String k = h.getKey();
                if (k == null || h.getValue().isEmpty()) continue;
                String lk = k.toLowerCase();
                if (lk.equals("content-length") || lk.equals("content-encoding") || lk.equals("transfer-encoding")
                    || lk.equals("content-type") || lk.equals("set-cookie")) continue;
                headers.put(k, h.getValue().get(0));
            }
            Log.i(TAG, "pad shim injected into " + req.getUrl());
            return new WebResourceResponse("text/html", "utf-8", 200, "OK", headers,
                new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            Log.w(TAG, "pad shim skipped for " + req.getUrl() + ": " + e.getMessage());
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /** What the injected shim calls. Runs on the WebView's JavaBridge thread. */
    private final class Bridge {
        @JavascriptInterface public String feed() { return feed; }
        @JavascriptInterface public String pad() { return link.pull(); }
        @JavascriptInterface public void consumed(double q) { link.consumed((long) q); }
    }

    // ---- PadLink.Host ----

    @Override
    public void linkChanged(boolean connected) {
        ui.post(() -> {
            overlay.connected(connected);
            screen = "";
            if (connected) pollScreen();
        });
    }

    @Override
    public void padInput(String line) {
        // The pull feed reads the line itself; only connect/disconnect are pushed so the shim fires its events promptly.
        if ("pull".equals(feed) && !line.isEmpty() && !line.startsWith("-1,")) return;
        ui.post(() -> web.evaluateJavascript("window.__mPad&&__mPad.set('" + line + "')", null));
    }

    @Override
    public void key(String code) {
        ui.post(() -> {
            sendKey("keydown", code, false);
            sendKey("keyup", code, false);
        });
    }

    @Override
    public String debugState() {
        AtomicReference<String> out = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        ui.post(() -> web.evaluateJavascript(
            "(function(){var u=window.__ui&&__ui.snapshot(),a=window.__arena&&__arena.snapshot&&__arena.snapshot(),p=a&&a.player;"
                + "return JSON.stringify({screen:u&&u.screen,focus:u&&u.focus,modality:u&&u.modality,"
                + "buttons:u?u.buttons.map(function(b){return {id:b.id,x:Math.round(b.x+b.w/2),y:Math.round(b.y+b.h/2),off:!!b.disabled}}):[],"
                + "arena:p?{paused:a.paused,mode:a.mode,slot:a.slot,tick:a.state.tick,pos:p.pos,facing:p.facing,absorb:p.absorb,"
                + "rolling:a.state.tick<p.rollUntil,casts:p.metrics.casts,rolls:p.metrics.rolls,stamina:p.stamina,mana:p.mana,"
                + "lastInput:p.lastInput,events:a.state.events.slice(-12).map(function(e){return e.kind+':'+e.actorId+'@'+e.tick})}:null,"
                + "pad:window.__mPad?__mPad.stats():null,"
                + "frameMs:(function(){var f=window.__ui?__ui.performance().frames.slice(-120).sort(function(x,y){return x-y}):[];"
                + "return f.length?{n:f.length,p50:f[f.length>>1],p95:f[Math.floor(f.length*.95)]}:null})(),"
                + "pads:Array.prototype.map.call(navigator.getGamepads(),function(g){return g&&{id:g.id,index:g.index,axes:g.axes,"
                + "pressed:g.buttons.map(function(b,i){return b.pressed?i:-1}).filter(function(i){return i>=0})}})})})()",
            v -> {
                try { out.set((String) new JSONTokener(v).nextValue()); } catch (Exception e) { out.set(null); }
                done.countDown();
            }));
        try { done.await(5, TimeUnit.SECONDS); } catch (InterruptedException ignored) {}
        return out.get();
    }

    /** While a phone is seated, tell it which screen the game shows, so it can switch between arena and menu layouts. */
    private void pollScreen() {
        if (!link.seated()) return;
        web.evaluateJavascript("(function(){var c=document.querySelector('canvas[data-screen]');return c?c.dataset.screen:''})()", v -> {
            String s = v == null ? "" : v.replace("\"", "");
            if (!s.equals(screen)) {
                screen = s;
                link.screen(s);
            }
        });
        ui.postDelayed(this::pollScreen, screenPollMs);
    }

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
        // Menu: a short press is Escape (on release), a long press shows or hides the phone pairing card.
        if (e.getKeyCode() == KeyEvent.KEYCODE_MENU) {
            boolean held = e.getEventTime() - e.getDownTime() >= menuLongPressMs || e.isLongPress();
            if (e.getAction() == KeyEvent.ACTION_DOWN) {
                if (e.getRepeatCount() == 0) menuLong = false;
                else if (!menuLong && held) { menuLong = true; toggleOverlay(); }
            } else if (e.getAction() == KeyEvent.ACTION_UP) {
                if (!menuLong && held) toggleOverlay();
                else if (!menuLong) { sendKey("keydown", code, false); sendKey("keyup", code, false); }
                menuLong = false;
            }
            return true;
        }
        String type = e.getAction() == KeyEvent.ACTION_DOWN ? "keydown" : e.getAction() == KeyEvent.ACTION_UP ? "keyup" : null;
        if (type == null) return true;
        sendKey(type, code, e.getRepeatCount() > 0);
        return true;
    }

    private void toggleOverlay() {
        overlay.toggle();
        Log.i(TAG, "pairing card " + (overlay.expanded() ? "shown" : "hidden") + " (" + link.url() + ")");
    }

    private void sendKey(String type, String code, boolean repeat) {
        web.evaluateJavascript(
            "(function(){var t=document.activeElement||document.body||document;"
                + "t.dispatchEvent(new KeyboardEvent('" + type + "',{key:'" + code + "',code:'" + code + "',repeat:" + repeat
                + ",bubbles:true,cancelable:true}));})()",
            null);
    }

    @Override
    protected void onStart() {
        super.onStart();
        link.start();
        overlay.link(link.url(), link.address() + ":" + link.port, link.pin, link.noNetwork());
    }

    @Override
    protected void onStop() {
        // A backgrounded shell leaves the LAN: the phone sees the seat close and the port is free for whoever is in front.
        link.stop();
        super.onStop();
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
        link.stop();
        web.destroy();
        super.onDestroy();
    }
}
