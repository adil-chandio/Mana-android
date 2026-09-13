// Build-side error projection only. Never expose body text, messages, URLs or IDs.
export const API_STAGES = Object.freeze(['active_deployment', 'logging_preflight', 'source_version',
  'active_recheck', 'logging_recheck', 'version_upload', 'uploaded_version', 'active_readback', 'logging_readback']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => object(value) && Object.hasOwn(value, key) ? value[key] : undefined;
export function summarizeApiFailure(stage, status, envelope) {
  const codes = [];
  let state = 'unavailable';
  if (own(envelope, 'success') === false) {
    const errors = own(envelope, 'errors');
    if (Array.isArray(errors) && errors.length === 0) state = 'none';
    else if (Array.isArray(errors) && errors.length > 0 && errors.length <= 3
      && errors.every(error => Number.isInteger(own(error, 'code')) && own(error, 'code') >= 0 && own(error, 'code') <= 999999)) {
      state = 'numeric';
      codes.push(...errors.map(error => own(error, 'code')));
    } else state = 'withheld';
  }
  return Object.freeze({ stage: API_STAGES.includes(stage) ? stage : 'unavailable',
    http_status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : 'unavailable',
    cf_code_state: state, cf_codes: Object.freeze(codes) });
}
