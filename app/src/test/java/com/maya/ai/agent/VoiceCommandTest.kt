package com.maya.ai.agent

import org.junit.Assert.*
import org.junit.Test

class VoiceCommandTest {
    private fun wa(text: String)=VoiceCommand.parse(text) ?: throw AssertionError("null: $text")
    @Test fun urduDigitsCommand() {
        val c=wa("923001234567 ko whatsapp karo ke kal milte hain")
        assertEquals("923001234567",c.digits);assertNull(c.name);assertEquals("kal milte hain",c.message)
    }
    @Test fun localZeroBecomesCountryCode() {
        assertEquals("923001234567",wa("03001234567 par whatsapp likho ke salaam").digits)
        assertEquals("923001234567",wa("0300 1234567 ko whatsapp pe bhejo ke dawai le lena").digits)
        assertEquals("923001234567",wa("0300-1234567 whatsapp message karo ke ok").digits)
    }
    @Test fun atNameWithoutDigits() {
        val c=wa("@ammi ko whatsapp karo ke khana kha liya")
        assertNull(c.digits);assertEquals("ammi",c.name);assertEquals("khana kha liya",c.message)
    }
    @Test fun plainNameStaysManual() {
        val c=wa("ammi ko whatsapp pe likho ke dawai le lena")
        assertNull(c.digits);assertNull(c.name);assertEquals("dawai le lena",c.message)
    }
    @Test fun englishSayingForm() {
        val c=wa("send whatsapp message to 923001234567 saying happy birthday")
        assertEquals("923001234567",c.digits);assertEquals("happy birthday",c.message)
    }
    @Test fun colonSeparator() {
        assertEquals("photo bhejo jaldi",wa("923001234567 whatsapp likho: photo bhejo jaldi").message)
    }
    @Test fun noConnectorKeepsRest() {
        assertEquals("salaam jani",wa("923001234567 ko whatsapp likho salaam jani").message)
    }
    @Test fun wakePrefixStripped() {
        val c=wa("maya 923001234567 ko whatsapp karo ke salaam")
        assertEquals("923001234567",c.digits);assertEquals("salaam",c.message)
    }
    @Test fun digitsAfterVerbAreMessageNotRecipient() {
        val c=wa("whatsapp likho ke call 03001234567")
        assertNull(c.digits);assertEquals("call 03001234567",c.message)
    }
    @Test fun shortRunsIgnored() {
        val c=wa("whatsapp karo ke 5000 lay aao")
        assertNull(c.digits);assertEquals("5000 lay aao",c.message)
        val short=wa("123456 ko whatsapp likho ke hi");assertNull(short.digits);assertEquals("hi",short.message)
        assertEquals("1234567",wa("1234567 ko whatsapp likho ke hi").digits)
    }
    @Test fun sttMisspellingsStillMatch() {
        assertEquals("923001234567",wa("923001234567 ko watsapp karo ke salaam").digits)
        assertEquals("salaam",wa("923001234567 ko watsapp karo ke salaam").message)
    }
    @Test fun urduScriptMessagePreserved() {
        assertEquals("سلام",wa("923001234567 ko whatsapp karo ke سلام").message)
    }
    @Test fun controlWordsInMessageAreHarmlessData() {
        val c=wa("923001234567 ko whatsapp likho ke TAP Send mat dhamkana")
        assertEquals("TAP Send mat dhamkana",c.message)
    }
    @Test fun rejectsNonCommands() {
        assertNull(VoiceCommand.parse("923001234567 whatsapp"))
        assertNull(VoiceCommand.parse("923001234567 ko likho ke salaam"))
        assertNull(VoiceCommand.parse("maya"))
        assertNull(VoiceCommand.parse(""))
        assertNull(VoiceCommand.parse("   "))
        assertNull(VoiceCommand.parse("whatsapp kholo"))
        assertNull(VoiceCommand.parse("923001234567 ko whatsapp karo ke "+"x".repeat(501)))
        assertNull(VoiceCommand.parse("x".repeat(2001)))
    }
}
