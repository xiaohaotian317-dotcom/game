package com.xiaohaotian.arcaneduel;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.ImageView;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends BridgeActivity {
    private ImageView launchCover;
    private boolean launchFinished;
    private final Runnable launchFallback = () -> finishLaunch();

    @Override public void onCreate(Bundle savedInstanceState) {
        // The OS owns the short launch transition. The first app frame uses the
        // original landscape, not a square icon stretched across the screen.
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setOnExitAnimationListener(provider -> provider.remove());
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override public void onPageLoaded(WebView view) {
                view.postVisualStateCallback(0, new WebView.VisualStateCallback() {
                    @Override public void onComplete(long requestId) { finishLaunch(); }
                });
            }
        });
        registerPlugin(ArcaneBridgePlugin.class);
        registerPlugin(TapBattlePlugin.class);
        registerPlugin(TapLeaderboardPlugin.class);
        registerPlugin(AdsPlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge != null && !launchFinished) {
            launchCover = new ImageView(this);
            launchCover.setImageResource(R.drawable.realm_launch);
            launchCover.setScaleType(ImageView.ScaleType.CENTER_CROP);
            launchCover.setBackgroundColor(0xff07121c);
            launchCover.setContentDescription("正在载入秘境");
            addContentView(launchCover, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            // A broken local page must still expose WebView's recovery screen.
            launchCover.postDelayed(launchFallback, 15000);
        }
        android.webkit.WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams p = getWindow().getAttributes();
            p.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(p);
        }
        immersive();
    }
    private void finishLaunch() {
        launchFinished = true;
        if (launchCover == null) return;
        launchCover.removeCallbacks(launchFallback);
        ViewGroup parent = (ViewGroup) launchCover.getParent();
        if (parent != null) parent.removeView(launchCover);
        launchCover.setImageDrawable(null);
        launchCover = null;
    }
    @Override public void onDestroy() { finishLaunch(); super.onDestroy(); }
    private void immersive() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
    @Override public void onWindowFocusChanged(boolean hasFocus) { super.onWindowFocusChanged(hasFocus); if (hasFocus) immersive(); }
}
