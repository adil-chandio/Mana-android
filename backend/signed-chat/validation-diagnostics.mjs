// Fixed public categories only. Never use provider strings, keys, snippets or counts.
export const VALIDATION_DIAGNOSTICS = Object.freeze({
  OUTPUT_NOT_OBJECT: 'Provider output was not an object.',
  RESPONSE_STYLE_ENVELOPE: 'A response-style envelope was returned, not the expected completion envelope.',
  ENVELOPE_TYPE_MISSING: 'The completion envelope type was missing.',
  ENVELOPE_TYPE_OTHER: 'The completion envelope type was not the expected value.',
  CHOICES_NOT_ARRAY: 'The completion choices list was missing or malformed.',
  CHOICE_COUNT: 'The result did not contain exactly one choice.',
  ROOT_TOOLS: 'Top-level tool or function fields were not accepted.',
  CHOICE_NOT_OBJECT: 'The selected completion choice was malformed.',
  CHOICE_INDEX: 'The choice index was missing or not zero.',
  FINISH_MISSING: 'The completion finish reason was missing.',
  FINISH_LENGTH: 'The provider marked the completion as token-limited.',
  FINISH_TOOLS: 'The provider marked the completion as a tool/function result.',
  FINISH_OTHER: 'The completion finish reason was not the expected stop value.',
  CHOICE_TOOLS: 'Choice-level tool or function fields were not accepted.',
  MESSAGE_NOT_OBJECT: 'The completion message was missing or malformed.',
  MESSAGE_ROLE: 'The completion role was not assistant.',
  MESSAGE_TOOLS: 'Message tool or function fields were not accepted.',
  MESSAGE_REFUSAL: 'A structured refusal field was present.',
  REASONING_TYPE: 'The separate reasoning field had an unexpected type.',
  REASONING_SIZE: 'The separate reasoning field exceeded the accepted size.',
  CONTENT_MISSING: 'Final message content was missing.',
  CONTENT_TYPE: 'Final message content was not a text string.',
  CONTENT_REASONING_ONLY: 'Final content was empty while a separate reasoning field was nonempty.',
  CONTENT_EMPTY: 'Final message content was empty.',
  CONTENT_SIZE: 'Final message content exceeded the accepted size.',
  CONTENT_MARKERS: 'Final content contained a reasoning or chat-template marker.'
});
export const isValidationReason = value => typeof value === 'string'
  && Object.hasOwn(VALIDATION_DIAGNOSTICS, value);
