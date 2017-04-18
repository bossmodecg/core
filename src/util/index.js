/* eslint-disable import/prefer-default-export */

export function funcify(obj) {
  switch (typeof obj) {
    case 'function':
      return obj();
    default:
      return obj;
  }
}

export function messagify(obj) {
  switch (typeof obj) {
    case 'function':
      return obj();
    case 'object':
      return JSON.stringify(obj);
    default:
      return obj;
  }
}
