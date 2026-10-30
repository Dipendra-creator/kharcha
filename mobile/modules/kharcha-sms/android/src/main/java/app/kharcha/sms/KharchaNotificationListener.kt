package app.kharcha.sms

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Play Store fallback for READ_SMS: when the user grants notification access,
 * payment notifications from SMS, bank and UPI apps are captured here. Only
 * notifications that look like transactions are kept, in a small capped file
 * inside the app's private storage; JavaScript reads them on the next sync.
 */
class KharchaNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))
      ?.toString() ?: return
    if (!looksLikePayment(sbn.packageName, text)) return
    append(applicationContext, JSONObject().apply {
      put("id", "${sbn.packageName}:${sbn.postTime}:${text.hashCode()}")
      put("address", if (sbn.packageName in SMS_APPS) title else sbn.packageName)
      put("body", text)
      put("date", sbn.postTime.toDouble())
    })
  }

  companion object {
    private const val FILE = "kharcha-payment-notifications.json"
    private const val MAX = 500

    private val SMS_APPS = setOf(
      "com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms",
      "com.miui.mms", "com.oneplus.mms", "com.truecaller"
    )
    private val PAYMENT_APPS = setOf(
      "com.phonepe.app", "com.google.android.apps.nbu.paisa.user", "net.one97.paytm", "in.org.npci.upiapp",
      "in.amazon.mShop.android.shopping", "com.mobikwik_new", "com.freecharge.android", "com.dreamplug.androidapp",
      "com.snapwork.hdfc", "com.csam.icici.bank.imobile", "com.sbi.lotusintouch", "com.axis.mobile",
      "com.msf.kbank.mobile", "com.idfcfirstbank.optimus", "com.fi.money", "money.jupiter", "com.sliceit.app"
    )
    private val amount = Regex("""(?i)(rs\.?|inr|₹)\s?[\d,]+""")
    private val keyword = Regex("""(?i)\b(debited|credited|spent|paid|sent|received|withdrawn|txn|transaction|refund)\b""")
    private val otp = Regex("""(?i)\b(otp|one[- ]time password|verification code)\b""")

    fun looksLikePayment(pkg: String, text: String): Boolean {
      if (pkg !in SMS_APPS && pkg !in PAYMENT_APPS) return false
      if (otp.containsMatchIn(text)) return false
      return amount.containsMatchIn(text) && keyword.containsMatchIn(text)
    }

    @Synchronized
    fun append(context: Context, entry: JSONObject) {
      val file = File(context.filesDir, FILE)
      val arr = if (file.exists()) runCatching { JSONArray(file.readText()) }.getOrElse { JSONArray() } else JSONArray()
      arr.put(entry)
      val start = maxOf(0, arr.length() - MAX)
      val trimmed = JSONArray()
      for (i in start until arr.length()) trimmed.put(arr.get(i))
      file.writeText(trimmed.toString())
    }

    @Synchronized
    fun readSince(context: Context, sinceMs: Double, limit: Int): List<Map<String, Any>> {
      val file = File(context.filesDir, FILE)
      if (!file.exists()) return emptyList()
      val arr = runCatching { JSONArray(file.readText()) }.getOrElse { return emptyList() }
      val out = ArrayList<Map<String, Any>>()
      for (i in 0 until arr.length()) {
        val o = arr.getJSONObject(i)
        if (o.getDouble("date") <= sinceMs) continue
        out.add(mapOf("id" to o.getString("id"), "address" to o.getString("address"), "body" to o.getString("body"), "date" to o.getDouble("date")))
        if (out.size >= limit) break
      }
      return out
    }

    @Synchronized
    fun clear(context: Context) {
      File(context.filesDir, FILE).delete()
    }
  }
}
