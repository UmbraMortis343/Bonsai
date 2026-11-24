package nz.umbramortis.bonsai;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// After a restart, an update or a change of clock: the reminders again, and the widget on the right day.
public class Boot extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Reminders.schedule(c);
        TodayWidget.updateAll(c);
    }
}
