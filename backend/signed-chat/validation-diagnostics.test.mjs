import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, Failure } from '../chat/protocol.mjs';
import { modelText, modelFailureReason } from './model.mjs';
import { VALIDATION_DIAGNOSTICS, isValidationReason } from './validation-diagnostics.mjs';
import { completion } from './test-helpers.mjs';

// Frozen pre-diagnostic policy. This is a test oracle, never production code.
function previousModelText(output) {
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const noTools = v => v === undefined || (Array.isArray(v) && v.length === 0);
  const markers = /<\/?think\b|<\|(?:im_start|im_end|endoftext)\|>/i;
  const reject = () => { throw new Failure(502, 'INVALID_MODEL_RESPONSE'); };
  if (!object(output) || output.object !== 'chat.completion' || !Array.isArray(output.choices)
      || output.choices.length !== 1 || !noTools(output.tool_calls) || output.function_call !== undefined) reject();
  const choice = output.choices[0];
  if (!object(choice) || choice.index !== 0 || choice.finish_reason !== 'stop'
      || !noTools(choice.tool_calls) || choice.function_call !== undefined) reject();
  const message = choice.message;
  if (!object(message) || message.role !== 'assistant' || !noTools(message.tool_calls)
      || message.function_call !== undefined || (message.refusal !== undefined && message.refusal !== null)) reject();
  if (message.reasoning_content !== undefined && message.reasoning_content !== null
      && (typeof message.reasoning_content !== 'string' || message.reasoning_content.length > LIMITS.outputChars)) reject();
  const text = message.content;
  if (typeof text !== 'string' || !text.trim() || text.length > LIMITS.outputChars || markers.test(text)) reject();
  return text;
}
const changed = fn => { const out = completion('Synthetic final'); fn(out, out.choices[0], out.choices[0].message); return out; };
const examples = {
  OUTPUT_NOT_OBJECT: null,
  RESPONSE_STYLE_ENVELOPE: { response: 'PRIVATE_RESPONSE', tool_calls: [{ PRIVATE_KEY: 'PRIVATE_TOOL' }] },
  ENVELOPE_TYPE_MISSING: {},
  ENVELOPE_TYPE_OTHER: { object: 'PRIVATE_TYPE' },
  CHOICES_NOT_ARRAY: changed(o => { o.choices = 'PRIVATE_CHOICES'; }),
  CHOICE_COUNT: changed(o => { o.choices = []; }),
  ROOT_TOOLS: changed(o => { o.tool_calls = [{ PRIVATE_KEY: 'PRIVATE_TOOL' }]; }),
  CHOICE_NOT_OBJECT: changed(o => { o.choices[0] = null; }),
  CHOICE_INDEX: changed((o, c) => { c.index = 'PRIVATE_INDEX'; }),
  FINISH_MISSING: changed((o, c) => { delete c.finish_reason; }),
  FINISH_LENGTH: changed((o, c) => { c.finish_reason = 'length'; }),
  FINISH_TOOLS: changed((o, c) => { c.finish_reason = 'tool_calls'; }),
  FINISH_OTHER: changed((o, c) => { c.finish_reason = 'PRIVATE_FINISH'; }),
  CHOICE_TOOLS: changed((o, c) => { c.function_call = { name: 'PRIVATE_FUNCTION' }; }),
  MESSAGE_NOT_OBJECT: changed((o, c) => { c.message = null; }),
  MESSAGE_ROLE: changed((o, c, m) => { m.role = 'PRIVATE_ROLE'; }),
  MESSAGE_TOOLS: changed((o, c, m) => { m.tool_calls = { PRIVATE_KEY: 'PRIVATE_TOOL' }; }),
  MESSAGE_REFUSAL: changed((o, c, m) => { m.refusal = 'PRIVATE_REFUSAL'; }),
  REASONING_TYPE: changed((o, c, m) => { m.reasoning_content = { PRIVATE_KEY: 'PRIVATE_REASONING' }; }),
  REASONING_SIZE: changed((o, c, m) => { m.reasoning_content = 'PRIVATE_REASONING'.repeat(1000); }),
  CONTENT_MISSING: changed((o, c, m) => { delete m.content; }),
  CONTENT_TYPE: changed((o, c, m) => { m.content = { PRIVATE_KEY: 'PRIVATE_CONTENT' }; }),
  CONTENT_REASONING_ONLY: changed((o, c, m) => { m.content = ''; m.reasoning_content = 'PRIVATE_REASONING'; }),
  CONTENT_EMPTY: changed((o, c, m) => { m.content = ' \n '; }),
  CONTENT_SIZE: changed((o, c, m) => { m.content = 'PRIVATE_CONTENT'.repeat(1000); }),
  CONTENT_MARKERS: changed((o, c, m) => { m.content = '<think>PRIVATE_REASONING</think>PRIVATE_FINAL'; })
};
for (const [reason, output] of Object.entries(examples)) test(`safe diagnostic ${reason}: fixed category, no raw data, same refusal`, () => {
  const before = structuredClone(output);
  assert.throws(() => previousModelText(output), e => e.code === 'INVALID_MODEL_RESPONSE');
  assert.throws(() => modelText(output), e => {
    assert.equal(e.code, 'INVALID_MODEL_RESPONSE'); assert.equal(e.status, 502);
    assert.equal(modelFailureReason(e), reason);
    assert(!JSON.stringify(e).includes('PRIVATE_'));
    assert(!JSON.stringify({ reason: modelFailureReason(e) }).includes('PRIVATE_'));
    return true;
  });
  assert.deepEqual(output, before);
});
test('all descriptions and reason strings are a fixed allowlist; prototype/HTML values never qualify', () => {
  assert.deepEqual(Object.keys(examples).sort(), Object.keys(VALIDATION_DIAGNOSTICS).sort());
  for (const reason of Object.keys(examples)) assert(isValidationReason(reason));
  for (const value of [undefined, null, {}, [], 'constructor', '__proto__', 'toString', '<img src=x>', 'PRIVATE_TYPE'])
    assert.equal(isValidationReason(value), false);
});
test('a provider-spoofed error category cannot pass the parser error identity boundary', () => {
  const fake = Object.assign(new Failure(502, 'INVALID_MODEL_RESPONSE'), { validationReason: 'FINISH_LENGTH' });
  assert.equal(modelFailureReason(fake), undefined);
  assert.equal(modelFailureReason(new Error('PRIVATE_ERROR')), undefined);
});
test('frozen prior policy differs only for the two intentional message-level null variants', () => {
  const values = [undefined, null, false, true, 0, 1, '0', '', ' ', 'PRIVATE_VALUE', [], {}, [{ tool: 'PRIVATE_TOOL' }],
    'stop', 'length', 'assistant', 'chat.completion', '<think>PRIVATE</think>', 'x'.repeat(8000), 'x'.repeat(8001)];
  const fields = { root: ['object', 'choices', 'tool_calls', 'function_call'],
    choice: ['index', 'finish_reason', 'tool_calls', 'function_call', 'message'],
    message: ['role', 'content', 'reasoning_content', 'tool_calls', 'function_call', 'refusal'] };
  const outcome = (fn, value) => { try { return { text: fn(value) }; } catch (e) { return { code: e.code }; } };
  let cases = 0, intentionalDifferences = 0;
  for (const [level, names] of Object.entries(fields)) for (const name of names) for (const value of values) {
    const output = changed((o, c, m) => { ({ root: o, choice: c, message: m })[level][name] = value; });
    const current = outcome(modelText, output), prior = outcome(previousModelText, output);
    if (level === 'message' && ['tool_calls', 'function_call'].includes(name) && value === null) {
      assert.deepEqual(current, { text: 'Synthetic final' });
      assert.deepEqual(prior, { code: 'INVALID_MODEL_RESPONSE' }); intentionalDifferences++;
    } else assert.deepEqual(current, prior, level + '/' + name);
    cases++;
  }
  assert.equal(cases, 300); assert.equal(intentionalDifferences, 2);
  assert.equal(modelText(completion('Safe final')), previousModelText(completion('Safe final')));
});
