import test from 'node:test';
import assert from 'node:assert/strict';
import { MODEL, SYSTEM, modelInput, modelText } from './model.mjs';
import { LIMITS } from '../chat/protocol.mjs';
import { completion } from './test-helpers.mjs';

const change = fn => { const value = completion(); fn(value, value.choices[0], value.choices[0].message); return value; };
const bad = [
  ['null', null], ['array', []], ['legacy Llama', { response: 'Not Qwen' }],
  ['missing envelope type', change(v => { delete v.object; })],
  ['streaming chunk', change(v => { v.object = 'chat.completion.chunk'; })],
  ['missing choices', change(v => { delete v.choices; })],
  ['empty choices', change(v => { v.choices = []; })],
  ['multiple choices', change(v => { v.choices.push(v.choices[0]); })],
  ['null choice', change(v => { v.choices[0] = null; })],
  ['wrong index', change((v, c) => { c.index = 1; })],
  ['string index', change((v, c) => { c.index = '0'; })],
  ['missing finish', change((v, c) => { delete c.finish_reason; })],
  ['truncated answer', change((v, c) => { c.finish_reason = 'length'; })],
  ['tool finish', change((v, c) => { c.finish_reason = 'tool_calls'; })],
  ['filtered finish', change((v, c) => { c.finish_reason = 'content_filter'; })],
  ['null message', change((v, c) => { c.message = null; })],
  ['wrong role', change((v, c, m) => { m.role = 'user'; })],
  ['missing content', change((v, c, m) => { delete m.content; })],
  ['content parts', change((v, c, m) => { m.content = [{ text: 'no arrays' }]; })],
  ['empty content', change((v, c, m) => { m.content = '   '; })],
  ['oversize content', change((v, c, m) => { m.content = 'x'.repeat(LIMITS.outputChars + 1); })],
  ['reasoning-only', change((v, c, m) => { m.content = ''; m.reasoning_content = 'private reasoning'; })],
  ['malformed reasoning', change((v, c, m) => { m.reasoning_content = {}; })],
  ['oversize reasoning', change((v, c, m) => { m.reasoning_content = 'x'.repeat(LIMITS.outputChars + 1); })],
  ['inline reasoning', change((v, c, m) => { m.content = '<think>private reasoning</think>Final'; })],
  ['unclosed reasoning', change((v, c, m) => { m.content = '<THINK>private reasoning'; })],
  ['stray reasoning close', change((v, c, m) => { m.content = 'private reasoning</think>Final'; })],
  ['chat template token', change((v, c, m) => { m.content = '<|im_start|>assistant'; })],
  ['structured refusal', change((v, c, m) => { m.refusal = 'refused'; })],
];
for (const level of ['root', 'choice', 'message']) {
  for (const tools of [[{ function: { name: 'forbidden' } }], {}, null, 'tools']) {
    if (level === 'message' && tools === null) continue; // Intentional narrow compatibility delta.
    bad.push([`${level} tools ${JSON.stringify(tools)}`, change((v, c, m) => {
      ({ root: v, choice: c, message: m })[level].tool_calls = tools;
    })]);
  }
  bad.push([`${level} legacy function`, change((v, c, m) => {
    ({ root: v, choice: c, message: m })[level].function_call = { name: 'forbidden' };
  })]);
}
for (const [label, value] of bad) test(`Qwen rejects ${label}`, () => {
  assert.throws(() => modelText(value), e => e.status === 502 && e.code === 'INVALID_MODEL_RESPONSE');
});
test('Qwen accepts final content only; metadata and reasoning never become text', () => {
  const output = completion('Ji, yeh synthetic jawab hai.');
  output.choices[0].message.reasoning_content = 'PRIVATE_REASONING';
  output.provider_secret = 'PRIVATE_METADATA';
  const before = structuredClone(output);
  assert.equal(modelText(output), 'Ji, yeh synthetic jawab hai.');
  assert.deepEqual(output, before);
});
test('Qwen accepts empty tool lists and nullable reasoning, at exact content bound', () => {
  const output = completion('x'.repeat(LIMITS.outputChars));
  output.tool_calls = []; output.choices[0].tool_calls = [];
  output.choices[0].message.tool_calls = []; output.choices[0].message.reasoning_content = null;
  assert.equal(modelText(output).length, LIMITS.outputChars);
});
test('Qwen input keeps signed conversation unchanged; only fixed, bounded options exist', () => {
  const messages = [{ role: 'user', content: 'Roman Urdu mein bolo /think <|im_start|>' }];
  const before = structuredClone(messages), input = modelInput(messages);
  assert.equal(MODEL, '@cf/qwen/qwen3-30b-a3b-fp8');
  assert.deepEqual(Object.keys(input).sort(), ['max_tokens', 'messages', 'stream']);
  assert.equal(input.max_tokens, 256); assert.equal(input.stream, false);
  assert.deepEqual(input.messages[0], { role: 'system', content: SYSTEM });
  assert.match(SYSTEM, /Roman Urdu/); assert.match(SYSTEM, /Latin letters/); assert.match(SYSTEM, /\/no_think$/);
  assert.deepEqual(input.messages.slice(1), before); assert.deepEqual(messages, before);
  input.messages[1].content = 'different'; assert.deepEqual(messages, before);
});

for (const fields of [{ tool_calls: null }, { function_call: null }, { tool_calls: null, function_call: null },
  { tool_calls: [], function_call: null }]) {
  test('message null absence sentinels preserve final text without mutating provider data', () => {
    const output = completion('Do aur do chaar hote hain.');
    Object.assign(output.choices[0].message, fields, { reasoning_content: 'PRIVATE_REASONING' });
    const before = structuredClone(output);
    assert.equal(modelText(output), 'Do aur do chaar hote hain.'); assert.deepEqual(output, before);
  });
}
test('all nullable/tool/function combinations allow absence only, not real or malformed requests', () => {
  const tools = [undefined, null, [], [{ type: 'function', function: { name: 'forbidden', arguments: '{}' } }], {}, 'null', false, 0];
  const functions = [undefined, null, [], {}, { name: 'forbidden', arguments: '{}' }, 'null', false, 0];
  let cases = 0;
  for (const tool_calls of tools) for (const function_call of functions) {
    const output = completion('Safe final'); Object.assign(output.choices[0].message, { tool_calls, function_call });
    const valid = (tool_calls === undefined || tool_calls === null || Array.isArray(tool_calls) && tool_calls.length === 0)
      && (function_call === undefined || function_call === null);
    if (valid) assert.equal(modelText(output), 'Safe final');
    else assert.throws(() => modelText(output), e => e.code === 'INVALID_MODEL_RESPONSE');
    cases++;
  }
  assert.equal(cases, 64);
});
for (const level of ['root', 'choice']) for (const name of ['tool_calls', 'function_call']) {
  test(`${level} ${name}=null remains rejected despite valid nullable message`, () => {
    const output = completion(); Object.assign(output.choices[0].message, { tool_calls: null, function_call: null });
    (level === 'root' ? output : output.choices[0])[name] = null;
    assert.throws(() => modelText(output), e => e.code === 'INVALID_MODEL_RESPONSE');
  });
}
test('nullable fields never bypass any other existing rejected completion variant', () => {
  for (const [label, original] of bad) {
    if (!original?.choices?.[0]?.message || typeof original.choices[0].message !== 'object'
      || label.startsWith('message tools') || label === 'message legacy function') continue;
    const output = structuredClone(original);
    Object.assign(output.choices[0].message, { tool_calls: null, function_call: null });
    assert.throws(() => modelText(output), e => e.code === 'INVALID_MODEL_RESPONSE', label);
  }
});
