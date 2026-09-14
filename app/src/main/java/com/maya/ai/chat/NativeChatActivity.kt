package com.maya.ai.chat

import android.os.Bundle
import android.view.MotionEvent
import androidx.appcompat.app.AppCompatActivity

/** Compatibility launcher. Main Maya now hosts the exact same native workspace in-place. */
class NativeChatActivity : AppCompatActivity() {
    companion object { const val OPEN_LINK = NativeChatWorkspace.OPEN_LINK }
    private lateinit var workspace: NativeChatWorkspace
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        workspace=NativeChatWorkspace(this) { finish() };setContentView(workspace.createView())
    }
    override fun onResume() {super.onResume();workspace.resume()}
    override fun onPause() {workspace.pause();super.onPause()}
    override fun onStop() {workspace.stop();super.onStop()}
    override fun onDestroy() {workspace.dispose();super.onDestroy()}
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus);if(::workspace.isInitialized) workspace.focusChanged(hasFocus)
    }
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        if(::workspace.isInitialized && workspace.consumeTouch(event)) return true
        return super.dispatchTouchEvent(event)
    }
    @Deprecated("Deprecated in Android") override fun onBackPressed() {workspace.requestClose()}
}
