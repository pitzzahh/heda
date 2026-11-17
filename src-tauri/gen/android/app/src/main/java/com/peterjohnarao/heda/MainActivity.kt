package com.peterjohnarao.heda

import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // Edge-to-edge draws the WebView under the system bars and the keyboard, and
    // neither Tauri nor the WebView pads for them: keep the page inside both.
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or
          WindowInsetsCompat.Type.displayCutout() or
          WindowInsetsCompat.Type.ime()
      )
      view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      WindowInsetsCompat.CONSUMED
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    // Only our own bundled page runs in this WebView; see `#lib/helpers/system-bars.ts`.
    webView.addJavascriptInterface(SystemBars(), "HedaSystemBars")
  }

  /** The padding strips behind the status and navigation bars follow the in-app theme. */
  private inner class SystemBars {
    @JavascriptInterface
    fun set(color: String, dark: Boolean) {
      val parsed = try { Color.parseColor(color) } catch (_: IllegalArgumentException) { return }
      runOnUiThread {
        findViewById<View>(android.R.id.content).setBackgroundColor(parsed)
        WindowCompat.getInsetsController(window, window.decorView).apply {
          isAppearanceLightStatusBars = !dark
          isAppearanceLightNavigationBars = !dark
        }
      }
    }
  }
}
