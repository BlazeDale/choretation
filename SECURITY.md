# Security notes

Choretation is a static site (GitHub Pages) talking directly to Firebase. There is no server of our own.

## Where data lives

| Data | Where | Who can see it |
| --- | --- | --- |
| Household email + password | Firebase Authentication (passwords stored hashed by Google) | The project owner in the Firebase console |
| Household, chores, notes, history | Firestore `households/{uid}` | Only the signed-in household account (`firestore.rules`) |
| Code, artwork, Firebase web config | Public GitHub repo / site | Anyone. The web config is meant to be public; it grants nothing on its own |

The repo contains no account emails or secrets; commits use a GitHub `noreply` address. `.env.local` is git-ignored.

## Checked / done

- [x] **Firestore rules are live**: an unauthenticated request to read households returns `PERMISSION_DENIED` (checked 2026-10-14).
- [x] **Email enumeration protection** is on (Authentication → Settings → User actions).
- [x] **Password policy**: new passwords need 10+ characters (set 2026-10-14). Existing logins aren't forced to change.
- [x] **Authorized domains** are limited to `localhost`, the two Firebase hosting domains, and `blazedale.github.io`.
- [x] **Sign-in screen**: "Forgot password?" sends a Firebase reset email, and shows the same message whether or not the email has an account. Repeated wrong guesses are rate-limited by Firebase.
- [x] Personal avatar art is named by look, not by person.

## Still to do (owner, in the Google/Firebase consoles)

- [ ] **2-Step Verification on the Google account that owns the Firebase project.** That account can see every household email and change any setting, so it's the most valuable thing to protect.
- [ ] **Use a long, unique household password** (a passphrase is easiest to share around the house). If the current one is under 10 characters, change it via "Forgot password?".
- [ ] *Optional:* **App Check** (Firebase console → App Check, with reCAPTCHA Enterprise). It stops other sites and scripts from using this Firebase project with the public config. It needs a site key from the console, then a few lines in `src/firebase.ts`.
