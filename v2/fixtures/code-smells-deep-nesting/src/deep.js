function outer(a, b, c, d, e) {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          if (e) {
            return 'too deep';
          }
        }
      }
    }
  }
  return null;
}

module.exports = { outer };
