package com.maya.ai.chat

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.view.View
import android.widget.*

/** Local presentation tokens only. No persistence, network, permissions or task authority. */
object MayaTheme {
    val background=Color.rgb(22,23,25)
    val surface=Color.rgb(33,34,37)
    val border=Color.rgb(52,53,56)
    val text=Color.rgb(238,234,228)
    val muted=Color.rgb(170,165,158)
    val copper=Color.rgb(215,152,116)
    val ink=Color.rgb(28,23,20)
    val danger=Color.rgb(240,157,157)
    fun dp(context: Context,n: Int)=(context.resources.displayMetrics.density*n).toInt()
    fun shape(context: Context,fill: Int=surface,radius: Int=16,stroke: Boolean=true)=GradientDrawable().apply {
        setColor(fill);cornerRadius=dp(context,radius).toFloat()
        if(stroke) setStroke(dp(context,1).coerceAtLeast(1),border)
    }
    fun label(v: TextView,size: Float=14f,secondary: Boolean=false) {
        v.textSize=size;v.setTextColor(if(secondary) muted else text)
        v.typeface=Typeface.create("sans-serif",Typeface.NORMAL)
        v.setLineSpacing(dp(v.context,3).toFloat(),1f);v.isSaveEnabled=false
    }
    fun button(v: Button,title: String,primary: Boolean=false) {
        v.text=caption(title);v.contentDescription=title
        v.textSize=13f;v.isAllCaps=false;v.typeface=Typeface.create("sans-serif-medium",Typeface.NORMAL)
        v.minHeight=dp(v.context,48);v.minimumHeight=dp(v.context,48);v.minWidth=0;v.minimumWidth=0
        v.setPadding(dp(v.context,12),0,dp(v.context,12),0)
        v.background=shape(v.context,if(primary) copper else surface,12,!primary)
        colors(v,if(primary) copper else surface,if(primary) ink else text)
        v.filterTouchesWhenObscured=true;v.isSaveEnabled=false
    }
    fun colors(v: Button,fill: Int,foreground: Int) {
        val states=arrayOf(intArrayOf(android.R.attr.state_enabled),intArrayOf())
        v.backgroundTintList=ColorStateList(states,intArrayOf(fill,surface))
        v.setTextColor(ColorStateList(states,intArrayOf(foreground,muted)))
    }
    fun toggle(v: CompoundButton) {
        v.setTextColor(text);v.minHeight=dp(v.context,48)
        v.buttonTintList=ColorStateList(arrayOf(intArrayOf(android.R.attr.state_checked),intArrayOf()),intArrayOf(copper,muted))
    }
    fun editor(v: EditText,code: Boolean=false) {
        label(v,if(code) 13f else 16f);v.setHintTextColor(muted)
        if(code) v.typeface=Typeface.MONOSPACE
        v.background=shape(v.context,background,12)
        v.setPadding(dp(v.context,12),dp(v.context,10),dp(v.context,12),dp(v.context,10))
    }
    fun status(v: TextView) {
        label(v,13f,true);v.maxLines=3;v.ellipsize=TextUtils.TruncateAt.END
        v.setOnClickListener {v.maxLines=if(v.maxLines==3) Int.MAX_VALUE else 3}
        v.tooltipText="Tap to expand or collapse the full status"
    }
    fun details(parent: LinearLayout,title: String,copy: String) {
        val body=TextView(parent.context).apply {text=copy;label(this,13f,true);visibility=View.GONE;setPadding(0,dp(context,8),0,dp(context,12))}
        val toggle=Button(parent.context).apply {
            button(this,title);setOnClickListener {body.visibility=if(body.visibility==View.GONE) View.VISIBLE else View.GONE;isSelected=body.visibility==View.VISIBLE}
        }
        parent.addView(toggle);parent.addView(body)
    }
    fun dialog(dialog: android.app.AlertDialog) {
        dialog.window?.setBackgroundDrawable(shape(dialog.context,surface,20))
        fun tint(view: View) {
            if(view is TextView) view.setTextColor(text)
            if(view is CompoundButton) toggle(view)
            if(view is android.view.ViewGroup) for(i in 0 until view.childCount) tint(view.getChildAt(i))
        }
        dialog.window?.decorView?.let {tint(it)}
        for(which in listOf(android.app.AlertDialog.BUTTON_POSITIVE,android.app.AlertDialog.BUTTON_NEGATIVE)) {
            dialog.getButton(which)?.apply {isAllCaps=false;minHeight=dp(context,48);setTextColor(if(which==android.app.AlertDialog.BUTTON_POSITIVE) copper else muted)}
        }
    }
    fun caption(title: String): String=when(title) {
        "Clear local chat" -> "New conversation"
        "Original settings · expand here" -> "Voice & appearance"
        "Check local Send readiness · no network" -> "Check local readiness"
        "Check saved Fish setup · no network" -> "Check saved voice"
        "Test saved Fish voice · short sample" -> "Test saved voice"
        "Check APK access + replay · no AI" -> "Check APK access"
        "Create / show APK public key" -> "Show APK identity"
        "Generate / revise AI plan" -> "Suggest plan"
        "Review & approve plan" -> "Review plan"
        "Run approved plan" -> "Run approved plan"
        "Explain sources · AI consent" -> "Explain sources"
        "Sunao · Agent explanation", "Sunao · selected Fish" -> "Sunao"
        "Ask AI for code · consent" -> "Suggest code"
        "Apply reviewed proposal locally" -> "Apply proposal"
        "Render static preview here" -> "Preview here"
        else -> when {
            title.startsWith("Use source ") -> "Use in chat"
            title.startsWith("Open source ") -> "Open source"
            else -> title
        }
    }
}
