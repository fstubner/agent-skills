// Three-step fault report. Step 1 picks the property and room, step 2 takes
// the description and urgency, step 3 confirms and submits.
const draft = { property: null, room: null, description: '', urgency: 'normal' };
let step = 1;

function render() {
  const app = document.getElementById('app');
  if (step === 1) {
    app.innerHTML = `<h1>Which property?</h1>${propertyPicker()}`;
  } else if (step === 2) {
    app.innerHTML = `<h1>What is wrong?</h1>
      <textarea id="description">${draft.description}</textarea>
      ${urgencyPicker()}`;
  } else {
    app.innerHTML = `<h1>Check and send</h1>${summary(draft)}<button id="send">Send</button>`;
  }
}

function next() {
  if (step === 2) {
    draft.description = document.getElementById('description').value;
    draft.urgency = document.querySelector('input[name=urgency]:checked')?.value ?? 'normal';
  }
  step += 1;
  render();
}

async function send() {
  const res = await fetch('/api/faults', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(draft),
  });
  if (!res.ok) {
    const { errors } = await res.json();
    // The server echoes the submission back, so nothing typed is lost when a
    // submission is rejected.
    document.getElementById('app').insertAdjacentHTML('afterbegin', `<p class="error">${errors.join(', ')}</p>`);
    return;
  }
  step = 4;
  render();
}

render();
