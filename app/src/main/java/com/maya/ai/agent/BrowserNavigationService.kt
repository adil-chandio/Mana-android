package com.maya.ai.agent

import android.accessibilityservice.AccessibilityService
import android.app.*
import android.content.*
import android.net.Uri
import android.os.*
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.maya.ai.MainActivity

/** Explicit native plan only. No JS interface, AI/network, screenshots, node-text dump or persistent grant. */
class BrowserNavigationService: AccessibilityService() {
    companion object {
        @Volatile var instance: BrowserNavigationService?=null;private set
        @Volatile var lastReport="No browser navigation run recorded in this process.";private set
        private const val CHANNEL="maya_reviewed_navigation"
        private const val NOTIFICATION=4201
        fun notificationsReady(context: Context): Boolean {
            if(!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
            val channel=context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL)
            return channel==null || channel.importance!=NotificationManager.IMPORTANCE_NONE
        }
    }
    private val handler=Handler(Looper.getMainLooper())
    private var runId: String?=null
    private var currentPlan: BrowserNavigationPlan?=null
    private var beganElapsed=0L
    private var beganUptime=0L
    private var lastContentEvent=0L
    private val screenOff=object: BroadcastReceiver() {override fun onReceive(context: Context,intent: Intent) {runner.stop()}}
    private val runner: BrowserNavigationRun by lazy {BrowserNavigationRun(object: BrowserNavigationRun.Port {
        override fun available()=instance===this@BrowserNavigationService && notificationsReady(this@BrowserNavigationService) &&
            !(getSystemService(KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked && (getSystemService(POWER_SERVICE) as PowerManager).isInteractive &&
            (runId==null || SystemClock.elapsedRealtime()-beganElapsed in 0 until 60000)
        override fun open(plan: BrowserNavigationPlan): Boolean=try {
            startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(plan.url)).setPackage(plan.browser.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));true
        } catch(_: Exception) {false}
        override fun scroll(down: Boolean): Boolean {
            val plan=currentPlan ?: return false
            val root=rootInActiveWindow ?: return false
            return try {
                val observation=observeRoot(root,false,SystemClock.uptimeMillis())
                if(observation.packageName!=plan.browser.packageName || observation.sensitive || !plan.acceptsAddress(observation.address)) return false
                val candidates=mutableListOf<AccessibilityNodeInfo>();var visited=0
                fun walk(node: AccessibilityNodeInfo,depth: Int) {
                    if(++visited>128 || depth>20 || node.isPassword) return
                    if(node.isVisibleToUser && node.isScrollable) candidates.add(AccessibilityNodeInfo.obtain(node))
                    if(node.childCount>128-visited) {visited=129;return}
                    for(i in 0 until node.childCount) {
                        if(visited>128) break
                        node.getChild(i)?.let {child->try {walk(child,depth+1)} finally {child.recycle()}}
                    }
                }
                try {
                    walk(root,0)
                    if(visited>128 || candidates.size!=1) false
                    else candidates.single().performAction(if(down) AccessibilityNodeInfo.ACTION_SCROLL_FORWARD else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)
                } finally {candidates.forEach {it.recycle()}}
            } catch(_: Exception) {false} finally {root.recycle()}
        }
    },{SystemClock.uptimeMillis()},{delay,action->val r=Runnable {action()};handler.postDelayed(r,delay);val cancel: ()->Unit={handler.removeCallbacks(r)};cancel},{publish()})}
    override fun onServiceConnected() {super.onServiceConnected();instance=this}
    override fun onCreate() {
        super.onCreate()
        ContextCompat.registerReceiver(this,screenOff,IntentFilter(Intent.ACTION_SCREEN_OFF),ContextCompat.RECEIVER_NOT_EXPORTED)
    }
    override fun onDestroy() {
        runner.stop();if(instance===this) instance=null
        runCatching {unregisterReceiver(screenOff)};handler.removeCallbacksAndMessages(null);super.onDestroy()
    }
    override fun onInterrupt() {runner.stop()}
    fun owned(id: String)=runId==id && runner.busy
    fun start(id: String,plan: BrowserNavigationPlan,grant: BrowserNavigationGrant): Boolean {
        check(Looper.myLooper()==Looper.getMainLooper())
        if(runner.busy || !Regex("[a-f0-9]{32}").matches(id)) {grant.revoke();return false}
        val nm=getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL,"Maya reviewed browser tasks",NotificationManager.IMPORTANCE_LOW))
        if(!notificationsReady(this)) {grant.revoke();return false}
        runId=id;currentPlan=plan;beganElapsed=SystemClock.elapsedRealtime();beganUptime=SystemClock.uptimeMillis()
        return runner.start(plan,grant)
    }
    fun stop(id: String) {if(runId==id) runner.stop()}
    private fun publish() {
        if(instance!==this) return
        lastReport=runner.report();val id=runId ?: return
        val open=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val stop=PendingIntent.getBroadcast(this,0,Intent(this,BrowserNavigationStopReceiver::class.java)
            .setData(Uri.parse("maya-navigation://stop/$id")).putExtra("id",id),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification=NotificationCompat.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentTitle(if(runner.busy) "Maya browser task · STOP available" else "Maya browser task · ${runner.state.name}")
            .setContentText("${runner.verified} steps verified · open/scroll only").setContentIntent(open)
            .setOngoing(runner.busy).setAutoCancel(!runner.busy).setOnlyAlertOnce(true)
        if(runner.busy) notification.addAction(0,"STOP",stop)
        runCatching {getSystemService(NotificationManager::class.java).notify(NOTIFICATION,notification.build())}
        if(!runner.busy) currentPlan=null
    }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if(!runner.busy || event==null) return // Never inspect unrelated idle events.
        if(event.eventTime<beganUptime) return
        if(event.eventType==AccessibilityEvent.TYPE_TOUCH_INTERACTION_START) {runner.userTouch();return}
        if(event.eventType==AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            val now=SystemClock.uptimeMillis();if(now-lastContentEvent<200) return;lastContentEvent=now
        }
        val root=runCatching {rootInActiveWindow}.getOrNull() ?: return
        try {
            val observation=observeRoot(root,event.eventType==AccessibilityEvent.TYPE_VIEW_SCROLLED,event.eventTime)
            runner.observe(observation)
        } catch(_: Exception) {runner.stop()} finally {root.recycle()}
    }
    private fun observeRoot(root: AccessibilityNodeInfo,scrolled: Boolean,time: Long): BrowserNavigationRun.Observation {
        val pkg=root.packageName?.toString() ?: ""
        val plan=currentPlan
        if(plan==null || pkg!=plan.browser.packageName) return BrowserNavigationRun.Observation(pkg,null,false,false,time)
        var sensitive=false;var visited=0
        fun scan(node: AccessibilityNodeInfo,depth: Int) {
            if(sensitive || ++visited>128 || depth>20) {sensitive=true;return}
            if(node.isPassword || node.childCount>128-visited) {sensitive=true;return}
            for(i in 0 until node.childCount) {
                if(sensitive) break
                node.getChild(i)?.let {child->try {scan(child,depth+1)} finally {child.recycle()}}
            }
        }
        runCatching {scan(root,0)}.onFailure {sensitive=true}
        if(sensitive) return BrowserNavigationRun.Observation(pkg,null,true,false,time)
        val address=runCatching {
            val bars=root.findAccessibilityNodeInfosByViewId("$pkg:id/url_bar")
            try {if(bars.size!=1 || bars[0].isPassword) null else bars[0].text?.toString()?.takeIf {it.length<=1024}} finally {bars.forEach {it.recycle()}}
        }.getOrNull()
        // Only address-bar routing metadata is read. No document text, input values or screenshots.
        return BrowserNavigationRun.Observation(pkg,address,false,scrolled,time)
    }
}

class BrowserNavigationStopReceiver: BroadcastReceiver() {
    override fun onReceive(context: Context,intent: Intent) {
        val id=intent.getStringExtra("id") ?: return
        if(Regex("[a-f0-9]{32}").matches(id)) BrowserNavigationService.instance?.stop(id)
    }
}
