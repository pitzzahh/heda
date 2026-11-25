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
    // Edge-to-edge draws the WebView under the system bars, the notch and the keyboard.
    // Only the keyboard stays padded here; the status bar and the navigation bar
    // go to the page as CSS insets (`#lib/helpers/system-bars.ts`), so its background
    // runs edge to edge and only its content keeps clear.
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val padded = insets.getInsets(WindowInsetsCompat.Type.ime())
      // Not the notch: in landscape it would indent a whole side for a small dip in its
      // middle. In portrait it sits inside the status bar, which is counted.
      val all = insets.getInsets(WindowInsetsCompat.Type.systemBars())
      view.setPadding(padded.left, padded.top, padded.right, padded.bottom)
      val density = resources.displayMetrics.density
      fun css(full: Int, pad: Int) = maxOf(0, full - pad) / density
      safeArea = "{\"top\":${css(all.top, padded.top)},\"right\":${css(all.right, padded.right)}," +
        "\"bottom\":${css(all.bottom, padded.bottom)},\"left\":${css(all.left, padded.left)}}"
      webView?.evaluateJavascript("window.dispatchEvent(new Event('heda-safe-area'))", null)
      WindowInsetsCompat.CONSUMED
    }
  }

  private var webView: WebView? = null

  /** The page's share of the insets in CSS px, as JSON; read through the bridge below. */
  @Volatile private var safeArea = "{\"top\":0,\"right\":0,\"bottom\":0,\"left\":0}"

  override fun onWebViewCreate(webView: WebView) {
    // Only our own bundled page runs in this WebView; see `#lib/helpers/system-bars.ts`.
    this.webView = webView
    webView.addJavascriptInterface(SystemBars(), "HedaSystemBars")
  }

  /** The strip behind the navigation bar follows the in-app theme; the bar icons stay readable. */
  private inner class SystemBars {
    @JavascriptInterface
    fun safeArea(): String = this@MainActivity.safeArea

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
