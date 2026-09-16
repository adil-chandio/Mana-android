package com.maya.ai.agent

import org.junit.Assert.*
import org.junit.Test
import com.maya.ai.chat.NativeChatProtocol

class ResearchPolicyTest {
    private fun reject(source: String) {try {ResearchPlan.parse(source);fail("Expected denial")} catch (_: IllegalArgumentException) {}}
    @Test fun onlyBoundedPublicSourceGrammarIsAccepted() {
        for(s in listOf("", "OPEN https://example.com", "SEND hello", "WIKI Special:Login", "WIKI http://bank.test", "WIKI a?b=c", "WIKI A\n", "REPO a/../b", "REPO a/b?token=x", "REPO a/b/c", "WIKI Dog\nWIKI Dog", (1..4).joinToString("\n") {"WIKI Dog$it"},"WIKI "+"a".repeat(121))) reject(s)
    }
    @Test fun requestAndBrowserUrlsAreDerivedNotProviderControlled() {
        val p=ResearchPlan.parse("WIKI Solar cell\nREPO adil-chandio/Mana-android")
        assertEquals(2,p.size)
        assertEquals("https://en.wikipedia.org/api/rest_v1/page/summary/Solar_cell",p.item(0).requestUrl)
        assertEquals("https://github.com/adil-chandio/Mana-android",p.item(1).pageUrl)
        assertFalse(p.toString().contains("Solar"));assertFalse(p.item(0).toString().contains("Solar"))
    }
    @Test fun plannerAndSummaryStayInsideExistingSignedTextBoundsWithoutTools() {
        NativeChatProtocol.validateDraft(ResearchPlan.planningPrompt("a".repeat(400)))
        val sources=(1..3).map {ResearchSource("https://github.com/a/b","x".repeat(1400))}
        val prompt=ResearchBackend.summaryPrompt("g".repeat(400),sources)
        NativeChatProtocol.validateDraft(prompt);assertTrue(prompt.length<=2000)
        assertTrue(prompt.contains("[1]"));assertTrue(prompt.contains("[3]"));assertFalse(prompt.contains("https://github.com"))
        assertTrue(prompt.contains("untrusted data"))
    }
    @Test fun summaryClippingDoesNotSplitValidSurrogatePairs() {
        val source=ResearchSource("https://github.com/a/b","x".repeat(429)+"\uD83D\uDE03")
        NativeChatProtocol.validateDraft(ResearchBackend.summaryPrompt("goal",listOf(source)))
    }
    private class F : ResearchRunner.Port {
        var time=0L
        class Task(val at: Long,val action: () -> Unit)
        val tasks=mutableListOf<Task>();val calls=mutableListOf<Pair<ResearchPlan.Item,(ResearchSource?) -> Unit>>()
        var cancels=0
        val r=ResearchRunner(this,{time},{delay,fn ->
            val t=Task(time+delay,fn);tasks.add(t);val cancel: () -> Unit={tasks.remove(t);Unit};cancel
        },{})
        override fun fetch(item: ResearchPlan.Item,done: (ResearchSource?) -> Unit): () -> Unit {calls.add(item to done);return {cancels++}}
        fun tick() {val t=tasks.minByOrNull {it.at}!!;tasks.remove(t);time=t.at;t.action()}
        fun reply(index: Int) {val c=calls[index];c.second(ResearchSource(c.first.pageUrl,"SYNTHETIC_PUBLIC_TEXT"))}
    }
    private val p get()=ResearchPlan.parse("WIKI Dog\nREPO a/b")
    @Test fun approvalAloneDoesNotFetchAndApprovalIsConsumedOnce() {
        val f=F();assertFalse(f.r.start(p,ResearchBrowser.CHROME));f.r.approve(p,ResearchBrowser.CHROME)
        assertTrue(f.calls.isEmpty());assertEquals(1,f.tasks.size);assertEquals(60000L,f.tasks.single().at);assertTrue(f.r.start(p,ResearchBrowser.CHROME))
        f.tick();f.reply(0);f.tick();f.reply(1)
        assertEquals(ResearchRunner.State.COMPLETE,f.r.state);assertEquals(2,f.r.results().size)
        assertTrue(f.tasks.isEmpty());assertFalse(f.r.start(p,ResearchBrowser.CHROME))
        assertFalse(f.r.report().contains("SYNTHETIC"))
    }
    @Test fun editedPlanOrChangedBrowserCannotUseOldApproval() {
        val f=F();f.r.approve(p,ResearchBrowser.CHROME);assertFalse(f.r.start(p,ResearchBrowser.BRAVE))
        f.r.approve(p,ResearchBrowser.CHROME);assertFalse(f.r.start(ResearchPlan.parse("WIKI Cat"),ResearchBrowser.CHROME));assertTrue(f.calls.isEmpty())
    }
    @Test fun expiredApprovalAndRunDeadlineStopWithoutRetry() {
        val f=F();f.r.approve(p,ResearchBrowser.CHROME);f.time=60000;assertFalse(f.r.start(p,ResearchBrowser.CHROME))
        f.r.approve(p,ResearchBrowser.CHROME);f.r.start(p,ResearchBrowser.CHROME);f.tick();f.tick()
        assertEquals(ResearchRunner.State.EXPIRED,f.r.state);assertEquals(1,f.cancels);f.reply(0);assertTrue(f.r.results().isEmpty())
    }
    @Test fun stoppedCallbackCannotReviveOldOrNewRun() {
        val f=F();f.r.approve(p,ResearchBrowser.CHROME);f.r.start(p,ResearchBrowser.CHROME);f.tick();f.r.stop()
        f.r.approve(p,ResearchBrowser.CHROME);f.r.start(p,ResearchBrowser.CHROME);f.reply(0)
        assertTrue(f.r.results().isEmpty());f.tick();f.reply(1);assertEquals(1,f.r.results().size)
    }
    @Test fun duplicateCallbacksNeverSkipNextApprovedStep() {
        val f=F();f.r.approve(p,ResearchBrowser.CHROME);f.r.start(p,ResearchBrowser.CHROME);f.tick();f.reply(0);f.reply(0)
        assertEquals(1,f.r.results().size);f.tick();f.reply(0);assertEquals(1,f.r.results().size);f.reply(1)
        assertEquals(ResearchRunner.State.COMPLETE,f.r.state)
    }
    @Test fun foreignSourceUrlsMissingSourcesAndLongBodiesHalt() {
        for(source in listOf(null,ResearchSource("https://evil.example","text"),ResearchSource(p.item(0).pageUrl,"x".repeat(1401)))) {
            val f=F();f.r.approve(p,ResearchBrowser.CHROME);f.r.start(p,ResearchBrowser.CHROME);f.tick();f.calls[0].second(source)
            assertEquals(ResearchRunner.State.FAILED,f.r.state);assertTrue(f.r.results().isEmpty());assertTrue(f.tasks.isEmpty())
        }
    }
    @Test fun clearErasesPublicResultsAndApprovalAndPendingRequests() {
        val f=F();f.r.approve(p,ResearchBrowser.CHROME);f.r.start(p,ResearchBrowser.CHROME);f.tick();f.reply(0);f.r.clear()
        assertTrue(f.r.results().isEmpty());assertTrue(f.tasks.isEmpty());assertFalse(f.r.approved);assertFalse(f.r.busy)
    }
    @Test fun approvalExpiresWithoutWaitingForOwnerToTapRun() {
        val f=F();f.r.approve(p,ResearchBrowser.CHROME);f.tick()
        assertEquals(ResearchRunner.State.EXPIRED,f.r.state);assertFalse(f.r.approved)
        assertTrue(f.calls.isEmpty());assertTrue(f.tasks.isEmpty());assertFalse(f.r.start(p,ResearchBrowser.CHROME))
    }
    @Test fun oldExpiryCannotRevokeReplacementApprovalAndStopRemovesTimer() {
        val f=F();f.r.approve(p,ResearchBrowser.CHROME);val old=f.tasks.single().action
        f.time=100;f.r.approve(p,ResearchBrowser.BRAVE);old()
        assertTrue(f.r.approved);assertEquals(1,f.tasks.size);f.r.stop();assertTrue(f.tasks.isEmpty())
    }

}
