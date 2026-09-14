package com.maya.ai.agent

/** Linear, bounded, presentation-only line comparison. Never a patch/execution authority.
 * One contiguous replacement block: unchanged lines between edits can appear on both sides.
 * Splitting retains the final empty line, so newline-only changes remain visible. */
object BuilderDiff {
    fun render(before: String, after: String): String {
        require(before.length<=8000 && after.length<=8000)
        if(before==after) return "No content changes."
        val old=if(before.isEmpty()) emptyList() else before.split('\n')
        val new=if(after.isEmpty()) emptyList() else after.split('\n')
        var first=0
        while(first<old.size && first<new.size && old[first]==new[first]) first++
        var tail=0
        while(tail<old.size-first && tail<new.size-first && old[old.lastIndex-tail]==new[new.lastIndex-tail]) tail++
        return buildString {
            append("Local comparison · one replacement block, not an executable patch.\n")
            append("− old / + proposed; final empty lines included.\\r and \\t are shown escaped.\n")
            append("@@ old line ${first+1} (${old.size-first-tail} lines) → new line ${first+1} (${new.size-first-tail} lines) @@\n")
            fun line(prefix: String, value: String) {append(prefix);append(value.replace("\\","\\\\").replace("\r","\\r").replace("\t","\\t"));append('\n')}
            for(i in (first-2).coerceAtLeast(0) until first) line("  ",old[i])
            for(i in first until old.size-tail) line("− ",old[i])
            for(i in first until new.size-tail) line("+ ",new[i])
            for(i in old.size-tail until (old.size-tail+2).coerceAtMost(old.size)) line("  ",old[i])
        }
    }
}
