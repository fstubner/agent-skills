import './styles/legacy.css';
import './styles/base.css';
import './styles/components.css';
import './styles/utilities.css';
import './styles/vars.css';
import { Alert, FieldHint, InlineError } from './components/Alert.jsx';
import { Button, DestructiveLink, LinkButton } from './components/Button.jsx';
import { calendarPalette, densityBand } from './components/Calendar.jsx';
import { Card, EmptyCard, HighlightCard } from './components/Card.jsx';

export default function App({ appointments = [], notice }) {
  return (
    <div>
      <nav className="nav">
        <a className="nav-link nav-link-active" href="/today">Today</a>
        <a className="nav-link" href="/patients">Patients</a>
        <a className="nav-link" href="/settings">Settings</a>
      </nav>

      <main style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        <h1>Today</h1>
        {notice ? <Alert kind="info">{notice}</Alert> : null}

        <HighlightCard title="Next appointment">
          <p className="muted">Room 3, in 20 minutes</p>
        </HighlightCard>

        <h2>Schedule</h2>
        {appointments.length === 0 ? (
          <EmptyCard>Nothing booked for today.</EmptyCard>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Time</th><th>Patient</th><th>Room</th><th /></tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} style={{ background: densityBand(a.load, 4) }}>
                  <td>{a.time}</td>
                  <td>{a.patient}</td>
                  <td>{a.room}</td>
                  <td>
                    <LinkButton>Move</LinkButton>{' '}
                    <DestructiveLink>Cancel</DestructiveLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Card title="Notes" meta="Updated 10 minutes ago">
          <p className="subtle">No handover notes for this shift.</p>
          <FieldHint>Notes are visible to the whole clinic.</FieldHint>
        </Card>

        <div className="stack">
          <Button variant="primary">Book appointment</Button>{' '}
          <Button variant="danger">Close clinic</Button>
        </div>

        <div
          className="divider"
          style={{ borderColor: calendarPalette.grid, marginTop: '15px' }}
        />
        <InlineError>Two rooms are double-booked at 14:00.</InlineError>
      </main>
    </div>
  );
}
