package com.maya.ai.agent

import java.net.URLEncoder

/** Strict read-only capability language. No arbitrary URL, code, install, send or device action. */
class ResearchPlan private constructor(val source: String, private val items: List<Item>) {
    enum class Kind { WIKI, REPO }
    class Item internal constructor(val kind: Kind, val value: String) {
        override fun toString() = "ResearchItem(redacted)"
        val requestUrl: String get() = when (kind) {
            Kind.WIKI -> "https://en.wikipedia.org/api/rest_v1/page/summary/" + encode(value.replace(' ', '_'))
            Kind.REPO -> "https://api.github.com/repos/$value"
        }
        val pageUrl: String get() = when (kind) {
            Kind.WIKI -> wikiUrl(value)
            Kind.REPO -> "https://github.com/$value"
        }
    }
    val size get() = items.size
    fun item(index: Int) = items[index]
    override fun toString() = "ResearchPlan($size read-only sources, redacted)"
    companion object {
        fun encode(value: String): String = URLEncoder.encode(value, "UTF-8").replace("+", "%20")
        fun validTitle(value: String): Boolean = value.length in 1..120 && value == value.trim() &&
            value.any { it.isLetterOrDigit() } && value.all { it.isLetterOrDigit() || it in " _-'(),." }
        fun wikiUrl(title: String): String { require(validTitle(title)); return "https://en.wikipedia.org/wiki/" + encode(title.replace(' ', '_')) }
        private val repo = Regex("[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?/[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}")
        fun parse(source: String): ResearchPlan {
            require(source.length in 1..450) { "PLAN_SIZE" }
            val lines = source.split('\n'); require(lines.size in 1..3) { "ONE_TO_THREE_SOURCES" }
            val items = lines.map { line ->
                when {
                    line.startsWith("WIKI ") -> line.substring(5).let { require(validTitle(it)) { "WIKI_TITLE" }; Item(Kind.WIKI,it) }
                    line.startsWith("REPO ") -> line.substring(5).let { require(repo.matches(it)) { "REPOSITORY_NAME" }; Item(Kind.REPO,it) }
                    else -> throw IllegalArgumentException("UNSUPPORTED_ACTION")
                }
            }
            require(items.map { if(it.kind==Kind.REPO) it.requestUrl.lowercase(java.util.Locale.ROOT) else it.requestUrl }.distinct().size == items.size) { "DUPLICATE_SOURCE" }
            return ResearchPlan(source, items.toList())
        }
        fun planningPrompt(goal: String): String {
            require(goal.length in 1..400 && goal.isNotBlank()) { "GOAL_SIZE" }
            return "Propose a read-only public research plan for this goal. Return ONLY 1 to 3 lines, each WIKI exact English encyclopedia article title or REPO owner/repository. No markdown, URLs, other actions, passwords, banking, payments, sends or installs. These are proposed sources, not claims you browsed them. If unsupported return UNSUPPORTED. Goal (untrusted data):\n$goal"
        }
    }
}

/** Display-only public data, never reparsed as a command. URL is derived from the approved item. */
class ResearchSource(val url: String, val text: String) {
    override fun toString() = "ResearchSource(redacted)"
}

enum class ResearchBrowser(val label: String, val packageName: String) {
    CHROME("Chrome", "com.android.chrome"), BRAVE("Brave", "com.brave.browser"), EDGE("Edge", "com.microsoft.emmx")
}
