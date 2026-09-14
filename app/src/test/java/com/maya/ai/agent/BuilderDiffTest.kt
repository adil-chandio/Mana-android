package com.maya.ai.agent

import org.junit.Assert.*
import org.junit.Test

class BuilderDiffTest {
    @Test fun reportsActualRemovedAndAddedLinesWithContext() {
        val diff=BuilderDiff.render("<html>\nOld\n</html>","<html>\nNew\n</html>")
        assertTrue(diff.contains("− Old\n+ New\n"));assertTrue(diff.contains("old line 2 (1 lines) → new line 2 (1 lines)"))
        assertTrue(diff.contains("  <html>"));assertTrue(diff.contains("  </html>"))
    }
    @Test fun unchangedEmptyInsertionAndDeletionAreDistinct() {
        assertEquals("No content changes.",BuilderDiff.render("", ""))
        assertEquals("No content changes.",BuilderDiff.render("same", "same"))
        assertTrue(BuilderDiff.render("", "new").contains("+ new"))
        assertTrue(BuilderDiff.render("old", "").contains("− old"))
    }
    @Test fun trailingNewlinesTabsAndCarriageReturnsAreVisible() {
        assertTrue(BuilderDiff.render("a", "a\n").contains("+ \n"))
        val diff=BuilderDiff.render("\tbefore\r", "after")
        assertTrue(diff.contains("− \\tbefore\\r"))
        assertTrue(BuilderDiff.render("\\t", "\t").contains("− \\\\t\n+ \\t"))
    }
    @Test fun unicodeAndModelInstructionsStayPlainData() {
        val diff=BuilderDiff.render("😃", "<script>sendSecrets()</script>😎")
        assertTrue(diff.contains("− 😃"));assertTrue(diff.contains("+ <script>sendSecrets()</script>😎"))
    }
    @Test fun worstCaseLineCountIsBoundedAndOversizeRejected() {
        assertTrue(BuilderDiff.render("\n".repeat(8000), "\r".repeat(8000)).length<50000)
        for(pair in listOf("x".repeat(8001) to "", "" to "x".repeat(8001))) {
            try {BuilderDiff.render(pair.first,pair.second);fail("Expected size rejection")} catch(_: IllegalArgumentException) {}
        }
    }
}
