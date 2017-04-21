/* eslint-disable import/prefer-default-export */

export function funcify(obj) {
  switch (typeof obj) {
    case 'function':
      return obj();
    default:
      return obj;
  }
}
