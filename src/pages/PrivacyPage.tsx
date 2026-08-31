import { Link } from 'react-router-dom';
import { PublicLayout } from './PublicLayout';
import classes from './PrivacyPage.module.css';

export function PrivacyPage() {
  return (
    <PublicLayout>
      <article className={classes.article}>
        <p className={classes.eyebrow}>Homeslate</p>
        <h1>Privacy Policy</h1>
        <p className={classes.updated}>Last updated August 31, 2026</p>
        <p>
          This policy describes how Homeslate (<a href="https://homeslate.dev">homeslate.dev</a>)
          handles information when you use the hosted app. It is meant to
          match the Google OAuth consent screen for this product. Questions:{' '}
          <a href="mailto:support@homeslate.dev">support@homeslate.dev</a>.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Google account.</strong> When you sign in, we receive your
            Google user id, email, name, and profile photo. We store these on
            our servers so we can identify your account.
          </li>
          <li>
            <strong>Google tokens.</strong> We store access and refresh tokens
            so wall displays can keep loading your calendars after you close
            the browser you signed in on. Signing out of Homeslate in the
            browser clears the local session; it does not revoke Google access
            or delete server-side tokens. To disconnect Google entirely, use{' '}
            <a href="https://myaccount.google.com/permissions">
              Google Account permissions
            </a>
            .
          </li>
          <li>
            <strong>Google Calendar data.</strong> Calendar widgets fetch the
            calendars you select and their upcoming events, including titles,
            times, and related calendar metadata. That data is requested from
            Google to render your display. We do not sell it.
          </li>
          <li>
            <strong>Google Photos you pick.</strong> If you use the Photos
            Picker, we copy the specific photos you choose into Homeslate
            storage and serve them to your displays. We cannot list or browse
            your full Google Photos library.
          </li>
          <li>
            <strong>Display configuration.</strong> Display names, widget
            layouts, themes, notes, to-dos, alarms, and similar settings you
            create in Homeslate.
          </li>
          <li>
            <strong>Invites and sharing.</strong> Email addresses you enter when
            you invite someone to a display.
          </li>
        </ul>

        <h2>How we use Google user data</h2>
        <p>
          Homeslate uses Google user data only to provide the features you
          enable:
        </p>
        <ul>
          <li>Sign in and associate displays, views, and invites with you.</li>
          <li>
            Show your selected calendars and events on Homeslate displays you
            (or people you invite) open.
          </li>
          <li>
            Show photos you explicitly pick on those displays.
          </li>
        </ul>
        <p>
          We do not sell Google user data. We do not use it for advertising. We
          do not use it to train models. Limited operators and infrastructure
          providers (hosting and database) process it only to run the service.
        </p>

        <h2>Where data lives</h2>
        <p>
          Account records, tokens, and display configuration are stored in
          our hosted database. Photos you upload or pick are stored in object
          storage used by the app. Weather, news, and stocks widgets call
          third-party APIs with locations or symbols you configure — not with
          your Google account.
        </p>

        <h2>Retention and your choices</h2>
        <p>
          We keep account and display data while your account is active. There
          is not yet a self-serve delete-account control. Email{' '}
          <a href="mailto:support@homeslate.dev">support@homeslate.dev</a> to
          request deletion of your Homeslate account and stored Google tokens.
          You can also revoke Homeslate in Google Account permissions, which
          stops new Google API access.
        </p>

        <h2>Children</h2>
        <p>
          Homeslate is a household display product. It is not directed at
          children under 13, and we do not knowingly collect Google account
          data from them.
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes, we will update this page and the date above.
          The current policy is always at{' '}
          <Link to="/privacy">homeslate.dev/privacy</Link>.
        </p>
      </article>
    </PublicLayout>
  );
}
