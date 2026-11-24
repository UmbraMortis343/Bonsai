package nz.umbramortis.bonsai;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.time.LocalDate;

// What the phone keeps outside the page: the reminder times and today's state as the page last reported it
// ({ day, streak, left, done, n, next: { day, left, streak } }). Reminders and the widget read it when the page
// isn't open; `next` is what tomorrow looks like if nothing more is done today.
final class Store {
    private Store() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("bonsai", Context.MODE_PRIVATE); }

    static JSONObject read(Context c, String key) {
        try { String s = prefs(c).getString(key, null); return s == null ? new JSONObject() : new JSONObject(s); }
        catch (Exception e) { return new JSONObject(); }
    }

    static void write(Context c, String key, JSONObject o) { prefs(c).edit().putString(key, o.toString()).apply(); }

    // "YYYY-MM-DD" on this phone's clock, as the page writes days (sunday.js dayOf)
    static String todayKey() { return LocalDate.now().toString(); }

    static JSONObject reminders(Context c) {
        JSONObject r = read(c, "reminders");
        try {
            if (!r.has("morningOn")) r.put("morningOn", false);
            if (!r.has("morning")) r.put("morning", "07:30");
            if (!r.has("eveningOn")) r.put("eveningOn", false);
            if (!r.has("evening")) r.put("evening", "19:00");
        } catch (Exception ignored) {}
        return r;
    }

    static final class Day {
        int streak;
        int left = -1;   // -1: not known (the page hasn't been opened for a while)
        boolean done;
    }

    static Day day(Context c) {
        JSONObject t = read(c, "today");
        String key = todayKey();
        Day d = new Day();
        JSONObject next = t.optJSONObject("next");
        if (key.equals(t.optString("day"))) {
            d.streak = t.optInt("streak");
            d.left = t.optInt("left", -1);
            d.done = t.optBoolean("done");
        } else if (next != null && key.equals(next.optString("day"))) {
            d.streak = next.optInt("streak");
            d.left = next.optInt("left", -1);
        } else if (next != null) {
            d.streak = 0;
        }
        return d;
    }
}
