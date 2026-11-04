const KEY = 'remind';

/** Android only: notification shortly before the predicted next sleep. Per device. */
class Reminder {
  enabled = $state(read());

  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(KEY, this.enabled ? '1' : '0');
    } catch {
      /* stays on for this session */
    }
  }
}

function read() {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export const reminder = new Reminder();
