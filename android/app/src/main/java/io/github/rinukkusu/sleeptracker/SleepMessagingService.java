package io.github.rinukkusu.sleeptracker;

import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * FCM data messages from the server (pocketbase/pb_hooks/sleep_push.js) when
 * the other phone started or stopped a sleep: keeps widget and notification
 * current while the app is closed.
 */
public class SleepMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        if (data.get("type") == null) return;
        SleepState.applyRemote(this, data);
    }

    @Override
    public void onNewToken(@NonNull String token) {
        // The web app registers the token with PocketBase on its next start.
    }
}
