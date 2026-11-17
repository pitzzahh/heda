package com.peterjohnarao.heda

import android.app.Activity
import android.net.Uri
import android.provider.OpenableColumns
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class DocumentArgs {
  lateinit var uri: String
}

/** What the provider knows about a picked document; see `src-tauri/src/android.rs`. */
@TauriPlugin
class DocumentsPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun documentInfo(invoke: Invoke) {
    val args = invoke.parseArgs(DocumentArgs::class.java)
    val result = JSObject()
    try {
      activity.contentResolver.query(
        Uri.parse(args.uri),
        arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
        null, null, null
      )?.use { cursor ->
        if (cursor.moveToFirst()) {
          val name = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
          val size = cursor.getColumnIndex(OpenableColumns.SIZE)
          if (name >= 0 && !cursor.isNull(name)) result.put("name", cursor.getString(name))
          if (size >= 0 && !cursor.isNull(size)) result.put("size", cursor.getLong(size))
        }
      }
    } catch (_: Exception) {
      // Unknown name and size: the import falls back to the URI and the capped read.
    }
    invoke.resolve(result)
  }
}
