function renderNote(note) {
  return `${note.author}: ${note.body}`;
}

module.exports = { renderNote };
