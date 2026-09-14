package com.maya.ai.agent

import com.maya.ai.chat.NativeChatProtocol

/** Explicit memory-only versions. Not files, durable snapshot revisions or executable patches. */
class BuilderCheckpoints {
    class Point internal constructor(val number: Long,val code: String) {
        override fun toString()="BuilderCheckpoint(redacted)"
    }
    private val points=mutableListOf<Point>()
    private var serial=0L
    fun list()=points.toList()
    fun contains(point: Point)=points.any {it===point}
    fun save(code: String): Point {
        require(valid(code));check(points.size<5);check(points.none {it.code==code});check(serial<Long.MAX_VALUE)
        return Point(++serial,code).also {points.add(it)}
    }
    fun remove(point: Point) {check(contains(point));points.remove(point)}
    fun clear() {points.clear();serial=0}
    companion object {fun valid(code: String)=code.length<=8000 && (code.isEmpty() || NativeChatProtocol.validReply(code))}
}
