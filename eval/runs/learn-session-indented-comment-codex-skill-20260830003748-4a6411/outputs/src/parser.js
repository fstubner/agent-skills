export function isComment(line) {
  return line.trimStart().startsWith('#');
}
