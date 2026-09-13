package com.maya.ai.agent

import org.junit.Assert.*
import org.junit.Test

class ApprovedPlanRunnerTest {
    private class F : ApprovedPlanRunner.LabPort {
        var time = 0L; var value = ""; var allowed = true; var writes = 0; var broken = false
        val tasks = mutableListOf<() -> Unit>()
        val runner = ApprovedPlanRunner(this, { time }, { _, task ->
            tasks.add(task); val cancel: () -> Unit = { tasks.remove(task); Unit }; cancel
        }, {})
        override fun available() = allowed
        override fun read() = value
        override fun write(value: String) { writes++; if (!broken) this.value = value }
        fun tick() { time += 750; tasks.removeAt(0)() }
        fun all() { while (tasks.isNotEmpty()) tick() }
    }
    private fun plan(s: String = "SET Salam\nEXPECT Salam\nCLEAR") = ApprovedPlanRunner.Plan.parse(s)
    @Test fun unsupportedExternalOrUnboundedInstructionsReject() {
        for (s in listOf("", "TAP Send", "OPEN com.example", "SET ", "SET a\n", (1..7).joinToString("\n") { "CLEAR" }, "SET " + "a".repeat(201))) {
            try { plan(s); fail("Accepted invalid plan") } catch (_: IllegalArgumentException) {}
        }
        try { ApprovedPlanRunner.Plan.parse("CLEAR", "com.bank.app"); fail("External target accepted") } catch (_: IllegalArgumentException) {}
    }
    @Test fun approvalDoesNotRunAndRunNeedsApproval() {
        val f = F(); assertFalse(f.runner.start(plan())); assertEquals(0,f.writes)
        assertTrue(f.runner.approve(plan())); assertTrue(f.tasks.isEmpty()); assertEquals(0,f.writes)
    }
    @Test fun exactPlanRunsBoundedStepsWithFixedEvidenceAndSingleUseApproval() {
        val f=F();val p=plan();f.runner.approve(p);assertTrue(f.runner.start(p));f.all()
        assertEquals(2,f.writes);assertEquals("",f.value)
        assertEquals(ApprovedPlanRunner.State.COMPLETED,f.runner.state)
        assertTrue(f.runner.report().contains("Step 3: CLEAR · verified"));assertFalse(f.runner.report().contains("Salam"))
        assertFalse(f.runner.start(p));assertTrue(f.tasks.isEmpty())
    }
    @Test fun changedPlanCannotUsePreviousApproval() {
        val f=F();f.runner.approve(plan());assertFalse(f.runner.start(plan("SET Different")))
        assertEquals(ApprovedPlanRunner.State.PLAN_CHANGED,f.runner.state);assertEquals(0,f.writes)
    }
    @Test fun targetChangeAfterApprovalOrBetweenStepsStopsBeforeWriting() {
        val f=F();val p=plan();f.runner.approve(p);f.value="other";assertFalse(f.runner.start(p));assertEquals(0,f.writes)
        f.runner.approve(p);f.runner.start(p);f.tick();f.value="manual";f.tick()
        assertEquals(1,f.writes);assertEquals(ApprovedPlanRunner.State.TARGET_CHANGED,f.runner.state);assertTrue(f.tasks.isEmpty())
    }
    @Test fun failedPostconditionNeverRetries() {
        val f=F();val p=plan();f.broken=true;f.runner.approve(p);f.runner.start(p);f.tick()
        assertEquals(1,f.writes);assertEquals(ApprovedPlanRunner.State.FAILED,f.runner.state);assertTrue(f.tasks.isEmpty())
    }
    @Test fun stopFencesLateCallbacksAndRequiresNewApproval() {
        val f=F();val p=plan();f.runner.approve(p);f.runner.start(p)
        val late=f.tasks.single();f.runner.stop();late()
        assertEquals(0,f.writes);assertFalse(f.runner.start(p));assertTrue(f.tasks.isEmpty())
    }
    @Test fun oldCallbackCannotMutateNewRun() {
        val f=F();val p=plan();f.runner.approve(p);f.runner.start(p);val old=f.tasks.single();f.runner.stop()
        f.runner.approve(p);f.runner.start(p);old();assertEquals(0,f.writes);f.all();assertEquals(2,f.writes)
    }
    @Test fun approvalExpiryRunDeadlineAndClockRegressionFailClosed() {
        val f=F();val p=plan();f.runner.approve(p);f.time=60000;assertFalse(f.runner.start(p))
        f.runner.approve(p);f.runner.start(p);f.time+=30000;f.tick();assertEquals(0,f.writes)
        f.runner.approve(p);f.time--;assertFalse(f.runner.start(p))
    }
    @Test fun unavailableScopeAndExplicitInvalidationNeverDispatch() {
        val f=F();val p=plan();f.allowed=false;assertFalse(f.runner.approve(p))
        f.allowed=true;f.runner.approve(p);f.runner.invalidate();assertFalse(f.runner.start(p))
        f.runner.approve(p);f.runner.start(p);f.allowed=false;f.tick();assertEquals(0,f.writes)
    }
    @Test fun expectMismatchAndClearAreVerifiedAgainstActualField() {
        val f=F();val p=plan("EXPECT different\nCLEAR");f.value="original";f.runner.approve(p);f.runner.start(p);f.all()
        assertEquals(ApprovedPlanRunner.State.FAILED,f.runner.state);assertEquals("original",f.value);assertEquals(0,f.writes)
    }
    @Test fun schedulerFailureFailsClosedAndThrowingCancelStillFencesCallbacks() {
        val port=F();val p=plan()
        val broken=ApprovedPlanRunner(port,{0},{_,_->throw IllegalStateException("SYNTHETIC")},{})
        broken.approve(p);assertFalse(broken.start(p));assertFalse(broken.busy);assertFalse(broken.approved)
        var late: (() -> Unit)?=null
        val r=ApprovedPlanRunner(port,{0},{_,task->
            late=task;val cancel: () -> Unit={throw IllegalStateException("SYNTHETIC")};cancel
        },{})
        r.approve(p);r.start(p);r.stop();late!!()
        assertEquals(ApprovedPlanRunner.State.STOPPED,r.state);assertEquals(0,port.writes)
        r.clear();assertEquals(ApprovedPlanRunner.State.IDLE,r.state)
    }
    @Test fun rendererFailureCannotLeaveExecutableApproval() {
        val port=F();val r=ApprovedPlanRunner(port,{0},{_,_->{ }},{throw IllegalStateException("SYNTHETIC")})
        r.approve(plan());assertFalse(r.approved);assertFalse(r.start(plan()))
    }

}
