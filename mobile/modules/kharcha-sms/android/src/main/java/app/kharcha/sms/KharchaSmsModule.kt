package app.kharcha.sms

import android.Manifest
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads bank/UPI/wallet alerts from the SMS inbox. Filtering happens here, so
 * personal messages never cross into JavaScript: a message is returned only if
 * its DLT header is on the finance allowlist, or it looks like a transaction
 * alert (an amount plus a debit/credit keyword).
 */
class KharchaSmsModule : Module() {
  private val amount = Regex("""(?i)(rs\.?|inr|₹)\s?[\d,]+""")
  private val keyword = Regex("""(?i)\b(debited|credited|spent|paid|sent|received|withdrawn|txn|transaction|upi|refund)\b""")

  override fun definition() = ModuleDefinition {
    Name("KharchaSms")

    Function("isAvailable") { true }

    Function("hasNotificationAccess") {
      val context = appContext.reactContext ?: return@Function false
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: ""
      val me = ComponentName(context, KharchaNotificationListener::class.java).flattenToString()
      enabled.split(':').any { it == me }
    }

    Function("openNotificationAccessSettings") {
      val activity = appContext.currentActivity ?: return@Function false
      activity.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
      true
    }

    AsyncFunction("readNotifications") { sinceMs: Double, limit: Int ->
      val context = appContext.reactContext
        ?: throw CodedException("ERR_NO_CONTEXT", "React context is not available", null)
      KharchaNotificationListener.readSince(context, sinceMs, limit)
    }

    Function("clearNotifications") {
      appContext.reactContext?.let { KharchaNotificationListener.clear(it) }
      true
    }

    AsyncFunction("readInbox") { sinceMs: Double, limit: Int, senders: List<String> ->
      val context = appContext.reactContext
        ?: throw CodedException("ERR_NO_CONTEXT", "React context is not available", null)
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
        throw CodedException("ERR_SMS_PERMISSION", "READ_SMS permission has not been granted", null)
      }
      val allow = senders.map { it.uppercase() }.toHashSet()
      val out = ArrayList<Map<String, Any>>()
      context.contentResolver.query(
        Uri.parse("content://sms/inbox"),
        arrayOf("_id", "address", "body", "date"),
        "date > ?",
        arrayOf(sinceMs.toLong().toString()),
        "date ASC"
      )?.use { c ->
        val idCol = c.getColumnIndexOrThrow("_id")
        val addressCol = c.getColumnIndexOrThrow("address")
        val bodyCol = c.getColumnIndexOrThrow("body")
        val dateCol = c.getColumnIndexOrThrow("date")
        while (c.moveToNext() && out.size < limit) {
          val address = c.getString(addressCol) ?: continue
          val body = c.getString(bodyCol) ?: continue
          if (!isFinance(address, body, allow)) continue
          out.add(
            mapOf(
              "id" to c.getString(idCol),
              "address" to address,
              "body" to body,
              "date" to c.getLong(dateCol).toDouble()
            )
          )
        }
      }
      out
    }
  }

  private fun isFinance(address: String, body: String, allow: Set<String>): Boolean {
    // Personal numbers (+91…, 10 digits) are never finance senders.
    if (address.count { it.isDigit() } >= 10) return false
    val parts = address.uppercase().split('-')
    val header = if (parts.size >= 2 && parts[0].length == 2) parts[1] else parts[0]
    if (header in allow) return true
    return amount.containsMatchIn(body) && keyword.containsMatchIn(body)
  }
}
