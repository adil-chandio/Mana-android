package com.maya.ai.agent

import org.junit.Assert.*
import org.junit.Test

class AiTaskReviewTest {
    private fun review(options: List<String> = listOf("plain","with selected context"))=AiTaskReview(
        AiTaskReview.Kind.RESEARCH_PLAN,AiTaskReview.Route.SAVED_AI,"synthetic","test-model","fingerprint",options,1000)
    @Test fun preparingAReviewDoesNotAuthorizeExecution() {
        val r=review();assertFalse(r.claim("plain",1001));assertFalse(r.approve("plain",1002))
    }
    @Test fun onlyTheExactSelectedCandidateCanBeConsumedOnce() {
        val r=review();assertTrue(r.approve("plain",1100));assertFalse(r.approve("with selected context",1101))
        assertTrue(r.claim("plain",1102));assertFalse(r.claim("plain",1103))
    }
    @Test fun otherPromptCannotBorrowAValidReview() {
        val r=review();assertFalse(r.approve("injected",1100));assertTrue(r.approve("plain",1101))
        assertFalse(r.claim("with selected context",1102));assertFalse(r.claim("plain",1103))
    }
    @Test fun explicitContextChoiceIsSupportedWithoutGrantingOtherData() {
        val r=review();assertTrue(r.approve("with selected context",1100));assertTrue(r.claim("with selected context",1101))
    }
    @Test fun expirationAndBackwardClockCannotExtendApproval() {
        for(time in listOf(999L,61000L)) {val r=review();assertFalse(r.approve("plain",time))}
        val r=review();assertTrue(r.approve("plain",1100));assertFalse(r.claim("plain",61000))
    }
    @Test fun revokeCancelsBothPreparedAndApprovedTickets() {
        val prepared=review();prepared.revoke();assertFalse(prepared.approve("plain",1100))
        val approved=review();assertTrue(approved.approve("plain",1100));approved.revoke();assertFalse(approved.claim("plain",1101))
    }
    @Test fun payloadIsBoundedAndReportsNeverContainPromptOrKeyMaterial() {
        val r=review(listOf("PRIVATE_PROMPT"));assertFalse(r.toString().contains("PRIVATE"));assertFalse(r.description.contains("PRIVATE"))
        assertTrue(r.description.contains("256"))
        try {review(listOf("x".repeat(2001)));fail()} catch(_: IllegalArgumentException) {}
        try {review(listOf("a","b","c"));fail()} catch(_: IllegalArgumentException) {}
    }
}
