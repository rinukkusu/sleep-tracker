package io.github.rinukkusu.sleeptracker;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SleepPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
