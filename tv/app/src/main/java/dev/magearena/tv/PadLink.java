package dev.magearena.tv;

import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The phone controller's LAN link: serves the controller page from APK assets and holds one WebSocket seat.
 * The phone talks to the TV only; the dev PC's firewall stays closed.
 *
 * Plain java.net with a thread per connection (there are at most a handful), so the shell needs no Kotlin or Ktor.
 * Pairing follows firetv-deathride's RaceServer: a 4-digit PIN made at launch travels in the QR's URL, the phone sends
 * it in its hello, the welcome hands back an opaque token, and a phone that drops and returns with that token gets its
 * seat back even before the old socket has timed out. A second phone is refused with a sentence it can show.
 *
 * Inputs are absolute state ("q,bits,lx,ly,rx,ry"), so a lost or late frame heals with the next one. The page reads the
 * newest line; when the phone stops sending for staleMs the line falls back to neutral, and when the socket closes the
 * seat empties and the synthetic gamepad disconnects.
 */
final class PadLink {
    interface Host {
        /** The seat filled or emptied. Any thread. */
        void linkChanged(boolean connected);
        /** A new input line is ready (push feed). Any thread. */
        void padInput(String line);
        /** The phone pressed a keyboard key (slot 1-4). Any thread. */
        void key(String code);
        /** Debug builds: the page's state as JSON, or null. Called on a link thread; may block. */
        String debugState();
    }

    private static final String TAG = "MageArena";
    private static final String NEUTRAL = ",0,0,0,0,0";
    static final String BAD_PIN = "BAD_PIN", FULL = "FULL";

    final int port;
    final String pin = String.format(Locale.ROOT, "%04d", new SecureRandom().nextInt(10000));
    private final Host host;
    private final byte[] page;
    private final int helloTimeoutMs, socketTimeoutMs, staleMs, maxFrame;
    private final boolean debug;
    private final ExecutorService out = Executors.newSingleThreadExecutor(r -> daemon(r, "pad-out"));

    private volatile ServerSocket server;
    private volatile String address = "127.0.0.1";
    private Session seat;
    private String token = "";
    private final List<Session> open = Collections.synchronizedList(new ArrayList<>());

    /** The page's view of the pad: "" when no phone is seated, else "q,bits,lx,ly,rx,ry". */
    private volatile String line = "";
    private volatile long lastInputNanos;
    private volatile long lastQ = -1;
    private long ackedQ = -1;
    private final long[] receivedAt = new long[256];
    private final long[] receivedQ = new long[256];
    private final double[] ages = new double[1024];
    private int ageCount;
    private long frames, acks;

    PadLink(Host host, JSONObject tuning, byte[] page, boolean debug) {
        this.host = host;
        this.page = page;
        this.debug = debug;
        port = tuning.optInt("port");
        helloTimeoutMs = tuning.optInt("helloTimeoutMs");
        socketTimeoutMs = tuning.optInt("socketTimeoutMs");
        staleMs = tuning.optInt("staleMs");
        maxFrame = tuning.optInt("maxFrameBytes");
        Arrays.fill(receivedQ, -1);
    }

    String url() { return "http://" + address + ":" + port + "/?pin=" + pin; }
    String address() { return address; }
    boolean noNetwork() { return "127.0.0.1".equals(address); }
    synchronized boolean seated() { return seat != null; }

    void start() {
        if (server != null) return;
        address = lanAddress();
        try {
            ServerSocket s = new ServerSocket();
            s.setReuseAddress(true);
            s.bind(new InetSocketAddress("0.0.0.0", port));
            server = s;
        } catch (IOException e) {
            Log.e(TAG, "controller port " + port + " unavailable: " + e.getMessage());
            return;
        }
        Log.i(TAG, "controller " + url());
        final ServerSocket s = server;
        daemon(() -> {
            while (!s.isClosed()) {
                try {
                    Socket c = s.accept();
                    daemon(() -> serve(c), "pad-conn").start();
                } catch (IOException e) {
                    if (!s.isClosed()) Log.w(TAG, "controller accept: " + e.getMessage());
                }
            }
        }, "pad-accept").start();
        daemon(() -> watch(s), "pad-watch").start();
    }

    void stop() {
        ServerSocket s = server;
        server = null;
        if (s != null) try { s.close(); } catch (IOException ignored) {}
        synchronized (open) { for (Session x : new ArrayList<>(open)) x.close(); }
    }

    // ---- what the page reads ----

    /** Pull feed: the newest line; a line read for the first time counts as consumed and is acked to the phone. */
    String pull() {
        String l = line;
        if (!l.isEmpty()) consumed(lastQ);
        return l;
    }

    /** The page handed this input to the game (push feed reports it; pull counts it in [pull]). */
    void consumed(long q) {
        Session s;
        synchronized (this) {
            if (q <= ackedQ || q < 0) return;
            ackedQ = q;
            acks++;
            int i = (int) (q & 255);
            if (receivedQ[i] == q) ages[ageCount++ % ages.length] = (System.nanoTime() - receivedAt[i]) / 1e6;
            s = seat;
        }
        if (s != null) send(s, "{\"t\":\"ack\",\"q\":" + q + "}");
    }

    void screen(String name) {
        Session s;
        synchronized (this) { s = seat; }
        if (s != null) send(s, "{\"t\":\"screen\",\"s\":" + JSONObject.quote(name) + "}");
    }

    synchronized String stats(boolean reset) {
        double[] a = Arrays.copyOf(ages, Math.min(ageCount, ages.length));
        Arrays.sort(a);
        String json = "{\"frames\":" + frames + ",\"acks\":" + acks + ",\"ageMs\":{\"n\":" + a.length
            + ",\"p50\":" + pct(a, 0.5) + ",\"p95\":" + pct(a, 0.95) + ",\"max\":" + pct(a, 1) + "},\"seated\":" + (seat != null) + "}";
        if (reset) { ageCount = 0; frames = 0; acks = 0; }
        return json;
    }

    private static double pct(double[] sorted, double p) {
        if (sorted.length == 0) return 0;
        return Math.round(sorted[Math.min(sorted.length - 1, (int) Math.floor(p * (sorted.length - 1) + 0.5))] * 100) / 100.0;
    }

    /** A phone that stops sending (radio sleep, frozen tab) must not hold a stick or a button down. */
    private void watch(ServerSocket s) {
        while (server == s) {
            try { Thread.sleep(100); } catch (InterruptedException e) { return; }
            String l = line;
            if (!l.isEmpty() && !l.endsWith(NEUTRAL) && System.nanoTime() - lastInputNanos > staleMs * 1_000_000L) {
                synchronized (this) {
                    if (seat == null) continue;
                    line = lastQ + NEUTRAL;
                }
                Log.i(TAG, "controller input stale; released");
                host.padInput(line);
            }
        }
    }

    // ---- connections ----

    private void serve(Socket c) {
        try {
            c.setTcpNoDelay(true);
            c.setSoTimeout(helloTimeoutMs);
            InputStream in = c.getInputStream();
            OutputStream o = c.getOutputStream();
            Map<String, String> h = new HashMap<>();
            String target = readRequest(in, h);
            if (target == null) return;
            String path = target.contains("?") ? target.substring(0, target.indexOf('?')) : target;
            String query = target.contains("?") ? target.substring(target.indexOf('?') + 1) : "";
            if ("/ws".equals(path) && "websocket".equalsIgnoreCase(h.get("upgrade"))) {
                // Any page a phone has open can try this socket; only the controller's own page (or a client that sends no
                // Origin, which is not a browser) reaches pairing (deathride's rule).
                String origin = h.get("origin");
                if (origin != null && !origin.substring(origin.indexOf("://") + 3).equalsIgnoreCase(h.get("host"))) {
                    respond(o, 403, "text/plain", "origin".getBytes(StandardCharsets.UTF_8));
                    return;
                }
                upgrade(c, in, o, h.get("sec-websocket-key"));
            } else if ("/".equals(path) || "/index.html".equals(path)) {
                respond(o, 200, "text/html; charset=utf-8", page);
            } else if (debug && "/debug/state".equals(path) && query.contains("pin=" + pin)) {
                String state = host.debugState();
                String body = "{\"page\":" + (state == null ? "null" : state) + ",\"link\":" + stats(query.contains("reset=1")) + "}";
                respond(o, 200, "application/json", body.getBytes(StandardCharsets.UTF_8));
            } else {
                respond(o, 404, "text/plain", "not here".getBytes(StandardCharsets.UTF_8));
            }
        } catch (IOException ignored) {
        } finally {
            try { c.close(); } catch (IOException ignored) {}
        }
    }

    private static String readRequest(InputStream in, Map<String, String> headers) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int state = 0;
        while (state < 4) {
            int x = in.read();
            if (x < 0 || b.size() > 8192) return null;
            b.write(x);
            state = (x == '\r' && (state == 0 || state == 2)) || (x == '\n' && (state == 1 || state == 3)) ? state + 1 : 0;
        }
        String[] lines = b.toString("ISO-8859-1").split("\r\n");
        String[] first = lines[0].split(" ");
        if (first.length < 3 || !"GET".equals(first[0])) return null;
        for (int i = 1; i < lines.length; i++) {
            int colon = lines[i].indexOf(':');
            if (colon > 0) headers.put(lines[i].substring(0, colon).trim().toLowerCase(Locale.ROOT), lines[i].substring(colon + 1).trim());
        }
        return first[1];
    }

    private static void respond(OutputStream o, int status, String type, byte[] body) throws IOException {
        String head = "HTTP/1.1 " + status + (status == 200 ? " OK" : status == 403 ? " Forbidden" : " Not Found")
            + "\r\nContent-Type: " + type + "\r\nContent-Length: " + body.length
            + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
        o.write(head.getBytes(StandardCharsets.ISO_8859_1));
        o.write(body);
        o.flush();
    }

    private void upgrade(Socket c, InputStream in, OutputStream o, String key) throws IOException {
        if (key == null) return;
        String accept;
        try {
            accept = Base64.encodeToString(MessageDigest.getInstance("SHA-1").digest(
                (key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").getBytes(StandardCharsets.ISO_8859_1)), Base64.NO_WRAP);
        } catch (Exception e) { return; }
        o.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "
            + accept + "\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));
        o.flush();
        Session s = new Session(c, in, o);
        open.add(s);
        try { session(s); } finally { open.remove(s); s.close(); leave(s); }
    }

    private void session(Session s) throws IOException {
        JSONObject hello = json(s.read());
        if (hello == null || !"hello".equals(hello.optString("t"))) return;
        String refusal = claim(s, hello.optString("pin"), hello.optString("token"));
        if (refusal != null) {
            String message = BAD_PIN.equals(refusal) ? "Wrong TV code. Check the code on the TV."
                : "Another phone is already playing. When it leaves, tap Retry.";
            Log.i(TAG, "controller refused " + refusal);
            s.write("{\"t\":\"error\",\"code\":\"" + refusal + "\",\"message\":\"" + message + "\"}");
            s.closeFrame(1008, refusal);
            return;
        }
        s.socket.setSoTimeout(socketTimeoutMs);
        long sessionQ = -1;
        while (true) {
            String text;
            try { text = s.read(); } catch (SocketTimeoutException e) { Log.i(TAG, "controller silent; dropped"); return; }
            if (text == null) return;
            JSONObject m = json(text);
            if (m == null) continue;
            switch (m.optString("t")) {
                case "i": {
                    long q = m.optLong("q", -1);
                    JSONArray x = m.optJSONArray("x");
                    if (q <= sessionQ || x == null || x.length() != 4) break;
                    sessionQ = q;
                    StringBuilder l = new StringBuilder(48).append(q).append(',').append(m.optInt("b") & 0x1ffff);
                    for (int i = 0; i < 4; i++) {
                        double v = x.optDouble(i, 0);
                        long milli = Double.isNaN(v) ? 0 : Math.round(Math.max(-1, Math.min(1, v)) * 1000);
                        l.append(',');
                        if (milli == 0) l.append('0');
                        else l.append(milli / 1000.0);
                    }
                    synchronized (this) {
                        if (seat != s) return;
                        int i = (int) (q & 255);
                        receivedQ[i] = q;
                        receivedAt[i] = System.nanoTime();
                        lastInputNanos = receivedAt[i];
                        lastQ = q;
                        line = l.toString();
                        frames++;
                    }
                    host.padInput(line);
                    break;
                }
                case "key": {
                    String code = m.optString("code");
                    if (code.matches("Digit[1-4]")) host.key(code);
                    break;
                }
                case "ping":
                    send(s, "{\"t\":\"pong\",\"ts\":" + m.optDouble("ts", 0) + "}");
                    break;
                default:
                    break;
            }
        }
    }

    /** Null when seated, else why not. A returning token takes its seat back from a socket that has not timed out yet. */
    private String claim(Session s, String givenPin, String givenToken) {
        Session replaced = null;
        boolean fresh;
        synchronized (this) {
            boolean returning = !givenToken.isEmpty() && givenToken.equals(token);
            if (!returning && !pin.equals(givenPin)) return BAD_PIN;
            if (!returning && seat != null) return FULL;
            replaced = seat;
            fresh = seat == null;
            seat = s;
            if (!returning) token = UUID.randomUUID().toString();
            lastQ = -1;
            ackedQ = -1;
            Arrays.fill(receivedQ, -1);
            lastInputNanos = System.nanoTime();
            line = -1 + NEUTRAL;
        }
        if (replaced != null) replaced.close();
        try { s.write("{\"t\":\"welcome\",\"token\":\"" + token + "\"}"); } catch (IOException ignored) {}
        Log.i(TAG, "controller paired" + (fresh ? "" : " (replaced a stale socket)"));
        if (fresh) host.linkChanged(true);
        host.padInput(line);
        return null;
    }

    private void leave(Session s) {
        synchronized (this) {
            if (seat != s) return;
            seat = null;
            line = "";
        }
        Log.i(TAG, "controller left; inputs released");
        host.padInput("");
        host.linkChanged(false);
    }

    private void send(Session s, String text) {
        out.execute(() -> { try { s.write(text); } catch (IOException e) { s.close(); } });
    }

    private static JSONObject json(String text) {
        if (text == null) return null;
        try { return new JSONObject(text); } catch (Exception e) { return null; }
    }

    private static Thread daemon(Runnable r, String name) {
        Thread t = new Thread(r, name);
        t.setDaemon(true);
        return t;
    }

    /** The Wi-Fi address the phone can reach (deathride's rule: an up, non-loopback, site-local IPv4). */
    static String lanAddress() {
        try {
            List<InetAddress> found = new ArrayList<>();
            for (NetworkInterface n : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!n.isUp() || n.isLoopback()) continue;
                for (InetAddress a : Collections.list(n.getInetAddresses()))
                    if (a instanceof Inet4Address && !a.isLoopbackAddress() && !a.isLinkLocalAddress()) found.add(a);
            }
            for (InetAddress a : found) if (a.isSiteLocalAddress()) return a.getHostAddress();
            if (!found.isEmpty()) return found.get(0).getHostAddress();
        } catch (Exception ignored) {}
        return "127.0.0.1";
    }

    /** One RFC 6455 server endpoint: masked client frames in, unmasked frames out, no extensions. */
    private final class Session {
        final Socket socket;
        private final InputStream in;
        private final OutputStream o;

        Session(Socket socket, InputStream in, OutputStream o) { this.socket = socket; this.in = in; this.o = o; }

        /** The next text message, or null when the phone closed. */
        String read() throws IOException {
            ByteArrayOutputStream message = new ByteArrayOutputStream();
            while (true) {
                int b0 = in.read(), b1 = in.read();
                if (b0 < 0 || b1 < 0) return null;
                int op = b0 & 0x0f;
                long len = b1 & 0x7f;
                if (len == 126) len = (byte1() << 8) | byte1();
                else if (len == 127) { len = 0; for (int i = 0; i < 8; i++) len = (len << 8) | byte1(); }
                if ((b1 & 0x80) == 0 || len > maxFrame || message.size() + len > maxFrame) return null;
                byte[] mask = exactly(4), data = exactly((int) len);
                for (int i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
                if (op == 8) { closeFrame(1000, ""); return null; }
                if (op == 9) { frame(10, data); continue; }
                if (op == 10) continue;
                message.write(data, 0, data.length);
                if ((b0 & 0x80) != 0) {
                    if (op == 2) { message.reset(); continue; }
                    return message.toString("UTF-8");
                }
            }
        }

        private int byte1() throws IOException {
            int x = in.read();
            if (x < 0) throw new IOException("eof");
            return x;
        }

        private byte[] exactly(int n) throws IOException {
            byte[] b = new byte[n];
            for (int got = 0; got < n; ) {
                int r = in.read(b, got, n - got);
                if (r < 0) throw new IOException("eof");
                got += r;
            }
            return b;
        }

        void write(String text) throws IOException { frame(1, text.getBytes(StandardCharsets.UTF_8)); }

        void closeFrame(int code, String reason) {
            byte[] r = reason.getBytes(StandardCharsets.UTF_8), p = new byte[2 + r.length];
            p[0] = (byte) (code >> 8);
            p[1] = (byte) code;
            System.arraycopy(r, 0, p, 2, r.length);
            try { frame(8, p); } catch (IOException ignored) {}
        }

        synchronized void frame(int op, byte[] payload) throws IOException {
            int n = payload.length, head = n < 126 ? 2 : n < 65536 ? 4 : 10;
            byte[] f = new byte[head + n];
            f[0] = (byte) (0x80 | op);
            if (n < 126) f[1] = (byte) n;
            else if (n < 65536) { f[1] = 126; f[2] = (byte) (n >> 8); f[3] = (byte) n; }
            else { f[1] = 127; for (int i = 0; i < 8; i++) f[2 + i] = (byte) ((long) n >> (56 - 8 * i)); }
            System.arraycopy(payload, 0, f, head, n);
            o.write(f);
            o.flush();
        }

        void close() { try { socket.close(); } catch (IOException ignored) {} }
    }
}
