package dev.magearena.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import org.json.JSONObject;

import java.util.EnumMap;
import java.util.Map;

/**
 * The pairing card drawn over the WebView: the controller URL as a QR (it carries the PIN), the address and the PIN in
 * text for a phone that cannot scan. Shown at launch until a phone pairs, then shrunk to a corner chip; it returns when
 * the phone leaves, and long-press Menu toggles it. Everything sits inside the safe area and is sized from the screen
 * height so it reads from a sofa at any output resolution. It never takes focus: the remote keeps driving the game.
 */
final class PairingOverlay extends FrameLayout {
    private static final int INK = 0xfff4ead2, MUTED = 0xffb9ad92, GOLD = 0xffe0b860, GREEN = 0xff5fd08a, AMBER = 0xffe8a54a;
    private final JSONObject t;
    private final LinearLayout card;
    private final ImageView qr = new ImageView(getContext());
    private final TextView title, line1, address, line2, pinText, hint, chip;
    private String url = "", lastQr = "";
    private int lastQrSize, sizedW, sizedH;
    private boolean expanded = true, connected;

    PairingOverlay(Context c, JSONObject overlayTuning) {
        super(c);
        t = overlayTuning;
        setClickable(false);
        setFocusable(false);

        card = new LinearLayout(c);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xee0d151b);
        bg.setStroke(3, GOLD);
        card.setBackground(bg);
        qr.setScaleType(ImageView.ScaleType.FIT_CENTER);
        card.addView(qr);
        LinearLayout text = new LinearLayout(c);
        text.setOrientation(LinearLayout.VERTICAL);
        title = label(text, "Play with your phone", INK, true);
        line1 = label(text, "Scan the code, or open", MUTED, false);
        address = label(text, "", INK, true);
        line2 = label(text, "TV code", MUTED, false);
        pinText = label(text, "", GOLD, true);
        pinText.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        hint = label(text, "Same Wi-Fi as the TV. Hold \u2261 Menu to hide.", MUTED, false);
        card.addView(text);
        addView(card, new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.END | Gravity.CENTER_VERTICAL));

        chip = new TextView(c);
        chip.setTextColor(INK);
        chip.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable chipBg = new GradientDrawable();
        chipBg.setColor(0xcc0d151b);
        chipBg.setCornerRadius(999);
        chip.setBackground(chipBg);
        addView(chip, new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.END | Gravity.TOP));
        apply();
    }

    private TextView label(LinearLayout parent, String s, int colour, boolean bold) {
        TextView v = new TextView(getContext());
        v.setText(s);
        v.setTextColor(colour);
        if (bold) v.setTypeface(Typeface.DEFAULT_BOLD);
        parent.addView(v);
        return v;
    }

    /** The link's current address and PIN; [noNetwork] means the TV has no LAN address to offer. */
    void link(String url, String addr, String pin, boolean noNetwork) {
        this.url = url;
        address.setText(noNetwork ? "No Wi-Fi on the TV" : addr);
        pinText.setText(pin);
        lastQr = "";
        requestLayout();
        apply();
    }

    void connected(boolean value) {
        connected = value;
        expanded = !value;
        apply();
    }

    void toggle() {
        expanded = !expanded;
        apply();
    }

    boolean expanded() { return expanded; }

    private void apply() {
        card.setVisibility(expanded ? VISIBLE : GONE);
        chip.setVisibility(expanded ? GONE : VISIBLE);
        chip.setText(connected ? "\u25cf  Phone connected" : "\u25cb  No phone \u00b7 hold \u2261 Menu for the code");
        chip.setTextColor(connected ? GREEN : AMBER);
        // Once connected the words step aside for the game's own corner HUD; the dot stays.
        removeCallbacks(dotOnly);
        if (connected && !expanded) postDelayed(dotOnly, t.optLong("chipTextMs"));
    }

    private final Runnable dotOnly = this::dotOnly;

    private void dotOnly() { if (connected && !expanded) chip.setText("\u25cf"); }

    @Override
    protected void onMeasure(int w, int h) {
        int width = MeasureSpec.getSize(w), height = MeasureSpec.getSize(h);
        if (height > 0 && (width != sizedW || height != sizedH || !url.equals(lastQr))) {
            sizedW = width;
            sizedH = height;
            size(width, height);
        }
        super.onMeasure(w, h);
    }

    private void size(int width, int height) {
        double safe = t.optDouble("safeArea");
        int mx = (int) (width * safe), my = (int) (height * safe);
        setPadding(mx, my, mx, my);
        int qrSize = (int) (height * t.optDouble("qrHeight"));
        int pad = (int) (height * 0.025);
        card.setPadding(pad, pad, pad * 2, pad);
        ((LinearLayout.LayoutParams) qr.getLayoutParams()).width = qrSize;
        ((LinearLayout.LayoutParams) qr.getLayoutParams()).height = qrSize;
        ((LinearLayout.LayoutParams) qr.getLayoutParams()).rightMargin = pad * 2;
        px(title, height * t.optDouble("titleHeight"));
        for (TextView v : new TextView[] {line1, line2, hint}) px(v, height * t.optDouble("textHeight"));
        px(address, height * t.optDouble("titleHeight"));
        px(pinText, height * t.optDouble("pinHeight"));
        ((LinearLayout.LayoutParams) line2.getLayoutParams()).topMargin = pad;
        ((LinearLayout.LayoutParams) hint.getLayoutParams()).topMargin = pad;
        px(chip, height * t.optDouble("chipHeight"));
        chip.setPadding(pad, pad / 2, pad, pad / 2);
        if (!url.isEmpty() && (!url.equals(lastQr) || qrSize != lastQrSize)) {
            lastQr = url;
            lastQrSize = qrSize;
            qr.setImageBitmap(qrBitmap(url, qrSize));
        }
    }

    private static void px(TextView v, double size) { v.setTextSize(TypedValue.COMPLEX_UNIT_PX, (float) size); }

    /** Integer module scaling at the drawn size, so the code stays crisp (ZXing centres it in the square). */
    static Bitmap qrBitmap(String content, int size) {
        try {
            Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
            hints.put(EncodeHintType.MARGIN, 2);
            BitMatrix m = new QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size, hints);
            int[] px = new int[size * size];
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++) px[y * size + x] = m.get(x, y) ? Color.BLACK : Color.WHITE;
            return Bitmap.createBitmap(px, size, size, Bitmap.Config.ARGB_8888);
        } catch (Exception e) {
            return null;
        }
    }
}
