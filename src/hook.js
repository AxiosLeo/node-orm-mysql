'use strict';

const EventEmitter = require('events');

const events = {}; // event tree
const hook = new EventEmitter();

const pushEvent = ({ label, table, opt, callback }) => {
  label = label || '*';
  if (!events[label]) {
    events[label] = {};
  }
  table = table || '*';
  if (!events[label][table]) {
    events[label][table] = {};
  }
  opt = opt || '*';
  if (!events[label][table][opt]) {
    events[label][table][opt] = 0;
  }
  events[label][table][opt]++;
  hook.on(`${label}::${table}::${opt}`, callback);
  return { label, table, opt, callback };
};

const eventRecur = (curr, trace, step, paths, args) => {
  if (step === trace.length) {
    hook.emit(paths.join('::'), ...args);
    return;
  }
  const t = trace[step];
  if (curr['*']) {
    paths[step] = '*';
    eventRecur(curr[t], trace, step + 1, paths, args);
  }
  if (curr[t]) {
    paths[step] = t;
    eventRecur(curr[t], trace, step + 1, paths, args);
  }
  return;
};

const handleEvent = (label, table, opt, ...args) => {
  let curr = events;
  let step = 0;
  let trace = [label, table, opt];
  eventRecur(curr, trace, step, [], args);
};

class Hook {
  static pre(callback, { table, opt }) {
    return pushEvent({
      label: 'pre', table, opt, callback
    });
  }

  static post(callback, { table, opt }) {
    return pushEvent({
      label: 'post', table, opt, callback
    });
  }
}

module.exports = {
  Hook,
  handleEvent
};
