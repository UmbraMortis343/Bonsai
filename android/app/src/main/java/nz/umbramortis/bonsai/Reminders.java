package nz.umbramortis.bonsai;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

import java.time.LocalTime;
import java.time.ZonedDateTime;

// The morning reminder and the evening nudge, scheduled on this phone (no server). Each fires at the time he set,
// shows a notification only while today's questions are waiting, and sets itself for the next day. A third alarm
// a minute after midnight turns the widget over to the new day. Boot sets them all again after a restart.
public class Reminders extends BroadcastReceiver {
    static final String ACTION = "nz.umbramortis.bonsai.REMIND";
    static final String ACTION_TODAY = "nz.umbramortis.bonsai.TODAY";
    static final String CHANNEL = "today";
    static final int MORNING = 1, EVENING = 2, MIDNIGHT = 3;
    static final int NOTE = 1;   // one notification: the evening's replaces the morning's

    @Override
    public void onReceive(Context c, Intent i) {
        int kind = i.getIntExtra("kind", 0);
        if (kind == MORNING || kind == EVENING) maybeNotify(c, kind);
        TodayWidget.updateAll(c);
        schedule(c);
    }

    static void maybeNotify(Context c, int kind) {
        Store.Day d = Store.day(c);
        if (d.done || d.left == 0) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || !nm.areNotificationsEnabled()) return;
        channel(c);
        String text = d.left < 0 ? null : kind == MORNING ? d.left + (d.left == 1 ? " question" : " questions") : d.left + " left";
        Notification.Builder b = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_notify)
                .setColor(c.getColor(R.color.accent))
                .setContentTitle("Today")
                .setContentIntent(openToday(c))
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER);
        if (text != null) b.setContentText(text);
        if (d.streak > 0) b.setSubText(d.streak + (d.streak == 1 ? " day" : " days"));
        try { nm.notify(NOTE, b.build()); } catch (SecurityException ignored) {}
    }

    static void clear(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(NOTE);
    }

    static void channel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, c.getString(R.string.channel_today), NotificationManager.IMPORTANCE_DEFAULT);
        nm.createNotificationChannel(ch);
    }

    static PendingIntent openToday(Context c) {
        Intent i = new Intent(c, MainActivity.class).setAction(ACTION_TODAY).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 10, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent alarm(Context c, int kind) {
        Intent i = new Intent(c, Reminders.class).setAction(ACTION + "." + kind).putExtra("kind", kind);
        return PendingIntent.getBroadcast(c, kind, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    // The next time the clock reads hh:mm, at least half a minute from now.
    static long next(String hhmm) {
        LocalTime t;
        try { t = LocalTime.parse(hhmm); } catch (Exception e) { t = LocalTime.of(7, 30); }
        ZonedDateTime now = ZonedDateTime.now(), at = now.with(t).withSecond(0).withNano(0);
        if (!at.isAfter(now.plusSeconds(30))) at = at.plusDays(1);
        return at.toInstant().toEpochMilli();
    }

    static void schedule(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        JSONObject r = Store.reminders(c);
        set(am, alarm(c, MORNING), r.optBoolean("morningOn"), next(r.optString("morning", "07:30")));
        set(am, alarm(c, EVENING), r.optBoolean("eveningOn"), next(r.optString("evening", "19:00")));
        PendingIntent mid = alarm(c, MIDNIGHT);
        am.cancel(mid);
        am.setWindow(AlarmManager.RTC, next("00:01"), 15 * 60000L, mid);
    }

    private static void set(AlarmManager am, PendingIntent p, boolean on, long at) {
        am.cancel(p);
        if (!on) return;
        try {
            if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) { am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p); return; }
        } catch (SecurityException ignored) {}
        am.setWindow(AlarmManager.RTC_WAKEUP, at, 10 * 60000L, p);
    }
}
