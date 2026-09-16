package com.maya.ai.agent

import android.view.View

/** UI-thread owned inline task. No rendering output is execution authority. */
interface WorkspaceTask {
    val view: View
    val goal: String
    val reviewRevision: Long
    /** Invalidate a local dialog only, not a running task or approved-plan timer. */
    fun dismissReview()
    val busy: Boolean
    val approved: Boolean
    val executing: Boolean
    val stoppable: Boolean get()=busy || approved
    fun refresh()
    fun stop()
    /** Only an explicitly handed-off native task may keep its service-owned scope outside Maya. */
    fun onHostPause() {stop()}
    fun dispose()
}
