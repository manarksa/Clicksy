const INTRO_OFF_KEY = 'clicksy_intro_off'

export function isIntroDisabled() {
  try {
    return localStorage.getItem(INTRO_OFF_KEY) === '1'
  } catch {
    return false
  }
}

export function setIntroDisabled(disabled: boolean) {
  try {
    if (disabled) localStorage.setItem(INTRO_OFF_KEY, '1')
    else localStorage.removeItem(INTRO_OFF_KEY)
  } catch {
    /* The button still updates the page for this view. */
  }
}
