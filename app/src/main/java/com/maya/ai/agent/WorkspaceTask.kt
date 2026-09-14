package com.maya.ai.agent

import android.view.View

/** UI-thread owned inline task. No rendering output is execution authority. */
interface WorkspaceTask {
    val view: View
    val goal: String
    val busy: Boolean
    val approved: Boolean
    val executing: Boolean
    val stoppable: Boolean get()=busy || approved
    fun refresh()
    fun stop()
    fun dispose()
}
