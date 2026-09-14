package com.maya.ai.agent

import android.os.Bundle
import android.view.MotionEvent
import androidx.appcompat.app.AppCompatActivity

/** Standalone entry uses the same workspace as native Chat. No incoming data/extras. */
class ResearchActivity : AppCompatActivity() {
    private lateinit var workspace: ResearchWorkspace
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        workspace=ResearchWorkspace(this);setContentView(workspace.createView())
    }
    override fun onResume() {super.onResume();workspace.resume()}
    override fun onPause() {workspace.pause();super.onPause()}
    override fun onStop() {workspace.clear();super.onStop()}
    override fun onDestroy() {workspace.dispose();super.onDestroy()}
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus);if(::workspace.isInitialized) workspace.focusChanged(hasFocus)
    }
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        if(::workspace.isInitialized && workspace.consumeTouch(event)) return true
        return super.dispatchTouchEvent(event)
    }
    @Deprecated("Deprecated in Android") override fun onBackPressed() {workspace.clear();finish()}
}
