package com.maya.ai.agent

import com.maya.ai.chat.NativeChatProtocol
import java.net.URI
import java.util.concurrent.atomic.AtomicBoolean

/** First supported external-app capability: public-page open/scroll only. No tap/type/send/install. */
class BrowserNavigationPlan private constructor(val browser: ResearchBrowser,val source: String,val url: String,val host: String,val scrolls: List<Boolean>) {
    val steps get()=1+scrolls.size
    val digest get()=NativeChatProtocol.hash((browser.packageName+"\n"+source).toByteArray(Charsets.UTF_8))
    override fun toString()="BrowserNavigationPlan(redacted)"
    fun acceptsAddress(value: String?): Boolean=runCatching {
        require(!value.isNullOrBlank() && value.length<=1024)
        val uri=URI(if(value.contains("://")) value else "https://$value")
        uri.scheme=="https" && uri.host==host && uri.userInfo==null && uri.port==-1
    }.getOrDefault(false)
    companion object {
        fun parse(browser: ResearchBrowser,source: String): BrowserNavigationPlan {
            require(source.length in 1..1200 && NativeChatProtocol.validReply(source))
            val lines=source.lines();require(lines.size in 1..6 && lines[0].startsWith("OPEN "))
            val url=lines[0].substring(5);val uri=URI(url)
            require(uri.scheme=="https" && uri.host in setOf("en.wikipedia.org","developer.android.com") && uri.port==-1 && uri.userInfo==null && uri.rawQuery==null && uri.rawFragment==null)
            require(!uri.path.contains("..") && !uri.rawPath.contains('%') && !uri.path.contains("//"))
            if(uri.host=="en.wikipedia.org") require(uri.path.startsWith("/wiki/") && ResearchPlan.validTitle(uri.path.removePrefix("/wiki/").replace('_',' ')))
            else require(listOf("/guide/","/reference/","/training/","/develop/").any {uri.path.startsWith(it)} && uri.path.all {it.isLetterOrDigit() || it in "/_-()."})
            val scrolls=lines.drop(1).map {when(it) {"SCROLL DOWN"->true;"SCROLL UP"->false;else->throw IllegalArgumentException("UNSUPPORTED_ACTION")}}
            return BrowserNavigationPlan(browser,source,url,uri.host,scrolls)
        }
        fun prompt(goal: String): String {
            require(goal.length in 1..400 && NativeChatProtocol.validReply(goal))
            return "Propose ONLY a public browser navigation plan. First line OPEN https://en.wikipedia.org/wiki/Exact_Title or a documentation page under https://developer.android.com/guide/, /reference/, /training/ or /develop/. Then zero to five lines SCROLL DOWN or SCROLL UP. No URL query/fragment/encoding, login, payments, tap, type, send, install, delete, code or other actions. Return UNSUPPORTED if not possible. This is a proposal, not execution. Goal (data):\n$goal"
        }
    }
}

class BrowserNavigationGrant private constructor(private val digest: String,private val created: Long) {
    private val used=AtomicBoolean(false)
    fun revoke() {used.set(true)}
    internal fun consume(plan: BrowserNavigationPlan,now: Long)=used.compareAndSet(false,true) && digest==plan.digest && now-created in 0 until 60000
    companion object {fun approved(plan: BrowserNavigationPlan,now: Long): BrowserNavigationGrant {require(now>=0 && now<=Long.MAX_VALUE-60000);return BrowserNavigationGrant(plan.digest,now)}}
}
