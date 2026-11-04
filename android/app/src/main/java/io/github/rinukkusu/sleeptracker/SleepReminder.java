package io.github.rinukkusu.sleeptracker;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/** "Nickerchen in ca. 15 Min." shortly before the predicted next sleep. */
final class SleepReminder {
    private static final String CHANNEL = "sleep_reminder";
    private static final int ID = 2;
    private static final long BEFORE_MS = 15 * 60_000L;

    /** Called after every state change: (re)plans the alarm, or cancels it while asleep. */
    static void schedule(Context ctx) {
        SleepState s = SleepState.load(ctx);
        AlarmManager alarms = ctx.getSystemService(AlarmManager.class);
        PendingIntent remind = SleepActionReceiver.pendingIntent(ctx, SleepActionReceiver.ACTION_REMIND);
        alarms.cancel(remind);
        if (s.isRunning() || !s.remind) NotificationManagerCompat.from(ctx).cancel(ID);
        long at = s.nextAt() - BEFORE_MS;
        if (!s.remind || s.nextAt() <= 0 || at <= System.currentTimeMillis()) return;
        // Inexact is fine, a minute or two either way doesn't matter here.
        alarms.setWindow(AlarmManager.RTC_WAKEUP, at, 2 * 60_000L, remind);
    }

    static void show(Context ctx) {
        SleepState s = SleepState.load(ctx);
        long next = s.nextAt();
        // Changed in the meantime (started, or the prediction moved).
        if (!s.remind || next <= 0 || Math.abs(next - BEFORE_MS - System.currentTimeMillis()) > 5 * 60_000L) return;
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        if (!nm.areNotificationsEnabled()) return;
        ensureChannel(ctx);
        boolean bedtime = s.nextIsBedtime();
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_moon)
            .setColor(0xFF6F7DFF)
            .setContentTitle((bedtime ? "🌙 Schlafenszeit" : "☀️ Nickerchen") + " in ca. 15 Min.")
            .setContentText("ca. " + SleepState.time(next) + " · wach seit " + SleepState.time(s.lastWake))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setTimeoutAfter(BEFORE_MS + 30 * 60_000L)
            .setContentIntent(SleepNotifier.openApp(ctx));
        try {
            nm.notify(ID, b.build());
        } catch (SecurityException ignored) {
            // notification permission revoked in the meantime
        }
    }

    private static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Erinnerung vor dem Schlaf", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("15 Minuten vor dem vorhergesagten Nickerchen bzw. der Schlafenszeit");
        ctx.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }
}
