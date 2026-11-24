package nz.umbramortis.bonsai;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

// The home-screen widget: the streak, and today's state (how many are left in ochre, Done in green). A tap
// opens Today. The page hands it its numbers whenever they change (MainActivity.Bridge.today).
public class TodayWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        m.updateAppWidget(ids, views(c));
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        if (m == null) return;
        int[] ids = m.getAppWidgetIds(new ComponentName(c, TodayWidget.class));
        if (ids != null && ids.length > 0) m.updateAppWidget(ids, views(c));
    }

    static RemoteViews views(Context c) {
        Store.Day d = Store.day(c);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.today_widget);
        v.setTextViewText(R.id.w_streak, String.valueOf(d.streak));
        v.setTextViewText(R.id.w_days, c.getString(d.streak == 1 ? R.string.day : R.string.days));
        v.setViewVisibility(R.id.w_done, d.done ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_wait, !d.done && d.left > 0 ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_none, !d.done && d.left <= 0 ? View.VISIBLE : View.GONE);
        if (d.left > 0) v.setTextViewText(R.id.w_wait, d.left + " left");
        v.setOnClickPendingIntent(R.id.w_root, Reminders.openToday(c));
        return v;
    }
}
