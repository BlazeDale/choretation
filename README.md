# Choretation

A household chore rotation app. Describe your home, get a chore list where nothing takes more than 2 hours, and the app rotates chores between everyone so weekly time stays even.

- **Web app / installable PWA** (React + Vite). On Android, open it in Chrome and choose "Add to Home screen".
- **Backend: Firebase** (Firestore + Auth + Hosting) on the free Spark plan. No server code: the rotation runs in the app.
- **One shared login** per household. Everyone uses the same email/password and filters the Today view by person.

## How it works

- **Generator** (`src/generator.ts`): turns rooms, floors, pets, yard, appliances etc. into chores with a time estimate and a frequency. Anything over 120 minutes is split into parts (e.g. "Mow lawn (part 1 of 2)"). Floor-wide jobs scale with rooms per floor.
- **Rotation** (`src/rotation.ts`): each chore costs `minutes × 7 / everyDays` per week. New chores go to whoever has the least weekly load. When a chore is marked done, its next due date is set from today and it passes to the least-loaded *other* person. "Rebalance" in Settings reassigns everything from scratch.
- **Star chart** (Print tab): a printable monthly chart per person with stars to color in, a jar to fill, and a reward line. Since assignments rotate, it simulates the month assuming each chore is done on its due date.

## Setup

1. Create a project at <https://console.firebase.google.com> (keep it separate from other projects so free quotas aren't shared).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (production mode, any region).
4. **Project settings → Your apps → Web (`</>`)**: register an app and copy the config values.
5. `cp .env.example .env.local` and fill them in.
6. Install the CLI and connect it once:
   ```sh
   npm install -g firebase-tools
   firebase login
   firebase use --add        # pick your project
   firebase deploy --only firestore:rules
   ```

## Develop

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # generator + rotation unit tests
```

## Deploy

The site is hosted on **GitHub Pages** at <https://blazedale.github.io/choretation/>. Every push to `main` runs
`.github/workflows/pages.yml`, which tests, builds with `BASE_PATH=/choretation/`, and publishes `dist/`.

- The Firebase web config comes from repository **variables** (Settings → Secrets and variables → Actions → Variables):
  `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. These are
  public by design; the Firestore security rules are what protect each household's data.
- `blazedale.github.io` must be listed under Firebase **Authentication → Settings → Authorized domains**.
- Firestore rules still deploy from here: `firebase deploy --only firestore:rules`.

Firebase Hosting also still works (`npm run deploy`), serving from the site root.

## Data model

```
households/{uid}              name, members[{id,name}], home{...}
households/{uid}/chores/{id}  key, area, name, minutes, everyDays, assigneeId, nextDue, lastDone, lastDoneBy, active
households/{uid}/history/{id} choreId, choreName, memberId, minutes, date, at
```

Security rules (`firestore.rules`) only let the signed-in household account read and write its own data.
