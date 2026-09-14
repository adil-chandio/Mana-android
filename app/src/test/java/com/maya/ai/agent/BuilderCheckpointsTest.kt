package com.maya.ai.agent

import org.junit.Assert.*
import org.junit.Test

class BuilderCheckpointsTest {
    private fun reject(block: ()->Unit) {try {block();fail("Expected refusal")} catch(_: IllegalArgumentException) {} catch(_: IllegalStateException) {}}
    @Test fun explicitSnapshotsPreserveExactCodeAndDoNotLogIt() {
        val history=BuilderCheckpoints();assertTrue(history.list().isEmpty())
        val point=history.save("PRIVATE\r\n\t🌍\n");assertEquals("PRIVATE\r\n\t🌍\n",point.code)
        assertFalse(point.toString().contains("PRIVATE"));assertTrue(history.contains(point))
    }
    @Test fun fivePointCapNeverEvictsAndRemovalReleasesExactlyOneSlot() {
        val h=BuilderCheckpoints();val first=h.save("first");repeat(4) {h.save("item $it")}
        reject {h.save("sixth")};assertTrue(h.contains(first));assertEquals(5,h.list().size)
        h.remove(first);val sixth=h.save("sixth");assertEquals(6L,sixth.number);assertEquals(5,h.list().size)
    }
    @Test fun duplicatesOversizeAndMalformedUnicodeNeverCreatePoints() {
        val h=BuilderCheckpoints();h.save("code");reject {h.save("code")};reject {h.save("x".repeat(8001))};reject {h.save("\uD800")}
        assertEquals(1,h.list().size);assertEquals("",h.save("").code)
    }
    @Test fun pointIdentityCannotBeReusedAcrossClearOrAnotherProject() {
        val h=BuilderCheckpoints();val old=h.save("code");h.clear();val fresh=h.save("code")
        assertFalse(h.contains(old));reject {h.remove(old)};assertTrue(h.contains(fresh))
        val other=BuilderCheckpoints().save("code");reject {h.remove(other)}
    }
}
