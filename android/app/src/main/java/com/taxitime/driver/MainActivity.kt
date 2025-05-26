package com.taxitime.driver
import android.Manifest
import android.os.Bundle
import android.os.Build

import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.core.app.ActivityCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    companion object {
    private const val LOCATION_PERMISSION_REQUEST_CODE = 1001
  }
  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "TaxiTimeVersiontwo"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

   override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestLocationPermissions()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "RN_BACKGROUND_ACTIONS_CHANNEL",  // <-- MUST match JS `notificationChannelId`
                "Background Task",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            

            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
  }
     private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "background-task-channel", // This ID must match JS side
                "Background Task Channel",
                NotificationManager.IMPORTANCE_LOW
            )

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
        }
    }

    
  private fun requestLocationPermissions() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ActivityCompat.requestPermissions(
        this,
        arrayOf(
          Manifest.permission.ACCESS_FINE_LOCATION,
          Manifest.permission.ACCESS_BACKGROUND_LOCATION
        ),
        LOCATION_PERMISSION_REQUEST_CODE
      )
    } else {
      ActivityCompat.requestPermissions(
        this,
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION),
        LOCATION_PERMISSION_REQUEST_CODE
      )
    }
  }


}
