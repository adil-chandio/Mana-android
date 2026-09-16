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

/** Explicit native plan only: OPEN one wa.me chat, TYPE reviewed text once. No SEND, click, gesture or chat read. */
class WhatsAppTypeService: AccessibilityService() {
    companion object {
        @Volatile var instance: WhatsAppTypeService?=null;private set
        @Volatile var lastReport="No WhatsApp type run recorded in this process.";private set
        private const val CHANNEL="maya_reviewed_whatsapp"
        private const val NOTIFICATION=4202
        fun notificationsReady(context: Context): Boolean {
            if(!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
            val channel=context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL)
            return channel==null || channel.importance!=NotificationManager.IMPORTANCE_NONE
        }
    }
    private val handler=Handler(Looper.getMainLooper())
    private var runId: String?=null
    private var currentPlan: WhatsAppTypePlan?=null
    private var beganElapsed=0L
    private var beganUptime=0L
    private var lastContentEvent=0L
    private val screenOff=object: BroadcastReceiver() {override fun onReceive(context: Context,intent: Intent) {runner.stop()}}
    private val runner: WhatsAppTypeRun by lazy {WhatsAppTypeRun(object: WhatsAppTypeRun.Port {
        override fun available()=instance===this@WhatsAppTypeService && notificationsReady(this@WhatsAppTypeService) &&
            !(getSystemService(KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked && (getSystemService(POWER_SERVICE) as PowerManager).isInteractive &&
            (runId==null || SystemClock.elapsedRealtime()-beganElapsed in 0 until 60000)
        override fun open(plan: WhatsAppTypePlan): Boolean=try {
            startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(plan.url)).setPackage(WhatsAppTypePlan.PACKAGE).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));true
        } catch(_: Exception) {false}
        override fun type(payload: String): Boolean {
            currentPlan ?: return false
            val root=rootInActiveWindow ?: return false
            return try {
                val observation=observeRoot(root,false,SystemClock.uptimeMillis())
                if(observation.packageName!=WhatsAppTypePlan.PACKAGE || observation.sensitive) return false
                val candidates=mutableListOf<AccessibilityNodeInfo>();var visited=0;var passwordSeen=false
                fun walk(node: AccessibilityNodeInfo,depth: Int) {
                    if(++visited>128 || depth>20) return
                    if(node.isPassword) {passwordSeen=true;return}
                    if(node.isVisibleToUser && node.isEditable && node.className?.toString()?.endsWith("EditText")==true)
                        candidates.add(AccessibilityNodeInfo.obtain(node))
                    if(node.childCount>128-visited) {visited=129;return}
                    for(i in 0 until node.childCount) {
                        if(visited>128) break
                        node.getChild(i)?.let {child->try {walk(child,depth+1)} finally {child.recycle()}}
                    }
                }
                try {
                    walk(root,0)
                    if(passwordSeen || visited>128 || candidates.size!=1) false
                    else {
                        val target=candidates.single()
                        // Never overwrite an existing user draft. Emptiness is checked transiently:
                        // the content is never stored, logged, returned or uploaded.
                        if(!target.text.isNullOrEmpty()) false
                        else target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,
                            Bundle().apply {putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,payload)})
                    }
                } finally {candidates.forEach {it.recycle()}}
            } catch(_: Exception) {false} finally {root.recycle()}
        }
    },{SystemClock.uptimeMillis()},{delay,action->val r=Runnable {action()};handler.postDelayed(r,delay);val cancel: ()->Unit={handler.removeCallbacks(r)};cancel},{publish()})}
    override fun onServiceConnected() {super.onServiceConnected();instance=this}
    override fun onCreate() {
        super.onCreate()
        // Same platform-level registration as the browser service: Robolectric does not
        // shadow the 5-arg framework call below API 33, and the flag is required above.
        val filter=IntentFilter(Intent.ACTION_SCREEN_OFF)
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.TIRAMISU)
            ContextCompat.registerReceiver(this,screenOff,filter,ContextCompat.RECEIVER_NOT_EXPORTED)
        else registerReceiver(screenOff,filter)
    }
    override fun onDestroy() {
        runner.stop();if(instance===this) instance=null
        runCatching {unregisterReceiver(screenOff)};handler.removeCallbacksAndMessages(null);super.onDestroy()
    }
    override fun onInterrupt() {runner.stop()}
    fun owned(id: String)=runId==id && runner.busy
    fun start(id: String,plan: WhatsAppTypePlan,grant: WhatsAppTypeGrant): Boolean {
        check(Looper.myLooper()==Looper.getMainLooper())
        if(runner.busy || !Regex("[a-f0-9]{32}").matches(id)) {grant.revoke();return false}
        val nm=getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL,"Maya reviewed WhatsApp tasks",NotificationManager.IMPORTANCE_LOW))
        if(!notificationsReady(this)) {grant.revoke();return false}
        runId=id;currentPlan=plan;beganElapsed=SystemClock.elapsedRealtime();beganUptime=SystemClock.uptimeMillis()
        return runner.start(plan,grant)
    }
    fun stop(id: String) {if(runId==id) runner.stop()}
    private fun publish() {
        if(instance!==this) return
        lastReport=runner.report();val id=runId ?: return
        val open=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val stop=PendingIntent.getBroadcast(this,0,Intent(this,WhatsAppTypeStopReceiver::class.java)
            .setData(Uri.parse("maya-whatsapp://stop/$id")).putExtra("id",id),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification=NotificationCompat.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentTitle(if(runner.busy) "Maya WhatsApp task · STOP available" else "Maya WhatsApp task · ${runner.state.name}")
            .setContentText("open/type once · you press SEND").setContentIntent(open)
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
            val observation=observeRoot(root,event.eventType==AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,event.eventTime)
            runner.observe(observation)
        } catch(_: Exception) {runner.stop()} finally {root.recycle()}
    }
    private fun observeRoot(root: AccessibilityNodeInfo,typed: Boolean,time: Long): WhatsAppTypeRun.Observation {
        val pkg=root.packageName?.toString() ?: ""
        if(pkg!=WhatsAppTypePlan.PACKAGE) return WhatsAppTypeRun.Observation(pkg,false,false,time)
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
        // Only package routing and structural flags are observed. No chat text, contact names or screenshots.
        return WhatsAppTypeRun.Observation(pkg,sensitive,typed && !sensitive,time)
    }
}

class WhatsAppTypeStopReceiver: BroadcastReceiver() {
    override fun onReceive(context: Context,intent: Intent) {
        val id=intent.getStringExtra("id") ?: return
        if(Regex("[a-f0-9]{32}").matches(id)) WhatsAppTypeService.instance?.stop(id)
    }
}
