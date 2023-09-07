'use strict';

const EventEmitter = require('events');

const events = {}; // event tree
const hook = new EventEmitter();

const push = (callback, trace = []) => {
  let step = 0;
  let curr = events;
  let event_name_items = [];
  while (step < trace.length) {
    let curr_key = trace[step] || '*';
    if (curr_key === '__proto__' || curr_key === 'constructor' || curr_key === 'prototype') {
      curr_key = '*';
    }
    event_name_items.push(curr_key);
    if (!curr[curr_key]) {
      curr[curr_key] = {};
    }
    curr = curr[curr_key];
    step++;
  }
  let event_name = event_name_items.join('::');
  hook.on(event_name, callback);
  return event_name;
};

const pushEvent = (options = {}) => {
  const { label, table, opt, callback } = options;
  const trace = [label, table, opt];
  const event_name = push(callback, trace);
  return { event_name, label, table, opt, callback };
};

/**
 * @param {Map} curr 
 * @param {*} trace 
 * @param {*} step 
 * @param {*} paths 
 * @param {*} args 
 * @returns 
 */
const eventRecur = (curr, trace, step, paths, args) => {
  if (step === trace.length) {
    hook.emit(paths.join('::'), ...args);
    return;
  }
  const t = trace[step];
  if (curr['*']) {
    paths[step] = '*';
    eventRecur(curr['*'], trace, step + 1, paths, args);
  }
  if (curr[t]) {
    paths[step] = t;
    eventRecur(curr[t], trace, step + 1, paths, args);
  }
  return;
};

class Hook {
  static pre(callback, options = {}) {
    const { table, opt } = options;
    return pushEvent({
      label: 'pre', table, opt, callback
    });
  }

  static post(callback, options = {}) {
    const { table, opt } = options;
    return pushEvent({
      label: 'post', table, opt, callback
    });
  }

  static register(callback, ...paths) {
    push(callback, paths);
  }

  static listen(options = {}, ...args) {
    const { label, table, opt } = options;
    Hook.trigger([label, table, opt], ...args);
  }

  static trigger(paths = [], ...args) {
    let curr = events;
    let step = 0;
    let trace = paths;
    eventRecur(curr, trace, step, [], args);
  }
}

module.exports = Hook;
