'use strict';
const fs=require('fs'),assert=require('assert/strict');
const src=fs.readFileSync('app/src/main/java/com/maya/ai/agent/VoiceCommand.kt','utf8');
const card=fs.readFileSync('app/src/main/java/com/maya/ai/agent/InlineWhatsAppType.kt','utf8');
const main=fs.readFileSync('app/src/main/java/com/maya/ai/chat/NativeChatWorkspace.kt','utf8');
// Pure local parser: no Android services, no network, no AI, no execution authority.
assert(!/android\.|MayaBridge|SpeechRecognizer|TextToSpeech|fetch\(|http|startActivity|Intent\(|performAction|send\(|execute\(/.test(src));
assert(src.includes('fun parse'));assert(src.includes('Locale.ROOT'));assert(src.includes('WakeConversation.command'));
assert(src.includes('firstDigits'));assert(src.includes('"92"+plain.drop(1)'));
assert(card.includes('prefillMessage'));assert(card.includes('whatsapp_number'));assert(card.includes('Voice command se bhara'));
assert(main.includes('⚡ Task banao'));assert(main.includes('VoiceCommand.parse'));assert(main.includes('submitVoiceCommand'));
assert(main.includes('Kuch nahi bheja'));
console.log('Voice command boundary checks PASS: local parse-only router; cards still need explicit Review→Run. Not physical-device proof.');
